export const apiBase = (import.meta.env.VITE_API_URL || '') + '/api';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiBase + path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Clara-Client': 'web', ...init.headers },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ message: 'Não foi possível acessar o servidor.' }));
    throw new ApiError(e.message || 'Falha ao realizar operação.', res.status);
  }
  return res.json();
}
export const post = (path: string, body: unknown, headers?: Record<string, string>) =>
  api<any>(path, { method: 'POST', body: JSON.stringify(body), headers });
