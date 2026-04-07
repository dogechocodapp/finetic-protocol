'use client';

import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false },
);

export function WalletButton() {
  return <WalletMultiButton />;
}
