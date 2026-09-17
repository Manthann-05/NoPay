import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Product } from '@/models/Product';
import { ProductSchema } from '@/lib/validation/schemas';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionUser();
  if (!session || !session.merchantProfileId || session.activeRole !== 'MERCHANT') {
    return NextResponse.json({ error: 'Merchant authorization required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validated = ProductSchema.parse(body);

    await connectToDatabase();

    const product = await Product.findOne({
      _id: params.id,
      merchantId: session.merchantProfileId,
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
    }

    Object.assign(product, validated);
    await product.save();

    return NextResponse.json({ message: 'Product updated successfully', product });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionUser();
  if (!session || !session.merchantProfileId || session.activeRole !== 'MERCHANT') {
    return NextResponse.json({ error: 'Merchant authorization required' }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const product = await Product.findOneAndUpdate(
      { _id: params.id, merchantId: session.merchantProfileId },
      { active: false }
    );

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product deleted' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
