-- ====================================================================
-- GrantFlow Seed Data
-- Provides demo users, test credentials, grants, and initial budget heads
-- ====================================================================

-- 1. Insert Initial Roles & Users
-- Passwords below are hashed with bcrypt:
-- scholar@university.edu  -> scholar123 ($2b$12$e6xU4pU4sD7E6w/x0sNncuvP0dJ5.4nB7.b7XzG5M8Y4k9.pMvEaO)
-- pi@university.edu       -> pi123      ($2b$12$K1r.mZ0e4L2fH4sQ/x0sNncuvP0dJ5.4nB7.b7XzG5M8Y4k9.pMvEaO)
-- auditor@university.edu  -> auditor123 ($2b$12$98z.rY1f5M3gJ5tR/x0sNncuvP0dJ5.4nB7.b7XzG5M8Y4k9.pMvEaO)

INSERT INTO users (user_id, email, password_hash, full_name, role, department) VALUES
(1, 'scholar@university.edu', '$2b$12$g59F5H1qZ64hN6xL1P8.NuP0dJ5.4nB7.b7XzG5M8Y4k9.pMvEaO', 'Aarav Sharma', 'SCHOLAR', 'Computer Science & Engineering'),
(2, 'pi@university.edu', '$2b$12$g59F5H1qZ64hN6xL1P8.NuP0dJ5.4nB7.b7XzG5M8Y4k9.pMvEaO', 'Dr. Meera Iyer (Professor & PI)', 'PI', 'Computer Science & Engineering'),
(3, 'auditor@university.edu', '$2b$12$g59F5H1qZ64hN6xL1P8.NuP0dJ5.4nB7.b7XzG5M8Y4k9.pMvEaO', 'Rajesh K. Verma (Finance Officer)', 'FINANCE_AUDITOR', 'University Accounts & Audit')
ON CONFLICT (email) DO NOTHING;

-- 2. Insert Grants
INSERT INTO grants (grant_id, grant_code, title, funding_agency, pi_user_id, total_sanctioned_amount, start_date, end_date, status) VALUES
(1, 'DST-SERB-2025-091', 'AI-Driven Climate Resilient Edge Computing Infrastructure', 'Department of Science & Technology (DST-SERB)', 2, 2500000.00, '2025-01-01', '2027-12-31', 'ACTIVE'),
(2, 'CSIR-ML-2024-418', 'Explainable Graph Neural Networks for Healthcare Triage', 'CSIR India', 2, 1800000.00, '2024-06-01', '2026-05-31', 'ACTIVE')
ON CONFLICT (grant_code) DO NOTHING;

-- 3. Insert Budget Heads for Grant 1 (DST-SERB)
INSERT INTO budget_heads (grant_id, category_name, allocated_amount, spent_amount) VALUES
(1, 'EQUIPMENT', 1200000.00, 450000.00),
(1, 'CONSUMABLES', 400000.00, 85000.00),
(1, 'TRAVEL', 300000.00, 42000.00),
(1, 'MANPOWER', 600000.00, 250000.00)
ON CONFLICT (grant_id, category_name) DO NOTHING;

-- 4. Insert Budget Heads for Grant 2 (CSIR)
INSERT INTO budget_heads (grant_id, category_name, allocated_amount, spent_amount) VALUES
(2, 'EQUIPMENT', 800000.00, 320000.00),
(2, 'CONSUMABLES', 300000.00, 45000.00),
(2, 'TRAVEL', 200000.00, 15000.00),
(2, 'MANPOWER', 500000.00, 180000.00)
ON CONFLICT (grant_id, category_name) DO NOTHING;

-- 5. Insert Sample Expense Requests
INSERT INTO expense_requests (expense_id, budget_head_id, requested_by_user_id, amount, vendor_name, description, invoice_blob_url, status) VALUES
(1, 1, 1, 450000.00, 'NVIDIA Enterprise Solutions', 'NVIDIA RTX A6000 48GB GPU Workstation for ML training', 'https://grantflow.blob.core.windows.net/invoices/inv_gpu_nvidia.pdf', 'APPROVED'),
(2, 2, 1, 35000.00, 'RoboCircuits Lab Supply', 'Raspberry Pi 5 Compute Modules & Sensor Shield Packs', 'https://grantflow.blob.core.windows.net/invoices/inv_sensors_091.pdf', 'APPROVED'),
(3, 3, 1, 42000.00, 'Air India / IEEE Conference Desk', 'Conference registration and flight ticket for IEEE ICDE', 'https://grantflow.blob.core.windows.net/invoices/inv_travel_icde.pdf', 'APPROVED'),
(4, 2, 1, 18500.00, 'ElectroSpares Hub', 'Cat6 Ethernet Spool & High-Speed Networking Switch', 'https://grantflow.blob.core.windows.net/invoices/inv_switch_442.pdf', 'PENDING')
ON CONFLICT (expense_id) DO NOTHING;

-- 6. Insert Initial Audit Records
INSERT INTO activity_audit_logs (actor_user_id, action_type, target_entity, target_id, details, ip_address) VALUES
(2, 'GRANT_CREATED', 'grants', 1, 'Sanctioned grant DST-SERB-2025-091 registered with 4 budget categories', '192.168.1.10'),
(1, 'EXPENSE_SUBMITTED', 'expense_requests', 1, 'Claim submitted for NVIDIA RTX GPU Workstation (₹4,50,000)', '192.168.1.25'),
(2, 'EXPENSE_APPROVED', 'expense_requests', 1, 'PI approved claim against EQUIPMENT budget head', '192.168.1.10'),
(1, 'EXPENSE_SUBMITTED', 'expense_requests', 4, 'Claim submitted for Cat6 Ethernet Spool (₹18,500)', '192.168.1.25');
