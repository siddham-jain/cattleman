# ADR 0001 — Train a custom classifier instead of using pretrained models directly

- **Status:** Accepted
- **Date:** 5 May 2026
- **Supersedes:** the "pretrained inference" assumption in the original architecture plan

## Context

The original plan assumed a pretrained vision model could be pointed at a cattle
photo and return a breed. The POC (see `ml/reports/poc_findings.md`) disproved
this. Across 24 photos spanning our 12 target breeds:

- `resnet50` produced 5 distinct top-1 labels; 8 of 12 breeds collapsed onto one label
- `mobilenet_v3_large` produced 7; the dominant label was `ox` for 15 of 24 images

ImageNet contains no Indian breed classes. Its nearest labels are `ox`,
`water buffalo`, and `oxcart` — the last being a vehicle class. Breed, the thing
the product exists to determine, is precisely what these models cannot express.

The backbones are not useless. They cleanly separate buffalo from cattle, which
tells us the convolutional features encode real livestock morphology. The
deficiency is in the classifier head and its label space, not the representation.

## Decision

Keep an ImageNet-pretrained backbone as a frozen-then-fine-tuned feature
extractor, replace its 1000-way head with a 12-way head over `TARGET_BREEDS`, and
train on a labelled Indian breed dataset.

This is transfer learning rather than training from scratch. We do not have the
tens of thousands of images that training from scratch would need, and the POC
established that the pretrained features are a sound starting point.

## Consequences

**Costs we accept:**

- We now need a labelled dataset of Indian breeds, which does not exist in any
  standard vision benchmark. Sourcing it becomes the next phase and is the main
  schedule risk.
- Dataset quality becomes our accuracy ceiling. Small per-class counts mean
  augmentation and honest validation discipline matter more than model choice.
- We own a training pipeline: reproducible splits, evaluation, and a retraining
  path when the breed list changes.

**What we gain:**

- A model whose output space is our actual product vocabulary, so the API can
  return breed metadata directly rather than mapping generic labels.
- A small model we can fine-tune on a laptop GPU in minutes, keeping iteration
  fast for a project of this size.
- A clean route to on-device inference: a fine-tuned MobileNet-class network
  exports to ONNX and runs on a phone, which the offline field-use requirement
  depends on.

**Rejected alternatives:**

- *Zero-shot CLIP with breed-name text prompts.* Attractive because it needs no
  training, but breed names are not descriptive English; CLIP has no more notion
  of "Kankrej" than ImageNet does, and the same coat-colour confusion applies.
- *Training from scratch.* No dataset of sufficient size exists, and the POC
  showed pretrained features already capture the relevant morphology.
