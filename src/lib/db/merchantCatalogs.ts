/**
 * Merchant Preset Catalogs Database
 * Provides distinct inventory collections for different types of businesses:
 * - Medicine / Pharmacy
 * - Grocery / Supermarket
 * - Stationery / Office Supplies
 * - Books / Bookstore
 */

import { Product } from '@/models/Product';
import mongoose from 'mongoose';

export type StoreCategory = 'GROCERY' | 'MEDICINE' | 'STATIONERY' | 'BOOKS';

export interface CatalogItem {
  name: string;
  barcode: string;
  price: number;
  stock: number;
  category: string;
}

export const MERCHANT_PRESET_CATALOGS: Record<StoreCategory, { label: string; icon: string; items: CatalogItem[] }> = {
  GROCERY: {
    label: 'Grocery & Supermarket',
    icon: '🛒',
    items: [
      { name: 'Fresh Milk 1L', barcode: '8901234567890', price: 60, stock: 50, category: 'Dairy' },
      { name: 'Whole Wheat Bread', barcode: '8901234567891', price: 45, stock: 35, category: 'Bakery' },
      { name: 'Potato Chips 100g', barcode: '8901234567892', price: 30, stock: 100, category: 'Snacks' },
      { name: 'Sparkling Soda 500ml', barcode: '8901234567893', price: 40, stock: 40, category: 'Beverages' },
      { name: 'Instant Coffee 100g', barcode: '8901234567894', price: 180, stock: 25, category: 'Pantry' },
      { name: 'Dark Chocolate Bar', barcode: '8901234567895', price: 95, stock: 60, category: 'Snacks' },
      { name: 'Organic Farm Eggs (12 pk)', barcode: '8901234567896', price: 120, stock: 20, category: 'Dairy' },
      { name: 'Basmati Rice 1kg', barcode: '8901234567897', price: 110, stock: 45, category: 'Grains' },
      { name: 'Sunflower Cooking Oil 1L', barcode: '8901234567898', price: 165, stock: 30, category: 'Pantry' },
      { name: 'Natural Mineral Water 1L', barcode: '8901234567899', price: 20, stock: 120, category: 'Beverages' },
    ],
  },
  MEDICINE: {
    label: 'Medicine & Pharmacy',
    icon: '💊',
    items: [
      { name: 'Paracetamol 500mg (10 tabs)', barcode: '890123400001', price: 30, stock: 150, category: 'Tablets' },
      { name: 'Amoxicillin 250mg (10 caps)', barcode: '890123400002', price: 85, stock: 60, category: 'Antibiotics' },
      { name: 'Cough Relief Syrup 100ml', barcode: '890123400003', price: 95, stock: 45, category: 'Syrups' },
      { name: 'Vitamin C Chewable 500mg', barcode: '890123400004', price: 60, stock: 80, category: 'Supplements' },
      { name: 'Antiseptic Liquid 250ml', barcode: '890123400005', price: 75, stock: 40, category: 'First Aid' },
      { name: 'Waterproof Band-Aid (Pack of 20)', barcode: '890123400006', price: 45, stock: 100, category: 'First Aid' },
      { name: 'Digital Oral Thermometer', barcode: '890123400007', price: 250, stock: 25, category: 'Devices' },
      { name: 'Fast Pain Relief Gel 30g', barcode: '890123400008', price: 120, stock: 50, category: 'Ointments' },
      { name: 'Hand Sanitizer 200ml', barcode: '890123400009', price: 65, stock: 90, category: 'Hygiene' },
      { name: 'Electrolyte Energy Sachet', barcode: '890123400010', price: 25, stock: 200, category: 'Supplements' },
    ],
  },
  STATIONERY: {
    label: 'Stationery & Office Supplies',
    icon: '✏️',
    items: [
      { name: 'A4 Spiral Ruled Notebook (200p)', barcode: '890200000001', price: 80, stock: 75, category: 'Notebooks' },
      { name: 'Gel Ink Pen Set (Pack of 5)', barcode: '890200000002', price: 50, stock: 120, category: 'Pens' },
      { name: 'Neon Highlighters (Pack of 4)', barcode: '890200000003', price: 120, stock: 60, category: 'Markers' },
      { name: 'Pastel Sticky Notes (400 sheets)', barcode: '890200000004', price: 65, stock: 90, category: 'Paper' },
      { name: 'Stainless Steel Scissors 6-inch', barcode: '890200000005', price: 70, stock: 40, category: 'Tools' },
      { name: 'Heavy Duty Stapler & Pins', barcode: '890200000006', price: 160, stock: 35, category: 'Tools' },
      { name: 'Artist Drawing Sketchbook A3', barcode: '890200000007', price: 150, stock: 30, category: 'Art' },
      { name: 'Correction Tape Dispenser', barcode: '890200000008', price: 45, stock: 85, category: 'Accessories' },
      { name: 'Clear Document Folder (Set of 10)', barcode: '890200000009', price: 90, stock: 70, category: 'Files' },
      { name: 'Permanent Markers (Black, Blue, Red)', barcode: '890200000010', price: 55, stock: 110, category: 'Markers' },
    ],
  },
  BOOKS: {
    label: 'Books & Bookstore',
    icon: '📚',
    items: [
      { name: 'Atomic Habits by James Clear', barcode: '9781847941831', price: 450, stock: 25, category: 'Self Help' },
      { name: 'The Psychology of Money', barcode: '9789390166268', price: 350, stock: 30, category: 'Finance' },
      { name: 'Sapiens: A Brief History of Humankind', barcode: '9780099590088', price: 499, stock: 20, category: 'Non-Fiction' },
      { name: 'Rich Dad Poor Dad', barcode: '9781612680194', price: 399, stock: 40, category: 'Finance' },
      { name: 'To Kill a Mockingbird', barcode: '9780099549482', price: 299, stock: 15, category: 'Fiction' },
      { name: 'The Alchemist by Paulo Coelho', barcode: '9788172234980', price: 280, stock: 35, category: 'Fiction' },
      { name: 'Oxford English Dictionary Pocket', barcode: '9780199558469', price: 220, stock: 18, category: 'Reference' },
      { name: 'Coding Interview Prep Guide', barcode: '9780984782857', price: 550, stock: 12, category: 'Technology' },
      { name: 'Think and Grow Rich', barcode: '9788192910918', price: 250, stock: 50, category: 'Self Help' },
      { name: 'The Great Gatsby', barcode: '9780141182636', price: 210, stock: 22, category: 'Classics' },
    ],
  },
};

