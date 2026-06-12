-- =========================================================================
-- CNIT Official Website - Core CRM & Financial ERP Database Schema Migration
-- =========================================================================
-- This script contains all necessary table definitions, constraints, triggers, 
-- reporting views, RPCs, and RLS policies for the integrated ERP flow:
-- Leads > Quotations > Agreements > Clients > Projects > Invoices > Transactions > Salary Sheets
-- =========================================================================

-- ==========================================
-- 1. ENUMS AND CUSTOM TYPES
-- ==========================================

-- User role enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('super_admin', 'project_manager', 'staff', 'client');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Currency representation
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_code') THEN
        CREATE TYPE currency_code AS ENUM ('BDT', 'USD');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Invoice lifecycle stages
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Quotation lifecycle stages
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
        CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agreement contract status
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agreement_status') THEN
        CREATE TYPE agreement_status AS ENUM ('draft', 'active', 'completed', 'terminated');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Centralized ledger transaction modes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'investment', 'founder_repayment');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Salary sheet processing stages
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'salary_sheet_status') THEN
        CREATE TYPE salary_sheet_status AS ENUM ('draft', 'approved', 'paid');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;



-- ==========================================
-- 1.1 CUSTOM DATABASE HELPER FUNCTIONS
-- ==========================================

-- Function: Check if user is staff
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role::text != 'client'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get client ID from profile
CREATE OR REPLACE FUNCTION public.get_client_id(_user_id uuid)
RETURNS uuid AS $$
DECLARE
    cid uuid;
BEGIN
    SELECT client_id INTO cid FROM public.profiles WHERE id = _user_id;
    RETURN cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role::text = _role::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 2. CRM & QUOTATIONS TABLES
-- ==========================================

-- Quotes Table (Client-facing proposals)
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    number VARCHAR NOT NULL UNIQUE,
    title VARCHAR NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    status quote_status NOT NULL DEFAULT 'draft',
    issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE CHECK (valid_until >= issued_at),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    currency currency_code NOT NULL DEFAULT 'BDT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items inside Quotes
CREATE TABLE IF NOT EXISTS quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    amount NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- 3. AGREEMENTS & CONTRACTS
-- ==========================================

-- Agreements Table (Core financial terms for client retention/contracts)
CREATE TABLE IF NOT EXISTS agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR NOT NULL,
    status agreement_status NOT NULL DEFAULT 'draft',
    setup_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (setup_fee >= 0),
    advance_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (advance_percentage BETWEEN 0 AND 100),
    maintenance_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (maintenance_fee >= 0),
    maintenance_billing_day INT NOT NULL DEFAULT 1 CHECK (maintenance_billing_day BETWEEN 1 AND 31),
    custom_installments JSONB NOT NULL DEFAULT '[]'::jsonb, 
    -- custom_installments schema: Array of { "due_date": "YYYY-MM-DD", "amount": number, "label": string, "status": "pending" | "paid" }
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE CHECK (end_date >= start_date),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- 4. BILLING & INVOICING
-- ==========================================

-- Invoices Table (Generates bills for Clients)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL,
    number VARCHAR NOT NULL UNIQUE,
    title VARCHAR NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount <= total AND paid_amount >= 0),
    status invoice_status NOT NULL DEFAULT 'draft',
    issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
    due_at DATE CHECK (due_at >= issued_at),
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    currency currency_code NOT NULL DEFAULT 'BDT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items inside Invoices
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    amount NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);





-- ==========================================
-- 6. CENTRALIZED GENERAL LEDGER (TRANSACTIONS)
-- ==========================================

-- Unified double-entry equivalent ledger table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type transaction_type NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency currency_code NOT NULL DEFAULT 'BDT',
    category VARCHAR NOT NULL, 
    -- Categories list: 'salary', 'office_rent', 'domain_renewal', 'utility', 'snacks', 'software_license', 'project_income', 'training_fees', 'marketing', 'equipment', 'other'
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    founder_name VARCHAR CHECK (founder_name IN ('Ismail', 'Imtiaz')), -- For founders' equity ledger
    recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- 7. HR & PAYROLL MODULE
-- ==========================================

