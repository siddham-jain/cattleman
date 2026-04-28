"""Canonical breed list for the Cattleman recogniser.

The twelve breeds here mirror BREED_CATALOG in backend/server.py so the model's
class indices and the API's breed metadata never drift apart.
"""

# Ordered — index position IS the model's class index. Never reorder without
# retraining and re-exporting the ONNX model.
TARGET_BREEDS = [
    "Gir",
    "Sahiwal",
    "Red Sindhi",
    "Tharparkar",
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


def animal_type(breed: str) -> str:
    if breed in BUFFALO_BREEDS:
        return "buffalo"
    if breed in CATTLE_BREEDS:
        return "cattle"
    raise KeyError(f"Unknown breed: {breed}")


def class_index(breed: str) -> int:
    return TARGET_BREEDS.index(breed)
