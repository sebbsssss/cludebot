import { CcWordmark } from './atoms';
import { V2_THREAD_GROUPS } from './data';
import type { V2Thread } from './types';

export function CcSidebar({
  user,
  threads,
  onNewChat,
  onSelect,
  onLogout,
}: {
  user: { name?: string; email?: string } | null;
  threads: V2Thread[];
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onLogout: () => void;
}) {
  const grouped = V2_THREAD_GROUPS.map((g) => ({
    ...g,
    items: threads.filter((t) => t.group === g.id),
  })).filter((g) => g.items.length > 0);

  const initials = ((user?.name || user?.email || 'SK').slice(0, 2) || 'SK').toUpperCase();

  return (
    <aside className="cc-side">
      <div className="cc-side__head">
        <CcWordmark badge="Chat" />
        <button type="button" className="cc-side__newbtn" onClick={onNewChat}>
          <span className="cc-plus">+</span> New chat
        </button>
      </div>
      <div className="cc-side__scroll">
        {grouped.length === 0 ? (
          <div className="cc-side__group" style={{ opacity: 0.6 }}>No conversations yet</div>
        ) : (
          grouped.map((g) => (
            <div key={g.id}>
              <div className="cc-side__group">{g.label}</div>
              {g.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`cc-thread ${t.active ? 'is-active' : ''}`}
                  onClick={() => onSelect(t.id)}
                >
                  <span className="cc-thread__dot" />
                  <span className="cc-thread__title">{t.title}</span>
                  <span className="cc-thread__meta">{t.meta}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
      <div className="cc-side__foot">
        <div className="cc-profile">
          <div className="cc-profile__avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="cc-profile__name">{user?.name || 'Guest'}</div>
            <div className="cc-profile__email">{user?.email || ''}</div>
          </div>
          <button type="button" className="cc-profile__btn" onClick={onLogout} title="Sign out">
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}
