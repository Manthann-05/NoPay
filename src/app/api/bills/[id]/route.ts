import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Bill } from '@/models/Bill';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectToDatabase();
    const bill = await Bill.findOne({ billId: params.id }).lean();
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }
    return NextResponse.json({ bill });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch bill' }, { status: 500 });
  }
}
