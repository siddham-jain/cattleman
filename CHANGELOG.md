# Changelog

All notable changes to this project are documented here so that any session,
editor, or agent can pick up with full context.

## [Unreleased]

### Added
- `docs/report/Cattleman_Capstone_Demo.pptx` - 16-slide demo deck on the capstone template: stat tiles, breed photo grid, report figures, and per-slide speaker notes with timings.
- Model loading indicator: download percentage, MB, and a retry when it fails.
- `src/inference/status.js` — model load phase, subscribed to by the capture screen.
- Bottom tab bar (Identify, Registry, Guide, Settings) in place of the text links on the capture screen.
- A reference photo for each of the 12 breeds; guide cards carry a thumbnail and expand to the full picture.
- Breed guide: cattle/buffalo filter chips and a clearable search box.
- Reference thumbnails beside every candidate on the result screen.
- `src/theme.js` design tokens plus shared `Button` and `Pill` components.
- `src/breeds.js` — one place for breed names, photos, and localised reference fields.
- `src/inference/preprocess.js` — preprocessing and ranking shared by the native and web classifiers.
- `scripts/make_breed_images.py` — rebuilds the guide photos from the training split.
- Report: UAT scenarios, interface-improvement log, defect log, and challenges sections (§3.4–§3.7).
- Report: minimum handset specification with the reason behind each figure (§4.2).
- Report: supervisor interaction log and weekly progress extended through submission.
- Web target for the Expo app so the flow can be demoed in a browser (`npm run web`).
- `src/db/sqlite.web.js` — expo-sqlite's API over sql.js, persisted to IndexedDB.
- `src/inference/classifier.web.js` — real ONNX inference in the browser via onnxruntime-web.
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
- Every screen restyled on the shared design system: cards, one accent colour, larger type, icons.
- Result screen shows the top four candidates and holds the rest behind "show all".
- Breed origin and purpose are now translated; they read English under Hindi and Marathi before.
- A language change re-renders through an i18n subscription instead of resetting the navigation stack.
- Report diagrams and charts recoloured to the validated categorical palette, one hue per tier.
- Report tables and figures pinned to a single page (keepNext, cantSplit) with banded headers.
- Capture screen identifies on an explicit button press instead of straight after picking a photo.
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
- Hard-coded demo rankings in `classifier.web.js`; the browser runs the model now.
- Locale keys nothing referenced any more (`result.notListed`, `capture.grantPermission`, and others).
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
