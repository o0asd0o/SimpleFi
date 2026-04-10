import { createEffect, onCleanup, onMount } from "solid-js";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { TrendPoint } from "../lib/api";

// ─── Trend (Line) Chart ───────────────────────────────────────────────────────

type TrendChartProps = {
  data: TrendPoint[];
};

export function TrendChart(props: TrendChartProps) {
  let ref: HTMLDivElement | undefined;
  let chart: uPlot | undefined;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const buildChart = () => {
    if (!ref) return;
    chart?.destroy();

    const pts = props.data;
    if (pts.length === 0) return;

    // Parse labels to timestamps (YYYY-MM-DD, YYYY-MM, YYYY-Www)
    const timestamps = pts.map((p) => {
      const s = p.label;
      // Week format YYYY-Www → use start of that ISO week
      if (/^\d{4}-W\d{2}$/.test(s)) {
        const [year, week] = s.split("-W").map(Number);
        const jan1 = new Date(year, 0, 1);
        const dayOffset = (week - 1) * 7 - jan1.getDay() + 1;
        jan1.setDate(jan1.getDate() + dayOffset);
        return jan1.getTime() / 1000;
      }
      // Month format YYYY-MM
      if (/^\d{4}-\d{2}$/.test(s)) {
        return new Date(`${s}-01`).getTime() / 1000;
      }
      // Day format YYYY-MM-DD
      return new Date(s).getTime() / 1000;
    });

    const values = pts.map((p) => p.amount);
    const isDark = document.documentElement.classList.contains("dark");

    const opts: uPlot.Options = {
      width: ref.clientWidth,
      height: 180,
      cursor: { drag: { x: false, y: false } },
      legend: { show: false },
      series: [
        {},
        {
          stroke: "#a855f7",
          fill: "rgba(168,85,247,0.12)",
          width: 2,
          points: { show: pts.length <= 31, size: 5, fill: "#a855f7" },
        },
      ],
      axes: [
        {
          stroke: isDark ? "#6b7280" : "#9ca3af",
          ticks: { stroke: "transparent" },
          grid: { show: false },
          font: "11px Manrope, sans-serif",
          // Pin ticks to the actual data timestamps (one per bucket) to
          // prevent uPlot from generating sub-day duplicate labels.
          splits: () => timestamps,
          // For dense datasets keep at most ~6 labels visible.
          // uPlot filter must return the actual split values to show, not booleans.
          filter: (_u, splits) => {
            if (splits.length <= 6) return splits;
            const step = Math.ceil(splits.length / 6);
            return splits.filter((_, i) => i % step === 0);
          },
          values: (_u, ts) =>
            ts.map((t) => {
              const d = new Date(t * 1000);
              return d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            }),
        },
        {
          stroke: isDark ? "#6b7280" : "#9ca3af",
          ticks: { stroke: "transparent" },
          grid: {
            stroke: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            width: 1,
          },
          font: "11px Manrope, sans-serif",
          values: (_u, vs) =>
            vs.map((v) => {
              if (v === null) return "";
              if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
              return String(Math.round(v));
            }),
        },
      ],
      scales: { x: { time: true } },
      padding: [8, 40, 0, 8],
    };

    chart = new uPlot(
      opts,
      [new Float64Array(timestamps), new Float64Array(values)],
      ref,
    );
  };

  onMount(() => {
    if (!prefersReducedMotion) {
      buildChart();
    } else {
      // Reduced motion: still build chart but skip later
      buildChart();
    }
    const observer = new ResizeObserver(() => {
      if (chart && ref) chart.setSize({ width: ref.clientWidth, height: 180 });
    });
    if (ref) observer.observe(ref);
    onCleanup(() => {
      observer.disconnect();
      chart?.destroy();
    });
  });

  createEffect(() => {
    // Reactive rebuild when data changes
    void props.data;
    if (ref && chart) {
      buildChart();
    }
  });

  return (
    <div
      ref={ref}
      class="w-full overflow-hidden"
      aria-label="Spending trend chart"
    />
  );
}

// ─── Pie / Donut Chart (SVG, no library) ─────────────────────────────────────

type PieSlice = {
  label: string;
  value: number;
  color: string;
};

type PieChartProps = {
  slices: PieSlice[];
};

const PIE_COLORS = [
  "#a855f7", // purple-500
  "#60a5fa", // blue-400
  "#ec4899", // pink-500
  "#818cf8", // indigo-400
  "#22d3ee", // cyan-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#f87171", // red-400
];

export function PieChart(props: PieChartProps) {
  const SIZE = 180;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 70;
  const INNER_R = 42; // donut hole

  const total = () => props.slices.reduce((s, sl) => s + sl.value, 0);

  const paths = () => {
    const t = total();
    if (t === 0) return [];
    let angle = -Math.PI / 2;
    return props.slices.map((sl, i) => {
      const sweep = (sl.value / t) * 2 * Math.PI;
      const x1 = CX + R * Math.cos(angle);
      const y1 = CY + R * Math.sin(angle);
      const x1i = CX + INNER_R * Math.cos(angle);
      const y1i = CY + INNER_R * Math.sin(angle);
      angle += sweep;
      const x2 = CX + R * Math.cos(angle);
      const y2 = CY + R * Math.sin(angle);
      const x2i = CX + INNER_R * Math.cos(angle);
      const y2i = CY + INNER_R * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      const d = [
        `M ${x1} ${y1}`,
        `A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
        `L ${x2i} ${y2i}`,
        `A ${INNER_R} ${INNER_R} 0 ${large} 0 ${x1i} ${y1i}`,
        "Z",
      ].join(" ");
      return {
        d,
        color: sl.color ?? PIE_COLORS[i % PIE_COLORS.length],
        label: sl.label,
        value: sl.value,
      };
    });
  };

  return (
    <div class="flex flex-col items-center gap-4">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Category spending breakdown pie chart"
        style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.2))" }}
      >
        {paths().map((p) => (
          <path d={p.d} fill={p.color} opacity="0.9" />
        ))}
      </svg>

      {/* Legend */}
      <ul class="w-full space-y-2">
        {paths().map((p, i) => (
          <li class="flex items-center gap-2 text-sm">
            <span
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: p.color }}
            />
            <span class="flex-1 text-fg-2 truncate">{p.label}</span>
            <span class="text-fg tabular-nums text-xs">
              {((props.slices[i].value / total()) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
