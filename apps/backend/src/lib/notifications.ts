// Notification helpers
import { EmailService } from './email';

const emailService = new EmailService();

export async function createNotification(
  db: D1Database,
  userId: number,
  type: string,
  content: string,
  link: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO notifications (user_id, type, content, link)
    VALUES (?, ?, ?, ?)
  `).bind(userId, type, content, link).run();
}

export async function queueEmail(
  db: D1Database,
  userId: number,
  emailType: string,
  subject: string,
  content: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO email_queue (user_id, email_type, subject, content)
    VALUES (?, ?, ?, ?)
  `).bind(userId, emailType, subject, content).run();
}

export async function notifyCommentReply(
  db: D1Database,
  parentCommentId: number,
  replyAuthor: string,
  postId: number,
  commentId: number
): Promise<void> {
  // Get parent comment author
  const parentComment = await db.prepare(`
    SELECT c.author_id, u.username, u.email, u.email_notifications
    FROM comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.id = ?
  `).bind(parentCommentId).first() as any;

  if (!parentComment || !parentComment.author_id) return;

  // Create notification
  const content = `${replyAuthor} replied to your comment`;
  const link = `/post/${postId}#comment-${commentId}`;

  await createNotification(
    db,
    parentComment.author_id,
    'comment_reply',
    content,
    link
  );

  // Queue email if user has email notifications enabled
  if (parentComment.email_notifications) {
    const subject = `New reply from ${replyAuthor}`;
    const emailContent = `
      <h2>New Reply to Your Comment</h2>
      <p><strong>${replyAuthor}</strong> replied to your comment on VapeIndex.</p>
      <p><a href="https://vapeindex.io${link}" style="display: inline-block; padding: 10px 20px; background: #7C3AED; color: white; text-decoration: none; border-radius: 4px;">View Reply</a></p>
    `;

    await queueEmail(db, parentComment.author_id, 'comment_reply', subject, emailContent);
  }
}

export async function notifyPostComment(
  db: D1Database,
  postId: number,
  commentAuthor: string,
  commentId: number
): Promise<void> {
  // Get post author
  const post = await db.prepare(`
    SELECT p.author_id, u.username, u.email, u.email_notifications
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `).bind(postId).first() as any;

  if (!post || !post.author_id) return;

  // Create notification
  const content = `${commentAuthor} commented on your post`;
  const link = `/post/${postId}#comment-${commentId}`;

  await createNotification(
    db,
    post.author_id,
    'post_reply',
    content,
    link
  );

  // Queue email if user has email notifications enabled
  if (post.email_notifications) {
    const subject = `New comment from ${commentAuthor}`;
    const emailContent = `
      <h2>New Comment on Your Post</h2>
      <p><strong>${commentAuthor}</strong> commented on your post on VapeIndex.</p>
      <p><a href="https://vapeindex.io${link}" style="display: inline-block; padding: 10px 20px; background: #7C3AED; color: white; text-decoration: none; border-radius: 4px;">View Comment</a></p>
    `;

    await queueEmail(db, post.author_id, 'post_reply', subject, emailContent);
  }
}
