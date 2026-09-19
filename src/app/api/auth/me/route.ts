import { NextResponse } from 'next/server';
import { getSessionUser, setSessionCookie } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { MerchantProfile } from '@/models/MerchantProfile';

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 404 });
    }

    let merchantProfile = null;
    if (user.merchantProfileId) {
      merchantProfile = await MerchantProfile.findById(user.merchantProfileId);
    }

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      roles: user.roles,
      activeRole: user.activeRole,
      merchantProfileId: user.merchantProfileId?.toString(),
      merchantProfile: merchantProfile ? {
        shopName: merchantProfile.shopName,
        address: merchantProfile.address,
        area: merchantProfile.area,
        staticQrPayload: merchantProfile.staticQrPayload,
      } : null,
    };

    return NextResponse.json({
      authenticated: true,
      user: payload,
    });
  } catch (err) {
    // SECURITY: Never report an authenticated state when the database
    // cannot be reached — the client falls back to the local session.
    console.error('Auth me DB error:', err);
    return NextResponse.json(
      { authenticated: false, user: null, error: 'Could not verify session. Please try again.' },
      { status: 503 }
    );
  }
}

export async function PUT(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { activeRole } = await req.json();
    if (!['CUSTOMER', 'MERCHANT'].includes(activeRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    await connectToDatabase();
    // SECURITY: Re-verify roles against the database, never trust only the
    // JWT claim. A stale or tampered token must not grant merchant access.
    const dbUser = await User.findById(session.userId).select('roles');
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (activeRole === 'MERCHANT' && !dbUser.roles.includes('MERCHANT')) {
      return NextResponse.json({ error: 'User does not possess MERCHANT role' }, { status: 403 });
    }

    await User.findByIdAndUpdate(session.userId, { activeRole });

    const updatedSession = {
      ...session,
      roles: dbUser.roles,
      activeRole,
    };

    await setSessionCookie(updatedSession);

    return NextResponse.json({
      message: 'Active role updated',
      user: updatedSession,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update active role' }, { status: 500 });
  }
}
