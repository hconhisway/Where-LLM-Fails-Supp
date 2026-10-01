import { useEffect, useMemo, useState } from 'react';

import FilterBar from '@/components/FilterBar.jsx';
import ResultCard from '@/components/ResultCard.jsx';
import { useViewerData } from '@/lib/ViewerContext.jsx';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export default function GridView() {
  const { data, loading, error } = useViewerData();
  const [mode, setMode] = useState('task');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedGrammarId, setSelectedGrammarId] = useState('');
  const [selectedCompareKeys, setSelectedCompareKeys] = useState([]);

  const taskOptions = useMemo(() => {
    if (!data) {
      return [];
    }

    const tasks = new Map();
    for (const result of data.results) {
      if (!result.taskId) {
        continue;
      }

      const existing = tasks.get(result.taskId) ?? {
        id: result.taskId,
        title: result.taskTitle ?? result.taskId,
        count: 0,
      };
      existing.count += 1;
      tasks.set(result.taskId, existing);
    }

    return [...tasks.values()].sort((left, right) => collator.compare(left.id, right.id));
  }, [data]);

  const grammarOptions = useMemo(() => {
    if (!data) {
      return [];
    }

    const grammars = new Map();
    for (const result of data.results) {
      if (!result.grammarId) {
        continue;
      }

      const existing = grammars.get(result.grammarId) ?? {
        id: result.grammarId,
        count: 0,
      };
      existing.count += 1;
      grammars.set(result.grammarId, existing);
    }

    return [...grammars.values()].sort((left, right) => collator.compare(left.id, right.id));
  }, [data]);

  useEffect(() => {
    if (!taskOptions.length) {
      setSelectedTaskId('');
      return;
    }

    const hasSelection = taskOptions.some((task) => task.id === selectedTaskId);
    if (!hasSelection) {
      // Prefer T2 as the landing task when no other selection is in effect.
      // If the run doesn't include T2, fall back to the first option so the
      // page still renders something.
      const preferred =
        taskOptions.find((task) => task.id === 'T2') ?? taskOptions[0];
      setSelectedTaskId(preferred.id);
    }
  }, [selectedTaskId, taskOptions]);

  useEffect(() => {
    if (!grammarOptions.length) {
      setSelectedGrammarId('');
      return;
    }

    const hasSelection = grammarOptions.some((grammar) => grammar.id === selectedGrammarId);
    if (!hasSelection) {
      setSelectedGrammarId(grammarOptions[0].id);
    }
  }, [grammarOptions, selectedGrammarId]);

  const filteredResults = useMemo(() => {
    if (!data) {
      return [];
    }

    const filtered = data.results.filter((result) => {
      if (mode === 'task') {
        return selectedTaskId ? result.taskId === selectedTaskId : false;
      }

      return selectedGrammarId ? result.grammarId === selectedGrammarId : false;
    });

    return [...filtered].sort((left, right) => {
      if (mode === 'task') {
        return (
          collator.compare(left.grammarId ?? '', right.grammarId ?? '') ||
          collator.compare(left.modelId ?? '', right.modelId ?? '')
        );
      }

      return (
        collator.compare(left.taskId ?? '', right.taskId ?? '') ||
        collator.compare(left.modelId ?? '', right.modelId ?? '')
      );
    });
  }, [data, mode, selectedGrammarId, selectedTaskId]);

  const compareOptions = useMemo(() => {
    const baseKey = mode === 'task' ? 'grammarId' : 'taskId';
    const duplicateCounts = new Map();

    for (const result of filteredResults) {
      const value = String(result[baseKey] ?? 'unknown');
      duplicateCounts.set(value, (duplicateCounts.get(value) ?? 0) + 1);
    }

    return filteredResults.map((result) => {
      const primaryValue = String(result[baseKey] ?? 'unknown');
      const isDuplicate = (duplicateCounts.get(primaryValue) ?? 0) > 1;

      return {
        key: getResultKey(result),
        label:
          mode === 'task'
            ? isDuplicate
              ? `${primaryValue} / ${result.modelId ?? 'unknown'}`
              : primaryValue
            : isDuplicate
              ? `${primaryValue} / ${result.modelId ?? 'unknown'}`
              : primaryValue,
        detail: mode === 'task' ? result.modelId ?? 'unknown model' : result.taskTitle ?? primaryValue,
        title:
          mode === 'task'
            ? `${primaryValue} / ${result.modelId ?? 'unknown'}`
            : `${primaryValue} / ${result.taskTitle ?? primaryValue}`,
      };
    });
  }, [filteredResults, mode]);

  useEffect(() => {
    const availableKeys = filteredResults.map(getResultKey);

    setSelectedCompareKeys((current) => {
      const next = current.filter((key) => availableKeys.includes(key));
      if (next.length === 0 && availableKeys.length > 0) {
        const fallback = availableKeys.slice(0, 2);
        return areArraysEqual(fallback, current) ? current : fallback;
      }
      return areArraysEqual(next, current) ? current : next;
    });
  }, [filteredResults]);

  const selectedResults = useMemo(() => {
    const resultMap = new Map(filteredResults.map((result) => [getResultKey(result), result]));
    return selectedCompareKeys.map((key) => resultMap.get(key)).filter(Boolean);
  }, [filteredResults, selectedCompareKeys]);

  const selectedTask = taskOptions.find((task) => task.id === selectedTaskId) ?? null;
  const selectedGrammar = grammarOptions.find((grammar) => grammar.id === selectedGrammarId) ?? null;
  const selectedCount = selectedResults.length;
  const compareGridStyle =
    selectedCount > 0
      ? {
          gridTemplateColumns: `repeat(${selectedCount}, minmax(0, 1fr))`,
        }
      : undefined;

  if (loading) {
    return <p className="text-sm text-slate-600">Loading viewer data...</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-600">No data found for this run.</p>;
  }

  return (
    <div className="space-y-5">
      <FilterBar
        mode={mode}
        onModeChange={(nextMode, value) => {
          setMode(nextMode);
          setSelectedCompareKeys([]);
          if (nextMode === 'task' && value) {
            setSelectedTaskId(value);
          }
          if (nextMode === 'grammar' && value) {
            setSelectedGrammarId(value);
          }
        }}
        taskOptions={taskOptions}
        grammarOptions={grammarOptions}
        selectedTaskId={selectedTaskId}
        selectedGrammarId={selectedGrammarId}
      />

      {!filteredResults.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          No available experiment results for the current selection.
        </div>
      ) : (
        <>
          <CompareSelectionPanel
            mode={mode}
            selectedTask={selectedTask}
            selectedGrammar={selectedGrammar}
            compareOptions={compareOptions}
            selectedKeys={selectedCompareKeys}
            onToggle={(key) => {
              setSelectedCompareKeys((current) => {
                const isSelected = current.includes(key);

                if (isSelected) {
                  return current.filter((item) => item !== key);
                }

                return [...current, key];
              });
            }}
          />

          {selectedCount > 0 ? (
            <div className="grid gap-5" style={compareGridStyle}>
              {selectedResults.map((result) => (
                <ResultCard key={getResultKey(result)} result={result} />
              ))}
            </div>
          ) : (
            <EmptyCompareState />
          )}
        </>
      )}
    </div>
  );
}

