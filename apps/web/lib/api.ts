const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

function normalizeApiBase(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveApiUrl(): string {
  // In browser, avoid localhost API calls when app is opened from another device.
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
      // If env value is malformed, fallback to current browser origin host on API port.
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

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiUrl = resolveApiUrl();
  const hasBody = typeof options.body !== "undefined";
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiRequestError(response.status, error?.message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
