import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  initialRole: z.enum(['CUSTOMER', 'MERCHANT']).default('CUSTOMER'),
  shopName: z.string().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const EnableMerchantSchema = z.object({
  shopName: z.string().min(2, 'Shop name is required'),
  address: z.string().min(3, 'Address is required'),
  area: z.string().min(2, 'Area is required'),
});

export const ProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  barcode: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  stock: z.number().int().min(0, 'Stock must be non-negative'),
  category: z.string().optional().default('General'),
  active: z.boolean().default(true),
});

export const BillItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().min(0),
});

export const CreateBillSchema = z.object({
  billId: z.string().min(1).optional(),
  transactionId: z.string().min(1).optional(),
  items: z.array(BillItemSchema).min(1, 'At least one item is required'),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  subtotal: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  expiresAt: z.string().optional(),
});

export const TransactionSyncSchema = z.object({
  transactionId: z.string().min(1),
  merchantId: z.string().min(1),
  merchantName: z.string().min(1),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  billId: z.string().optional(),
  amount: z.number().positive('Amount must be greater than zero'),
  type: z.enum(['STATIC_QR', 'BILL_QR']),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
  offlineCreated: z.boolean().default(true),
  createdAt: z.string().optional(),
});
