"""Evaluate a trained checkpoint on a held-out split.

Reports top-1 and top-3 accuracy, per-class precision/recall/F1, and the
confusion pairs the model actually gets wrong. Top-3 matters because the app
surfaces a ranked candidate list rather than a single answer, so a correct breed
in third place is still useful to a field worker.

Usage:  python ml/evaluate.py --checkpoint ml/models/mobilenet_v3_large.pt
"""
import argparse
import json
from collections import Counter
from pathlib import Path

import torch

from breeds import TARGET_BREEDS
from data import build_dataloaders
from model import build_model, pick_device


def evaluate(model, loader, device, num_classes):
    confusion = torch.zeros(num_classes, num_classes, dtype=torch.long)
    top1 = top3 = seen = 0
    confidences = []

    model.eval()
    with torch.inference_mode():
        for images, targets in loader:
            images, targets = images.to(device), targets.to(device)
            probs = model(images).softmax(dim=1)
            ranked = probs.topk(min(3, num_classes), dim=1).indices

            top1 += (ranked[:, 0] == targets).sum().item()
            top3 += (ranked == targets.unsqueeze(1)).any(dim=1).sum().item()
            seen += targets.size(0)
            confidences += probs.max(dim=1).values.tolist()

            for target, predicted in zip(targets.tolist(), ranked[:, 0].tolist()):
                confusion[target, predicted] += 1

    return {"top1": top1 / seen, "top3": top3 / seen, "n": seen,
            "confusion": confusion, "confidences": confidences}


def per_class_table(confusion, classes):
    rows = []
    for i, name in enumerate(classes):
        tp = confusion[i, i].item()
        support = confusion[i].sum().item()
        predicted = confusion[:, i].sum().item()
        recall = tp / support if support else 0.0
        precision = tp / predicted if predicted else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        rows.append({"breed": name, "support": support, "precision": precision,
                     "recall": recall, "f1": f1})
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=Path("ml/models/mobilenet_v3_large.pt"))
    parser.add_argument("--splits", type=Path, default=Path("ml/data/splits"))
    parser.add_argument("--split", default="test")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--num-workers", type=int, default=2)
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()

    if not args.checkpoint.exists():
        raise SystemExit(f"{args.checkpoint} not found — run ml/train.py first")

    device = pick_device()
    checkpoint = torch.load(args.checkpoint, map_location=device, weights_only=False)
    classes = checkpoint.get("classes", list(TARGET_BREEDS))
    if classes != list(TARGET_BREEDS):
        raise SystemExit("Checkpoint class order differs from breeds.TARGET_BREEDS")

    model, _ = build_model(checkpoint["arch"], pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.to(device)

    loaders, datasets = build_dataloaders(args.splits, args.batch_size,
                                          checkpoint.get("img_size", 224),
                                          args.num_workers, balanced=False)
    result = evaluate(model, loaders[args.split], device, len(classes))

    print(f"checkpoint={args.checkpoint.name}  arch={checkpoint['arch']}  "
          f"split={args.split}  n={result['n']}  device={device}")
    print(f"\n  top-1 accuracy: {result['top1']:.4f}")
    print(f"  top-3 accuracy: {result['top3']:.4f}")

    confidences = torch.tensor(result["confidences"])
    print(f"  mean confidence: {confidences.mean():.3f}  median: {confidences.median():.3f}")

    rows = per_class_table(result["confusion"], classes)
    print(f"\n{'breed':<14}{'support':>8}{'precision':>11}{'recall':>8}{'f1':>7}")
    for row in sorted(rows, key=lambda r: r["f1"]):
        print(f"  {row['breed']:<12}{row['support']:>8}{row['precision']:>11.3f}"
              f"{row['recall']:>8.3f}{row['f1']:>7.3f}")

    macro_f1 = sum(r["f1"] for r in rows) / len(rows)
    print(f"\n  macro F1: {macro_f1:.4f}")

    mistakes = Counter()
    for i in range(len(classes)):
        for j in range(len(classes)):
            if i != j and result["confusion"][i, j]:
                mistakes[(classes[i], classes[j])] = result["confusion"][i, j].item()
    print("\n  most frequent confusions (true -> predicted):")
    for (true, predicted), count in mistakes.most_common(8):
        print(f"    {true:<14} -> {predicted:<14} {count}")

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps({
            "checkpoint": str(args.checkpoint), "arch": checkpoint["arch"],
            "split": args.split, "n": result["n"],
            "top1": result["top1"], "top3": result["top3"], "macro_f1": macro_f1,
            "per_class": rows,
            "confusion": result["confusion"].tolist(), "classes": classes,
            "confusions": [{"true": t, "predicted": p, "count": c}
                           for (t, p), c in mistakes.most_common()],
        }, indent=2))
        print(f"\n  wrote {args.json_out}")


if __name__ == "__main__":
    main()
