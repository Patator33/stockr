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

async function ensureChannelAndPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return false;
    }
    await LocalNotifications.createChannel({
      id: 'stockr_orders',
      name: 'Commandes',
      description: 'Nouvelles commandes et alertes expédition',
      importance: 5,
      visibility: 1,
      vibration: true,
    });
    return true;
  } catch { return false; }
}

async function notify(title: string, body: string) {
  try {
    const ok = await ensureChannelAndPermission();
    if (!ok) return;
    await LocalNotifications.schedule({
      notifications: [{
        id: nextId(),
        title,
        body,
        channelId: 'stockr_orders',
        schedule: { at: new Date(Date.now() + 500) },
      }],
    });
  } catch (e) {
    console.error('[notify] error:', e);
  }
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

// Debug log accessible from Settings
const debugLogs: string[] = [];
export function getDebugLogs() { return [...debugLogs]; }
function log(msg: string) {
  const line = `${new Date().toLocaleTimeString('fr-FR')} ${msg}`;
  debugLogs.unshift(line);
  if (debugLogs.length > 20) debugLogs.pop();
  console.log('[Notif]', msg);
}

// Standalone — called from useOrders singleton
export function checkNewOrders(orders: Order[], alreadyInitialized: boolean) {
  const pending = orders.filter(o => o.status === 'pending');
  const seen = getSeenIds();
  log(`poll: ${orders.length} commandes, ${pending.length} pending, initialized=${alreadyInitialized}, seen=${seen.size}`);

  if (alreadyInitialized) {
    const newOrders = pending.filter(o => !seen.has(o.id));
    log(`nouvelles: ${newOrders.length} (ids: ${newOrders.map(o => o.id.slice(0,6)).join(',')})`);
    for (const order of newOrders) {
      addSeenId(order.id);
      log(`notif envoyée pour ${order.id.slice(0,6)}`);
      notify(
        '📋 Nouvelle commande',
        `${order.customerName || order.customerEmail || 'Client'} — ${order.items.length} article${order.items.length > 1 ? 's' : ''}`
      );
    }
  } else {
    // First load — mark all as seen, no notification
    pending.forEach(o => addSeenId(o.id));
    log(`init: ${pending.length} commandes marquées comme vues`);
    check9hAlert(orders);
  }
}

export function useNotifications() {
  useEffect(() => {
    ensureChannelAndPermission();
  }, []);

  useEffect(() => {
    const handler = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      api.orders.list().then(orders => check9hAlert(orders)).catch(() => {});
    });
    return () => { handler.then(h => h.remove()); };
  }, []);
}
