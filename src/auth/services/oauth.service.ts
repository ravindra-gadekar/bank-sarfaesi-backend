import crypto from 'crypto';
import { env } from '../../config/env';

interface OAuthUserInfo {
  email: string;
  name: string;
  provider: 'google' | 'microsoft';
}

function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

const oauthService = {
  // --- Google ---

  getGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || '',
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeGoogleCode(code: string): Promise<OAuthUserInfo> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID || '',
        client_secret: env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${err}`);
    }

    const tokens = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) throw new Error('Failed to fetch Google user info');

    const profile = (await userRes.json()) as { email: string; name?: string };
    return {
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email.split('@')[0],
      provider: 'google',
    };
  },

  // --- Microsoft ---

  getMicrosoftAuthUrl(state: string): string {
    const tenant = env.MICROSOFT_TENANT_ID;
    const params = new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID || '',
      redirect_uri: env.MICROSOFT_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile User.Read',
      state,
      response_mode: 'query',
      prompt: 'select_account',
    });
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  },

  async exchangeMicrosoftCode(code: string): Promise<OAuthUserInfo> {
    const tenant = env.MICROSOFT_TENANT_ID;
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.MICROSOFT_CLIENT_ID || '',
          client_secret: env.MICROSOFT_CLIENT_SECRET || '',
          redirect_uri: env.MICROSOFT_CALLBACK_URL,
          grant_type: 'authorization_code',
          scope: 'openid email profile User.Read',
        }),
      },
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Microsoft token exchange failed: ${err}`);
    }

    const tokens = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) throw new Error('Failed to fetch Microsoft user info');

    const profile = (await userRes.json()) as {
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
    };

    const email = (profile.mail || profile.userPrincipalName || '').toLowerCase();
    if (!email) throw new Error('No email found in Microsoft profile');

    return {
      email,
      name: profile.displayName || email.split('@')[0],
      provider: 'microsoft',
    };
  },

  generateState,
};

export { oauthService };
export type { OAuthUserInfo };
