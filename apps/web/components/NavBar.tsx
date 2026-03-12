"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getAuthToken } from "../lib/auth";

export function NavBar() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  return (
    <header className="nav">
      <Link className="brand-lockup" href="/">
        <span>PASALO</span>
        <span>ESTATE</span>
      </Link>
      <nav className="nav-links">
        <Link className="nav-link" href="/">
          Properties
        </Link>
        {isAuthenticated && (
          <Link className="nav-link" href="/messages">
            Messages
          </Link>
        )}
        {isAuthenticated && (
          <Link className="nav-link" href="/apply-role">
            Apply Role
          </Link>
        )}
      </nav>
      {isAuthenticated && (
        <Link className="nav-action" href="/create-listing">
          Post a property
        </Link>
      )}
      {!isAuthenticated && (
        <Link className="nav-action" href="/login">
          Login
        </Link>
      )}
    </header>
  );
}
