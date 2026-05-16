import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Mirrors the AI chat unread-badge logic. A "1 Message Expert" badge should
 * appear iff there is at least one consultant message *after* the user's
 * last-read message id.
 *
 * Regression: before persisting lastReadMessageId per-client in localStorage,
 * the badge re-fired on every page reload because state was in-memory only.
 */
function hasUnreadConsultant(
  dbMessages: Array<{ id: string; sender: string }>,
  clientId: string,
): boolean {
  const key = `ab.lastReadChatMessage.${clientId}`;
  const lastReadMessageId = localStorage.getItem(key);
  if (dbMessages.length === 0) return false;
  const lastReadIdx = lastReadMessageId
    ? dbMessages.findIndex(m => m.id === lastReadMessageId)
    : -1;
  const unread =
    lastReadIdx >= 0 ? dbMessages.slice(lastReadIdx + 1) : dbMessages;
  return unread.some(m => m.sender === 'consultant');
}

describe('AI badge "1 Message Expert" — lastReadMessageId persistence (regression: fantôme à chaque reload)', () => {
  beforeEach(() => localStorage.clear());

  it('shows badge on first visit if consultant has replied', () => {
    const msgs = [
      { id: '1', sender: 'user' },
      { id: '2', sender: 'ai' },
      { id: '3', sender: 'consultant' },
    ];
    expect(hasUnreadConsultant(msgs, 'clientA')).toBe(true);
  });

  it('does NOT show badge after user opened the chat (lastReadMessageId points to latest)', () => {
    const msgs = [
      { id: '1', sender: 'user' },
      { id: '2', sender: 'consultant' },
      { id: '3', sender: 'ai' },
    ];
    localStorage.setItem('ab.lastReadChatMessage.clientA', '3');
    expect(hasUnreadConsultant(msgs, 'clientA')).toBe(false);
  });

  it('shows badge again when consultant sends a NEW message after lastRead', () => {
    const msgs = [
      { id: '1', sender: 'user' },
      { id: '2', sender: 'consultant' },
      { id: '3', sender: 'ai' },
      { id: '4', sender: 'consultant' }, // new
    ];
    localStorage.setItem('ab.lastReadChatMessage.clientA', '3');
    expect(hasUnreadConsultant(msgs, 'clientA')).toBe(true);
  });

  it('does NOT show badge for an AI-only new message after lastRead', () => {
    const msgs = [
      { id: '1', sender: 'user' },
      { id: '2', sender: 'consultant' },
      { id: '3', sender: 'ai' },
      { id: '4', sender: 'ai' }, // not from consultant — no badge
    ];
    localStorage.setItem('ab.lastReadChatMessage.clientA', '3');
    expect(hasUnreadConsultant(msgs, 'clientA')).toBe(false);
  });

  it('returns false when no messages exist', () => {
    expect(hasUnreadConsultant([], 'clientA')).toBe(false);
  });

  it('is per-client (lastRead on client A does not silence client B)', () => {
    const msgs = [
      { id: '10', sender: 'consultant' },
    ];
    localStorage.setItem('ab.lastReadChatMessage.clientA', '10');
    expect(hasUnreadConsultant(msgs, 'clientA')).toBe(false);
    expect(hasUnreadConsultant(msgs, 'clientB')).toBe(true);
  });

  it('falls back to showing badge if lastReadMessageId points to a deleted/missing id', () => {
    // If the persisted id is no longer in the DB (e.g. message deleted),
    // we conservatively treat all messages as "unread" so the user is not
    // silently muted.
    const msgs = [
      { id: '1', sender: 'user' },
      { id: '2', sender: 'consultant' },
    ];
    localStorage.setItem('ab.lastReadChatMessage.clientA', 'ghost-id-99');
    expect(hasUnreadConsultant(msgs, 'clientA')).toBe(true);
  });
});
