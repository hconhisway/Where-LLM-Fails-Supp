import { Link } from 'react-router-dom';

import { getRunDisplayName, summarizeBy } from '@/lib/data.js';
import { useViewerData } from '@/lib/ViewerContext.jsx';

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error } = useViewerData();

  if (loading) {
    return <p className="text-sm text-slate-600">Loading viewer data...</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-600">No viewer data available.</p>;
  }

  const byModel = summarizeBy(data.results, 'modelId');
  const byGrammar = summarizeBy(data.results, 'grammarId');
  const byTask = summarizeBy(data.results, 'taskId');

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Run" value={getRunDisplayName(data.runId)} />
        <StatCard title="Completed" value={`${data.summary.completed}/${data.summary.expectedTotal}`} />
        <StatCard title="JSON Valid Rate" value={percent(data.summary.jsonValidRate)} />
        <StatCard title="Render Success Rate" value={percent(data.summary.renderSuccessRate)} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Breakdown by Model</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th>Model</th>
              <th>Total</th>
              <th>JSON Valid</th>
              <th>Render Success</th>
            </tr>
          </thead>
          <tbody>
            {byModel.map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <td className="py-2">{row.key}</td>
                <td>{row.total}</td>
                <td>{percent(row.total > 0 ? row.jsonValid / row.total : 0)}</td>
                <td>{percent(row.total > 0 ? row.renderSuccess / row.total : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SmallBreakdown title="By Grammar" rows={byGrammar} />
        <TaskRenderRate title="Render Success by Task" rows={byTask} />
      </div>

      <div>
        <Link to={`/results${window.location.search}`} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          Open Result Cards
        </Link>
      </div>
    </div>
  );
}

function SmallBreakdown({ title, rows }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between">
            <span className="text-slate-700">{row.key}</span>
            <span className="text-slate-500">
              {row.renderSuccess}/{row.total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskRenderRate({ title, rows }) {
  const sortedRows = [...rows].sort((a, b) => {
    const rateA = a.total > 0 ? a.renderSuccess / a.total : 0;
    const rateB = b.total > 0 ? b.renderSuccess / b.total : 0;
    if (rateB !== rateA) {
      return rateB - rateA;
    }
    return String(a.key).localeCompare(String(b.key));
  });

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
        {sortedRows.map((row) => {
          const rate = row.total > 0 ? row.renderSuccess / row.total : 0;
          return (
            <li key={row.key} className="flex items-center justify-between gap-2 py-1">
              <span className="truncate text-slate-700" title={row.key}>{row.key}</span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {percent(rate)} ({row.renderSuccess}/{row.total})
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
