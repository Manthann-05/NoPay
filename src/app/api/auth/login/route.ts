import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { verifyPassword, setSessionCookie } from '@/lib/auth/jwt';
import { LoginSchema } from '@/lib/validation/schemas';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = LoginSchema.parse(body);

    await connectToDatabase();

    const user = await User.findOne({ email: validated.email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(validated.password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      roles: user.roles,
      activeRole: user.activeRole,
      merchantProfileId: user.merchantProfileId?.toString(),
    };

    await setSessionCookie(payload);

    return NextResponse.json({
      message: 'Login successful',
      user: payload,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error('Login API Error:', err);
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
          : 'Authentication failed',
      },
      { status: isDatabaseError ? 503 : 500 }
    );
  }
}
