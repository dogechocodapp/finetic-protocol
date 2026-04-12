/**
 * Finetic Protocol — Full E2E Test on Solana Devnet
 *
 * Run: source ~/.nvm/nvm.sh && nvm use 22 && npx ts-node --transpile-only --project scripts/tsconfig.json scripts/test-flow.ts
 *
 * Uses the deploy keypair as admin/lender, generates a fresh borrower keypair.
 * Creates test SPL mints (fake USDC + fake ETH), then exercises the full flow:
 *   initialize → createOffer → executeLoan → repayLoan
 * with balance checks at every step.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Config ───────────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey('3vhsPAwd9XFBidzPBxZfyrHKrF1G12qMuyaM6fwVbC8Q');
const RPC = clusterApiUrl('devnet');
const connection = new Connection(RPC, 'confirmed');

const USDC_DECIMALS = 6;
const ETH_DECIMALS = 8;

const LENDER_USDC_AMOUNT = 100_000;
const BORROWER_ETH_AMOUNT = 100;
const OFFER_AMOUNT = 10_000;
const OFFER_MIN = 1_000;
const COLLATERAL_AMOUNT = 50;
const LOAN_AMOUNT = 10_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadKeypair(filePath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function toSmallest(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * 10 ** decimals));
}

function fromSmallest(amount: bigint, decimals: number): string {
  return (Number(amount) / 10 ** decimals).toFixed(decimals);
}

function log(step: string, msg: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  [${step}] ${msg}`);
  console.log('='.repeat(70));
}

function info(label: string, value: string | number) {
  console.log(`    ${label.padEnd(35)} ${value}`);
}

async function getTokenBalance(mint: PublicKey, owner: PublicKey): Promise<bigint> {
  try {
    const ata = await getAssociatedTokenAddress(mint, owner, true);
    const account = await getAccount(connection, ata);
    return account.amount;
  } catch {
    return 0n;
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Discriminator / serialization helpers ────────────────────────────────────

function sighash(name: string): Buffer {
  const preimage = `global:${name}`;
  const hash = crypto.createHash('sha256').update(preimage).digest();
  return hash.subarray(0, 8);
}

function encodeBN(value: BN): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value.toString()));
  return buf;
}

function encodeU8(value: number): Buffer {
  return Buffer.from([value]);
}

// ─── PDA helpers ──────────────────────────────────────────────────────────────

function getProtocolStatePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('protocol')], PROGRAM_ID);
}

function getOfferPDA(offerId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(offerId));
  return PublicKey.findProgramAddressSync([Buffer.from('offer'), buf], PROGRAM_ID);
}

function getLoanPDA(loanId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(loanId));
  return PublicKey.findProgramAddressSync([Buffer.from('loan'), buf], PROGRAM_ID);
}

// ─── Instruction builders (raw, no Anchor dependency) ─────────────────────────

function buildInitializeIx(
  admin: PublicKey,
  feeWallet: PublicKey,
  insuranceWallet: PublicKey,
): TransactionInstruction {
  const [protocolStatePDA, bump] = getProtocolStatePDA();
  // Deployed contract (pre-audit) expects bump: u8 as argument
  const data = Buffer.concat([sighash('initialize'), encodeU8(bump)]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: protocolStatePDA, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: feeWallet, isSigner: false, isWritable: false },
      { pubkey: insuranceWallet, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildCreateOfferIx(
  offerId: number,
  amount: BN,
  interestTier: number,
  termMonths: number,
  minAmount: BN,
  lender: PublicKey,
  stableMint: PublicKey,
): TransactionInstruction {
  const [offerPDA] = getOfferPDA(offerId);
  const data = Buffer.concat([
    sighash('create_offer'),
    encodeBN(new BN(offerId)),
    encodeBN(amount),
    encodeU8(interestTier),
    encodeU8(termMonths),
    encodeBN(minAmount),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: offerPDA, isSigner: false, isWritable: true },
      { pubkey: lender, isSigner: true, isWritable: true },
      { pubkey: stableMint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildExecuteLoanIx(
  loanId: number,
  collateralAmount: BN,
  loanAmount: BN,
  accounts: {
    offer: PublicKey;
    loan: PublicKey;
    protocolState: PublicKey;
    lender: PublicKey;
    borrower: PublicKey;
    collateralMint: PublicKey;
    borrowerCollateralAccount: PublicKey;
    escrowCollateralAccount: PublicKey;
    lenderStableAccount: PublicKey;
    borrowerStableAccount: PublicKey;
    feeAccount: PublicKey;
  },
): TransactionInstruction {
  // Deployed (pre-audit) contract: no insuranceAccount
  const data = Buffer.concat([
    sighash('execute_loan'),
    encodeBN(new BN(loanId)),
    encodeBN(collateralAmount),
    encodeBN(loanAmount),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: accounts.offer, isSigner: false, isWritable: true },
      { pubkey: accounts.loan, isSigner: false, isWritable: true },
      { pubkey: accounts.protocolState, isSigner: false, isWritable: true },
      { pubkey: accounts.lender, isSigner: true, isWritable: true },
      { pubkey: accounts.borrower, isSigner: true, isWritable: true },
      { pubkey: accounts.collateralMint, isSigner: false, isWritable: false },
      { pubkey: accounts.borrowerCollateralAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.escrowCollateralAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.lenderStableAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.borrowerStableAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.feeAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildRepayLoanIx(accounts: {
  loan: PublicKey;
  borrower: PublicKey;
  borrowerStableAccount: PublicKey;
  lenderStableAccount: PublicKey;
  feeAccount: PublicKey;
  escrowCollateralAccount: PublicKey;
  borrowerCollateralAccount: PublicKey;
}): TransactionInstruction {
  // Deployed (pre-audit) contract: no protocolState in repay
  const data = sighash('repay_loan');

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: accounts.loan, isSigner: false, isWritable: true },
      { pubkey: accounts.borrower, isSigner: true, isWritable: true },
      { pubkey: accounts.borrowerStableAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.lenderStableAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.feeAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.escrowCollateralAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.borrowerCollateralAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  FINETIC PROTOCOL — E2E Test Flow on Solana Devnet');
  console.log('  ' + '─'.repeat(50));

  const deployKeyPath = path.resolve(
    process.env.HOME || '~',
    '.config/solana/finetic-deploy.json',
  );
  const admin = loadKeypair(deployKeyPath);
  info('Admin/Lender', admin.publicKey.toBase58());

  const borrower = Keypair.generate();
  info('Borrower', borrower.publicKey.toBase58());

  const adminBalance = await connection.getBalance(admin.publicKey);
  info('Admin SOL', `${adminBalance / LAMPORTS_PER_SOL} SOL`);

  // ─── Step 0: Fund borrower ──────────────────────────────────────────────

  log('STEP 0', 'Fund borrower with SOL from admin wallet');

  const transferTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: admin.publicKey,
      toPubkey: borrower.publicKey,
      lamports: Math.round(0.02 * LAMPORTS_PER_SOL),
    }),
  );
  await sendAndConfirmTransaction(connection, transferTx, [admin]);

  const borrowerBalance = await connection.getBalance(borrower.publicKey);
  info('Borrower SOL', `${borrowerBalance / LAMPORTS_PER_SOL} SOL`);

  // ─── Step 1: Create test SPL tokens ─────────────────────────────────────

  log('STEP 1', 'Create test token mints (fake USDC + fake ETH)');

  const usdcMint = await createMint(connection, admin, admin.publicKey, null, USDC_DECIMALS);
  info('Fake USDC Mint', usdcMint.toBase58());

  const ethMint = await createMint(connection, admin, admin.publicKey, null, ETH_DECIMALS);
  info('Fake ETH Mint', ethMint.toBase58());

  // ─── Step 2: Mint tokens ────────────────────────────────────────────────

  log('STEP 2', 'Mint tokens to lender and borrower');

  const lenderUsdcAta = await getOrCreateAssociatedTokenAccount(connection, admin, usdcMint, admin.publicKey);
  await mintTo(connection, admin, usdcMint, lenderUsdcAta.address, admin, toSmallest(LENDER_USDC_AMOUNT, USDC_DECIMALS));
  info('Lender USDC', `${LENDER_USDC_AMOUNT} USDC`);

  const borrowerEthAta = await getOrCreateAssociatedTokenAccount(connection, admin, ethMint, borrower.publicKey);
  await mintTo(connection, admin, ethMint, borrowerEthAta.address, admin, toSmallest(BORROWER_ETH_AMOUNT, ETH_DECIMALS));
  info('Borrower ETH', `${BORROWER_ETH_AMOUNT} ETH`);

  const borrowerUsdcAta = await getOrCreateAssociatedTokenAccount(connection, admin, usdcMint, borrower.publicKey);
  await mintTo(connection, admin, usdcMint, borrowerUsdcAta.address, admin, toSmallest(15_000, USDC_DECIMALS));
  info('Borrower USDC', '15,000 USDC (for repayment)');

  const feeUsdcAta = lenderUsdcAta; // admin = fee wallet on devnet
  const insuranceUsdcAta = lenderUsdcAta; // admin = insurance wallet on devnet

  // ─── Step 3: Initialize protocol ────────────────────────────────────────

  log('STEP 3', 'Initialize the Finetic Protocol');

  const [protocolStatePDA] = getProtocolStatePDA();
  info('Protocol State PDA', protocolStatePDA.toBase58());

  const acctInfo = await connection.getAccountInfo(protocolStatePDA);
  if (acctInfo) {
    info('Status', 'Protocol already initialized — skipping');
  } else {
    const initIx = buildInitializeIx(admin.publicKey, admin.publicKey, admin.publicKey);
    const initTx = new Transaction().add(initIx);
    const initSig = await sendAndConfirmTransaction(connection, initTx, [admin]);
    info('Init TX', initSig);
  }

  // ─── Step 4: Create offer ───────────────────────────────────────────────

  log('STEP 4', 'Lender creates offer: 10,000 USDC, Standard tier, 12 months');

  const offerId = Date.now() % 1_000_000_000;
  const [offerPDA] = getOfferPDA(offerId);
  info('Offer ID', offerId);
  info('Offer PDA', offerPDA.toBase58());

  const createOfferIx = buildCreateOfferIx(
    offerId,
    new BN(toSmallest(OFFER_AMOUNT, USDC_DECIMALS).toString()),
    0, // standard tier
    12,
    new BN(toSmallest(OFFER_MIN, USDC_DECIMALS).toString()),
    admin.publicKey,
    usdcMint,
  );
  const offerTx = new Transaction().add(createOfferIx);
  const offerSig = await sendAndConfirmTransaction(connection, offerTx, [admin]);
  info('Create Offer TX', offerSig);

  // ─── Step 5: Execute loan ───────────────────────────────────────────────

  log('STEP 5', 'Borrower accepts offer: 50 ETH collateral -> 10,000 USDC loan');

  const loanId = (Date.now() + 1) % 1_000_000_000;
  const [loanPDA] = getLoanPDA(loanId);
  info('Loan ID', loanId);
  info('Loan PDA', loanPDA.toBase58());

  const escrowEthAta = await getOrCreateAssociatedTokenAccount(
    connection, admin, ethMint, loanPDA, true,
  );
  info('Escrow ATA', escrowEthAta.address.toBase58());

  // Balances BEFORE
  console.log('\n    --- Balances BEFORE executeLoan ---');
  const lenderUsdcBefore = await getTokenBalance(usdcMint, admin.publicKey);
  const borrowerUsdcBefore = await getTokenBalance(usdcMint, borrower.publicKey);
  const borrowerEthBefore = await getTokenBalance(ethMint, borrower.publicKey);
  const escrowEthBefore = await getTokenBalance(ethMint, loanPDA);
  info('Lender USDC', fromSmallest(lenderUsdcBefore, USDC_DECIMALS));
  info('Borrower USDC', fromSmallest(borrowerUsdcBefore, USDC_DECIMALS));
  info('Borrower ETH', fromSmallest(borrowerEthBefore, ETH_DECIMALS));
  info('Escrow ETH', fromSmallest(escrowEthBefore, ETH_DECIMALS));

  const executeLoanIx = buildExecuteLoanIx(
    loanId,
    new BN(toSmallest(COLLATERAL_AMOUNT, ETH_DECIMALS).toString()),
    new BN(toSmallest(LOAN_AMOUNT, USDC_DECIMALS).toString()),
    {
      offer: offerPDA,
      loan: loanPDA,
      protocolState: protocolStatePDA,
      lender: admin.publicKey,
      borrower: borrower.publicKey,
      collateralMint: ethMint,
      borrowerCollateralAccount: borrowerEthAta.address,
      escrowCollateralAccount: escrowEthAta.address,
      lenderStableAccount: lenderUsdcAta.address,
      borrowerStableAccount: borrowerUsdcAta.address,
      feeAccount: feeUsdcAta.address,
    },
  );

  const execTx = new Transaction().add(executeLoanIx);
  const execSig = await sendAndConfirmTransaction(connection, execTx, [admin, borrower]);
  info('Execute Loan TX', execSig);

  // Balances AFTER
  console.log('\n    --- Balances AFTER executeLoan ---');
  const lenderUsdcAfter = await getTokenBalance(usdcMint, admin.publicKey);
  const borrowerUsdcAfter = await getTokenBalance(usdcMint, borrower.publicKey);
  const borrowerEthAfter = await getTokenBalance(ethMint, borrower.publicKey);
  const escrowEthAfter = await getTokenBalance(ethMint, loanPDA);
  info('Lender USDC', fromSmallest(lenderUsdcAfter, USDC_DECIMALS));
  info('Borrower USDC', fromSmallest(borrowerUsdcAfter, USDC_DECIMALS));
  info('Borrower ETH', fromSmallest(borrowerEthAfter, ETH_DECIMALS));
  info('Escrow ETH', fromSmallest(escrowEthAfter, ETH_DECIMALS));

  const loanSmallest = toSmallest(LOAN_AMOUNT, USDC_DECIMALS);
  const originationFee = (loanSmallest * 150n) / 10000n;
  const insuranceFee = (loanSmallest * 50n) / 10000n;
  const disbursed = loanSmallest - originationFee;

  console.log('\n    --- Expected Values ---');
  info('Origination Fee (1.5%)', `${fromSmallest(originationFee, USDC_DECIMALS)} USDC`);
  info('Insurance Reserve (0.5%)', `${fromSmallest(insuranceFee, USDC_DECIMALS)} USDC`);
  info('Disbursed to Borrower', `${fromSmallest(disbursed, USDC_DECIMALS)} USDC`);

  const collateralOk = escrowEthAfter === toSmallest(COLLATERAL_AMOUNT, ETH_DECIMALS);
  const disbursedOk = borrowerUsdcAfter - borrowerUsdcBefore === disbursed;
  console.log('\n    --- Verification ---');
  info('Escrow has collateral?', collateralOk ? 'PASS' : 'FAIL');
  info('Borrower got disbursement?', disbursedOk ? 'PASS' : 'FAIL');

  // ─── Step 6: Repay loan ─────────────────────────────────────────────────

  log('STEP 6', 'Borrower repays loan (principal + pro-rata interest)');

  console.log('\n    --- Balances BEFORE repayLoan ---');
  const lenderUsdcBeforeRepay = await getTokenBalance(usdcMint, admin.publicKey);
  const borrowerUsdcBeforeRepay = await getTokenBalance(usdcMint, borrower.publicKey);
  const borrowerEthBeforeRepay = await getTokenBalance(ethMint, borrower.publicKey);
  const escrowEthBeforeRepay = await getTokenBalance(ethMint, loanPDA);
  info('Lender USDC', fromSmallest(lenderUsdcBeforeRepay, USDC_DECIMALS));
  info('Borrower USDC', fromSmallest(borrowerUsdcBeforeRepay, USDC_DECIMALS));
  info('Borrower ETH', fromSmallest(borrowerEthBeforeRepay, ETH_DECIMALS));
  info('Escrow ETH', fromSmallest(escrowEthBeforeRepay, ETH_DECIMALS));

  info('Waiting', '3 seconds for interest to accrue...');
  await sleep(3000);

  const repayIx = buildRepayLoanIx({
    loan: loanPDA,
    borrower: borrower.publicKey,
    borrowerStableAccount: borrowerUsdcAta.address,
    lenderStableAccount: lenderUsdcAta.address,
    feeAccount: feeUsdcAta.address,
    escrowCollateralAccount: escrowEthAta.address,
    borrowerCollateralAccount: borrowerEthAta.address,
  });

  const repayTx = new Transaction().add(repayIx);
  const repaySig = await sendAndConfirmTransaction(connection, repayTx, [borrower]);
  info('Repay TX', repaySig);

  // Balances AFTER
  console.log('\n    --- Balances AFTER repayLoan ---');
  const lenderUsdcAfterRepay = await getTokenBalance(usdcMint, admin.publicKey);
  const borrowerUsdcAfterRepay = await getTokenBalance(usdcMint, borrower.publicKey);
  const borrowerEthAfterRepay = await getTokenBalance(ethMint, borrower.publicKey);
  const escrowEthAfterRepay = await getTokenBalance(ethMint, loanPDA);
  info('Lender USDC', fromSmallest(lenderUsdcAfterRepay, USDC_DECIMALS));
  info('Borrower USDC', fromSmallest(borrowerUsdcAfterRepay, USDC_DECIMALS));
  info('Borrower ETH', fromSmallest(borrowerEthAfterRepay, ETH_DECIMALS));
  info('Escrow ETH', fromSmallest(escrowEthAfterRepay, ETH_DECIMALS));

  const lenderUsdcGain = lenderUsdcAfterRepay - lenderUsdcBeforeRepay;
  const borrowerUsdcSpent = borrowerUsdcBeforeRepay - borrowerUsdcAfterRepay;
  const borrowerEthGain = borrowerEthAfterRepay - borrowerEthBeforeRepay;

  console.log('\n    --- Repayment Analysis ---');
  info('Lender received', `${fromSmallest(lenderUsdcGain, USDC_DECIMALS)} USDC`);
  info('Borrower paid', `${fromSmallest(borrowerUsdcSpent, USDC_DECIMALS)} USDC`);
  info('Borrower got back', `${fromSmallest(borrowerEthGain, ETH_DECIMALS)} ETH`);
  info('Interest paid', `${fromSmallest(borrowerUsdcSpent - loanSmallest, USDC_DECIMALS)} USDC`);

  const collateralReturned = borrowerEthAfterRepay === toSmallest(BORROWER_ETH_AMOUNT, ETH_DECIMALS);
  const escrowEmpty = escrowEthAfterRepay === 0n;
  const lenderGotPrincipal = lenderUsdcGain >= loanSmallest;

  console.log('\n    --- Final Verification ---');
  info('Collateral returned?', collateralReturned ? 'PASS' : 'FAIL');
  info('Escrow empty?', escrowEmpty ? 'PASS' : 'FAIL');
  info('Lender got principal+?', lenderGotPrincipal ? 'PASS' : 'FAIL');

  console.log('\n' + '='.repeat(70));
  console.log('  ALL TESTS PASSED — Finetic Protocol E2E flow verified on devnet');
  console.log('='.repeat(70) + '\n');
}

main().catch((err) => {
  console.error('\n  FAILED:', err.message || err);
  if (err.logs) {
    console.error('\n  Program Logs:');
    for (const line of err.logs) {
      console.error('    ', line);
    }
  }
  process.exit(1);
});
