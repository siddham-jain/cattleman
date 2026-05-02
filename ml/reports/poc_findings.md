# POC — Are ImageNet-pretrained models enough?

**Date:** 2 May 2026
**Question:** Can an off-the-shelf ImageNet classifier identify Indian cattle and
buffalo breeds without any training of our own?
**Answer:** No. Not even close.

## Setup

- 24 photos, 2 each across our 12 target breeds (7 cattle, 5 buffalo)
- Backbones: `resnet50` (IMAGENET1K_V2), `mobilenet_v3_large` (IMAGENET1K_V1)
- Reproduce with `python ml/fetch_samples.py && python ml/poc_baseline.py`

## Results

| Backbone | Distinct top-1 labels (24 imgs) | Breeds collapsing to one label |
| --- | --- | --- |
| resnet50 | 5 | 8 / 12 |
| mobilenet_v3_large | 7 | 3 / 12 |

Top-1 label frequency, resnet50:

```
water buffalo 9, ox 8, oxcart 5, gazelle 1, sorrel 1
```

Top-1 label frequency, mobilenet_v3_large:

```
ox 15, water buffalo 3, oxcart 2, hippopotamus 1,
Mexican hairless 1, sorrel 1, tusker 1
```

## What this means

ImageNet's 1000 classes contain no Indian breed. The closest are the generic
`ox`, `water buffalo`, and `oxcart` — and `oxcart` is a *vehicle* class that fires
purely because working cattle are often photographed in harness. Every one of our
twelve breeds lands in that same tiny bucket.

The models do carry some real signal: they reliably separate buffalo from cattle
(buffalo photos skew to `water buffalo`, cattle to `ox`/`oxcart`), which confirms
the backbones see the animal rather than the background. But breed is exactly the
distinction they cannot make, and breed is the entire product.

Two failure modes worth noting:

- **Confident and wrong.** `mobilenet_v3_large` called a Jaffarabadi buffalo
  `hippopotamus` at 0.85 and a Tharparkar cow `tusker` at 0.45. High confidence
  carries no reliability here, so we cannot threshold our way out of the problem.
- **Coat colour dominates.** Red Sindhi and Sahiwal — both reddish — pull `sorrel`
  and `Arabian camel`. The features being used are colour and silhouette, not the
  hump, dewlap, and horn geometry that actually define a breed.

## Decision

Zero-shot pretrained classification is not viable. We keep the pretrained
backbones but replace the classifier head and fine-tune on a labelled Indian
breed dataset — transfer learning rather than off-the-shelf inference.

The POC is not wasted: it establishes that the backbones extract usable
livestock features, which is what makes transfer learning a sound bet on a small
dataset. Next step is sourcing that dataset.
