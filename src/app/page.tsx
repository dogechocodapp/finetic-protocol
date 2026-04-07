'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { StatCard } from '@/components/ui/ScoreBadge';
import { OfferRow } from '@/components/marketplace/OfferRow';
import { RequestRow } from '@/components/marketplace/RequestRow';
import { CreateModal } from '@/components/marketplace/CreateModal';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useFinetic } from '@/providers/FineticProvider';
import { useOffers, useRequests, useMyLoans, usePlatformStats, useLoanHistory } from '@/hooks/useFinetic';
import { offersService, type CreateOfferParams } from '@/services/offers';
import { requestsService, type CreateRequestParams } from '@/services/requests';
import { shortWallet, type OfferWithLender, type RequestWithBorrower, type LoanWithParties } from '@/types';
import Link from 'next/link';

type Tab = 'offers' | 'requests' | 'my_loans' | 'history';

export default function MarketplacePage() {
  const { profile, connected } = useFinetic();
  const { offers, loading: offersLoading, refresh: refreshOffers } = useOffers();
  const { requests, loading: requestsLoading, refresh: refreshRequests } = useRequests();
  const { stats } = usePlatformStats();
  const { loans, loading: loansLoading } = useMyLoans(profile?.id || null);
  const { history: loanHistory, loading: historyLoading } = useLoanHistory(profile?.id || null);

  const [tab, setTab] = useState<Tab>('offers');
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<'offer' | 'request'>('offer');
  const [filter, setFilter] = useState('all');
  const [chatTarget, setChatTarget] = useState<{ userId: string; wallet: string; context?: { offer_id?: string; request_id?: string } } | null>(null);

  const handleCreateOffer = async (data: Record<string, unknown>) => {
    if (!profile) return;
    await offersService.create({ ...data, lender_id: profile.id } as CreateOfferParams);
    setShowCreate(false);
    refreshOffers();
  };

  const handleCreateRequest = async (data: Record<string, unknown>) => {
    if (!profile) return;
    await requestsService.create({ ...data, borrower_id: profile.id } as CreateRequestParams);
    setShowCreate(false);
    refreshRequests();
  };

  const openChat = (userId: string, wallet: string, context?: { offer_id?: string; request_id?: string }) => {
    if (!profile) return;
    setChatTarget({ userId, wallet, context });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'offers', label: 'Ofertas Prestamistas' },
    { key: 'requests', label: 'Solicitudes Clientes' },
    { key: 'my_loans', label: 'Mis Préstamos' },
    { key: 'history', label: 'Historial' },
  ];

  const filters = ['all', 'USDC', 'USDT', '10%', '20%', '12m', '24m'];

  const filteredOffers = offers.filter((o: OfferWithLender) => {
    if (filter === 'all') return true;
    if (filter === 'USDC' || filter === 'USDT') return o.stable_token === filter;
    if (filter === '10%') return o.tier === 'standard';
    if (filter === '20%') return o.tier === 'high';
    if (filter === '12m') return o.term_months === 12;
    if (filter === '24m') return o.term_months === 24;
    return true;
  });

  const filteredRequests = requests.filter((r: RequestWithBorrower) => {
    if (filter === 'all') return true;
    if (filter === 'USDC' || filter === 'USDT') return r.stable_token === filter;
    if (filter === '10%') return r.tier === 'standard';
    if (filter === '20%') return r.tier === 'high';
    if (filter === '12m') return r.term_months === 12;
    if (filter === '24m') return r.term_months === 24;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-3 flex-wrap">
          <StatCard label="Total Prestado" value={`$${stats.totalVolume > 0 ? (stats.totalVolume / 1000000).toFixed(1) + 'M' : '0'}`} sub="protocolo activo" />
          <StatCard label="Préstamos Activos" value={stats.activeLoans.toString()} />
          <StatCard label="Score Medio" value={stats.avgScore.toString()} sub="Red saludable" />
          <StatCard label="Tasa de Default" value={`${stats.defaultRate.toFixed(1)}%`} sub="vs industria" />
        </div>
      </div>

      {/* Tabs + Actions */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all"
                style={{
                  background: tab === t.key ? '#1E293B' : 'transparent',
                  border: tab === t.key ? '1px solid #334155' : '1px solid transparent',
                  color: tab === t.key ? '#F8FAFC' : '#64748B',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {connected && (
            <div className="flex gap-2">
              <button
                onClick={() => { setCreateType('offer'); setShowCreate(true); }}
                className="px-4 py-2 rounded-lg font-bold text-sm text-white cursor-pointer bg-emerald-500 border-none hover:bg-emerald-600 transition"
              >
                + Publicar Oferta
              </button>
              <button
                onClick={() => { setCreateType('request'); setShowCreate(true); }}
                className="px-4 py-2 rounded-lg font-bold text-sm text-white cursor-pointer bg-purple-500 border-none hover:bg-purple-600 transition"
              >
                + Solicitar Préstamo
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 mb-4">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all"
              style={{
                background: filter === f ? '#334155' : '#0F172A',
                border: `1px solid ${filter === f ? '#475569' : '#1E293B'}`,
                color: filter === f ? '#F8FAFC' : '#64748B',
              }}
            >
              {f === 'all' ? 'Todos' : f}
            </button>
          ))}
        </div>

        {/* OFFERS TAB */}
        {tab === 'offers' && (
          <div className="flex flex-col gap-2">
            <div className="grid px-5 py-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr 1fr' }}>
              <span>Prestamista</span><span>Ofrece</span><span>Cantidad</span><span>Colateral</span><span>Interés</span><span>Plazo</span><span></span>
            </div>
            {offersLoading ? (
              <div className="text-center py-12 text-slate-500">Cargando ofertas...</div>
            ) : filteredOffers.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No hay ofertas activas.</div>
            ) : (
              filteredOffers.map((offer: OfferWithLender) => (
                <OfferRow
                  key={offer.id}
                  offer={offer}
                  connected={connected}
                  onAccept={(o) => openChat(o.lender_id, o.lender?.wallet_address || '', { offer_id: o.id })}
                />
              ))
            )}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === 'requests' && (
          <div className="flex flex-col gap-2">
            <div className="grid px-5 py-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr 1fr 0.8fr 1fr' }}>
              <span>Cliente</span><span>Necesita</span><span>Cantidad</span><span>Ofrece Colateral</span><span>Interés</span><span>Plazo</span><span></span>
            </div>
            {requestsLoading ? (
              <div className="text-center py-12 text-slate-500">Cargando solicitudes...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No hay solicitudes activas.</div>
            ) : (
              filteredRequests.map((req: RequestWithBorrower) => (
                <RequestRow
                  key={req.id}
                  request={req}
                  connected={connected}
                  onFund={(r) => openChat(r.borrower_id, r.borrower?.wallet_address || '', { request_id: r.id })}
                />
              ))
            )}
          </div>
        )}

        {/* MY LOANS TAB */}
        {tab === 'my_loans' && (
          <div>
            {!connected ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🔒</div>
                <p className="text-slate-500">Conecta tu wallet para ver tus préstamos</p>
              </div>
            ) : loansLoading ? (
              <div className="text-center py-12 text-slate-500">Cargando...</div>
            ) : loans.length === 0 ? (
              <div className="text-center py-16 text-slate-500">No tienes préstamos activos.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {loans.map((loan: LoanWithParties) => {
                  const isBorrower = loan.borrower_id === profile?.id;
                  return (
                    <div key={loan.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                            {isBorrower ? 'Préstamo Recibido' : 'Préstamo Concedido'}
                          </span>
                          <div className="text-xl font-extrabold mt-1">
                            ${loan.loan_amount.toLocaleString()} {loan.stable_token}
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-lg text-xs font-bold" style={{
                          background: loan.status === 'active' ? '#10B98118' : '#64748B18',
                          color: loan.status === 'active' ? '#10B981' : '#64748B',
                          border: `1px solid ${loan.status === 'active' ? '#10B98140' : '#64748B40'}`,
                        }}>
                          {loan.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-[11px] text-slate-500">Colateral</div>
                          <div className="font-bold">{loan.collateral_amount} {loan.collateral_token}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Interés</div>
                          <div className="font-bold text-emerald-400">{loan.interest_rate}% APY</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Vencimiento</div>
                          <div className="font-bold">{new Date(loan.matures_at).toLocaleDateString('es')}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">{isBorrower ? 'Prestamista' : 'Cliente'}</div>
                          <Link href={`/profile/${isBorrower ? loan.lender?.wallet_address : loan.borrower?.wallet_address}`} className="font-bold font-mono text-purple-400 hover:underline">
                            {shortWallet(isBorrower ? (loan.lender?.wallet_address || '') : (loan.borrower?.wallet_address || ''))}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div>
            {!connected ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">📋</div>
                <p className="text-slate-500">Conecta tu wallet para ver tu historial</p>
              </div>
            ) : historyLoading ? (
              <div className="text-center py-12 text-slate-500">Cargando...</div>
            ) : loanHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-500">Sin historial todavía.</div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid px-5 py-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                  <span>Fecha</span><span>Acción</span><span>Cantidad</span><span>Token</span><span>Tx</span>
                </div>
                {loanHistory.map((h) => (
                  <div key={h.id} className="grid items-center px-5 py-3 bg-slate-900 border border-slate-800 rounded-xl" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                    <span className="text-slate-400 text-sm">{new Date(h.created_at).toLocaleDateString('es')}</span>
                    <span className="text-sm font-bold" style={{ color: h.action.includes('repay') ? '#10B981' : h.action === 'disbursed' ? '#8B5CF6' : '#F59E0B' }}>
                      {h.action.replace(/_/g, ' ')}
                    </span>
                    <span className="font-bold">{h.amount ? `$${h.amount.toLocaleString()}` : '-'}</span>
                    <span className="text-slate-400">{h.token || '-'}</span>
                    <span className="text-xs text-slate-600 font-mono truncate">{h.tx_signature ? shortWallet(h.tx_signature) : '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-10 px-6 py-5 border-t border-slate-800 flex justify-between items-center">
        <span className="text-xs text-slate-600">
          Finetic Protocol · Smart Contract on Solana · No custodial · No liquidation · Solo para gente segura
        </span>
        <div className="flex gap-4">
          {['Docs', 'SDK', 'GitHub', 'Discord'].map((l) => (
            <span key={l} className="text-xs text-slate-600 cursor-pointer hover:text-slate-400 transition">{l}</span>
          ))}
        </div>
      </footer>

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          type={createType}
          onClose={() => setShowCreate(false)}
          onSubmit={createType === 'offer' ? handleCreateOffer : handleCreateRequest}
        />
      )}

      {/* Chat Panel */}
      {chatTarget && profile && (
        <ChatPanel
          userId={profile.id}
          otherUserId={chatTarget.userId}
          otherWallet={chatTarget.wallet}
          context={chatTarget.context}
          onClose={() => setChatTarget(null)}
        />
      )}
    </div>
  );
}
