from datetime import datetime, timezone
# pyrefly: ignore [missing-import]
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Date, DateTime, 
    ForeignKey, CheckConstraint, UniqueConstraint
)
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(String(50), nullable=False)  # 'SCHOLAR', 'PI', 'FINANCE_AUDITOR'
    department = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    grants = relationship("Grant", back_populates="pi_user")
    expense_requests = relationship("ExpenseRequest", back_populates="requester")
    audit_logs = relationship("ActivityAuditLog", back_populates="actor")


class Grant(Base):
    __tablename__ = "grants"

    grant_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    grant_code = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    funding_agency = Column(String(150), nullable=False)
    pi_user_id = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    total_sanctioned_amount = Column(Numeric(14, 2), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(30), default="ACTIVE", nullable=False)  # 'ACTIVE', 'FROZEN', 'COMPLETED'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Constraints
    __table_args__ = (
        CheckConstraint("total_sanctioned_amount > 0", name="chk_grant_amount"),
    )

    # Relationships
    pi_user = relationship("User", back_populates="grants")
    budget_heads = relationship("BudgetHead", back_populates="grant", cascade="all, delete-orphan")


class BudgetHead(Base):
    __tablename__ = "budget_heads"

    budget_head_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    grant_id = Column(Integer, ForeignKey("grants.grant_id", ondelete="CASCADE"), nullable=False, index=True)
    category_name = Column(String(100), nullable=False)  # 'EQUIPMENT', 'CONSUMABLES', 'TRAVEL', 'MANPOWER', 'CONTINGENCY'
    allocated_amount = Column(Numeric(14, 2), nullable=False)
    spent_amount = Column(Numeric(14, 2), default=0.00, nullable=False)

    # Constraints
    __table_args__ = (
        UniqueConstraint("grant_id", "category_name", name="uq_grant_category"),
        CheckConstraint("allocated_amount >= 0", name="chk_allocated_non_negative"),
        CheckConstraint("spent_amount >= 0", name="chk_spent_non_negative"),
    )

    # Relationships
    grant = relationship("Grant", back_populates="budget_heads")
    expenses = relationship("ExpenseRequest", back_populates="budget_head")


class ExpenseRequest(Base):
    __tablename__ = "expense_requests"

    expense_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    budget_head_id = Column(Integer, ForeignKey("budget_heads.budget_head_id", ondelete="RESTRICT"), nullable=False, index=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    vendor_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    invoice_blob_url = Column(String(500), nullable=True)
    status = Column(String(30), default="PENDING", nullable=False, index=True)  # 'PENDING', 'APPROVED', 'REJECTED'
    rejection_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    approved_at = Column(DateTime, nullable=True)

    # Relationships
    budget_head = relationship("BudgetHead", back_populates="expenses")
    requester = relationship("User", back_populates="expense_requests")


class ActivityAuditLog(Base):
    __tablename__ = "activity_audit_logs"

    log_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    actor_user_id = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    action_type = Column(String(80), nullable=False)  # e.g., 'LOGIN', 'CLAIM_SUBMITTED', 'CLAIM_APPROVED'
    target_entity = Column(String(80), nullable=False)
    target_id = Column(Integer, nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), default="127.0.0.1", nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    actor = relationship("User", back_populates="audit_logs")
