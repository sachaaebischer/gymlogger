"use client";

export function ExerciseProgressChart({
  points,
  unit,
  prValue,
}: {
  points: { date: string; value: number; label: string }[];
  unit: string;
  prValue?: number | null;
}) {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const W = 320;
  const H = 140;
  const pad = { top: 20, right: 12, bottom: 28, left: 44 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const dates = sorted.map((p) => new Date(p.date).getTime());
  const vals = sorted.map((p) => p.value);
  const minD = Math.min(...dates);
  const maxD = Math.max(...dates);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const rangeV = maxV - minV || 1;

  const cx = (d: number) => pad.left + ((d - minD) / (maxD - minD || 1)) * iW;
  const cy = (v: number) => pad.top + (1 - (v - minV) / rangeV) * iH;

  const pathD = sorted
    .map((p, i) => `${i === 0 ? "M" : "L"} ${cx(new Date(p.date).getTime()).toFixed(1)} ${cy(p.value).toFixed(1)}`)
    .join(" ");

  const yTicks = [minV, minV + rangeV * 0.5, maxV].map((v) => Math.round(v * 10) / 10);
  const xLabels = [sorted[0], sorted[sorted.length - 1]];

  // Find the PR point (highest value)
  const maxVal = Math.max(...vals);
  const prIdx = prValue != null ? sorted.findIndex((p) => p.value === maxVal) : -1;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label={`${unit} progression chart`}>
        {yTicks.map((v, i) => (
          <line key={i} x1={pad.left} y1={cy(v)} x2={W - pad.right} y2={cy(v)} stroke="#222e3a" strokeWidth="1" />
        ))}
        {yTicks.map((v, i) => (
          <text key={i} x={pad.left - 4} y={cy(v) + 4} textAnchor="end" fill="#8a99a8" fontSize="9">{v}</text>
        ))}
        {xLabels.map((p, i) => (
          <text key={i} x={cx(new Date(p.date).getTime())} y={H - 4} textAnchor={i === 0 ? "start" : "end"} fill="#8a99a8" fontSize="9">
            {p.date.slice(5)}
          </text>
        ))}
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8FF00" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#C8FF00" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L ${cx(dates[dates.length - 1]).toFixed(1)} ${pad.top + iH} L ${cx(dates[0]).toFixed(1)} ${pad.top + iH} Z`}
          fill="url(#chartGrad)"
        />
        <path d={pathD} fill="none" stroke="#C8FF00" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {sorted.map((p, i) => {
          const isPR = prValue != null && i === prIdx;
          const dotCx = cx(new Date(p.date).getTime());
          const dotCy = cy(p.value);
          return (
            <g key={i}>
              <circle
                cx={dotCx}
                cy={dotCy}
                r={isPR ? 6 : i === sorted.length - 1 ? 5 : 3}
                fill={isPR ? "#eab308" : i === sorted.length - 1 ? "#C8FF00" : "#0A0A0A"}
                stroke={isPR ? "#eab308" : "#C8FF00"}
                strokeWidth="2"
              />
              {isPR && (
                <text x={dotCx} y={dotCy - 9} textAnchor="middle" fill="#eab308" fontSize="8" fontWeight="bold">PR</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
