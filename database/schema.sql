-- ====================================================================
-- GrantFlow RDBMS Schema Specification (Strict Third Normal Form - 3NF)
-- Compatible with PostgreSQL & SQLite
-- ====================================================================

-- 1. Table: Users (Role-Based Access Control)
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SCHOLAR', 'PI', 'FINANCE_AUDITOR')),
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: Grants (Sponsored Research Projects)
CREATE TABLE IF NOT EXISTS grants (
    grant_id SERIAL PRIMARY KEY,
    grant_code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    funding_agency VARCHAR(150) NOT NULL,
    pi_user_id INT NOT NULL,
    total_sanctioned_amount NUMERIC(14, 2) NOT NULL CHECK (total_sanctioned_amount > 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'COMPLETED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_grants_pi FOREIGN KEY (pi_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT chk_grant_dates CHECK (end_date >= start_date)
);

-- 3. Table: BudgetHeads (Category-level allocations per grant)
CREATE TABLE IF NOT EXISTS budget_heads (
    budget_head_id SERIAL PRIMARY KEY,
    grant_id INT NOT NULL,
    category_name VARCHAR(100) NOT NULL CHECK (category_name IN ('EQUIPMENT', 'CONSUMABLES', 'TRAVEL', 'MANPOWER', 'CONTINGENCY')),
    allocated_amount NUMERIC(14, 2) NOT NULL CHECK (allocated_amount >= 0),
    spent_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (spent_amount >= 0),
    CONSTRAINT fk_budgetheads_grant FOREIGN KEY (grant_id) REFERENCES grants(grant_id) ON DELETE CASCADE,
    CONSTRAINT uq_grant_category UNIQUE (grant_id, category_name)
);

-- 4. Table: ExpenseRequests (Reimbursements and purchase invoices)
CREATE TABLE IF NOT EXISTS expense_requests (
    expense_id SERIAL PRIMARY KEY,
    budget_head_id INT NOT NULL,
    requested_by_user_id INT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    vendor_name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    invoice_blob_url VARCHAR(500),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    rejection_reason VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    CONSTRAINT fk_expense_budgethead FOREIGN KEY (budget_head_id) REFERENCES budget_heads(budget_head_id) ON DELETE RESTRICT,
    CONSTRAINT fk_expense_user FOREIGN KEY (requested_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- 5. Table: ActivityAuditLogs (Immutable Security & Governance Trail)
CREATE TABLE IF NOT EXISTS activity_audit_logs (
    log_id SERIAL PRIMARY KEY,
    actor_user_id INT NOT NULL,
    action_type VARCHAR(80) NOT NULL,
    target_entity VARCHAR(80) NOT NULL,
    target_id INT NOT NULL,
    details TEXT,
    ip_address VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ====================================================================
-- Performance Indexes (Optimizing Frequent Lookups & Foreign Keys)
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_grants_pi ON grants(pi_user_id);
CREATE INDEX IF NOT EXISTS idx_grants_code ON grants(grant_code);
CREATE INDEX IF NOT EXISTS idx_budgetheads_grant ON budget_heads(grant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_budgethead ON expense_requests(budget_head_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expense_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON activity_audit_logs(timestamp DESC);
