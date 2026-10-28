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
from app.audit.audit_route import router as audit_router
from app.io_master.io_master_route import router as io_master_router
from app.websocket.websocket_route import router as websocket_router
from app.dashboard.dashboard_route import router as dashboard_router
from app.ncrp.ncrp_routes import router as ncrp_router
from app.gst.gst_router import router as gst_router
from app.cin.cin_router import router as cin_router


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
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(client_router)
app.include_router(case_router)
app.include_router(io_master_router)
app.include_router(user_router)
app.include_router(file_router)
app.include_router(bank_transaction_router)
app.include_router(audit_router)
app.include_router(websocket_router)
app.include_router(dashboard_router)
app.include_router(ncrp_router)
app.include_router(gst_router)
app.include_router(cin_router)


import re

ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}
ORIGIN_REGEX = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    import traceback
    traceback.print_exc()
    from fastapi.responses import JSONResponse

    origin = request.headers.get("origin")
    headers = {}
    if origin and (origin in ALLOWED_ORIGINS or ORIGIN_REGEX.match(origin)):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"

    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers=headers,
    )


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