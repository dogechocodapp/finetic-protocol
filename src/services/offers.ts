import { supabase } from '@/lib/supabase';
import type { Offer, OfferWithLender, LoanTier, StableToken, CollateralToken } from '@/types';

export interface CreateOfferParams {
  lender_id: string;
  stable_token: StableToken;
  amount: number;
  min_amount?: number;
  accepted_collaterals: CollateralToken[];
  tier: LoanTier;
  term_months: 12 | 24;
  description?: string;
}

export const offersService = {
  // Fetch all active offers with lender profiles
  async getActive(): Promise<OfferWithLender[]> {
    const { data, error } = await supabase
      .from('offers')
      .select('*, lender:profiles!lender_id(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as OfferWithLender[];
  },

  // Fetch offers filtered by token
  async getByToken(token: StableToken): Promise<OfferWithLender[]> {
    const { data, error } = await supabase
      .from('offers')
      .select('*, lender:profiles!lender_id(*)')
      .eq('status', 'active')
      .eq('stable_token', token)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as OfferWithLender[];
  },

  // Fetch offers by lender
  async getByLender(lenderId: string): Promise<Offer[]> {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('lender_id', lenderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Offer[];
  },

  // Create new offer
  async create(params: CreateOfferParams): Promise<Offer> {
    const { data, error } = await supabase
      .from('offers')
      .insert({
        ...params,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data as Offer;
  },

  // Cancel offer
  async cancel(offerId: string, lenderId: string): Promise<void> {
    const { error } = await supabase
      .from('offers')
      .update({ status: 'cancelled' })
      .eq('id', offerId)
      .eq('lender_id', lenderId);

    if (error) throw error;
  },

  // Mark as matched
  async markMatched(offerId: string): Promise<void> {
    const { error } = await supabase
      .from('offers')
      .update({ status: 'matched' })
      .eq('id', offerId);

    if (error) throw error;
  },
};
