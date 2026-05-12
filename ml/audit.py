"""Audit the raw dataset: integrity, class balance, and split leakage.

The upstream dataset augments images before splitting them, so copies of one
photo appear in both train and test. This script quantifies that. Run it before
building splits, and again afterwards to confirm our splits are clean.

Usage:  python ml/audit.py                        # audit upstream splits
        python ml/audit.py --root ml/data/splits  # audit ours
"""
import argparse
import collections
import json
import re
from pathlib import Path

from PIL import Image

from imagehash import cluster, hash_file

SPLIT_IN_NAME = re.compile(r"_(train|val|test)_")


def upstream_split(path: Path) -> str:
    """Recover the upstream split from the filename, e.g. Cattle_Gir_test_002_aug3.jpg."""
    match = SPLIT_IN_NAME.search(path.name)
    return match.group(1) if match else "unknown"


def collect(root: Path, split_of):
    """Return records of (breed, split, path, hash) plus any unreadable files."""
    records, broken = [], []
    for breed_dir in sorted(p for p in root.rglob("*") if p.is_dir()):
        images = sorted(p for p in breed_dir.iterdir()
                        if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
        for path in images:
            try:
                with Image.open(path) as img:
                    img.verify()
                records.append((breed_dir.name, split_of(path), path, hash_file(path)))
            except Exception as exc:
                broken.append((path, repr(exc)[:80]))
    return records, broken


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("ml/data/raw"))
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()

    # In ml/data/raw the split is encoded in the filename; in ml/data/splits it
    # is the top-level directory.
    is_split_layout = (args.root / "train").is_dir()
    split_of = (lambda p: p.parent.parent.name) if is_split_layout else upstream_split

    records, broken = collect(args.root, split_of)
    if not records:
        raise SystemExit(f"No images found under {args.root}")

    print(f"root={args.root}  images={len(records)}  unreadable={len(broken)}")
    for path, err in broken:
        print(f"  BROKEN {path}: {err}")

    per_breed = collections.Counter(r[0] for r in records)
    print(f"\n=== class balance ({len(per_breed)} breeds) ===")
    for breed, count in sorted(per_breed.items(), key=lambda kv: kv[1]):
        print(f"  {breed:<14} {count:>4}")
    lo, hi = min(per_breed.values()), max(per_breed.values())
    print(f"  imbalance ratio (max/min): {hi / lo:.2f}")

    print("\n=== duplicate / leakage analysis ===")
    total_clusters = cross = 0
    leak_rows = []
    for breed in sorted(per_breed):
        rows = [r for r in records if r[0] == breed]
        groups = cluster([((r[1], r[2]), r[3]) for r in rows])
        total_clusters += len(groups)
        spanning = [g for g in groups if len({k[0] for k, _ in g}) > 1]
        cross += len(spanning)
        leaked_imgs = sum(len(g) for g in spanning)
        leak_rows.append((breed, len(rows), len(groups), len(spanning), leaked_imgs))
        print(f"  {breed:<14} images={len(rows):>3} sources={len(groups):>3} "
              f"cross-split-groups={len(spanning):>2} affected-images={leaked_imgs:>3}")

    affected = sum(r[4] for r in leak_rows)
    print(f"\n  distinct source photos: {total_clusters}")
    print(f"  groups spanning >1 split: {cross}")
    print(f"  images in leaking groups: {affected} "
          f"({100 * affected / len(records):.1f}% of dataset)")
    print(f"  VERDICT: {'LEAKAGE PRESENT' if cross else 'clean - no source photo spans splits'}")

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps({
            "root": str(args.root),
            "images": len(records),
            "unreadable": len(broken),
            "per_breed": dict(per_breed),
            "distinct_sources": total_clusters,
            "cross_split_groups": cross,
            "images_in_leaking_groups": affected,
            "per_breed_detail": [
                {"breed": b, "images": i, "sources": s,
                 "cross_split_groups": c, "affected_images": a}
                for b, i, s, c, a in leak_rows
            ],
        }, indent=2))
        print(f"\n  wrote {args.json_out}")


if __name__ == "__main__":
    main()
