# Changelog

All notable changes to this project are documented here so that any session,
editor, or agent can pick up with full context.

## [Unreleased]

### Added
- On-device breed inference in the mobile app via ONNX Runtime (12 breeds, no network needed).
- Offline SQLite registry: animals, ranked predictions, corrections, and a sync queue.
- Background sync with exponential backoff and permanent-vs-transient failure handling.
- `POST/GET /api/animals` and `GET /api/corrections` sync endpoints; device-generated ids make retries idempotent.
- Offline breed guide with identifying features, purpose, yield, and care/feeding notes.
- English, Hindi, and Marathi localisation, switchable independently of device locale.
- ML pipeline: dataset download, audit, leakage-free splits, training, sweep, evaluation, ONNX export.
- `ml/leakcheck.py` — validates a split by whether an untrained 1-NN can already solve it.
- Model card, dataset audit, POC findings, API reference, ADR 0001.

### Changed
- Replaced the React web frontend with an Expo React Native app.
- `/api/recognize` now runs real ONNX inference instead of returning random breeds.
- Breed list: Sahiwal and Tharparkar deferred (no training data), Rathi and Khillari added.
- Breed catalogue reconciles on every startup rather than seeding once.
- Backend startup migrated from deprecated `on_event` to a lifespan handler; API 0.3.0 → 0.4.0.

### Fixed
- `backend/server.py` had a syntax error and had never been importable.
- Test suite required a live MongoDB; now hermetic via `mongomock-motor` (6 failures → 22 passing).
- `tests/fixtures/sample.jpg` was a 62-byte stub, not a decodable image.
- Near-duplicate clustering was order-dependent; replaced with connected components.
- ONNX export wrote weights to a sidecar file, producing a model that would fail to load on a phone.

### Removed
- `frontend/` (React web app), `test_result.md`, `image_testing.md`, `README_CATTLE_RECOGNITION.md`.
- `ml/imagehash.py` — perceptual hashing could not separate same-breed from different-breed pairs.

---

## Work Log

Chronological notes for cross-session context. Newest first.

### 2026-07-16 — Polish and documentation
- **What:** Breed guide and settings screens, lifespan migration, README and API docs rewritten.
- **Why:** The guide is the fallback path when the model is unsure, which at 67% top-1 is common.
- **State:** All phases through the integration freeze are complete. 22 tests passing.
- **Notes:** Language is switchable because shared handsets often carry someone else's locale.

### 2026-07-03 — Cloud sync
- **What:** Mobile sync queue with capped exponential backoff; API documented.
- **Why:** Field connectivity arrives in short windows, so sync must resume mid-batch.
- **State:** 4xx stops retrying, 5xx/429 retries. Idempotency comes from device-generated ids.
- **Notes:** Backoff caps at an hour — uncapped doubling strands records for days.

### 2026-06-23 — Offline storage and registration
- **What:** SQLite schema, registration form, registry list with sync state.
- **Why:** The phone is the source of truth; a registration must succeed with no network.
- **State:** Write and sync-job enqueue share one transaction so nothing can be stranded.
- **Notes:** Corrections table doubles as retraining data.

### 2026-06-12 — React Native app, web frontend retired
- **What:** Expo app with on-device ONNX inference; `frontend/` removed.
- **Why:** A browser app calling a server cannot work in a shed with no signal.
- **State:** Capture → ranked result → register flow working.
- **Notes:** Needs a dev build; ONNX Runtime is a native module, so Expo Go will not run it.

### 2026-06-08 — Real inference in the API
- **What:** `_simulate_ai` (which returned `random.choice`) replaced with ONNX inference.
- **Why:** The endpoint had never looked at an uploaded image.
- **State:** Missing model returns 503 rather than falling back to a placeholder.
- **Notes:** Exposed that the test image fixture was a 62-byte stub.

### 2026-05-31 — Model selection and export
- **What:** Sweep of four configs, evaluation on test, model card, ONNX export with parity check.
- **Why:** Needed an honest number and a deployable artefact.
- **State:** MobileNetV3 at 0.672 top-1 / 0.894 top-3; 17.2 MB; ONNX matches PyTorch 198/198.
- **Notes:** ResNet50 led validation by 5 points then lost test by 1 — noise on a 198-image split.
  It is 5.5× larger for no measurable gain, so MobileNetV3 ships.

### 2026-05-21 — Leakage found, dataset replaced
- **What:** Investigated a 100% validation score; replaced dHash dedup with embedding clustering
  and switched dataset to `mr-rxa/Cattle-Buffalo-Datatset`.
- **Why:** 100% is not believable with ~35 images per class. An untrained 1-NN scored 100% on the
  same split — the split was doing the work, not the model.
- **State:** Old source held ~4 real photographs per breed augmented into ~52 files. New source has
  1,341 distinct photographs from 1,390 files. Untrained 1-NN now 0.540.
- **Notes:** dHash was the root cause — same-breed median Hamming 17 vs different-breed 18, so no
  threshold separates them. 73 images dropped for cross-breed label conflicts. Sahiwal and
  Tharparkar had to be deferred; Rathi and Khillari replaced them.

### 2026-05-05 — Pivot to custom training
- **What:** ADR 0001; dataset survey.
- **Why:** POC showed ImageNet cannot express breed.
- **State:** Transfer learning with a 12-way head chosen over zero-shot CLIP or training from scratch.
- **Notes:** Rejected one candidate dataset whose `image` column held Windows file paths, not pixels.

### 2026-04-28 — POC on pretrained models
- **What:** Zero-shot ResNet50 and MobileNetV3 over real breed photos.
- **Why:** To test whether off-the-shelf classification could work before building a pipeline.
- **State:** All 12 breeds collapse into 5–7 generic ImageNet labels (`ox`, `water buffalo`, `oxcart`).
- **Notes:** Backbones do separate cattle from buffalo, which is what made transfer learning a
  reasonable bet on a small dataset.
