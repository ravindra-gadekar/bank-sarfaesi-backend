import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Otp } from '../models/otp.model';
import { ApiError } from '../../common/utils/apiError';

const SALT_ROUNDS = 10;
const MAX_ATTEMPTS = 5;

export const otpService = { generateOtp, verifyOtp };

export async function generateOtp(email: string): Promise<string> {
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);

  await Otp.findOneAndUpdate(
    { email },
    { email, otpHash, attempts: 0 },
    { upsert: true, returnDocument: 'after' },
  );

  return otp;
}

export async function verifyOtp(email: string, otp: string): Promise<void> {
  const otpDoc = await Otp.findOne({ email });

  if (!otpDoc) {
    throw ApiError.badRequest('OTP not found or expired');
  }

  if (otpDoc.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ email });
    throw ApiError.badRequest('Maximum OTP attempts exceeded. Please request a new OTP.');
  }

  otpDoc.attempts += 1;
  await otpDoc.save();

  const isValid = await bcrypt.compare(otp, otpDoc.otpHash);

  if (!isValid) {
    throw ApiError.badRequest(`Invalid OTP. ${MAX_ATTEMPTS - otpDoc.attempts} attempts remaining.`);
  }

  await Otp.deleteOne({ email });
}
