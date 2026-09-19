import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { MerchantProfile } from '@/models/MerchantProfile';
import { hashPassword, setSessionCookie } from '@/lib/auth/jwt';
import { RegisterSchema } from '@/lib/validation/schemas';
import { encodeStaticMerchantQr } from '@/lib/qr/payload';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = RegisterSchema.parse(body);

    await connectToDatabase();

    const existingUser = await User.findOne({ email: validated.email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json({ error: 'Email is already registered' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(validated.password);
    const roles: ('CUSTOMER' | 'MERCHANT')[] = ['CUSTOMER'];

    if (validated.initialRole === 'MERCHANT') {
      roles.push('MERCHANT');
    }

    const newUser = await User.create({
      name: validated.name,
      email: validated.email.toLowerCase(),
      passwordHash: hashedPassword,
      roles,
      activeRole: validated.initialRole,
    });

    let merchantProfileId: string | undefined;

    if (validated.initialRole === 'MERCHANT' && validated.shopName) {
      const merchantProfile = await MerchantProfile.create({
        userId: newUser._id,
        shopName: validated.shopName,
        address: validated.address || 'Standard Location',
        area: validated.area || 'City Central',
        staticQrPayload: 'pending',
        version: 1,
      });

      merchantProfile.staticQrPayload = encodeStaticMerchantQr(merchantProfile._id.toString());
      await merchantProfile.save();

      merchantProfileId = merchantProfile._id.toString();
      newUser.merchantProfileId = merchantProfile._id;
      await newUser.save();
    }

    const payload = {
      userId: newUser._id.toString(),
      email: newUser.email,
      name: newUser.name,
      roles: newUser.roles,
      activeRole: newUser.activeRole,
      merchantProfileId,
    };

    await setSessionCookie(payload);

    return NextResponse.json(
      {
        message: 'Account registered successfully',
        user: payload,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error('Registration API Error:', err);
    const isDatabaseError = err?.name === 'MongoServerSelectionError'
      || err?.name === 'MongooseServerSelectionError'
      || err?.code === 'ECONNREFUSED'
      || err?.code === 'ENOTFOUND'
      || err?.code === 'ETIMEDOUT'
      || err?.syscall === 'querySrv';
    return NextResponse.json(
      {
        error: isDatabaseError
          ? 'Database unavailable. Check your Atlas network access, URI, and restart the dev server.'
          : 'Failed to create user account',
      },
      { status: isDatabaseError ? 503 : 500 }
    );
  }
}
