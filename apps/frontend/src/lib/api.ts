// API client for VapeIndex backend

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:51728';

export async function fetchPosts(sort: 'hot' | 'new' | 'top' | 'rising' = 'hot', limit = 20) {
  const response = await fetch(`${API_URL}/api/posts?sort=${sort}&limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch posts');
  return response.json();
}

export async function fetchPost(id: string) {
  const response = await fetch(`${API_URL}/api/posts/${id}`);
  if (!response.ok) throw new Error('Failed to fetch post');
  return response.json();
}

export async function fetchBoards() {
  const response = await fetch(`${API_URL}/api/boards`);
  if (!response.ok) throw new Error('Failed to fetch boards');
  return response.json();
}

export async function fetchStats() {
  const response = await fetch(`${API_URL}/api/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}
