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
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-slate-200 shadow-card text-center max-w-sm mx-auto">
      {typeBadge && (
        <div className={`flex items-center gap-1.5 px-3 py-1 ${typeBadge.color} rounded-full text-xs font-bold mb-4`}>
          <typeBadge.Icon className="w-3.5 h-3.5" />
          <span>NOPAY {typeBadge.label.toUpperCase()}</span>
        </div>
      )}

      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm mb-4">
        <QRCodeSVG
          id="nopay-qr-code-svg"
          value={value}
          size={size}
          level="H"
          includeMargin={true}
        />
      </div>

      <h3 className="text-lg font-bold text-navy-900 leading-snug">{title}</h3>
      <p className="text-xs text-slate-500 mb-5">{subtitle}</p>

      {showActions && (
        <div className="flex items-center gap-2 w-full pt-3 border-t border-slate-100">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      )}
    </div>
  );
}
