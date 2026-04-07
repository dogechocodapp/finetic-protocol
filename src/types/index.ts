// ============================================
// FINETIC PROTOCOL — Types
// ============================================

// Database enums
export type UserRole = 'lender' | 'borrower' | 'both';
export type OfferStatus = 'active' | 'matched' | 'expired' | 'cancelled';
export type RequestStatus = 'active' | 'matched' | 'expired' | 'cancelled';
export type LoanStatus = 'active' | 'repaid_early' | 'repaid_on_time' | 'renewed' | 'defaulted';
export type LoanTier = 'standard' | 'high';
export type SubscriptionTier = 'free' | 'premium';
export type CollateralToken = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'USDC' | 'USDT';
export type StableToken = 'USDC' | 'USDT';
export type ScoreEvent =
  | 'early_repay_50' | 'early_repay' | 'on_time_repay'
  | 'renewal' | 'default' | 'loan_funded' | 'loan_completed';

export type NotificationType =
  | 'offer_match' | 'request_funded' | 'loan_expiring_30'
  | 'loan_expiring_7' | 'loan_expiring_1' | 'offer_accepted'
  | 'referral_bonus' | 'partial_funded' | 'new_message';

// Score points map
export const SCORE_POINTS: Record<ScoreEvent, number> = {
  early_repay_50: 150,
  early_repay: 100,
  on_time_repay: 50,
  renewal: 10,
  default: -200,
  loan_funded: 30,
  loan_completed: 50,
};

// LTV is informational only — no protocol-enforced limits
export function calculateLTV(loanAmount: number, collateralValue: number): number {
  if (collateralValue === 0) return 0;
  return Math.round((loanAmount / collateralValue) * 10000) / 100;
}

// Fee configuration
export const FEES = {
  standard: {
    origination_bps: 150,
    interest_fee_bps: 150,
    interest_rate: 10,
  },
  high: {
    origination_bps: 200,
    interest_fee_bps: 200,
    interest_rate: 20,
  },
  insurance_bps: 50,
  referral_share: 50,
} as const;

// ============================================
// Database Models
// ============================================

export interface Profile {
  id: string;
  wallet_address: string;
  display_name: string | null;
  role: UserRole;
  score: number;
  total_loans_as_lender: number;
  total_loans_as_borrower: number;
  total_volume_lent: number;
  total_volume_borrowed: number;
  defaults_as_borrower: number;
  defaults_as_lender: number;
  subscription: SubscriptionTier;
  subscription_expires_at: string | null;
  referral_platform: string | null;
  referral_code: string | null;
  referred_by: string | null;
  referral_bonus_earned: number;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  lender_id: string;
  stable_token: StableToken;
  amount: number;
  min_amount: number | null;
  accepted_collaterals: CollateralToken[];
  tier: LoanTier;
  term_months: number;
  description: string | null;
  status: OfferStatus;
  created_at: string;
  expires_at: string | null;
  updated_at: string;
  lender?: Profile;
}

export interface LoanRequest {
  id: string;
  borrower_id: string;
  stable_token: StableToken;
  amount: number;
  collateral_token: CollateralToken;
  collateral_amount: number;
  tier: LoanTier;
  term_months: number;
  description: string | null;
  status: RequestStatus;
  funded_amount: number;
  min_contribution: number | null;
  allow_partial: boolean;
  created_at: string;
  expires_at: string | null;
  updated_at: string;
  borrower?: Profile;
}

export interface Loan {
  id: string;
  offer_id: string | null;
  request_id: string | null;
  lender_id: string;
  borrower_id: string;
  stable_token: StableToken;
  loan_amount: number;
  collateral_token: CollateralToken;
  collateral_amount: number;
  tier: LoanTier;
  interest_rate: number;
  term_months: number;
  origination_fee: number;
  platform_interest_fee: number;
  insurance_reserve: number;
  amount_disbursed: number;
  contribution_amount: number | null;
  escrow_address: string | null;
  collateral_tx_signature: string | null;
  disbursement_tx_signature: string | null;
  repayment_tx_signature: string | null;
  status: LoanStatus;
  started_at: string;
  matures_at: string;
  repaid_at: string | null;
  renewed_from_loan_id: string | null;
  referral_platform: string | null;
  referral_fee: number;
  created_at: string;
  updated_at: string;
  lender?: Profile;
  borrower?: Profile;
}

export interface ScoreHistory {
  id: string;
  profile_id: string;
  loan_id: string;
  event: ScoreEvent;
  points: number;
  score_before: number;
  score_after: number;
  created_at: string;
}

export interface LoanHistoryEntry {
  id: string;
  loan_id: string;
  actor_id: string;
  action: string;
  amount: number | null;
  token: string | null;
  tx_signature: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  offer_id: string | null;
  request_id: string | null;
  loan_id: string | null;
  content: string;
  read: boolean;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

export interface Notification {
  id: string;
  profile_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface PlatformPartner {
  id: string;
  name: string;
  api_key: string;
  wallet_address: string;
  revenue_share_pct: number;
  total_loans_originated: number;
  total_revenue_shared: number;
  is_active: boolean;
  created_at: string;
}

// ============================================
// UI Helper Types
// ============================================

export interface OfferWithLender extends Offer {
  lender: Profile;
}

export interface RequestWithBorrower extends LoanRequest {
  borrower: Profile;
}

export interface LoanWithParties extends Loan {
  lender: Profile;
  borrower: Profile;
}

export interface FeeBreakdown {
  loan_amount: number;
  origination_fee: number;
  insurance_reserve: number;
  amount_disbursed: number;
  annual_interest: number;
  platform_interest_fee: number;
  lender_interest: number;
}

export function calculateFees(amount: number, tier: LoanTier): FeeBreakdown {
  const config = FEES[tier];
  const origination_fee = (amount * config.origination_bps) / 10000;
  const insurance_reserve = (amount * FEES.insurance_bps) / 10000;
  const amount_disbursed = amount - origination_fee;
  const annual_interest = (amount * config.interest_rate) / 100;
  const platform_interest_fee = (annual_interest * config.interest_fee_bps) / 10000;
  const lender_interest = annual_interest - platform_interest_fee;

  return {
    loan_amount: amount,
    origination_fee,
    insurance_reserve,
    amount_disbursed,
    annual_interest,
    platform_interest_fee,
    lender_interest,
  };
}

export type ScoreTier = 'new' | 'bronze' | 'silver' | 'gold' | 'diamond';

export function getScoreTier(score: number): ScoreTier {
  if (score >= 1000) return 'diamond';
  if (score >= 500) return 'gold';
  if (score >= 200) return 'silver';
  if (score >= 50) return 'bronze';
  return 'new';
}

export const SCORE_TIER_CONFIG: Record<ScoreTier, { label: string; color: string }> = {
  new: { label: 'NEW', color: '#6B7280' },
  bronze: { label: 'BRONZE', color: '#CD7F32' },
  silver: { label: 'SILVER', color: '#94A3B8' },
  gold: { label: 'GOLD', color: '#F59E0B' },
  diamond: { label: 'DIAMOND', color: '#8B5CF6' },
};

export function shortWallet(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
