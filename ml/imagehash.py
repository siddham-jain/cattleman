"""Perceptual hashing used to group augmented copies of the same source photo.

Shared by ml/audit.py (measuring leakage) and ml/splits.py (preventing it). Both
must group images identically or the splits would not match what the audit
reports, so the logic lives here rather than being duplicated.
"""
from pathlib import Path

import numpy as np
from PIL import Image

# Hamming distance at or below this counts as "same source photo". Chosen from
# the survey: augmented copies of one photo sit well under 10, genuinely
# different photos of the same breed sit well above it.
DUPLICATE_THRESHOLD = 10


def dhash(image: Image.Image, size: int = 8) -> np.ndarray:
    """Difference hash — robust to the rescale/recompress an augmentation applies."""
    grey = image.convert("L").resize((size + 1, size), Image.LANCZOS)
    pixels = np.asarray(grey, dtype=np.int16)
    return np.packbits((pixels[:, 1:] > pixels[:, :-1]).flatten())


def hash_file(path: Path) -> np.ndarray:
    with Image.open(path) as img:
        return dhash(img)


def hamming(a: np.ndarray, b: np.ndarray) -> int:
    return int(np.unpackbits(a ^ b).sum())


def cluster(items, threshold: int = DUPLICATE_THRESHOLD):
    """Group (key, hash) pairs into near-duplicate clusters.

    Uses connected components over the "within threshold" relation rather than
    greedy single-pass assignment. Greedy grouping depends on input order —
    near-duplicate is not transitive, so A~B and B~C does not imply A~C — which
    made the audit and the splitter disagree about borderline pairs and left a
    handful of source photos spanning splits.

    Chaining merges A and C when both match B. That errs towards over-merging,
    which is the safe direction: a too-large group costs a little split balance,
    while a too-small one puts a photo's variants on both sides of the split.
    """
    items = list(items)
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if hamming(items[i][1], items[j][1]) <= threshold:
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[ri] = rj

    groups = {}
    for idx, item in enumerate(items):
        groups.setdefault(find(idx), []).append(item)
    return list(groups.values())
