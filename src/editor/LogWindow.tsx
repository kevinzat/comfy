import React, { useEffect, useRef, useState, useCallback } from 'react';
import { installConsumer, requestClear, MAX_LOG_ENTRIES, LogEntry } from './errorLog';

function formatTime(t: number): string {
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatEntry(e: LogEntry): string {
  return `${formatTime(e.t)} ${e.level.toUpperCase().padEnd(5)} ${e.message}`;
}

function levelColor(level: LogEntry['level']): string {
  if (level === 'error') return '#b00020';
  if (level === 'warn') return '#8a5a00';
  return '#333';
}

export default function LogWindow() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    installConsumer((batch, replace) => {
      setEntries((prev) => {
        const next = replace ? batch : [...prev, ...batch];
        return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
      });
    });
  }, []);

  useEffect(() => {
    if (atBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  }, []);

  const onClear = useCallback(() => {
    requestClear();
    setEntries([]);
  }, []);

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(entries.map(formatEntry).join('\n'));
  }, [entries]);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      fontSize: 12,
      background: '#fafafa',
      color: '#222',
    }}>
      <div style={{
        padding: '6px 10px',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        borderBottom: '1px solid #ccc',
        background: '#f0f0f0',
      }}>
        <span style={{ marginRight: 'auto' }}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          {entries.length >= MAX_LOG_ENTRIES ? ' (capped)' : ''}
        </span>
        <button onClick={onCopy}>Copy All</button>
        <button onClick={onClear}>Clear</button>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 10px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {entries.length === 0 ? (
          <div style={{ color: '#888', padding: '8px 0' }}>No log entries yet.</div>
        ) : (
          entries.map((e, i) => (
            <div key={i} style={{ color: levelColor(e.level), padding: '1px 0' }}>
              {formatEntry(e)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
