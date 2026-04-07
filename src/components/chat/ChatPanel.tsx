'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';
import { shortWallet } from '@/types';

interface ChatPanelProps {
  userId: string;
  otherUserId: string;
  otherWallet: string;
  context?: { offer_id?: string; request_id?: string };
  onClose: () => void;
}

export function ChatPanel({ userId, otherUserId, otherWallet, context, onClose }: ChatPanelProps) {
  const { messages, loading, send } = useChat(userId, otherUserId, context);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    send(input);
    setInput('');
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col z-50" style={{ height: 420 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <span className="text-sm font-bold">{shortWallet(otherWallet)}</span>
          <span className="text-[10px] text-slate-500 ml-2">Chat P2P</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-sm">✕</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
        {loading && <div className="text-xs text-slate-500 text-center py-4">Cargando...</div>}
        {!loading && messages.length === 0 && (
          <div className="text-xs text-slate-600 text-center py-8">
            Inicia la conversación
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[75%] px-3 py-1.5 rounded-xl text-sm"
                style={{
                  background: isMine ? '#8B5CF630' : '#1E293B',
                  color: '#F8FAFC',
                }}
              >
                {msg.content}
                <div className="text-[9px] text-slate-500 mt-0.5">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribe un mensaje..."
          className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm outline-none"
        />
        <button
          onClick={handleSend}
          className="px-3 py-2 rounded-lg font-bold text-xs text-white"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
