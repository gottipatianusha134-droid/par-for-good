import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="page"><div className="container admin-shell">
      <nav className="admin-nav" aria-label="Admin">
        <Link href="/admin">Reports</Link><Link href="/admin/users">Users</Link><Link href="/admin/draws">Draws</Link>
        <Link href="/admin/charities">Charities</Link><Link href="/admin/winners">Winners</Link>
      </nav>
      <div>{children}</div>
    </div></div>
  );
}
