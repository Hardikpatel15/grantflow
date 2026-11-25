-- ====================================================================
-- GrantFlow RDBMS Advanced Features: Views, Triggers, and Transactions
-- Required for RDBMS Component (20 Marks)
-- ====================================================================

-- 1. Relational View: Real-Time Grant Budget Utilization
-- Aggregates data across Grants, Users, and BudgetHeads to compute remaining balances and percentages
CREATE OR REPLACE VIEW vw_grant_budget_utilization AS
SELECT 
    g.grant_id,
    g.grant_code,
    g.title AS grant_title,
    g.funding_agency,
    u.full_name AS principal_investigator,
    u.email AS pi_email,
    bh.budget_head_id,
    bh.category_name,
    bh.allocated_amount,
    bh.spent_amount,
    (bh.allocated_amount - bh.spent_amount) AS remaining_balance,
    CASE 
        WHEN bh.allocated_amount > 0 THEN 
            ROUND(((bh.spent_amount / bh.allocated_amount) * 100)::numeric, 2)
        ELSE 0.00
    END AS utilization_percentage,
    g.status AS grant_status,
    g.end_date AS expiry_date
FROM grants g
JOIN users u ON g.pi_user_id = u.user_id
JOIN budget_heads bh ON g.grant_id = bh.grant_id;


-- 2. Budget Ceiling Enforcement Function & Trigger (PostgreSQL)
-- Automatically prevents approval of expenses that would exceed the allocated budget ceiling
CREATE OR REPLACE FUNCTION fn_enforce_budget_ceiling()
RETURNS TRIGGER AS $$
DECLARE
    v_allocated NUMERIC(14, 2);
    v_spent NUMERIC(14, 2);
    v_grant_status VARCHAR(30);
BEGIN
    -- Only evaluate when an expense transitions to 'APPROVED'
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status != 'APPROVED') THEN
        
        -- Lock the budget head row to avoid race conditions
        SELECT bh.allocated_amount, bh.spent_amount, g.status
        INTO v_allocated, v_spent, v_grant_status
        FROM budget_heads bh
        JOIN grants g ON bh.grant_id = g.grant_id
        WHERE bh.budget_head_id = NEW.budget_head_id
        FOR UPDATE;

        -- Check if grant is active
        IF v_grant_status != 'ACTIVE' THEN
            RAISE EXCEPTION 'Grant is currently %! Expenses can only be approved on ACTIVE grants.', v_grant_status;
        END IF;

        -- Check budget ceiling
        IF (v_spent + NEW.amount) > v_allocated THEN
            RAISE EXCEPTION 'BUDGET CEILING EXCEEDED: Cannot approve expense of ₹%. Remaining balance for % is only ₹%.',
                NEW.amount, 
                (SELECT category_name FROM budget_heads WHERE budget_head_id = NEW.budget_head_id),
                (v_allocated - v_spent);
        END IF;

        -- Automatically increment spent_amount in budget_heads
        UPDATE budget_heads
        SET spent_amount = spent_amount + NEW.amount
        WHERE budget_head_id = NEW.budget_head_id;

        NEW.approved_at = CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_budget_ceiling ON expense_requests;
CREATE TRIGGER trg_enforce_budget_ceiling
BEFORE UPDATE OF status ON expense_requests
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_budget_ceiling();


-- 3. Stored Procedure: Atomic Grant Allocation
-- Sets up a new grant and allocates all budget heads within an atomic transaction
CREATE OR REPLACE PROCEDURE sp_create_grant_with_allocations(
    p_grant_code VARCHAR(50),
    p_title VARCHAR(255),
    p_agency VARCHAR(150),
    p_pi_id INT,
    p_total NUMERIC(14, 2),
    p_start DATE,
    p_end DATE,
    p_equipment NUMERIC(14, 2),
    p_consumables NUMERIC(14, 2),
    p_travel NUMERIC(14, 2),
    p_manpower NUMERIC(14, 2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_grant_id INT;
BEGIN
    -- Verify sum of budget categories matches total sanctioned amount
    IF (p_equipment + p_consumables + p_travel + p_manpower) > p_total THEN
        RAISE EXCEPTION 'Sum of category allocations exceeds total sanctioned grant amount!';
    END IF;

    -- Insert Grant
    INSERT INTO grants (grant_code, title, funding_agency, pi_user_id, total_sanctioned_amount, start_date, end_date, status)
    VALUES (p_grant_code, p_title, p_agency, p_pi_id, p_total, p_start, p_end, 'ACTIVE')
    RETURNING grant_id INTO v_new_grant_id;

    -- Insert standard budget heads
    INSERT INTO budget_heads (grant_id, category_name, allocated_amount, spent_amount) VALUES
    (v_new_grant_id, 'EQUIPMENT', p_equipment, 0.00),
    (v_new_grant_id, 'CONSUMABLES', p_consumables, 0.00),
    (v_new_grant_id, 'TRAVEL', p_travel, 0.00),
    (v_new_grant_id, 'MANPOWER', p_manpower, 0.00);

    -- Log transaction in Audit table
    INSERT INTO activity_audit_logs (actor_user_id, action_type, target_entity, target_id, details)
    VALUES (p_pi_id, 'GRANT_INITIALIZED', 'grants', v_new_grant_id, 'Grant and budget heads initialized atomically via stored procedure');
END;
$$;
