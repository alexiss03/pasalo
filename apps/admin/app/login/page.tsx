"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "../../lib/api";
import { setAdminAuthToken } from "../../lib/auth";

type LoginResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
};

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: {
          email: email.trim(),
          password,
        },
      });

      if (result.user.role !== "admin") {
        throw new Error("This account is not an admin user.");
      }

      setAdminAuthToken(result.token);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <p className="eyebrow">Pasalo Admin</p>
        <h1>Admin Login</h1>
        <p className="muted">Use an account with admin role to access controls.</p>
        <form className="admin-form" onSubmit={submit}>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Admin email"
            required
            type="email"
            value={email}
          />
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            type="password"
            value={password}
          />
          <button disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>
    </main>
  );
}
