"""Download the 12 target breeds from the source dataset into ml/data/raw/.

Source is `mr-rxa/Cattle-Buffalo-Datatset` (7,014 images, 68 Indian breed
classes). We previously used `SynthAIzer/indian-cattle-buffalo-breeds`; it was
dropped because its ~52 images per breed proved to be roughly 4 photographs
augmented into 52 files, which cannot support a held-out evaluation. See
ml/reports/dataset_audit.md.

That repository nests breeds under two different top-level collections, and the
sparse "* Breeds" tier holds only 7-15 images per class, so we select by explicit
path rather than by breed name alone.

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

DATASET = "mr-rxa/Cattle-Buffalo-Datatset"
RESOLVE = f"https://huggingface.co/datasets/{DATASET}/resolve/main/"
TREE = f"https://huggingface.co/api/datasets/{DATASET}/tree/main?recursive=true"
IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp")

# Our breed name -> upstream directory name. All of these live in the dense
# "Cattle Images" / "Buffalo Images" collections.
SOURCE_DIRS = {
    "Gir": "Gir",
    "Rathi": "Rathi",
    "Red Sindhi": "Red_Sindhi",
    "Khillari": "Khillari",
    "Kankrej": "Kankrej",
    "Ongole": "Ongole",
    "Hariana": "Hariana",
    "Murrah": "Murrah",
    "Jaffarabadi": "Jaffrabadi",
    "Surti": "Surti",
    "Mehsana": "Mehsana",
    "Nili-Ravi": "Nili_Ravi",
}

# The sparse tier duplicates some breed names with only a handful of images;
# mixing it in would add near-nothing and skew class counts.
ALLOWED_COLLECTIONS = ("Cattle Images", "Buffalo Images")


def list_remote_images():
    url, paths = TREE, []
    while url:
        req = urllib.request.Request(url, headers={"User-Agent": "cattleman"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            paths += [e["path"] for e in json.load(resp)
                      if e["type"] == "file" and e["path"].lower().endswith(IMAGE_SUFFIXES)]
            link = resp.headers.get("Link", "")
        match = re.search(r'<([^>]+)>;\s*rel="next"', link)
        url = match.group(1) if match else None
    return paths


def download_one(remote_path: str, dest: Path):
    if dest.exists() and dest.stat().st_size > 0:
        return False
    req = urllib.request.Request(RESOLVE + urllib.parse.quote(remote_path),
                                 headers={"User-Agent": "cattleman"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        dest.write_bytes(resp.read())
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path("ml/data/raw"))
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()

    remote = list_remote_images()
    if not remote:
        raise SystemExit("Dataset tree API returned no images")

    jobs, total = [], 0
    for breed in TARGET_BREEDS:
        source = SOURCE_DIRS[breed]
        paths = [p for p in remote
                 if p.split("/")[-2] == source
                 and any(f"/{c}/" in p for c in ALLOWED_COLLECTIONS)]
        if not paths:
            raise SystemExit(f"No images found upstream for {breed} (dir {source!r})")

        dest_dir = args.out / breed
        dest_dir.mkdir(parents=True, exist_ok=True)
        for path in paths:
            jobs.append((path, dest_dir / Path(path).name))
        total += len(paths)
        print(f"  {breed:<14} {len(paths):>4} images")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        fetched = sum(pool.map(lambda job: download_one(job[0], job[1]), jobs))

    print(f"\n{total} images across {len(TARGET_BREEDS)} breeds "
          f"({fetched} newly downloaded) -> {args.out}")


if __name__ == "__main__":
    main()