/**
 * Detect appropriate store category based on business name or keywords
 */
export function detectStoreCategory(shopName?: string): StoreCategory {
  if (!shopName) return 'GROCERY';
  const lower = shopName.toLowerCase();

  if (lower.match(/med|pharm|chem|health|clinic|drug|care|cure/)) {
    return 'MEDICINE';
  }
  if (lower.match(/station|pen|paper|office|craft|print|xerox|copy/)) {
    return 'STATIONERY';
  }
  if (lower.match(/book|read|novel|library|publish|author|story/)) {
    return 'BOOKS';
  }
  return 'GROCERY';
}

/**
 * Seed or replace products for a given merchant in MongoDB
 */
export async function seedMerchantProducts(
  merchantProfileId: string | mongoose.Types.ObjectId,
  shopName: string,
  categoryChoice?: StoreCategory
): Promise<number> {
  const category = categoryChoice || detectStoreCategory(shopName);
  const catalog = MERCHANT_PRESET_CATALOGS[category];

  if (!catalog) return 0;

  const mId = typeof merchantProfileId === 'string' 
    ? new mongoose.Types.ObjectId(merchantProfileId) 
    : merchantProfileId;

  // Insert catalog items for this specific merchant
  for (const item of catalog.items) {
    await Product.updateOne(
      { merchantId: mId, barcode: item.barcode },
      {
        ...item,
        merchantId: mId,
        active: true,
      },
      { upsert: true }
    );
  }

  return catalog.items.length;
}
