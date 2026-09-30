from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FileUploadResponse(BaseModel):
    success: bool
    message: str
    data: "FileData"


class FileUpdateRequest(BaseModel):
    original_filename: Optional[str] = None


class FileSingleResponse(BaseModel):
    success: bool
    message: str
    data: "FileData"



class FileData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    created_by: int
    original_filename: str
    stored_filename: str
    file_path: str
    mime_type: Optional[str]
    file_size: int
    status: str
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime


class FileListResponse(BaseModel):
    success: bool
    message: str
    total: int
    data: list[FileData]