-- Monthly salary sheets for staff payroll
CREATE TABLE IF NOT EXISTS salary_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'), -- Format: YYYY-MM
    base_salary NUMERIC(12, 2) NOT NULL CHECK (base_salary >= 0),
    allowances JSONB NOT NULL DEFAULT '{"transport": 0, "medical": 0, "mobile": 0, "other": 0}'::jsonb,
    deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (deductions >= 0),
    net_payable NUMERIC(12, 2) NOT NULL CHECK (net_payable >= 0),
    status salary_sheet_status NOT NULL DEFAULT 'draft',
    paid_at TIMESTAMPTZ,
    recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, month)
);

-- Trigger: When a salary sheet status changes to 'paid', auto-generate expense in general ledger (transactions)
CREATE OR REPLACE FUNCTION process_salary_payment_ledger()
RETURNS TRIGGER AS $$
DECLARE
    emp_name VARCHAR;
BEGIN
    IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
        -- Resolve employee name
        SELECT full_name INTO emp_name FROM employees WHERE id = NEW.employee_id;
        
        -- Insert salary expense log in transactions ledger
        INSERT INTO transactions (type, amount, currency, category, description, date, employee_id, recorded_by)
        VALUES (
            'expense',
            NEW.net_payable,
            'BDT', -- Base salaries paid in BDT
            'salary',
            'Monthly Salary payout for ' || COALESCE(emp_name, 'Employee') || ' (Month: ' || NEW.month || ')',
            COALESCE(NEW.paid_at::date, CURRENT_DATE),
            NEW.employee_id,
            NEW.recorded_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_salary_payment_ledger ON salary_sheets;
CREATE TRIGGER trg_salary_payment_ledger
    AFTER UPDATE ON salary_sheets
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION process_salary_payment_ledger();

-- Trigger: When an invoice status changes to 'paid', auto-generate income in general ledger (transactions)
CREATE OR REPLACE FUNCTION process_invoice_payment_ledger()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
        -- Insert project income in transactions ledger
        INSERT INTO transactions (type, amount, currency, category, description, date, client_id, invoice_id, recorded_by)
        VALUES (
            'income',
            NEW.total,
            NEW.currency,
            'project_income',
            'Payment received for Invoice ' || NEW.number || ' - ' || NEW.title,
            COALESCE(NEW.paid_at::date, CURRENT_DATE),
            NEW.client_id,
            NEW.id,
            NEW.created_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_invoice_payment_ledger ON invoices;
CREATE TRIGGER trg_invoice_payment_ledger
    AFTER UPDATE ON invoices
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION process_invoice_payment_ledger();



-- ==========================================
-- 8. ANALYTICAL DATABASE VIEWS & RPCS
-- ==========================================

-- View: Monthly Profit & Loss (PNL) Statement
DROP VIEW IF EXISTS view_monthly_pnl CASCADE;
CREATE OR REPLACE VIEW view_monthly_pnl AS
SELECT
    to_char(date, 'YYYY-MM') AS month,
    COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS total_income,
    COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS total_expense,
    (COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) - COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)) AS net_profit
FROM transactions
GROUP BY to_char(date, 'YYYY-MM')
ORDER BY month DESC;

-- View: Outstanding dues per client
DROP VIEW IF EXISTS view_client_dues CASCADE;
CREATE OR REPLACE VIEW view_client_dues AS
SELECT
    c.id AS client_id,
    c.company_name,
    COALESCE(SUM(i.total), 0) AS total_invoiced_amount,
    COALESCE(SUM(i.paid_amount), 0) AS total_paid_amount,
    (COALESCE(SUM(i.total), 0) - COALESCE(SUM(i.paid_amount), 0)) AS total_outstanding_due
FROM clients c
LEFT JOIN invoices i ON c.id = i.client_id AND i.status != 'cancelled'
GROUP BY c.id, c.company_name;

-- View: Founder Equity Tracker
DROP VIEW IF EXISTS view_founder_equity CASCADE;
CREATE OR REPLACE VIEW view_founder_equity AS
SELECT
    founder_name,
    COALESCE(SUM(amount) FILTER (WHERE type = 'investment'), 0) AS total_invested,
    COALESCE(SUM(amount) FILTER (WHERE type = 'founder_repayment'), 0) AS total_repaid,
    (COALESCE(SUM(amount) FILTER (WHERE type = 'investment'), 0) - COALESCE(SUM(amount) FILTER (WHERE type = 'founder_repayment'), 0)) AS remaining_outstanding_due
