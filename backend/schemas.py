from datetime import date, datetime
from typing import Optional, List
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, EmailStr, Field

# --- Auth Schemas ---
class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4)

class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=4)
    role: str = Field(default="SCHOLAR", min_length=2, max_length=50)
    department: str = Field(default="General Research", min_length=2, max_length=100)

class UserUpdateProfile(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    department: Optional[str] = None

class RoleNameUpdate(BaseModel):
    role_email: EmailStr
    new_name: str = Field(..., min_length=2, max_length=150)
    department: Optional[str] = None

class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    full_name: str
    role: str
    department: str
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# --- Budget Head Schemas ---
class BudgetHeadBase(BaseModel):
    category_name: str
    allocated_amount: float = Field(..., ge=0)

class BudgetHeadOut(BudgetHeadBase):
    budget_head_id: int
    grant_id: int
    spent_amount: float
    remaining_balance: float
    utilization_percentage: float

    class Config:
        from_attributes = True

# --- Grant Schemas ---
class GrantCreate(BaseModel):
    grant_code: str = Field(..., min_length=3, max_length=50)
    title: str = Field(..., min_length=5, max_length=255)
    funding_agency: str = Field(..., min_length=2, max_length=150)
    total_sanctioned_amount: float = Field(..., gt=0)
    start_date: date
    end_date: date
    equipment_amount: float = Field(0.0, ge=0)
    consumables_amount: float = Field(0.0, ge=0)
    travel_amount: float = Field(0.0, ge=0)
    manpower_amount: float = Field(0.0, ge=0)

class GrantOut(BaseModel):
    grant_id: int
    grant_code: str
    title: str
    funding_agency: str
    pi_user_id: int
    pi_name: Optional[str] = None
    total_sanctioned_amount: float
    start_date: date
    end_date: date
    status: str
    created_at: datetime
    budget_heads: List[BudgetHeadOut] = []

    class Config:
        from_attributes = True

# --- Expense Schemas ---
class ExpenseCreate(BaseModel):
    budget_head_id: int
    amount: float = Field(..., gt=0)
    vendor_name: str = Field(..., min_length=2, max_length=150)
    description: str = Field(..., min_length=5)

class ExpenseAction(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    rejection_reason: Optional[str] = None

class ExpenseOut(BaseModel):
    expense_id: int
    budget_head_id: int
    category_name: Optional[str] = None
    grant_code: Optional[str] = None
    grant_title: Optional[str] = None
    requested_by_user_id: int
    requester_name: Optional[str] = None
    amount: float
    vendor_name: str
    description: str
    invoice_blob_url: Optional[str] = None
    status: str
    rejection_reason: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Audit & Analytics Schemas ---
class AuditLogOut(BaseModel):
    log_id: int
    actor_name: str
    action_type: str
    target_entity: str
    target_id: int
    details: Optional[str] = None
    ip_address: str
    timestamp: datetime

    class Config:
        from_attributes = True

class AnalyticsSummary(BaseModel):
    total_grants: int
    total_sanctioned: float
    total_spent: float
    total_remaining: float
    overall_utilization_rate: float
    pending_claims_count: int
    pending_claims_amount: float
    category_breakdown: List[dict]
    burn_rate_timeline: List[dict]
