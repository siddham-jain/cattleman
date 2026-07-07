# Cattleman API

FastAPI service backing the mobile app. Base URL defaults to
`http://localhost:8000`; the app reads it from Settings.

The app does **not** depend on this service to identify a breed — inference runs
on the device. The API stores what devices sync up and serves the breed
catalogue.

## `GET /api/breeds`

The breed catalogue with metadata.

```json
{ "breeds": [ { "name": "Gir", "type": "cattle", "origin": "Gujarat",
               "traits": ["Hump", "Pendulous ears", "Reddish-brown coat"],
               "purpose": "Dairy", "avg_milk_yield_liters": 2100 } ] }
```

Reconciled against `BREED_CATALOG` on every startup, not seeded once. The
catalogue changes when the model's class list changes, and a seed-once check
would leave a deployed database serving breeds the model can no longer predict.

## `POST /api/recognize`

Multipart upload, field `file`. Server-side inference — used by tooling and
tests; the app classifies locally.

Returns the top four candidates ranked by confidence:

```json
{ "results": [ { "breed": "Murrah", "confidence": 0.78, "animal_type": "buffalo",
                 "traits": ["Jet black coat", "Curled horns", "Massive body"],
                 "origin": "Haryana" } ],
  "top_match": { "...": "same shape" },
  "request_id": "a1b2c3d4" }
```

| Status | Cause |
| --- | --- |
| 400 | not an image, empty, unreadable, or over 5 MB |
| 503 | model artefact missing — build it with `python ml/export_onnx.py` |

503 rather than a fallback is deliberate: a server returning plausible nonsense
is worse than one that is honestly unavailable.

## `GET /api/history`

Server-side recognitions, newest first. `limit` (1–100, default 20), `offset`.

## `POST /api/animals`

Accepts a registration synced from a device.

```json
{ "id": "m8k2p-a7f3d91b", "breed": "Gir", "animal_type": "cattle",
  "confidence": 0.82, "created_at": "2026-07-01T09:30:00Z",
  "tag_id": "TAG-001", "owner_name": null,
  "latitude": 23.02, "longitude": 72.57, "notes": null,
  "predictions": [ { "breed": "Gir", "confidence": 0.82, "rank": 0 } ],
  "corrections": [] }
```

**The `id` comes from the device.** It is generated offline so a record can exist
and be referenced before it has ever reached a server, and the endpoint upserts
on it. A phone that retries after a lost response therefore stores the same
animal once rather than creating duplicates — retry safety without a
deduplication pass.

| Status | Meaning | Client behaviour |
| --- | --- | --- |
| 200 | stored | drop from the queue |
| 422 | unknown breed, or coordinates out of range | permanent — stop retrying |
| 5xx | server problem | retry with backoff |

The client treats 4xx as permanent and 5xx/429 as transient. A breed this server
does not recognise will not become valid on the fifth attempt.

## `GET /api/animals`

Synced registrations, newest first. `limit` (1–200, default 50), `offset`.

## `GET /api/corrections`

Every case where a field worker overruled the model.

```json
{ "corrections": [ { "animal_id": "m8k2p-a7f3d91b",
                     "created_at": "2026-07-01T09:30:00Z",
                     "predicted_breed": "Surti",
                     "corrected_breed": "Murrah" } ], "total": 1 }
```

This is the retraining queue. Each entry is a labelled example of a case the
model got wrong, taken on real field imagery rather than curated photographs —
which is exactly the data the model is short of.

## Running it

```bash
python -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
MONGO_URL=mongodb://localhost:27017 .venv/bin/uvicorn backend.server:app --reload
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGO_URL` | `mongodb://localhost:27017` | database |
| `DB_NAME` | `cattleman` | database name |
| `MODEL_PATH` | `ml/models/cattleman.onnx` | ONNX artefact |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | comma-separated CORS origins |

Tests need no MongoDB and no model — `pytest tests/` runs against an in-memory
database and skips model-dependent tests when the artefact is absent.
