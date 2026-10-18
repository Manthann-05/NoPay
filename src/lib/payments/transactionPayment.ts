import { Transaction } from '@/models/Transaction';
import { MerchantProfile } from '@/models/MerchantProfile';
import { getRazorpay, isRazorpayRouteEnabled, razorpayRequest } from '@/lib/payments/razorpay';

export async function markTransactionPaymentCaptured(
  transactionId: string,
  paymentId: string
): Promise<void> {
  const transaction = await Transaction.findOne({ transactionId });
  if (!transaction) throw new Error('Captured payment transaction was not found.');
  if (transaction.paymentReference && transaction.paymentReference !== paymentId) {
    throw new Error('A different payment is already recorded for this transaction.');
  }
  await Transaction.updateOne(
    { transactionId, $or: [{ paymentReference: null }, { paymentReference: paymentId }] },
    { $set: { paymentStatus: 'PAID', paymentReference: paymentId } }
  );
  const current = await Transaction.findOne({ transactionId });
  if (!current) throw new Error('Captured payment transaction was not found.');
  if (current.paymentReference !== paymentId) {
    throw new Error('A different payment was recorded for this transaction.');
  }
  await Transaction.updateOne(
    { transactionId, payoutStatus: { $exists: false } },
    { $set: { payoutStatus: 'PENDING' } }
  );

  if (current.razorpayTransferId) {
    try {
      const transfer = await getRazorpay().transfers.fetch(current.razorpayTransferId);
      await Transaction.updateOne(
        { transactionId, payoutStatus: { $ne: 'TRANSFERRED' } },
        { $set: { payoutStatus: transfer.status === 'processed' ? 'TRANSFERRED' : 'TRANSFER_PENDING' } }
      );
    } catch (error) {
      console.error('Could not refresh merchant transfer status for transaction:', transactionId, error);
    }
    return;
  }

  if (!isRazorpayRouteEnabled()) {
    await Transaction.updateOne(
      { transactionId, payoutStatus: { $ne: 'TRANSFERRED' } },
      { $set: { payoutStatus: 'TRANSFER_FAILED' } }
    );
    return;
  }

  const merchant = await MerchantProfile.findById(current.merchantId).select(
    '+razorpayLinkedAccountId razorpayLinkedAccountStatus razorpaySettlementStatus'
  );
  if (
    !merchant?.razorpayLinkedAccountId ||
    !['CREATED', 'ACTIVATED', 'ACTIVE'].includes(merchant.razorpayLinkedAccountStatus || '') ||
    merchant.razorpaySettlementStatus !== 'VERIFIED'
  ) {
    await Transaction.updateOne(
      { transactionId, payoutStatus: { $ne: 'TRANSFERRED' } },
      { $set: { payoutStatus: 'TRANSFER_FAILED' } }
    );
    return;
  }

  try {
    const transfer = await razorpayRequest<{ id: string; status: string }>(
      '/transfers',
      'POST',
      {
        account: merchant.razorpayLinkedAccountId,
        amount: Math.round(Number(current.amount) * 100),
        currency: 'INR',
        notes: { nopay_transaction_id: current.transactionId },
      },
      `nopay_${current._id}`
    );
    await Transaction.updateOne(
      { transactionId, payoutStatus: { $ne: 'TRANSFERRED' } },
      {
        $set: {
          razorpayTransferId: transfer.id,
          payoutStatus: transfer.status === 'processed' ? 'TRANSFERRED' : 'TRANSFER_PENDING',
        },
      }
    );
  } catch (error) {
    await Transaction.updateOne(
      { transactionId, payoutStatus: { $ne: 'TRANSFERRED' } },
      {
        $set: {
          payoutStatus: 'TRANSFER_FAILED',
          failureReason: 'Payment captured; merchant payout needs review.',
        },
      }
    );
    console.error('Merchant transfer failed for transaction:', transactionId, error);
  }
}
