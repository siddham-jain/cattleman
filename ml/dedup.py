"""Group near-duplicate photos using pretrained CNN embeddings.

Replaces the perceptual-hash approach in ml/imagehash.py, which failed silently.
dHash measures coarse layout, so on this data a same-breed pair sat at median
Hamming distance 17 and a different-breed pair at 18 — no threshold separates
them. Splits built on it looked clean while train and val still held variants of
the same photograph, and a model trained on them scored a meaningless 100%.

ImageNet embeddings separate cleanly: same-photo variants sit above cosine 0.95
while genuinely different photos of one breed sit near 0.80.

Grouping uses connected components so the result does not depend on iteration
order — see the note in ml/imagehash.py for why greedy assignment is unsound for
a non-transitive relation.
"""
from pathlib import Path

import torch
from PIL import Image
from torchvision.models import MobileNet_V3_Large_Weights, mobilenet_v3_large

# Same-photo variants sit well above this; different photos of one breed sit near
# 0.80. Verified against both candidate datasets before adoption.
DUPLICATE_THRESHOLD = 0.95

_WEIGHTS = MobileNet_V3_Large_Weights.IMAGENET1K_V1
_model = None


def _embedder(device: torch.device):
    """Load the backbone once; its classifier head is dropped for embeddings."""
    global _model
    if _model is None:
        net = mobilenet_v3_large(weights=_WEIGHTS)
        net.classifier = torch.nn.Identity()
        _model = net.eval()
    return _model.to(device)


def pick_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def embed_paths(paths, device: torch.device | None = None, batch_size: int = 32):
    """Return L2-normalised embeddings, so a dot product is cosine similarity."""
    device = device or pick_device()
    net = _embedder(device)
    transform = _WEIGHTS.transforms()

    chunks = []
    with torch.inference_mode():
        for start in range(0, len(paths), batch_size):
            batch = torch.stack([
                transform(Image.open(p).convert("RGB")) for p in paths[start:start + batch_size]
            ]).to(device)
            chunks.append(torch.nn.functional.normalize(net(batch), dim=1).cpu())
    return torch.cat(chunks) if chunks else torch.empty(0)


def cluster_paths(paths, threshold: float = DUPLICATE_THRESHOLD,
                  device: torch.device | None = None):
    """Group paths into near-duplicate clusters via connected components."""
    paths = list(paths)
    if not paths:
        return []

    embeddings = embed_paths(paths, device)
    similarity = embeddings @ embeddings.T

    parent = list(range(len(paths)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    pairs = (similarity >= threshold).nonzero()
    for i, j in pairs.tolist():
        if i < j:
            ri, rj = find(i), find(j)
            if ri != rj:
                parent[ri] = rj

    groups = {}
    for index, path in enumerate(paths):
        groups.setdefault(find(index), []).append(path)
    return list(groups.values())


def nearest_cross_split(query_paths, reference_paths, device: torch.device | None = None):
    """Max cosine similarity from each query image to any reference image.

    Used to verify a finished split: if val images sit above the duplicate
    threshold from some training image, the split leaks regardless of how it was
    constructed.
    """
    if not query_paths or not reference_paths:
        return torch.empty(0)
    device = device or pick_device()
    q = embed_paths(list(query_paths), device)
    r = embed_paths(list(reference_paths), device)
    return (q @ r.T).max(dim=1).values
