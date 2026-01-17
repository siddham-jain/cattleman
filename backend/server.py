from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from enum import Enum

app = FastAPI(title="Cattleman API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class AnimalType(str, Enum):
    CATTLE = "cattle"
    BUFFALO = "buffalo"

BREED_CATEGORIES = {
    AnimalType.CATTLE: ["Gir", "Sahiwal", "Red Sindhi", "Tharparkar", "Kankrej"],
    AnimalType.BUFFALO: ["Murrah", "Jaffarabadi", "Surti", "Mehsana", "Nili-Ravi"],
}
