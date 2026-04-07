import { supabase } from '@/lib/supabase';
import type { LoanRequest, RequestWithBorrower, LoanTier, StableToken, CollateralToken } from '@/types';

export interface CreateRequestParams {
  borrower_id: string;
  stable_token: StableToken;
  amount: number;
  collateral_token: CollateralToken;
  collateral_amount: number;
  tier: LoanTier;
  term_months: 12 | 24;
  description?: string;
  allow_partial?: boolean;
  min_contribution?: number;
  ltv_info?: number;
}

export const requestsService = {
  async getActive(): Promise<RequestWithBorrower[]> {
    const { data, error } = await supabase
      .from('requests')
      .select('*, borrower:profiles!borrower_id(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as RequestWithBorrower[];
  },

  async getByBorrower(borrowerId: string): Promise<LoanRequest[]> {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('borrower_id', borrowerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as LoanRequest[];
  },

  async create(params: CreateRequestParams): Promise<LoanRequest> {
    const { data, error } = await supabase
      .from('requests')
      .insert({
        ...params,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data as LoanRequest;
  },

  async cancel(requestId: string, borrowerId: string): Promise<void> {
    const { error } = await supabase
      .from('requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('borrower_id', borrowerId);

    if (error) throw error;
  },

  async markMatched(requestId: string): Promise<void> {
    const { error } = await supabase
      .from('requests')
      .update({ status: 'matched' })
      .eq('id', requestId);

    if (error) throw error;
  },
};
