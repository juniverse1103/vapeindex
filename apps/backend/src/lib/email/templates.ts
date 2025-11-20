// Email templates - easily extensible for new email types

import type { VerificationEmailData, PasswordResetEmailData, NotificationEmailData } from './types';

export const emailTemplates = {
  verification: (data: VerificationEmailData) => ({
    subject: 'Verify your VapeIndex account',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Welcome to VapeIndex!</h1>
            <p>Hi ${data.username},</p>
            <p>Thanks for signing up! Please verify your email address to start participating in the community.</p>
            <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${data.verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <div class="footer">
              <p>If you didn't create this account, you can safely ignore this email.</p>
              <p>VapeIndex - The Vaping Community</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to VapeIndex!

Hi ${data.username},

Thanks for signing up! Please verify your email address to start participating in the community.

Verify your email: ${data.verificationUrl}

This link will expire in 24 hours.

If you didn't create this account, you can safely ignore this email.

VapeIndex - The Vaping Community
    `,
  }),

  passwordReset: (data: PasswordResetEmailData) => ({
    subject: 'Reset your VapeIndex password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Reset your password</h1>
            <p>Hi ${data.username},</p>
            <p>We received a request to reset your password. Click the button below to choose a new password:</p>
            <a href="${data.resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${data.resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <div class="footer">
              <p>If you didn't request a password reset, you can safely ignore this email.</p>
              <p>VapeIndex - The Vaping Community</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Reset your password

Hi ${data.username},

We received a request to reset your password. Click the link below to choose a new password:

${data.resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

VapeIndex - The Vaping Community
    `,
  }),

  notification: (data: NotificationEmailData) => ({
    subject: 'New notification from VapeIndex',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>VapeIndex Notification</h1>
            <p>Hi ${data.username},</p>
            <p>${data.message}</p>
            ${data.actionUrl ? `<a href="${data.actionUrl}" class="button">View</a>` : ''}
            <div class="footer">
              <p>You can manage your email preferences in your account settings.</p>
              <p>VapeIndex - The Vaping Community</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
VapeIndex Notification

Hi ${data.username},

${data.message}

${data.actionUrl ? `View: ${data.actionUrl}` : ''}

You can manage your email preferences in your account settings.

VapeIndex - The Vaping Community
    `,
  }),
};
