'use client';

import { ScoreBadge, TierTag, TokenIcon } from '@/components/ui/ScoreBadge';
import { shortWallet, type RequestWithBorrower } from '@/types';
import Link from 'next/link';

export function RequestRow({ request, connected, onFund }: { request: RequestWithBorrower; connected: boolean; onFund: (r: RequestWithBorrower) => void }) {
  const wallet = request.borrower?.wallet_address || '';
  const fundedPct = request.amount > 0 ? Math.min(100, ((request.funded_amount || 0) / request.amount) * 100) : 0;
  const remaining = request.amount - (request.funded_amount || 0);

  return (
    <div
      className="grid items-center px-5 py-4 bg-slate-900 border border-slate-800 rounded-xl transition-all cursor-pointer hover:border-emerald-500/25"
      style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr 1fr 0.8fr 1fr' }}
    >
      <div className="flex flex-col gap-1">
        <Link href={`/profile/${wallet}`} className="font-bold text-sm font-mono text-purple-400 hover:underline">
          {shortWallet(wallet)}
        </Link>
        <div className="flex items-center gap-1.5">
          <ScoreBadge score={request.borrower?.score || 0} />
          <span className="text-[11px] text-slate-500">{request.borrower?.total_loans_as_borrower || 0} ops</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <TokenIcon token={request.stable_token} />
        <span className="font-semibold">{request.stable_token}</span>
      </div>
      <div>
        <span className="font-bold text-base">${request.amount.toLocaleString()}</span>
        {request.allow_partial && (request.funded_amount || 0) > 0 && (
          <div className="mt-1">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${fundedPct}%` }} />
            </div>
            <span className="text-[10px] text-slate-500">${remaining.toLocaleString()} restante</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <TokenIcon token={request.collateral_token} />
        <span className="font-semibold">{request.collateral_amount} {request.collateral_token}</span>
      </div>
      <TierTag tier={request.tier} />
      <span className="text-slate-400 font-semibold text-sm">{request.term_months}m</span>
      <button
        onClick={() => connected && onFund(request)}
        className="px-4 py-2 rounded-lg font-bold text-xs text-white"
        style={{
          background: connected ? '#10B981' : '#1E293B',
          opacity: connected ? 1 : 0.5,
          cursor: connected ? 'pointer' : 'default',
          border: 'none',
        }}
      >
        {connected ? 'Financiar' : 'Conectar'}
      </button>
    </div>
  );
}
