/** Renders ?ok= / ?err= messages set by lib/flash.ts */
export default function Flash({ searchParams }: { searchParams?: { ok?: string; err?: string } }) {
  if (searchParams?.err) return <p className="flash err" role="alert">{searchParams.err}</p>;
  if (searchParams?.ok) return <p className="flash ok" role="status">{searchParams.ok}</p>;
  return null;
}
