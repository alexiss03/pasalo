"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "../../lib/api";
import { setAuthToken } from "../../lib/auth";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("buyer");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    try {
      if (mode === "signup") {
        const result = await apiFetch<{ token: string }>("/auth/signup", {
          method: "POST",
          body: {
            email,
            password,
            fullName,
            phone,
            role,
          },
        });
        setAuthToken(result.token);
        setStatus("Signed up and logged in.");
      } else {
        const result = await apiFetch<{ token: string }>("/auth/login", {
          method: "POST",
          body: { email, password },
        });
        setAuthToken(result.token);
        setStatus("Logged in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth request failed");
    }
  };

  return (
    <section className="card" style={{ maxWidth: 520 }}>
      <h1 style={{ marginTop: 0 }}>{mode === "login" ? "Login" : "Create account"}</h1>
      <p className="small">Sign up as buyer or seller. Additional roles can be requested after registration.</p>

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

        {mode === "signup" && (
          <>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
          </>
        )}

        <button className="primary" type="submit">
          {mode === "login" ? "Login" : "Sign up"}
        </button>
      </form>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="ghost" onClick={() => setMode("login")} type="button">
          Login mode
        </button>
        <button className="ghost" onClick={() => setMode("signup")} type="button">
          Signup mode
        </button>
      </div>

      {status && <p>{status}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
