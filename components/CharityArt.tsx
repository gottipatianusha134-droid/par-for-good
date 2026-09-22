/** Charity visual: uses the admin-supplied image if present, otherwise deterministic generative artwork. */
const PALETTES = [
  ["#0e3b43", "#f2b632", "#e23e74", "#ddf1ec"],
  ["#164f59", "#e23e74", "#ddf1ec", "#f2b632"],
  ["#10262b", "#ddf1ec", "#f2b632", "#e23e74"],
];
function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export default function CharityArt({ seed, imageUrl, className = "art" }: { seed: string; imageUrl?: string | null; className?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={className} style={{ objectFit: "cover", aspectRatio: "16/9", width: "100%", borderRadius: className === "art" ? 0 : 14 }} />;
  }
  const h = hash(seed);
  const [bg, a, b, c] = PALETTES[h % PALETTES.length];
  const r = (n: number, i: number) => ((h >> (i * 3)) % n);
  return (
    <svg className={className} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="320" height="180" fill={bg} />
      <circle cx={60 + r(200, 1)} cy={40 + r(100, 2)} r={54 + r(30, 3)} fill={a} />
      <circle cx={120 + r(160, 4)} cy={110 + r(60, 5)} r={38 + r(30, 6)} fill={b} opacity=".92" />
      <path d={`M0 ${140 + r(20, 7)} Q 80 ${100 + r(30, 8)} 160 ${140 + r(20, 9)} T 320 ${130 + r(30, 10)} V180 H0Z`} fill={c} opacity=".9" />
    </svg>
  );
}
