# Cattleman — AI Cattle & Buffalo Breed Recognition

A proof-of-concept web application that identifies Indian cattle and buffalo
breeds from photographs using an AI image analysis pipeline.

## Features

- Drag-and-drop image upload with preview
- AI-powered breed identification with confidence scores
- Detailed breed information (origin, traits, milk yield)
- Recognition history with pagination
- Responsive design for mobile and desktop
- 12 supported Indian breeds (7 cattle, 5 buffalo)

## Stack

| Layer    | Technology                    |
|----------|-------------------------------|
| Backend  | Python 3, FastAPI, MongoDB   |
| Frontend | React 18, Tailwind, shadcn/ui |
| AI       | Breed recognition pipeline    |

## Quick Start

```bash
# Backend
cd backend && pip install -r requirements.txt && uvicorn server:app --reload

# Frontend
cd frontend && npm install && npm start
```

## API Endpoints

| Method | Path           | Description                  |
|--------|----------------|------------------------------|
| GET    | /api/breeds    | List all 12 breeds           |
| POST   | /api/recognize | Upload image for recognition |
| GET    | /api/history   | View past recognition results|

## License

MIT — see LICENSE file for details.

## Development

```bash
# Run tests
cd tests && pytest -v

# Lint backend
pip install ruff && ruff check backend/
```

## Contributing

Pull requests welcome. See image_testing.md for testing guidelines.
