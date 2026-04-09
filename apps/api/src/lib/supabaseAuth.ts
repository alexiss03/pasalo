import { env } from "../config/env";

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

type SupabaseAdminCreateUserInput = {
  email: string;
  password: string;
  role: string;
  fullName: string;
  phone: string;
};

function getSupabaseBaseUrl(): string {
  if (!env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is required when AUTH_PROVIDER is supabase.");
  }
  return env.SUPABASE_URL.replace(/\/$/, "");
}

function getSupabaseAnonKey(): string {
  if (!env.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_ANON_KEY is required when AUTH_PROVIDER is supabase.");
  }
  return env.SUPABASE_ANON_KEY;
}

function getSupabaseServiceRoleKey(): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required when AUTH_PROVIDER is supabase.");
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

function parseSupabaseError(
  payload: { msg?: string; message?: string; error_description?: string; error?: string } | null,
  fallback: string,
) {
  return (
    payload?.message?.trim() ||
    payload?.msg?.trim() ||
    payload?.error_description?.trim() ||
    payload?.error?.trim() ||
    fallback
  );
}

export async function createSupabaseAuthUser(input: SupabaseAdminCreateUserInput): Promise<SupabaseAuthUser> {
  const response = await fetch(`${getSupabaseBaseUrl()}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: getSupabaseServiceRoleKey(),
      Authorization: `Bearer ${getSupabaseServiceRoleKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
        phone: input.phone,
        app_role: input.role,
      },
      app_metadata: {
        role: input.role,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | (SupabaseAuthUser & { code?: string; message?: string; error?: string; msg?: string })
    | null;

  if (!response.ok) {
    throw new Error(parseSupabaseError(payload, "Unable to create Supabase auth user."));
  }

  if (!payload?.id) {
    throw new Error("Supabase auth user response is missing the user id.");
  }

  return payload;
}

export async function deleteSupabaseAuthUser(userId: string): Promise<void> {
  const response = await fetch(`${getSupabaseBaseUrl()}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: getSupabaseServiceRoleKey(),
      Authorization: `Bearer ${getSupabaseServiceRoleKey()}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { msg?: string; message?: string; error?: string }
      | null;
    throw new Error(parseSupabaseError(payload, "Unable to delete Supabase auth user."));
  }
}

export async function signInSupabaseAuthUser(email: string, password: string): Promise<SupabaseAuthUser> {
  const response = await fetch(`${getSupabaseBaseUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: getSupabaseAnonKey(),
      Authorization: `Bearer ${getSupabaseAnonKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { user?: SupabaseAuthUser; message?: string; msg?: string; error?: string; error_description?: string }
    | null;

  if (!response.ok) {
    throw new Error(parseSupabaseError(payload, "Invalid credentials."));
  }

  if (!payload?.user?.id) {
    throw new Error("Supabase sign-in response is missing the user.");
  }

  return payload.user;
}
