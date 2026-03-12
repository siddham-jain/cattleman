# Cattleman — AI Cattle & Buffalo Breed Recognition

## Overview
Cattleman identifies indigenous Indian cattle and buffalo breeds from photos using AI.

## Supported Breeds (12)

| Breed        | Type    | Origin          | Avg Yield (L/yr) |
|-------------|---------|-----------------|-------------------|
| Gir          | Cattle  | Gujarat          | 2,100            |
| Sahiwal      | Cattle  | Punjab           | 2,300            |
| Red Sindhi   | Cattle  | Sindh            | 1,800            |
| Tharparkar   | Cattle  | Rajasthan        | 1,700            |
| Kankrej      | Cattle  | Gujarat          | 1,300            |
| Ongole       | Cattle  | Andhra Pradesh   | 1,500            |
| Hariana      | Cattle  | Haryana          | 1,000            |
| Murrah       | Buffalo | Haryana          | 2,500            |
| Jaffarabadi  | Buffalo | Gujarat          | 2,200            |
| Surti        | Buffalo | Gujarat          | 1,800            |
| Mehsana      | Buffalo | Gujarat          | 2,000            |
| Nili-Ravi    | Buffalo | Punjab           | 2,400            |

## Architecture

```
User → React Frontend → FastAPI Backend → AI Pipeline → MongoDB
```

## API Endpoints

| Method | Path           | Description                  |
|--------|----------------|------------------------------|
| GET    | /api/breeds    | List all breeds              |
| POST   | /api/recognize | Upload image for recognition |
| GET    | /api/history   | Past recognition results     |

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm start
```
