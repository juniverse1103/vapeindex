# MailChannels DNS Configuration for VapeIndex

## Overview
This guide will help you configure DNS records for MailChannels email delivery. This is required for email verification, password reset, and future notification features.

## Prerequisites
- Domain: `vapeindex.io` (already on Cloudflare)
- Cloudflare account with DNS management access

## DNS Records to Add

### 1. SPF Record (Required)
Authorizes MailChannels to send emails from your domain.

**Record Type:** TXT
**Name:** `@` (or `vapeindex.io`)
**Content:** `v=spf1 include:relay.mailchannels.net ~all`
**TTL:** Auto (or 3600)

### 2. DKIM Record (Required)
Authenticates emails sent from your domain.

**Record Type:** TXT
**Name:** `mailchannels._domainkey`
**Content:** Request from MailChannels (see step 3) or use generic key
**TTL:** Auto (or 3600)

**Temporary Generic DKIM:** (for testing)
```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6IFVJ6qEsR6OjfQ4rqgLLn+K7EqBUx6DPXZeM3PiUqZ0cALyAT8pjZqDnmDTXIEMeAR0VRbhqFJV3+E5s4fNJsKxQKJ9+p0CvqN1FpCNJk1OhKj5+E3a8WZFb7IvqCCH3L4+p+Fj7nGEhPJmGN8RvqLQ9sV7vvJMpHCGqKQIDAQAB
```

### 3. DMARC Record (Recommended)
Email policy and reporting.

**Record Type:** TXT
**Name:** `_dmarc`
**Content:** `v=DMARC1; p=none; rua=mailto:dmarc@vapeindex.io`
**TTL:** Auto (or 3600)

## Setup Instructions

### Option 1: Cloudflare Dashboard (Easiest)

1. Go to https://dash.cloudflare.com
2. Select your `vapeindex.io` domain
3. Navigate to **DNS** → **Records**
4. Click **Add record** for each DNS record above
5. Fill in the Type, Name, and Content fields
6. Click **Save**
7. Wait 5-15 minutes for DNS propagation

### Option 2: Cloudflare API (CLI)

```bash
# Get your zone ID
ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=vapeindex.io" \
  -H "Authorization: Bearer YOUR_API_TOKEN" | jq -r '.result[0].id')

# Add SPF record
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"TXT","name":"@","content":"v=spf1 include:relay.mailchannels.net ~all"}'

# Add DKIM record
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"TXT","name":"mailchannels._domainkey","content":"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6IFVJ6qEsR6OjfQ4rqgLLn+K7EqBUx6DPXZeM3PiUqZ0cALyAT8pjZqDnmDTXIEMeAR0VRbhqFJV3+E5s4fNJsKxQKJ9+p0CvqN1FpCNJk1OhKj5+E3a8WZFb7IvqCCH3L4+p+Fj7nGEhPJmGN8RvqLQ9sV7vvJMpHCGqKQIDAQAB"}'

# Add DMARC record
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"TXT","name":"_dmarc","content":"v=DMARC1; p=none; rua=mailto:dmarc@vapeindex.io"}'
```

## Verification

### Check DNS Records
```bash
# Check SPF
dig TXT vapeindex.io +short

# Check DKIM
dig TXT mailchannels._domainkey.vapeindex.io +short

# Check DMARC
dig TXT _dmarc.vapeindex.io +short
```

### Test Email Sending
1. Go to https://vapeindex.io/register
2. Register a new account with a real email
3. Check if verification email arrives
4. Check spam folder if not in inbox

## Troubleshooting

### Emails not arriving
- Wait 15-30 minutes for DNS propagation
- Check spam/junk folder
- Verify DNS records with `dig` commands above
- Check Cloudflare Workers logs: `npx wrangler tail vapeindex-backend-prod --env production`

### DNS Propagation Issues
- Use https://dnschecker.org to check global propagation
- TTL affects propagation time (lower = faster updates)
- Cloudflare's orange cloud (proxied) doesn't affect TXT records

### Email Deliverability
- SPF: Required for delivery
- DKIM: Improves deliverability and prevents spoofing
- DMARC: Provides reporting and policy enforcement
- Start with `p=none` for DMARC, monitor reports, then move to `p=quarantine` or `p=reject`

## Email Limits

**MailChannels Free Tier (via Workers):**
- 10,000 emails per day
- Sufficient for community of thousands of users
- Transactional emails only (verification, notifications, password reset)

## Future Enhancements

When you need more email features:

1. **Custom DKIM Key:** Request from MailChannels for better deliverability
2. **Newsletter Service:** Use Resend/Loops.so for marketing emails
3. **Email Analytics:** Track open rates, click rates
4. **Email Templates:** Design branded email templates
5. **Unsubscribe Management:** Add preference center

## Support

- **MailChannels Docs:** https://mailchannels.zendesk.com/hc/en-us
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **DNS Issues:** Check Cloudflare Community or support

---

**Status:** DNS configuration required before email features work.
**Next:** Add DNS records → Wait for propagation → Test registration
