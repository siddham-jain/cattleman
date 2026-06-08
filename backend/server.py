from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Optional
from io import BytesIO
from PIL import Image
import os, uuid

from backend.inference import ModelUnavailable, get_classifier

load_dotenv()

app = FastAPI(title="Cattleman API", version="0.3.0",
    description="Indian cattle & buffalo breed recognition API")

# Production-ready CORS
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

class AnimalType(str, Enum): CATTLE='cattle'; BUFFALO='buffalo'
class RecognitionResult(BaseModel):
    breed: str; confidence: float = Field(ge=0.0, le=1.0); animal_type: AnimalType; traits: list[str]; origin: str
class RecognizeResponse(BaseModel):
    results: list[RecognitionResult]; top_match: RecognitionResult; request_id: str
class HistoryEntry(BaseModel):
    id: str; filename: str; top_breed: str; confidence: float; timestamp: datetime; results: list[RecognitionResult]
class HistoryResponse(BaseModel): entries: list[HistoryEntry]; total: int

class PredictionIn(BaseModel):
    breed: str; confidence: float = Field(ge=0.0, le=1.0); rank: int = Field(ge=0)

class CorrectionIn(BaseModel):
    predicted_breed: str; corrected_breed: str

class AnimalIn(BaseModel):
    """A registration pushed up from a phone.

    The id is generated on the device so a record can exist and be referenced
    while offline. The server accepts that id rather than assigning one, which
    is what makes retrying a create idempotent.
    """
    id: str = Field(min_length=1, max_length=64)
    breed: str
    animal_type: AnimalType
    confidence: float = Field(ge=0.0, le=1.0)
    created_at: datetime
    tag_id: Optional[str] = None
    owner_name: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    notes: Optional[str] = None
    predictions: list[PredictionIn] = []
    corrections: list[CorrectionIn] = []

class AnimalsResponse(BaseModel): animals: list[AnimalIn]; total: int

BREED_CATALOG = {
    "Gir":{"type":AnimalType.CATTLE,"origin":"Gujarat","traits":['Hump', 'Pendulous ears', 'Reddish-brown coat'],"purpose":"Dairy","avg_milk_yield_liters":2100},
    "Rathi":{"type":AnimalType.CATTLE,"origin":"Rajasthan","traits":['Brown coat with white patches', 'Medium compact body', 'Curved horns'],"purpose":"Dairy","avg_milk_yield_liters":1560},
    "Red Sindhi":{"type":AnimalType.CATTLE,"origin":"Sindh","traits":['Deep red coat', 'Compact body', 'Short horns'],"purpose":"Dairy","avg_milk_yield_liters":1800},
    "Khillari":{"type":AnimalType.CATTLE,"origin":"Maharashtra","traits":['Greyish-white coat', 'Long pointed horns', 'Tight muscular build'],"purpose":"Draught","avg_milk_yield_liters":500},
    "Kankrej":{"type":AnimalType.CATTLE,"origin":"Gujarat","traits":['Silver-grey coat', 'Large lyre horns', 'Pendulous ears'],"purpose":"Draught / Dairy","avg_milk_yield_liters":1300},
    "Ongole":{"type":AnimalType.CATTLE,"origin":"Andhra Pradesh","traits":['White coat', 'Short stumpy horns', 'Heavy body'],"purpose":"Draught / Dairy","avg_milk_yield_liters":1500},
    "Hariana":{"type":AnimalType.CATTLE,"origin":"Haryana","traits":['White-grey coat', 'Narrow face', 'Short horns'],"purpose":"Draught / Dairy","avg_milk_yield_liters":1000},
    "Murrah":{"type":AnimalType.BUFFALO,"origin":"Haryana","traits":['Jet black coat', 'Curled horns', 'Massive body'],"purpose":"Dairy","avg_milk_yield_liters":2500},
    "Jaffarabadi":{"type":AnimalType.BUFFALO,"origin":"Gujarat","traits":['Black coat', 'Heavy horns', 'Large forehead'],"purpose":"Dairy","avg_milk_yield_liters":2200},
    "Surti":{"type":AnimalType.BUFFALO,"origin":"Gujarat","traits":['Medium black body', 'Sickle horns', 'White markings'],"purpose":"Dairy","avg_milk_yield_liters":1800},
    "Mehsana":{"type":AnimalType.BUFFALO,"origin":"Gujarat","traits":['Black coat', 'Light eyes', 'Medium horns'],"purpose":"Dairy","avg_milk_yield_liters":2000},
    "Nili-Ravi":{"type":AnimalType.BUFFALO,"origin":"Punjab","traits":['Black coat', 'White forehead/tail', 'Wall eyes'],"purpose":"Dairy","avg_milk_yield_liters":2400},
}
MONGO_URL=os.getenv('MONGO_URL','mongodb://localhost:27017'); DB_NAME=os.getenv('DB_NAME','cattleman')
client=AsyncIOMotorClient(MONGO_URL); db=client[DB_NAME]

