import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  roles: ('CUSTOMER' | 'MERCHANT')[];
  activeRole: 'CUSTOMER' | 'MERCHANT';
  merchantProfileId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    roles: {
      type: [String],
      enum: ['CUSTOMER', 'MERCHANT'],
      default: ['CUSTOMER'],
    },
    activeRole: {
      type: String,
      enum: ['CUSTOMER', 'MERCHANT'],
      default: ['CUSTOMER'],
    },
    merchantProfileId: { type: Schema.Types.ObjectId, ref: 'MerchantProfile' },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
