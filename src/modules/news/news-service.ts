// Admin-authored news / announcements surfaced on the public site bulletin.
import { getSupabaseClient } from '../../lib/supabase.js';

export type NewsCategory = 'announcement' | 'news' | 'promo' | 'memo';
export type NewsStatus = 'draft' | 'published' | 'archived';
export type NewsAttachmentKind = 'image' | 'video' | 'document';
export type NewsAttachment = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  kind: NewsAttachmentKind;
};

export type NewsPost = {
  id: string;
  title: string;
  body: string;
  category: NewsCategory;
  status: NewsStatus;
  pinned: boolean;
  attachments: NewsAttachment[];
  createdByLabel: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'application/msword',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm'
]);

const MAX_ATTACHMENTS = 3;
const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const runtimeAttachmentStore = new Map<string, NewsAttachment[]>();

function resolveAttachmentKind(mimeType: string): NewsAttachmentKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

export function normalizeNewsAttachments(value: unknown): NewsAttachment[] {
  if (!Array.isArray(value)) return [];

  const attachments = value.slice(0, MAX_ATTACHMENTS).map((entry) => {
    const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const mimeType = typeof record.mimeType === 'string' ? record.mimeType.trim() : '';
    const sizeBytes = typeof record.sizeBytes === 'number' ? record.sizeBytes : Number(record.sizeBytes ?? 0);
    const dataUrl = typeof record.dataUrl === 'string' ? record.dataUrl.trim() : '';
    const kind = resolveAttachmentKind(mimeType);

    if (!name || !mimeType || !dataUrl || !ALLOWED_ATTACHMENT_TYPES.has(mimeType)) {
      throw new Error('One or more attachments use an unsupported file type.');
    }

    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      throw new Error('One or more attachments have an invalid file size.');
    }

    if (!dataUrl.startsWith(`data:${mimeType};base64,`)) {
      throw new Error('One or more attachments could not be processed.');
    }

    return { name, mimeType, sizeBytes, dataUrl, kind };
  });

  const totalBytes = attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new Error('Attachments are too large. Keep the total upload under 10 MB.');
  }

  return attachments;
}

function mapRow(row: Record<string, unknown>): NewsPost {
  const id = String(row['id'] ?? '');
  return {
    id,
    title: String(row['title'] ?? ''),
    body: String(row['body'] ?? ''),
    category: String(row['category'] ?? 'announcement') as NewsCategory,
    status: String(row['status'] ?? 'draft') as NewsStatus,
    pinned: Boolean(row['pinned']),
    attachments: runtimeAttachmentStore.get(id) ?? normalizeNewsAttachments(row['attachments']),
    createdByLabel: row['created_by_label'] ? String(row['created_by_label']) : null,
    publishedAt: row['published_at'] ? String(row['published_at']) : null,
    createdAt: String(row['created_at'] ?? new Date().toISOString()),
    updatedAt: String(row['updated_at'] ?? new Date().toISOString())
  };
}

const sandboxPosts: NewsPost[] = [];

function isMissingAttachmentsColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('attachments') && normalized.includes('news_posts');
}

