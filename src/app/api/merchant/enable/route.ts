import { NextResponse } from 'next/server';
import { getSessionUser, setSessionCookie } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { MerchantProfile } from '@/models/MerchantProfile';
import { EnableMerchantSchema } from '@/lib/validation/schemas';
import { encodeStaticMerchantQr } from '@/lib/qr/payload';
import { seedMerchantProducts } from '@/lib/db/merchantCatalogs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = EnableMerchantSchema.parse(body);

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let merchantProfile = await MerchantProfile.findOne({ userId: user._id });
    let isNewMerchant = false;

    if (!merchantProfile) {
      isNewMerchant = true;
      merchantProfile = await MerchantProfile.create({
        userId: user._id,
        shopName: validated.shopName,
        address: validated.address,
        area: validated.area,
        staticQrPayload: 'pending',
        version: 1,
      });
      merchantProfile.staticQrPayload = encodeStaticMerchantQr(merchantProfile._id.toString());
      await merchantProfile.save();
    }

    if (!user.roles.includes('MERCHANT')) {
      user.roles.push('MERCHANT');
    }
    user.activeRole = 'MERCHANT';
    user.merchantProfileId = merchantProfile._id;
    await user.save();

    // Auto-seed a product catalog based on the shop name for new merchants
    if (isNewMerchant) {
      try {
        await seedMerchantProducts(merchantProfile._id, validated.shopName);
      } catch (seedErr) {
        console.warn('Could not auto-seed merchant products:', seedErr);
        // Non-fatal — merchant can add products manually
      }
    }

    const updatedSession = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      roles: user.roles,
      activeRole: 'MERCHANT' as const,
      merchantProfileId: merchantProfile._id.toString(),
    };

    await setSessionCookie(updatedSession);

    return NextResponse.json({
      message: 'Merchant Mode successfully enabled!',
      user: updatedSession,
      merchantProfile,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error('Enable Merchant API Error:', err);
    return NextResponse.json({ error: 'Failed to enable Merchant Mode' }, { status: 500 });
  }
}
