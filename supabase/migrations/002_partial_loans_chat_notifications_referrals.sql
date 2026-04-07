-- ============================================
-- FINETIC PROTOCOL — Migration 002
-- Partial loans, P2P chat, notifications, referrals
-- ============================================

-- Add referral fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_bonus_earned INTEGER DEFAULT 0;

-- Auto-generate referral codes for existing profiles
UPDATE profiles SET referral_code = SUBSTRING(wallet_address FROM 1 FOR 8) WHERE referral_code IS NULL;

-- Partial loan funding on requests
ALTER TABLE requests ADD COLUMN IF NOT EXISTS funded_amount DECIMAL(20,2) DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS min_contribution DECIMAL(20,2) DEFAULT 1000;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS allow_partial BOOLEAN DEFAULT true;

-- Link loans to requests for partial funding tracking
ALTER TABLE loans ADD COLUMN IF NOT EXISTS contribution_amount DECIMAL(20,2);

-- ============================================
-- MESSAGES — P2P chat between parties
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  receiver_id UUID NOT NULL REFERENCES profiles(id),
  offer_id UUID REFERENCES offers(id),
  request_id UUID REFERENCES requests(id),
  loan_id UUID REFERENCES loans(id),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_offer ON messages(offer_id);
CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- ============================================
-- NOTIFICATIONS — User alerts
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- RLS for new tables
-- ============================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Messages: only sender and receiver can see
CREATE POLICY "Own messages" ON messages FOR SELECT USING (
  sender_id IN (SELECT id FROM profiles WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address')
  OR receiver_id IN (SELECT id FROM profiles WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address')
);

CREATE POLICY "Send messages" ON messages FOR INSERT WITH CHECK (true);

-- Notifications: only owner can see
CREATE POLICY "Own notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own notifications" ON notifications FOR UPDATE USING (true);

-- ============================================
-- Enable Realtime for chat and notifications
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- Function to generate referral code on profile creation
-- ============================================
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := SUBSTRING(NEW.wallet_address FROM 1 FOR 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();

-- ============================================
-- Function to award referral bonus
-- ============================================
CREATE OR REPLACE FUNCTION award_referral_bonus(
  p_profile_id UUID,
  p_loan_id UUID
) RETURNS VOID AS $$
DECLARE
  v_referrer_id UUID;
  v_current_score INTEGER;
BEGIN
  SELECT referred_by INTO v_referrer_id FROM profiles WHERE id = p_profile_id;
  IF v_referrer_id IS NOT NULL THEN
    SELECT score INTO v_current_score FROM profiles WHERE id = v_referrer_id;
    UPDATE profiles SET
      score = v_current_score + 50,
      referral_bonus_earned = referral_bonus_earned + 50
    WHERE id = v_referrer_id;

    INSERT INTO score_history (profile_id, loan_id, event, points, score_before, score_after)
    VALUES (v_referrer_id, p_loan_id, 'loan_funded', 50, v_current_score, v_current_score + 50);

    INSERT INTO notifications (profile_id, type, title, message, data)
    VALUES (v_referrer_id, 'referral_bonus', 'Bonus de referido!',
      'Tu referido completó un préstamo. +50 puntos!',
      jsonb_build_object('loan_id', p_loan_id, 'referred_id', p_profile_id));
  END IF;
END;
$$ LANGUAGE plpgsql;
