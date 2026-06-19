-- =========================================================================
-- CNIT Official Website - Database & RLS Performance Optimization Migration
-- =========================================================================
-- This script applies optimizations for:
-- 1. Foreign Key Indexes (Eliminate Seq Scans)
-- 2. RLS Helper Functions (Mark STABLE to enable query-level caching)
-- 3. Heavy RLS Policies (Optimize USING clauses with EXISTS)
-- =========================================================================

-- ==========================================
-- 1. CREATE MISSING FOREIGN KEY INDEXES
-- ==========================================

-- Index foreign keys on public.invoices
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON public.invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_agreement_id ON public.invoices(agreement_id);

-- Index foreign keys on public.transactions
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON public.transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_employee_id ON public.transactions(employee_id);

-- Index foreign keys on public.agreements
CREATE INDEX IF NOT EXISTS idx_agreements_client_id ON public.agreements(client_id);
CREATE INDEX IF NOT EXISTS idx_agreements_project_id ON public.agreements(project_id);

-- Index foreign keys on public.quotes
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_project_id ON public.quotes(project_id);

-- Index foreign keys on public.quote_items
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);

-- Index foreign keys on public.invoice_items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- Index foreign keys on public.salary_sheets
CREATE INDEX IF NOT EXISTS idx_salary_sheets_employee_id ON public.salary_sheets(employee_id);

-- Index profile/employee links
CREATE INDEX IF NOT EXISTS idx_employees_profile_id ON public.employees(profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);


-- ==========================================
-- 2. OPTIMIZE RLS HELPER FUNCTIONS
-- ==========================================

-- Re-define: is_staff (optimised with STABLE and PARALLEL SAFE)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role::text != 'client'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE PARALLEL SAFE;

-- Re-define: get_client_id (optimised with STABLE and PARALLEL SAFE)
CREATE OR REPLACE FUNCTION public.get_client_id(_user_id uuid)
RETURNS uuid AS $$
DECLARE
    cid uuid;
BEGIN
    SELECT client_id INTO cid FROM public.profiles WHERE id = _user_id;
    RETURN cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE PARALLEL SAFE;

-- Re-define: has_role (optimised with STABLE and PARALLEL SAFE)
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role::text = _role::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE PARALLEL SAFE;


-- ==========================================
-- 3. REFACTOR HEAVY RLS POLICIES
-- ==========================================

-- Recreate: Quote Items Select Policy using EXISTS (correlated subquery)
DROP POLICY IF EXISTS "Clients can view their own quote items" ON public.quote_items;
CREATE POLICY "Clients can view their own quote items" ON public.quote_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_id
              AND q.client_id = public.get_client_id(auth.uid())
        )
    );

-- Recreate: Invoice Items Select Policy using EXISTS (correlated subquery)
DROP POLICY IF EXISTS "Clients can view their own invoice items" ON public.invoice_items;
CREATE POLICY "Clients can view their own invoice items" ON public.invoice_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices i
            WHERE i.id = invoice_id
              AND i.client_id = public.get_client_id(auth.uid())
        )
    );

-- Recreate: Salary Sheets Select Policy using EXISTS (correlated subquery)
DROP POLICY IF EXISTS "Employees can view their own salary sheets" ON public.salary_sheets;
CREATE POLICY "Employees can view their own salary sheets" ON public.salary_sheets
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.id = employee_id
              AND e.profile_id = auth.uid()
        )
    );
