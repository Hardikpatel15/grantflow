from typing import List, Optional
from datetime import datetime, timezone
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, Grant, BudgetHead, ExpenseRequest
from backend.schemas import ExpenseOut, ExpenseAction
from backend.auth import get_current_user, require_roles, log_audit_trail
from backend.storage import upload_invoice_evidence

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])

@router.get("", response_model=List[ExpenseOut])
def list_expenses(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all expense requests with related grant and requester metadata."""
    query = db.query(ExpenseRequest).order_by(ExpenseRequest.created_at.desc())
    if status_filter:
        query = query.filter(ExpenseRequest.status == status_filter.upper())

    expenses = query.all()
    results = []

    for exp in expenses:
        bh = exp.budget_head
        grant = bh.grant if bh else None

        results.append(ExpenseOut(
            expense_id=exp.expense_id,
            budget_head_id=exp.budget_head_id,
            category_name=bh.category_name if bh else "N/A",
            grant_code=grant.grant_code if grant else "N/A",
            grant_title=grant.title if grant else "N/A",
            requested_by_user_id=exp.requested_by_user_id,
            requester_name=exp.requester.full_name if exp.requester else "Unknown",
            amount=float(exp.amount),
            vendor_name=exp.vendor_name,
            description=exp.description,
            invoice_blob_url=exp.invoice_blob_url,
            status=exp.status,
            rejection_reason=exp.rejection_reason,
            created_at=exp.created_at,
            approved_at=exp.approved_at
        ))

    return results

@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
async def submit_expense(
    budget_head_id: int = Form(...),
    amount: float = Form(...),
    vendor_name: str = Form(...),
    description: str = Form(...),
    invoice_file: Optional[UploadFile] = File(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits a reimbursement or procurement expense claim.
    Uploads invoice receipt to Azure Blob Storage (or local storage fallback).
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than zero.")

    # 1. Verify budget head exists
    bh = db.query(BudgetHead).filter(BudgetHead.budget_head_id == budget_head_id).first()
    if not bh:
        raise HTTPException(status_code=404, detail="Selected Budget Head was not found.")

    # 2. Verify parent grant is ACTIVE
    grant = bh.grant
    if grant.status != "ACTIVE":
        raise HTTPException(
            status_code=400, 
            detail=f"Grant '{grant.grant_code}' is {grant.status}. Cannot submit claims on inactive projects."
        )

    # 3. Handle file upload (DP-900 Unstructured Store)
    blob_url = None
    if invoice_file and invoice_file.filename:
        blob_url = await upload_invoice_evidence(invoice_file)

    # 4. Create expense record
    new_expense = ExpenseRequest(
        budget_head_id=budget_head_id,
        requested_by_user_id=current_user.user_id,
        amount=amount,
        vendor_name=vendor_name,
        description=description,
        invoice_blob_url=blob_url,
        status="PENDING"
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    # 5. Audit Log
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    log_audit_trail(
        db, current_user.user_id, "CLAIM_SUBMITTED", "expense_requests", new_expense.expense_id,
        f"Amount: ₹{amount:,.2f}, Vendor: {vendor_name}, Category: {bh.category_name}",
        client_ip
    )

    return ExpenseOut(
        expense_id=new_expense.expense_id,
        budget_head_id=new_expense.budget_head_id,
        category_name=bh.category_name,
        grant_code=grant.grant_code,
        grant_title=grant.title,
        requested_by_user_id=current_user.user_id,
        requester_name=current_user.full_name,
        amount=float(new_expense.amount),
        vendor_name=new_expense.vendor_name,
        description=new_expense.description,
        invoice_blob_url=new_expense.invoice_blob_url,
        status=new_expense.status,
        created_at=new_expense.created_at
    )

@router.post("/{expense_id}/action", response_model=ExpenseOut)
def review_expense(
    expense_id: int,
    action_in: ExpenseAction,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["PI", "FINANCE_AUDITOR"]))
):
    """
    RDBMS Core Logic & Budget Ceiling Enforcement:
    Approves or Rejects a claim. If approved, guarantees:
    allocated_amount >= spent_amount + claim_amount
    Raises an error if budget ceiling would be breached.
    """
    claim = db.query(ExpenseRequest).filter(ExpenseRequest.expense_id == expense_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Expense claim not found.")

    if claim.status != "PENDING":
        raise HTTPException(
            status_code=400, 
            detail=f"This claim has already been evaluated as '{claim.status}'."
        )

    bh = claim.budget_head
    grant = bh.grant
    client_ip = request.client.host if request.client else "127.0.0.1"

    if action_in.action == "REJECT":
        claim.status = "REJECTED"
        claim.rejection_reason = action_in.rejection_reason or "Rejected by reviewer"

        log_audit_trail(
            db, current_user.user_id, "CLAIM_REJECTED", "expense_requests", claim.expense_id,
            f"Reason: {claim.rejection_reason}", client_ip
        )
        db.commit()

        return ExpenseOut(
            expense_id=claim.expense_id,
            budget_head_id=claim.budget_head_id,
            category_name=bh.category_name,
            grant_code=grant.grant_code,
            grant_title=grant.title,
            requested_by_user_id=claim.requested_by_user_id,
            requester_name=claim.requester.full_name if claim.requester else "Unknown",
            amount=float(claim.amount),
            vendor_name=claim.vendor_name,
            description=claim.description,
            invoice_blob_url=claim.invoice_blob_url,
            status=claim.status,
            rejection_reason=claim.rejection_reason,
            created_at=claim.created_at
        )

    # ACTION == 'APPROVE': Execute strict budget ceiling checks
    # 1. Verify Grant is active
    if grant.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve: Grant '{grant.grant_code}' is {grant.status}."
        )

    # 2. Check Budget Ceiling (The RDBMS Rule)
    allocated = float(bh.allocated_amount)
    spent = float(bh.spent_amount)
    remaining = allocated - spent
    claim_amount = float(claim.amount)

    if (spent + claim_amount) > allocated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"BUDGET CEILING EXCEEDED! "
                f"Cannot approve claim of ₹{claim_amount:,.2f}. "
                f"Remaining balance for category '{bh.category_name}' is only ₹{remaining:,.2f}."
            )
        )

    try:
        # Atomic Update
        bh.spent_amount = bh.spent_amount + claim.amount
        claim.status = "APPROVED"
        claim.approved_at = datetime.now(timezone.utc)
        claim.rejection_reason = None
        db.commit()

        log_audit_trail(
            db, current_user.user_id, "CLAIM_APPROVED", "expense_requests", claim.expense_id,
            f"Approved ₹{claim_amount:,.2f} on {bh.category_name}. New category spent: ₹{float(bh.spent_amount):,.2f}",
            client_ip
        )
        db.commit()

        return ExpenseOut(
            expense_id=claim.expense_id,
            budget_head_id=claim.budget_head_id,
            category_name=bh.category_name,
            grant_code=grant.grant_code,
            grant_title=grant.title,
            requested_by_user_id=claim.requested_by_user_id,
            requester_name=claim.requester.full_name if claim.requester else "Unknown",
            amount=float(claim.amount),
            vendor_name=claim.vendor_name,
            description=claim.description,
            invoice_blob_url=claim.invoice_blob_url,
            status=claim.status,
            created_at=claim.created_at,
            approved_at=claim.approved_at
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Approval transaction failed: {str(e)}")
