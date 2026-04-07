import { supabase } from '@/lib/supabase';
import type { Profile, ScoreHistory, LoanHistoryEntry } from '@/types';

export const profilesService = {
  // Get or create profile by wallet address
  async getOrCreate(walletAddress: string): Promise<Profile> {
    // Try to get existing — use maybeSingle() to avoid 406 on 0 rows
    const { data: existing, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (existing) return existing as Profile;
    if (selectError) console.error('Profile lookup error:', selectError);

    // Create new profile
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        wallet_address: walletAddress,
        role: 'both',
        score: 0,
        subscription: 'free',
        referral_code: walletAddress.slice(0, 8),
      })
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  },

  // Get profile by wallet
  async getByWallet(walletAddress: string): Promise<Profile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    return (data as Profile) || null;
  },

  // Get profile by ID
  async getById(id: string): Promise<Profile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    return (data as Profile) || null;
  },

  // Update display name
  async updateName(id: string, displayName: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', id);

    if (error) throw error;
  },

  // Get score history for a profile
  async getScoreHistory(profileId: string): Promise<ScoreHistory[]> {
    const { data, error } = await supabase
      .from('score_history')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ScoreHistory[];
  },

  // Get loan history for a profile (public — the transparency layer)
  async getLoanHistory(profileId: string): Promise<LoanHistoryEntry[]> {
    const { data, error } = await supabase
      .from('loan_history')
      .select('*, actor:profiles!actor_id(*)')
      .eq('actor_id', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as LoanHistoryEntry[];
  },

  // Get top users by score (leaderboard)
  async getLeaderboard(limit: number = 20): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .gt('score', 0)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as Profile[];
  },

  // Get platform stats
  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalVolume: number;
    activeLoans: number;
    avgScore: number;
    defaultRate: number;
  }> {
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { data: volumeData } = await supabase
      .from('loans')
      .select('loan_amount, status');

    const totalVolume = volumeData?.reduce((sum, l) => sum + l.loan_amount, 0) || 0;
    const activeLoans = volumeData?.filter(l => l.status === 'active').length || 0;
    const defaults = volumeData?.filter(l => l.status === 'defaulted').length || 0;
    const completed = volumeData?.length || 1;

    const { data: scoreData } = await supabase
      .from('profiles')
      .select('score')
      .gt('score', 0);

    const avgScore = scoreData?.length
      ? Math.round(scoreData.reduce((sum, p) => sum + p.score, 0) / scoreData.length)
      : 0;

    return {
      totalUsers: totalUsers || 0,
      totalVolume,
      activeLoans,
      avgScore,
      defaultRate: (defaults / completed) * 100,
    };
  },

  async getByReferralCode(code: string): Promise<Profile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('referral_code', code)
      .maybeSingle();

    return (data as Profile) || null;
  },

  async setReferrer(profileId: string, referrerId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ referred_by: referrerId })
      .eq('id', profileId)
      .is('referred_by', null);

    if (error) throw error;
  },

  async getPublicProfile(walletAddress: string): Promise<{
    profile: Profile | null;
    scoreHistory: ScoreHistory[];
    loanHistory: LoanHistoryEntry[];
  }> {
    const profile = await profilesService.getByWallet(walletAddress);
    if (!profile) return { profile: null, scoreHistory: [], loanHistory: [] };

    const [scoreHistory, loanHistory] = await Promise.all([
      profilesService.getScoreHistory(profile.id),
      profilesService.getLoanHistory(profile.id),
    ]);

    return { profile, scoreHistory, loanHistory };
  },
};
