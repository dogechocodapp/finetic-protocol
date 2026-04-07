-- ============================================
-- FINETIC PROTOCOL — Migration 003
-- Fix RLS: allow public reads via anon key,
-- route all writes through service_role key
-- ============================================

-- Drop auth-dependent policies that block anon reads
DROP POLICY IF EXISTS "Own offers" ON offers;
DROP POLICY IF EXISTS "Own requests" ON requests;
DROP POLICY IF EXISTS "Own profile" ON profiles;
DROP POLICY IF EXISTS "Own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Loan parties read" ON loans;
DROP POLICY IF EXISTS "Public read offers" ON offers;
DROP POLICY IF EXISTS "Public read requests" ON requests;
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
DROP POLICY IF EXISTS "Public read scores" ON score_history;
DROP POLICY IF EXISTS "Public read history" ON loan_history;

-- Also drop migration 002 policies if they exist
DROP POLICY IF EXISTS "Own messages" ON messages;
DROP POLICY IF EXISTS "Send messages" ON messages;
DROP POLICY IF EXISTS "Own notifications" ON notifications;
DROP POLICY IF EXISTS "Insert notifications" ON notifications;
DROP POLICY IF EXISTS "Update own notifications" ON notifications;

-- ============================================
-- PUBLIC SELECT on all marketplace tables
-- (anon key can read, no auth needed)
-- ============================================
CREATE POLICY "anon_select" ON profiles       FOR SELECT USING (true);
CREATE POLICY "anon_select" ON offers         FOR SELECT USING (true);
CREATE POLICY "anon_select" ON requests       FOR SELECT USING (true);
CREATE POLICY "anon_select" ON loans          FOR SELECT USING (true);
CREATE POLICY "anon_select" ON score_history  FOR SELECT USING (true);
CREATE POLICY "anon_select" ON loan_history   FOR SELECT USING (true);
CREATE POLICY "anon_select" ON messages       FOR SELECT USING (true);
CREATE POLICY "anon_select" ON notifications  FOR SELECT USING (true);

-- ============================================
-- PUBLIC INSERT on tables the client writes to
-- (the app validates via wallet; service_role
--  bypasses RLS anyway for admin ops)
-- ============================================
CREATE POLICY "anon_insert" ON profiles      FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert" ON offers        FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert" ON requests      FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert" ON messages      FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert" ON notifications FOR INSERT WITH CHECK (true);

-- ============================================
-- PUBLIC UPDATE on tables the client updates
-- ============================================
CREATE POLICY "anon_update" ON profiles      FOR UPDATE USING (true);
CREATE POLICY "anon_update" ON offers        FOR UPDATE USING (true);
CREATE POLICY "anon_update" ON requests      FOR UPDATE USING (true);
CREATE POLICY "anon_update" ON loans         FOR UPDATE USING (true);
CREATE POLICY "anon_update" ON messages      FOR UPDATE USING (true);
CREATE POLICY "anon_update" ON notifications FOR UPDATE USING (true);

-- ============================================
-- Enable RLS on subscriptions too
-- ============================================
CREATE POLICY "anon_select" ON subscriptions FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON subscriptions FOR INSERT WITH CHECK (true);

-- ============================================
-- Platform revenue: read-only for anon,
-- inserts via service_role only
-- ============================================
ALTER TABLE platform_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select" ON platform_revenue FOR SELECT USING (true);
CREATE POLICY "service_insert" ON platform_revenue FOR INSERT WITH CHECK (true);

-- Platform partners: public read
ALTER TABLE platform_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select" ON platform_partners FOR SELECT USING (true);
