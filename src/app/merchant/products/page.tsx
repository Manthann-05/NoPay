'use client';

import React, { useState, useEffect } from 'react';
import { Product } from '@/types';
import { Package, Plus, Edit, Trash2, Search, Scan, X } from 'lucide-react';
import { BarcodeScanner } from '@/components/qr/BarcodeScanner';

export default function MerchantProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [barcode, setBarcode] = useState('');

  // Scanner Modal
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        const { offlineDb } = await import('@/offline/db');
        const local = await offlineDb.products.toArray();
        if (local.length > 0) {
          setProducts(local);
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setCatalogMessage('No offline products available. Connect to the internet to refresh your catalog.');
        }

        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const res = await fetch('/api/products');
          if (res.ok) {
            const data = await res.json();
            if (data.products) {
              setProducts(data.products);
              await offlineDb.products.clear();
              if (data.products.length > 0) {
                await offlineDb.products.bulkPut(data.products);
              }
              setCatalogMessage(null);
            }
          } else if (local.length === 0) {
            setCatalogMessage('No offline products available. Connect to the internet to refresh your catalog.');
          }
        }
      } catch {
        if (products.length === 0) {
          setCatalogMessage('No offline products available. Connect to the internet to refresh your catalog.');
        }
      }
    }
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setStock('');
    setCategory('General');
    setBarcode('');
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingId(p._id);
    setName(p.name);
    setPrice(p.price.toString());
    setStock(p.stock.toString());
    setCategory(p.category || 'General');
    setBarcode(p.barcode || '');
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(price);
    const numStock = parseInt(stock) || 0;

    if (!name || isNaN(numPrice)) return;

    if (editingId) {
      // Update existing
      setProducts((prev) =>
        prev.map((p) =>
          p._id === editingId
            ? { ...p, name, price: numPrice, stock: numStock, category, barcode }
            : p
        )
      );
      fetch(`/api/products/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price: numPrice, stock: numStock, category, barcode }),
      }).catch(console.error);
    } else {
      // Create new
      const newP: Product = {
        _id: `prod-${Date.now()}`,
        merchantId: 'm1',
        name,
        price: numPrice,
        stock: numStock,
        category,
        barcode,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProducts((prev) => [newP, ...prev]);
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price: numPrice, stock: numStock, category, barcode }),
      }).catch(console.error);
    }

    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    setProducts((prev) => prev.filter((p) => p._id !== id));
    fetch(`/api/products/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search))
  );

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900">Product Inventory</h1>
          <p className="text-xs text-slate-400">Manage item prices, barcodes, and stock levels</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-5 py-3 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products by name, category, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Product Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Barcode</th>
                <th className="p-4">Price (₹)</th>
                <th className="p-4">Stock</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-navy-900">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-slate-500">
                    {catalogMessage || 'No products in your catalog yet. Add a product to get started.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-bold">{p.name}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-600">
                      {p.category || 'General'}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-500">{p.barcode || '—'}</td>
                  <td className="p-4 font-black text-brand-blue">₹{p.price.toFixed(2)}</td>
                  <td className="p-4">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        p.stock < 10 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {p.stock} units
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1.5 text-slate-500 hover:text-brand-blue transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p._id)}
                      className="p-1.5 text-slate-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-navy-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 relative shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-navy-900"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-navy-900">
              {editingId ? 'Edit Product' : 'Add New Product'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-navy-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-navy-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Stock Qty</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-navy-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Dairy, Snacks, Pantry"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-navy-900"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-600">Barcode Number</label>
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="text-[11px] text-brand-blue font-bold flex items-center gap-1"
                  >
                    <Scan className="w-3.5 h-3.5" /> Scan Barcode
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 8901234567890"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-navy-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-brand-darkBlue shadow-md"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scannerOpen && (
        <BarcodeScanner
          onDetected={(rawText) => {
            setBarcode(rawText);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
