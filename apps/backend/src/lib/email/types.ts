// Email service types - extensible for multiple providers

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailOptions {
  to: EmailAddress | EmailAddress[];
  from: EmailAddress;
  subject: string;
  html: string;
  text?: string;
  replyTo?: EmailAddress;
}

export enum EmailType {
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
  NOTIFICATION = 'notification',
}

export interface EmailProvider {
  name: string;
  send(options: EmailOptions, type?: EmailType): Promise<EmailResult>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Email template data types
export interface VerificationEmailData {
  username: string;
  verificationUrl: string;
}

export interface PasswordResetEmailData {
  username: string;
  resetUrl: string;
}

export interface NotificationEmailData {
  username: string;
  message: string;
  actionUrl?: string;
}
