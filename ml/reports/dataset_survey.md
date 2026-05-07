# Dataset survey — labelled Indian cattle & buffalo breeds

**Date:** 7 May 2026
**Goal:** find a labelled image dataset covering the 12 breeds in `ml/breeds.py`.

## Selection criteria

1. **Real image data**, not a manifest of file paths
2. **Breed-level labels** covering our 12 target breeds
3. Enough images per class to fine-tune (target: 30+ per class for training)
4. Permissive enough to use in an academic project
5. Directory layout compatible with `torchvision.datasets.ImageFolder`

## Candidates evaluated

### `Priya012005/indian_bovine_breeds` — rejected

Looks ideal on paper: 5,926 rows, 41 Indian breed classes including all twelve of
ours. Inspecting the actual schema killed it:

```
features: image -> {"dtype": "string"}    # not an Image type
row 0:    "C:\\Users\\HP\\Downloads\\archive (2)\\Indian_bovine_breeds\\Alambadi\\Alambadi_1.png"
```

The `image` column is a **string of Windows local file paths**, not image data.
The uploader published a CSV manifest of files that exist only on their machine.
The repository contains no pixels at all. Unusable.

Worth recording as a caution: dataset row counts and class lists can look
perfect while the payload is absent. Always inspect the feature *types*.

### `Ri25shav/Cattle_Breed` — rejected

Dataset viewer returns HTTP 500; schema could not be inspected. Not worth
depending on an unreadable source.

### `SynthAIzer/indian-cattle-buffalo-breeds` — selected

- **3,172 images, 67 classes**, prefixed `Cattle_` / `Buffalo_`
- Real image data (`_type: Image`), ~900×700 typical, all distinct resolutions
- Pre-split `train/` 2,196 · `val/` 421 · `test/` 555, ImageFolder layout
- Ships `metadata.csv` with breed descriptions, region, coat colour, horn shape
- Derived from the Dairy Knowledge Portal breed reference
- **Covers all 12 of our target breeds**

Per-class inspection of three breeds (Murrah, Gir, Sahiwal) found ~52 images each
resolving to **38–43 perceptually distinct source photos** — this is a genuine
collection of varied photographs with augmented copies layered on, not two or
three images duplicated twenty times.

## Known defect: augmentation leakage across splits

Every filename carries an `_augNN` suffix, including files in `test/`. The
maintainer appears to have **augmented first and split second**.

A filename-based leakage check is worthless here because the split name is baked
into each filename (`Buffalo_MURRAH_test_000_aug17.jpg`), so IDs can never
collide across splits by construction. Hashing pixels instead, with a dHash
Hamming distance ≤ 10 treated as a near-duplicate:

| Breed | dHash clusters | Clusters spanning >1 split |
| --- | --- | --- |
| Buffalo_MURRAH | 38 | 6 |
| Cattle_Gir | 43 | 5 |
| Cattle_Sahiwal | 41 | 3 |

Roughly **10–15% of test images have a near-duplicate in train**. Reported test
accuracy on the shipped splits would be inflated by an unknown margin.

## Decision

Adopt `SynthAIzer/indian-cattle-buffalo-breeds`, restricted to our 12 breeds, and
**discard the published splits**. We will regroup images by perceptual hash and
re-split so that all augmentations of a source photo live in exactly one split.

The dataset is good; its splits are not. Fixing this is the first task of the
preprocessing phase, and skipping it would make every accuracy number we report
meaningless.
