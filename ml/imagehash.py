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
    """Greedily group (key, hash) pairs into near-duplicate clusters.

    Greedy single-pass clustering is adequate here because augmented copies form
    tight, well-separated groups; it is O(n * clusters) rather than O(n^2).
    """
    clusters = []
    for key, digest in items:
        for group in clusters:
            if hamming(digest, group[0][1]) <= threshold:
                group.append((key, digest))
                break
        else:
            clusters.append([(key, digest)])
    return clusters
