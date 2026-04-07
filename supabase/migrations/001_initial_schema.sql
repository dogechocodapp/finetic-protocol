-- ============================================
-- FINETIC PROTOCOL — Database Schema
-- Marketplace P2P préstamos cripto
-- ============================================

-- ENUM types
CREATE TYPE user_role AS ENUM ('lender', 'borrower', 'both');
CREATE TYPE offer_status AS ENUM ('active', 'matched', 'expired', 'cancelled');
CREATE TYPE request_status AS ENUM ('active', 'matched', 'expired', 'cancelled');
CREATE TYPE loan_status AS ENUM ('active', 'repaid_early', 'repaid_on_time', 'renewed', 'defaulted');
CREATE TYPE loan_tier AS ENUM ('standard', 'high');  -- 10% or 20%
CREATE TYPE subscription_tier AS ENUM ('free', 'premium');
CREATE TYPE collateral_token AS ENUM ('BTC', 'ETH', 'SOL', 'BNB', 'USDC', 'USDT');
CREATE TYPE stable_token AS ENUM ('USDC', 'USDT');
CREATE TYPE score_event AS ENUM (
  'early_repay_50',    -- +150 pts: repaid before 50% of term
  'early_repay',       -- +100 pts: repaid before maturity
  'on_time_repay',     -- +50 pts: repaid at maturity
  'renewal',           -- +10 pts: renewed (not default but couldn't repay)
  'default',           -- -200 pts: failed to repay
  'loan_funded',       -- +30 pts: lender funded a loan successfully
  'loan_completed'     -- +50 pts: lender's loan was fully repaid
);

-- ============================================
-- 1. PROFILES — User identity linked to wallet
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role user_role DEFAULT 'both',
  score INTEGER DEFAULT 0,
  total_loans_as_lender INTEGER DEFAULT 0,
  total_loans_as_borrower INTEGER DEFAULT 0,
  total_volume_lent DECIMAL(20,2) DEFAULT 0,
  total_volume_borrowed DECIMAL(20,2) DEFAULT 0,
  defaults_as_borrower INTEGER DEFAULT 0,
  defaults_as_lender INTEGER DEFAULT 0,  -- loans where borrower defaulted
  subscription subscription_tier DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  referral_platform TEXT,  -- platform that referred this user (for 50% revenue share)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_wallet ON profiles(wallet_address);
CREATE INDEX idx_profiles_score ON profiles(score DESC);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================
-- 2. OFFERS — Lender publishes lending offers
-- ============================================
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES profiles(id),
  stable_token stable_token NOT NULL,          -- what they lend (USDC/USDT)
  amount DECIMAL(20,2) NOT NULL,               -- how much they offer
  min_amount DECIMAL(20,2),                    -- minimum loan they accept
  accepted_collaterals collateral_token[] NOT NULL,  -- what collateral they accept
  tier loan_tier NOT NULL DEFAULT 'standard',  -- 10% or 20%
  term_months INTEGER NOT NULL CHECK (term_months IN (12, 24)),
  description TEXT,                            -- optional note from lender
  status offer_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_lender ON offers(lender_id);
CREATE INDEX idx_offers_tier ON offers(tier);
CREATE INDEX idx_offers_token ON offers(stable_token);

-- ============================================
-- 3. REQUESTS — Client publishes loan requests
-- ============================================
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES profiles(id),
  stable_token stable_token NOT NULL,          -- what they want to receive
  amount DECIMAL(20,2) NOT NULL,               -- how much they need
  collateral_token collateral_token NOT NULL,   -- what they offer as collateral
  collateral_amount DECIMAL(20,8) NOT NULL,    -- how much collateral they deposit
  tier loan_tier NOT NULL DEFAULT 'standard',
  term_months INTEGER NOT NULL CHECK (term_months IN (12, 24)),
  description TEXT,
  status request_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_borrower ON requests(borrower_id);
CREATE INDEX idx_requests_collateral ON requests(collateral_token);

-- ============================================
-- 4. LOANS — Active and completed loans
-- ============================================
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES offers(id),
  request_id UUID REFERENCES requests(id),
  lender_id UUID NOT NULL REFERENCES profiles(id),
  borrower_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Loan terms
  stable_token stable_token NOT NULL,
  loan_amount DECIMAL(20,2) NOT NULL,          -- principal
  collateral_token collateral_token NOT NULL,
  collateral_amount DECIMAL(20,8) NOT NULL,
  tier loan_tier NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,         -- 10.00 or 20.00
  term_months INTEGER NOT NULL,
  
  -- Fees charged
  origination_fee DECIMAL(20,2) NOT NULL,      -- 1.5% or 2% of loan to borrower
  platform_interest_fee DECIMAL(5,2) NOT NULL, -- 1.5% or 2% of interest to lender
  insurance_reserve DECIMAL(20,2) NOT NULL,    -- 0.5% from Finetic margin
  
  -- Net amounts
  amount_disbursed DECIMAL(20,2) NOT NULL,     -- what borrower actually receives
  
  -- Solana references
  escrow_address TEXT,                         -- smart contract escrow address
  collateral_tx_signature TEXT,                -- deposit tx
  disbursement_tx_signature TEXT,              -- loan disbursement tx
  repayment_tx_signature TEXT,                 -- repayment tx
  
  -- Status tracking
  status loan_status DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  matures_at TIMESTAMPTZ NOT NULL,            -- when the loan is due
  repaid_at TIMESTAMPTZ,                      -- when actually repaid (null if not yet)
  renewed_from_loan_id UUID REFERENCES loans(id),  -- if this is a renewal
  
  -- Referral tracking for revenue share
  referral_platform TEXT,                      -- platform that originated this loan
  referral_fee DECIMAL(20,2) DEFAULT 0,       -- 50% of Finetic fees to platform
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loans_lender ON loans(lender_id);
CREATE INDEX idx_loans_borrower ON loans(borrower_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_matures ON loans(matures_at);
CREATE INDEX idx_loans_referral ON loans(referral_platform);

-- ============================================
-- 5. SCORE_HISTORY — Every scoring event
-- ============================================
CREATE TABLE score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  loan_id UUID NOT NULL REFERENCES loans(id),
  event score_event NOT NULL,
  points INTEGER NOT NULL,
  score_before INTEGER NOT NULL,
  score_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_score_profile ON score_history(profile_id);
CREATE INDEX idx_score_loan ON score_history(loan_id);

-- ============================================
-- 6. LOAN_HISTORY — Public operation history
--    (the transparency layer)
-- ============================================
CREATE TABLE loan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,  -- 'created', 'funded', 'collateral_deposited', 'disbursed', 'partial_repay', 'full_repay', 'renewed', 'defaulted', 'collateral_released', 'collateral_transferred'
  amount DECIMAL(20,2),
  token TEXT,
  tx_signature TEXT,     -- Solana transaction signature
  details JSONB,         -- any additional data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_history_loan ON loan_history(loan_id);
CREATE INDEX idx_history_actor ON loan_history(actor_id);
CREATE INDEX idx_history_action ON loan_history(action);

-- ============================================
-- 7. SUBSCRIPTIONS — Premium payment tracking
-- ============================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  tier subscription_tier NOT NULL,
  role user_role NOT NULL,  -- premium as lender or borrower
  price_usd DECIMAL(10,2) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  payment_tx_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subs_profile ON subscriptions(profile_id);
CREATE INDEX idx_subs_expires ON subscriptions(expires_at);

-- ============================================
-- 8. PLATFORM_REVENUE — Track all Finetic income
-- ============================================
CREATE TABLE platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id),
  subscription_id UUID REFERENCES subscriptions(id),
  revenue_type TEXT NOT NULL,  -- 'origination_fee', 'interest_fee', 'insurance_retained', 'subscription', 'insurance_paid_out'
  amount DECIMAL(20,2) NOT NULL,
  token TEXT NOT NULL,
  referral_platform TEXT,
  referral_share DECIMAL(20,2) DEFAULT 0,  -- 50% to platform
  net_revenue DECIMAL(20,2) NOT NULL,      -- what Finetic keeps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_type ON platform_revenue(revenue_type);
CREATE INDEX idx_revenue_referral ON platform_revenue(referral_platform);

-- ============================================
-- 9. PLATFORM_PARTNERS — Registered platforms
--    using Finetic SDK (for revenue share)
-- ============================================
CREATE TABLE platform_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,  -- where to send their 50% share
  revenue_share_pct DECIMAL(5,2) DEFAULT 50.00,
  total_loans_originated INTEGER DEFAULT 0,
  total_revenue_shared DECIMAL(20,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partners_apikey ON platform_partners(api_key);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_offers_updated BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_requests_updated BEFORE UPDATE ON requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_loans_updated BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_partners_updated BEFORE UPDATE ON platform_partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to update score
CREATE OR REPLACE FUNCTION update_user_score(
  p_profile_id UUID,
  p_loan_id UUID,
  p_event score_event
) RETURNS INTEGER AS $$
DECLARE
  v_points INTEGER;
  v_current_score INTEGER;
  v_new_score INTEGER;
BEGIN
  -- Determine points
  v_points := CASE p_event
    WHEN 'early_repay_50' THEN 150
    WHEN 'early_repay' THEN 100
    WHEN 'on_time_repay' THEN 50
    WHEN 'renewal' THEN 10
    WHEN 'default' THEN -200
    WHEN 'loan_funded' THEN 30
    WHEN 'loan_completed' THEN 50
  END;
  
  -- Get current score
  SELECT score INTO v_current_score FROM profiles WHERE id = p_profile_id;
  v_new_score := GREATEST(0, v_current_score + v_points);  -- never below 0
  
  -- Update profile score
  UPDATE profiles SET score = v_new_score WHERE id = p_profile_id;
  
  -- Record history
  INSERT INTO score_history (profile_id, loan_id, event, points, score_before, score_after)
  VALUES (p_profile_id, p_loan_id, p_event, v_points, v_current_score, v_new_score);
  
  RETURN v_new_score;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate fees for a loan
CREATE OR REPLACE FUNCTION calculate_loan_fees(
  p_amount DECIMAL,
  p_tier loan_tier
) RETURNS TABLE (
  origination_fee DECIMAL,
  interest_rate DECIMAL,
  platform_interest_pct DECIMAL,
  insurance_reserve DECIMAL,
  amount_disbursed DECIMAL
) AS $$
BEGIN
  IF p_tier = 'standard' THEN
    origination_fee := p_amount * 0.015;
    interest_rate := 10.00;
    platform_interest_pct := 1.50;
  ELSE
    origination_fee := p_amount * 0.02;
    interest_rate := 20.00;
    platform_interest_pct := 2.00;
  END IF;
  
  insurance_reserve := p_amount * 0.005;
  amount_disbursed := p_amount - origination_fee;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Public read for marketplace (offers, requests, profiles, scores, history)
CREATE POLICY "Public read offers" ON offers FOR SELECT USING (true);
CREATE POLICY "Public read requests" ON requests FOR SELECT USING (true);
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Public read scores" ON score_history FOR SELECT USING (true);
CREATE POLICY "Public read history" ON loan_history FOR SELECT USING (true);

-- Users can only modify their own data
CREATE POLICY "Own offers" ON offers FOR ALL USING (
  lender_id IN (SELECT id FROM profiles WHERE wallet_address = auth.jwt()->>'wallet_address')
);
CREATE POLICY "Own requests" ON requests FOR ALL USING (
  borrower_id IN (SELECT id FROM profiles WHERE wallet_address = auth.jwt()->>'wallet_address')
);
CREATE POLICY "Own profile" ON profiles FOR UPDATE USING (
  wallet_address = auth.jwt()->>'wallet_address'
);
CREATE POLICY "Own subscriptions" ON subscriptions FOR ALL USING (
  profile_id IN (SELECT id FROM profiles WHERE wallet_address = auth.jwt()->>'wallet_address')
);

-- Loans visible to both parties
CREATE POLICY "Loan parties read" ON loans FOR SELECT USING (
  lender_id IN (SELECT id FROM profiles WHERE wallet_address = auth.jwt()->>'wallet_address')
  OR borrower_id IN (SELECT id FROM profiles WHERE wallet_address = auth.jwt()->>'wallet_address')
);
