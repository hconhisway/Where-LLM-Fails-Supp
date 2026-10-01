// Task Axes — companion to GrammarAxes.
//
// GrammarAxes asks "what are the properties of each grammar?" (rows = axes,
// cols = grammars). TaskAxes asks the dual question: "for each task, which
// grammars are exercised?" (rows = tasks, cols = grammars, cell =
// recommendedGrammarIds membership).
//
// This is the page that explains why some task/grammar pairs get silently
// dropped during a run: the runner skips any pair whose grammar isn't in the
// task's recommendedGrammarIds. Empty dots in this matrix are exactly those
// silent skips.

import { useEffect, useMemo, useState } from 'react';

const TASKS_URL = '/benchmark/tasks.json';

// The 10 grammars we actually run experiments on (matches src/registry.js
// and the GrammarAxes column set). Grammars appearing in recommendedGrammarIds
// but not in this list (fusioncharts, vizgrammar) are out-of-scope for the
// experiment and are filtered out of the matrix entirely.
const INCLUDED_GRAMMARS = [
  { id: 'vega-lite', label: 'Vega-Lite' },
  { id: 'vega', label: 'Vega' },
  { id: 'echarts', label: 'ECharts' },
  { id: 'plotly', label: 'Plotly JSON' },
  { id: 'highcharts', label: 'Highcharts' },
  { id: 'chartjs', label: 'Chart.js' },
  { id: 'apexcharts', label: 'ApexCharts' },
  { id: 'zingchart', label: 'ZingChart' },
  { id: 'frappe', label: 'Frappe Charts' },
  { id: 'chartml', label: 'ChartML' },
];

// Three sections matching benchmark/chart-type-task-redesign.md.
const SECTIONS = [
  {
    id: 'core-full',
    label: 'Core — full coverage',
    description:
      'Tasks every catalogued grammar can express. Full-width rows of filled dots are expected here.',
    matches: (task) =>
      task.benchmarkLayer === 'core' && task.grammarBreadth === 'full-coverage',
  },
  {
    id: 'core-majority',
    label: 'Core — majority coverage',
    description:
      'Core tasks where most — but not all — grammars have a clean expression. The rare gaps in the dot matrix live here (e.g. T19 Radar, T24 Nightingale Rose for Vega-Lite).',
    matches: (task) =>
      task.benchmarkLayer === 'core' && task.grammarBreadth === 'majority-coverage',
  },
  {
    id: 'extension-partial',
    label: 'Extension — partial coverage',
    description:
      'Deliberately narrow tasks that only a subset of grammars can construct. Lots of empty dots is the point — these probe what each grammar uniquely can or cannot do.',
    matches: (task) =>
      task.benchmarkLayer === 'extension' || task.grammarBreadth === 'partial-coverage',
  },
];

