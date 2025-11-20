// Resend email provider (for future use)
// Uncomment and configure when ready to add Resend support

import type { EmailProvider, EmailOptions, EmailResult, EmailType } from '../types';

export class ResendProvider implements EmailProvider {
  name = 'Resend';
  private apiKey: string;
  private apiUrl = 'https://api.resend.com/emails';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(options: EmailOptions, type: EmailType = 'transactional' as EmailType): Promise<EmailResult> {
    try {
      const { to, from, subject, html, text, replyTo } = options;

      // Ensure to is an array
      const recipients = Array.isArray(to) ? to : [to];

      const payload = {
        from: `${from.name || 'VapeIndex'} <${from.email}>`,
        to: recipients.map(r => r.name ? `${r.name} <${r.email}>` : r.email),
        subject,
        html,
        ...(text && { text }),
        ...(replyTo && { reply_to: `${replyTo.name || ''} <${replyTo.email}>` }),
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Resend error:', error);
        return {
          success: false,
          error: `Resend API error: ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      console.error('Resend send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
