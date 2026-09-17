import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Bill } from '@/models/Bill';
import { Product } from '@/models/Product';
import { MerchantProfile } from '@/models/MerchantProfile';
import { CreateBillSchema } from '@/lib/validation/schemas';
import { encodeBillQrPayload } from '@/lib/qr/payload';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || !session.merchantProfileId || session.activeRole !== 'MERCHANT') {
    return NextResponse.json({ error: 'Merchant authorization required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validated = CreateBillSchema.parse(body);

    await connectToDatabase();

    const merchant = await MerchantProfile.findById(session.merchantProfileId);
    if (!merchant) {
      return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });
    }

    // SERVER-SIDE RE-VALIDATION OF ITEMS & TOTALS
    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const item of validated.items) {
      let unitPrice = item.price;

      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (product) {
          unitPrice = product.price; // Enforce authoritative server price
        }
      }

      const itemTotal = unitPrice * item.quantity;
      calculatedSubtotal += itemTotal;

      validatedItems.push({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: unitPrice,
      });
    }

    const subtotal = calculatedSubtotal;
    const discount = Math.min(validated.discount, subtotal);
    const tax = Math.max(0, validated.tax);
    const calculatedTotal = Math.max(0, subtotal - discount + tax);

    const billId = `BILL-${Math.floor(1000 + Math.random() * 9000)}`;
    const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}`;

    const newBill = await Bill.create({
      billId,
      merchantId: session.merchantProfileId,
      merchantName: merchant.shopName,
      items: validatedItems,
      subtotal,
      discount,
      tax,
      total: calculatedTotal,
      status: 'CREATED',
    });

    const qrPayload = encodeBillQrPayload({
      type: 'BILL',
      version: 1,
      transactionId,
      billId,
      merchantId: session.merchantProfileId,
      merchantName: merchant.shopName,
      items: validatedItems,
      subtotal,
      discount,
      tax,
      total: calculatedTotal,
      createdAt: newBill.createdAt.toISOString(),
    });

    return NextResponse.json({
      message: 'Bill created and validated successfully',
      bill: newBill,
      qrPayload,
      transactionId,
    }, { status: 201 });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error('Create Bill Error:', err);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}
