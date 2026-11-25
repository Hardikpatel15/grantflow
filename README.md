# GrantFlow — University Research Grant Budget & Expense Audit Portal

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20SQLite-4169E1.svg)](https://www.postgresql.org/)
[![Cloud](https://img.shields.io/badge/Cloud-Azure%20Blob%20Storage-0089D6.svg)](https://azure.microsoft.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**GrantFlow** is a cloud-native, full-stack management and audit platform engineered for university research grants. It enables **Students / Research Scholars**, **Principal Investigators (PIs)**, **Finance Auditors**, and **University Deans** to manage sanctioned research grants, enforce strict category-level budget ceilings, upload digital invoice evidence, and visualize fund burn-rates in real time.

> 📘 **Want the full technical & academic breakdown?** Read [PROJECT_EXPLANATION.md](PROJECT_EXPLANATION.md) for a concise explanation of the use case, system design, DBMS/3NF schema, Azure DP-900 data concepts, cybersecurity controls, and Python stack.

---

## ✨ Key Features

- **Modernist Gateway Landing Page (`/`):** Choreographed entrance animations with architectural curtains and SVG logo reveal before transitioning to the portal (`/portal`).
- **Role-Based Access & Self-Registration:**
  - Instant 1-click demo login for **Student Scholar**, **PI**, **Finance Auditor**, and **University Dean**.
  - **Register Yourself** modal tab allowing any user to create an account as a Student/Scholar, University Dean, PI, Finance Auditor, or a custom role.
  - Live **Edit Role Name & Department** modal and persistent **Floating Role Switcher Dock** while scrolling.
- **Interactive Analytics & Graph Selector:**
  - Real-time KPI cards (Total Sanctioned, Total Spent, Remaining Balance, Pending Review).
  - Switch smoothly between **All Graphs**, **Allocation Bar**, **Category Doughnut**, and **Burn-Rate Line** views.
- **Strict Budget Ceiling Enforcement:** Pessimistic row-level locking (`SELECT FOR UPDATE`) + SQL ceiling triggers prevent overspending across budget heads.
- **Immutable Audit Trail & Power BI Feed:** Logs every login, registration, grant, and approval event, and exposes `/api/analytics/powerbi-export`.

---

## 👥 Pre-Configured Demo Accounts

| Role | Email | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **Student / Scholar** | `scholar@university.edu` | `scholar123` | View grants, submit expense claims, upload invoice receipts. |
| **Principal Investigator (PI)** | `pi@university.edu` | `pi123` | Create grants, allocate budget heads, approve/reject claims. |
| **Finance Auditor** | `auditor@university.edu` | `auditor123` | Final financial review, inspect audit trail, export Power BI data. |
| **University Dean** | `dean@university.edu` | `dean123` | Executive research grant oversight, approvals, and institutional auditing. |

---

## 🚀 Quick Start (Run Locally)

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/grantflow.git
cd grantflow
```

### 2. Create a Virtual Environment & Install Dependencies
```bash
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux / macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
```
*(By default, `.env` uses a local `grantflow.db` SQLite database and local `/uploads` folder so the app runs immediately without needing external cloud keys. Update `DATABASE_URL` and `AZURE_STORAGE_CONNECTION_STRING` in `.env` for Azure PostgreSQL + Azure Blob Storage.)*

### 4. Start the Application
```bash
python run.py
```
- **Landing Page:** `http://localhost:8000/`
- **Main Portal:** `http://localhost:8000/portal`
- **API Docs (Swagger):** `http://localhost:8000/docs`
- **Power BI Feed:** `http://localhost:8000/api/analytics/powerbi-export`

---

## 📁 Repository Structure

```text
grantflow/
├── README.md                   # Setup guide, features, and demo accounts
├── PROJECT_EXPLANATION.md      # Use case, System Design, DBMS, Azure, Cybersecurity & Python
├── LICENSE                     # MIT License
├── requirements.txt            # Python dependencies
├── .gitignore                  # Excludes .env, venv/, *.db, uploads/, __pycache__/
├── .env.example                # Environment variable template
├── run.py                      # Application entry runner
├── database/
│   ├── schema.sql              # 3NF DDL schema with constraints & indexes
│   ├── views_and_triggers.sql  # SQL View & ceiling enforcement trigger
│   └── seed_data.sql           # Initial demo grants, users, and audit logs
├── backend/
│   ├── main.py                 # FastAPI app, CORS, static mounts & routes
│   ├── config.py               # Pydantic settings loader
│   ├── database.py             # SQLAlchemy engine & session management
│   ├── models.py               # ORM models (Users, Grants, BudgetHeads, Expenses, AuditLogs)
│   ├── schemas.py              # Pydantic v2 validation schemas
│   ├── auth.py                 # Bcrypt hashing, JWT tokens, RBAC & audit logger
│   ├── storage.py              # Azure Blob Storage service with local fallback
│   └── routers/
│       ├── auth_router.py      # Login, Register, Profile & Role Name endpoints
│       ├── grant_router.py     # Grant & budget head endpoints
│       ├── expense_router.py   # Claim submission & ceiling-checked approvals
│       └── analytics_router.py # KPIs, burn-rate timeline, audit logs & Power BI feed
└── frontend/
    ├── landing.html            # Modernist gateway landing page
    ├── index.html              # Continuous-scroll Research & Audit Portal
    ├── css/styles.css          # Design tokens, smooth animations & floating dock
    └── js/app.js               # SPA logic, Chart.js graph selector & API integration
```
