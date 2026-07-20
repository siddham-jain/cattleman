# Cattleman

Offline-first breed identification for Indian cattle and buffalo. Photograph an
animal, get a ranked shortlist of breeds on the device, register it, and sync
when signal returns.

Built for field workers doing livestock registration, where the working
conditions are a shed with no network and a mid-range Android phone.

## What it does

- **Identifies 12 breeds on device** from a photo, with no network call
- **Presents a ranked shortlist**, not a single verdict, and lets the worker override it
- **Registers animals offline** into SQLite - tag, owner, notes, location
- **Syncs in the background** with retry and backoff when connectivity returns
- **Offline breed guide** with identifying features and care/feeding notes
- **English, Hindi, and Marathi**

## Accuracy, stated plainly

| Metric | Value |
| --- | --- |
| Top-1 | **0.672** |
| Top-3 | **0.894** |
| Untrained 1-NN baseline | 0.540 |
| Test images | 198 |

Read top-1 as **67% ± 7** - 198 test images give a wide interval. The model is
wrong about a third of the time on its first guess, which is exactly why the app
shows a shortlist and records corrections rather than asserting an answer.

It is a decision aid. It is not suitable for pedigree certification, registration
disputes, or insurance assessment. Full detail, including what it confuses and
why, is in [`ml/reports/model_card.md`](ml/reports/model_card.md).

## Layout

```
mobile/     Expo React Native app - capture, inference, SQLite, sync, guide
backend/    FastAPI service - breed catalogue, sync endpoints, corrections queue
ml/         Dataset tooling, training, evaluation, ONNX export
docs/       API reference and architecture decision records
tests/      Backend test suite
```

## Running it

**Backend**

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/uvicorn backend.server:app --reload
```

**Tests** - no MongoDB, no model needed:

```bash
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest tests/
```

**Model** - the trained model ships with the repo at
`mobile/assets/model/cattleman.onnx` (17.2 MB), so the app and the API work on a
fresh clone. Point the backend at it with `MODEL_PATH`:

```bash
export MODEL_PATH=mobile/assets/model/cattleman.onnx
```

To rebuild it from scratch instead:

```bash
.venv/bin/pip install -r ml/requirements.txt
PYTHONPATH=ml .venv/bin/python ml/download.py     # fetch dataset
PYTHONPATH=ml .venv/bin/python ml/splits.py       # leakage-free splits
PYTHONPATH=ml .venv/bin/python ml/leakcheck.py    # verify the splits
PYTHONPATH=ml .venv/bin/python ml/train.py --strong-aug --weight-decay 5e-4
PYTHONPATH=ml .venv/bin/python ml/evaluate.py --checkpoint ml/models/best.pt
PYTHONPATH=ml .venv/bin/python ml/export_onnx.py --checkpoint ml/models/best.pt
cp ml/models/cattleman.onnx ml/models/cattleman.json mobile/assets/model/
```

**Mobile** - needs a dev build; ONNX Runtime is a native module, so Expo Go will
not work:

```bash
cd mobile && npm install && npx expo prebuild && npx expo run:android
```

## Two things worth knowing

**The first model scored 100% and was worthless.** With ~35 images per breed that
is not a believable number. A nearest-neighbour lookup over *untrained* ImageNet
embeddings scored 100% on the same split, which showed the split was doing the
work: the dataset's ~52 images per breed were about four photographs augmented
into fifty. `ml/leakcheck.py` exists so that failure cannot recur silently, and
every reported figure is measured against the 0.540 lookup baseline rather than
against zero.

**Validation rankings on small splits are partly luck.** ResNet50 led validation
by 5 points and lost on test by 1. MobileNetV3 ships because the two are
statistically indistinguishable while ResNet50 is 5.5× larger.

## Model and data

- 12 breeds - 7 cattle (Gir, Rathi, Red Sindhi, Khillari, Kankrej, Ongole,
  Hariana), 5 buffalo (Murrah, Jaffarabadi, Surti, Mehsana, Nili-Ravi)
- Sahiwal and Tharparkar are **deferred**, not dropped by choice: no usable
  training images. Both are major dairy breeds and should return once field
  collection supplies them.
- MobileNetV3-Large fine-tuned from ImageNet, 17.2 MB ONNX, opset 18
- 1,390 images backed by 1,341 distinct photographs, split by source photo

Corrections made in the field are exposed at `GET /api/corrections` - labelled
examples of exactly what the model gets wrong, on real field imagery. Feeding
those back is worth more than any architecture change.

## Documentation

- [`docs/api.md`](docs/api.md) - endpoints and the sync contract
- [`ml/reports/model_card.md`](ml/reports/model_card.md) - metrics, limits, intended use
- [`ml/reports/dataset_audit.md`](ml/reports/dataset_audit.md) - data provenance and the leakage post-mortem
- [`ml/reports/poc_findings.md`](ml/reports/poc_findings.md) - why pretrained models alone failed
- [`docs/adr/`](docs/adr/) - architecture decisions

## Licence

MIT - see [LICENSE](LICENSE).
