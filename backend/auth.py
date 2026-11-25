from datetime import datetime, timedelta, timezone
from typing import Optional, List
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from backend.config import settings
from backend.database import get_db
from backend.models import User, ActivityAuditLog

security_bearer = HTTPBearer(auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a raw password against stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Hashes a password using standard bcrypt with salt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    """Authenticates the Bearer JWT token from the Authorization header."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise credentials_exception

    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

def require_roles(allowed_roles: List[str]):
    """Role-Based Access Control (RBAC) dependency factory."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        is_dean_privileged = current_user.role == "DEAN" and (
            "FINANCE_AUDITOR" in allowed_roles or "PI" in allowed_roles
        )
        if current_user.role not in allowed_roles and not is_dean_privileged:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Role '{current_user.role}' lacks permission for this action. Required: {allowed_roles}"
            )
        return current_user
    return role_checker

def log_audit_trail(
    db: Session,
    actor_id: int,
    action_type: str,
    target_entity: str,
    target_id: int,
    details: Optional[str] = None,
    ip_address: str = "127.0.0.1"
):
    """Inserts an immutable audit log record for security compliance.
    NOTE: Does NOT commit — callers control the transaction boundary.
    """
    log_entry = ActivityAuditLog(
        actor_user_id=actor_id,
        action_type=action_type,
        target_entity=target_entity,
        target_id=target_id,
        details=details,
        ip_address=ip_address,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log_entry)
