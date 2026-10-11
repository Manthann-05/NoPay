'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QrCodeGenerator } from '@/components/qr/QrCodeGenerator';
import { BarcodeScanner } from '@/components/qr/BarcodeScanner';
import { Product, BillItem } from '@/types';
import { encodeBillQr } from '@/lib/qr/payload';
import { subscribeToTransactionEvents } from '@/offline/liveChannel';
import { useSnackbar } from '@/components/shared/SnackbarProvider';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  QrCode,
  Scan,
  X,
  Printer,
  PackageX,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface CartItem extends BillItem {
  id: string;
  productId?: string;
}

export default function MerchantPosBillingPage() {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);

  // Custom Item Inputs
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  // Modals
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [qrPayload, setQrPayload] = useState<string>('');
  const [generatedBillId, setGeneratedBillId] = useState<string>('');
  const [billPaymentStatus, setBillPaymentStatus] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);

  // Merchant session
  const [merchantInfo, setMerchantInfo] = useState<{ merchantId: string; shopName: string }>({
    merchantId: 'SHOP123',
    shopName: 'NoPay Store POS',
  });

  // Barcode Scan Notification
  const [barcodeToast, setBarcodeToast] = useState<{ type: 'success' | 'warn'; text: string } | null>(null);

  useEffect(() => {
    async function initCatalogAndSession() {
      setLoadingCatalog(true);
      try {
        const { offlineDb } = await import('@/offline/db');
        const { getLocalSession } = await import('@/offline/session');

        // 1. Load session for real merchant identity
        const session = await getLocalSession();
        if (session) {
          setMerchantInfo({
            merchantId: session.merchantProfileId || session.userId || 'SHOP123',
            shopName: session.merchantName || session.name || 'NoPay Store POS',
          });
        }

        // 2. Load products from Dexie IndexedDB first
        const localProducts = await offlineDb.products.toArray();
        if (localProducts.length > 0) {
          setProducts(localProducts);
        }

        // 3. If online, fetch updated products from server and cache to Dexie
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const res = await fetch('/api/products');
            if (res.ok) {
              const data = await res.json();
              if (data.products && data.products.length > 0) {
                setProducts(data.products);
                await offlineDb.products.clear();
                await offlineDb.products.bulkPut(data.products);
              }
            }
          } catch (e) {
            console.warn('Could not sync products from API, using offline products');
          }
        }
      } catch (err) {
        console.warn('Error initializing POS catalog:', err);
      } finally {
        setLoadingCatalog(false);
      }
    }

    initCatalogAndSession();

    const unsubscribe = subscribeToTransactionEvents((detail) => {
      if (detail.transaction.type === 'BILL_QR') {
        if (detail.transaction.billId) {
          setBillPaymentStatus(detail.transaction.status);
        }
        showSnackbar({
          type: detail.isOffline ? 'pending' : 'success',
          title: detail.isOffline ? 'Bill Payment Scanned (Pending Sync)' : 'Bill Payment Confirmed',
          description: `₹${detail.transaction.amount.toFixed(2)} received for ${detail.transaction.billId || 'Bill'} [${detail.transaction.status}]`,
          durationMs: 5000,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category || 'General')))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search));
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product._id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product._id,
          productId: product._id,
          name: product.name,
          quantity: 1,
          price: product.price,
        },
      ];
    });
  };

  const addCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(customPrice);
    if (!customName || isNaN(priceNum) || priceNum <= 0) return;

    const newItem: CartItem = {
      id: `custom-${Date.now()}`,
      name: customName,
      quantity: 1,
      price: priceNum,
    };

    setCart((prev) => [...prev, newItem]);
    setCustomName('');
    setCustomPrice('');
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = (subtotal * taxPercent) / 100;
  const grandTotal = Math.max(0, subtotal + taxAmount - discount);

  // Generate Bill QR Action
  const handleGenerateBillQr = async () => {
    if (cart.length === 0) return;

    const billId = `BILL-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const itemsPayload = cart.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    const encoded = encodeBillQr({
      transactionId,
      billId,
      merchantId: merchantInfo.merchantId,
      merchantName: merchantInfo.shopName,
      items: itemsPayload,
      subtotal,
      discount,
      tax: taxAmount,
      total: grandTotal,
      expiresAt,
    });

    setGeneratedBillId(billId);
    setBillPaymentStatus(null);
    setQrPayload(encoded);
    setQrModalOpen(true);

    // Save bill to local offline bills table
    try {
      const { offlineDb } = await import('@/offline/db');
      await offlineDb.bills.put({
        _id: billId,
        billId,
        merchantId: merchantInfo.merchantId,
        merchantName: merchantInfo.shopName,
        items: itemsPayload,
        subtotal,
        discount,
        tax: taxAmount,
        total: grandTotal,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        expiresAt,
      });
    } catch (dbErr) {
      console.warn('Failed to save bill to local offline DB:', dbErr);
    }

    // If online, also post to API asynchronously
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId,
          transactionId,
          items: itemsPayload,
          subtotal,
          discount,
          tax: taxAmount,
          totalAmount: grandTotal,
          expiresAt,
        }),
      }).catch(() => {
        // bill is already stored locally
      });
    }
  };

  const handleBarcodeDetected = (rawText: string) => {
    setScannerOpen(false);
    const trimmed = rawText.trim();
    const match = products.find(
      (p) => p.barcode === trimmed || p._id === trimmed || (p.barcode && p.barcode.endsWith(trimmed))
    );
    if (match) {
      addToCart(match);
      setBarcodeToast({
        type: 'success',
        text: `✓ Scanned & Added: ${match.name} (₹${match.price.toFixed(2)}) to active cart`,
      });
      setTimeout(() => setBarcodeToast(null), 5000);
    } else {
      setBarcodeToast({
        type: 'warn',
        text: `Barcode "${trimmed}" not found in current inventory. Add as a custom item below.`,
      });
      setCustomName(`Item (${trimmed.slice(-6)})`);
      setTimeout(() => setBarcodeToast(null), 7000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-4">
      {/* Barcode notification banner */}
      {barcodeToast && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in ${
            barcodeToast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}
        >
          <span>{barcodeToast.text}</span>
          <button
            onClick={() => setBarcodeToast(null)}
            className="text-xs font-black px-2 py-0.5 hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT COLUMN: Catalog Workspace */}
        <div className="flex-1 w-full space-y-5">
          {/* Header & Search */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-navy-900">POS Inventory Catalog</h1>
                <p className="text-xs text-slate-400">Scan or select items to add to active cart</p>
              </div>
              <button
                onClick={() => setScannerOpen(true)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
              >
                <Scan className="w-4 h-4 text-brand-lightBlue" />
                <span>Scan Barcode</span>
              </button>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search products by name or barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  <Scan className="w-3 h-3" />
                  <span>Scan</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-navy-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Products Grid or Empty Catalog State */}
          {loadingCatalog ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <div className="w-8 h-8 border-3 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400">Loading product catalog…</p>
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
              <PackageX className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-navy-900">No Products Cached Offline</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Connect to internet to sync your store catalog, or add custom items below.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredProducts.map((p) => (
                <div
                  key={p._id}
                  onClick={() => addToCart(p)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-brand-blue hover:shadow-md cursor-pointer transition-all space-y-3 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                        {p.category || 'General'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">Stock: {p.stock}</span>
                    </div>
                    <h4 className="text-xs font-black text-navy-900 mt-2 group-hover:text-brand-blue transition-colors line-clamp-2">
                      {p.name}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-base font-black text-navy-900">₹{p.price.toFixed(2)}</span>
                    <div className="w-7 h-7 bg-blue-50 text-brand-blue rounded-lg flex items-center justify-center font-black group-hover:bg-brand-blue group-hover:text-white transition-colors">
                      +
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Live Active POS Cart */}
        <div className="w-full lg:w-96 bg-white rounded-3xl border border-slate-200 shadow-card p-6 space-y-6 shrink-0 sticky top-20">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-brand-blue" />
              <h2 className="text-lg font-black text-navy-900">Active Bill Cart</h2>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-brand-blue rounded-full">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} items
            </span>
          </div>

          {/* Cart Item List */}
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-400">Cart is empty</p>
                <p className="text-[11px] text-slate-400">Click products from the catalog to add</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                >
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-navy-900 line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-slate-400">₹{item.price.toFixed(2)} each</p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-6 h-6 bg-white border border-slate-200 text-slate-700 font-bold rounded flex items-center justify-center hover:bg-slate-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-extrabold text-navy-900 w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-6 h-6 bg-white border border-slate-200 text-slate-700 font-bold rounded flex items-center justify-center hover:bg-slate-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Custom Quick Item Form */}
          <form onSubmit={addCustomItem} className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
              Add Custom Item
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Item name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-navy-900 bg-slate-50 focus:bg-white"
              />
              <input
                type="number"
                placeholder="₹"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-20 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-navy-900 bg-slate-50 focus:bg-white"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800"
              >
                Add
              </button>
            </div>
          </form>

          {/* Calculations Summary */}
          <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs border border-slate-100">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>Discount (₹)</span>
              <input
                type="number"
                min="0"
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-20 text-right px-2 py-0.5 border border-slate-200 rounded bg-white font-mono"
              />
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>Tax / GST (%)</span>
              <input
                type="number"
                min="0"
                value={taxPercent || ''}
                onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                className="w-20 text-right px-2 py-0.5 border border-slate-200 rounded bg-white font-mono"
              />
            </div>

            <div className="flex justify-between items-center text-sm font-black text-navy-900 pt-2 border-t border-slate-200">
              <span>Grand Total</span>
              <span className="text-xl text-brand-blue">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleGenerateBillQr}
              disabled={cart.length === 0}
              className="w-full py-3.5 bg-brand-blue hover:bg-brand-darkBlue text-white font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <QrCode className="w-5 h-5" />
              <span>Generate Bill QR Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bill QR Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 bg-navy-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-6 text-center relative shadow-2xl">
            <button
              onClick={() => setQrModalOpen(false)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-navy-900 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider bg-emerald-50 px-3 py-1 rounded-full">
                Bill QR Ready
              </span>
              <h3 className="text-xl font-black text-navy-900">Scan to Pay ₹{grandTotal.toFixed(2)}</h3>
              <p className="text-xs text-slate-500">Bill ID: {generatedBillId}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 inline-block mx-auto">
              <QrCodeGenerator value={qrPayload} size={220} qrType="BILL" />
            </div>

            {/* Live Customer Payment Status */}
            {billPaymentStatus ? (
              <div
                className={`p-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold ${
                  billPaymentStatus === 'CONFIRMED' || billPaymentStatus === 'SYNCED'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {billPaymentStatus === 'CONFIRMED' || billPaymentStatus === 'SYNCED' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Customer Paid & Confirmed Online!</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>Customer Scanned Offline: Queued (Pending Sync)</span>
                  </>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-300" />
                <span>Awaiting customer scan (Online & Offline supported)...</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print QR</span>
              </button>
              <button
                onClick={() => {
                  setCart([]);
                  setQrModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-navy-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800"
              >
                Done / Next Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}

