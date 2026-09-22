import Link from "next/link";
import { SITE_NAME } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div><strong style={{ color: "#fff" }}>{SITE_NAME}</strong><br />Golf scores that give back.</div>
        <div><Link href="/charities">Charities</Link> &nbsp; <Link href="/signup">Subscribe</Link> &nbsp; <Link href="/login">Log in</Link></div>
        <div>Prizes are drawn monthly. Subscribers must hold five scores to enter.</div>
      </div>
    </footer>
  );
}
