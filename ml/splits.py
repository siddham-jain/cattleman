"""Build leakage-free train/val/test splits from ml/data/raw/.

Two data defects are handled here, both found by embedding the images:

1. **Cross-breed duplicates.** The same photograph appears under two different
   breeds, so at least one label is wrong. Those images are dropped.
2. **Within-breed duplicates.** Near-identical shots are grouped, and a whole
   group goes to exactly one split, so no model is tested on a variant of
   something it trained on.

Grouping used to be perceptual-hash based; that silently failed and produced
splits a trained model scored 100% on. See ml/dedup.py.

Splitting is per breed so every class appears in every split, and seeded so the
result is reproducible.

Usage:  python ml/splits.py
"""
import argparse
import json
import random
import shutil
from pathlib import Path

from dedup import (DUPLICATE_THRESHOLD, cluster_embeddings, cross_label_conflicts,
                   embed_paths, pick_device)

RATIOS = {"train": 0.70, "val": 0.15, "test": 0.15}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def assign(groups, ratios, rng):
    """Assign whole groups to splits, keeping each split near its target share.

    Largest groups first: they constrain the balance most, so placing them early
    avoids a big group landing last and overshooting a small split.
    """
    total = sum(len(g) for g in groups)
    targets = {s: total * r for s, r in ratios.items()}
    counts = {s: 0 for s in ratios}
    out = {s: [] for s in ratios}

    for group in sorted(groups, key=len, reverse=True):
        # Most under-quota split wins; rng breaks ties so breeds don't all
        # funnel their first group into the same split.
        split = min(ratios, key=lambda s: (counts[s] - targets[s], rng.random()))
        out[split].append(group)
        counts[split] += len(group)
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, default=Path("ml/data/raw"))
    parser.add_argument("--out", type=Path, default=Path("ml/data/splits"))
    parser.add_argument("--threshold", type=float, default=DUPLICATE_THRESHOLD)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if not args.raw.exists():
        raise SystemExit(f"{args.raw} not found — run ml/download.py first")
    if args.out.exists():
        shutil.rmtree(args.out)

    device = pick_device()
    rng = random.Random(args.seed)
    print(f"device={device}  duplicate threshold={args.threshold}\n")

    items = [(breed_dir.name, path)
             for breed_dir in sorted(p for p in args.raw.iterdir() if p.is_dir())
             for path in sorted(breed_dir.iterdir())
             if path.suffix.lower() in IMAGE_SUFFIXES]
    labels = [b for b, _ in items]
    embeddings = embed_paths([p for _, p in items], device)

    conflicted = cross_label_conflicts(labels, embeddings, args.threshold)
    if conflicted:
        dropped = {}
        for index in conflicted:
            dropped[labels[index]] = dropped.get(labels[index], 0) + 1
        print(f"  dropping {len(conflicted)} images duplicated across breeds "
              f"(ambiguous labels): "
              + ", ".join(f"{b}={n}" for b, n in sorted(dropped.items())) + "\n")

    keep = [i for i in range(len(items)) if i not in conflicted]
    manifest, totals = {}, {s: 0 for s in RATIOS}

    for breed in sorted({labels[i] for i in keep}):
        idx = [i for i in keep if labels[i] == breed]
        groups = cluster_embeddings([items[i][1] for i in idx],
                                    embeddings[idx], args.threshold)
        placed = assign(groups, RATIOS, rng)
        manifest[breed] = {"images": len(idx), "sources": len(groups)}

        for split, split_groups in placed.items():
            dest_dir = args.out / split / breed
            dest_dir.mkdir(parents=True, exist_ok=True)
            count = 0
            for group in split_groups:
                for path in group:
                    shutil.copy2(path, dest_dir / path.name)
                    count += 1
            manifest[breed][split] = count
            totals[split] += count

        counts = " ".join(f"{s}={manifest[breed][s]:>3}" for s in RATIOS)
        print(f"  {breed:<14} images={len(idx):>4} sources={len(groups):>4}  {counts}")

    grand = sum(totals.values())
    print("\n  totals: " + "  ".join(
        f"{s}={n} ({100 * n / grand:.1f}%)" for s, n in totals.items()))

    (args.out / "manifest.json").write_text(json.dumps({
        "seed": args.seed, "threshold": args.threshold, "ratios": RATIOS,
        "dropped_cross_breed_duplicates": len(conflicted),
        "totals": totals, "breeds": manifest,
    }, indent=2))
    print(f"  wrote {args.out / 'manifest.json'}")


if __name__ == "__main__":
    main()
