from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from enum import Enum

app = FastAPI(title="Cattleman API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class AnimalType(str, Enum):
    CATTLE = "cattle"
    BUFFALO = "buffalo"

BREED_CATALOG = {
    "Gir": {
        "type": AnimalType.CATTLE,
        "origin": "Gujarat",
        "traits": ['Hump', 'Pendulous ears', 'Reddish-brown coat'],
        "purpose": "Dairy",
        "avg_milk_yield_liters": 2100,
    },
    "Sahiwal": {
        "type": AnimalType.CATTLE,
        "origin": "Punjab",
        "traits": ['Reddish-dun coat', 'Heavy dewlap', 'Stumpy horns'],
        "purpose": "Dairy / Draught",
        "avg_milk_yield_liters": 2300,
    },
    "Red Sindhi": {
        "type": AnimalType.CATTLE,
        "origin": "Sindh",
        "traits": ['Deep red coat', 'Compact body', 'Short horns'],
        "purpose": "Dairy",
        "avg_milk_yield_liters": 1800,
    },
    "Tharparkar": {
        "type": AnimalType.CATTLE,
        "origin": "Rajasthan",
        "traits": ['White-grey coat', 'Lyra-shaped horns', 'Long face'],
        "purpose": "Dairy / Draught",
        "avg_milk_yield_liters": 1700,
    },
    "Kankrej": {
        "type": AnimalType.CATTLE,
        "origin": "Gujarat",
        "traits": ['Silver-grey coat', 'Large lyre horns', 'Pendulous ears'],
        "purpose": "Draught / Dairy",
        "avg_milk_yield_liters": 1300,
    },
    "Ongole": {
        "type": AnimalType.CATTLE,
        "origin": "Andhra Pradesh",
        "traits": ['White coat', 'Short stumpy horns', 'Heavy body'],
        "purpose": "Draught / Dairy",
        "avg_milk_yield_liters": 1500,
    },
    "Hariana": {
        "type": AnimalType.CATTLE,
        "origin": "Haryana",
        "traits": ['White-grey coat', 'Narrow face', 'Short horns'],
        "purpose": "Draught / Dairy",
        "avg_milk_yield_liters": 1000,
    },
    "Murrah": {
        "type": AnimalType.BUFFALO,
        "origin": "Haryana",
        "traits": ['Jet black coat', 'Curled horns', 'Massive body'],
        "purpose": "Dairy",
        "avg_milk_yield_liters": 2500,
    },
    "Jaffarabadi": {
        "type": AnimalType.BUFFALO,
        "origin": "Gujarat",
        "traits": ['Black coat', 'Heavy horns', 'Large forehead'],
        "purpose": "Dairy",
        "avg_milk_yield_liters": 2200,
    },
    "Surti": {
        "type": AnimalType.BUFFALO,
        "origin": "Gujarat",
        "traits": ['Medium black body', 'Sickle horns', 'White markings'],
        "purpose": "Dairy",
        "avg_milk_yield_liters": 1800,
    },
    "Mehsana": {
        "type": AnimalType.BUFFALO,
        "origin": "Gujarat",
        "traits": ['Black coat', 'Light eyes', 'Medium horns'],
        "purpose": "Dairy",
        "avg_milk_yield_liters": 2000,
    },
    "Nili-Ravi": {
        "type": AnimalType.BUFFALO,
        "origin": "Punjab",
        "traits": ['Black coat', 'White forehead/tail', 'Wall eyes'],
        "purpose": "Dairy",
        "avg_milk_yield_liters": 2400,
    },
}

BREED_CATEGORIES = {
    AnimalType.CATTLE: ["Gir", "Sahiwal", "Red Sindhi", "Tharparkar", "Kankrej", "Ongole", "Hariana"],
    AnimalType.BUFFALO: ["Murrah", "Jaffarabadi", "Surti", "Mehsana", "Nili-Ravi"],
}
