export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*/.test(error.message);
}

export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setAuthHeader(headers: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
