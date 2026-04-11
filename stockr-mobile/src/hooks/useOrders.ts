import { useState, useEffect, useRef, useCallback } from 'react';
import { api, type Order } from '../api';
import { useNotifications } from './useNotifications';

const POLL_INTERVAL = 30_000;

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const { checkNewOrders } = useNotifications();
  const initialized = useRef(false);

  const fetchOrders = useCallback(async () => {
    try {
      const all = await api.orders.list();
      setOrders(all);
      setPendingCount(all.filter(o => o.status === 'pending').length);
      checkNewOrders(all);
      initialized.current = true;
    } catch { /* ignore if not authenticated yet */ }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  return { orders, pendingCount, reload: fetchOrders };
}
