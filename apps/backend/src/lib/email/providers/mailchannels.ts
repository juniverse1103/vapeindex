// MailChannels email provider implementation

import type { EmailProvider, EmailOptions, EmailResult, EmailType } from '../types';

export class MailChannelsProvider implements EmailProvider {
  name = 'MailChannels';
  private apiUrl = 'https://api.mailchannels.net/tx/v1/send';

  async send(options: EmailOptions, type: EmailType = 'transactional' as EmailType): Promise<EmailResult> {
    try {
      const { to, from, subject, html, text, replyTo } = options;

      // Ensure to is an array
      const recipients = Array.isArray(to) ? to : [to];

      const payload = {
        personalizations: [
          {
            to: recipients.map(r => ({ email: r.email, name: r.name })),
          }
        ],
        from: {
          email: from.email,
          name: from.name || 'VapeIndex',
        },
        subject,
        content: [
          {
            type: 'text/html',
            value: html,
          },
          ...(text ? [{
            type: 'text/plain',
            value: text,
          }] : []),
        ],
        ...(replyTo && {
          reply_to: {
            email: replyTo.email,
            name: replyTo.name,
          }
        }),
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('MailChannels error:', error);
        return {
          success: false,
          error: `MailChannels API error: ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: response.headers.get('x-message-id') || undefined,
      };
    } catch (error) {
      console.error('MailChannels send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
