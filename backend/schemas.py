# backend/schemas.py
from pydantic import BaseModel

class PlayerCreate(BaseModel):
    name: str
