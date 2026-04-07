import { supabase } from '@/lib/supabase';
import type { Notification, NotificationType } from '@/types';

export const notificationsService = {
  async getAll(profileId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data as Notification[];
  },

  async getUnread(profileId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', profileId)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Notification[];
  },

  async getUnreadCount(profileId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('read', false);

    if (error) return 0;
    return count || 0;
  },

  async markRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
  },

  async markAllRead(profileId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('profile_id', profileId)
      .eq('read', false);

    if (error) throw error;
  },

  async create(params: {
    profile_id: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await supabase.from('notifications').insert(params);
    if (error) throw error;
  },

  subscribe(profileId: string, onNotification: (n: Notification) => void) {
    return supabase
      .channel(`notifications:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => onNotification(payload.new as Notification),
      )
      .subscribe();
  },
};
