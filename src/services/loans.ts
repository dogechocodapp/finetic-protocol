import { supabase } from '@/lib/supabase';
import { connection, getOfferPDA, getLoanPDA, toTokenAmount, TOKEN_DECIMALS, TOKEN_MINTS, FINETIC_PROGRAM_ID } from '@/lib/solana';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import type { Loan, LoanWithParties, LoanStatus, LoanTier } from '@/types';
import { FEES, calculateFees } from '@/types';

export interface ExecuteLoanParams {
  offer_id: string;
  borrower_id: string;
  lender_id: string;
  loan_amount: number;
  collateral_token: string;
  collateral_amount: number;
  stable_token: string;
  tier: LoanTier;
  term_months: number;
  // Wallet signers
  borrowerWallet: any;
  lenderWallet: any;
  // Optional referral
  referral_platform?: string;
}

export const loansService = {
  // Fetch active loans for a user (as lender or borrower)
  async getByUser(userId: string): Promise<LoanWithParties[]> {
    const { data, error } = await supabase
      .from('loans')
      .select('*, lender:profiles!lender_id(*), borrower:profiles!borrower_id(*)')
      .or(`lender_id.eq.${userId},borrower_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as LoanWithParties[];
  },

  // Fetch active loans only
  async getActiveByUser(userId: string): Promise<LoanWithParties[]> {
    const { data, error } = await supabase
      .from('loans')
      .select('*, lender:profiles!lender_id(*), borrower:profiles!borrower_id(*)')
      .or(`lender_id.eq.${userId},borrower_id.eq.${userId}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as LoanWithParties[];
  },

  // Get single loan with full details
  async getById(loanId: string): Promise<LoanWithParties | null> {
    const { data, error } = await supabase
      .from('loans')
      .select('*, lender:profiles!lender_id(*), borrower:profiles!borrower_id(*)')
      .eq('id', loanId)
      .single();

    if (error) return null;
    return data as LoanWithParties;
  },

  // Execute a loan — the main flow:
  // 1. Build Solana transaction (collateral escrow + disbursement)
  // 2. Both parties sign
  // 3. Record in Supabase
  async executeLoan(params: ExecuteLoanParams): Promise<{ loan: Loan; txSignature: string }> {
    const fees = calculateFees(params.loan_amount, params.tier);

    // Calculate maturity date
    const now = new Date();
    const maturesAt = new Date(now);
    maturesAt.setMonth(maturesAt.getMonth() + params.term_months);

    // Calculate referral fee if applicable
    let referralFee = 0;
    if (params.referral_platform) {
      const totalPlatformFee = fees.origination_fee + fees.platform_interest_fee;
      referralFee = totalPlatformFee * (FEES.referral_share / 100);
    }

    // TODO: Build actual Solana transaction
    // For MVP, we record the intent and handle on-chain execution
    // via the Anchor client when both wallets are connected
    const txSignature = 'pending_solana_tx';

    // Record loan in Supabase
    const { data, error } = await supabase
      .from('loans')
      .insert({
        offer_id: params.offer_id,
        lender_id: params.lender_id,
        borrower_id: params.borrower_id,
        stable_token: params.stable_token,
        loan_amount: params.loan_amount,
        collateral_token: params.collateral_token,
        collateral_amount: params.collateral_amount,
        tier: params.tier,
        interest_rate: FEES[params.tier].interest_rate,
        term_months: params.term_months,
        origination_fee: fees.origination_fee,
        platform_interest_fee: FEES[params.tier].interest_fee_bps / 100,
        insurance_reserve: fees.insurance_reserve,
        amount_disbursed: fees.amount_disbursed,
        escrow_address: null, // Set after on-chain tx
        collateral_tx_signature: txSignature,
        status: 'active',
        started_at: now.toISOString(),
        matures_at: maturesAt.toISOString(),
        referral_platform: params.referral_platform || null,
        referral_fee: referralFee,
      })
      .select()
      .single();

    if (error) throw error;

    // Record in loan history
    await supabase.from('loan_history').insert([
      {
        loan_id: data.id,
        actor_id: params.borrower_id,
        action: 'collateral_deposited',
        amount: params.collateral_amount,
        token: params.collateral_token,
        tx_signature: txSignature,
      },
      {
        loan_id: data.id,
        actor_id: params.lender_id,
        action: 'disbursed',
        amount: fees.amount_disbursed,
        token: params.stable_token,
        tx_signature: txSignature,
      },
    ]);

    // Record platform revenue
    await supabase.from('platform_revenue').insert({
      loan_id: data.id,
      revenue_type: 'origination_fee',
      amount: fees.origination_fee,
      token: params.stable_token,
      referral_platform: params.referral_platform || null,
      referral_share: referralFee,
      net_revenue: fees.origination_fee - referralFee,
    });

    // Update lender score
    await supabase.rpc('update_user_score', {
      p_profile_id: params.lender_id,
      p_loan_id: data.id,
      p_event: 'loan_funded',
    });

    return { loan: data as Loan, txSignature };
  },

  // Repay loan
  async repayLoan(
    loanId: string,
    borrowerId: string,
    borrowerWallet: any,
  ): Promise<{ txSignature: string }> {
    // Get loan details
    const loan = await this.getById(loanId);
    if (!loan) throw new Error('Loan not found');
    if (loan.status !== 'active') throw new Error('Loan is not active');
    if (loan.borrower_id !== borrowerId) throw new Error('Not the borrower');

    const now = new Date();
    const startedAt = new Date(loan.started_at);
    const maturesAt = new Date(loan.matures_at);

    // Calculate pro-rata interest
    const elapsedMs = now.getTime() - startedAt.getTime();
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    const interestOwed = loan.loan_amount * (loan.interest_rate / 100) * (elapsedMs / yearMs);
    const platformFee = interestOwed * (FEES[loan.tier].interest_fee_bps / 10000);
    const lenderInterest = interestOwed - platformFee;
    const totalRepayment = loan.loan_amount + interestOwed;

    // Determine score event
    const termMs = maturesAt.getTime() - startedAt.getTime();
    const halfTermDate = new Date(startedAt.getTime() + termMs / 2);

    let scoreEvent: string;
    let loanStatus: LoanStatus;
    if (now < halfTermDate) {
      scoreEvent = 'early_repay_50';
      loanStatus = 'repaid_early';
    } else if (now < maturesAt) {
      scoreEvent = 'early_repay';
      loanStatus = 'repaid_early';
    } else {
      scoreEvent = 'on_time_repay';
      loanStatus = 'repaid_on_time';
    }

    // TODO: Execute Solana transaction
    const txSignature = 'pending_solana_repay_tx';

    // Update loan status
    const { error } = await supabase
      .from('loans')
      .update({
        status: loanStatus,
        repaid_at: now.toISOString(),
        repayment_tx_signature: txSignature,
      })
      .eq('id', loanId);

    if (error) throw error;

    // Record history
    await supabase.from('loan_history').insert([
      {
        loan_id: loanId,
        actor_id: borrowerId,
        action: 'full_repay',
        amount: totalRepayment,
        token: loan.stable_token,
        tx_signature: txSignature,
        details: { interest_paid: interestOwed, platform_fee: platformFee },
      },
      {
        loan_id: loanId,
        actor_id: borrowerId,
        action: 'collateral_released',
        amount: loan.collateral_amount,
        token: loan.collateral_token,
        tx_signature: txSignature,
      },
    ]);

    // Record platform revenue from interest
    const referralShare = loan.referral_platform
      ? platformFee * (FEES.referral_share / 100)
      : 0;

    if (platformFee > 0) {
      await supabase.from('platform_revenue').insert({
        loan_id: loanId,
        revenue_type: 'interest_fee',
        amount: platformFee,
        token: loan.stable_token,
        referral_platform: loan.referral_platform,
        referral_share: referralShare,
        net_revenue: platformFee - referralShare,
      });
    }

    // Update scores
    await supabase.rpc('update_user_score', {
      p_profile_id: borrowerId,
      p_loan_id: loanId,
      p_event: scoreEvent,
    });

    await supabase.rpc('update_user_score', {
      p_profile_id: loan.lender_id,
      p_loan_id: loanId,
      p_event: 'loan_completed',
    });

    // Update profile stats
    await supabase.rpc('update_user_score', {
      p_profile_id: borrowerId,
      p_loan_id: loanId,
      p_event: scoreEvent,
    });

    return { txSignature };
  },

  // Claim default (lender)
  async claimDefault(
    loanId: string,
    lenderId: string,
  ): Promise<{ txSignature: string }> {
    const loan = await this.getById(loanId);
    if (!loan) throw new Error('Loan not found');
    if (loan.status !== 'active') throw new Error('Loan is not active');
    if (loan.lender_id !== lenderId) throw new Error('Not the lender');

    const now = new Date();
    const maturesAt = new Date(loan.matures_at);
    if (now <= maturesAt) throw new Error('Loan has not matured yet');

    const txSignature = 'pending_solana_default_tx';

    // Update loan
    await supabase
      .from('loans')
      .update({ status: 'defaulted' })
      .eq('id', loanId);

    // Record history
    await supabase.from('loan_history').insert([
      {
        loan_id: loanId,
        actor_id: lenderId,
        action: 'defaulted',
        amount: loan.collateral_amount,
        token: loan.collateral_token,
        tx_signature: txSignature,
      },
      {
        loan_id: loanId,
        actor_id: lenderId,
        action: 'collateral_transferred',
        amount: loan.collateral_amount,
        token: loan.collateral_token,
        tx_signature: txSignature,
        details: { insurance_payout: loan.insurance_reserve },
      },
    ]);

    // Record insurance payout (Finetic loses 0.5%)
    await supabase.from('platform_revenue').insert({
      loan_id: loanId,
      revenue_type: 'insurance_paid_out',
      amount: -loan.insurance_reserve, // negative = Finetic pays out
      token: loan.stable_token,
      referral_platform: null,
      referral_share: 0,
      net_revenue: -loan.insurance_reserve,
    });

    // Update scores
    await supabase.rpc('update_user_score', {
      p_profile_id: loan.borrower_id,
      p_loan_id: loanId,
      p_event: 'default',
    });

    // Update borrower default count
    await supabase
      .from('profiles')
      .update({
        defaults_as_borrower: (loan.borrower?.defaults_as_borrower || 0) + 1,
      })
      .eq('id', loan.borrower_id);

    return { txSignature };
  },
};
