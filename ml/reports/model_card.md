# Model card — Cattleman breed classifier

**Date:** 31 May 2026
**Task:** classify a photograph into one of 12 Indian cattle and buffalo breeds
**Shipping model:** MobileNetV3-Large, ImageNet-pretrained, fine-tuned
**Artefact:** `ml/models/cattleman.onnx` (17.2 MB, opset 18)

## Headline numbers

Measured once on the held-out test split, after the configuration was chosen on
validation.

| Metric | Value |
| --- | --- |
| Top-1 accuracy | **0.672** |
| Top-3 accuracy | **0.894** |
| Macro F1 | 0.633 |
| Test images | 198 |

**Read top-1 as 67% ± 7.** With 198 test images the 95% confidence interval is
roughly ±6.5 points, so anything between about 61% and 74% is consistent with
this measurement. Differences of two or three points between configurations are
not real.

## The baseline that matters

A nearest-neighbour lookup over **raw, untrained** ImageNet embeddings scores
**0.540** on the same test split. That is the number to beat, not zero, and not
1/12. Fine-tuning is worth **+13 points** over doing nothing.

This baseline is reported because it is what caught a serious earlier error: an
initial model scored 100% validation accuracy, and the 1-NN probe scored 100%
too, which showed the split — not the model — was doing the work.

## Model selection

Four configurations, selected on validation, evaluated once on test.

| Config | Val top-1 | Test top-1 | Test top-3 | Size |
| --- | --- | --- | --- | --- |
| **mobilenet_v3_large, strong aug** | 0.652 | **0.672** | 0.894 | **17.2 MB** |
| resnet50, strong aug | **0.702** | 0.662 | **0.914** | 94.3 MB |
| mobilenet_v3_large, baseline aug | 0.636 | — | — | 17.2 MB |
| mobilenet_v3_large, strong aug + erasing | 0.626 | — | — | 17.2 MB |

ResNet50 led validation by 5 points and then **lost** on test by 1. That gap was
never real — it was within the noise of a 198-image validation set, and it is a
concrete reminder that a leaderboard built on small splits ranks partly by luck.

MobileNetV3 ships because the two are statistically indistinguishable on test
while ResNet50 is **5.5× larger** and slower on a phone. Random erasing hurt and
was dropped; coat colour and body outline are the signal here, and occluding
patches of the animal removes it.

## Per-class results

| Breed | Support | Precision | Recall | F1 |
| --- | --- | --- | --- | --- |
| Ongole | 28 | 0.742 | 0.821 | 0.780 |
| Jaffarabadi | 15 | 0.786 | 0.733 | 0.759 |
| Rathi | 22 | 0.833 | 0.682 | 0.750 |
| Kankrej | 24 | 0.762 | 0.667 | 0.711 |
| Murrah | 24 | 0.630 | 0.708 | 0.667 |
| Hariana | 18 | 0.632 | 0.667 | 0.649 |
| Khillari | 17 | 0.714 | 0.588 | 0.645 |
| Red Sindhi | 13 | 0.500 | 0.769 | 0.606 |
| Nili-Ravi | 13 | 0.529 | 0.692 | 0.600 |
| Gir | 6 | 0.600 | 0.500 | 0.545 |
| Mehsana | 11 | 0.625 | 0.455 | 0.526 |
| Surti | 7 | 0.500 | 0.286 | 0.364 |

Surti and Gir have 7 and 6 test images. Their F1 scores are almost meaningless as
point estimates — one image moving changes them by 10+ points.

## What it confuses, and why

| True → Predicted | Count |
| --- | --- |
| Rathi → Red Sindhi | 5 |
| Mehsana → Murrah | 5 |
| Murrah → Nili-Ravi | 4 |
| Khillari → Ongole / Hariana | 3 each |
| Ongole → Khillari | 3 |

The errors are not random, and that is mildly reassuring — the model is confusing
things that genuinely look alike:

- **Rathi / Red Sindhi** — both reddish-brown cattle of similar build.
- **Mehsana / Murrah** — Mehsana *is* a Murrah–Surti derived type. Distinguishing
  them from a photograph is hard for people too.
- **Murrah / Nili-Ravi** — both large black buffalo; the reliable cue is
  Nili-Ravi's white forehead marking and wall eyes, which a side-on photo at
  distance may not show.
- **Khillari / Ongole / Hariana** — all grey-to-white draught cattle.

## Training

- Two stages: head-only with the backbone frozen (8 epochs, lr 1e-3), then full
  fine-tune (22 epochs, lr 1e-4, cosine decay)
- AdamW, weight decay 5e-4, label smoothing 0.1, batch 32, 224×224
- RandAugment (2 ops, magnitude 7) plus mild colour jitter; no vertical flip
- `WeightedRandomSampler` to offset class imbalance (4.8× between largest and
  smallest class)
- Seeded at 42; `python ml/train.py --strong-aug --weight-decay 5e-4` reproduces it

Training accuracy reaches ~1.00 while validation plateaus near 0.65. The model
overfits and stronger regularisation did not close the gap — the binding
constraint is 921 training images, not the training recipe.

## Data

- 1,390 images over 12 breeds from `mr-rxa/Cattle-Buffalo-Datatset`
- 73 images dropped: the same photograph filed under two different breeds, so at
  least one label was wrong
- Split by source photograph via embedding clustering, giving 921 / 198 / 198
- Verified independent: no test image sits within the duplicate threshold of any
  training image

Full detail in `ml/reports/dataset_audit.md`.

## Intended use and limits

Intended as a **decision aid for field workers**, not an authority. The app shows
the ranked shortlist and lets the worker override it, because at 67% top-1 a
single confident-looking answer would be wrong about a third of the time. Top-3
at 89% is the number that reflects how it is actually used.

It should **not** be used for pedigree certification, breed registration disputes,
insurance assessment, or anything where a wrong answer carries financial or legal
weight.

Known limits:

- **Twelve breeds only.** India recognises more than 50. Anything outside the
  twelve is silently forced into one of them — there is no "unknown" class.
- **Sahiwal and Tharparkar are missing**, despite being major dairy breeds, for
  lack of training images.
- **Curated photographs, not field photographs.** Training images are mostly
  well-lit animals in side profile. Phone photos in poor light, at odd angles, or
  with the animal partly occluded will do worse than these numbers suggest.
- **Calves and juveniles are unrepresented**; breed features develop with age.
- Confidence is **not calibrated**. A 0.9 output does not mean 90% correct, and
  the earlier POC showed these backbones can be confidently wrong.

## Improving it

The app records every correction a worker makes to a prediction, exposed at
`GET /api/corrections`. Those are labelled examples of exactly the cases the
model fails on. Feeding them back — along with genuine field photographs — is the
highest-value next step, well ahead of any change of architecture.
