'use client';

import { FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/ui/WalletButton';
import { useFinetic } from '@/providers/FineticProvider';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { getScoreTier, SCORE_TIER_CONFIG } from '@/types';
import Link from 'next/link';

export const Header: FC = () => {
  const { publicKey } = useWallet();
  const { profile } = useFinetic();

  const walletAddress = publicKey?.toBase58() || null;
  const tier = profile ? getScoreTier(profile.score) : null;
  const tierConfig = tier ? SCORE_TIER_CONFIG[tier] : null;

  return (
    <header className="border-b border-slate-800" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1a1147 50%, #0F172A 100%)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-base"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}>
                F
              </div>
              <span className="text-lg font-extrabold tracking-tight">FINETIC</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ color: '#8B5CF6', background: '#8B5CF618' }}>
                PROTOCOL
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-semibold text-slate-400 hover:text-white transition">Marketplace</Link>
            <Link href="/simulator" className="text-sm font-semibold text-slate-400 hover:text-white transition">Simulador</Link>
            {walletAddress && (
              <Link href={`/profile/${walletAddress}`} className="text-sm font-semibold text-slate-400 hover:text-white transition">Mi Perfil</Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {profile && tierConfig && (
              <Link
                href={`/profile/${walletAddress}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold hover:opacity-80 transition"
                style={{
                  background: `${tierConfig.color}18`,
                  color: tierConfig.color,
                  border: `1px solid ${tierConfig.color}40`,
                }}
              >
                {tier === 'diamond' && '◆ '}{tierConfig.label} · {profile.score}
              </Link>
            )}
            <NotificationBell profileId={profile?.id || null} />
            <WalletButton />
          </div>
        </div>
      </div>
      <div className="text-center py-1.5" style={{ background: 'linear-gradient(90deg, #8B5CF620, #06B6D420)' }}>
        <span className="text-[11px] font-bold tracking-widest text-slate-400">
          SOLO PARA GENTE SEGURA
        </span>
      </div>
    </header>
  );
};
