import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
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

    // 2. Seed product catalog using the merchant catalogs system
    const { seedMerchantProducts } = await import('@/lib/db/merchantCatalogs');
    const seededCount = await seedMerchantProducts(
      merchantProfile!._id,
      merchantProfile?.shopName || 'NoPay Supermart & Grocery'
    );

    return NextResponse.json({
      message: 'Database seeded successfully! Check the seed script output for demo credentials.',
      merchant: {
        email: 'merchant@nopay.com',
        shopName: merchantProfile?.shopName,
      },
      productCount: seededCount,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Seeding failed' }, { status: 500 });
  }
}