FROM transactions
WHERE founder_name IS NOT NULL
GROUP BY founder_name;

-- RPC Function: Category Expense Breakdown inside a Date Range (for Pie Charts)
CREATE OR REPLACE FUNCTION get_expense_breakdown(start_date DATE, end_date DATE)
RETURNS TABLE (
    category VARCHAR,
    total_amount NUMERIC(12,2),
    currency VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.category::VARCHAR,
        SUM(t.amount)::NUMERIC(12,2) AS total_amount,
        t.currency::VARCHAR
    FROM transactions t
    WHERE t.type = 'expense'
      AND t.date BETWEEN start_date AND end_date
    GROUP BY t.category, t.currency;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_sheets ENABLE ROW LEVEL SECURITY;

-- 9.1 Quotes Policies
DROP POLICY IF EXISTS "Staff can manage all quotes" ON quotes;
CREATE POLICY "Staff can manage all quotes" ON quotes
    FOR ALL TO authenticated
    USING (is_staff(auth.uid()))
    WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view their own quotes" ON quotes;
CREATE POLICY "Clients can view their own quotes" ON quotes
    FOR SELECT TO authenticated
    USING (client_id = get_client_id(auth.uid()));

-- 9.2 Quote Items Policies
DROP POLICY IF EXISTS "Staff can manage all quote items" ON quote_items;
CREATE POLICY "Staff can manage all quote items" ON quote_items
    FOR ALL TO authenticated
    USING (is_staff(auth.uid()))
    WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view their own quote items" ON quote_items;
CREATE POLICY "Clients can view their own quote items" ON quote_items
    FOR SELECT TO authenticated
    USING (quote_id IN (SELECT id FROM quotes WHERE client_id = get_client_id(auth.uid())));

-- 9.3 Agreements Policies
DROP POLICY IF EXISTS "Staff can manage all agreements" ON agreements;
CREATE POLICY "Staff can manage all agreements" ON agreements
    FOR ALL TO authenticated
    USING (is_staff(auth.uid()))
    WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view their own agreements" ON agreements;
CREATE POLICY "Clients can view their own agreements" ON agreements
    FOR SELECT TO authenticated
    USING (client_id = get_client_id(auth.uid()));

-- 9.4 Invoices Policies
DROP POLICY IF EXISTS "Staff can manage all invoices" ON invoices;
CREATE POLICY "Staff can manage all invoices" ON invoices
    FOR ALL TO authenticated
    USING (is_staff(auth.uid()))
    WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view their own invoices" ON invoices;
CREATE POLICY "Clients can view their own invoices" ON invoices
    FOR SELECT TO authenticated
    USING (client_id = get_client_id(auth.uid()));

-- 9.5 Invoice Items Policies
DROP POLICY IF EXISTS "Staff can manage all invoice items" ON invoice_items;
CREATE POLICY "Staff can manage all invoice items" ON invoice_items
    FOR ALL TO authenticated
    USING (is_staff(auth.uid()))
    WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view their own invoice items" ON invoice_items;
CREATE POLICY "Clients can view their own invoice items" ON invoice_items
    FOR SELECT TO authenticated
    USING (invoice_id IN (SELECT id FROM invoices WHERE client_id = get_client_id(auth.uid())));

-- 9.6 Transactions Policies (Restricted to internal staff only)
DROP POLICY IF EXISTS "Staff can manage all transactions" ON transactions;
CREATE POLICY "Staff can manage all transactions" ON transactions
    FOR ALL TO authenticated
    USING (is_staff(auth.uid()))
    WITH CHECK (is_staff(auth.uid()));

-- 9.7 Salary Sheets Policies
DROP POLICY IF EXISTS "Staff can manage all salary sheets" ON salary_sheets;
CREATE POLICY "Staff can manage all salary sheets" ON salary_sheets
    FOR ALL TO authenticated
    USING (is_staff(auth.uid()))
    WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Employees can view their own salary sheets" ON salary_sheets;
CREATE POLICY "Employees can view their own salary sheets" ON salary_sheets
    FOR SELECT TO authenticated
    USING (employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid()));
