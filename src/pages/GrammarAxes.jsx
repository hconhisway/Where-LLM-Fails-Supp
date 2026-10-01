// Replication of Fig. 3 from McNutt (2022) "No Grammar to Rule Them All"
// Filtered to the 10 grammars included in benchmark/grammar-selection.md.
//
// Row axes and per-grammar dot values were extracted directly from the original
// Figure 3 bitmap (see scripts/extract-fig3.py). Each cell was then
// cross-validated against a per-column zoomed crop of the source figure.
// See the ChartML footnote at the bottom of the page for the naming caveat.

const GROUPS = [
  {
    id: 'domain',
    label: 'Domain',
    question: 'Why is this DSL necessary?',
    axes: [
      { id: 'charting', label: 'Charting', hint: 'Standard Statistical Graphics' },
      { id: 'chartType', label: 'Chart Type', hint: 'A particular chart type' },
      { id: 'interaction', label: 'Interaction', hint: 'A particular interaction' },
      { id: 'medium', label: 'Medium', hint: 'A particular task or context' },
    ],
  },
  {
    id: 'models',
    label: 'Models',
    question: 'What is this DSL?',
    axes: [
      { id: 'lowLevel', label: 'Low Level', hint: 'Close to the renderer' },
      { id: 'formalModel', label: 'Formal Model', hint: 'Pervasive Logical Structure' },
      { id: 'academic', label: 'Academic', hint: 'Originating in academic work' },
    ],
  },
  {
    id: 'affordances',
    label: 'Affordances',
    question: 'Who is the end-user?',
    axes: [
      { id: 'internalDsl', label: 'Internal DSL', hint: 'Roughly a library style' },
      { id: 'compiled', label: 'Compiled', hint: 'Code is generated' },
      { id: 'interpreted', label: 'Interpreted', hint: 'Code is evaluated' },
      { id: 'hasAbstraction', label: 'Has Abstraction', hint: 'Variables, Loops, or Control Flow' },
    ],
  },
  {
    id: 'practicalities',
    label: 'Practicalities',
    question: 'Where is work done?',
    axes: [
      { id: 'inGui', label: 'In GUI', hint: 'Part of an application' },
      { id: 'dataManip', label: 'Data manip.', hint: 'Can use filters or more' },
      { id: 'extensible', label: 'Extensible', hint: 'Externally' },
    ],
  },
];

