import { Html5Qrcode } from 'html5-qrcode';

export function scanBarcode(): Promise<string | null> {
  return new Promise(resolve => {
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #000; display: flex; flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.25rem; padding-top: max(1rem, env(safe-area-inset-top));
      background: rgba(0,0,0,0.8);
    `;
    header.innerHTML = `
      <span style="color:#e2e8f0;font-size:1rem;font-weight:700;">📷 Scanner un code barre</span>
      <button id="scan-close" style="background:rgba(255,255,255,0.1);border:none;color:#e2e8f0;font-size:1.25rem;padding:0.375rem 0.75rem;border-radius:0.5rem;cursor:pointer;">✕</button>
    `;

    const scannerDiv = document.createElement('div');
    scannerDiv.id = 'qr-reader';
    scannerDiv.style.cssText = 'flex:1; width:100%;';

    const hint = document.createElement('div');
    hint.style.cssText = `
      padding: 0.75rem; text-align: center;
      color: #94a3b8; font-size: 0.875rem;
      background: rgba(0,0,0,0.8);
      padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
    `;
    hint.textContent = 'Pointez l\'appareil photo vers le code barre';

    overlay.appendChild(header);
    overlay.appendChild(scannerDiv);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);

    const scanner = new Html5Qrcode('qr-reader');
    let resolved = false;

    const cleanup = () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {}).finally(() => {
          document.body.removeChild(overlay);
        });
      } else {
        document.body.removeChild(overlay);
      }
    };

    const done = (value: string | null) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(value);
    };

    header.querySelector('#scan-close')!.addEventListener('click', () => done(null));

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 280, height: 180 } },
      (decodedText) => done(decodedText),
      () => { /* ignore decode errors */ }
    ).catch(() => {
      alert('Impossible d\'accéder à la caméra.');
      done(null);
    });
  });
}
