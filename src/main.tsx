import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Proteção global contra serialização de estruturas circulares
const sanitizeForConsole = (item: any, depth = 0, seen = new WeakSet()): any => {
  if (depth > 6) return '[Max Depth]';
  if (item === null || typeof item !== 'object') {
    if (typeof item === 'bigint') return item.toString();
    if (typeof item === 'function') return '[Function]';
    if (typeof item === 'symbol') return item.toString();
    return item;
  }
  if (seen.has(item)) return '[Circular]';
  seen.add(item);

  if (Array.isArray(item)) {
    return item.map(el => sanitizeForConsole(el, depth + 1, seen));
  }

  const clean: Record<string, any> = {};
  for (const key of Object.keys(item)) {
    try {
      clean[key] = sanitizeForConsole(item[key], depth + 1, seen);
    } catch {
      clean[key] = '[Unserializable]';
    }
  }
  return clean;
};

// Wrap native console methods to prevent circular errors in iframe messaging
['log', 'warn', 'error', 'info', 'debug'].forEach((method) => {
  const original = (console as any)[method];
  if (typeof original === 'function') {
    (console as any)[method] = (...args: any[]) => {
      const sanitizedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return sanitizeForConsole(arg);
          } catch {
            return String(arg);
          }
        }
        return arg;
      });
      return original.apply(console, sanitizedArgs);
    };
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

