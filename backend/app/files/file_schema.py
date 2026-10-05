from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FileUploadResponse(BaseModel):
    success: bool
    message: str
    data: "FileData"


class FileUpdateRequest(BaseModel):
    original_filename: Optional[str] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    branch_name: Optional[str] = None
    ifsc: Optional[str] = None
    micr: Optional[str] = None
    account_type: Optional[str] = None
    statement_start_date: Optional[date] = None
    statement_end_date: Optional[date] = None


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
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    branch_name: Optional[str] = None
    ifsc: Optional[str] = None
    micr: Optional[str] = None
    account_type: Optional[str] = None
    processing_stage: Optional[str] = None
    processing_progress: Optional[str] = None
    statement_start_date: Optional[date] = None
    statement_end_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class FileListResponse(BaseModel):
    success: bool
    message: str
    total: int
    data: list[FileData]