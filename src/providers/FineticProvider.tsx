'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { profilesService } from '@/services/profiles';
import type { Profile } from '@/types';

interface FineticContextType {
  profile: Profile | null;
  loading: boolean;
  connected: boolean;
  walletAddress: string | null;
  refreshProfile: () => Promise<void>;
}

const FineticContext = createContext<FineticContextType>({
  profile: null,
  loading: false,
  connected: false,
  walletAddress: null,
  refreshProfile: async () => {},
});

export function FineticProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const walletAddress = publicKey?.toBase58() || null;

  const refreshProfile = async () => {
    if (!walletAddress) return;
    try {
      const p = await profilesService.getOrCreate(walletAddress);
      setProfile(p);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  useEffect(() => {
    if (!walletAddress) {
      setProfile(null);
      return;
    }

    setLoading(true);
    profilesService
      .getOrCreate(walletAddress)
      .then(async (p) => {
        setProfile(p);

        // Handle referral code from URL
        if (typeof window !== 'undefined' && !p.referred_by) {
          const params = new URLSearchParams(window.location.search);
          const refCode = params.get('ref');
          if (refCode && refCode !== p.referral_code) {
            try {
              const referrer = await profilesService.getByReferralCode(refCode);
              if (referrer && referrer.id !== p.id) {
                await profilesService.setReferrer(p.id, referrer.id);
              }
            } catch {
              // Silently fail on referral linking
            }
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [walletAddress]);

  return (
    <FineticContext.Provider value={{ profile, loading, connected, walletAddress, refreshProfile }}>
      {children}
    </FineticContext.Provider>
  );
}

export function useFinetic() {
  return useContext(FineticContext);
}
