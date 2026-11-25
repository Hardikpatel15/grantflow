from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models import User, Grant, BudgetHead, ExpenseRequest, ActivityAuditLog
from backend.schemas import AnalyticsSummary, AuditLogOut
from backend.auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["Analytics & Power BI"])

@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Computes key financial performance indicators (KPIs) for the dashboard
    and executive analytics view.
    """
    grants = db.query(Grant).all()
    total_grants = len(grants)
    total_sanctioned = sum(float(g.total_sanctioned_amount) for g in grants)

    budget_heads = db.query(BudgetHead).all()
    total_spent = sum(float(bh.spent_amount) for bh in budget_heads)
    total_remaining = max(0.0, total_sanctioned - total_spent)
    utilization_rate = round((total_spent / total_sanctioned * 100), 2) if total_sanctioned > 0 else 0.0

    # Pending claims
    pending_claims = db.query(ExpenseRequest).filter(ExpenseRequest.status == "PENDING").all()
    pending_count = len(pending_claims)
    pending_amount = sum(float(c.amount) for c in pending_claims)

    # Category breakdown (for Donut Chart)
    cat_data = {}
    for bh in budget_heads:
        cat = bh.category_name
        cat_data[cat] = cat_data.get(cat, {"allocated": 0.0, "spent": 0.0})
        cat_data[cat]["allocated"] += float(bh.allocated_amount)
        cat_data[cat]["spent"] += float(bh.spent_amount)

    category_breakdown = [
        {
            "category": k,
            "allocated": round(v["allocated"], 2),
            "spent": round(v["spent"], 2),
            "remaining": round(max(0.0, v["allocated"] - v["spent"]), 2)
        }
        for k, v in cat_data.items()
    ]

    # Timeline / burn rate
    approved_claims = db.query(ExpenseRequest).filter(ExpenseRequest.status == "APPROVED").order_by(ExpenseRequest.created_at.asc()).all()
    cumulative = 0.0
    burn_timeline = []
    for c in approved_claims:
        cumulative += float(c.amount)
        burn_timeline.append({
            "date": c.created_at.strftime("%Y-%m-%d"),
            "cumulative_spent": round(cumulative, 2),
            "vendor": c.vendor_name
        })

    return {
        "total_grants": total_grants,
        "total_sanctioned": round(total_sanctioned, 2),
        "total_spent": round(total_spent, 2),
        "total_remaining": round(total_remaining, 2),
        "overall_utilization_rate": utilization_rate,
        "pending_claims_count": pending_count,
        "pending_claims_amount": round(pending_amount, 2),
        "category_breakdown": category_breakdown,
        "burn_rate_timeline": burn_timeline
    }

@router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_trail(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Returns the immutable audit trail for security inspection.
    """
    logs = db.query(ActivityAuditLog).order_by(ActivityAuditLog.timestamp.desc()).limit(50).all()
    results = []
    for l in logs:
        actor_name = l.actor.full_name if l.actor else "System"
        results.append(AuditLogOut(
            log_id=l.log_id,
            actor_name=actor_name,
            action_type=l.action_type,
            target_entity=l.target_entity,
            target_id=l.target_id,
            details=l.details,
            ip_address=l.ip_address,
            timestamp=l.timestamp
        ))
    return results

@router.get("/powerbi-export")
def export_powerbi_dataset(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    DP-900 Analytics Export Endpoint.
    Returns normalized tabular records formatted for direct Microsoft Power BI
    or Excel Web Query connection.
    """
    records = []
    budget_heads = db.query(BudgetHead).all()

    for bh in budget_heads:
        grant = bh.grant
        pi = grant.pi_user if grant else None
        allocated = float(bh.allocated_amount)
        spent = float(bh.spent_amount)

        records.append({
            "GrantCode": grant.grant_code if grant else "N/A",
            "GrantTitle": grant.title if grant else "N/A",
            "FundingAgency": grant.funding_agency if grant else "N/A",
            "PrincipalInvestigator": pi.full_name if pi else "N/A",
            "Department": pi.department if pi else "N/A",
            "GrantStatus": grant.status if grant else "N/A",
            "StartDate": str(grant.start_date) if grant else "",
            "EndDate": str(grant.end_date) if grant else "",
            "BudgetCategory": bh.category_name,
            "AllocatedAmountINR": allocated,
            "SpentAmountINR": spent,
            "RemainingBalanceINR": max(0.0, allocated - spent),
            "UtilizationPercent": round((spent / allocated * 100), 2) if allocated > 0 else 0.0
        })

    return {
        "dataset_name": "GrantFlow_Relational_Analytics",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "record_count": len(records),
        "data": records
    }
