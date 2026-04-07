'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatService } from '@/services/chat';
import type { Message } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useChat(
  userId: string | null,
  otherUserId: string | null,
  context?: { offer_id?: string; request_id?: string },
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const loadMessages = useCallback(async () => {
    if (!userId || !otherUserId) return;
    setLoading(true);
    try {
      const data = await chatService.getConversation(userId, otherUserId, context);
      setMessages(data);
      await chatService.markRead(userId, otherUserId);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, otherUserId, context]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!userId) return;

    channelRef.current = chatService.subscribeToMessages(userId, (msg) => {
      if (
        (msg.sender_id === otherUserId && msg.receiver_id === userId) ||
        (msg.sender_id === userId && msg.receiver_id === otherUserId)
      ) {
        setMessages((prev) => [...prev, msg]);
        if (msg.sender_id === otherUserId) {
          chatService.markRead(userId, otherUserId).catch(() => {});
        }
      }
    });

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [userId, otherUserId]);

  const send = useCallback(
    async (content: string) => {
      if (!userId || !otherUserId || !content.trim()) return;
      try {
        const msg = await chatService.send({
          sender_id: userId,
          receiver_id: otherUserId,
          content: content.trim(),
          offer_id: context?.offer_id,
          request_id: context?.request_id,
        });
        setMessages((prev) => [...prev, msg]);
      } catch (err) {
        console.error('Error sending message:', err);
      }
    },
    [userId, otherUserId, context],
  );

  return { messages, loading, send, refresh: loadMessages };
}
