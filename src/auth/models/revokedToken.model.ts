import mongoose, { Schema, Document } from 'mongoose';

export interface IRevokedToken extends Document {
  tokenHash: string;
  email: string;
  revokedAt: Date;
  expiresAt: Date;
}

const revokedTokenSchema = new Schema<IRevokedToken>({
  tokenHash: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true },
  revokedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedToken = mongoose.model<IRevokedToken>('RevokedToken', revokedTokenSchema);
