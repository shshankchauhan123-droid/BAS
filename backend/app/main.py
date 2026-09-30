from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.authentication.auth_route import router as auth_router
from app.case.case_route import router as case_router
from app.user.user_route import router as user_router
from app.files.file_route import router as file_router
from app.bank_transactions.bank_transaction_routes import (
    router as bank_transaction_router,
)
from app.client.client_route import router as client_router


app = FastAPI(
    title="Anti-Drone Backend",
    description="Backend API for the Anti-Drone System",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(client_router)
app.include_router(case_router)
app.include_router(user_router)
app.include_router(file_router)
app.include_router(bank_transaction_router)


@app.get("/")
def root():
    return {
        "message": "BAS Backend is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }