import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api, type Order } from '../api';

const SEEN_KEY = 'stockr_seen_orders';
const NOTIF_9H_KEY = 'stockr_notif_9h_date';

function getSeenIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
function addSeenId(id: string) {
  const seen = getSeenIds();
  seen.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

let notifId = Date.now();
function nextId() { return notifId++; }

async function requestPermission() {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch { /* ignore */ }
}

async function notify(title: string, body: string) {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: nextId(),
        title,
        body,
        schedule: { at: new Date(Date.now() + 100) },
        smallIcon: 'ic_launcher_foreground',
      }],
    });
  } catch { /* ignore */ }
}

async function check9hAlert(orders: Order[]) {
  const today = new Date().toDateString();
  const lastNotifDate = localStorage.getItem(NOTIF_9H_KEY);
  const now = new Date();
  if (now.getHours() !== 9) return;
  if (lastNotifDate === today) return;

  const urgent = orders.filter(o => {
    if (o.status === 'shipped') return false;
    if (!o.shippingDate) return false;
    return new Date(o.shippingDate).toDateString() === today;
  });

  if (urgent.length > 0) {
    localStorage.setItem(NOTIF_9H_KEY, today);
    const names = urgent.map(o => o.customerName || o.customerEmail || 'Client').join(', ');
    await notify(
      `📦 ${urgent.length} commande${urgent.length > 1 ? 's' : ''} à expédier aujourd'hui`,
      names
    );
  }
}

export function useNotifications() {
  const initialLoad = useRef(true);

  useEffect(() => {
    requestPermission();
  }, []);

  useEffect(() => {
    const handler = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      api.orders.list().then(orders => check9hAlert(orders)).catch(() => {});
    });
    return () => { handler.then(h => h.remove()); };
  }, []);

  const checkNewOrders = (orders: Order[]) => {
    const pending = orders.filter(o => o.status === 'pending');
    const seen = getSeenIds();

    if (!initialLoad.current) {
      const newOrders = pending.filter(o => !seen.has(o.id));
      for (const order of newOrders) {
        addSeenId(order.id);
        notify(
          '📋 Nouvelle commande',
          `${order.customerName || order.customerEmail || 'Client'} — ${order.items.length} article${order.items.length > 1 ? 's' : ''}`
        );
      }
    } else {
      pending.forEach(o => addSeenId(o.id));
      initialLoad.current = false;
      check9hAlert(orders);
    }
  };

  return { checkNewOrders };
}
