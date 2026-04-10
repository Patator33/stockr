import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';

export function useAutoRefresh(load: () => void, intervalMs = 60000) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const listenerPromise = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) loadRef.current();
    });
    const timer = setInterval(() => loadRef.current(), intervalMs);
    return () => {
      listenerPromise.then(l => l.remove());
      clearInterval(timer);
    };
  }, [intervalMs]);
}
