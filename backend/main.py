import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.config import settings
from backend.database import engine, Base, SessionLocal
from backend.routers import auth_router, grant_router, expense_router, analytics_router
from backend.routers.auth_router import seed_demo_data

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events."""
    # Startup: Create tables and auto-seed initial data
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_data(db)
    except Exception as e:
        print(f"[Startup Notice] Seed check: {e}")
    finally:
        db.close()
    yield
    # Shutdown (add cleanup here if needed)

app = FastAPI(
    title="GrantFlow API",
    description="University Research Grant Budget & Expense Audit Management Portal",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST Routers
app.include_router(auth_router.router)
app.include_router(grant_router.router)
app.include_router(expense_router.router)
app.include_router(analytics_router.router)

# Mount Static Uploads (Invoices/Receipts)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="frontend")

# Serve Landing Page at root, Portal at /portal
@app.get("/")
def serve_landing():
    return FileResponse(os.path.join(FRONTEND_DIR, "landing.html"))

@app.get("/portal")
@app.get("/app")
@app.get("/index.html")
def serve_portal():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "database": settings.DATABASE_URL.split("://")[0]
    }