export const newsService = {
  normalizeAttachments: normalizeNewsAttachments,

  async listAll(): Promise<NewsPost[]> {
    const client = getSupabaseClient();
    if (!client) return [...sandboxPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const { data, error } = await client
      .from('news_posts')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[news] listAll error:', error.message);
      return [];
    }
    return (data ?? []).map(mapRow);
  },

  async listPublished(): Promise<NewsPost[]> {
    const client = getSupabaseClient();
    if (!client) return sandboxPosts.filter((post) => post.status === 'published');
    const { data, error } = await client
      .from('news_posts')
      .select('*')
      .eq('status', 'published')
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[news] listPublished error:', error.message);
      return [];
    }
    return (data ?? []).map(mapRow);
  },

  async create(input: {
    title: string;
    body: string;
    category: NewsCategory;
    status: NewsStatus;
    pinned: boolean;
    attachments: NewsAttachment[];
    createdByUserId: string | null;
    createdByLabel: string | null;
  }): Promise<NewsPost> {
    const publishedAt = input.status === 'published' ? new Date().toISOString() : null;
    const client = getSupabaseClient();

    if (!client) {
      const post: NewsPost = {
        id: `post-${Date.now()}`,
        title: input.title,
        body: input.body,
        category: input.category,
        status: input.status,
        pinned: input.pinned,
        attachments: input.attachments,
        createdByLabel: input.createdByLabel,
        publishedAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      sandboxPosts.unshift(post);
      return post;
    }

    const { data, error } = await client
      .from('news_posts')
      .insert({
        title: input.title,
        body: input.body,
        category: input.category,
        status: input.status,
        pinned: input.pinned,
        attachments: input.attachments,
        created_by_user_id: input.createdByUserId,
        created_by_label: input.createdByLabel,
        published_at: publishedAt
      })
      .select()
      .single();
    if (error) {
      if (!isMissingAttachmentsColumnError(error.message)) {
        throw new Error(error.message);
      }

      const fallback = await client
        .from('news_posts')
        .insert({
          title: input.title,
          body: input.body,
          category: input.category,
          status: input.status,
          pinned: input.pinned,
          created_by_user_id: input.createdByUserId,
          created_by_label: input.createdByLabel,
          published_at: publishedAt
        })
        .select()
        .single();
      if (fallback.error) throw new Error(fallback.error.message);
      const post = mapRow(fallback.data);
      runtimeAttachmentStore.set(post.id, input.attachments);
      return { ...post, attachments: input.attachments };
    }
    return mapRow(data);
  },

  async update(
    id: string,
    patch: Partial<{
      title: string;
      body: string;
      category: NewsCategory;
      status: NewsStatus;
      pinned: boolean;
      attachments: NewsAttachment[];
    }>
  ): Promise<NewsPost> {
    const client = getSupabaseClient();
    const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (patch.title !== undefined) fields.title = patch.title;
    if (patch.body !== undefined) fields.body = patch.body;
    if (patch.category !== undefined) fields.category = patch.category;
    if (patch.pinned !== undefined) fields.pinned = patch.pinned;
    if (patch.attachments !== undefined) fields.attachments = patch.attachments;
    if (patch.status !== undefined) {
      fields.status = patch.status;
      if (patch.status === 'published') fields.published_at = new Date().toISOString();
    }

    if (!client) {
      const post = sandboxPosts.find((entry) => entry.id === id);
      if (!post) throw new Error('Post not found.');
      Object.assign(post, patch, { updatedAt: new Date().toISOString() });
      if (patch.status === 'published' && !post.publishedAt) post.publishedAt = new Date().toISOString();
      return post;
    }

    const { data, error } = await client.from('news_posts').update(fields).eq('id', id).select().single();
    if (error) {
      if (!isMissingAttachmentsColumnError(error.message)) {
        throw new Error(error.message);
      }

      const fallbackFields = { ...fields };
      delete fallbackFields.attachments;
      const fallback = await client.from('news_posts').update(fallbackFields).eq('id', id).select().single();
      if (fallback.error) throw new Error(fallback.error.message);
      if (patch.attachments !== undefined) {
        runtimeAttachmentStore.set(id, patch.attachments);
      }
      return mapRow(fallback.data);
    }
    if (patch.attachments !== undefined) {
      runtimeAttachmentStore.set(id, patch.attachments);
    }
    return mapRow(data);
  },

  async remove(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
      const index = sandboxPosts.findIndex((post) => post.id === id);
      if (index >= 0) sandboxPosts.splice(index, 1);
      runtimeAttachmentStore.delete(id);
      return;
    }
    const { error } = await client.from('news_posts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    runtimeAttachmentStore.delete(id);
  }
};
