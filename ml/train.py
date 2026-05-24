"""Fine-tune a breed classifier on the rebuilt splits.

Two stages: train the new head with the backbone frozen, then unfreeze and
fine-tune everything at a low learning rate. Selection is on validation accuracy;
the test split is never read here — ml/evaluate.py touches it once, at the end.

Usage:  python ml/train.py --epochs-head 8 --epochs-finetune 22
"""
import argparse
import json
import time
from pathlib import Path

import torch
from torch import nn

from breeds import TARGET_BREEDS
from data import build_dataloaders
from model import ARCHITECTURES, build_model, pick_device, set_backbone_trainable


def run_epoch(model, loader, device, criterion, optimizer=None):
    training = optimizer is not None
    model.train(training)

    total_loss = correct = seen = 0
    with torch.set_grad_enabled(training):
        for images, targets in loader:
            images, targets = images.to(device), targets.to(device)
            outputs = model(images)
            loss = criterion(outputs, targets)

            if training:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            total_loss += loss.item() * targets.size(0)
            correct += (outputs.argmax(1) == targets).sum().item()
            seen += targets.size(0)

    return total_loss / seen, correct / seen


def train_stage(model, loaders, device, criterion, optimizer, scheduler, epochs,
                stage, history, best):
    for epoch in range(1, epochs + 1):
        started = time.time()
        train_loss, train_acc = run_epoch(model, loaders["train"], device, criterion, optimizer)
        val_loss, val_acc = run_epoch(model, loaders["val"], device, criterion)
        if scheduler is not None:
            scheduler.step()

        improved = val_acc > best["val_acc"]
        if improved:
            best.update(val_acc=val_acc, val_loss=val_loss, stage=stage, epoch=epoch,
                        state={k: v.detach().cpu().clone() for k, v in model.state_dict().items()})

        history.append({"stage": stage, "epoch": epoch, "train_loss": train_loss,
                        "train_acc": train_acc, "val_loss": val_loss, "val_acc": val_acc})
        print(f"  [{stage}] epoch {epoch:>2}/{epochs}  "
              f"train {train_loss:.3f}/{train_acc:.3f}  "
              f"val {val_loss:.3f}/{val_acc:.3f}  "
              f"{time.time() - started:.1f}s{'  *' if improved else ''}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--arch", default="mobilenet_v3_large", choices=ARCHITECTURES)
    parser.add_argument("--splits", type=Path, default=Path("ml/data/splits"))
    parser.add_argument("--out", type=Path, default=Path("ml/models"))
    parser.add_argument("--epochs-head", type=int, default=8)
    parser.add_argument("--epochs-finetune", type=int, default=22)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr-head", type=float, default=1e-3)
    parser.add_argument("--lr-finetune", type=float, default=1e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--label-smoothing", type=float, default=0.1)
    parser.add_argument("--img-size", type=int, default=224)
    parser.add_argument("--num-workers", type=int, default=2)
    parser.add_argument("--strong-aug", action="store_true",
                        help="RandAugment instead of plain rotation")
    parser.add_argument("--erasing", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default=None)
    parser.add_argument("--tag", default=None, help="suffix for the checkpoint filename")
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    device = pick_device(args.device)

    loaders, datasets = build_dataloaders(args.splits, args.batch_size, args.img_size,
                                          args.num_workers, strong_aug=args.strong_aug,
                                          erasing=args.erasing)
    print(f"arch={args.arch}  device={device}  classes={len(TARGET_BREEDS)}")
    print(f"train={len(datasets['train'])}  val={len(datasets['val'])}  "
          f"test={len(datasets['test'])} (held out)\n")

    model, head_prefixes = build_model(args.arch)
    model.to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=args.label_smoothing)
    history, best = [], {"val_acc": -1.0, "state": None}

    # Stage 1 — head only.
    set_backbone_trainable(model, head_prefixes, False)
    head_params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(head_params, lr=args.lr_head, weight_decay=args.weight_decay)
    train_stage(model, loaders, device, criterion, optimizer, None,
                args.epochs_head, "head", history, best)

    # Stage 2 — whole network, low LR, cosine decay.
    set_backbone_trainable(model, head_prefixes, True)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr_finetune,
                                  weight_decay=args.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs_finetune)
    train_stage(model, loaders, device, criterion, optimizer, scheduler,
                args.epochs_finetune, "finetune", history, best)

    args.out.mkdir(parents=True, exist_ok=True)
    name = args.tag or args.arch
    checkpoint = args.out / f"{name}.pt"
    torch.save({
        "state_dict": best["state"],
        "arch": args.arch,
        "classes": list(TARGET_BREEDS),
        "img_size": args.img_size,
        "val_acc": best["val_acc"],
        "args": vars(args) | {"splits": str(args.splits), "out": str(args.out)},
    }, checkpoint)
    (args.out / f"{name}_history.json").write_text(json.dumps(
        {"best": {k: v for k, v in best.items() if k != "state"}, "history": history}, indent=2))

    print(f"\nbest val acc {best['val_acc']:.4f} "
          f"(stage={best['stage']} epoch={best['epoch']}) -> {checkpoint}")


if __name__ == "__main__":
    main()
