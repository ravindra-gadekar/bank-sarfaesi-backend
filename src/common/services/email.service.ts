import { MailtrapClient } from 'mailtrap';
import { env } from '../../config/env';

export const emailService = { sendOtpEmail, sendInviteEmail };

function getClient(): MailtrapClient | null {
  if (!env.MAILTRAP_API_TOKEN) return null;

  const isSandbox = env.NODE_ENV !== 'production' && !!env.MAILTRAP_INBOX_ID;

  return new MailtrapClient({
    token: env.MAILTRAP_API_TOKEN,
    ...(isSandbox ? { sandbox: true, testInboxId: env.MAILTRAP_INBOX_ID } : {}),
  });
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  // Always log OTP in dev for convenience
  if (env.NODE_ENV !== 'production') {
    console.log(`[DEV] OTP for ${email}: ${otp}`);
  }

  const client = getClient();
  if (!client) {
    if (env.NODE_ENV === 'production') {
      throw new Error('MAILTRAP_API_TOKEN is not configured');
    }
    return; // dev without token — just log
  }

  const isSandbox = env.NODE_ENV !== 'production' && !!env.MAILTRAP_INBOX_ID;
  const fromEmail = isSandbox ? 'hello@example.com' : 'noreply@bank-sarfaesi.com';

  await client.send({
    from: { email: fromEmail, name: 'Bank SARFAESI' },
    to: [{ email }],
    subject: 'Your login OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Your login OTP</h2>
        <p style="color: #555; font-size: 16px;">Use the following code to complete your login:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a1a1a;">${otp}</span>
        </div>
        <p style="color: #888; font-size: 14px;">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });
}

export async function sendInviteEmail(email: string, token: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const inviteLink = `${frontendUrl}/invite/${token}`;

  if (env.NODE_ENV !== 'production') {
    console.log(`[DEV] Invite link for ${email}: ${inviteLink}`);
  }

  if (env.NODE_ENV === 'test') return;

  const client = getClient();
  if (!client) {
    if (env.NODE_ENV === 'production') {
      throw new Error('MAILTRAP_API_TOKEN is not configured');
    }
    return;
  }

  const isSandbox = env.NODE_ENV !== 'production' && !!env.MAILTRAP_INBOX_ID;
  const fromEmail = isSandbox ? 'hello@example.com' : 'noreply@bank-sarfaesi.com';

  await client.send({
    from: { email: fromEmail, name: 'Bank SARFAESI' },
    to: [{ email }],
    subject: 'You have been invited to Bank SARFAESI',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">You're invited</h2>
        <p style="color: #555; font-size: 16px;">Click the button below to accept your invite and finish setting up your account:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${inviteLink}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Accept invite</a>
        </div>
        <p style="color: #888; font-size: 14px;">Or copy this link: ${inviteLink}</p>
        <p style="color: #888; font-size: 14px;">This invite expires in 72 hours.</p>
      </div>
    `,
  });
}