@app.on_event("startup")
async def startup():
    # Reconcile every start, not just on an empty collection: the catalogue
    # changes when the model's class list changes, and a seed-once check would
    # leave a deployed database serving breeds the model can no longer predict.
    for name, info in BREED_CATALOG.items():
        await db.breeds.replace_one({"name": name}, {"name": name, **info}, upsert=True)
    await db.breeds.delete_many({"name": {"$nin": list(BREED_CATALOG)}})

@app.get("/api/breeds")
async def get_breeds():
    breeds = []
    async for doc in db.breeds.find({}, projection={'_id': False}):
        breeds.append(doc)
    return {'breeds': breeds}

@app.post("/api/recognize",response_model=RecognizeResponse)
async def recognize_breed(file:UploadFile=File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400,detail="Only image files (PNG, JPG, WebP) are accepted")
    contents = await file.read()
    if not contents:
        raise HTTPException(400,detail="Uploaded file is empty")
    if len(contents) > 5*1024*1024:
        raise HTTPException(400,detail="File exceeds maximum size of 5 MB")
    try:
        classifier = get_classifier()
    except ModelUnavailable as exc:
        raise HTTPException(503, detail=str(exc))

    try:
        image = Image.open(BytesIO(contents))
    except Exception:
        raise HTTPException(400, detail="File is not a readable image")

    ranked = classifier.predict(image)
    # Enrich with catalogue metadata the model itself does not carry.
    results = [RecognitionResult(breed=r["breed"], confidence=r["confidence"],
                                 animal_type=r["animal_type"],
                                 traits=BREED_CATALOG[r["breed"]]["traits"],
                                 origin=BREED_CATALOG[r["breed"]]["origin"])
               for r in ranked[:4]]
    req_id=str(uuid.uuid4())[:8]
    await db.history.insert_one({"request_id":req_id,"filename":file.filename or "unknown","top_breed":results[0].breed,"confidence":results[0].confidence,"results":[r.model_dump() for r in results],"timestamp":datetime.now(timezone.utc)})
    return RecognizeResponse(results=results,top_match=results[0],request_id=req_id)

@app.get("/api/history",response_model=HistoryResponse)
async def get_history(limit:int=Query(20,ge=1,le=100),offset:int=Query(0,ge=0)):
    total=await db.history.count_documents({})
    cursor=db.history.find({}).sort("timestamp",-1).skip(offset).limit(limit)
    entries = []
    async for doc in cursor:
        entries.append(HistoryEntry(id=doc['request_id'],filename=doc['filename'],top_breed=doc['top_breed'],confidence=doc['confidence'],timestamp=doc['timestamp'],results=[RecognitionResult(**r) for r in doc['results']]))
    return HistoryResponse(entries=entries,total=total)


@app.post("/api/animals")
async def upsert_animal(animal: AnimalIn):
    """Accept a registration synced from a device.

    Upsert keyed on the client id, so a phone that retries after a lost response
    stores the same animal once instead of creating a duplicate.

    An unknown breed is rejected with 422 rather than stored: the client treats
    4xx as permanent and stops retrying, which is right — a breed this server
    does not recognise will not become valid on the fifth attempt.
    """
    if animal.breed not in BREED_CATALOG:
        raise HTTPException(422, detail=f"Unknown breed: {animal.breed}")

    document = animal.model_dump()
    document["synced_at"] = datetime.now(timezone.utc)
    await db.animals.replace_one({"id": animal.id}, document, upsert=True)
    return {"id": animal.id, "status": "stored"}


@app.get("/api/animals", response_model=AnimalsResponse)
async def list_animals(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    total = await db.animals.count_documents({})
    cursor = db.animals.find({}, projection={'_id': False}) \
                       .sort("created_at", -1).skip(offset).limit(limit)
    animals = []
    async for doc in cursor:
        doc.pop("synced_at", None)
        animals.append(AnimalIn(**doc))
    return AnimalsResponse(animals=animals, total=total)


@app.get("/api/corrections")
async def list_corrections(limit: int = Query(100, ge=1, le=500)):
    """Field corrections, newest first — the retraining feedback queue.

    Every time a worker overrules the model we gain a labelled example of a case
    it got wrong, which is exactly the data worth adding to the next training run.
    """
    cursor = db.animals.find({"corrections.0": {"$exists": True}},
                             projection={'_id': False, 'id': True, 'breed': True,
                                         'corrections': True, 'created_at': True}) \
                       .sort("created_at", -1).limit(limit)
    items = []
    async for doc in cursor:
        for correction in doc.get("corrections", []):
            items.append({"animal_id": doc["id"], "created_at": doc["created_at"], **correction})
    return {"corrections": items, "total": len(items)}
