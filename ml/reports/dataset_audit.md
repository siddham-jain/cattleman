# Dataset audit — raw collection and rebuilt splits

**Date:** 18 May 2026
**Scope:** 598 images, 12 breeds, from `SynthAIzer/indian-cattle-buffalo-breeds`
**Reproduce:** `python ml/audit.py` and `python ml/audit.py --root ml/data/splits`

## Integrity

598 images downloaded, **0 unreadable**. Every file opens and verifies under PIL.

## Class balance

| Breed | Images |
| --- | --- |
| Mehsana | 26 |
| all other 11 breeds | 52 each |

Imbalance ratio 2.00. Mehsana ships with half the images of every other breed.
Handled at training time with a `WeightedRandomSampler` (see `ml/data.py`) rather
than by discarding data from the other eleven — with ~35 training images per
breed we cannot afford to throw any away.

## Leakage in the upstream splits

Grouping by perceptual hash, the 598 images resolve to **465 distinct source
photos**. Measuring how those groups fall across the published splits:

| | Upstream splits | Our splits |
| --- | --- | --- |
| Source photos spanning >1 split | **48** | **0** |
| Images in a leaking group | **127 (21.2%)** | **0 (0.0%)** |

Over a fifth of the upstream dataset is compromised. Any accuracy figure
measured on its `test/` directory would be partly a memorisation score.

Worst affected breeds upstream: Ongole (8 groups), Murrah and Surti (6 each),
Gir and Hariana (5 each).

## A bug worth recording

The first version of the rebuilt splits still audited at 1.3% leakage despite
splitting by group. The cause was not the splitting logic but the grouping:
clusters were built greedily, assigning each image to the first cluster it
matched, so the result depended on iteration order. The audit walked
`splits/<split>/<breed>/` while the splitter walked `raw/<breed>/`, the two
produced slightly different groups, and borderline pairs fell through the gap.

Near-duplicate is not a transitive relation — A within threshold of B and B of C
does not put A within threshold of C — so "first match wins" is ill-defined.
Replacing it with connected components over the same relation made grouping
order-independent and took leakage to zero.

The lesson is that the audit only had teeth because it was written to be run
against *our own* output, not just the upstream data. An audit that can only
criticise someone else's work would have reported success here.

## Rebuilt splits

| Split | Images | Share |
| --- | --- | --- |
| train | 414 | 69.2% |
| val | 92 | 15.4% |
| test | 92 | 15.4% |

Every breed appears in every split (36/8/8, and 18/4/4 for Mehsana). Splitting is
seeded, so `python ml/splits.py` reproduces this exactly.

## Honest limitations

- **~35 training images per breed is very small.** Transfer learning makes it
  workable, but the confidence interval on a 92-image test set is wide — roughly
  ±5 percentage points near 85% accuracy. Single-run comparisons of similar
  configurations should not be over-read.
- **The images are curated reference photographs**, largely well-lit animals in
  side profile. Field photos from a phone will be dirtier — odd angles, partial
  occlusion, poor light. Test-set accuracy should be treated as an upper bound
  on real-world performance, and post-deployment corrections collected.
- **Augmented copies remain in the training set.** They add less diversity than
  35 genuinely distinct photos would; the effective sample size is smaller than
  the file count suggests.
