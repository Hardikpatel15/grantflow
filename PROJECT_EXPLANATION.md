# GrantFlow — Project Explanation & Technical Overview

## 1. Use Case & Why It Is Required

### The Problem
Universities and research institutions manage dozens of multi-year research grants funded by external agencies (such as DST, SERB, NSF, or corporate sponsors). Each grant is divided into strict **budget heads** (e.g., *Equipment*, *Travel*, *Consumables*, *Manpower*). In traditional manual or spreadsheet-based workflows:
- **Budget Overruns & Race Conditions:** Multiple scholars under the same grant submit purchase claims simultaneously, risking spending beyond a category's sanctioned ceiling.
- **Disconnected Invoice Evidence:** Scanned bills and PDF receipts are emailed or stored on personal drives, making audits slow and error-prone.
- **Lack of Accountability:** Without an immutable log, it is difficult to verify *who* submitted, approved, or rejected a claim and *when*.
- **Fragmented Role Workflows:** Students/Scholars, Principal Investigators (PIs), Finance Auditors, and University Deans need tailored permissions rather than a single shared spreadsheet.

### How GrantFlow Solves It
**GrantFlow** is a centralized, role-based **University Research Grant & Expense Audit Portal** that:
1. Enforces strict **category-level budget ceilings** automatically at both the application and database levels.
2. Stores **structured financial records** separately from **unstructured invoice receipts** (PDF/images).
3. Provides real-time **KPIs, burn-rate graphs, and Power BI analytics feeds** for Deans and Auditors.
4. Records every login, registration, grant creation, and expense decision in an **immutable audit trail**.

---

## 2. System Design

### Architecture
GrantFlow follows a **3-tier layered client-server architecture**:
- **Presentation Layer (`frontend/`):** A responsive Single-Page Application (HTML5, Tailwind CSS, Vanilla JS, Chart.js) paired with a minimalist gateway landing page (`/` → `/portal`).
- **Application & API Layer (`backend/`):** A stateless **FastAPI** REST API organized into modular routers (`auth_router`, `grant_router`, `expense_router`, `analytics_router`), using **Pydantic v2** schemas for strict request/response validation.
- **Data & Storage Layer (`database/` & `backend/storage.py`):** Relational database (SQLite locally / Azure PostgreSQL in production) + Object storage (Azure Blob Storage with local `/uploads` fallback).

### Key Concurrency Trade-Off: Pessimistic vs. Optimistic Locking
When two researchers or approvers act on the same budget head at the same time, **optimistic concurrency** can fail late or allow silent overspending if not retried properly. GrantFlow uses **pessimistic row-level locking (`SELECT ... FOR UPDATE`)** during expense approval so that only one transaction can evaluate and deduct from a budget head's remaining balance at a time, guaranteeing zero ceiling breaches.

### Role-Based Access Control (RBAC)
Users can sign in via pre-configured demo roles or self-register under their own role:
- **Student / Research Scholar (`SCHOLAR`):** Views grants, submits expense claims, uploads invoice receipts.
- **Principal Investigator (`PI`):** Creates grants, allocates budget heads, approves/rejects scholar claims.
- **Finance Auditor (`FINANCE_AUDITOR`):** Inspects audit trails, reviews claims, monitors burn-rates, exports Power BI data.
- **University Dean (`DEAN`):** Executive oversight with full grant creation, approval, and audit permissions.

---

## 3. Database Management System (DBMS / RDBMS)

GrantFlow uses a **strict 3rd Normal Form (3NF)** relational schema across **5 core tables** (`database/schema.sql`):
1. `users` — User credentials, role, and department.
2. `grants` — Sanctioned research projects linked to a PI (`pi_user_id` FK).
3. `budget_heads` — Category-wise budget allocations per grant (`grant_id` FK), enforcing `spent_amount <= allocated_amount`.
4. `expense_requests` — Individual purchase claims linked to a budget head and requester, storing the invoice URL and approval status.
5. `activity_audit_logs` — Append-only audit trail linked to the acting user.

