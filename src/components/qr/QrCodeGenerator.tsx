'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, Store, Receipt, User } from 'lucide-react';

type QrType = 'MERCHANT' | 'BILL' | 'CUSTOMER';

interface QrCodeGeneratorProps {
  value: string;
  size?: number;
  title?: string;
  subtitle?: string;
  qrType?: QrType;
  showActions?: boolean;
}

export function QrCodeGenerator({
  value,
  size = 220,
  title = 'Scan to Pay',
  subtitle = 'NoPay QR',
  qrType,
  showActions = true,
}: QrCodeGeneratorProps) {
  const handleDownload = () => {
    const svgElement = document.getElementById('nopay-qr-code-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = size + 40;
      canvas.height = size + 40;
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `NoPay-QR-${Date.now()}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    window.print();
  };

  // Type badge
  const typeBadge = qrType === 'MERCHANT'
    ? { label: 'Merchant QR', Icon: Store, color: 'bg-blue-50 text-brand-blue' }
    : qrType === 'BILL'
    ? { label: 'Bill QR', Icon: Receipt, color: 'bg-emerald-50 text-emerald-700' }
    : qrType === 'CUSTOMER'
    ? { label: 'Customer QR', Icon: User, color: 'bg-purple-50 text-purple-700' }
    : null;

  return (
    <div className="flex flex-col items-center justify-center p-6 neo-box text-center max-w-sm mx-auto font-mono">
      {typeBadge && (
        <div className="flex items-center gap-1.5 px-3 py-1 border-2 border-border bg-foreground text-background text-xs font-black uppercase mb-4 shadow-[2px_2px_0px_0px_var(--border)]">
          <typeBadge.Icon className="w-3.5 h-3.5" />
          <span>NOPAY {typeBadge.label.toUpperCase()}</span>
        </div>
      )}

      {/* QR SVG container MUST remain crisp white background with black modules so cameras can read it */}
      <div className="p-4 bg-white text-black border-2 border-border shadow-[4px_4px_0px_0px_var(--border)] mb-4 rounded-none">
        <QRCodeSVG
          id="nopay-qr-code-svg"
          value={value}
          size={size}
          level="H"
          bgColor="#FFFFFF"
          fgColor="#000000"
          includeMargin={true}
        />
      </div>

      {title && <h3 className="text-base font-black uppercase text-foreground leading-snug">{title}</h3>}
      {subtitle && <p className="text-xs text-foreground-muted mb-4">{subtitle}</p>}

      {showActions && (
        <div className="flex items-center gap-2 w-full pt-3 border-t-2 border-border">
          <button
            onClick={handleDownload}
            className="flex-1 neo-btn-secondary py-2 px-3 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOWNLOAD</span>
          </button>
        </div>
      )}
    </div>
  );

}
