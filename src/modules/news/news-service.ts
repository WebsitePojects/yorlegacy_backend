// Admin-authored news / announcements surfaced on the public site bulletin.
import { getSupabaseClient } from '../../lib/supabase.js';

export type NewsCategory = 'announcement' | 'news' | 'promo' | 'memo';
export type NewsStatus = 'draft' | 'published' | 'archived';

export type NewsPost = {
  id: string;
  title: string;
  body: string;
  category: NewsCategory;
  status: NewsStatus;
  pinned: boolean;
  createdByLabel: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: Record<string, unknown>): NewsPost {
  return {
    id: String(row['id'] ?? ''),
    title: String(row['title'] ?? ''),
    body: String(row['body'] ?? ''),
    category: String(row['category'] ?? 'announcement') as NewsCategory,
    status: String(row['status'] ?? 'draft') as NewsStatus,
    pinned: Boolean(row['pinned']),
    createdByLabel: row['created_by_label'] ? String(row['created_by_label']) : null,
    publishedAt: row['published_at'] ? String(row['published_at']) : null,
    createdAt: String(row['created_at'] ?? new Date().toISOString()),
    updatedAt: String(row['updated_at'] ?? new Date().toISOString())
  };
}

// In-memory fallback for dev/sandbox (no Supabase configured).
const sandboxPosts: NewsPost[] = [];

export const newsService = {
  async listAll(): Promise<NewsPost[]> {
    const client = getSupabaseClient();
    if (!client) return [...sandboxPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const { data, error } = await client.from('news_posts').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false });
    if (error) { console.error('[news] listAll error:', error.message); return []; }
    return (data ?? []).map(mapRow);
  },

  async listPublished(): Promise<NewsPost[]> {
    const client = getSupabaseClient();
    if (!client) return sandboxPosts.filter((p) => p.status === 'published');
    const { data, error } = await client
      .from('news_posts')
      .select('*')
      .eq('status', 'published')
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(50);
    if (error) { console.error('[news] listPublished error:', error.message); return []; }
    return (data ?? []).map(mapRow);
  },

  async create(input: { title: string; body: string; category: NewsCategory; status: NewsStatus; pinned: boolean; createdByUserId: string | null; createdByLabel: string | null }): Promise<NewsPost> {
    const publishedAt = input.status === 'published' ? new Date().toISOString() : null;
    const client = getSupabaseClient();
    if (!client) {
      const post: NewsPost = {
        id: `post-${Date.now()}`, title: input.title, body: input.body, category: input.category,
        status: input.status, pinned: input.pinned, createdByLabel: input.createdByLabel,
        publishedAt, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      sandboxPosts.unshift(post);
      return post;
    }
    const { data, error } = await client.from('news_posts').insert({
      title: input.title, body: input.body, category: input.category, status: input.status,
      pinned: input.pinned, created_by_user_id: input.createdByUserId, created_by_label: input.createdByLabel,
      published_at: publishedAt
    }).select().single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },

  async update(id: string, patch: Partial<{ title: string; body: string; category: NewsCategory; status: NewsStatus; pinned: boolean }>): Promise<NewsPost> {
    const client = getSupabaseClient();
    const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) fields.title = patch.title;
    if (patch.body !== undefined) fields.body = patch.body;
    if (patch.category !== undefined) fields.category = patch.category;
    if (patch.pinned !== undefined) fields.pinned = patch.pinned;
    if (patch.status !== undefined) {
      fields.status = patch.status;
      // Stamp published_at the first time it goes live.
      if (patch.status === 'published') fields.published_at = new Date().toISOString();
    }
    if (!client) {
      const post = sandboxPosts.find((p) => p.id === id);
      if (!post) throw new Error('Post not found.');
      Object.assign(post, patch, { updatedAt: new Date().toISOString() });
      if (patch.status === 'published' && !post.publishedAt) post.publishedAt = new Date().toISOString();
      return post;
    }
    const { data, error } = await client.from('news_posts').update(fields).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },

  async remove(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
      const idx = sandboxPosts.findIndex((p) => p.id === id);
      if (idx >= 0) sandboxPosts.splice(idx, 1);
      return;
    }
    const { error } = await client.from('news_posts').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
};
