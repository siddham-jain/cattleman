"""Real breed inference from the exported ONNX model.

Preprocessing mirrors the eval transform in ml/data.py exactly — resize the short
side to 1.14x, centre crop, scale to [0,1], normalise with ImageNet statistics.
A mismatch here does not raise; it quietly degrades every prediction, so the
constants are read from the model's metadata JSON rather than duplicated.

The model file is a build artefact and is not in version control. When it is
absent the API says so plainly instead of falling back to a placeholder, because
a server that silently returns plausible nonsense is worse than one that is down.
"""
import json
import os
from pathlib import Path
from threading import Lock

import numpy as np
import onnxruntime as ort
from PIL import Image

MODEL_PATH = Path(os.getenv("MODEL_PATH", "ml/models/cattleman.onnx"))

_lock = Lock()
_classifier = None


class ModelUnavailable(RuntimeError):
    pass


class BreedClassifier:
    def __init__(self, model_path: Path):
        metadata_path = model_path.with_suffix(".json")
        if not model_path.exists() or not metadata_path.exists():
            raise ModelUnavailable(
                f"No model at {model_path}. Run: python ml/train.py --strong-aug "
                f"--weight-decay 5e-4 && python ml/export_onnx.py")

        self.metadata = json.loads(metadata_path.read_text())
        self.classes = self.metadata["classes"]
        self.animal_types = self.metadata["animal_type"]
        self.img_size = self.metadata["img_size"]
        self.mean = np.array(self.metadata["normalization"]["mean"], dtype=np.float32)
        self.std = np.array(self.metadata["normalization"]["std"], dtype=np.float32)
        self.session = ort.InferenceSession(str(model_path),
                                            providers=["CPUExecutionProvider"])

    def preprocess(self, image: Image.Image) -> np.ndarray:
        image = image.convert("RGB")
        size = self.img_size
        scale = (size * 1.14) / min(image.size)
        resized = image.resize(
            (max(size, round(image.width * scale)), max(size, round(image.height * scale))),
            Image.BILINEAR,
        )
        left = (resized.width - size) // 2
        top = (resized.height - size) // 2
        cropped = resized.crop((left, top, left + size, top + size))

        array = np.asarray(cropped, dtype=np.float32) / 255.0
        array = (array - self.mean) / self.std
        # HWC -> NCHW
        return np.ascontiguousarray(array.transpose(2, 0, 1)[None], dtype=np.float32)

    def predict(self, image: Image.Image):
        logits = self.session.run(["logits"], {"input": self.preprocess(image)})[0][0]
        exp = np.exp(logits - logits.max())
        probabilities = exp / exp.sum()

        ranked = sorted(
            (
                {
                    "breed": breed,
                    "confidence": round(float(probabilities[index]), 4),
                    "animal_type": self.animal_types[breed],
                }
                for index, breed in enumerate(self.classes)
            ),
            key=lambda item: item["confidence"],
            reverse=True,
        )
        return ranked


def get_classifier() -> BreedClassifier:
    """Load once, lazily. Kept behind a lock so concurrent first requests
    cannot each build their own session."""
    global _classifier
    if _classifier is None:
        with _lock:
            if _classifier is None:
                _classifier = BreedClassifier(MODEL_PATH)
    return _classifier
