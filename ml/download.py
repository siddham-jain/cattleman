"""Download the 12 target breeds from the source dataset into ml/data/raw/.

Images land in ml/data/raw/<Breed>/ with their original filenames preserved. The
filename encodes the upstream split (e.g. Cattle_Gir_test_002_orig.jpg), which
ml/audit.py needs in order to measure leakage in the published splits. We do not
reuse those splits — ml/splits.py builds our own.

Usage:  python ml/download.py
"""
import argparse
import json
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from breeds import TARGET_BREEDS

DATASET = "SynthAIzer/indian-cattle-buffalo-breeds"
RESOLVE = f"https://huggingface.co/datasets/{DATASET}/resolve/main/"
TREE = f"https://huggingface.co/api/datasets/{DATASET}/tree/main?recursive=true"

# Our breed names -> upstream class directory names.
SOURCE_DIRS = {
    "Gir": "Cattle_Gir",
    "Sahiwal": "Cattle_Sahiwal",
    "Red Sindhi": "Cattle_Red_Sindhi",
    "Tharparkar": "Cattle_Tharparkar",
    "Kankrej": "Cattle_Kankrej",
    "Ongole": "Cattle_Ongole",
    "Hariana": "Cattle_Hariana",
    "Murrah": "Buffalo_MURRAH",
    "Jaffarabadi": "Buffalo_JAFFARABADI",
    "Surti": "Buffalo_SURTI",
    "Mehsana": "Buffalo_MEHSANA",
    "Nili-Ravi": "Buffalo_NILI_RAVI",
}


def list_remote_images():
    url, paths = TREE, []
    while url:
        req = urllib.request.Request(url, headers={"User-Agent": "cattleman"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            paths += [e["path"] for e in json.load(resp)
                      if e["type"] == "file"
                      and e["path"].lower().endswith((".jpg", ".jpeg", ".png"))]
            link = resp.headers.get("Link", "")
        match = re.search(r'<([^>]+)>;\s*rel="next"', link)
        url = match.group(1) if match else None
    return paths


def download_one(remote_path: Path, dest: Path):
    if dest.exists() and dest.stat().st_size > 0:
        return False
    req = urllib.request.Request(RESOLVE + urllib.parse.quote(str(remote_path)),
                                 headers={"User-Agent": "cattleman"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        dest.write_bytes(resp.read())
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path("ml/data/raw"))
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    remote = list_remote_images()
    if not remote:
        raise SystemExit("Dataset tree API returned no images")

    missing = [b for b in TARGET_BREEDS if b not in SOURCE_DIRS]
    if missing:
        raise SystemExit(f"No source directory mapped for: {missing}")

    jobs, total = [], 0
    for breed in TARGET_BREEDS:
        src = SOURCE_DIRS[breed]
        paths = [p for p in remote if f"/{src}/" in p]
        if not paths:
            raise SystemExit(f"Upstream directory {src} contained no images")
        dest_dir = args.out / breed
        dest_dir.mkdir(parents=True, exist_ok=True)
        for p in paths:
            jobs.append((p, dest_dir / Path(p).name))
        total += len(paths)
        print(f"  {breed:<14} {len(paths):>4} images")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        fetched = sum(pool.map(lambda j: download_one(Path(j[0]), j[1]), jobs))

    print(f"\n{total} images across {len(TARGET_BREEDS)} breeds "
          f"({fetched} newly downloaded) -> {args.out}")


if __name__ == "__main__":
    main()
