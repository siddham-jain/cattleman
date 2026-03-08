from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Optional
import random, os, uuid

load_dotenv()
app = FastAPI(title="Cattleman API", version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class AnimalType(str, Enum): CATTLE='cattle'; BUFFALO='buffalo'
class RecognitionResult(BaseModel):
    breed: str; confidence: float = Field(ge=0.0, le=1.0); animal_type: AnimalType; traits: list[str]; origin: str
class RecognizeResponse(BaseModel):
    results: list[RecognitionResult]; top_match: RecognitionResult; request_id: str
class HistoryEntry(BaseModel):
    id: str; filename: str; top_breed: str; confidence: float; timestamp: datetime; results: list[RecognitionResult]
class HistoryResponse(BaseModel): entries: list[HistoryEntry]; total: int

BREED_CATALOG = {
    "Gir":{"type":AnimalType.CATTLE,"origin":"Gujarat","traits":['Hump', 'Pendulous ears', 'Reddish-brown coat'],"purpose":"Dairy","avg_milk_yield_liters":2100},
    "Sahiwal":{"type":AnimalType.CATTLE,"origin":"Punjab","traits":['Reddish-dun coat', 'Heavy dewlap', 'Stumpy horns'],"purpose":"Dairy / Draught","avg_milk_yield_liters":2300},
    "Red Sindhi":{"type":AnimalType.CATTLE,"origin":"Sindh","traits":['Deep red coat', 'Compact body', 'Short horns'],"purpose":"Dairy","avg_milk_yield_liters":1800},
    "Tharparkar":{"type":AnimalType.CATTLE,"origin":"Rajasthan","traits":['White-grey coat', 'Lyra-shaped horns', 'Long face'],"purpose":"Dairy / Draught","avg_milk_yield_liters":1700},
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
    if await db.breeds.count_documents({})==0:
        await db.breeds.insert_many([{"name":k,**v} for k,v in BREED_CATALOG.items()])

@app.get("/api/breeds")
async def get_breeds():
    breeds=[]; async for doc in db.breeds.find({},projection={'_id':False}): breeds.append(doc)
    return {'breeds':breeds}

def _simulate_ai(catalog,top_n=4):
    names=list(catalog.keys()); top=random.choice(names); info=catalog[top]
    results=[RecognitionResult(breed=top,confidence=round(random.uniform(0.78,0.97),3),animal_type=info['type'],traits=info['traits'],origin=info['origin'])]
    rem=[b for b in names if b!=top]
    for i,b in enumerate(random.sample(rem,min(top_n-1,len(rem)))):
        c=round(random.uniform(0.30,0.70-i*0.12),3); ri=catalog[b]
        results.append(RecognitionResult(breed=b,confidence=c,animal_type=ri['type'],traits=ri['traits'],origin=ri['origin']))
    results.sort(key=lambda r:r.confidence,reverse=True); return results

@app.post("/api/recognize",response_model=RecognizeResponse)
async def recognize_breed(file:UploadFile=File(...)):
    if not file.content_type or not file.content_type.startswith("image/"): raise HTTPException(400,"Must be an image")
    if not await file.read(): raise HTTPException(400,"Empty file")
    results=_simulate_ai(BREED_CATALOG); req_id=str(uuid.uuid4())[:8]
    await db.history.insert_one({"request_id":req_id,"filename":file.filename or "unknown","top_breed":results[0].breed,"confidence":results[0].confidence,"results":[r.dict() for r in results],"timestamp":datetime.now(timezone.utc)})
    return RecognizeResponse(results=results,top_match=results[0],request_id=req_id)

@app.get("/api/history",response_model=HistoryResponse)
async def get_history(limit:int=Query(20,ge=1,le=100),offset:int=Query(0,ge=0)):
    total=await db.history.count_documents({})
    cursor=db.history.find({}).sort("timestamp",-1).skip(offset).limit(limit)
    entries=[]; async for doc in cursor:
        entries.append(HistoryEntry(id=doc['request_id'],filename=doc['filename'],top_breed=doc['top_breed'],confidence=doc['confidence'],timestamp=doc['timestamp'],results=[RecognitionResult(**r) for r in doc['results']]))
    return HistoryResponse(entries=entries,total=total)