### Relational Features Used
- **SQL View (`vw_grant_budget_utilization`):** Computes real-time remaining balance and utilization percentage across grants and budget heads.
- **SQL Trigger (`trg_enforce_budget_ceiling`):** Database-level safeguard (`database/views_and_triggers.sql`) that blocks an approval if `spent_amount + claim_amount > allocated_amount`.
- **ACID Transactions:** Expense approvals, budget head deductions, and audit log inserts execute inside atomic `BEGIN ... COMMIT` blocks with automatic rollback on failure.
- **B-Tree Indexes:** Placed on high-frequency lookup columns (`grant_code`, `status`, `email`, foreign keys) for fast $O(\log n)$ query performance.

---

## 4. Microsoft Azure & Cloud Data Concepts (DP-900)

GrantFlow maps directly to core cloud data engineering patterns:
- **Structured Data → Azure Database for PostgreSQL (Flexible Server):** Transactional 3NF tables (`Users`, `Grants`, `BudgetHeads`, `ExpenseRequests`). Configured seamlessly via `DATABASE_URL` in `.env` (defaulting to SQLite locally for zero-config execution).
- **Unstructured Data → Azure Blob Storage:** Uploaded vendor invoices (PDF, PNG, JPG) are stored in an `invoices` blob container (`backend/storage.py`), with an automatic local filesystem fallback (`/uploads`) when running offline.
- **Semi-Structured Data → JSON Audit & API Payloads:** Audit metadata, REST payloads, and analytics summaries use structured JSON.
- **Business Intelligence → Power BI Integration:** A dedicated `/api/analytics/powerbi-export` endpoint exposes flattened, BI-ready utilization data for **Power BI Desktop** Web Data Connectors.

---

## 5. Cybersecurity

Security controls are built into every layer of the application:
- **Stateless JWT Authentication (`python-jose`):** Signed Bearer tokens (`HS256`) with configurable expiration (`JWT_EXPIRE_MINUTES`) authenticate every API call without server-side session state.
- **Salted Password Hashing (`passlib` + `bcrypt`):** Passwords are never stored in plaintext; every password is salted and hashed before persistence.
- **Role Enforcement (`require_roles`):** FastAPI dependency guards verify the user's JWT role before allowing grant creation, claim approval, or audit access.
- **Zero Secret Leakage:** Database URLs, JWT secret keys, and Azure Storage connection strings are isolated in `.env` and excluded from Git via `.gitignore` (only `.env.example` is committed).
- **SQL Injection & Input Validation:** All queries use **SQLAlchemy ORM** parameterized bindings (eliminating raw SQL string interpolation), and **Pydantic v2** validates types, email formats, string lengths, and positive monetary amounts.
- **Immutable Audit Logging (`ActivityAuditLogs`):** Every login, registration, grant initialization, and approval/rejection records `actor_id`, `action_type`, `target_entity`, `details`, `ip_address`, and `timestamp`.

---

## 6. How Python Powers GrantFlow

Python 3.10+ serves as the backbone of the backend:
- **FastAPI & Uvicorn:** High-performance ASGI web framework providing async request handling, automatic OpenAPI/Swagger documentation (`/docs`), and static frontend serving.
- **SQLAlchemy 2.0 ORM:** Maps Python classes (`backend/models.py`) to relational tables and handles `with_for_update()` row locking and atomic sessions.
- **Pydantic v2 & `pydantic-settings`:** Enforces strict type safety for API contracts (`backend/schemas.py`) and loads `.env` configuration (`backend/config.py`).
- **`python-multipart` & `aiofiles`:** Handles asynchronous multipart invoice file uploads (`backend/storage.py`).
- **`passlib` / `bcrypt` & `python-jose`:** Implements cryptographic password hashing and JWT verification (`backend/auth.py`).
