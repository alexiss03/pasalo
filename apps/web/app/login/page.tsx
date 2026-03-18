"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiFetch } from "../../lib/api";
import { setAuthToken } from "../../lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    try {
      const result = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAuthToken(result.token);
      setStatus("Logged in.");
      const nextPath = new URLSearchParams(window.location.search).get("next");
      window.location.href = nextPath && nextPath.startsWith("/") ? nextPath : "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth request failed");
    }
  };

  return (
    <section className="card auth-panel auth-panel-login">
      <h1 style={{ marginTop: 0 }}>Login</h1>

      <form className="grid" onSubmit={submit}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required type="email" />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={8}
          type="password"
        />
        <button className="primary" type="submit">Login</button>
      </form>

      <div className="auth-panel-footer">
        <Link className="ghost-button" href="/signup">Sign up</Link>
      </div>

      {status && <p>{status}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
