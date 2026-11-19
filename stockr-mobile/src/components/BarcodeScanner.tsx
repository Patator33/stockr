import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat, GoogleBarcodeScannerModuleInstallState } from '@capacitor-mlkit/barcode-scanning';

// Scanner natif Google ML Kit (caméra native, autofocus, décodage rapide).
// Renvoie undefined si indisponible, pour retomber sur le scanner WebView ci-dessous.
async function scanNative(): Promise<string | null | undefined> {
  try {
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) return undefined;
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      // Le module Google se télécharge une seule fois (quelques secondes, réseau requis).
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 90_000);
        BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', e => {
          if (e.state === GoogleBarcodeScannerModuleInstallState.COMPLETED) { clearTimeout(timer); resolve(); }
          else if (e.state === GoogleBarcodeScannerModuleInstallState.FAILED || e.state === GoogleBarcodeScannerModuleInstallState.CANCELED) { clearTimeout(timer); reject(new Error('install')); }
        }).then(handle => { setTimeout(() => handle.remove(), 91_000); });
        BarcodeScanner.installGoogleBarcodeScannerModule().catch(err => { clearTimeout(timer); reject(err); });
      });
    }
    const { barcodes } = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE,
        BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Itf, BarcodeFormat.QrCode,
        BarcodeFormat.DataMatrix,
      ],
    });
    return barcodes[0]?.rawValue ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return null; // fermé par l'utilisateur
    console.warn('[scanner] natif indisponible, repli WebView :', msg);
    return undefined;
  }
}

export async function scanBarcode(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const result = await scanNative();
    if (result !== undefined) return result;
  }
  return scanWithWebview();
}

function scanWithWebview(): Promise<string | null> {
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

    const scanner = new Html5Qrcode('qr-reader', {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    });
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

    // Par défaut, html5-qrcode demande un flux basse définition (≈640×480) sans
    // autofocus continu : sur un S22+ l'image décodée est floue alors que
    // l'appareil photo natif est net. On demande du Full HD + mise au point
    // continue, un cadre large adapté aux codes 1D, et le détecteur natif
    // d'Android (BarcodeDetector) quand il est disponible.
    scanner.start(
      { facingMode: 'environment' },
      {
        fps: 15,
        qrbox: (w: number, h: number) => ({
          width: Math.floor(w * 0.9),
          height: Math.floor(Math.min(h * 0.45, w * 0.5)),
        }),
        videoConstraints: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
        },
      },
      (decodedText) => done(decodedText),
      () => { /* ignore decode errors */ }
    ).then(() => {
      // Certains appareils ignorent `advanced` au démarrage : on réessaie la mise au point continue.
      scanner.applyVideoConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
    }).catch(() => {
      alert('Impossible d\'accéder à la caméra.');
      done(null);
    });
  });
}
