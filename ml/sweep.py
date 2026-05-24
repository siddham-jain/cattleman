"""Run a small set of training configurations and compare them on validation.

Baseline training reached 1.000 train accuracy against ~0.63 validation, so the
configurations here vary regularisation strength and backbone rather than
learning rate. Each run writes its own checkpoint and history under ml/models/.

Selection is on validation only. The test split stays untouched until a single
configuration has been chosen.

Usage:  python ml/sweep.py
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

CONFIGS = [
    ("baseline", []),
    ("strong-aug", ["--strong-aug", "--weight-decay", "5e-4"]),
    ("strong-aug-erase", ["--strong-aug", "--weight-decay", "5e-4",
                          "--erasing", "0.25", "--epochs-finetune", "28"]),
    ("resnet50", ["--arch", "resnet50", "--strong-aug", "--weight-decay", "5e-4"]),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", type=Path, default=Path("ml/models"))
    parser.add_argument("--only", nargs="*", help="run only these config names")
    args = parser.parse_args()

    results = []
    for name, extra in CONFIGS:
        if args.only and name not in args.only:
            continue
        print(f"\n{'=' * 70}\n=== {name}: {' '.join(extra) or '(defaults)'}\n{'=' * 70}", flush=True)
        completed = subprocess.run(
            [sys.executable, "ml/train.py", "--tag", name, *extra],
            check=False,
        )
        if completed.returncode != 0:
            print(f"  {name} FAILED (exit {completed.returncode})")
            continue

        history_path = args.models / f"{name}_history.json"
        best = json.loads(history_path.read_text())["best"]
        results.append({"name": name, "args": extra, **{
            k: best[k] for k in ("val_acc", "stage", "epoch") if k in best}})

    print(f"\n{'=' * 70}\n=== sweep summary (validation)\n{'=' * 70}")
    for row in sorted(results, key=lambda r: -r["val_acc"]):
        print(f"  {row['name']:<20} val_acc={row['val_acc']:.4f}  "
              f"({row.get('stage')} epoch {row.get('epoch')})")

    if results:
        winner = max(results, key=lambda r: r["val_acc"])
        print(f"\n  best: {winner['name']} at {winner['val_acc']:.4f}")
        (args.models / "sweep_results.json").write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