// Grammars are listed in alphabetical order (matching the paper's convention
// on the column axis). Each entry captures the 14 axis values lifted from
// Fig. 3 in the order they appear, grouped by the categories above.
const GRAMMARS = [
  {
    id: 'apexcharts',
    label: 'ApexCharts',
    axes: {
      charting: 1, chartType: 0, interaction: 0, medium: 0,
      lowLevel: 0, formalModel: 0, academic: 0,
      internalDsl: 1, compiled: 0, interpreted: 0, hasAbstraction: 0,
      inGui: 0, dataManip: 0, extensible: 1,
    },
  },
  {
    id: 'chartjs',
    label: 'Chart.js',
    axes: {
      charting: 1, chartType: 0, interaction: 0, medium: 0,
      lowLevel: 0, formalModel: 0, academic: 0,
      internalDsl: 1, compiled: 0, interpreted: 0, hasAbstraction: 0,
      inGui: 0, dataManip: 0, extensible: 1,
    },
  },
  {
    id: 'chartml',
    label: 'ChartML',
    footnote: 1,
    // The "ChartML" in our included set is a modern project that shares the
    // name of McNutt (2022)'s ChartML row but does not share its design — so
    // none of these axes really apply. We render the column greyed out as a
    // visual reminder rather than dropping it (it's still a benchmarked
    // grammar elsewhere in the viewer).
    disabled: true,
    axes: {
      charting: 1, chartType: 0, interaction: 0, medium: 0,
      lowLevel: 0, formalModel: 0, academic: 0,
      internalDsl: 0, compiled: 1, interpreted: 0, hasAbstraction: 0,
      inGui: 0, dataManip: 0, extensible: 0,
    },
  },
  {
    id: 'echarts',
    label: 'ECharts',
    axes: {
      charting: 1, chartType: 0, interaction: 1, medium: 0,
      lowLevel: 0, formalModel: 0, academic: 0,
      internalDsl: 1, compiled: 0, interpreted: 0, hasAbstraction: 1,
      inGui: 0, dataManip: 1, extensible: 1,
    },
  },
  {
    id: 'frappe',
    label: 'Frappe',
    axes: {
      charting: 1, chartType: 0, interaction: 0, medium: 0,
      lowLevel: 0, formalModel: 0, academic: 0,
      internalDsl: 1, compiled: 0, interpreted: 0, hasAbstraction: 0,
      inGui: 0, dataManip: 0, extensible: 0,
    },
  },
  {
    id: 'highcharts',
    label: 'Highcharts',
    axes: {
      charting: 1, chartType: 0, interaction: 0, medium: 0,
      lowLevel: 0, formalModel: 0, academic: 0,
      internalDsl: 1, compiled: 0, interpreted: 0, hasAbstraction: 1,
      inGui: 0, dataManip: 0, extensible: 0,
    },
  },
  {
    id: 'plotly',
    label: 'Plotly JSON',
    axes: {
      charting: 1, chartType: 0, interaction: 0, medium: 0,
      lowLevel: 0, formalModel: 0, academic: 0,
      internalDsl: 0, compiled: 0, interpreted: 1, hasAbstraction: 0,
      inGui: 0, dataManip: 0, extensible: 0,
    },
  },
  {
    id: 'vega',
    label: 'Vega',
    axes: {
      charting: 1, chartType: 0, interaction: 1, medium: 0,
      lowLevel: 1, formalModel: 1, academic: 1,
      internalDsl: 0, compiled: 0, interpreted: 1, hasAbstraction: 1,
      inGui: 0, dataManip: 1, extensible: 1,
    },
  },
  {
    id: 'vegalite',
    label: 'Vega-Lite',
    axes: {
      charting: 1, chartType: 0, interaction: 1, medium: 0,
      lowLevel: 1, formalModel: 1, academic: 1,
      internalDsl: 0, compiled: 1, interpreted: 0, hasAbstraction: 1,
      inGui: 0, dataManip: 1, extensible: 1,
    },
  },
  {
    id: 'zingchart',
    label: 'ZingChart',
    axes: {
      charting: 1, chartType: 0, interaction: 1, medium: 0,
      lowLevel: 0, formalModel: 0, academic: 0,
      internalDsl: 1, compiled: 0, interpreted: 0, hasAbstraction: 1,
      inGui: 0, dataManip: 1, extensible: 0,
    },
  },
];

// Cell geometry — single source of truth so the rotated-header slot and the
// matrix columns stay aligned.
const CELL_SIZE = 40; // px, square cells for the dot matrix
const AXIS_COL_WIDTH = 220; // px for the left-hand axis-label column
const HEADER_HEIGHT = 140; // px reserved for the rotated column labels

function Dot({ filled, disabled }) {
  // Disabled columns (e.g. ChartML, which shares a name with McNutt 2022's
  // unrelated row) render as a uniform light-grey dot so the column reads as
  // "not applicable" without changing the table shape.
  let classes;
  if (disabled) {
    classes = 'inline-block h-2.5 w-2.5 rounded-full bg-slate-200 opacity-60';
  } else if (filled) {
    classes = 'inline-block h-2.5 w-2.5 rounded-full bg-slate-900';
  } else {
    classes = 'inline-block h-2.5 w-2.5 rounded-full bg-slate-200';
  }
  return <span className={classes} aria-hidden="true" />;
}

