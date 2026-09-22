"use client";
import { useState } from "react";

/** Hero widget: shows exactly where one month's fee goes, and lets visitors choose their charity share. */
export default function SplitSlider({ priceRupees, poolPercent, min, max }: { priceRupees: number; poolPercent: number; min: number; max: number }) {
  const [pct, setPct] = useState(20);
  const platform = 100 - poolPercent - pct;
  const rs = (p: number) => `₹${Math.round((priceRupees * p) / 100).toLocaleString("en-IN")}`;
  return (
    <div className="split">
      <h2>Where your ₹{priceRupees} goes</h2>
      <p className="muted" style={{ margin: 0 }}>Move the slider to choose how much backs your charity.</p>
      <div className="bar" role="img" aria-label={`${pct}% to charity, ${poolPercent}% to the prize pool, ${platform}% to running the platform`}>
        <div style={{ width: `${pct}%`, background: "var(--marigold)" }}>{pct}%</div>
        <div style={{ width: `${poolPercent}%`, background: "var(--hibiscus)", color: "#fff" }}>{poolPercent}%</div>
        <div style={{ width: `${platform}%`, background: "var(--sea)" }}>{platform > 8 ? `${platform}%` : ""}</div>
      </div>
      <label htmlFor="pct" className="sr">Charity share</label>
      <input id="pct" type="range" min={min} max={max} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
      <div className="legend" style={{ marginTop: 10 }}>
        <div><span><i className="dot" style={{ background: "var(--marigold)" }} />Your charity</span><b>{rs(pct)}</b></div>
        <div><span><i className="dot" style={{ background: "var(--hibiscus)" }} />Monthly prize pool</span><b>{rs(poolPercent)}</b></div>
        <div><span><i className="dot" style={{ background: "var(--sea)", border: "1px solid var(--line)" }} />Running the platform</span><b>{rs(platform)}</b></div>
      </div>
    </div>
  );
}
