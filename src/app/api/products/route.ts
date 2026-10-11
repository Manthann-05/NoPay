import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Product } from '@/models/Product';
import { ProductSchema } from '@/lib/validation/schemas';
import { getRequiredMerchantSession, authErrorResponse } from '@/lib/auth/apiGuards';

export async function GET(req: Request) {
  try {
    const session = await getRequiredMerchantSession();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const barcode = searchParams.get('barcode') || '';
    const category = searchParams.get('category') || '';

    await connectToDatabase();

    const query: Record<string, unknown> = {
      active: true,
      merchantId: session.merchantProfileId,
    };

    if (barcode) {
      query.barcode = barcode;
    } else if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    let products = await Product.find(query).sort({ updatedAt: -1 }).lean();

    // If merchant has no products at all in DB, auto-seed based on their store type
    if (products.length === 0 && !search && !barcode && (!category || category === 'All') && session.merchantProfileId) {
      try {
        const { MerchantProfile } = await import('@/models/MerchantProfile');
        const { seedMerchantProducts } = await import('@/lib/db/merchantCatalogs');
        const profile = await MerchantProfile.findById(session.merchantProfileId);
        if (profile) {
          await seedMerchantProducts(profile._id, profile.shopName);
          products = await Product.find(query).sort({ updatedAt: -1 }).lean();
        }
      } catch (seedErr) {
        console.warn('Could not auto-seed on GET products:', seedErr);
      }
    }

    return NextResponse.json({ products });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    console.error('Products GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredMerchantSession();
    const body = await req.json();
    const validated = ProductSchema.parse(body);

    await connectToDatabase();

    const newProduct = await Product.create({
      ...validated,
      merchantId: session.merchantProfileId,
    });

    return NextResponse.json(
      {
        message: 'Product created successfully',
        product: newProduct,
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
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
