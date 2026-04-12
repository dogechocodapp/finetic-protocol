import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { connection, FINETIC_PROGRAM_ID, getOfferPDA, getLoanPDA, getProtocolStatePDA } from './solana';
import idl from '../../target/idl/finetic_protocol.json';

// Fee wallet — Finetic's fee collection address (admin-controlled)
const FEE_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_FEE_WALLET || '47hsgTnKdJ8XDJR2L46BNRHRiEg52rFX6NxxrLhHdNC2'
);

export function getProgram(wallet: any): Program {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  return new Program(idl as any, provider);
}

export interface ExecuteLoanOnChainParams {
  offerId: number;
  loanId: number;
  loanAmount: BN;
  collateralAmount: BN;
  stableMint: PublicKey;
  collateralMint: PublicKey;
  lenderWallet: PublicKey;
  borrowerWallet: PublicKey;
}

export async function buildExecuteLoanTx(
  program: Program,
  params: ExecuteLoanOnChainParams,
) {
  const [offerPDA] = getOfferPDA(params.offerId);
  const [loanPDA] = getLoanPDA(params.loanId);
  const [protocolStatePDA] = getProtocolStatePDA();

  const borrowerCollateralAta = await getAssociatedTokenAddress(
    params.collateralMint,
    params.borrowerWallet,
  );
  const escrowCollateralAta = await getAssociatedTokenAddress(
    params.collateralMint,
    loanPDA,
    true,
  );
  const lenderStableAta = await getAssociatedTokenAddress(
    params.stableMint,
    params.lenderWallet,
  );
  const borrowerStableAta = await getAssociatedTokenAddress(
    params.stableMint,
    params.borrowerWallet,
  );
  const feeAta = await getAssociatedTokenAddress(
    params.stableMint,
    FEE_WALLET,
  );

  return program.methods
    .executeLoan(
      new BN(params.loanId),
      params.collateralAmount,
      params.loanAmount,
    )
    .accounts({
      offer: offerPDA,
      loan: loanPDA,
      protocolState: protocolStatePDA,
      lender: params.lenderWallet,
      borrower: params.borrowerWallet,
      collateralMint: params.collateralMint,
      borrowerCollateralAccount: borrowerCollateralAta,
      escrowCollateralAccount: escrowCollateralAta,
      lenderStableAccount: lenderStableAta,
      borrowerStableAccount: borrowerStableAta,
      feeAccount: feeAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export interface RepayLoanOnChainParams {
  loanId: number;
  stableMint: PublicKey;
  collateralMint: PublicKey;
  borrowerWallet: PublicKey;
  lenderWallet: PublicKey;
}

export async function buildRepayLoanTx(
  program: Program,
  params: RepayLoanOnChainParams,
) {
  const [loanPDA] = getLoanPDA(params.loanId);

  const borrowerStableAta = await getAssociatedTokenAddress(
    params.stableMint,
    params.borrowerWallet,
  );
  const lenderStableAta = await getAssociatedTokenAddress(
    params.stableMint,
    params.lenderWallet,
  );
  const feeAta = await getAssociatedTokenAddress(
    params.stableMint,
    FEE_WALLET,
  );
  const escrowCollateralAta = await getAssociatedTokenAddress(
    params.collateralMint,
    loanPDA,
    true,
  );
  const borrowerCollateralAta = await getAssociatedTokenAddress(
    params.collateralMint,
    params.borrowerWallet,
  );

  return program.methods
    .repayLoan()
    .accounts({
      loan: loanPDA,
      borrower: params.borrowerWallet,
      borrowerStableAccount: borrowerStableAta,
      lenderStableAccount: lenderStableAta,
      feeAccount: feeAta,
      escrowCollateralAccount: escrowCollateralAta,
      borrowerCollateralAccount: borrowerCollateralAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();
}

export interface ClaimDefaultOnChainParams {
  loanId: number;
  collateralMint: PublicKey;
  lenderWallet: PublicKey;
}

export async function buildClaimDefaultTx(
  program: Program,
  params: ClaimDefaultOnChainParams,
) {
  const [loanPDA] = getLoanPDA(params.loanId);

  const escrowCollateralAta = await getAssociatedTokenAddress(
    params.collateralMint,
    loanPDA,
    true,
  );
  const lenderCollateralAta = await getAssociatedTokenAddress(
    params.collateralMint,
    params.lenderWallet,
  );

  return program.methods
    .claimDefault()
    .accounts({
      loan: loanPDA,
      lender: params.lenderWallet,
      escrowCollateralAccount: escrowCollateralAta,
      lenderCollateralAccount: lenderCollateralAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();
}

export interface RenewLoanOnChainParams {
  oldLoanId: number;
  newLoanId: number;
  stableMint: PublicKey;
  borrowerWallet: PublicKey;
  lenderWallet: PublicKey;
}

export async function buildRenewLoanTx(
  program: Program,
  params: RenewLoanOnChainParams,
) {
  const [oldLoanPDA] = getLoanPDA(params.oldLoanId);
  const [newLoanPDA] = getLoanPDA(params.newLoanId);

  const borrowerStableAta = await getAssociatedTokenAddress(
    params.stableMint,
    params.borrowerWallet,
  );
  const feeAta = await getAssociatedTokenAddress(
    params.stableMint,
    FEE_WALLET,
  );

  return program.methods
    .renewLoan(new BN(params.newLoanId))
    .accounts({
      oldLoan: oldLoanPDA,
      newLoan: newLoanPDA,
      borrower: params.borrowerWallet,
      lender: params.lenderWallet,
      borrowerStableAccount: borrowerStableAta,
      feeAccount: feeAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}