function CompareSelectionPanel({ mode, selectedTask, selectedGrammar, compareOptions, selectedKeys, onToggle }) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900">
            {mode === 'task'
              ? `Compare grammar results for ${selectedTask?.id ?? 'N/A'}${selectedTask ? ` - ${selectedTask.title}` : ''}`
              : `Compare task results for grammar ${selectedGrammar?.id ?? 'N/A'}`}
          </p>
          <p className="text-sm text-slate-600">
            Select any number of results to display side by side. Click again to deselect.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {selectedKeys.length} selected / {compareOptions.length} available
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {compareOptions.map((option) => {
          const active = selectedKeys.includes(option.key);

          return (
            <button
              key={option.key}
              type="button"
              title={option.title}
              onClick={() => onToggle(option.key)}
              className={`min-w-40 rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-slate-100'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className={`mt-1 block text-xs ${active ? 'text-slate-300' : 'text-slate-500'}`}>{option.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyCompareState() {
  return (
    <div className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div className="space-y-2">
        <p className="text-lg font-semibold text-slate-700">Select results to display</p>
        <p className="text-sm text-slate-500">Choose one or more buttons above to compare results side by side.</p>
      </div>
    </div>
  );
}

function getResultKey(result) {
  return result.recordPath ?? `${result.modelId ?? 'unknown'}-${result.grammarId ?? 'unknown'}-${result.taskId ?? 'unknown'}`;
}

function areArraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