export default function GrammarAxes() {
  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Grammar Axes — replica of McNutt 2022, Fig. 3
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Axes-by-grammar matrix from{' '}
          <a
            className="text-sky-700 underline hover:text-sky-900"
            href="https://arxiv.org/abs/2207.07998"
            target="_blank"
            rel="noreferrer noopener"
          >
            McNutt (2022), <em>No Grammar to Rule Them All</em>
          </a>
          , filtered to the 10 grammars in{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            benchmark/grammar-selection.md
          </code>
          . A filled dot means the grammar exhibits that axis.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table
            className="border-collapse text-sm"
            style={{ borderSpacing: 0 }}
          >
            <thead>
              <tr>
                <th
                  className="bg-white align-bottom"
                  style={{
                    width: AXIS_COL_WIDTH,
                    height: HEADER_HEIGHT,
                  }}
                />
                {GRAMMARS.map((grammar) => (
                  <th
                    key={grammar.id}
                    className="relative align-bottom"
                    style={{
                      width: CELL_SIZE,
                      minWidth: CELL_SIZE,
                      height: HEADER_HEIGHT,
                    }}
                  >
                    <div
                      className={
                        'absolute whitespace-nowrap text-xs font-semibold ' +
                        (grammar.disabled ? 'text-slate-400 italic' : 'text-slate-800')
                      }
                      style={{
                        bottom: 6,
                        left: '50%',
                        transformOrigin: 'left bottom',
                        transform: 'translateX(4px) rotate(-55deg)',
                      }}
                    >
                      {grammar.label}
                      {grammar.footnote ? (
                        <sup className="ml-0.5 text-sky-700">{grammar.footnote}</sup>
                      ) : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group, groupIndex) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  isFirst={groupIndex === 0}
                  grammars={GRAMMARS}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <p>
          <sup className="text-sky-700">1</sup> <strong>ChartML</strong>: the row above uses
          the values encoded for <em>ChartML</em> in McNutt (2022), Fig. 3, which references
          the 2009 Saito XML grammar. The &ldquo;ChartML&rdquo; in our included set is a
          different, modern project (
          <a
            className="text-sky-700 underline hover:text-sky-900"
            href="https://github.com/chartml/chartml"
            target="_blank"
            rel="noreferrer noopener"
          >
            chartml/chartml
          </a>
          , 2025) that shares the name.
        </p>
      </footer>
    </div>
  );
}

function GroupSection({ group, isFirst, grammars }) {
  return (
    <>
      <tr>
        <td
          colSpan={grammars.length + 1}
          className={
            'px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ' +
            (isFirst
              ? 'border-b border-slate-200 bg-slate-50'
              : 'border-t-2 border-b border-slate-300 bg-slate-50')
          }
        >
          {group.label}
          <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
            · {group.question}
          </span>
        </td>
      </tr>
      {group.axes.map((axis, axisIndex) => (
        <tr
          key={axis.id}
          className={axisIndex === 0 ? '' : 'border-t border-slate-100'}
        >
          <td
            className="px-3 py-1.5 align-middle"
            style={{ width: AXIS_COL_WIDTH }}
          >
            <div className="text-[13px] font-medium text-slate-900">
              {axis.label}
            </div>
            <div className="text-[11px] text-slate-500">{axis.hint}</div>
          </td>
          {grammars.map((grammar) => {
            const filled = Boolean(grammar.axes[axis.id]);
            const disabled = Boolean(grammar.disabled);
            return (
              <td
                key={grammar.id}
                className={
                  'text-center align-middle ' + (disabled ? 'bg-slate-50' : '')
                }
                style={{
                  width: CELL_SIZE,
                  minWidth: CELL_SIZE,
                  height: CELL_SIZE,
                }}
                title={
                  disabled
                    ? `${grammar.label}: axes not applicable (see footnote)`
                    : `${grammar.label}: ${axis.label} ${filled ? '✓' : '—'}`
                }
              >
                <Dot filled={filled} disabled={disabled} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
