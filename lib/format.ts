export const inr = (minor: number | bigint | null | undefined) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Number(minor ?? 0) / 100);

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const fmtMonth = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export const todayISO = () => new Date().toISOString().slice(0, 10);
