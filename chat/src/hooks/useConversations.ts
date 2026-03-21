import { useState, useCallback, useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { api } from '../lib/api';
import type { Conversation } from '../lib/types';

export function useConversations() {
  const { authenticated } = useAuthContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authenticated) {
      setConversations([]);
      setActiveId(null);
      return;
    }
    setLoading(true);
    api.listConversations(50)
      .then(setConversations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authenticated]);

  const createConversation = useCallback(async (model: string): Promise<string> => {
    const conv = await api.createConversation(model);
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    return conv.id;
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    setActiveId(id);
    const data = await api.getConversation(id);
    return data.messages;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }, [activeId]);

  const refreshTitle = useCallback(async (id: string) => {
    try {
      const data = await api.getConversation(id);
      setConversations((prev) =>
        prev.map((c) => c.id === id ? { ...c, title: data.title, message_count: data.message_count, updated_at: data.updated_at } : c)
      );
    } catch { /* ignore */ }
  }, []);

  return {
    conversations,
    activeId,
    loading,
    createConversation,
    selectConversation,
    deleteConversation,
    refreshTitle,
    setActiveId,
  };
}