const COMPOSITION_BADGE_COLOR = {
  facet: 'bg-violet-50 text-violet-700 ring-violet-200',
  'facet-grid': 'bg-violet-50 text-violet-700 ring-violet-200',
  repeat: 'bg-amber-50 text-amber-700 ring-amber-200',
  concat: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

const CELL_SIZE = 36;
const TASK_LABEL_WIDTH = 320;
const HEADER_HEIGHT = 150;

function buildColumnList(tasks) {
  const includedIds = new Set(INCLUDED_GRAMMARS.map((g) => g.id));
  const counts = new Map();
  for (const grammar of INCLUDED_GRAMMARS) {
    counts.set(grammar.id, 0);
  }
  for (const task of tasks) {
    for (const grammarId of task.recommendedGrammarIds ?? []) {
      if (!includedIds.has(grammarId)) continue;
      counts.set(grammarId, (counts.get(grammarId) ?? 0) + 1);
    }
  }

  return INCLUDED_GRAMMARS.map((grammar) => ({
    id: grammar.id,
    label: grammar.label,
    count: counts.get(grammar.id) ?? 0,
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function groupTasksIntoSections(tasks) {
  const remaining = new Set(tasks);
  const sections = SECTIONS.map((section) => {
    const matched = [...remaining]
      .filter((task) => section.matches(task))
      .sort((a, b) => compareTaskIds(a.id, b.id));
    for (const task of matched) {
      remaining.delete(task);
    }
    return { ...section, tasks: matched };
  });

  // Anything we didn't classify falls into a catch-all so nothing disappears
  // silently if the schema gains new layer/breadth values later.
  if (remaining.size > 0) {
    sections.push({
      id: 'other',
      label: 'Other',
      description: 'Tasks whose layer/breadth combination did not match any predefined section.',
      tasks: [...remaining].sort((a, b) => compareTaskIds(a.id, b.id)),
    });
  }
  return sections;
}

function compareTaskIds(a, b) {
  // Sort like a human would: T1 < T2 < T10 < T19, then T31 < T32 < T40.
  const parse = (id) => {
    const match = id.match(/^([A-Za-z]+)(\d+)$/);
    return match ? [match[1], Number(match[2])] : [id, 0];
  };
  const [aPrefix, aNum] = parse(a);
  const [bPrefix, bNum] = parse(b);
  if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix);
  return aNum - bNum;
}

function Dot({ filled }) {
  return (
    <span
      className={
        filled
          ? 'inline-block h-2.5 w-2.5 rounded-full bg-slate-900'
          : 'inline-block h-2.5 w-2.5 rounded-full bg-slate-200'
      }
      aria-hidden="true"
    />
  );
}

function CompositionBadge({ operator }) {
  if (!operator) return null;
  const color = COMPOSITION_BADGE_COLOR[operator] ?? 'bg-slate-50 text-slate-700 ring-slate-200';
  return (
    <span
      className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${color}`}
    >
      {operator}
    </span>
  );
}

export default function TaskAxes() {
  const [tasks, setTasks] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(TASKS_URL);
        if (!response.ok) {
          throw new Error(`Failed to load benchmark task list (${response.status})`);
        }
        const parsed = await response.json();
        if (!active) return;
        setTasks(parsed.tasks ?? []);
        setMeta({
          version: parsed.version,
          benchmarkDesignVersion: parsed.benchmarkDesignVersion,
          fullCoverageGrammarIds: parsed.fullCoverageGrammarIds ?? [],
        });
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const columns = useMemo(() => (tasks ? buildColumnList(tasks) : []), [tasks]);
  const sections = useMemo(() => (tasks ? groupTasksIntoSections(tasks) : []), [tasks]);

  const summary = useMemo(() => {
    if (!tasks) return null;
    const includedIds = new Set(INCLUDED_GRAMMARS.map((g) => g.id));
    // Count only grammars the experiment actually runs — tasks may reference
    // out-of-scope grammars in their recommendedGrammarIds, but those never
    // show up as columns here, so they shouldn't inflate per-task counts.
    const grammarsPerTask = tasks.map(
      (task) => (task.recommendedGrammarIds ?? []).filter((id) => includedIds.has(id)).length,
    );
    const minPerTask = grammarsPerTask.length ? Math.min(...grammarsPerTask) : 0;
    const maxPerTask = grammarsPerTask.length ? Math.max(...grammarsPerTask) : 0;
    return {
      taskCount: tasks.length,
      includedColumnCount: columns.length,
      sectionCounts: sections.map((section) => ({ id: section.id, label: section.label, count: section.tasks.length })),
      minPerTask,
      maxPerTask,
    };
  }, [tasks, columns, sections]);

  if (error) {
    return (
      <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
        Could not load <code className="rounded bg-white px-1">benchmark/tasks.json</code>: {error}
        <p className="mt-2 text-xs text-rose-800">
          The Task Axes page expects <code>viewer/public/benchmark/tasks.json</code>, copied from
          the workspace by <code>viewer/scripts/prepare-static-data.mjs</code>. Re-run{' '}
          <code>npm run build</code> in <code>viewer/</code> (or <code>npm run dev</code>) to
          regenerate it.
        </p>
      </div>
    );
  }

  if (!tasks) {
    return <div className="text-sm text-slate-500">Loading task catalog…</div>;
  }

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Task Axes — every benchmark task × every grammar
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Companion to the Grammar Axes page. A filled dot means the task lists that grammar in{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">recommendedGrammarIds</code>
          {' '}— and therefore the runner will exercise that pair. Empty dots are the silent skips:{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">src/experiment.js</code> drops
          any (task, grammar) outside the recommended subset before the run starts, so they never
          appear in CLI output.
        </p>
      </header>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Tasks total" value={summary.taskCount} />
          <SummaryCard label="Grammars" value={summary.includedColumnCount} />
          <SummaryCard
            label="Per-task range"
            value={`${summary.minPerTask}–${summary.maxPerTask}`}
            hint="grammars recommended per task"
          />
          <SummaryCard
            label="Sections"
            value={summary.sectionCounts.map((s) => s.count).join(' / ')}
            hint={summary.sectionCounts.map((s) => s.label.replace(/^.* — /, '')).join(' / ')}
          />
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th
                  className="bg-white align-bottom"
                  style={{ width: TASK_LABEL_WIDTH, height: HEADER_HEIGHT }}
                />
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="relative align-bottom"
                    style={{ width: CELL_SIZE, minWidth: CELL_SIZE, height: HEADER_HEIGHT }}
                  >
                    <div
                      className="absolute whitespace-nowrap text-xs font-semibold text-slate-800"
                      style={{
                        bottom: 6,
                        left: '50%',
                        transformOrigin: 'left bottom',
                        transform: 'translateX(4px) rotate(-55deg)',
                      }}
                      title={`${column.label}: recommended by ${column.count} task(s).`}
                    >
                      {column.label}
                      <span className="ml-1 font-normal text-slate-400">
                        {column.count}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((section, sectionIndex) => (
                <SectionRows
                  key={section.id}
                  section={section}
                  columns={columns}
                  isFirst={sectionIndex === 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <p>
          <strong>Reading the column counts.</strong> The number after each grammar label is how
          many tasks currently list that grammar in{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">recommendedGrammarIds</code>. Vega
          sits near 41 because it is the broad-coverage backbone; the narrow grammars ({' '}
          <code>frappe</code>, <code>chartml</code>) trail far behind because their shipped
          vocabulary is bar / line / area plus a small number of extras.
        </p>
        <p>
          <strong>Vega-Lite gaps worth knowing about:</strong> T19 (Radar), T24 (Nightingale Rose),
          T31 (Sankey), and T32 (Tree Diagram) all leave the Vega-Lite cell empty. Vega-Lite has no
          native primitive for radar, sankey, or node-link tree layouts (those live only in lower-
          level Vega), and Nightingale Rose is technically constructible via an arc-mark workaround
          but the curators chose to exclude it as non-idiomatic.
        </p>
        <p>
          <strong>ChartML column, empirically measured:</strong> Every cell in the ChartML column
          comes from an actual <code>WasmChartML.renderToSvg</code> call against a candidate YAML
          spec, not from the (outdated) README. Built-in chart types that render from{' '}
          <code>@chartml/core</code> alone are bar, line, area, pie, doughnut, scatter, bubble,
          metric, and table — plus <code>annotations.trend</code> for reference lines (T16),
          <code>rows: {'{'} field, upper, lower {'}'}</code> for error bars (T26), and horizontal
          bar with negative values for population pyramids (T27). T14 and T15 (combo / dual-axis)
          are registered chart types but the marks-array YAML syntax is still being pinned down.
          Heatmap, radar, treemap, candlestick, sunburst, box-plot, and all view-composition tasks
          (T36–T41) return <code>"Unknown chart type"</code>. See{' '}
          <code>benchmark/chart-type-coverage.md</code> for the full per-task verdicts and
          the capability test harness.
        </p>
      </footer>
    </div>
  );
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

function SectionRows({ section, columns, isFirst }) {
  return (
    <>
      <tr>
        <td
          colSpan={columns.length + 1}
          className={
            'px-3 py-2 ' +
            (isFirst
              ? 'border-b border-slate-200 bg-slate-50'
              : 'border-t-2 border-b border-slate-300 bg-slate-50')
          }
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {section.label}
            <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
              · {section.tasks.length} task{section.tasks.length === 1 ? '' : 's'}
            </span>
          </div>
          {section.description ? (
            <div className="mt-0.5 text-[11px] font-normal text-slate-500">
              {section.description}
            </div>
          ) : null}
        </td>
      </tr>
      {section.tasks.map((task, taskIndex) => (
        <tr
          key={task.id}
          className={taskIndex === 0 ? '' : 'border-t border-slate-100'}
        >
          <td
            className="px-3 py-1.5 align-middle"
            style={{ width: TASK_LABEL_WIDTH }}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[12px] font-semibold text-slate-900">
                {task.id}
              </span>
              <span className="truncate text-[12px] text-slate-700">
                {task.title}
              </span>
              {task.viewCompositionRequired ? (
                <CompositionBadge operator={task.compositionOperator} />
              ) : null}
            </div>
            <div className="text-[11px] text-slate-500">
              <span className="font-mono">{task.chartFamily}</span>
              <span className="mx-1">·</span>
              <span>
                {(task.recommendedGrammarIds ?? []).filter((id) =>
                  INCLUDED_GRAMMARS.some((g) => g.id === id),
                ).length}{' '}
                grammar
                {(task.recommendedGrammarIds ?? []).filter((id) =>
                  INCLUDED_GRAMMARS.some((g) => g.id === id),
                ).length === 1
                  ? ''
                  : 's'}
              </span>
            </div>
          </td>
          {columns.map((column) => {
            const filled = (task.recommendedGrammarIds ?? []).includes(column.id);
            return (
              <td
                key={column.id}
                className="text-center align-middle"
                style={{ width: CELL_SIZE, minWidth: CELL_SIZE, height: CELL_SIZE }}
                title={`${task.id} × ${column.label}: ${filled ? 'recommended' : 'not recommended'}`}
              >
                <Dot filled={filled} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
