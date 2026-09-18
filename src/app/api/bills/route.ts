import { NextResponse } from 'next/server';
import { getRequiredMerchantSession, authErrorResponse } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Bill } from '@/models/Bill';
import { Product } from '@/models/Product';
import { MerchantProfile } from '@/models/MerchantProfile';
import { CreateBillSchema } from '@/lib/validation/schemas';
import { encodeBillQr } from '@/lib/qr/payload';

export async function POST(req: Request) {
  try {
    const session = await getRequiredMerchantSession();
    const body = await req.json();
    const validated = CreateBillSchema.parse(body);

    await connectToDatabase();

    const merchant = await MerchantProfile.findById(session.merchantProfileId);
    if (!merchant || merchant.active === false) {
      return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });
    }

    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const item of validated.items) {
      let unitPrice = item.price;

      if (item.productId) {
        const product = await Product.findOne({
          _id: item.productId,
          merchantId: session.merchantProfileId,
        });
        if (product) {
          unitPrice = product.price;
        }
      }

      calculatedSubtotal += unitPrice * item.quantity;
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
    const expiresAt = validated.expiresAt
      ? new Date(validated.expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const billId =
      validated.billId?.trim() ||
      `BILL-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const transactionId =
      validated.transactionId?.trim() || `TXN-${Date.now().toString(36).toUpperCase()}`;

    const existing = await Bill.findOne({ billId });
    if (existing) {
      if (String(existing.merchantId) !== String(session.merchantProfileId)) {
        return NextResponse.json({ error: 'Bill ID is already in use' }, { status: 409 });
      }
      return NextResponse.json({
        message: 'Bill already exists',
        bill: existing,
        transactionId: existing.transactionId,
      });
    }

    const newBill = await Bill.create({
      billId,
      transactionId,
      merchantId: session.merchantProfileId,
      merchantName: merchant.shopName,
      items: validatedItems,
      subtotal,
      discount,
      tax,
      total: calculatedTotal,
      status: 'CREATED',
      expiresAt,
    });

    const qrValue = encodeBillQr({
      billId,
      transactionId,
      merchantId: session.merchantProfileId as string,
      merchantName: merchant.shopName,
      items: validatedItems,
      subtotal,
      discount,
      tax,
      total: calculatedTotal,
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json(
      {
        message: 'Bill created',
        bill: newBill,
        qrValue,
        transactionId,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    if (typeof err === 'object' && err && (err as { name?: string }).name === 'ZodError') {
      return NextResponse.json(
        { error: (err as { errors: { message: string }[] }).errors[0].message },
        { status: 400 }
      );
    }
    console.error('Create Bill Error:', err);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}
