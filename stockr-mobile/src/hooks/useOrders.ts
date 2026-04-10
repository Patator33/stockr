import { useState, useEffect, useRef, useCallback } from 'react';
import { api, type Order } from '../api';

const POLL_INTERVAL = 30_000; // 30s
const SEEN_KEY = 'stockr_seen_orders';

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function addSeenId(id: string) {
  const seen = getSeenIds();
  seen.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

async function notifyNewOrder(order: Order) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification('📋 Nouvelle commande', {
        body: `${order.customerName || order.customerEmail || 'Client'} — ${order.items.length} article${order.items.length > 1 ? 's' : ''}`,
        icon: '/icons/icon-192.png',
      });
    }
  } catch { /* ignore */ }
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const initialLoad = useRef(true);

  const fetchOrders = useCallback(async () => {
    try {
      const all = await api.orders.list();
      setOrders(all);
      const pending = all.filter(o => o.status === 'pending');
      setPendingCount(pending.length);

      // Don't notify on first load (would notify for all existing orders)
      if (!initialLoad.current) {
        const seen = getSeenIds();
        const newOrders = pending.filter(o => !seen.has(o.id));
        for (const order of newOrders) {
          addSeenId(order.id);
          await notifyNewOrder(order);
        }
      } else {
        // Mark all current pending as seen on first load
        pending.forEach(o => addSeenId(o.id));
        initialLoad.current = false;
      }
    } catch { /* ignore if not authenticated yet */ }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  return { orders, pendingCount, reload: fetchOrders };
}
