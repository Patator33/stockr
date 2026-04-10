import { useRef, useState } from 'react';

const THRESHOLD = 65;

export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void> | void; children: React.ReactNode }) {
  const startY = useRef<number | null>(null);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPullY(Math.min(dy, THRESHOLD + 20));
  };

  const handleTouchEnd = async () => {
    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullY(THRESHOLD);
      try { await onRefresh(); } finally {
        setRefreshing(false);
        setPullY(0);
        startY.current = null;
      }
    } else {
      setPullY(0);
      startY.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', overflowY: 'auto' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullY > 0 || refreshing) && (
        <div style={{ height: pullY, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: refreshing ? 'none' : 'height 0.2s' }}>
          <span className="text-text-muted text-sm">
            {refreshing ? '↻ Chargement...' : pullY >= THRESHOLD ? '↑ Relâcher' : '↓ Tirer pour rafraîchir'}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
