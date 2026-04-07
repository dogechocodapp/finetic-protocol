import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';

// Program ID — replace with actual deployed address
export const FINETIC_PROGRAM_ID = new PublicKey('FNtc1111111111111111111111111111111111111111');

// Solana connection
const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
export const connection = new Connection(
  network === 'mainnet-beta' 
    ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta')
    : clusterApiUrl('devnet'),
  'confirmed'
);

// Known SPL token mints on Solana
export const TOKEN_MINTS: Record<string, PublicKey> = {
  // Mainnet
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  // Wrapped BTC/ETH/BNB on Solana (Wormhole)
  BTC: new PublicKey('3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh'),
  ETH: new PublicKey('7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs'),
  BNB: new PublicKey('9gP2kCy3wA1ctvYWQk75guqXuHfrEomqydHLtcTCqiLa'),
};

// PDA derivation helpers
export function getProtocolStatePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('protocol')],
    FINETIC_PROGRAM_ID
  );
}

export function getOfferPDA(offerId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(offerId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('offer'), buf],
    FINETIC_PROGRAM_ID
  );
}

export function getLoanPDA(loanId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(loanId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('loan'), buf],
    FINETIC_PROGRAM_ID
  );
}

// Get Anchor provider from wallet adapter
export function getProvider(wallet: any): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
}

// Convert UI amount to on-chain amount (handle decimals)
export function toTokenAmount(amount: number, decimals: number = 6): BN {
  return new BN(Math.floor(amount * Math.pow(10, decimals)));
}

// Convert on-chain amount to UI amount
export function fromTokenAmount(amount: BN, decimals: number = 6): number {
  return amount.toNumber() / Math.pow(10, decimals);
}

// Token decimals map
export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  SOL: 9,
  BTC: 8,
  ETH: 8,
  BNB: 8,
};
