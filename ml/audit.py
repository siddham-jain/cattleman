"""Audit the dataset: integrity, class balance, and duplicate structure.

Reports how many *distinct photographs* back each breed, which is the number that
actually limits what a model can learn — file counts overstate it whenever a
dataset ships augmented copies.

Pair this with ml/leakcheck.py, which validates a finished split from the other
direction by testing whether an untrained nearest-neighbour lookup can solve it.

Usage:  python ml/audit.py                        # audit ml/data/raw
        python ml/audit.py --root ml/data/splits  # audit built splits
"""
import argparse
import collections
import json
from pathlib import Path

from PIL import Image

from dedup import DUPLICATE_THRESHOLD, cluster_paths, pick_device

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def collect(root: Path):
    """Return {breed: {split: [paths]}} plus any unreadable files.

    Handles both layouts: ml/data/raw/<breed>/ and ml/data/splits/<split>/<breed>/.
    """
    by_breed = collections.defaultdict(lambda: collections.defaultdict(list))
    broken = []
    split_layout = (root / "train").is_dir()

    breed_dirs = ([d for s in root.iterdir() if s.is_dir()
                   for d in s.iterdir() if d.is_dir()]
                  if split_layout else
                  [d for d in root.iterdir() if d.is_dir()])

    for breed_dir in sorted(breed_dirs):
        split = breed_dir.parent.name if split_layout else "all"
        for path in sorted(breed_dir.iterdir()):
            if path.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            try:
                with Image.open(path) as img:
                    img.verify()
                by_breed[breed_dir.name][split].append(path)
            except Exception as exc:
                broken.append((path, repr(exc)[:80]))
    return by_breed, broken


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("ml/data/raw"))
    parser.add_argument("--threshold", type=float, default=DUPLICATE_THRESHOLD)
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()

    device = pick_device()
    by_breed, broken = collect(args.root)
    if not by_breed:
        raise SystemExit(f"No images found under {args.root}")

    total_images = sum(len(ps) for splits in by_breed.values() for ps in splits.values())
    print(f"root={args.root}  images={total_images}  breeds={len(by_breed)}  "
          f"unreadable={len(broken)}  device={device}")
    for path, err in broken:
        print(f"  BROKEN {path}: {err}")

    print(f"\n=== class balance and duplicate structure (threshold {args.threshold}) ===")
    rows, cross_total = [], 0
    for breed in sorted(by_breed):
        splits = by_breed[breed]
        all_paths = [p for ps in splits.values() for p in ps]
        groups = cluster_paths(all_paths, args.threshold, device)

        # A group whose members sit in more than one split is a leak.
        split_of = {p: s for s, ps in splits.items() for p in ps}
        spanning = [g for g in groups if len({split_of[p] for p in g}) > 1]
        cross_total += len(spanning)

        dup_ratio = len(all_paths) / max(len(groups), 1)
        rows.append({"breed": breed, "images": len(all_paths), "sources": len(groups),
                     "images_per_source": round(dup_ratio, 2),
                     "cross_split_groups": len(spanning)})
        print(f"  {breed:<14} images={len(all_paths):>4} distinct={len(groups):>4} "
              f"imgs/source={dup_ratio:>4.2f} cross-split={len(spanning):>3}")

    counts = [r["images"] for r in rows]
    sources = sum(r["sources"] for r in rows)
    print(f"\n  total distinct photographs: {sources} (from {total_images} files)")
    print(f"  imbalance ratio (max/min images): {max(counts) / min(counts):.2f}")
    print(f"  groups spanning >1 split: {cross_total}")
    print(f"  VERDICT: {'LEAKAGE PRESENT' if cross_total else 'clean - no source photo spans splits'}")

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps({
            "root": str(args.root), "images": total_images,
            "unreadable": len(broken), "threshold": args.threshold,
            "distinct_photographs": sources, "cross_split_groups": cross_total,
            "per_breed": rows,
        }, indent=2))
        print(f"\n  wrote {args.json_out}")


if __name__ == "__main__":
    main()
