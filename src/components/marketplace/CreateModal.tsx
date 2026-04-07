'use client';

import { useState } from 'react';
import { calculateFees, type LoanTier, type StableToken, type CollateralToken } from '@/types';

interface CreateModalProps {
  type: 'offer' | 'request';
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}

const COLLATERALS: CollateralToken[] = ['BTC', 'ETH', 'SOL', 'BNB'];
const STABLES: StableToken[] = ['USDC', 'USDT'];

export function CreateModal({ type, onClose, onSubmit }: CreateModalProps) {
  const [token, setToken] = useState<StableToken>('USDC');
  const [amount, setAmount] = useState('');
  const [collateral, setCollateral] = useState<CollateralToken>('ETH');
  const [selectedCollaterals, setSelectedCollaterals] = useState<CollateralToken[]>(['ETH', 'BTC']);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [tier, setTier] = useState<LoanTier>('standard');
  const [term, setTerm] = useState<12 | 24>(12);
  const [ltv, setLtv] = useState(50);
  const [allowPartial, setAllowPartial] = useState(true);
  const [minContribution, setMinContribution] = useState('1000');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const fees = calculateFees(numAmount, tier);

  const toggleCollateral = (c: CollateralToken) => {
    setSelectedCollaterals((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const handleSubmit = async () => {
    if (numAmount <= 0) return;
    setSubmitting(true);
    try {
      if (type === 'offer') {
        await onSubmit({
          stable_token: token,
          amount: numAmount,
          accepted_collaterals: selectedCollaterals,
          tier,
          term_months: term,
          description: description || null,
        });
      } else {
        await onSubmit({
          stable_token: token,
          amount: numAmount,
          collateral_token: collateral,
          collateral_amount: parseFloat(collateralAmount) || 0,
          tier,
          term_months: term,
          description: description || null,
          allow_partial: allowPartial,
          min_contribution: parseFloat(minContribution) || 1000,
          ltv_info: ltv,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-[480px] max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold">
            {type === 'offer' ? 'Publicar Oferta de Préstamo' : 'Solicitar Préstamo'}
          </h2>
          <button onClick={onClose} className="text-slate-500 text-xl hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Token */}
          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1.5">
              {type === 'offer' ? 'Moneda a prestar' : 'Moneda a recibir'}
            </label>
            <div className="flex gap-2">
              {STABLES.map((t) => (
                <button
                  key={t}
                  onClick={() => setToken(t)}
                  className="flex-1 py-2.5 rounded-lg font-bold text-sm transition"
                  style={{
                    background: token === t ? '#2775CA20' : '#1E293B',
                    border: `1px solid ${token === t ? '#2775CA' : '#334155'}`,
                    color: '#F8FAFC',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1.5">Cantidad</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-lg font-bold outline-none focus:border-purple-500"
            />
          </div>

          {/* Collateral */}
          {type === 'offer' ? (
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1.5">
                Colateral aceptado
              </label>
              <div className="flex gap-2">
                {COLLATERALS.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCollateral(c)}
                    className="flex-1 py-2 rounded-lg font-bold text-xs transition"
                    style={{
                      background: selectedCollaterals.includes(c) ? '#627EEA20' : '#1E293B',
                      border: `1px solid ${selectedCollaterals.includes(c) ? '#627EEA' : '#334155'}`,
                      color: selectedCollaterals.includes(c) ? '#F8FAFC' : '#94A3B8',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">
                  Tu colateral
                </label>
                <div className="flex gap-2">
                  {COLLATERALS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCollateral(c)}
                      className="flex-1 py-2 rounded-lg font-bold text-xs transition"
                      style={{
                        background: collateral === c ? '#627EEA20' : '#1E293B',
                        border: `1px solid ${collateral === c ? '#627EEA' : '#334155'}`,
                        color: '#F8FAFC',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">
                  Cantidad de colateral
                </label>
                <input
                  type="number"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-bold outline-none focus:border-purple-500"
                />
              </div>
              {/* LTV Slider */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">
                  LTV informativo — {ltv}%
                  <span className="text-slate-600 ml-1">(sin límites, el prestamista decide)</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={200}
                  value={ltv}
                  onChange={(e) => setLtv(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                  <span>10%</span>
                  <span>100%</span>
                  <span>200%</span>
                </div>
              </div>
            </>
          )}

          {/* Tier */}
          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1.5">Interés</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTier('standard')}
                className="flex-1 py-3 rounded-lg font-bold transition"
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
                className="flex-1 py-3 rounded-lg font-bold transition"
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

          {/* Term */}
          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1.5">Plazo</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTerm(12)}
                className="flex-1 py-3 rounded-lg font-bold transition"
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
                className="flex-1 py-3 rounded-lg font-bold transition"
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

          {/* Partial funding (request only) */}
          {type === 'request' && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPartial}
                  onChange={(e) => setAllowPartial(e.target.checked)}
                  className="accent-purple-500"
                />
                <span className="text-xs text-slate-400 font-semibold">
                  Permitir financiación parcial
                </span>
              </label>
              {allowPartial && (
                <input
                  type="number"
                  value={minContribution}
                  onChange={(e) => setMinContribution(e.target.value)}
                  placeholder="Min $"
                  className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-white text-xs outline-none"
                />
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1.5">
              Nota (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Condiciones, información adicional..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm outline-none resize-none focus:border-purple-500"
            />
          </div>

          {/* Fee breakdown — lender perspective */}
          {numAmount > 0 && type === 'offer' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-3">
                Tu desglose como prestamista
              </div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-400">Tú prestas</span>
                <span className="text-white font-semibold">${numAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-400">Interés bruto ({tier === 'standard' ? '10' : '20'}% APY)</span>
                <span className="text-white font-semibold">${fees.annual_interest.toFixed(2)}/año</span>
              </div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-400">Tu fee sobre interés ({tier === 'standard' ? '1.5' : '2'}%)</span>
                <span className="text-red-400 font-semibold">-${fees.platform_interest_fee.toFixed(2)}/año</span>
              </div>
              <div className="h-px bg-slate-800 my-2.5" />
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-white font-bold">Tú recibes neto</span>
                <span className="text-emerald-400 font-extrabold">${fees.lender_interest.toFixed(2)}/año de interés</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">El cliente recibirá</span>
                <span className="text-slate-300 font-semibold">${fees.amount_disbursed.toFixed(2)} <span className="text-slate-500 text-xs">(tras origination)</span></span>
              </div>
            </div>
          )}

          {/* Fee breakdown — borrower perspective */}
          {numAmount > 0 && type === 'request' && (() => {
            const totalInterest = fees.annual_interest * (term / 12);
            const totalCost = numAmount + totalInterest;
            return (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-3">
                  Tu desglose como cliente
                </div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-400">Tú solicitas</span>
                  <span className="text-white font-semibold">${numAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-400">Fee origination ({tier === 'standard' ? '1.5' : '2'}%)</span>
                  <span className="text-red-400 font-semibold">-${fees.origination_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-400">Seguro Finetic (0.5%)</span>
                  <span className="text-slate-500 font-semibold text-xs">incluido en fee</span>
                </div>
                <div className="h-px bg-slate-800 my-2.5" />
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white font-bold">Tú recibes</span>
                  <span className="text-emerald-400 font-extrabold">${fees.amount_disbursed.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-400">Interés que pagarás ({tier === 'standard' ? '10' : '20'}% APY)</span>
                  <span className="text-red-400 font-semibold">${fees.annual_interest.toFixed(2)}/año</span>
                </div>
                <div className="h-px bg-slate-800 my-2.5" />
                <div className="flex justify-between text-sm">
                  <span className="text-white font-bold">Coste total a {term} meses</span>
                  <span className="text-red-400 font-extrabold">${totalCost.toFixed(2)}</span>
                </div>
              </div>
            );
          })()}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || numAmount <= 0}
            className="py-3.5 rounded-xl font-extrabold text-base text-white mt-1 transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
          >
            {submitting
              ? 'Enviando...'
              : type === 'offer'
                ? 'Publicar Oferta'
                : 'Enviar Solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}
