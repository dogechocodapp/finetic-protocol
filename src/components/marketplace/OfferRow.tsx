'use client';

import { ScoreBadge, TierTag, TokenIcon, CollateralTags } from '@/components/ui/ScoreBadge';
import { shortWallet, type OfferWithLender } from '@/types';
import Link from 'next/link';

export function OfferRow({ offer, connected, onAccept }: { offer: OfferWithLender; connected: boolean; onAccept: (o: OfferWithLender) => void }) {
  const wallet = offer.lender?.wallet_address || '';

  return (
    <div
      className="grid items-center px-5 py-4 bg-slate-900 border border-slate-800 rounded-xl transition-all cursor-pointer hover:border-purple-500/25"
      style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr 1fr' }}
    >
      <div className="flex flex-col gap-1">
        <Link href={`/profile/${wallet}`} className="font-bold text-sm font-mono text-purple-400 hover:underline">
          {shortWallet(wallet)}
        </Link>
        <div className="flex items-center gap-1.5">
          <ScoreBadge score={offer.lender?.score || 0} />
          <span className="text-[11px] text-slate-500">{offer.lender?.total_loans_as_lender || 0} ops</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <TokenIcon token={offer.stable_token} />
        <span className="font-semibold">{offer.stable_token}</span>
      </div>
      <span className="font-bold text-base">${offer.amount.toLocaleString()}</span>
      <CollateralTags collaterals={offer.accepted_collaterals} />
      <TierTag tier={offer.tier} />
      <span className="text-slate-400 font-semibold text-sm">{offer.term_months}m</span>
      <button
        onClick={() => connected && onAccept(offer)}
        className="px-4 py-2 rounded-lg font-bold text-xs text-white"
        style={{
          background: connected ? 'linear-gradient(135deg, #8B5CF6, #06B6D4)' : '#1E293B',
          opacity: connected ? 1 : 0.5,
          cursor: connected ? 'pointer' : 'default',
          border: 'none',
        }}
      >
        {connected ? 'Negociar' : 'Conectar'}
      </button>
    </div>
  );
}
