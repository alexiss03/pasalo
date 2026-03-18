"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "../../lib/api";
import { setAuthToken } from "../../lib/auth";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("buyer");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
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
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth request failed");
    }
  };

  return (
    <section className="card auth-panel">
      <h1 style={{ marginTop: 0 }}>Create account</h1>

      <form className="grid auth-form" onSubmit={submit}>
        <label className="form-field">
          <span className="field-label">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required type="email" />
        </label>
        <label className="form-field">
          <span className="field-label">Create Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create password"
            required
            minLength={8}
            type="password"
          />
        </label>
        <label className="form-field">
          <span className="field-label">Confirm Password</span>
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            required
            minLength={8}
            type="password"
          />
        </label>
        <label className="form-field">
          <span className="field-label">Full Name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
        </label>
        <label className="form-field">
          <span className="field-label">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required />
        </label>
        <div className="form-field">
          <span className="field-label">Account Role</span>
          <div aria-label="Select account role" className="segmented-control" role="radiogroup">
            <button
              aria-checked={role === "buyer"}
              className={`segment-button${role === "buyer" ? " active" : ""}`}
              onClick={() => setRole("buyer")}
              role="radio"
              type="button"
            >
              Buyer
            </button>
            <button
              aria-checked={role === "seller"}
              className={`segment-button${role === "seller" ? " active" : ""}`}
              onClick={() => setRole("seller")}
              role="radio"
              type="button"
            >
              Seller
            </button>
          </div>
        </div>
        <button className="primary" type="submit">
          Sign up
        </button>
      </form>

      {status && <p>{status}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
