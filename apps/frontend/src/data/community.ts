// Shared community data for all pages
export const boards = [
  { name: 'Disposables', slug: 'disposables', posts: 2847, members: 15234, description: 'Elf Bar, Puff Bar, and all disposable vapes', color: '#3B82F6' },
  { name: 'Pod Systems', slug: 'pods', posts: 1923, members: 8901, description: 'Refillable pods, salt nic devices', color: '#8B5CF6' },
  { name: 'Dry Herb', slug: 'dryherb', posts: 1456, members: 12456, description: 'Pax, Mighty, and dry herb vaporizers', color: '#10B981' },
  { name: 'Mods & Tanks', slug: 'mods', posts: 3201, members: 19234, description: 'Box mods, sub-ohm tanks, coil builds', color: '#F59E0B' },
  { name: 'Deals', slug: 'deals', posts: 892, members: 23456, description: 'Sales, coupons, and price drops', color: '#EF4444' },
  { name: 'Reviews', slug: 'reviews', posts: 2156, members: 11234, description: 'In-depth product reviews', color: '#EC4899' },
  { name: 'DIY', slug: 'diy', posts: 1534, members: 6789, description: 'Coil building, mixing e-liquid', color: '#6366F1' },
  { name: 'Beginner', slug: 'beginner', posts: 2789, members: 18902, description: 'New to vaping? Start here', color: '#14B8A6' },
];

export const stats = {
  totalPosts: 16293,
  totalMembers: 115406,
  activeNow: 1834,
  boardsCount: boards.length
};

export const trendingBoards = boards.slice(0, 4);
