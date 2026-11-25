from typing import List
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, Grant, BudgetHead
from backend.schemas import GrantCreate, GrantOut, BudgetHeadOut
from backend.auth import get_current_user, require_roles, log_audit_trail

router = APIRouter(prefix="/api/grants", tags=["Grants"])

@router.get("", response_model=List[GrantOut])
def list_grants(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetches all registered research grants and computes real-time budget utilization."""
    grants = db.query(Grant).order_by(Grant.created_at.desc()).all()
    results = []

    for g in grants:
        heads_out = []
        for bh in g.budget_heads:
            allocated = float(bh.allocated_amount)
            spent = float(bh.spent_amount)
            rem = max(0.0, allocated - spent)
            util = round((spent / allocated * 100), 2) if allocated > 0 else 0.0

            heads_out.append(BudgetHeadOut(
                budget_head_id=bh.budget_head_id,
                grant_id=bh.grant_id,
                category_name=bh.category_name,
                allocated_amount=allocated,
                spent_amount=spent,
                remaining_balance=rem,
                utilization_percentage=util
            ))

        results.append(GrantOut(
            grant_id=g.grant_id,
            grant_code=g.grant_code,
            title=g.title,
            funding_agency=g.funding_agency,
            pi_user_id=g.pi_user_id,
            pi_name=g.pi_user.full_name if g.pi_user else "Unknown",
            total_sanctioned_amount=float(g.total_sanctioned_amount),
            start_date=g.start_date,
            end_date=g.end_date,
            status=g.status,
            created_at=g.created_at,
            budget_heads=heads_out
        ))

    return results

@router.post("", response_model=GrantOut, status_code=status.HTTP_201_CREATED)
def create_grant(
    grant_in: GrantCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["PI", "FINANCE_AUDITOR"]))
):
    """
    RDBMS Transaction: Initializes a new sanctioned research project and creates
    corresponding budget heads atomically.
    """
    # 1. Check for duplicate grant code
    existing = db.query(Grant).filter(Grant.grant_code == grant_in.grant_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Grant code '{grant_in.grant_code}' is already registered."
        )

    # 2. Verify budget allocations do not exceed sanctioned total
    alloc_sum = (
        grant_in.equipment_amount + grant_in.consumables_amount + 
        grant_in.travel_amount + grant_in.manpower_amount
    )
    if alloc_sum > grant_in.total_sanctioned_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total category allocation (₹{alloc_sum:,.2f}) exceeds sanctioned grant amount (₹{grant_in.total_sanctioned_amount:,.2f})."
        )

    try:
        # Atomic Transaction
        new_grant = Grant(
            grant_code=grant_in.grant_code,
            title=grant_in.title,
            funding_agency=grant_in.funding_agency,
            pi_user_id=current_user.user_id,
            total_sanctioned_amount=grant_in.total_sanctioned_amount,
            start_date=grant_in.start_date,
            end_date=grant_in.end_date,
            status="ACTIVE"
        )
        db.add(new_grant)
        db.flush()  # Populates new_grant.grant_id

        # Allocate budget heads
        categories = [
            ("EQUIPMENT", grant_in.equipment_amount),
            ("CONSUMABLES", grant_in.consumables_amount),
            ("TRAVEL", grant_in.travel_amount),
            ("MANPOWER", grant_in.manpower_amount),
        ]
        
        heads_out = []
        for cat_name, amt in categories:
            bh = BudgetHead(
                grant_id=new_grant.grant_id,
                category_name=cat_name,
                allocated_amount=amt,
                spent_amount=0.00
            )
            db.add(bh)
            db.flush()
            heads_out.append(BudgetHeadOut(
                budget_head_id=bh.budget_head_id,
                grant_id=bh.grant_id,
                category_name=bh.category_name,
                allocated_amount=float(amt),
                spent_amount=0.00,
                remaining_balance=float(amt),
                utilization_percentage=0.00
            ))

        client_ip = request.client.host if request.client else "127.0.0.1"
        log_audit_trail(
            db, current_user.user_id, "GRANT_CREATED", "grants", new_grant.grant_id,
            f"Code: {new_grant.grant_code}, Total: ₹{new_grant.total_sanctioned_amount:,.2f}",
            client_ip
        )
        db.commit()

        return GrantOut(
            grant_id=new_grant.grant_id,
            grant_code=new_grant.grant_code,
            title=new_grant.title,
            funding_agency=new_grant.funding_agency,
            pi_user_id=new_grant.pi_user_id,
            pi_name=current_user.full_name,
            total_sanctioned_amount=float(new_grant.total_sanctioned_amount),
            start_date=new_grant.start_date,
            end_date=new_grant.end_date,
            status=new_grant.status,
            created_at=new_grant.created_at,
            budget_heads=heads_out
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transaction failed while creating grant: {str(e)}"
        )
