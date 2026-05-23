"""Canonical breed list for the Cattleman recogniser.

The twelve breeds here mirror BREED_CATALOG in backend/server.py so the model's
class indices and the API's breed metadata never drift apart.

Sahiwal and Tharparkar were in the original catalogue but are not trainable from
available data — the source dataset has no Sahiwal images at all and only 15 of
Tharparkar. Both are significant dairy breeds and should return once field data
collection provides enough examples; Rathi and Khillari take their slots for now.
See ml/reports/dataset_audit.md.
"""

# Ordered — index position IS the model's class index. Never reorder without
# retraining and re-exporting the ONNX model.
TARGET_BREEDS = [
    "Gir",
    "Rathi",
    "Red Sindhi",
    "Khillari",
    "Kankrej",
    "Ongole",
    "Hariana",
    "Murrah",
    "Jaffarabadi",
    "Surti",
    "Mehsana",
    "Nili-Ravi",
]

CATTLE_BREEDS = set(TARGET_BREEDS[:7])
BUFFALO_BREEDS = set(TARGET_BREEDS[7:])

# Breeds dropped for lack of data, kept explicit so the gap is visible in code
# rather than only in a report.
DEFERRED_BREEDS = {
    "Sahiwal": "no images in the source dataset",
    "Tharparkar": "only 15 images available",
}


def animal_type(breed: str) -> str:
    if breed in BUFFALO_BREEDS:
        return "buffalo"
    if breed in CATTLE_BREEDS:
        return "cattle"
    raise KeyError(f"Unknown breed: {breed}")


def class_index(breed: str) -> int:
    return TARGET_BREEDS.index(breed)
