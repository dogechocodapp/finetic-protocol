'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsService } from '@/services/notifications';
import type { Notification } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useNotifications(profileId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const [all, count] = await Promise.all([
        notificationsService.getAll(profileId),
        notificationsService.getUnreadCount(profileId),
      ]);
      setNotifications(all);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profileId) return;

    channelRef.current = notificationsService.subscribe(profileId, (n) => {
      setNotifications((prev) => [n, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [profileId]);

  const markRead = useCallback(
    async (id: string) => {
      await notificationsService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    if (!profileId) return;
    await notificationsService.markAllRead(profileId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [profileId]);

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: load };
}
