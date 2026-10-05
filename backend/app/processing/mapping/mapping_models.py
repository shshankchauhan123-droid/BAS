from pydantic import BaseModel

class ColumnMapping(BaseModel):
    source_column: str
    target_field: str
    confidence: float
