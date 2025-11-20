// Email service - orchestrates email sending with pluggable providers

import { MailChannelsProvider } from './providers/mailchannels';
// import { ResendProvider } from './providers/resend'; // For future use
import { emailTemplates } from './templates';
import type { EmailProvider, EmailOptions, EmailType, VerificationEmailData, PasswordResetEmailData, NotificationEmailData } from './types';

export class EmailService {
  private provider: EmailProvider;
  private fromEmail: string;
  private fromName: string;

  constructor(config: {
    provider?: EmailProvider;
    fromEmail?: string;
    fromName?: string;
  } = {}) {
    // Default to MailChannels, but easily swappable
    this.provider = config.provider || new MailChannelsProvider();
    this.fromEmail = config.fromEmail || 'noreply@vapeindex.io';
    this.fromName = config.fromName || 'VapeIndex';
  }

  // Switch provider at runtime if needed (e.g., A/B testing, failover)
  setProvider(provider: EmailProvider) {
    this.provider = provider;
  }

  async sendRaw(options: EmailOptions, type?: EmailType) {
    return this.provider.send(options, type);
  }

  async sendVerificationEmail(to: string, username: string, token: string, baseUrl: string) {
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    const template = emailTemplates.verification({ username, verificationUrl });

    return this.provider.send({
      to: { email: to },
      from: { email: this.fromEmail, name: this.fromName },
      subject: template.subject,
      html: template.html,
      text: template.text,
    }, 'transactional' as EmailType);
  }

  async sendPasswordResetEmail(to: string, username: string, token: string, baseUrl: string) {
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const template = emailTemplates.passwordReset({ username, resetUrl });

    return this.provider.send({
      to: { email: to },
      from: { email: this.fromEmail, name: this.fromName },
      subject: template.subject,
      html: template.html,
      text: template.text,
    }, 'transactional' as EmailType);
  }

  async sendNotification(to: string, username: string, message: string, actionUrl?: string) {
    const template = emailTemplates.notification({ username, message, actionUrl });

    return this.provider.send({
      to: { email: to },
      from: { email: this.fromEmail, name: this.fromName },
      subject: template.subject,
      html: template.html,
      text: template.text,
    }, 'notification' as EmailType);
  }
}

// Export types and templates for extensibility
export * from './types';
export { emailTemplates };
