// Database types for VapeIndex.io

export interface User {
  id: string; // Discord user ID
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  karma: number;
  joined_at: number;
  last_seen: number;
  is_moderator: boolean;
  is_banned: boolean;
  referral_code: string | null;
  referred_by: string | null;
}

export interface Strain {
  id: string;
  name: string;
  slug: string;
  type: 'indica' | 'sativa' | 'hybrid';
  description: string | null;
  effects: string; // JSON array
  flavors: string; // JSON array
  thc_range: string | null;
  cbd_range: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  edit_count: number;
  view_count: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  type: 'cart' | 'battery' | 'disposable';
  brand: string;
  strain_id: string | null;
  thc_percentage: number | null;
  cbd_percentage: number | null;
  size_ml: number | null;
  battery_mah: number | null;
  description: string | null;
  image_url: string | null;
  avg_rating: number;
  review_count: number;
  created_by: string;
  created_at: number;
  updated_at: number;
  view_count: number;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number; // 1-5
  title: string | null;
  content: string | null;
  pros: string; // JSON array
  cons: string; // JSON array
  verified_purchase: boolean;
  helpful_count: number;
  created_at: number;
  updated_at: number;
}

export interface Post {
  id: string;
  title: string;
  url: string | null;
  content: string | null;
  author_id: string;
  post_type: 'link' | 'text' | 'ask' | 'show';
  score: number;
  comment_count: number;
  created_at: number;
  updated_at: number;
  trending_score: number;
  is_pinned: boolean;
  is_locked: boolean;
  is_deleted: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  score: number;
  depth: number;
  path: string;
  created_at: number;
  updated_at: number;
  is_deleted: boolean;
}

export interface Vote {
  id: string;
  user_id: string;
  target_type: 'post' | 'comment' | 'review';
  target_id: string;
  vote_type: -1 | 1; // -1 = downvote, 1 = upvote
  created_at: number;
}

export interface DispensaryPrice {
  id: string;
  product_id: string;
  dispensary_name: string;
  dispensary_location: string | null;
  price_usd: number;
  available: boolean;
  last_updated: number;
}

export interface ModerationFlag {
  id: string;
  target_type: 'post' | 'comment' | 'review' | 'user';
  target_id: string;
  reporter_id: string;
  reason: 'spam' | 'harassment' | 'misinformation' | 'illegal' | 'other';
  description: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: number;
  resolved_at: number | null;
  resolved_by: string | null;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  created_at: number;
  reward_given: boolean;
}

// Helper types for API responses
export interface PostWithAuthor extends Post {
  author: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url' | 'karma'>;
}

export interface CommentWithAuthor extends Comment {
  author: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url' | 'karma'>;
  replies?: CommentWithAuthor[];
}

export interface ProductWithStrain extends Product {
  strain?: Strain | null;
}

export interface ReviewWithUser extends ProductReview {
  user: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url' | 'karma'>;
}
