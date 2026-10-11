import mongoose, { Schema, type Document } from 'mongoose';

export interface IPaymentWebhookEvent extends Document {
  eventId: string;
  eventType: string;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentWebhookEventSchema = new Schema<IPaymentWebhookEvent>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    processedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

export const PaymentWebhookEvent =
  mongoose.models.PaymentWebhookEvent ||
  mongoose.model<IPaymentWebhookEvent>('PaymentWebhookEvent', PaymentWebhookEventSchema);
