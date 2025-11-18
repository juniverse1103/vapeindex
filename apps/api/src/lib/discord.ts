// Discord webhook utilities for notifications

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  message: DiscordMessage
): Promise<void> {
  if (!webhookUrl || webhookUrl.includes('YOUR_WEBHOOK')) {
    console.log('[Discord] Webhook not configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('[Discord] Webhook failed:', await response.text());
    }
  } catch (error) {
    console.error('[Discord] Error sending webhook:', error);
  }
}

// Pre-built notification templates
export const DiscordNotifications = {
  // Revenue notifications
  newSubscription: (username: string, plan: string, amount: number, mrr: number): DiscordMessage => ({
    embeds: [{
      title: '💰 New Subscription!',
      color: 0x00FF00,
      fields: [
        { name: 'User', value: username, inline: true },
        { name: 'Plan', value: plan, inline: true },
        { name: 'Amount', value: `$${(amount / 100).toFixed(2)}/mo`, inline: true },
        { name: 'New MRR', value: `$${(mrr / 100).toFixed(2)}`, inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  }),

  subscriptionCanceled: (username: string, plan: string, mrr: number): DiscordMessage => ({
    embeds: [{
      title: '⚠️ Subscription Canceled',
      color: 0xFFA500,
      fields: [
        { name: 'User', value: username, inline: true },
        { name: 'Plan', value: plan, inline: true },
        { name: 'New MRR', value: `$${(mrr / 100).toFixed(2)}`, inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  }),

  paymentSucceeded: (username: string, amount: number): DiscordMessage => ({
    embeds: [{
      title: '✅ Payment Received',
      color: 0x00FF00,
      fields: [
        { name: 'User', value: username, inline: true },
        { name: 'Amount', value: `$${(amount / 100).toFixed(2)}`, inline: true }
      ],
      footer: { text: 'Funds will be deposited to Mercury in 2-7 days' },
      timestamp: new Date().toISOString()
    }]
  }),

  paymentFailed: (username: string, amount: number, reason: string): DiscordMessage => ({
    embeds: [{
      title: '❌ Payment Failed',
      color: 0xFF0000,
      fields: [
        { name: 'User', value: username, inline: true },
        { name: 'Amount', value: `$${(amount / 100).toFixed(2)}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  }),

  dailyRevenue: (stats: {
    subscriptions: number;
    revenue: number;
    mrr: number;
    newUsers: number;
  }): DiscordMessage => ({
    embeds: [{
      title: '📊 Daily Revenue Report',
      color: 0x0099FF,
      fields: [
        { name: 'New Subscriptions', value: stats.subscriptions.toString(), inline: true },
        { name: 'Revenue Today', value: `$${(stats.revenue / 100).toFixed(2)}`, inline: true },
        { name: 'Current MRR', value: `$${(stats.mrr / 100).toFixed(2)}`, inline: true },
        { name: 'New Users', value: stats.newUsers.toString(), inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  }),

  // Moderation notifications
  contentFlagged: (type: string, author: string, reason: string): DiscordMessage => ({
    embeds: [{
      title: '🚩 Content Flagged',
      color: 0xFFA500,
      fields: [
        { name: 'Type', value: type, inline: true },
        { name: 'Author', value: author, inline: true },
        { name: 'Reason', value: reason, inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  }),

  // Growth notifications
  userMilestone: (count: number): DiscordMessage => ({
    content: `🎉 Milestone reached: **${count.toLocaleString()}** total users!`,
  }),

  viralPost: (title: string, score: number): DiscordMessage => ({
    embeds: [{
      title: '🔥 Viral Post Detected!',
      description: title,
      color: 0xFF6600,
      fields: [
        { name: 'Score', value: score.toString(), inline: true },
        { name: 'Status', value: 'Trending', inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  }),

  // System notifications
  error: (message: string, details?: string): DiscordMessage => ({
    embeds: [{
      title: '🚨 System Error',
      description: message,
      color: 0xFF0000,
      fields: details ? [{ name: 'Details', value: details }] : [],
      timestamp: new Date().toISOString()
    }]
  })
};
