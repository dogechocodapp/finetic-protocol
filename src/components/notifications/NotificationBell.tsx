'use client';

import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

interface NotificationBellProps {
  profileId: string | null;
}

export function NotificationBell({ profileId }: NotificationBellProps) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(profileId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!profileId) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-sm font-bold">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-[11px] text-purple-400 hover:text-purple-300"
              >
                Marcar todo leído
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">
              Sin notificaciones
            </div>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                onClick={() => { if (!n.read) markRead(n.id); }}
                className="px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 cursor-pointer transition"
                style={{ opacity: n.read ? 0.6 : 1 }}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />}
                  <div>
                    <div className="text-xs font-bold">{n.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{n.message}</div>
                    <div className="text-[10px] text-slate-600 mt-1">
                      {new Date(n.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
