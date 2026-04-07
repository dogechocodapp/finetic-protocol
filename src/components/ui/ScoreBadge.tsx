import { getScoreTier, SCORE_TIER_CONFIG, type LoanTier } from '@/types';

export function ScoreBadge({ score }: { score: number }) {
  const tier = getScoreTier(score);
  const { label, color } = SCORE_TIER_CONFIG[tier];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
      {tier === 'diamond' && '◆ '}{label} · {score}
    </span>
  );
}

export function TierTag({ tier }: { tier: LoanTier }) {
  const isHigh = tier === 'high';
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
      style={{ background: isHigh ? '#DC262618' : '#10B98118', color: isHigh ? '#DC2626' : '#10B981', border: `1px solid ${isHigh ? '#DC262640' : '#10B98140'}` }}>
      {isHigh ? '20% APY' : '10% APY'}
    </span>
  );
}

const TOKEN_COLORS: Record<string, string> = { USDC: '#2775CA', USDT: '#26A17B', BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', BNB: '#F3BA2F' };

export function TokenIcon({ token, size = 24 }: { token: string; size?: number }) {
  const color = TOKEN_COLORS[token] || '#64748B';
  return (
    <span className="inline-flex items-center justify-center rounded-full font-extrabold"
      style={{ width: size, height: size, background: `${color}20`, color, fontSize: size * 0.42 }}>
      {token.slice(0, 1)}
    </span>
  );
}

export function CollateralTags({ collaterals }: { collaterals: string[] }) {
  return (
    <div className="flex gap-1">
      {collaterals.map(c => (
        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{c}</span>
      ))}
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 flex-1 min-w-[140px]">
      <div className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-extrabold text-slate-50 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-emerald-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function LTVBadge({ ltv }: { ltv: number }) {
  const color = ltv <= 40 ? '#10B981' : ltv <= 60 ? '#F59E0B' : ltv <= 80 ? '#F97316' : '#EF4444';
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
      LTV {ltv}%
    </span>
  );
}
