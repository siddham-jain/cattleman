from fastapi import FastAPI, HTTPException, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from typing import Optional
import random, os

load_dotenv()

app = FastAPI(title="Cattleman API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class AnimalType(str, Enum):
    CATTLE = "cattle"; BUFFALO = "buffalo"

class BreedInfo(BaseModel):
    name: str; type: AnimalType; origin: str; traits: list[str]; purpose: str; avg_milk_yield_liters: int

class RecognitionResult(BaseModel):
    breed: str; confidence: float; animal_type: AnimalType; traits: list[str]; origin: str

class RecognizeResponse(BaseModel):
    results: list[RecognitionResult]; top_match: RecognitionResult

BREED_CATALOG = {
    "Gir": {"type": AnimalType.CATTLE, "origin": "Gujarat", "traits": ['Hump', 'Pendulous ears', 'Reddish-brown coat'], "purpose": "Dairy", "avg_milk_yield_liters": 2100},
    "Sahiwal": {"type": AnimalType.CATTLE, "origin": "Punjab", "traits": ['Reddish-dun coat', 'Heavy dewlap', 'Stumpy horns'], "purpose": "Dairy / Draught", "avg_milk_yield_liters": 2300},
    "Red Sindhi": {"type": AnimalType.CATTLE, "origin": "Sindh", "traits": ['Deep red coat', 'Compact body', 'Short horns'], "purpose": "Dairy", "avg_milk_yield_liters": 1800},
    "Tharparkar": {"type": AnimalType.CATTLE, "origin": "Rajasthan", "traits": ['White-grey coat', 'Lyra-shaped horns', 'Long face'], "purpose": "Dairy / Draught", "avg_milk_yield_liters": 1700},
    "Kankrej": {"type": AnimalType.CATTLE, "origin": "Gujarat", "traits": ['Silver-grey coat', 'Large lyre horns', 'Pendulous ears'], "purpose": "Draught / Dairy", "avg_milk_yield_liters": 1300},
    "Ongole": {"type": AnimalType.CATTLE, "origin": "Andhra Pradesh", "traits": ['White coat', 'Short stumpy horns', 'Heavy body'], "purpose": "Draught / Dairy", "avg_milk_yield_liters": 1500},
    "Hariana": {"type": AnimalType.CATTLE, "origin": "Haryana", "traits": ['White-grey coat', 'Narrow face', 'Short horns'], "purpose": "Draught / Dairy", "avg_milk_yield_liters": 1000},
    "Murrah": {"type": AnimalType.BUFFALO, "origin": "Haryana", "traits": ['Jet black coat', 'Curled horns', 'Massive body'], "purpose": "Dairy", "avg_milk_yield_liters": 2500},
    "Jaffarabadi": {"type": AnimalType.BUFFALO, "origin": "Gujarat", "traits": ['Black coat', 'Heavy horns', 'Large forehead'], "purpose": "Dairy", "avg_milk_yield_liters": 2200},
    "Surti": {"type": AnimalType.BUFFALO, "origin": "Gujarat", "traits": ['Medium black body', 'Sickle horns', 'White markings'], "purpose": "Dairy", "avg_milk_yield_liters": 1800},
    "Mehsana": {"type": AnimalType.BUFFALO, "origin": "Gujarat", "traits": ['Black coat', 'Light eyes', 'Medium horns'], "purpose": "Dairy", "avg_milk_yield_liters": 2000},
    "Nili-Ravi": {"type": AnimalType.BUFFALO, "origin": "Punjab", "traits": ['Black coat', 'White forehead/tail', 'Wall eyes'], "purpose": "Dairy", "avg_milk_yield_liters": 2400},
}

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "cattleman")
client = AsyncIOMotorClient(MONGO_URL); db = client[DB_NAME]

@app.on_event("startup")
async def startup():
    if await db.breeds.count_documents({}) == 0:
        await db.breeds.insert_many([{"name":k,**v} for k,v in BREED_CATALOG.items()])

@app.get("/api/breeds")
async def get_breeds():
    breeds = []
    async for doc in db.breeds.find({}, projection={"_id":False}): breeds.append(doc)
    return {"breeds":breeds}

@app.post("/api/recognize", response_model=RecognizeResponse)
async def recognize_breed(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, detail="File must be an image")
    contents = await file.read()
    if not contents:
        raise HTTPException(400, detail="Empty file")
    breed_names = list(BREED_CATALOG.keys())
    top_breed = random.choice(breed_names)
    info = BREED_CATALOG[top_breed]
    top = RecognitionResult(breed=top_breed, confidence=round(random.uniform(0.78,0.97),3),
                            animal_type=info["type"], traits=info["traits"], origin=info["origin"])
    results = [top]
    remaining = [b for b in breed_names if b != top_breed]
    for i, b in enumerate(random.sample(remaining, min(3, len(remaining)))):
        conf = round(random.uniform(0.30, 0.70-i*0.12), 3)
        ri = BREED_CATALOG[b]
        results.append(RecognitionResult(breed=b, confidence=conf, animal_type=ri["type"], traits=ri["traits"], origin=ri["origin"]))
    results.sort(key=lambda r: r.confidence, reverse=True)
    return RecognizeResponse(results=results, top_match=results[0])
