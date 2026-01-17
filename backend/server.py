from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

app = FastAPI(title="Cattleman API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
