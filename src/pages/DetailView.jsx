import { Link, useLocation, useParams } from 'react-router-dom';

import ImagePanel from '@/components/ImagePanel.jsx';
import JsonPanel from '@/components/JsonPanel.jsx';
import PromptPanel from '@/components/PromptPanel.jsx';
import { useViewerData } from '@/lib/ViewerContext.jsx';

export default function DetailView() {
  const { data, loading, error } = useViewerData();
  const { index } = useParams();
  const location = useLocation();

  if (loading) {
    return <p className="text-sm text-slate-600">Loading viewer data...</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-600">No data available.</p>;
  }

  const activeIndex = Number(index);
  const allowedIndices = Array.isArray(location.state?.indices)
    ? location.state.indices.filter((item) => Number.isInteger(item))
    : data.results.map((_, i) => i);

  const activePosition = allowedIndices.indexOf(activeIndex);
  const previousIndex = activePosition > 0 ? allowedIndices[activePosition - 1] : null;
  const nextIndex = activePosition >= 0 && activePosition < allowedIndices.length - 1 ? allowedIndices[activePosition + 1] : null;
  const result = data.results[activeIndex];

  if (!result) {
    return <p className="text-sm text-rose-700">Result index "{index}" does not exist.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{result.taskTitle}</h2>
            <p className="text-sm text-slate-600">
              {result.taskId} / {result.modelId} / {result.grammarId} / {result.difficulty}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/results${location.search}`} className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700">
              Back to Results
            </Link>
            <NavButton index={previousIndex} search={location.search} state={location.state}>
              Prev
            </NavButton>
            <NavButton index={nextIndex} search={location.search} state={location.state}>
              Next
            </NavButton>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PromptPanel prompt={result.prompt} />
        <ImagePanel result={result} />
        <JsonPanel result={result} />
      </div>
    </div>
  );
}

function NavButton({ index, search, state, children }) {
  if (typeof index !== 'number') {
    return <span className="rounded border border-slate-200 px-3 py-2 text-sm text-slate-400">{children}</span>;
  }

  return (
    <Link to={`/result/${index}${search}`} state={state} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
      {children}
    </Link>
  );
}
