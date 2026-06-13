import { getSupabaseClient } from '../../lib/supabase.js';
import { isProductionMode } from '../production/runtime.js';

export type SupportMessageCategory = 'general' | 'account' | 'technical' | 'encashment';
export type SupportMessageStatus = 'unread' | 'read' | 'done' | 'blocked';

export type SupportMessage = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  category: SupportMessageCategory;
  subject: string;
  message: string;
  status: SupportMessageStatus;
  createdAt: string;
};

export type SubmitSupportMessageInput = {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  category: SupportMessageCategory;
  subject: string;
  message: string;
};

const sandboxMessages: SupportMessage[] = [];

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function submitSupportMessage(input: SubmitSupportMessageInput): Promise<SupportMessage> {
  if (isProductionMode()) {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('contact_messages')
        .insert({
          user_id: input.userId,
          username: input.username,
          display_name: input.displayName,
          email: input.email,
          category: input.category,
          subject: input.subject,
          message: input.message,
          status: 'unread'
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRow(data);
    }
  }

  const message: SupportMessage = {
    id: generateId(),
    userId: input.userId,
    username: input.username,
    displayName: input.displayName,
    email: input.email,
    category: input.category,
    subject: input.subject,
    message: input.message,
    status: 'unread',
    createdAt: new Date().toISOString()
  };
  sandboxMessages.unshift(message);
  return message;
}

export async function listSupportMessages(): Promise<SupportMessage[]> {
  if (isProductionMode()) {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRow);
    }
  }
  return [...sandboxMessages];
}

export async function updateSupportMessageStatus(id: string, status: SupportMessageStatus): Promise<void> {
  if (isProductionMode()) {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client
        .from('contact_messages')
        .update({ status })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
  }
  const found = sandboxMessages.find((m) => m.id === id);
  if (found) found.status = status;
}

function mapRow(row: Record<string, unknown>): SupportMessage {
  return {
    id: String(row['id'] ?? ''),
    userId: String(row['user_id'] ?? ''),
    username: String(row['username'] ?? ''),
    displayName: String(row['display_name'] ?? ''),
    email: String(row['email'] ?? ''),
    category: String(row['category'] ?? 'general') as SupportMessageCategory,
    subject: String(row['subject'] ?? ''),
    message: String(row['message'] ?? ''),
    status: String(row['status'] ?? 'unread') as SupportMessageStatus,
    createdAt: String(row['created_at'] ?? new Date().toISOString())
  };
}
