"""Verify a finished split by asking whether the model needs to learn anything.

Two checks, both independent of how the split was built:

1. **1-NN probe.** Classify every val image by nearest training neighbour in raw
   ImageNet embedding space, with no training whatsoever. If that scores near
   100%, the val set is a lookup table of the training set and any trained
   model's accuracy is meaningless.
2. **Similarity distribution.** How many val images sit above the duplicate
   threshold from some training image.

This exists because a trained model reported 100% val accuracy on splits that a
perceptual-hash audit had certified clean. The audit was measuring the wrong
thing; this measures the thing we actually care about.

Usage:  python ml/leakcheck.py --root ml/data/splits
"""
import argparse
from pathlib import Path

import torch

from dedup import DUPLICATE_THRESHOLD, embed_paths, pick_device

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def load_split(root: Path, split: str):
    items = []
    split_dir = root / split
    if not split_dir.is_dir():
        raise SystemExit(f"{split_dir} not found")
    for breed_dir in sorted(p for p in split_dir.iterdir() if p.is_dir()):
        for path in sorted(breed_dir.iterdir()):
            if path.suffix.lower() in IMAGE_SUFFIXES:
                items.append((breed_dir.name, path))
    return items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("ml/data/splits"))
    parser.add_argument("--query", default="val")
    parser.add_argument("--reference", default="train")
    parser.add_argument("--threshold", type=float, default=DUPLICATE_THRESHOLD)
    args = parser.parse_args()

    device = pick_device()
    query = load_split(args.root, args.query)
    reference = load_split(args.root, args.reference)
    print(f"{args.query}={len(query)}  {args.reference}={len(reference)}  device={device}")

    q_emb = embed_paths([p for _, p in query], device)
    r_emb = embed_paths([p for _, p in reference], device)
    similarity = q_emb @ r_emb.T

    ref_breeds = [b for b, _ in reference]
    query_breeds = [b for b, _ in query]

    best = similarity.max(dim=1)
    predicted = [ref_breeds[i] for i in best.indices.tolist()]
    accuracy = sum(p == t for p, t in zip(predicted, query_breeds)) / len(query_breeds)

    print(f"\n  1-NN breed accuracy on RAW ImageNet features (untrained): {accuracy:.3f}")
    print(f"  max cosine similarity: median={best.values.median():.3f} "
          f"mean={best.values.mean():.3f} max={best.values.max():.3f}")

    for t in (0.99, 0.98, 0.97, 0.95, 0.93, 0.90):
        n = int((best.values >= t).sum())
        print(f"  {args.query} images with a {args.reference} image at cos >= {t:.2f}: "
              f"{n:>4}/{len(query)} ({100 * n / len(query):.1f}%)")

    over = int((best.values >= args.threshold).sum())
    print(f"\n  VERDICT: ", end="")
    if accuracy >= 0.95:
        print(f"UNUSABLE - untrained 1-NN scores {accuracy:.3f}; the split leaks")
    elif over:
        print(f"{over} image(s) above the duplicate threshold; investigate before trusting metrics")
    else:
        print("no image exceeds the duplicate threshold; split looks independent")


if __name__ == "__main__":
    main()
