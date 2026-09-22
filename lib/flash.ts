import { redirect } from "next/navigation";

/** Redirect back with a one-line message shown by <Flash/>. Never call inside try/catch. */
export function back(path: string, type: "ok" | "err", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${type}=${encodeURIComponent(message)}`);
  throw new Error("unreachable"); // redirect() throws; this satisfies the `never` return type
}
