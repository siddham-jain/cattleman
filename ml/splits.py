"""Build leakage-free train/val/test splits from ml/data/raw/.

The upstream splits put augmented copies of one photo in both train and test
(see ml/reports/dataset_audit.md). We discard them and split by *source photo*:
images are grouped by perceptual hash, and a whole group is assigned to exactly
one split. A model can then never be tested on a variant of an image it trained on.

Splitting is per breed so every class appears in every split, and seeded so the
result is reproducible.

Usage:  python ml/splits.py
"""
import argparse
import json
import random
import shutil
from pathlib import Path

from imagehash import cluster, hash_file

RATIOS = {"train": 0.70, "val": 0.15, "test": 0.15}


def assign(groups, ratios, rng):
    """Assign whole groups to splits, keeping each split near its target share.

    Largest groups first: they constrain the balance most, so placing them early
    avoids a big group landing last and overshooting a small split.
    """
    total = sum(len(g) for g in groups)
    targets = {s: total * r for s, r in ratios.items()}
    counts = {s: 0 for s in ratios}
    out = {s: [] for s in ratios}

    order = sorted(groups, key=len, reverse=True)
    for group in order:
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
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if not args.raw.exists():
        raise SystemExit(f"{args.raw} not found — run ml/download.py first")
    if args.out.exists():
        shutil.rmtree(args.out)

    rng = random.Random(args.seed)
    manifest, totals = {}, {s: 0 for s in RATIOS}

    for breed_dir in sorted(p for p in args.raw.iterdir() if p.is_dir()):
        images = sorted(p for p in breed_dir.iterdir()
                        if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
        groups = [[k for k, _ in g] for g in
                  cluster([(p, hash_file(p)) for p in images])]

        placed = assign(groups, RATIOS, rng)
        manifest[breed_dir.name] = {"images": len(images), "sources": len(groups)}

        for split, split_groups in placed.items():
            dest_dir = args.out / split / breed_dir.name
            dest_dir.mkdir(parents=True, exist_ok=True)
            count = 0
            for group in split_groups:
                for path in group:
                    shutil.copy2(path, dest_dir / path.name)
                    count += 1
            manifest[breed_dir.name][split] = count
            totals[split] += count

        counts = " ".join(f"{s}={manifest[breed_dir.name][s]:>3}" for s in RATIOS)
        print(f"  {breed_dir.name:<14} images={len(images):>3} sources={len(groups):>3}  {counts}")

    grand = sum(totals.values())
    print(f"\n  totals: " + "  ".join(
        f"{s}={n} ({100 * n / grand:.1f}%)" for s, n in totals.items()))

    (args.out / "manifest.json").write_text(json.dumps(
        {"seed": args.seed, "ratios": RATIOS, "totals": totals, "breeds": manifest}, indent=2))
    print(f"  wrote {args.out / 'manifest.json'}")


if __name__ == "__main__":
    main()
