"""POC: can an off-the-shelf ImageNet classifier identify Indian cattle breeds?

Runs ImageNet-pretrained backbones over sample breed photos and reports what they
actually predict. The question is not "how accurate is it" — ImageNet has no
Indian breed classes at all — but whether its 1000 classes carry enough signal to
separate breeds without training. Run it, read the collapse, then read
ml/reports/poc_findings.md.

Usage:  python ml/poc_baseline.py
"""
import argparse
import collections
from pathlib import Path

import torch
from PIL import Image
from torchvision.models import (
    ResNet50_Weights, MobileNet_V3_Large_Weights,
    resnet50, mobilenet_v3_large,
)

MODELS = {
    "resnet50": (resnet50, ResNet50_Weights.IMAGENET1K_V2),
    "mobilenet_v3_large": (mobilenet_v3_large, MobileNet_V3_Large_Weights.IMAGENET1K_V1),
}


def pick_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def load_samples(root: Path):
    samples = []
    for breed_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        for img in sorted(breed_dir.glob("*.jpg")) + sorted(breed_dir.glob("*.png")):
            samples.append((breed_dir.name, img))
    return samples


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=Path, default=Path("ml/data/samples"))
    parser.add_argument("--topk", type=int, default=3)
    args = parser.parse_args()

    if not args.samples.exists():
        raise SystemExit(f"{args.samples} not found — run ml/fetch_samples.py first")

    samples = load_samples(args.samples)
    device = pick_device()
    print(f"device={device}  images={len(samples)}  breeds={len({b for b, _ in samples})}\n")

    for name, (ctor, weights) in MODELS.items():
        w = weights
        model = ctor(weights=w).to(device).eval()
        preprocess = w.transforms()
        categories = w.meta["categories"]

        print(f"===== {name} =====")
        predicted_labels = collections.Counter()
        # breed -> set of ImageNet labels it maps onto
        breed_to_labels = collections.defaultdict(set)

        with torch.inference_mode():
            for breed, path in samples:
                batch = preprocess(Image.open(path).convert("RGB")).unsqueeze(0).to(device)
                probs = model(batch).softmax(dim=1)[0]
                top = probs.topk(args.topk)
                labels = [categories[i] for i in top.indices.tolist()]
                predicted_labels[labels[0]] += 1
                breed_to_labels[breed].add(labels[0])
                pairs = ", ".join(f"{l} {s:.2f}" for l, s in zip(labels, top.values.tolist()))
                print(f"  {breed:<22} {path.name[:28]:<30} {pairs}")

        distinct = len(predicted_labels)
        print(f"\n  distinct top-1 ImageNet labels across {len(samples)} images: {distinct}")
        print(f"  label frequency: {dict(predicted_labels.most_common())}")
        collisions = [b for b, ls in breed_to_labels.items() if len(ls) == 1]
        print(f"  breeds collapsing to a single ImageNet label: {len(collisions)}/{len(breed_to_labels)}\n")


if __name__ == "__main__":
    main()
