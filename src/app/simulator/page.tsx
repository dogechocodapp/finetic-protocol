'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { calculateFees, FEES, type LoanTier } from '@/types';
import Link from 'next/link';

type Role = 'borrower' | 'lender';

export default function SimulatorPage() {
  const [role, setRole] = useState<Role>('borrower');
  const [amount, setAmount] = useState('25000');
  const [tier, setTier] = useState<LoanTier>('standard');
  const [term, setTerm] = useState<12 | 24>(12);

  const numAmount = parseFloat(amount) || 0;
  const fees = calculateFees(numAmount, tier);
  const totalInterest = fees.annual_interest * (term / 12);
  const totalRepayment = numAmount + totalInterest;

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold mb-2">Simulador de Préstamo</h1>
          <p className="text-slate-400">Calcula cuánto pagarías o ganarías. Sin wallet, sin compromiso.</p>
        </div>

        {/* Role selector */}
        <div className="flex gap-2 mb-6 max-w-sm mx-auto">
          <button
            onClick={() => setRole('borrower')}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition"
            style={{
              background: role === 'borrower' ? '#8B5CF620' : '#1E293B',
              border: `1px solid ${role === 'borrower' ? '#8B5CF6' : '#334155'}`,
              color: role === 'borrower' ? '#8B5CF6' : '#94A3B8',
            }}
          >
            Soy Cliente
          </button>
          <button
            onClick={() => setRole('lender')}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition"
            style={{
              background: role === 'lender' ? '#10B98120' : '#1E293B',
              border: `1px solid ${role === 'lender' ? '#10B981' : '#334155'}`,
              color: role === 'lender' ? '#10B981' : '#94A3B8',
            }}
          >
            Soy Prestamista
          </button>
        </div>

        {/* Inputs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1.5">
                {role === 'borrower' ? 'Cuánto necesitas' : 'Cuánto quieres prestar'}
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-2xl font-extrabold outline-none focus:border-purple-500"
                placeholder="0.00"
              />
              <div className="flex gap-2 mt-2">
                {[5000, 10000, 25000, 50000, 100000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(v.toString())}
                    className="px-3 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-slate-400 hover:text-white transition"
                  >
                    ${(v / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1.5">Interés</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTier('standard')}
                  className="flex-1 py-3 rounded-xl font-bold transition"
                  style={{
                    background: tier === 'standard' ? '#10B98118' : '#1E293B',
                    border: `1px solid ${tier === 'standard' ? '#10B981' : '#334155'}`,
                    color: tier === 'standard' ? '#10B981' : '#94A3B8',
                  }}
                >
                  10% Standard
                </button>
                <button
                  onClick={() => setTier('high')}
                  className="flex-1 py-3 rounded-xl font-bold transition"
                  style={{
                    background: tier === 'high' ? '#DC262618' : '#1E293B',
                    border: `1px solid ${tier === 'high' ? '#DC2626' : '#334155'}`,
                    color: tier === 'high' ? '#DC2626' : '#94A3B8',
                  }}
                >
                  20% High
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1.5">Plazo</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTerm(12)}
                  className="flex-1 py-3 rounded-xl font-bold transition"
                  style={{
                    background: term === 12 ? '#8B5CF618' : '#1E293B',
                    border: `1px solid ${term === 12 ? '#8B5CF6' : '#334155'}`,
                    color: term === 12 ? '#8B5CF6' : '#94A3B8',
                  }}
                >
                  12 meses
                </button>
                <button
                  onClick={() => setTerm(24)}
                  className="flex-1 py-3 rounded-xl font-bold transition"
                  style={{
                    background: term === 24 ? '#8B5CF618' : '#1E293B',
                    border: `1px solid ${term === 24 ? '#8B5CF6' : '#334155'}`,
                    color: term === 24 ? '#8B5CF6' : '#94A3B8',
                  }}
                >
                  24 meses
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {numAmount > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-4">
              {role === 'borrower' ? 'Lo que pagas como cliente' : 'Lo que ganas como prestamista'}
            </div>

            {role === 'borrower' ? (
              <>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Principal solicitado</span>
                  <span className="font-bold">${numAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Fee origination ({tier === 'standard' ? '1.5' : '2'}%)</span>
                  <span className="font-bold text-red-400">-${fees.origination_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Recibes en tu wallet</span>
                  <span className="font-extrabold text-emerald-400">${fees.amount_disbursed.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Interés total ({term} meses)</span>
                  <span className="font-bold">${totalInterest.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-3 mt-1">
                  <span className="font-bold text-lg">Total a devolver</span>
                  <span className="font-extrabold text-lg text-white">${totalRepayment.toFixed(2)}</span>
                </div>
                <div className="mt-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-sm text-emerald-400 font-semibold">
                    💡 Amortiza antes de 50% del plazo y gana +150 puntos de score
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Capital prestado</span>
                  <span className="font-bold">${numAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Interés bruto ({term} meses)</span>
                  <span className="font-bold">${totalInterest.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Fee plataforma ({tier === 'standard' ? '1.5' : '2'}% del interés)</span>
                  <span className="font-bold text-red-400">-${(fees.platform_interest_fee * (term / 12)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-3 mt-1">
                  <span className="font-bold text-lg">Interés neto que recibes</span>
                  <span className="font-extrabold text-lg text-emerald-400">${(fees.lender_interest * (term / 12)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Retorno total</span>
                  <span className="font-extrabold">${(numAmount + fees.lender_interest * (term / 12)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">APY neto</span>
                  <span className="font-extrabold text-emerald-400">{((fees.lender_interest / numAmount) * 100).toFixed(2)}%</span>
                </div>
                <div className="mt-3 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-sm text-purple-400 font-semibold">
                    💡 Ganas +30 pts al financiar y +50 pts cuando te devuelvan
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-block px-8 py-3 rounded-xl font-extrabold text-white text-base transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
          >
            Ir al Marketplace
          </Link>
          <p className="text-xs text-slate-500 mt-3">
            Conecta tu wallet y empieza a operar · Sin liquidación · Sin oráculos · Solo para gente segura
          </p>
        </div>
      </div>
    </div>
  );
}
