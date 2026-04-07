import { supabase } from '@/lib/supabase';
import type { Message } from '@/types';

export const chatService = {
  async getConversation(
    userId: string,
    otherUserId: string,
    contextId?: { offer_id?: string; request_id?: string; loan_id?: string },
  ): Promise<Message[]> {
    let query = supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`,
      )
      .order('created_at', { ascending: true });

    if (contextId?.offer_id) query = query.eq('offer_id', contextId.offer_id);
    if (contextId?.request_id) query = query.eq('request_id', contextId.request_id);

    const { data, error } = await query;
    if (error) throw error;
    return data as Message[];
  },

  async send(params: {
    sender_id: string;
    receiver_id: string;
    content: string;
    offer_id?: string;
    request_id?: string;
    loan_id?: string;
  }): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert(params)
      .select()
      .single();

    if (error) throw error;
    return data as Message;
  },

  async markRead(userId: string, senderId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', userId)
      .eq('sender_id', senderId)
      .eq('read', false);

    if (error) throw error;
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('read', false);

    if (error) return 0;
    return count || 0;
  },

  subscribeToMessages(userId: string, onMessage: (msg: Message) => void) {
    return supabase
      .channel(`messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => onMessage(payload.new as Message),
      )
      .subscribe();
  },
};
