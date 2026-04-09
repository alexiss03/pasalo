"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "../lib/api";
import { getAuthToken, setAuthToken } from "../lib/auth";

type ConversationFeed = {
  items: Array<{
    unread_count: number;
  }>;
};

export function NavBar() {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const syncAuthState = () => {
      setIsAuthenticated(Boolean(getAuthToken()));
    };

    syncAuthState();
    window.addEventListener("focus", syncAuthState);
    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener("focus", syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, [pathname]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setUnreadMessages(0);
      return;
    }

    let active = true;

    const loadUnread = async () => {
      try {
        const result = await apiFetch<ConversationFeed>("/conversations", { token });
        if (!active) {
          return;
        }
        const totalUnread = result.items.reduce((sum, item) => sum + Number(item.unread_count ?? 0), 0);
        setUnreadMessages(totalUnread);
      } catch {
        if (active) {
          setUnreadMessages(0);
        }
      }
    };

    void loadUnread();
    const interval = window.setInterval(() => {
      void loadUnread();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isAuthenticated, pathname]);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setLoginError("Enter email and password.");
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);
    try {
      const result = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        body: {
          email: email.trim(),
          password,
        },
      });
      setAuthToken(result.token);
      setIsAuthenticated(true);
      setEmail("");
      setPassword("");
      if (pathname === "/login" || pathname === "/signup") {
        const nextPath = new URLSearchParams(window.location.search).get("next");
        window.location.href = nextPath && nextPath.startsWith("/") ? nextPath : "/";
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <header className={`nav${isAuthRoute ? " nav-auth" : ""}`}>
      <Link className="brand-lockup" href="/">
        <span>Pasalo</span>
        <span>Estate</span>
      </Link>
      {isAuthenticated && (
        <div className="nav-right-actions">
          <Link className="nav-link" href="/promotions">
            Promotions
          </Link>
          <Link className="nav-link" href="/my-properties">
            Listing Hub
          </Link>
          <Link className="nav-link" href="/messages">
            Messages
            {unreadMessages > 0 && <span className="nav-unread-pill">{unreadMessages}</span>}
          </Link>
          <Link className="nav-action nav-action-inline" href="/create-listing">
            Post a property
          </Link>
          <Link className="nav-action nav-action-inline" href="/profile">
            Profile
          </Link>
        </div>
      )}
      {!isAuthenticated && !isAuthRoute && (
        <div className="nav-right-actions nav-right-actions-unauth">
          <Link className="nav-link" href="/promotions">
            Promotions
          </Link>
          <form className="nav-login-form" onSubmit={submitLogin}>
            <input
              autoComplete="email"
              className="nav-login-input"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              required
              type="email"
              value={email}
            />
            <input
              autoComplete="current-password"
              className="nav-login-input"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              type="password"
              value={password}
            />
            <button className="nav-action nav-login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "..." : "Login"}
            </button>
            <Link className="nav-link nav-signup-link" href="/signup">
              Sign up
            </Link>
          </form>
        </div>
      )}
      {!isAuthenticated && isAuthRoute && (
        <div className="nav-right-actions nav-auth-actions">
          <Link className="nav-link" href="/promotions">
            Promotions
          </Link>
          {pathname === "/signup" ? (
            <Link className="nav-action nav-action-inline" href="/login">
              Login
            </Link>
          ) : (
            <Link className="nav-action nav-action-inline" href="/signup">
              Sign up
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
