// FINETIC PROTOCOL — "Solo para gente segura"
// Main exports

// Types
export * from '@/types';

// Services
export { offersService } from '@/services/offers';
export { requestsService } from '@/services/requests';
export { loansService } from '@/services/loans';
export { profilesService } from '@/services/profiles';

// Hooks
export {
  useProfile,
  useOffers,
  useRequests,
  useMyLoans,
  useScoreHistory,
  useLoanHistory,
  usePlatformStats,
  useLeaderboard,
} from '@/hooks/useFinetic';

// SDK
export { FineticSDK } from '@/lib/sdk';

// Solana helpers
export {
  FINETIC_PROGRAM_ID,
  connection,
  TOKEN_MINTS,
  TOKEN_DECIMALS,
  getOfferPDA,
  getLoanPDA,
  toTokenAmount,
  fromTokenAmount,
} from '@/lib/solana';
