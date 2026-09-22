import Link from "next/link";
import { getUserAndProfile } from "@/lib/auth";
import { SITE_NAME } from "@/lib/config";

export default async function Nav() {
  let profile = null;
  try { profile = (await getUserAndProfile()).profile; } catch { /* env not configured yet */ }
  return (
    <header className="nav">
      <div className="container">
        <Link href="/" className="brand"><i aria-hidden /> {SITE_NAME}</Link>
        <nav aria-label="Main">
          <Link href="/charities">Charities</Link>
          <Link href="/#how" className="hide-sm">How it works</Link>
          {profile ? (
            <>
              {profile.role === "admin" && <Link href="/admin">Admin</Link>}
              <Link href="/dashboard">Dashboard</Link>
              <form action="/auth/signout" method="post"><button className="btn btn-sm" type="submit">Log out</button></form>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">Subscribe</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
