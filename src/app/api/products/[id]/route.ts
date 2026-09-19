import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Product } from '@/models/Product';
import { ProductSchema } from '@/lib/validation/schemas';
import { getRequiredMerchantSession, authErrorResponse } from '@/lib/auth/apiGuards';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getRequiredMerchantSession();
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
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getRequiredMerchantSession();
    await connectToDatabase();
    const product = await Product.findOneAndUpdate(
      { _id: params.id, merchantId: session.merchantProfileId },
      { active: false }
    );

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product deleted' });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
