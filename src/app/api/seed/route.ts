import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Product } from '@/models/Product';
import { User } from '@/models/User';
import { MerchantProfile } from '@/models/MerchantProfile';
import { hashPassword } from '@/lib/auth/jwt';
import { encodeStaticMerchantQr } from '@/lib/qr/payload';

/**
 * SECURITY: Seeding is a development/demo convenience only.
 * It is disabled in production and never returns credentials.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { message: 'Database seeding is disabled in production.' },
      { status: 404 }
    );
  }

  try {
    await connectToDatabase();

    // 1. Create or update Demo Merchant User
    let demoMerchant = await User.findOne({ email: 'merchant@nopay.com' });
    let merchantProfile;

    if (!demoMerchant) {
      const pwdHash = await hashPassword('password123');
      demoMerchant = await User.create({
        name: 'NoPay Supermart',
        email: 'merchant@nopay.com',
        passwordHash: pwdHash,
        roles: ['CUSTOMER', 'MERCHANT'],
        activeRole: 'MERCHANT',
      });

      merchantProfile = await MerchantProfile.create({
        userId: demoMerchant._id,
        shopName: 'NoPay Supermart & Grocery',
        address: '100 Innovation Way, Tech Park',
        area: 'Downtown Metro',
        staticQrPayload: 'pending',
      });

      merchantProfile.staticQrPayload = encodeStaticMerchantQr(merchantProfile._id.toString());
      await merchantProfile.save();

      demoMerchant.merchantProfileId = merchantProfile._id;
      await demoMerchant.save();
    } else {
      merchantProfile = await MerchantProfile.findOne({ userId: demoMerchant._id });
      if (merchantProfile && (!merchantProfile.staticQrPayload || merchantProfile.staticQrPayload === 'pending' || !merchantProfile.staticQrPayload.startsWith('NOPAY://'))) {
        merchantProfile.staticQrPayload = encodeStaticMerchantQr(merchantProfile._id.toString());
        await merchantProfile.save();
      }
    }

    // 2. Seed Default Product Catalog
    const sampleProducts = [
      { name: 'Fresh Milk 1L', barcode: '8901234567890', price: 60, stock: 50, category: 'Dairy' },
      { name: 'Whole Wheat Bread', barcode: '8901234567891', price: 45, stock: 30, category: 'Bakery' },
      { name: 'Potato Chips 100g', barcode: '8901234567892', price: 30, stock: 100, category: 'Snacks' },
      { name: 'Sparkling Soda 500ml', barcode: '8901234567893', price: 40, stock: 40, category: 'Beverages' },
      { name: 'Instant Coffee 100g', barcode: '8901234567894', price: 180, stock: 25, category: 'Pantry' },
      { name: 'Dark Chocolate Bar', barcode: '8901234567895', price: 95, stock: 60, category: 'Snacks' },
      { name: 'Organic Eggs (12 pk)', barcode: '8901234567896', price: 120, stock: 20, category: 'Dairy' },
    ];

    for (const prod of sampleProducts) {
      await Product.updateOne(
        { merchantId: merchantProfile?._id, barcode: prod.barcode },
        { ...prod, merchantId: merchantProfile?._id, active: true },
        { upsert: true }
      );
    }

    return NextResponse.json({
      message: 'Database seeded successfully! Check the seed script output for demo credentials.',
      merchant: {
        email: 'merchant@nopay.com',
        shopName: merchantProfile?.shopName,
      },
      productCount: sampleProducts.length,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Seeding failed' }, { status: 500 });
  }
}
