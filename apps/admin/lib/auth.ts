export const ADMIN_AUTH_TOKEN_KEY = "pasalo_admin_auth_token";

export function getAdminAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);
}

export function setAdminAuthToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, token);
}

export function clearAdminAuthToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
}
