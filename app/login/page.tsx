import Link from "next/link";
import Flash from "@/components/Flash";
import { login } from "./actions";

export const metadata = { title: "Log in" };

export default function Login({ searchParams }: { searchParams: { next?: string; ok?: string; err?: string } }) {
  return (
    <div className="page"><div className="narrow">
      <h1>Welcome back</h1>
      <Flash searchParams={searchParams} />
      <form action={login} className="card">
        <input type="hidden" name="next" value={searchParams.next ?? "/dashboard"} />
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        <button className="btn btn-dark" type="submit" style={{ width: "100%" }}>Log in</button>
      </form>
      <p className="muted" style={{ marginTop: 18 }}>New here? <Link href="/signup"><b>Create an account</b></Link></p>
    </div></div>
  );
}
