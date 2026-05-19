"""Model construction for breed classification.

MobileNetV3-Large is the default because this model has to run on a mid-range
Android phone via ONNX Runtime. ResNet50 is kept selectable so the accuracy cost
of that choice can be measured rather than assumed.
"""
import torch
from torch import nn
from torchvision.models import (
    MobileNet_V3_Large_Weights, ResNet50_Weights,
    mobilenet_v3_large, resnet50,
)

from breeds import TARGET_BREEDS

ARCHITECTURES = ("mobilenet_v3_large", "resnet50")


def pick_device(prefer: str | None = None) -> torch.device:
    if prefer:
        return torch.device(prefer)
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def build_model(arch: str = "mobilenet_v3_large", pretrained: bool = True,
                dropout: float = 0.2, num_classes: int = len(TARGET_BREEDS)):
    """Build a backbone with its ImageNet head replaced by a num_classes head."""
    if arch == "mobilenet_v3_large":
        weights = MobileNet_V3_Large_Weights.IMAGENET1K_V1 if pretrained else None
        model = mobilenet_v3_large(weights=weights)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_classes)
        head_prefixes = ("classifier.",)
    elif arch == "resnet50":
        weights = ResNet50_Weights.IMAGENET1K_V2 if pretrained else None
        model = resnet50(weights=weights)
        model.fc = nn.Sequential(nn.Dropout(dropout), nn.Linear(model.fc.in_features, num_classes))
        head_prefixes = ("fc.",)
    else:
        raise ValueError(f"Unknown architecture {arch!r}; expected one of {ARCHITECTURES}")

    return model, head_prefixes


def set_backbone_trainable(model, head_prefixes, trainable: bool):
    """Freeze or unfreeze everything outside the classifier head.

    Stage one trains only the head: the randomly initialised head would otherwise
    push large, noisy gradients through pretrained features and destroy them.
    Stage two unfreezes at a much lower learning rate.
    """
    for name, param in model.named_parameters():
        if not name.startswith(head_prefixes):
            param.requires_grad = trainable
