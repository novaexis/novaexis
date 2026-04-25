import { useMemo } from "react";

interface Props {
  score: number | null; // 0..100
  label?: string;
  size?: number;
}

/**
 * Gauge semicircular para score de aprovação 0-100.
 * Verde >70, Amarelo 50-70, Vermelho <50.
 */
export function GaugeScore({ score, label = "Aprovação", size = 220 }: Props) {
  const v = score == null ? 0 : Math.max(0, Math.min(100, score));
  const cor = useMemo(() => {
    if (score == null) return "hsl(var(--muted-foreground))";
    if (score >= 70) return "hsl(var(--primary))";
    if (score >= 50) return "hsl(var(--warning, 38 92% 50%))";
    return "hsl(var(--destructive))";
  }, [score]);

  const r = 80;
  const cx = 100;
  const cy = 100;
  const startAngle = 180;
  const endAngle = 0;
  const angle = startAngle - (v / 100) * 180;

  const polar = (ang: number) => {
    const rad = (ang * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  };

  const start = polar(startAngle);
  const end = polar(endAngle);
  const cur = polar(angle);

  const bgPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  const fgPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${cur.x} ${cur.y}`;

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 200 120" width={size} height={size * 0.6}>
        <path d={bgPath} fill="none" stroke="hsl(var(--muted))" strokeWidth={16} strokeLinecap="round" />
        <path d={fgPath} fill="none" stroke={cor} strokeWidth={16} strokeLinecap="round" />
        <text x={cx} y={cy} textAnchor="middle" fontSize="28" fontWeight="700" fill="hsl(var(--foreground))">
          {score == null ? "—" : `${v.toFixed(0)}`}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
          / 100
        </text>
      </svg>
      <p className="-mt-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
