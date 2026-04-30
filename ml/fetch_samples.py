"""Fetch a small set of real Indian cattle/buffalo photos for POC experiments.

Pulls a handful of images per breed from the public HuggingFace dataset
`SynthAIzer/indian-cattle-buffalo-breeds` so the pretrained-model baseline can be
run against genuine field-style photos rather than stock imagery.

Usage:  python ml/fetch_samples.py --per-breed 2
"""
import argparse
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

DATASET = "SynthAIzer/indian-cattle-buffalo-breeds"
RESOLVE = f"https://huggingface.co/datasets/{DATASET}/resolve/main/"
TREE = f"https://huggingface.co/api/datasets/{DATASET}/tree/main?recursive=true"

# POC-local mapping; formalised in ml/data.py once the dataset was adopted.
SAMPLE_DIRS = [
    "Cattle_Gir", "Cattle_Sahiwal", "Cattle_Red_Sindhi", "Cattle_Tharparkar",
    "Cattle_Kankrej", "Cattle_Ongole", "Cattle_Hariana", "Buffalo_MURRAH",
    "Buffalo_JAFFARABADI", "Buffalo_SURTI", "Buffalo_MEHSANA", "Buffalo_NILI_RAVI",
]


def list_files():
    """Walk the paginated HF tree API and return every image path."""
    url, paths = TREE, []
    while url:
        req = urllib.request.Request(url, headers={"User-Agent": "cattleman-poc"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            paths += [e["path"] for e in json.load(resp)
                      if e["type"] == "file" and e["path"].lower().endswith((".jpg", ".jpeg", ".png"))]
            link = resp.headers.get("Link", "")
        match = re.search(r'<([^>]+)>;\s*rel="next"', link)
        url = match.group(1) if match else None
    return paths


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-breed", type=int, default=2)
    parser.add_argument("--out", type=Path, default=Path("ml/data/samples"))
    args = parser.parse_args()

    all_paths = list_files()
    if not all_paths:
        raise SystemExit("No images returned by the dataset tree API")

    saved = 0
    for breed_dir in SAMPLE_DIRS:
        # Prefer *_orig.jpg — unaugmented source photos are the honest POC input.
        candidates = [p for p in all_paths if f"/{breed_dir}/" in p and "_orig" in p]
        if len(candidates) < args.per_breed:
            candidates += [p for p in all_paths if f"/{breed_dir}/" in p and p not in candidates]
        if not candidates:
            print(f"  !! no images found for {breed_dir}")
            continue

        dest_dir = args.out / breed_dir
        dest_dir.mkdir(parents=True, exist_ok=True)
        for path in sorted(candidates)[: args.per_breed]:
            dest = dest_dir / Path(path).name
            if dest.exists():
                saved += 1
                continue
            req = urllib.request.Request(RESOLVE + urllib.parse.quote(path),
                                         headers={"User-Agent": "cattleman-poc"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                dest.write_bytes(resp.read())
            saved += 1
            print(f"  {dest}")

    print(f"\n{saved} sample images under {args.out}")


if __name__ == "__main__":
    main()
