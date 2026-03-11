import Link from "next/link";

export function NavBar() {
  return (
    <header className="nav">
      <Link href="/">
        <strong>Pasalo Marketplace</strong>
      </Link>
      <nav className="nav-links">
        <Link className="nav-chip" href="/">
          Browse
        </Link>
        <Link className="nav-chip" href="/create-listing">
          Create Listing
        </Link>
        <Link className="nav-chip" href="/messages">
          Messages
        </Link>
        <Link className="nav-chip" href="/apply-role">
          Apply Role
        </Link>
        <Link className="nav-chip" href="/login">
          Login
        </Link>
      </nav>
    </header>
  );
}
