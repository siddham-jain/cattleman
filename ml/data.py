"""Datasets, transforms, and loaders for breed classification.

Reads the leakage-free splits produced by ml/splits.py. Class order is pinned to
breeds.TARGET_BREEDS rather than ImageFolder's alphabetical default, so a model's
output index means the same breed everywhere — training, evaluation, the ONNX
export, and the API.
"""
from pathlib import Path

import torch
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import transforms
from torchvision.datasets import ImageFolder

from breeds import TARGET_BREEDS

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
DEFAULT_IMG_SIZE = 224


def build_transforms(img_size: int = DEFAULT_IMG_SIZE, strong: bool = False,
                     erasing: float = 0.0):
    """Train-time augmentation and deterministic eval preprocessing.

    Augmenting at load time gives the model a different view each epoch, which
    matters with roughly 75 training images per breed.

    Colour distortion stays mild even in the strong setting: breed cues are coat
    colour and horn geometry, and aggressive hue shifts erase exactly the signal
    that separates Red Sindhi from Rathi. No vertical flip — cattle are not
    upside down in the field.

    `strong` adds RandAugment and random erasing. Baseline training drove train
    accuracy to 1.000 while validation stalled near 0.62, so the extra
    regularisation targets that gap rather than the underlying fit.
    """
    train_steps = [
        transforms.RandomResizedCrop(img_size, scale=(0.6, 1.0), ratio=(0.75, 1.33)),
        transforms.RandomHorizontalFlip(),
    ]
    if strong:
        # magnitude 7 of 30: enough to regularise without destroying coat colour
        train_steps.append(transforms.RandAugment(num_ops=2, magnitude=7))
    else:
        train_steps.append(transforms.RandomRotation(12))
    train_steps += [
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.15, hue=0.02),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]
    if erasing > 0:
        train_steps.append(transforms.RandomErasing(p=erasing, scale=(0.02, 0.15)))
    train = transforms.Compose(train_steps)
    evaluate = transforms.Compose([
        transforms.Resize(int(img_size * 1.14)),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    return train, evaluate


def _ordered_dataset(root: Path, transform):
    dataset = ImageFolder(root, transform=transform)
    missing = [b for b in TARGET_BREEDS if b not in dataset.class_to_idx]
    if missing:
        raise RuntimeError(f"{root} is missing breeds: {missing}")

    # Remap ImageFolder's alphabetical indices onto TARGET_BREEDS order.
    remap = {dataset.class_to_idx[b]: i for i, b in enumerate(TARGET_BREEDS)}
    dataset.samples = [(p, remap[i]) for p, i in dataset.samples]
    dataset.targets = [t for _, t in dataset.samples]
    dataset.classes = list(TARGET_BREEDS)
    dataset.class_to_idx = {b: i for i, b in enumerate(TARGET_BREEDS)}
    return dataset


def _balanced_sampler(dataset):
    """Oversample rare breeds so each class contributes equally per epoch.

    Mehsana ships with half the images of every other breed; without this the
    model sees it half as often and reliably under-predicts it.
    """
    counts = torch.bincount(torch.tensor(dataset.targets), minlength=len(TARGET_BREEDS))
    weights = [1.0 / counts[t].item() for t in dataset.targets]
    return WeightedRandomSampler(weights, num_samples=len(dataset), replacement=True)


def build_dataloaders(root: Path = Path("ml/data/splits"), batch_size: int = 32,
                      img_size: int = DEFAULT_IMG_SIZE, num_workers: int = 4,
                      balanced: bool = True, strong_aug: bool = False,
                      erasing: float = 0.0):
    train_tf, eval_tf = build_transforms(img_size, strong_aug, erasing)
    datasets = {
        "train": _ordered_dataset(root / "train", train_tf),
        "val": _ordered_dataset(root / "val", eval_tf),
        "test": _ordered_dataset(root / "test", eval_tf),
    }

    sampler = _balanced_sampler(datasets["train"]) if balanced else None
    loaders = {
        "train": DataLoader(datasets["train"], batch_size=batch_size, sampler=sampler,
                            shuffle=sampler is None, num_workers=num_workers,
                            drop_last=False),
        "val": DataLoader(datasets["val"], batch_size=batch_size, shuffle=False,
                          num_workers=num_workers),
        "test": DataLoader(datasets["test"], batch_size=batch_size, shuffle=False,
                           num_workers=num_workers),
    }
    return loaders, datasets
