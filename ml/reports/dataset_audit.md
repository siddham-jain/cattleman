# Dataset audit

**Source:** `mr-rxa/Cattle-Buffalo-Datatset`
**Scope:** 1,390 images, 12 breeds
**Reproduce:** `python ml/audit.py` · `python ml/audit.py --root ml/data/splits` · `python ml/leakcheck.py`

This replaces the audit of the original source, which was discarded. That history
is kept below because the failure taught us more than the fix.

## Why the first dataset was abandoned

`SynthAIzer/indian-cattle-buffalo-breeds` offered ~52 images per breed and looked
adequate. It was not. Clustering its images by embedding similarity at cosine
≥ 0.95 collapsed **598 files into 51 groups — roughly four genuine photographs
per breed**, each augmented into ~52 copies.

We did not catch this from the file counts. We caught it because a trained model
reported **100% validation accuracy**, which is not believable with ~35 images per
class. The probe that settled it: a nearest-neighbour lookup over *untrained*
ImageNet embeddings also scored 100%. The split, not the model, was doing the work.

The perceptual-hash audit had certified those splits clean. It was measuring the
wrong thing — dHash encodes coarse layout, so a same-breed pair sat at median
Hamming distance 17 and a different-breed pair at 18. No threshold separates
those. **An audit that reports success while the thing it audits is broken is
worse than no audit**, because it converts an open question into false confidence.

## Current source

| | Value |
| --- | --- |
| Images downloaded | 1,390 |
| Unreadable files | 0 |
| Distinct photographs (cosine ≥ 0.95) | **1,341** |
| Images per source photograph | **1.03** |

1.03 images per source photograph, against roughly 13 for the previous dataset.
These are genuinely different photographs, which is the whole requirement.

The repository stores every image twice under parallel directory trees
(`Dataset/Cattle Images/...` and `Dataset/Cattle Breeds/...`), so the download
selects one collection explicitly. The nominal 7,014 files are ~3,500 real ones.

## Class balance

| Breed | Images | Breed | Images |
| --- | --- | --- | --- |
| Ongole | 191 | Mehsana | 94 |
| Murrah | 173 | Red Sindhi | 90 |
| Kankrej | 163 | Nili-Ravi | 88 |
| Rathi | 149 | Surti | 59 |
| Hariana | 129 | Gir | 40 |
| Khillari | 113 | Jaffarabadi | 101 |

Imbalance ratio 4.78 (Ongole 191 against Gir 40), handled with a
`WeightedRandomSampler` rather than by discarding data — at these volumes we
cannot afford to throw any away.

## Label conflicts

**73 images were dropped.** Each near-duplicates a photograph filed under a
*different* breed, nine of them identical at cosine 1.000:

```
Mehsana_86.jpg  <-> Murrah_111.jpg   1.0000
Mehsana_92.jpg  <-> Surti_5.jpg      1.0000
Hariana_30.png  <-> Ongole_170.png   1.0000
```

Worst affected: Mehsana (20), Murrah (15), Surti (11), Hariana (7). At least one
label in each pair is wrong and there is no way to tell which, so both go. Keeping
them would teach the model a contradiction and, when a pair straddles a split,
hand it a free correct answer at test time.

## Splits

| Split | Images | Share |
| --- | --- | --- |
| train | 921 | 69.9% |
| val | 198 | 15.0% |
| test | 198 | 15.0% |

Built by assigning whole near-duplicate groups to one split, seeded at 42.

## Verification

Two independent checks, neither trusting how the split was built:

| Check | val | test |
| --- | --- | --- |
| Source photos spanning splits | **0** | **0** |
| Images above duplicate threshold | **0** | **0** |
| Max cosine to any training image | 0.936 | 0.942 |
| Untrained 1-NN accuracy | **0.596** | **0.540** |

The 1-NN figure is the one that matters. It fell from 1.000 to ~0.55, meaning the
split can no longer be solved by lookup and a model has to actually learn
something. It also gives the honest floor for the model card: beating 0.540 is the
bar, not beating zero.

## Limitations

- **921 training images is small.** The model overfits (train ~1.00, val ~0.65)
  and stronger regularisation did not close the gap. Data is the constraint.
- **±6.5 points.** With 198 test images the 95% interval around 67% accuracy spans
  roughly 61–74%. Small differences between configurations are noise, which is
  exactly how a 5-point validation lead for ResNet50 evaporated on test.
- **Gir has 40 images and Surti 59**, so their per-class metrics are unstable.
- **Curated photographs, not field photographs** — mostly well-lit animals in
  side profile. Real phone photos will be harder, so these numbers are an upper
  bound on deployed performance.
- **Sahiwal and Tharparkar are absent** from this source, which is why the breed
  list changed. Both are major dairy breeds and should return once field
  collection supplies images.
