import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type Order } from '../api';
import { checkNewOrders } from './useNotifications';

const POLL_INTERVAL = 30_000;

// Shared state — only one polling loop across all consumers
let sharedOrders: Order[] = [];
let sharedPendingCount = 0;
let initialized = false;
const listeners = new Set<() => void>();

function notify() { listeners.forEach(fn => fn()); }

async function fetchOnce() {
  try {
    const all = await api.orders.list();
    checkNewOrders(all, initialized);
    initialized = true;
    sharedOrders = all;
    sharedPendingCount = all.filter(o => o.status === 'pending').length;
    notify();
  } catch { /* ignore */ }
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let pollingRefCount = 0;

function startPolling() {
  pollingRefCount++;
  if (pollingInterval === null) {
    fetchOnce();
    pollingInterval = setInterval(fetchOnce, POLL_INTERVAL);
  }
}

function stopPolling() {
  pollingRefCount--;
  if (pollingRefCount <= 0 && pollingInterval !== null) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    pollingRefCount = 0;
  }
}

export function useOrders() {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender(n => n + 1);
    listeners.add(listener);
    startPolling();
    return () => {
      listeners.delete(listener);
      stopPolling();
    };
  }, []);

  const reload = useCallback(async () => { await fetchOnce(); }, []);

  return { orders: sharedOrders, pendingCount: sharedPendingCount, reload };
}
