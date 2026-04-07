import { useState, useEffect, useCallback } from 'react';
import { offersService } from '@/services/offers';
import { requestsService } from '@/services/requests';
import { loansService } from '@/services/loans';
import { profilesService } from '@/services/profiles';
import type { 
  Profile, OfferWithLender, RequestWithBorrower, 
  LoanWithParties, ScoreHistory, LoanHistoryEntry 
} from '@/types';

// ============================================
// Wallet & Profile Hook
// ============================================
export function useProfile(walletAddress: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setProfile(null);
      return;
    }

    setLoading(true);
    profilesService
      .getOrCreate(walletAddress)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [walletAddress]);

  const refresh = useCallback(() => {
    if (walletAddress) {
      profilesService.getOrCreate(walletAddress).then(setProfile);
    }
  }, [walletAddress]);

  return { profile, loading, refresh };
}

// ============================================
// Offers Hook
// ============================================
export function useOffers() {
  const [offers, setOffers] = useState<OfferWithLender[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await offersService.getActive();
      setOffers(data);
    } catch (error) {
      console.error('Error fetching offers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { offers, loading, refresh: fetch };
}

// ============================================
// Requests Hook
// ============================================
export function useRequests() {
  const [requests, setRequests] = useState<RequestWithBorrower[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestsService.getActive();
      setRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { requests, loading, refresh: fetch };
}

// ============================================
// User Loans Hook
// ============================================
export function useMyLoans(userId: string | null) {
  const [loans, setLoans] = useState<LoanWithParties[]>([]);
  const [activeLoans, setActiveLoans] = useState<LoanWithParties[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [all, active] = await Promise.all([
        loansService.getByUser(userId),
        loansService.getActiveByUser(userId),
      ]);
      setLoans(all);
      setActiveLoans(active);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { loans, activeLoans, loading, refresh: fetch };
}

// ============================================
// Score History Hook
// ============================================
export function useScoreHistory(profileId: string | null) {
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    profilesService
      .getScoreHistory(profileId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [profileId]);

  return { history, loading };
}

// ============================================
// Public Loan History Hook (transparency layer)
// ============================================
export function useLoanHistory(profileId: string | null) {
  const [history, setHistory] = useState<LoanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    profilesService
      .getLoanHistory(profileId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [profileId]);

  return { history, loading };
}

// ============================================
// Platform Stats Hook
// ============================================
export function usePlatformStats() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVolume: 0,
    activeLoans: 0,
    avgScore: 0,
    defaultRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profilesService
      .getPlatformStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

// ============================================
// Leaderboard Hook
// ============================================
export function useLeaderboard(limit: number = 20) {
  const [leaders, setLeaders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profilesService
      .getLeaderboard(limit)
      .then(setLeaders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [limit]);

  return { leaders, loading };
}
