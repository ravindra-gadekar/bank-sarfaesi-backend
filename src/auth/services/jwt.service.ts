import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { ApiError } from '../../common/utils/apiError';

export interface AccessTokenPayload {
  email: string;
  userId?: string;
  branchId?: string;
  role?: string;
  userKind?: 'app' | 'bank';
  officeId?: string;
  officeType?: 'HO' | 'Zonal' | 'Regional' | 'Branch';
  officeAncestors?: string[];
  bankRootId?: string;
}

interface RefreshTokenPayload {
  email: string;
}

interface DecodedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

interface DecodedRefreshToken extends RefreshTokenPayload {
  iat: number;
  exp: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '8h' });
}

export function verifyAccessToken(token: string): DecodedAccessToken {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as DecodedAccessToken;
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): DecodedRefreshToken {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as DecodedRefreshToken;
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }
}

export const jwtService = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
