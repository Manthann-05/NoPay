'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, History, Store, ArrowRight, Zap, Clock, CreditCard } from 'lucide-react';
import { QrScannerModal } from '@/components/qr/QrScannerModal';
import { getAllLocalTransactions } from '@/offline/queue';
import { ScannedQrResult } from '@/lib/qr/payload';
import { storeScannedQrRaw } from '@/lib/qr/scanHandoff';
import { Transaction } from '@/types';
import { useMounted } from '@/hooks/useMounted';

export const dynamic = 'force-dynamic';

export default function CustomerDashboardPage() {
  const isMounted = useMounted();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { getLocalSession } = await import('@/offline/session');
        const session = await getLocalSession();
        if (session) {
          setUser({ name: session.name, email: session.email });
        }

        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
              const data = await res.json();
              if (data.authenticated && data.user) {
                setUser(data.user);
              }
            }
          } catch (e) {
            // Ignore offline fallback
          }
        }

        const localData = await getAllLocalTransactions();
        setRecentTxns(localData.slice(0, 5));
      } catch (err) {
        console.error('Customer dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleQrDetected = (result: ScannedQrResult, rawText: string) => {
    setScannerOpen(false);

    if (result.type === 'TRANSACTION') return;

    storeScannedQrRaw(rawText);

    if (result.type === 'MERCHANT') {
      window.location.assign('/customer/static-pay');
    } else if (result.type === 'BILL') {
      window.location.assign('/customer/bill');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-12 font-mono">
      {/* Top Welcome Banner */}
      <div className="neo-box p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-foreground">
            CUSTOMER WALLET // PROTOCOL
          </span>
          <div className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 border border-border bg-background font-bold text-foreground">
            <span className="w-1.5 h-1.5 bg-foreground inline-block"></span>
            <span>ENGINE: ACTIVE</span>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-black uppercase text-foreground tracking-tight">
            HELLO, {user ? user.name : 'CUSTOMER'}
          </h1>
          <p className="text-xs text-foreground-muted">
            Scan NoPay merchant barcodes to execute offline transactions with local cryptographic verification.
          </p>
        </div>
      </div>

      {/* Dominant Scan Button */}
      <div className="neo-box p-6 text-center space-y-4">
        <div className="w-16 h-16 border-2 border-border bg-foreground text-background flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_var(--border)]">
          <QrCode className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-lg font-black uppercase text-foreground">SCAN PAYLOAD // QR</h2>
          <p className="text-xs text-foreground-muted mt-0.5">
            Decodes offline bill vouchers directly via camera
          </p>
        </div>

        <button
          onClick={() => setScannerOpen(true)}
          className="w-full neo-btn py-3.5 text-xs"
        >
          <QrCode className="w-4 h-4" />
          <span>ACTIVATE CAMERA SCANNER</span>
        </button>
      </div>

      {/* AutoPay Mandate Navigation Link */}
      <Link
        href="/customer/autopay"
        className="neo-box p-4 flex items-center gap-3 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all block"
      >
        <span className="border-2 border-border bg-foreground text-background p-2">
          <CreditCard className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black uppercase text-foreground">MANAGE AUTOPAY MANDATES</span>
          <span className="block text-[11px] text-foreground-muted">
            Configure merchant permissions, debit caps, and revocation
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-foreground" />
      </Link>

      {/* Recent Activity List */}
      <div className="neo-box p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-border pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            <h3 className="font-black uppercase text-xs text-foreground">RECENT QR RECORDS</h3>
          </div>
          <p className="text-[11px] leading-5 text-foreground-muted">
            A QR record is not a payment receipt. NoPay does not confirm cash, UPI, or bank payments made outside the app.
          </p>
          <Link
            href="/customer/transactions"
            className="text-xs font-bold underline text-foreground hover:opacity-80 flex items-center gap-1"
          >
            <span>VIEW ALL</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentTxns.length === 0 ? (
          <div className="text-center py-8 px-4 border-2 border-dashed border-border bg-background">
            <Clock className="w-6 h-6 text-foreground-muted mx-auto mb-2" />
            <p className="text-xs text-foreground-muted font-bold uppercase">NO LEDGER RECORDS YET</p>
            <p className="text-[10px] text-foreground-subtle mt-0.5">Scan a merchant barcode to record a transaction.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTxns.map((txn) => (
              <div
                key={txn.transactionId}
                className="flex items-center justify-between p-3 border-2 border-border bg-background"
              >
                <div>
                  <div className="text-xs font-black uppercase text-foreground">{txn.merchantName}</div>
                  <div className="text-[10px] text-foreground-muted">
                    {txn.transactionId} // {isMounted ? new Date(txn.createdAt).toLocaleDateString() : '...'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-foreground">₹{txn.amount}</div>
                  <span className="inline-block text-[9px] font-black px-2 py-0.5 uppercase mt-0.5 text-foreground-muted">
                    QR record · not payment confirmation
                  </span>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enable Merchant Mode Promotion */}
      <div className="neo-box p-5 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-[10px] font-black uppercase text-foreground-muted flex items-center gap-1">
            <Store className="w-3.5 h-3.5" />
            <span>COMMERCE PORTAL</span>
          </div>
          <div className="text-sm font-black uppercase text-foreground">ENABLE MERCHANT POS MODE</div>
          <div className="text-[11px] text-foreground-muted">Generate instant QR bills, track inventory offline</div>
        </div>
        <Link
          href="/merchant-setup"
          className="neo-btn py-2 px-3 text-xs"
        >
          ENABLE NOW
        </Link>
      </div>

      {/* QR Scanner Camera Modal */}
      {scannerOpen && (
        <QrScannerModal
          onScanSuccess={handleQrDetected}
          onClose={() => setScannerOpen(false)}
          allowedTypes={['MERCHANT', 'BILL']}
        />
      )}
    </div>
  );
}
