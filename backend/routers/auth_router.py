from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, date, timezone
from backend.database import get_db, Base, engine
from backend.models import User, Grant, BudgetHead, ExpenseRequest, ActivityAuditLog
from backend.schemas import UserLogin, UserRegister, TokenResponse, UserOut, UserUpdateProfile, RoleNameUpdate
from backend.auth import (
    verify_password, get_password_hash, create_access_token, 
    get_current_user, log_audit_trail
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Authenticates a user and returns a signed JWT bearer token."""
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.user_id), "role": user.role})
    
    # Audit log successful login
    client_ip = request.client.host if request.client else "127.0.0.1"
    log_audit_trail(db, user.user_id, "USER_LOGIN", "users", user.user_id, f"Role: {user.role}", client_ip)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, request: Request, db: Session = Depends(get_db)):
    """Registers a new user with any selected role (Scholar, Student, Dean, PI, Auditor, or custom)."""
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please Sign In instead."
        )

    normalized_role = user_data.role.strip().upper().replace(" ", "_")
    new_user = User(
        email=user_data.email.strip(),
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name.strip(),
        role=normalized_role,
        department=user_data.department.strip() or "General Research"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(data={"sub": str(new_user.user_id), "role": new_user.role})
    client_ip = request.client.host if request.client else "127.0.0.1"
    log_audit_trail(db, new_user.user_id, "USER_REGISTER", "users", new_user.user_id, f"Registered Role: {new_user.role}", client_ip)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user
    }

@router.get("/me", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return current_user

@router.put("/profile", response_model=UserOut)
def update_profile(
    profile_data: UserUpdateProfile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates the active logged-in user's name and department."""
    current_user.full_name = profile_data.full_name.strip()
    if profile_data.department:
        current_user.department = profile_data.department.strip()
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/update-role-name", response_model=UserOut)
def update_role_name(
    data: RoleNameUpdate,
    db: Session = Depends(get_db)
):
    """Allows updating any demo role's display name."""
    user = db.query(User).filter(User.email == data.role_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Role user not found")
    user.full_name = data.new_name.strip()
    if data.department:
        user.department = data.department.strip()
    db.commit()
    db.refresh(user)
    return user

@router.get("/test-accounts")
def get_test_accounts():
    """Returns pre-configured test accounts for quick demo evaluation."""
    return [
        {
            "role": "SCHOLAR",
            "name": "Aarav Sharma",
            "email": "scholar@university.edu",
            "password": "scholar123",
            "badge": "Research Scholar",
            "description": "Submits purchase claims & uploads invoice evidence"
        },
        {
            "role": "PI",
            "name": "Dr. Meera Iyer",
            "email": "pi@university.edu",
            "password": "pi123",
            "badge": "Principal Investigator",
            "description": "Creates grants, allocates heads, approves claims"
        },
        {
            "role": "FINANCE_AUDITOR",
            "name": "Rajesh K. Verma",
            "email": "auditor@university.edu",
            "password": "auditor123",
            "badge": "Finance Officer",
            "description": "Reviews audit trails, checks ceiling limits, monitors burn-rates"
        },
        {
            "role": "FINANCE_AUDITOR",
            "name": "Prof. Vikram Sengupta",
            "email": "dean@university.edu",
            "password": "dean123",
            "badge": "Dean of Research & Dev",
            "description": "Executive research grant oversight & university-wide financial auditing"
        }
    ]

@router.post("/seed-demo-data")
def seed_demo_data_route(db: Session = Depends(get_db)):
    """Initializes demo grants, budget heads, and test accounts if database is empty."""
    return seed_demo_data(db)


def seed_demo_data(db: Session):
    """Initializes demo grants, budget heads, and test accounts if database is empty."""
    Base.metadata.create_all(bind=engine)

    if db.query(User).count() > 0:
        return {"status": "Database already populated"}

    # 1. Create Users
    u_scholar = User(
        email="scholar@university.edu",
        password_hash=get_password_hash("scholar123"),
        full_name="Aarav Sharma",
        role="SCHOLAR",
        department="Computer Science & Engineering"
    )
    u_pi = User(
        email="pi@university.edu",
        password_hash=get_password_hash("pi123"),
        full_name="Dr. Meera Iyer",
        role="PI",
        department="Computer Science & Engineering"
    )
    u_auditor = User(
        email="auditor@university.edu",
        password_hash=get_password_hash("auditor123"),
        full_name="Rajesh K. Verma",
        role="FINANCE_AUDITOR",
        department="University Accounts & Audit"
    )
    db.add_all([u_scholar, u_pi, u_auditor])
    db.commit()

    # 2. Create Grants
    g1 = Grant(
        grant_code="DST-SERB-2025-091",
        title="AI-Driven Climate Resilient Edge Computing Infrastructure",
        funding_agency="Department of Science & Technology (DST-SERB)",
        pi_user_id=u_pi.user_id,
        total_sanctioned_amount=2500000.00,
        start_date=date(2025, 1, 1),
        end_date=date(2027, 12, 31),
        status="ACTIVE"
    )
    g2 = Grant(
        grant_code="CSIR-ML-2024-418",
        title="Explainable Graph Neural Networks for Healthcare Triage",
        funding_agency="CSIR India",
        pi_user_id=u_pi.user_id,
        total_sanctioned_amount=1800000.00,
        start_date=date(2024, 6, 1),
        end_date=date(2026, 5, 31),
        status="ACTIVE"
    )
    db.add_all([g1, g2])
    db.commit()

    # 3. Create Budget Heads
    bh1 = [
        BudgetHead(grant_id=g1.grant_id, category_name="EQUIPMENT", allocated_amount=1200000.00, spent_amount=450000.00),
        BudgetHead(grant_id=g1.grant_id, category_name="CONSUMABLES", allocated_amount=400000.00, spent_amount=85000.00),
        BudgetHead(grant_id=g1.grant_id, category_name="TRAVEL", allocated_amount=300000.00, spent_amount=42000.00),
        BudgetHead(grant_id=g1.grant_id, category_name="MANPOWER", allocated_amount=600000.00, spent_amount=250000.00)
    ]
    bh2 = [
        BudgetHead(grant_id=g2.grant_id, category_name="EQUIPMENT", allocated_amount=800000.00, spent_amount=320000.00),
        BudgetHead(grant_id=g2.grant_id, category_name="CONSUMABLES", allocated_amount=300000.00, spent_amount=45000.00),
        BudgetHead(grant_id=g2.grant_id, category_name="TRAVEL", allocated_amount=200000.00, spent_amount=15000.00),
        BudgetHead(grant_id=g2.grant_id, category_name="MANPOWER", allocated_amount=500000.00, spent_amount=180000.00)
    ]
    db.add_all(bh1 + bh2)
    db.commit()

    # 4. Create Sample Claims
    exp1 = ExpenseRequest(
        budget_head_id=bh1[0].budget_head_id,
        requested_by_user_id=u_scholar.user_id,
        amount=450000.00,
        vendor_name="NVIDIA Enterprise Solutions",
        description="NVIDIA RTX A6000 48GB GPU Workstation for ML training",
        invoice_blob_url="https://grantflowstorage.blob.core.windows.net/invoices/inv_sample_gpu.pdf",
        status="APPROVED",
        approved_at=datetime.now(timezone.utc)
    )
    exp2 = ExpenseRequest(
        budget_head_id=bh1[1].budget_head_id,
        requested_by_user_id=u_scholar.user_id,
        amount=35000.00,
        vendor_name="RoboCircuits Lab Supply",
        description="Raspberry Pi 5 Compute Modules & Sensor Shield Packs",
        invoice_blob_url="https://grantflowstorage.blob.core.windows.net/invoices/inv_sample_sensors.pdf",
        status="APPROVED",
        approved_at=datetime.now(timezone.utc)
    )
    exp3 = ExpenseRequest(
        budget_head_id=bh1[1].budget_head_id,
        requested_by_user_id=u_scholar.user_id,
        amount=18500.00,
        vendor_name="ElectroSpares Hub",
        description="Cat6 Ethernet Spool & High-Speed Networking Switch",
        invoice_blob_url="https://grantflowstorage.blob.core.windows.net/invoices/inv_sample_switch.pdf",
        status="PENDING"
    )
    db.add_all([exp1, exp2, exp3])
    db.commit()

    # 5. Audit Log
    log_audit_trail(db, u_pi.user_id, "SYSTEM_INITIALIZED", "system", 1, "Demo database populated with grants and budget heads")
    db.commit()

    return {"status": "Successfully seeded demo dataset"}
