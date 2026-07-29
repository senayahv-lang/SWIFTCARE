import { get, set, update, createStore } from 'idb-keyval';

const pendingStore = createStore('health-triage-pending', 'sessions');

export interface PendingSession {
  id: string;
  patient_hash: string;
  age_group: string;
  language: string;
  malaria_result: string;
  malaria_risk_level: string;
  other_disease?: string;
  other_disease_result?: string;
  symptoms_summary: string;
  recommendation: string;
  notified: number;
  created_at: string;
  payload: unknown;
}

const PENDING_KEY = 'pending-sessions';

export async function queueSession(session: PendingSession) {
  await update(
    PENDING_KEY,
    (list: PendingSession[] | undefined) => [...(list || []), session],
    pendingStore
  );
}

export async function getPendingSessions(): Promise<PendingSession[]> {
  return (await get(PENDING_KEY, pendingStore)) || [];
}

export async function clearSyncedSessions(ids: string[]) {
  const current = await getPendingSessions();
  const remaining = current.filter((s) => !ids.includes(s.id));
  await set(PENDING_KEY, remaining, pendingStore);
}

export function isOnline() {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

export async function syncPendingSessions(): Promise<number> {
  if (!isOnline()) return 0;

  const pending = await getPendingSessions();
  if (pending.length === 0) return 0;

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: pending }),
    });

    if (!res.ok) throw new Error('Sync failed');

    const data = (await res.json()) as { synced: string[] };
    await clearSyncedSessions(data.synced);
    return data.synced.length;
  } catch {
    return 0;
  }
}

export async function submitTriage(payload: unknown) {
  if (!isOnline()) {
    throw new Error('OFFLINE');
  }

  const res = await fetch('/api/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('Submit failed');
  return res.json();
}

export async function adminLogin(username: string, password: string) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json() as Promise<{ token: string; username: string }>;
}

export async function fetchAdminStats(token: string) {
  const res = await fetch('/api/admin/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function fetchAdminSessions(token: string) {
  const res = await fetch('/api/admin/sessions', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function fetchAdminNotifications(token: string) {
  const res = await fetch('/api/admin/notifications', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}
