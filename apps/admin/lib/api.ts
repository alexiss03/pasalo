const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

function normalizeApiBase(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    const browserHost = window.location.hostname;
    const isBrowserLocalhost = browserHost === "localhost" || browserHost === "127.0.0.1";

    try {
      const parsed = new URL(API_URL);
      const apiIsLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

      if (apiIsLocalhost && !isBrowserLocalhost) {
        parsed.hostname = browserHost;
        return normalizeApiBase(parsed.toString());
      }

      return normalizeApiBase(parsed.toString());
    } catch {
      return `${window.location.protocol}//${browserHost}:4000/api/v1`;
    }
  }

  return normalizeApiBase(API_URL);
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiUrl = resolveApiUrl();
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
