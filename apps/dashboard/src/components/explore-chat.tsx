import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  memoryIds?: number[];
  streaming?: boolean;
}

/** Extract ordered Memory #ID references from LLM text */
function extractNarrativeChain(text: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  const matches = text.matchAll(/\[Memory #(\d+)\]/g);
  for (const m of matches) {
    const id = parseInt(m[1]);
    if (!seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }
  return ids;
}

interface Props {
  onHighlight: (ids: Set<number>) => void;
  onNarrativeChain: (chain: number[]) => void;
  onNodeReveal: (id: number) => void;
  onStreamingDone: () => void;
  onMemoryClick: (id: number) => void;
  onEntityClick?: (entity: string) => void;
  knownEntities: Set<string>; // entity names from graph nodes
  searchResults: Array<{ id: number; _score?: number; [key: string]: any }>;
  setSearchResults: (results: Array<{ id: number; _score?: number; [key: string]: any }>) => void;
}

export function ExploreChat({ onHighlight, onNarrativeChain, onNodeReveal, onStreamingDone, onMemoryClick, onEntityClick, knownEntities, searchResults, setSearchResults }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef('');
  const revealedIdsRef = useRef<Set<number>>(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Expand when there are messages, collapse when cleared
  useEffect(() => {
    if (messages.length > 0) setExpanded(true);
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);
    contentRef.current = '';
    revealedIdsRef.current = new Set();

    const abort = new AbortController();
    abortRef.current = abort;

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      await api.exploreChat(
        userMsg.content,
        history,
        (chunk) => {
          contentRef.current += chunk;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId ? { ...m, content: contentRef.current } : m,
            ),
          );
          // Detect new Memory #ID references as they stream in
          const matches = contentRef.current.matchAll(/\[Memory #(\d+)\]/g);
          for (const match of matches) {
            const id = parseInt(match[1]);
            if (!revealedIdsRef.current.has(id)) {
              revealedIdsRef.current.add(id);
              onNodeReveal(id);
            }
          }
        },
        (ids) => {
          onHighlight(new Set(ids));
          setSearchResults(ids.map(id => ({ id })));
        },
        (data) => {
          const cleanContent = data.clean_content || contentRef.current;
          const chain = extractNarrativeChain(cleanContent);
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId
                ? { ...m, content: cleanContent, memoryIds: data.memory_ids, streaming: false }
                : m,
            ),
          );
          onNarrativeChain(chain);
          onStreamingDone();
          if (data.memory_ids?.length > 0) {
            onHighlight(new Set(data.memory_ids));
            setSearchResults(data.memory_ids.map(id => ({ id })));
          }
        },
        abort.signal,
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: contentRef.current || `Error: ${err.message}`, streaming: false }
              : m,
          ),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, messages, onHighlight, setSearchResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setExpanded(false);
    onHighlight(new Set());
    onNarrativeChain([]);
    setSearchResults([]);
    contentRef.current = '';
  };

  const renderContent = (text: string) => {
    // First split by Memory #ID references
    const memParts = text.split(/(\[Memory #\d+\])/g);

    return memParts.map((part, i) => {
      // Check if this part is a memory reference
      const memMatch = part.match(/\[Memory #(\d+)\]/);
      if (memMatch) {
        const id = parseInt(memMatch[1]);
        return (
          <span
            key={`m${i}`}
            onClick={() => onMemoryClick(id)}
            style={{
              display: 'inline-block',
              padding: '0px 5px',
              margin: '0 2px',
              fontSize: 9,
              fontWeight: 700,
              background: 'var(--blue-light)',
              color: 'var(--blue)',
              borderRadius: 3,
              cursor: 'pointer',
              border: '1px solid var(--blue-light)',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            #{id}
          </span>
        );
      }

      // For non-memory parts, highlight known entities
      if (knownEntities.size === 0) return <span key={`t${i}`}>{part}</span>;

      // Build regex from known entities (sorted longest first to avoid partial matches)
      const sorted = Array.from(knownEntities).sort((a, b) => b.length - a.length);
      const escaped = sorted.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const entityRegex = new RegExp(`(\\b(?:${escaped.join('|')})\\b)`, 'gi');

      const entityParts = part.split(entityRegex);
      return entityParts.map((ep, j) => {
        const isEntity = knownEntities.has(ep) ||
          Array.from(knownEntities).some(e => e.toLowerCase() === ep.toLowerCase());
        if (isEntity) {
          return (
            <span
              key={`e${i}-${j}`}
              onClick={() => onEntityClick?.(ep)}
              style={{
                display: 'inline',
                padding: '0px 3px',
                margin: '0 1px',
                fontSize: 'inherit',
                fontWeight: 600,
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                borderRadius: 2,
                cursor: onEntityClick ? 'pointer' : 'default',
              }}
            >
              {ep}
            </span>
          );
        }
        return <span key={`p${i}-${j}`}>{ep}</span>;
      });
    });
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
      width: '100%',
      maxWidth: 800,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Messages area — only when expanded */}
      {expanded && messages.length > 0 && (
        <div style={{
          width: '100%',
          maxHeight: 280,
          overflowY: 'auto',
          marginBottom: 8,
          padding: '8px 12px',
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border-strong)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {/* Clear button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-faint)',
                fontSize: 9,
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
                letterSpacing: 0.5,
              }}
            >
              Clear
            </button>
          </div>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
              }}
            >
              <div style={{
                padding: '6px 10px',
                borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                background: msg.role === 'user'
                  ? 'var(--blue-light)'
                  : 'var(--hover-bg)',
                border: `1px solid ${msg.role === 'user' ? 'var(--blue-light)' : 'var(--border)'}`,
                fontSize: 11,
                lineHeight: 1.5,
                color: 'var(--text)',
                fontFamily: 'var(--mono)',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                {msg.streaming && <span style={{ opacity: 0.4, animation: 'blink 1s infinite' }}>|</span>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input — floating centered pill */}
      <div style={{
        width: '100%',
        display: 'flex',
        gap: 0,
        background: 'var(--bg-card)',
        borderRadius: 14,
        border: '1px solid var(--border-strong)',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your memories..."
          disabled={streaming}
          style={{
            flex: 1,
            padding: '12px 18px',
            fontSize: 12,
            fontFamily: 'var(--mono)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            outline: 'none',
          }}
        />
        <button
          onClick={streaming ? () => abortRef.current?.abort() : handleSend}
          disabled={!streaming && !input.trim()}
          style={{
            padding: '12px 18px',
            fontSize: 10,
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            background: 'transparent',
            color: streaming ? '#f87171' : !input.trim() ? 'rgba(255,255,255,0.2)' : 'var(--blue)',
            border: 'none',
            borderLeft: '1px solid var(--border)',
            cursor: !streaming && !input.trim() ? 'default' : 'pointer',
          }}
        >
          {streaming ? 'Stop' : 'Send'}
        </button>
      </div>
    </div>
  );
}
