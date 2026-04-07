/**
 * FINETIC SDK
 * 
 * Integrate P2P crypto lending into your platform.
 * Earn 50% revenue share on every loan originated through your app.
 * 
 * "Solo para gente segura"
 * 
 * Quick start:
 *   const finetic = new FineticSDK({ apiKey: 'your-api-key' });
 *   const offers = await finetic.getOffers();
 */

import { offersService, type CreateOfferParams } from '@/services/offers';
import { requestsService, type CreateRequestParams } from '@/services/requests';
import { loansService, type ExecuteLoanParams } from '@/services/loans';
import { profilesService } from '@/services/profiles';
import { calculateFees, type LoanTier, type FeeBreakdown } from '@/types';

interface FineticSDKConfig {
  apiKey: string;            // Partner API key for revenue share tracking
  supabaseUrl?: string;      // Optional custom Supabase instance
  supabaseKey?: string;      // Optional custom Supabase key
  solanaNetwork?: 'devnet' | 'mainnet-beta';
}

export class FineticSDK {
  private apiKey: string;
  private platformName: string = '';

  constructor(config: FineticSDKConfig) {
    this.apiKey = config.apiKey;
  }

  // ==================
  // MARKETPLACE
  // ==================

  /** Get all active lending offers */
  async getOffers() {
    return offersService.getActive();
  }

  /** Get all active loan requests */
  async getRequests() {
    return requestsService.getActive();
  }

  /** Create a lending offer (lender publishes) */
  async createOffer(params: CreateOfferParams) {
    return offersService.create(params);
  }

  /** Create a loan request (borrower publishes) */
  async createRequest(params: CreateRequestParams) {
    return requestsService.create(params);
  }

  // ==================
  // LOANS
  // ==================

  /** Execute a loan with referral tracking */
  async executeLoan(params: Omit<ExecuteLoanParams, 'referral_platform'>) {
    return loansService.executeLoan({
      ...params,
      referral_platform: this.apiKey, // Track which platform originated the loan
    });
  }

  /** Repay a loan */
  async repayLoan(loanId: string, borrowerId: string, borrowerWallet: any) {
    return loansService.repayLoan(loanId, borrowerId, borrowerWallet);
  }

  /** Get loans for a user */
  async getUserLoans(userId: string) {
    return loansService.getByUser(userId);
  }

  // ==================
  // PROFILES & SCORING
  // ==================

  /** Get or create user profile */
  async getProfile(walletAddress: string) {
    return profilesService.getOrCreate(walletAddress);
  }

  /** Get user score history */
  async getScoreHistory(profileId: string) {
    return profilesService.getScoreHistory(profileId);
  }

  /** Get public loan history (transparency) */
  async getLoanHistory(profileId: string) {
    return profilesService.getLoanHistory(profileId);
  }

  /** Get leaderboard */
  async getLeaderboard(limit?: number) {
    return profilesService.getLeaderboard(limit);
  }

  // ==================
  // UTILITIES
  // ==================

  /** Calculate fee breakdown for a loan amount */
  calculateFees(amount: number, tier: LoanTier): FeeBreakdown {
    return calculateFees(amount, tier);
  }

  /** Get platform-wide statistics */
  async getStats() {
    return profilesService.getPlatformStats();
  }
}

// Default export for easy import
export default FineticSDK;

// Re-export types for SDK consumers
export type {
  CreateOfferParams,
  CreateRequestParams,
  ExecuteLoanParams,
  FeeBreakdown,
  LoanTier,
};
