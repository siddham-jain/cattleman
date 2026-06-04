"""Export a trained checkpoint to ONNX and verify the exported graph.

Export is not the risky part — silent divergence is. A model that exports without
error can still disagree with PyTorch once fused and constant-folded, and that
disagreement would only surface as bad predictions on a phone. So this compares
both runtimes on real held-out images and fails loudly if they part ways.

Writes alongside the .onnx file a metadata JSON the mobile app reads, so
preprocessing constants live in one place rather than being retyped in
JavaScript and drifting.

Usage:  python ml/export_onnx.py --checkpoint ml/models/best.pt
"""
import argparse
import json
from pathlib import Path

import numpy as np
import torch

from breeds import TARGET_BREEDS, animal_type
from data import IMAGENET_MEAN, IMAGENET_STD, build_dataloaders
from model import build_model, pick_device

# The dynamo exporter implements opset 18 and upwards. Asking for 17 does not
# get 17 — it exports at 18, attempts a downconversion that fails on this graph,
# and silently keeps 18. Requesting 18 skips that dead end. ONNX Runtime 1.20 on
# the phone handles opsets up to 21, so there is nothing to gain from a lower one.
OPSET = 18


def load_checkpoint(path: Path, device):
    checkpoint = torch.load(path, map_location=device, weights_only=False)
    classes = checkpoint.get("classes", list(TARGET_BREEDS))
    if classes != list(TARGET_BREEDS):
        raise SystemExit("Checkpoint class order differs from breeds.TARGET_BREEDS")
    model, _ = build_model(checkpoint["arch"], pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    return model.eval(), checkpoint


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=Path("ml/models/best.pt"))
    parser.add_argument("--out", type=Path, default=Path("ml/models/cattleman.onnx"))
    parser.add_argument("--splits", type=Path, default=Path("ml/data/splits"))
    parser.add_argument("--tolerance", type=float, default=1e-4,
                        help="max acceptable absolute logit difference")
    args = parser.parse_args()

    if not args.checkpoint.exists():
        raise SystemExit(f"{args.checkpoint} not found — run ml/train.py first")

    # Export on CPU: MPS tracing has its own quirks and the artefact must be
    # device independent anyway.
    device = torch.device("cpu")
    model, checkpoint = load_checkpoint(args.checkpoint, device)
    img_size = checkpoint.get("img_size", 224)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    dummy = torch.randn(1, 3, img_size, img_size)
    torch.onnx.export(
        model, dummy, str(args.out),
        input_names=["input"], output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=OPSET, do_constant_folding=True,
    )

    import onnx
    import onnxruntime as ort

    # The exporter writes weights to a sidecar .onnx.data file by default, which
    # leaves the .onnx itself a few hundred KB of graph with the tensors beside
    # it. The mobile app bundles a single asset, and a model silently missing its
    # weights fails at load time on a phone rather than here, so collapse it into
    # one self-contained file.
    consolidated = onnx.load(str(args.out))  # follows the sidecar reference
    onnx.save_model(consolidated, str(args.out), save_as_external_data=False)
    sidecar = args.out.with_suffix(args.out.suffix + ".data")
    if sidecar.exists():
        sidecar.unlink()

    size_mb = args.out.stat().st_size / 1e6
    # Report the opset the file actually carries, not the one we asked for.
    actual_opset = max(o.version for o in consolidated.opset_import)
    print(f"exported {args.out} ({size_mb:.1f} MB, opset {actual_opset}, single file)")

    onnx.checker.check_model(onnx.load(str(args.out)))
    session = ort.InferenceSession(str(args.out), providers=["CPUExecutionProvider"])

    # Parity on real held-out images, not random noise: constant folding errors
    # tend to show up on realistic activations.
    loaders, _ = build_dataloaders(args.splits, batch_size=32, img_size=img_size,
                                   num_workers=0, balanced=False)
    max_diff = 0.0
    agree = total = 0
    with torch.inference_mode():
        for images, _ in loaders["test"]:
            torch_logits = model(images).numpy()
            onnx_logits = session.run(["logits"], {"input": images.numpy()})[0]
            max_diff = max(max_diff, float(np.abs(torch_logits - onnx_logits).max()))
            agree += int((torch_logits.argmax(1) == onnx_logits.argmax(1)).sum())
            total += images.shape[0]

    print(f"parity over {total} test images: max |Δlogit| = {max_diff:.2e}, "
          f"top-1 agreement {agree}/{total}")

    metadata = {
        "model": args.out.name,
        "arch": checkpoint["arch"],
        "img_size": img_size,
        "classes": list(TARGET_BREEDS),
        "animal_type": {b: animal_type(b) for b in TARGET_BREEDS},
        "normalization": {"mean": list(IMAGENET_MEAN), "std": list(IMAGENET_STD)},
        "layout": "NCHW",
        "opset": actual_opset,
        "size_mb": round(size_mb, 1),
        "output": "logits (apply softmax for probabilities)",
        "val_acc": checkpoint.get("val_acc"),
    }
    metadata_path = args.out.with_suffix(".json")
    metadata_path.write_text(json.dumps(metadata, indent=2))
    print(f"wrote {metadata_path}")

    if agree != total or max_diff > args.tolerance:
        raise SystemExit(
            f"ONNX export diverges from PyTorch "
            f"(agreement {agree}/{total}, max diff {max_diff:.2e} > {args.tolerance:.0e})")
    print("parity OK")


if __name__ == "__main__":
    main()
