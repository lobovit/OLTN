import type { JSX } from "preact";
import type { TrendBucket } from "../../lib/trending";

/** Basic bar chart of the daily uses (sparkline). */
export function TrendChart({ history }: { history: readonly TrendBucket[] }): JSX.Element | null {
  const values = history.map((entry) => Number(entry.uses || 0));
  if (values.length < 2) return null;
  const width = 72;
  const height = 22;
  const max = Math.max(...values, 1);
  const step = width / values.length;
  return (
    <svg class="trend-chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {values.map((value, index) => {
        const bar = Math.max(2, Math.round((value / max) * height));
        return (
          <rect
            key={history[index].day}
            x={index * step}
            y={height - bar}
            width={Math.max(1, step - 3)}
            height={bar}
            rx={1.5}
          />
        );
      })}
    </svg>
  );
}
