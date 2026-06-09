import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n.jsx';
import { extractMentionIds, formatWorkActionWhen } from '../lib/workActions.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderMessageText(text, people) {
  if (!text) return null;
  const names = [...people]
    .map((p) => p.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;

  const pattern = names.map((name) => `@${escapeRegex(name)}`).join('|');
  const re = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(re);

  return parts.map((part, index) => {
    const isMention = names.some((name) => part.toLowerCase() === `@${name}`.toLowerCase());
    if (isMention) {
      return <span key={`${part}-${index}`} className="discussion-mention">{part}</span>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function ChatBubble({ message, people, currentUserId }) {
  const author = people.find((p) => p.id === message.authorId)
    || (message.title ? { name: message.title, initials: message.title.slice(0, 2).toUpperCase(), color: '#7B6BA0' } : null);
  const isMine = message.authorId && message.authorId === currentUserId;
  const body = (message.note || message.title || '').replace(/\r\n/g, '\n');

  return (
    <div className={`discussion-bubble-row ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && author && (
        <div className="discussion-avatar" style={{ background: author.color || '#7B6BA0' }}>
          {author.initials || author.name?.slice(0, 2)}
        </div>
      )}
      <div className={`discussion-bubble ${isMine ? 'mine' : 'theirs'}`}>
        {!isMine && author && (
          <div className="discussion-bubble-author">{author.name}</div>
        )}
        <div className="discussion-bubble-text">{renderMessageText(body, people)}</div>
        <div className="discussion-bubble-time">{formatWorkActionWhen(message.startedAt)}</div>
      </div>
    </div>
  );
}

export function DiscussionChat({
  messages = [],
  people = [],
  currentUserId = null,
  onSend,
  sending = false,
}) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt)),
    [messages],
  );

  const mentionCandidates = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.trim().toLowerCase();
    return people.filter((p) => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q)
        || (p.role || '').toLowerCase().includes(q)
        || (p.dept || '').toLowerCase().includes(q);
    }).slice(0, 8);
  }, [mentionOpen, mentionQuery, people]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [sortedMessages.length]);

  const syncMentionState = useCallback((value, cursorPos) => {
    const before = value.slice(0, cursorPos);
    const at = before.lastIndexOf('@');
    if (at < 0) {
      setMentionOpen(false);
      setMentionQuery('');
      setMentionStart(-1);
      return;
    }
    const query = before.slice(at + 1);
    if (/\s/.test(query)) {
      setMentionOpen(false);
      setMentionQuery('');
      setMentionStart(-1);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(query);
    setMentionStart(at);
    setMentionIndex(0);
  }, []);

  const insertMention = useCallback((person) => {
    if (!person || mentionStart < 0) return;
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? text.length;
    const before = text.slice(0, mentionStart);
    const after = text.slice(cursor);
    const insert = `@${person.name} `;
    const next = `${before}${insert}${after}`;
    setText(next);
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStart(-1);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = before.length + insert.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }, [mentionStart, text]);

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    syncMentionState(value, e.target.selectionStart ?? value.length);
  };

  const handleKeyDown = (e) => {
    if (mentionOpen && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const mentionIds = extractMentionIds(trimmed, people);
    await onSend?.(trimmed, mentionIds);
    setText('');
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStart(-1);
    inputRef.current?.focus();
  };

  const currentAuthor = people.find((p) => p.id === currentUserId);

  return (
    <div className="discussion-chat">
      <div className="discussion-messages" ref={listRef}>
        {sortedMessages.length === 0 ? (
          <p className="discussion-empty">{t('discussionEmpty')}</p>
        ) : (
          sortedMessages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              people={people}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>

      <div className="discussion-compose">
        {mentionOpen && mentionCandidates.length > 0 && (
          <div className="discussion-mention-menu" role="listbox">
            {mentionCandidates.map((person, index) => (
              <button
                key={person.id}
                type="button"
                role="option"
                aria-selected={index === mentionIndex}
                className={`discussion-mention-option ${index === mentionIndex ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(person);
                }}
              >
                <span className="discussion-mention-avatar" style={{ background: person.color }}>
                  {person.initials}
                </span>
                <span className="discussion-mention-meta">
                  <strong>{person.name}</strong>
                  <span>{person.role}{person.dept ? ` · ${person.dept}` : ''}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="discussion-input-row">
          {currentAuthor && (
            <div className="discussion-compose-avatar" style={{ background: currentAuthor.color }}>
              {currentAuthor.initials}
            </div>
          )}
          <textarea
            ref={inputRef}
            className="discussion-input"
            rows={2}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={t('discussionPlaceholder')}
            aria-label={t('discussionPlaceholder')}
          />
          <button
            type="button"
            className="discussion-send-btn"
            disabled={!text.trim() || sending}
            onClick={handleSend}
          >
            {sending ? t('workSaving') : t('discussionSend')}
          </button>
        </div>
        <p className="discussion-hint">{t('discussionMentionHint')}</p>
      </div>
    </div>
  );
}
