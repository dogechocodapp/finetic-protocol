import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  const supabase = getSupabase();

  if (!wallet || wallet.length < 20) {
    return NextResponse.json(
      { success: false, error: 'Invalid wallet address' },
      { status: 400 },
    );
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('wallet_address, score, total_loans_as_lender, total_loans_as_borrower, total_volume_lent, total_volume_borrowed, defaults_as_borrower, defaults_as_lender, created_at')
    .eq('wallet_address', wallet)
    .single();

  if (error || !profile) {
    return NextResponse.json(
      { success: false, error: 'Profile not found', wallet },
      { status: 404 },
    );
  }

  const score = profile.score as number;
  let tier: string;
  if (score >= 1000) tier = 'diamond';
  else if (score >= 500) tier = 'gold';
  else if (score >= 200) tier = 'silver';
  else if (score >= 50) tier = 'bronze';
  else tier = 'new';

  return NextResponse.json({
    success: true,
    data: {
      wallet: profile.wallet_address,
      score,
      tier,
      total_loans: profile.total_loans_as_lender + profile.total_loans_as_borrower,
      total_volume: profile.total_volume_lent + profile.total_volume_borrowed,
      defaults: profile.defaults_as_borrower,
      member_since: profile.created_at,
    },
    meta: {
      protocol: 'Finetic Protocol',
      version: '1.0',
      description: 'Public scoring API — The credit bureau of DeFi',
    },
  });
}
