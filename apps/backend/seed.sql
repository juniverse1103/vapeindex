-- Seed Data for VapeIndex

-- Insert Boards
INSERT INTO boards (slug, name, description, color) VALUES
  ('disposables', 'Disposables', 'Elf Bar, Puff Bar, and all disposable vapes', '#3B82F6'),
  ('pods', 'Pod Systems', 'Refillable pods, salt nic devices', '#8B5CF6'),
  ('dryherb', 'Dry Herb', 'Pax, Mighty, and dry herb vaporizers', '#10B981'),
  ('mods', 'Mods & Tanks', 'Box mods, sub-ohm tanks, coil builds', '#F59E0B'),
  ('deals', 'Deals', 'Sales, coupons, and price drops', '#EF4444'),
  ('reviews', 'Reviews', 'In-depth product reviews', '#EC4899'),
  ('diy', 'DIY', 'Coil building, mixing e-liquid', '#6366F1'),
  ('beginner', 'Beginner', 'New to vaping? Start here', '#14B8A6'),
  ('discussion', 'Discussion', 'General vaping discussion', '#6366F1');

-- Insert Sample Users
INSERT INTO users (username, email, karma) VALUES
  ('vapeenthusiast', 'vape@example.com', 2847),
  ('authentic_only', 'authentic@example.com', 5234),
  ('herb_connoisseur', 'herb@example.com', 3456),
  ('pod_master', 'pod@example.com', 1456),
  ('deal_hunter', 'deals@example.com', 8901),
  ('nic_expert', 'nic@example.com', 12456),
  ('safety_first', 'safety@example.com', 15234),
  ('flavor_king', 'flavor@example.com', 1823),
  ('smok_fan', 'smok@example.com', 456),
  ('setup_share', 'setup@example.com', 2134),
  ('coil_builder', 'coil@example.com', 987),
  ('newbie2025', 'newbie@example.com', 12),
  ('price_watcher', 'price@example.com', 6734),
  ('reviewer_pro', 'reviewer@example.com', 9234),
  ('success_story', 'success@example.com', 12453);

-- Insert Sample Posts
INSERT INTO posts (title, url, content, board_id, author_id, score, comment_count, view_count) VALUES
  ('Best disposable vapes of 2025? Looking for recommendations', NULL, 'I''m looking for reliable disposable vapes with good flavor. What are your top picks?', 1, 1, 287, 94, 1847),
  ('PSA: Fake Elf Bars flooding the market - How to spot them', NULL, 'Warning: there''s been a huge influx of counterfeit Elf Bars. Here''s how to identify real vs fake...', 1, 2, 512, 143, 4234),
  ('Pax 3 vs Mighty+ - Full comparison with photos', NULL, 'After 3 months with both devices, here''s my detailed comparison...', 3, 3, 164, 121, 1923),
  ('Caliburn G2 pods leaking after 2 days - any solutions?', NULL, 'My pods keep leaking. Anyone else having this issue?', 2, 4, 89, 45, 1247),
  ('VaporDNA 30% off sale - today only! Code: VAPE30', 'https://vapordna.com', NULL, 5, 5, 456, 87, 5632),
  ('Freebase vs salt nicotine - comprehensive beginner guide', NULL, 'Everything you need to know about nicotine types...', 6, 6, 203, 32, 3421),
  ('Battery safety - what EVERY vaper needs to know', NULL, 'Critical information about battery safety to prevent accidents...', 4, 7, 392, 156, 6234),
  ('New Elf Bar BC5000 flavors just dropped - tried them all', NULL, 'Review of all 8 new flavors released this week...', 1, 8, 178, 56, 2145),
  ('Smok RPM4 - is it worth upgrading from RPM3?', NULL, 'Thinking about upgrading. What''s your experience?', 2, 9, 67, 28, 987),
  ('Share your current vape setup! [Photos]', NULL, 'Post photos of your desk/vape station!', 9, 10, 234, 89, 3156),
  ('Built my first triple-core fused clapton coils! Tips?', NULL, 'First attempt at advanced coil building. How did I do?', 7, 11, 145, 67, 1456),
  ('Complete beginner - what device should I buy?', NULL, 'New to vaping, coming from cigarettes. Budget is $50. Help!', 8, 12, 98, 73, 1892),
  ('I quit smoking 5 years ago thanks to vaping - AMA', NULL, 'Former pack-a-day smoker. Vaping changed my life. Ask me anything!', 9, 15, 3421, 892, 145234);

-- Update board stats
INSERT INTO board_stats (board_id, post_count, member_count)
SELECT
  b.id,
  (SELECT COUNT(*) FROM posts WHERE board_id = b.id),
  CAST(RANDOM() * 20000 + 5000 AS INTEGER)
FROM boards b;
