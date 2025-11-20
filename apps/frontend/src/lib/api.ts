// API client for VapeIndex backend

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:51728';

export async function fetchPosts(sort: 'hot' | 'new' | 'top' | 'rising' = 'hot', limit = 20) {
  try {
    const response = await fetch(`${API_URL}/api/posts?sort=${sort}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch posts');
    return response.json();
  } catch (error) {
    // Fallback to empty array during build if API is unavailable
    console.warn('API unavailable during build, using fallback data');
    return [];
  }
}

export async function fetchPost(id: string) {
  try {
    const response = await fetch(`${API_URL}/api/posts/${id}`);
    if (!response.ok) throw new Error('Failed to fetch post');
    return response.json();
  } catch (error) {
    console.warn('API unavailable during build, using fallback data');
    return null;
  }
}

export async function fetchBoards() {
  try {
    const response = await fetch(`${API_URL}/api/boards`);
    if (!response.ok) throw new Error('Failed to fetch boards');
    return response.json();
  } catch (error) {
    console.warn('API unavailable during build, using fallback data');
    return [];
  }
}

export async function fetchStats() {
  try {
    const response = await fetch(`${API_URL}/api/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  } catch (error) {
    console.warn('API unavailable during build, using fallback data');
    return { totalPosts: 0, totalMembers: 0, activeNow: 0, boardsCount: 0 };
  }
}
