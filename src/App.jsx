import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';

import Dashboard from '@/pages/Dashboard.jsx';
import DetailView from '@/pages/DetailView.jsx';
import ErrorCategories from '@/pages/ErrorCategories.jsx';
import GrammarAxes from '@/pages/GrammarAxes.jsx';
import GridView from '@/pages/GridView.jsx';
import ReviewerView from '@/pages/ReviewerView.jsx';
import TaskAxes from '@/pages/TaskAxes.jsx';
import { buildViewerDataUrl, getRunDisplayName, listRuns } from '@/lib/data.js';
import { ViewerContext } from '@/lib/ViewerContext.jsx';

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const isReviewerRoute = location.pathname.startsWith('/reviewer');
  const requestedRunId = searchParams.get('runId');
  const [runId, setRunId] = useState(requestedRunId);
  const [availableRunIds, setAvailableRunIds] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const fetchedRunIds = await listRuns();
        // Default landing run is gemini (gemini-vegalite-smoke) when present,
        // otherwise fall back to whatever the index lists first.
        const DEFAULT_RUN_ID = 'gemini-vegalite-smoke';
        const fallbackRunId = fetchedRunIds.includes(DEFAULT_RUN_ID)
          ? DEFAULT_RUN_ID
          : fetchedRunIds[0];
        const nextRunId = requestedRunId ?? fallbackRunId ?? null;
        if (!active) {
          return;
        }

        setAvailableRunIds(fetchedRunIds);
        setRunId(nextRunId);

        if (!nextRunId) {
          setData(null);
          setError('No experiment runs found. Make sure the build includes results/experiment/*/viewer-data.json.');
          setLoading(false);
          return;
        }

        const response = await fetch(buildViewerDataUrl(nextRunId));
        if (!response.ok) {
          throw new Error(`Failed to load viewer-data.json for run "${nextRunId}" (${response.status})`);
        }

        const parsed = await response.json();
        if (active) {
          setData(parsed);
          setLoading(false);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [requestedRunId]);

  useEffect(() => {
    if (requestedRunId || !runId) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('runId', runId);
    setSearchParams(nextSearchParams, { replace: true });
  }, [requestedRunId, runId, searchParams, setSearchParams]);

  const contextValue = useMemo(
    () => ({
      runId,
      availableRunIds,
      data,
      loading,
      error,
    }),
    [runId, availableRunIds, data, loading, error],
  );

  const handleRunChange = (event) => {
    const nextRunId = event.target.value;
    if (!nextRunId || nextRunId === runId) {
      return;
    }
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('runId', nextRunId);
    setSearchParams(nextSearchParams, { replace: false });
  };

  const runOptions = useMemo(() => {
    const ids = [...availableRunIds];
    if (runId && !ids.includes(runId)) {
      ids.unshift(runId);
    }
    return ids;
  }, [availableRunIds, runId]);

  return (
    <ViewerContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-none items-center justify-between gap-4 px-3 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">"Where LLMs Fail with Visualization DSLs" Study Results</h1>
              {runOptions.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-medium uppercase tracking-wide text-slate-500">Run</span>
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    value={runId ?? ''}
                    onChange={handleRunChange}
                    disabled={runOptions.length <= 1}
                  >
                    {runOptions.map((id) => (
                      <option key={id} value={id}>
                        {getRunDisplayName(id)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <NavTabs search={window.location.search} pathname={location.pathname} />
          </div>
        </header>

        <main className={isReviewerRoute ? 'mx-auto w-full max-w-none p-3' : 'mx-auto max-w-7xl p-4'}>
          <Routes>
            {/* First-time visitors land on the Reviewer page. The Results,
                Summary, and Grammar Axes tabs are still reachable via their
                own routes, just no longer the default. */}
            <Route path="/" element={<Navigate to={`/reviewer${window.location.search}`} replace />} />
            <Route path="/results" element={<GridView />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/axes" element={<GrammarAxes />} />
            <Route path="/errors" element={<ErrorCategories />} />
            <Route path="/task-axes" element={<TaskAxes />} />
            <Route path="/reviewer" element={<ReviewerView />} />
            <Route path="/result/:index" element={<DetailView />} />
            <Route path="*" element={<Navigate to={`/reviewer${window.location.search}`} replace />} />
          </Routes>
        </main>
      </div>
    </ViewerContext.Provider>
  );
}

// Renders the top-of-page nav and highlights the link whose route matches the
// current pathname. Each entry's `match` is the prefix that should count as
// "this tab is active" — so /result/:index (the detail-view route) still
// reads as the Results tab being selected.
const NAV_ENTRIES = [
  { to: '/results', label: 'Results', match: ['/', '/results', '/result'] },
  { to: '/dashboard', label: 'Summary', match: ['/dashboard'] },
  { to: '/axes', label: 'Grammar Axes', match: ['/axes'] },
  { to: '/errors', label: 'Error Categories', match: ['/errors'] },
  { to: '/reviewer', label: 'Reviewer', match: ['/reviewer'] },
];

function NavTabs({ search, pathname }) {
  const isActive = (entry) => {
    return entry.match.some((prefix) => {
      if (prefix === '/') {
        return pathname === '/';
      }
      return pathname === prefix || pathname.startsWith(prefix + '/');
    });
  };

  return (
    <nav className="flex gap-1 text-sm font-medium">
      {NAV_ENTRIES.map((entry) => {
        const active = isActive(entry);
        return (
          <Link
            key={entry.to}
            to={`${entry.to}${search}`}
            aria-current={active ? 'page' : undefined}
            className={
              'rounded-md px-3 py-1.5 transition ' +
              (active
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900')
            }
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
