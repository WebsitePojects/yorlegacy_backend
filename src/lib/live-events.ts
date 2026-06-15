// In-process Server-Sent-Events hub. The member dashboard opens one SSE connection
// (GET /api/member/live); when the compensation engine credits PV or income to a user,
// it calls notifyUser(userId, ...) and every open connection for that user gets a push.
// This makes balances tick live without the client polling or reloading.
//
// Single-instance only (in-memory). For >1 backend instance, replace with Postgres
// LISTEN/NOTIFY or Redis pub/sub so a credit on instance A reaches a client on instance B.

type LiveClient = { write: (chunk: string) => void };

const clientsByUser = new Map<string, Set<LiveClient>>();

export function addLiveClient(userId: string, client: LiveClient): () => void {
  let set = clientsByUser.get(userId);
  if (!set) {
    set = new Set();
    clientsByUser.set(userId, set);
  }
  set.add(client);
  return () => {
    const current = clientsByUser.get(userId);
    if (!current) return;
    current.delete(client);
    if (current.size === 0) {
      clientsByUser.delete(userId);
    }
  };
}

export function notifyUser(userId: string, event: { type: string; [key: string]: unknown }): void {
  const set = clientsByUser.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: update\ndata: ${JSON.stringify({ ...event, at: new Date().toISOString() })}\n\n`;
  for (const client of set) {
    try {
      client.write(payload);
    } catch {
      // Broken pipe — the close handler will remove it.
    }
  }
}

export function liveClientCount(): number {
  let total = 0;
  for (const set of clientsByUser.values()) total += set.size;
  return total;
}
