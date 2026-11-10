type Options = Omit<RequestInit, 'body'> & { body?: unknown };

const STAFF_KEY = 'staffId';

// localStorage can throw (private mode, blocked storage), so fall back to memory for this tab.
let staffId: number | null = readStoredStaffId();

function readStoredStaffId(): number | null {
  try {
    const value = Number(localStorage.getItem(STAFF_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function getStaffId() {
  return staffId;
}

export function setStaffId(id: number | null) {
  staffId = id;
  try {
    if (id === null) localStorage.removeItem(STAFF_KEY);
    else localStorage.setItem(STAFF_KEY, String(id));
  } catch {
    // Keep the in-memory choice; it just won't survive a reload.
  }
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (staffId !== null) headers['X-Staff-Id'] = String(staffId);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}
