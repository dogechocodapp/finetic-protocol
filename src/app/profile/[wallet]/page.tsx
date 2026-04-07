'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { ScoreBadge, StatCard } from '@/components/ui/ScoreBadge';
import { profilesService } from '@/services/profiles';
import { getScoreTier, SCORE_TIER_CONFIG, shortWallet, type Profile, type ScoreHistory, type LoanHistoryEntry } from '@/types';
import Link from 'next/link';

export default function ProfilePage() {
  const params = useParams();
  const wallet = params.wallet as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [loanHistory, setLoanHistory] = useState<LoanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    profilesService
      .getPublicProfile(wallet)
      .then(async (data) => {
        if (data.profile) {
          setProfile(data.profile);
          setScoreHistory(data.scoreHistory);
          setLoanHistory(data.loanHistory);
        } else {
          // Profile doesn't exist yet — create it (first visit)
          const created = await profilesService.getOrCreate(wallet);
          setProfile(created);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Header />
        <div className="text-center py-20 text-slate-500">Cargando perfil...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Header />
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-slate-500">Perfil no encontrado para {shortWallet(wallet)}</p>
          <Link href="/" className="text-purple-400 text-sm mt-4 inline-block hover:underline">Volver al Marketplace</Link>
        </div>
      </div>
    );
  }

  const tier = getScoreTier(profile.score);
  const tierConfig = SCORE_TIER_CONFIG[tier];
  const totalOps = profile.total_loans_as_lender + profile.total_loans_as_borrower;
  const totalVolume = profile.total_volume_lent + profile.total_volume_borrowed;
  const referralLink = profile.referral_code ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${profile.referral_code}` : '';

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black" style={{ background: `${tierConfig.color}20`, color: tierConfig.color }}>
              {tier === 'diamond' ? '◆' : tier === 'gold' ? '★' : profile.wallet_address.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold font-mono">{shortWallet(profile.wallet_address)}</span>
                <ScoreBadge score={profile.score} />
              </div>
              <div className="text-sm text-slate-400 mt-1">
                Miembro desde {new Date(profile.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <StatCard label="Score" value={profile.score.toString()} sub={tierConfig.label} />
            <StatCard label="Operaciones" value={totalOps.toString()} />
            <StatCard label="Volumen Total" value={`$${totalVolume > 0 ? (totalVolume / 1000).toFixed(0) + 'K' : '0'}`} />
            <StatCard label="Defaults" value={profile.defaults_as_borrower.toString()} sub={profile.defaults_as_borrower === 0 ? 'Limpio' : undefined} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">Como Prestamista</div>
            <div className="text-2xl font-extrabold">{profile.total_loans_as_lender}</div>
            <div className="text-sm text-slate-400">préstamos · ${profile.total_volume_lent.toLocaleString()} prestados</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">Como Cliente</div>
            <div className="text-2xl font-extrabold">{profile.total_loans_as_borrower}</div>
            <div className="text-sm text-slate-400">préstamos · ${profile.total_volume_borrowed.toLocaleString()} recibidos</div>
          </div>
        </div>

        {/* Referral Link */}
        {referralLink && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Tu Link de Referido</div>
            <div className="flex gap-2">
              <input
                readOnly
                value={referralLink}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm font-mono"
              />
              <button
                onClick={() => navigator.clipboard.writeText(referralLink)}
                className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-bold hover:bg-purple-600 transition"
              >
                Copiar
              </button>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Refiere usuarios y gana +50 puntos cuando completen un préstamo. Bonus: {profile.referral_bonus_earned} pts acumulados.
            </div>
          </div>
        )}

        {/* Score History */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">Historial de Score</div>
          {scoreHistory.length === 0 ? (
            <div className="text-sm text-slate-500 py-4 text-center">Sin eventos de score todavía.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {scoreHistory.slice(0, 15).map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-800/50">
                  <div>
                    <span className="text-sm font-semibold">{s.event.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-slate-500 ml-2">{new Date(s.created_at).toLocaleDateString('es')}</span>
                  </div>
                  <span className="font-bold text-sm" style={{ color: s.points >= 0 ? '#10B981' : '#EF4444' }}>
                    {s.points >= 0 ? '+' : ''}{s.points} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loan History */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">Historial de Operaciones</div>
          {loanHistory.length === 0 ? (
            <div className="text-sm text-slate-500 py-4 text-center">Sin operaciones todavía.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {loanHistory.slice(0, 20).map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-slate-800/50">
                  <div>
                    <span className="text-sm font-bold" style={{ color: h.action.includes('repay') ? '#10B981' : '#8B5CF6' }}>
                      {h.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">{new Date(h.created_at).toLocaleDateString('es')}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {h.amount ? `$${h.amount.toLocaleString()}` : ''} {h.token || ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="max-w-4xl mx-auto px-6 py-5 border-t border-slate-800 text-center">
        <span className="text-xs text-slate-600">Finetic Protocol · Solo para gente segura</span>
      </footer>
    </div>
  );
}
