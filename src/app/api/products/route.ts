import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Product } from '@/models/Product';
import { ProductSchema } from '@/lib/validation/schemas';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const barcode = searchParams.get('barcode') || '';
    const category = searchParams.get('category') || '';
    const merchantId = searchParams.get('merchantId');

    await connectToDatabase();

    const query: any = { active: true };

    if (merchantId) {
      query.merchantId = merchantId;
    } else {
      const session = await getSessionUser();
      if (session?.merchantProfileId) {
        query.merchantId = session.merchantProfileId;
      }
    }

    if (barcode) {
      query.barcode = barcode;
    } else if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    const products = await Product.find(query).sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ products });
  } catch (err) {
    console.error('Products GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || !session.merchantProfileId || session.activeRole !== 'MERCHANT') {
    return NextResponse.json({ error: 'Merchant authorization required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validated = ProductSchema.parse(body);

    await connectToDatabase();

    const newProduct = await Product.create({
      ...validated,
      merchantId: session.merchantProfileId,
    });

    return NextResponse.json({
      message: 'Product created successfully',
      product: newProduct,
    }, { status: 201 });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
