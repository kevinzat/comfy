/**
 * Cross-window error log.
 *
 * The main editor window calls `installProducer()` on startup. This patches
 * `console.error` / `console.warn` and installs `error` / `unhandledrejection`
 * listeners so failures land in an in-memory ring buffer (last MAX_ENTRIES).
 *
 * A separate log-viewer window calls `installConsumer()` to receive entries
 * over a BroadcastChannel. On mount the consumer asks the producer for history
 * so pre-existing entries show up immediately.
 */

const MAX_ENTRIES = 10000;
const CHANNEL_NAME = 'comfy-error-log';

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogEntry {
  t: number;
  level: LogLevel;
  message: string;
}

type Msg =
  | { type: 'entry'; entry: LogEntry }
  | { type: 'history'; entries: LogEntry[] }
  | { type: 'clear' }
  | { type: 'request-history' }
  | { type: 'request-clear' };

let buffer: LogEntry[] = [];
let channel: BroadcastChannel | null = null;
let installedProducer = false;
let installedConsumer = false;

function getChannel(): BroadcastChannel {
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

function formatArgs(args: unknown[]): string {
  return args.map((a) => {
    if (a instanceof Error) return a.stack ?? a.message;
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
}

function push(entry: LogEntry) {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
  getChannel().postMessage({ type: 'entry', entry } satisfies Msg);
}

export function installProducer(): void {
  if (installedProducer) return;
  installedProducer = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    push({ t: Date.now(), level: 'error', message: formatArgs(args) });
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    push({ t: Date.now(), level: 'warn', message: formatArgs(args) });
    origWarn(...args);
  };

  window.addEventListener('error', (ev) => {
    const where = ev.filename ? ` (${ev.filename}:${ev.lineno}:${ev.colno})` : '';
    const stack = ev.error instanceof Error && ev.error.stack ? `\n${ev.error.stack}` : '';
    push({ t: Date.now(), level: 'error', message: `Uncaught: ${ev.message}${where}${stack}` });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    const msg = r instanceof Error ? (r.stack ?? r.message) : (typeof r === 'string' ? r : JSON.stringify(r));
    push({ t: Date.now(), level: 'error', message: `Unhandled rejection: ${msg}` });
  });

  getChannel().addEventListener('message', (ev: MessageEvent<Msg>) => {
    const d = ev.data;
    if (d.type === 'request-history') {
      getChannel().postMessage({ type: 'history', entries: buffer.slice() } satisfies Msg);
    } else if (d.type === 'request-clear') {
      buffer = [];
      getChannel().postMessage({ type: 'clear' } satisfies Msg);
    }
  });
}

export function installConsumer(
  onChange: (entries: LogEntry[], replace: boolean) => void,
): void {
  if (installedConsumer) return;
  installedConsumer = true;

  const ch = getChannel();
  ch.addEventListener('message', (ev: MessageEvent<Msg>) => {
    const d = ev.data;
    if (d.type === 'entry') onChange([d.entry], false);
    else if (d.type === 'history') onChange(d.entries, true);
    else if (d.type === 'clear') onChange([], true);
  });
  ch.postMessage({ type: 'request-history' } satisfies Msg);
}

export function requestClear(): void {
  getChannel().postMessage({ type: 'request-clear' } satisfies Msg);
}

export const MAX_LOG_ENTRIES = MAX_ENTRIES;
