import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import RubricForm from '@/components/RubricForm.jsx';
import { buildImageUrl, getRunDisplayName } from '@/lib/data.js';
import {
  appendReviewToHandle,
  appendReviewToServer,
  buildReviewIndex,
  clearDraft,
  createEmptyReview,
  downloadJsonl,
  fetchRunReviews,
  getLastReviewer,
  getStoredFileHandle,
  hasFileSystemAccess,
  isReviewComplete,
  loadDraft,
  loadFallbackReviews,
  mergeReviewLists,
  pickReviewsFile,
  probeServerWriteApi,
  putStoredFileHandle,
  queryHandlePermission,
  readReviewsFromHandle,
  requestHandlePermission,
  rewriteReviewsToHandle,
  rewriteReviewsToServer,
  saveDraft,
  saveFallbackReviews,
  setLastReviewer,
} from '@/lib/reviews.js';
import { RUBRIC_ITEM_CODES, SCORE_VALUES, isNaScore } from '@/lib/rubric.js';
import { useViewerData } from '@/lib/ViewerContext.jsx';

function caseIdOf(result) {
  return (
    result?.recordPath ??
    `${result?.modelId ?? 'unknown'}/${result?.grammarId ?? 'unknown'}/${result?.taskId ?? 'unknown'}`
  );
}

function findFirstUnratedIndex(results, reviewIndex, startAfter = -1) {
  for (let i = startAfter + 1; i < results.length; i += 1) {
    const review = reviewIndex.get(caseIdOf(results[i]));
    if (!review || !isReviewComplete(review)) {
      return i;
    }
  }
  return -1;
}

export default function ReviewerView() {
  const { data, loading, error, runId } = useViewerData();

  // The reviewer page rates what the reviewer can actually see. Cases where
  // the chart failed to render have no image to judge against, so hide them
  // from the case list, dropdown, and counts. Other views (Grid, Detail,
  // Dashboard) still show every case so render failures remain inspectable.
  const results = useMemo(
    () => (data?.results ?? []).filter((r) => r?.renderSuccess !== false),
    [data],
  );

  const [reviewer, setReviewerState] = useState(() => getLastReviewer());
  const [fileHandle, setFileHandle] = useState(null);
  const [fileHandleName, setFileHandleName] = useState(null);
  // A handle recovered from IndexedDB that the browser hasn't re-granted
  // permission to yet. We render a "Reconnect" button for it.
  const [pendingHandle, setPendingHandle] = useState(null);
  const [persistedReviews, setPersistedReviews] = useState([]); // loaded from file (or fallback)
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  // Track whether we've seeded the default-landing case for the current run.
  // Reset whenever runId changes so switching runs re-applies the default.
  const defaultedForRunRef = useRef(null);

  // When results first load (or runId changes), prefer landing on T19 / Plotly
  // — that's the canonical "show this off" case the team uses. Only seed
  // once per run so navigating with the case dropdown doesn't snap back.
  useEffect(() => {
    if (!results.length) {
      return;
    }
    if (defaultedForRunRef.current === runId) {
      return;
    }
    defaultedForRunRef.current = runId;
    const preferredIndex = results.findIndex(
      (r) => r?.taskId === 'T19' && (r?.grammarId ?? '').toLowerCase() === 'plotly',
    );
    if (preferredIndex >= 0) {
      setActiveIndex(preferredIndex);
    } else {
      setActiveIndex(0);
    }
  }, [results, runId]);
  const [review, setReview] = useState(() => createEmptyReview());
  const [statusMessage, setStatusMessage] = useState('');
  const [fatalError, setFatalError] = useState(null);
  // Whether the dev-server write API is reachable. When true, Save writes
  // directly to results/experiment/<runId>/reviews.jsonl without needing the
  // FSA file picker. Probed once on mount.
  const [serverWriteAvailable, setServerWriteAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    probeServerWriteApi().then((ok) => {
      if (!cancelled) {
        setServerWriteAvailable(ok);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Draft-saving is meant to capture *user edits*. Programmatic setReview
  // calls (seeding a case, reset, post-save auto-advance) should not create
  // phantom drafts that would later shadow the persisted review. We set this
  // ref before those calls so the next draft-save tick is skipped.
  const skipNextDraftSaveRef = useRef(false);

  const activeResult = results[activeIndex] ?? null;
  const activeCaseId = activeResult ? caseIdOf(activeResult) : '';
  const imageUrl = activeResult ? buildImageUrl(activeResult.imagePath) : null;

  // Per-reviewer index — used only for form seeding and the "saved review for
  // this case" lookup, so the current reviewer doesn't accidentally overwrite
  // somebody else's record when they save.
  const ownReviewIndex = useMemo(
    () => buildReviewIndex(persistedReviews, { reviewer: reviewer || undefined }),
    [persistedReviews, reviewer],
  );

  // All-reviewer index — used for display (✓ markers in the case dropdown,
  // the "N / M reviewed" counter, "Next unrated" navigation). This means
  // reviews loaded from the run-dir reviews.jsonl (e.g. a shared set of
  // pre-written ratings authored by someone else) show up even if the
  // current reviewer name doesn't match the authors.
  const reviewIndex = useMemo(
    () => buildReviewIndex(persistedReviews),
    [persistedReviews],
  );

  // Bind a file handle, load its contents, merge with the localStorage cache
  // (so any reviews saved while the file was disconnected get flushed back to
  // disk), and publish the merged list to state + cache.
  const bindAndLoadHandle = useCallback(
    async (handle) => {
      if (!handle || !runId) {
        return 0;
      }
      const fileReviews = await readReviewsFromHandle(handle);
      const cached = loadFallbackReviews(runId);
      const merged = mergeReviewLists(fileReviews, cached);
      if (merged.length > fileReviews.length) {
        // Cache had reviews the file didn't — write them back so the file is
        // the source of truth again.
        await rewriteReviewsToHandle(handle, merged);
      }
      setFileHandle(handle);
      setFileHandleName(handle.name ?? 'reviews.jsonl');
      setPersistedReviews(merged);
      saveFallbackReviews(runId, merged);
      setPendingHandle(null);
      return merged.length;
    },
    [runId],
  );

  // On mount / runId change:
  //   1) Always hydrate persistedReviews from localStorage so refresh never
  //      shows an empty UI, regardless of browser.
  //   2) Try to auto-load reviews.jsonl from the run directory (served
  //      statically next to viewer-data.json). This lets reviews committed
  //      with the run show up without anyone picking a file. Merge with the
  //      localStorage cache so local drafts aren't lost.
  //   3) If the File System Access API is available, try to recover the
  //      previously-picked handle from IndexedDB. If the browser still has
  //      permission, silently rebind; otherwise surface a Reconnect button.
  useEffect(() => {
    if (!runId) {
      return undefined;
    }
    const cached = loadFallbackReviews(runId);
    setPersistedReviews(cached);

    let cancelled = false;
    (async () => {
      // (2) Auto-fetch the run-dir reviews.jsonl (read-only). 404 returns [].
      const runDirReviews = await fetchRunReviews(runId);
      if (cancelled) {
        return;
      }
      if (runDirReviews.length > 0) {
        const merged = mergeReviewLists(runDirReviews, cached);
        setPersistedReviews(merged);
        // Don't rewrite the run-dir file (it's read-only over fetch); just
        // mirror into localStorage so reloads are instant and offline-safe.
        saveFallbackReviews(runId, merged);
      }

      // (3) Try to recover a previously-bound file handle.
      if (!hasFileSystemAccess) {
        return;
      }
      const handle = await getStoredFileHandle(runId);
      if (cancelled || !handle) {
        return;
      }
      const permission = await queryHandlePermission(handle, { mode: 'readwrite' });
      if (cancelled) {
        return;
      }
      if (permission === 'granted') {
        try {
          await bindAndLoadHandle(handle);
        } catch (error) {
          if (!cancelled) {
            setFatalError(error.message || String(error));
          }
        }
      } else {
        // Permission needs a user gesture — remember the handle and prompt
        // via the Reconnect button.
        setPendingHandle(handle);
        setFileHandleName(handle.name ?? 'reviews.jsonl');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, bindAndLoadHandle]);

  // When the active case or reviewer changes, load the saved review or draft.
  useEffect(() => {
    if (!activeResult || !runId) {
      return;
    }
    // Seed the form from the *current reviewer's* record if they've rated
    // this case before. Fall back to any reviewer's record (e.g. the
    // autograder running under a different name) so rubric-v2 rows
    // pre-written by a teammate show up in the form for audit instead of
    // displaying as empty. Saving from this form writes a fresh row under
    // the current reviewer name — it appends, it doesn't overwrite the
    // teammate's row on disk.
    const ownExisting = ownReviewIndex.get(activeCaseId);
    const anyExisting = ownExisting ?? reviewIndex.get(activeCaseId);
    const draft = loadDraft({ runId, reviewer, caseId: activeCaseId });
    // Prefer a complete persisted review over a potentially-stale draft —
    // e.g. a rubric v1 draft (5 items) left in localStorage would otherwise
    // shadow a complete v2 row and display as "Save (5/11)".
    const seed = (anyExisting && isReviewComplete(anyExisting))
      ? anyExisting
      : (draft ?? anyExisting ?? createEmptyReview({ runId, caseId: activeCaseId, reviewer }));
    // This is a programmatic seed — do not let the draft-saving effect
    // immediately write this back as a "user edit".
    skipNextDraftSaveRef.current = true;
    setReview({
      ...createEmptyReview({ runId, caseId: activeCaseId, reviewer }),
      ...seed,
      runId,
      caseId: activeCaseId,
      reviewer: seed.reviewer || reviewer,
      grammarId: activeResult.grammarId ?? seed.grammarId ?? null,
      modelId: activeResult.modelId ?? seed.modelId ?? null,
      taskId: activeResult.taskId ?? seed.taskId ?? null,
      ratings: {
        ...createEmptyReview().ratings,
        ...(seed.ratings ?? {}),
      },
    });
    setStatusMessage('');
    // We intentionally depend on caseId and reviewer rather than `review` itself
    // to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCaseId, runId, reviewer, ownReviewIndex, reviewIndex]);

  // Persist drafts on changes — but only for real user edits. Programmatic
  // seeding/reset sets skipNextDraftSaveRef so the corresponding effect tick
  // bails out (see comment on the ref above).
  useEffect(() => {
    if (!review?.caseId || !review?.runId) {
      return;
    }
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }
    saveDraft(review);
  }, [review]);

  const setReviewer = useCallback((next) => {
    setReviewerState(next);
    setLastReviewer(next);
  }, []);

  const updateRating = useCallback((code, patch) => {
    setReview((current) => {
      const existing = current.ratings?.[code] ?? { score: null, notes: '' };
      return {
        ...current,
        ratings: {
          ...current.ratings,
          [code]: { ...existing, ...patch },
        },
      };
    });
  }, []);

  const handleScoreChange = useCallback(
    (code, score) => {
      if (!SCORE_VALUES.includes(score)) {
        return;
      }
      updateRating(code, { score });
    },
    [updateRating],
  );

  const handleNotesChange = useCallback(
    (code, notes) => updateRating(code, { notes }),
    [updateRating],
  );

  const handleOverallCommentChange = useCallback(
    (value) => setReview((current) => ({ ...current, overallComment: value })),
    [],
  );

  const handleFlaggedChange = useCallback(
    (flagged) => setReview((current) => ({ ...current, flagged })),
    [],
  );

  const goTo = useCallback(
    (index) => {
      if (index < 0 || index >= results.length) {
        return;
      }
      setActiveIndex(index);
    },
    [results.length],
  );

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  const handlePickFile = useCallback(async () => {
    try {
      const handle = await pickReviewsFile({
        suggestedName: runId ? `reviews-${runId}.jsonl` : 'reviews.jsonl',
      });
      await putStoredFileHandle(runId, handle);
      const count = await bindAndLoadHandle(handle);
      setStatusMessage(`Loaded ${count} existing reviews from ${handle.name ?? 'file'}.`);
    } catch (pickError) {
      if (pickError?.name === 'AbortError') {
        return;
      }
      setFatalError(pickError.message || String(pickError));
    }
  }, [runId, bindAndLoadHandle]);

  const handleReconnect = useCallback(async () => {
    if (!pendingHandle) {
      return;
    }
    try {
      const permission = await requestHandlePermission(pendingHandle, { mode: 'readwrite' });
      if (permission !== 'granted') {
        setStatusMessage('Permission denied. You can pick the file again.');
        return;
      }
      const count = await bindAndLoadHandle(pendingHandle);
      setStatusMessage(`Reconnected to ${pendingHandle.name ?? 'file'} — ${count} reviews loaded.`);
    } catch (error) {
      setFatalError(error.message || String(error));
    }
  }, [pendingHandle, bindAndLoadHandle]);

  const handleSave = useCallback(async () => {
    if (!activeResult) {
      return;
    }
    if (!isReviewComplete(review)) {
      setStatusMessage('All items need a score, and any non-Pass score needs a note.');
      return;
    }
    if (!reviewer.trim()) {
      setStatusMessage('Please enter a reviewer name first.');
      return;
    }

    const finalReview = {
      ...review,
      reviewer: reviewer.trim(),
      timestamp: new Date().toISOString(),
      grammarId: activeResult.grammarId ?? null,
      modelId: activeResult.modelId ?? null,
      taskId: activeResult.taskId ?? null,
    };

    try {
      const next = [...persistedReviews, finalReview];
      // Preferred path: the dev-server write API. It writes the canonical
      // results/experiment/<runId>/reviews.jsonl AND mirrors into the
      // viewer/public copy in one round-trip — no FSA picker needed.
      let savedVia = null;
      if (serverWriteAvailable && runId) {
        await appendReviewToServer(runId, finalReview);
        savedVia = 'server';
      } else if (fileHandle) {
        await appendReviewToHandle(fileHandle, finalReview);
        savedVia = 'fsa';
      }
      // Always mirror to localStorage so a page refresh — even with the file
      // disconnected or permission revoked — restores the full review list.
      saveFallbackReviews(runId, next);
      setPersistedReviews(next);
      clearDraft({ runId, reviewer, caseId: finalReview.caseId });

      const time = new Date(finalReview.timestamp).toLocaleTimeString();
      let savedToFileNote;
      if (savedVia === 'server') {
        savedToFileNote = ` → results/experiment/${runId}/reviews.jsonl`;
      } else if (savedVia === 'fsa') {
        savedToFileNote = ` → ${fileHandleName ?? 'reviews.jsonl'}`;
      } else if (pendingHandle) {
        savedToFileNote = ' (browser storage only — reconnect the file to flush to disk)';
      } else {
        savedToFileNote = ' (browser storage only — start the dev server or pick a file to write to disk)';
      }
      setStatusMessage(`Saved at ${time}.${savedToFileNote}`);

      if (autoAdvance) {
        const nextIndex = findFirstUnratedIndex(
          results,
          buildReviewIndex(next, { reviewer: reviewer.trim() || undefined }),
          activeIndex,
        );
        if (nextIndex >= 0) {
          setActiveIndex(nextIndex);
        } else {
          setStatusMessage(`Saved. No more unrated cases.${savedToFileNote}`);
        }
      }
    } catch (saveError) {
      setFatalError(saveError.message || String(saveError));
    }
  }, [
    activeIndex,
    activeResult,
    autoAdvance,
    fileHandle,
    fileHandleName,
    pendingHandle,
    persistedReviews,
    results,
    review,
    reviewer,
    runId,
    serverWriteAvailable,
  ]);

  const handleReset = useCallback(async () => {
    if (!activeResult || !runId) {
      return;
    }

    // Figure out which saved records belong to this case + the current
    // reviewer. Only the current reviewer's records are touched — other
    // reviewers' work stays intact.
    const currentReviewer = reviewer.trim();
    const matches = currentReviewer
      ? (r) => r?.caseId === activeCaseId && r?.reviewer === currentReviewer
      : () => false;
    const removed = persistedReviews.filter(matches);
    const remaining = persistedReviews.filter((r) => !matches(r));
    const hadSaved = removed.length > 0;

    // If we'd be deleting something but the file is in the "disconnected"
    // state, bail early and tell the user to reconnect first. Otherwise
    // bindAndLoadHandle would later merge the on-disk copy back in and
    // silently resurrect the record we just "deleted".
    if (hadSaved && pendingHandle && !fileHandle) {
      setStatusMessage(
        'Saved review for this case is still on disk. Click "Reconnect" above, then press Reset again to also remove it from the file.',
      );
      return;
    }

    clearDraft({ runId, reviewer, caseId: activeCaseId });

    if (hadSaved) {
      try {
        // Same priority order as Save: server API first, then FSA handle.
        if (serverWriteAvailable && runId) {
          await rewriteReviewsToServer(runId, remaining);
        } else if (fileHandle) {
          // Rewrite the JSONL file with our records removed.
          await rewriteReviewsToHandle(fileHandle, remaining);
        }
        saveFallbackReviews(runId, remaining);
        setPersistedReviews(remaining);
      } catch (error) {
        setFatalError(error.message || String(error));
        return;
      }
    }

    skipNextDraftSaveRef.current = true;
    setReview({
      ...createEmptyReview({ runId, caseId: activeCaseId, reviewer }),
      grammarId: activeResult.grammarId ?? null,
      modelId: activeResult.modelId ?? null,
      taskId: activeResult.taskId ?? null,
    });

    if (hadSaved) {
      const plural = removed.length === 1 ? '' : 's';
      let where;
      if (serverWriteAvailable && runId) {
        where = `disk (results/experiment/${runId}/reviews.jsonl)`;
      } else if (fileHandle) {
        where = 'disk';
      } else {
        where = 'cache';
      }
      setStatusMessage(`Cleared form and deleted ${removed.length} saved review${plural} from ${where}.`);
    } else {
      setStatusMessage('Form cleared.');
    }
  }, [
    activeCaseId,
    activeResult,
    fileHandle,
    pendingHandle,
    persistedReviews,
    reviewer,
    runId,
    serverWriteAvailable,
  ]);

  const handleExport = useCallback(() => {
    downloadJsonl(persistedReviews, runId ? `reviews-${runId}.jsonl` : 'reviews.jsonl');
  }, [persistedReviews, runId]);

  const handleJumpToNextUnrated = useCallback(() => {
    const next = findFirstUnratedIndex(results, reviewIndex, activeIndex);
    if (next >= 0) {
      setActiveIndex(next);
    } else {
      setStatusMessage('No more unrated cases.');
    }
  }, [activeIndex, results, reviewIndex]);

  // Keyboard: Ctrl/Cmd+S to save; the rest lives in the form. In the
  // read-only build below, the keyboard handler is intentionally left a
  // no-op (preventDefault only) so the browser's "save page" dialog doesn't
  // pop up — the read-only-notice alert is wired through the visible Save
  // button instead.
  useEffect(() => {
    function handler(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        if (typeof window !== 'undefined') {
          window.alert(
            'This viewer is in read-only mode. Saving, resetting, and exporting reviews are disabled.',
          );
        }
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading viewer data...</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-600">No data available.</p>;
  }
  if (!results.length) {
    return <p className="text-sm text-slate-600">No cases found in this run.</p>;
  }

  const completed = RUBRIC_ITEM_CODES.every((code) => {
    const rating = review.ratings?.[code];
    return rating && SCORE_VALUES.includes(rating.score) && (rating.score === 'pass' || isNaScore(rating.score) || rating.notes.trim());
  });

  // Read-only mode: this build of the viewer is shipped to external readers,
  // so Save / Reset / Export should pop a reminder instead of mutating the
  // baked-in reviews. We still render the buttons so the page looks the same
  // as the editing tool reviewers are familiar with.
  const READ_ONLY_NOTICE =
    'This viewer is in read-only mode. Saving, resetting, and exporting reviews are disabled.';
  const showReadOnlyNotice = () => {
    if (typeof window !== 'undefined') {
      window.alert(READ_ONLY_NOTICE);
    }
  };
  const saveDisabledReason = null;

  const totalRated = reviewIndex.size;

  return (
    <div className="flex flex-col gap-3 md:h-[calc(100vh-5.5rem)] md:overflow-hidden">
      <TopBar
        runId={runId}
        activeIndex={activeIndex}
        results={results}
        reviewIndex={reviewIndex}
        onChange={setActiveIndex}
        onJumpUnrated={handleJumpToNextUnrated}
        onExport={showReadOnlyNotice}
        onPickFile={handlePickFile}
        onReconnect={handleReconnect}
        fileHandle={fileHandle}
        pendingHandle={pendingHandle}
        fileHandleName={fileHandleName}
        totalRated={totalRated}
        serverWriteAvailable={serverWriteAvailable}
      />

      {fatalError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {fatalError}
          <button
            type="button"
            onClick={() => setFatalError(null)}
            className="ml-3 text-xs underline"
          >
            dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[minmax(320px,1fr)_minmax(420px,560px)]">
        <ChartPane result={activeResult} imageUrl={imageUrl} />
        <div className="max-h-[70vh] min-h-0 overflow-y-auto pr-1 md:h-full md:max-h-none">
          <RubricForm
            review={review}
            onScoreChange={handleScoreChange}
            onNotesChange={handleNotesChange}
            onReviewerChange={setReviewer}
            onOverallCommentChange={handleOverallCommentChange}
            onFlaggedChange={handleFlaggedChange}
            onSave={showReadOnlyNotice}
            onReset={showReadOnlyNotice}
            promptText={activeResult?.prompt}
            saveDisabledReason={saveDisabledReason}
            statusMessage={statusMessage}
            autoAdvance={autoAdvance}
            onAutoAdvanceChange={setAutoAdvance}
            onPrev={goPrev}
            onNext={goNext}
            hasPrev={activeIndex > 0}
            hasNext={activeIndex < results.length - 1}
          />
        </div>
      </div>
    </div>
  );
}

function ChartPane({ result, imageUrl }) {
  if (!result) {
    return null;
  }
  return (
    <section className="flex h-[55vh] min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:h-full">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{result.taskId}</p>
          <p className="text-xs text-slate-500">
            grammar: {result.grammarId ?? 'unknown'} · model: {result.modelId ?? 'unknown'}
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          <Tag ok={result.jsonValid}>JSON</Tag>
          <Tag ok={result.renderSuccess}>Render</Tag>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${result.taskId} render`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="px-4 py-6 text-center text-sm text-rose-700">
            Render failed: {result.renderError ?? 'Unknown error'}
          </div>
        )}
      </div>
    </section>
  );
}

function Tag({ ok, children }) {
  return (
    <span
      className={`rounded px-2 py-0.5 font-medium ${
        ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}
    >
      {children}
    </span>
  );
}

function TopBar({
  runId,
  activeIndex,
  results,
  reviewIndex,
  onChange,
  onJumpUnrated,
  onExport,
  onPickFile,
  onReconnect,
  fileHandle,
  pendingHandle,
  fileHandleName,
  totalRated,
  serverWriteAvailable,
}) {
  const activeResult = results[activeIndex];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-slate-500">Run {getRunDisplayName(runId) || '—'}</span>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">
            Case
            <select
              value={activeIndex}
              onChange={(event) => onChange(Number(event.target.value))}
              className="ml-2 max-w-xs rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              {results.map((result, index) => {
                const rated = reviewIndex.has(caseIdOf(result));
                return (
                  <option key={caseIdOf(result)} value={index}>
                    {rated ? '✓ ' : '• '}
                    {index + 1}. {result.taskId} / {result.grammarId} / {result.modelId}
                  </option>
                );
              })}
            </select>
          </label>
          <span className="text-xs text-slate-500">
            {activeIndex + 1} / {results.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onJumpUnrated}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400"
        >
          Next unrated
        </button>

        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-500">
          review complete
          {serverWriteAvailable && runId ? (
            <span
              className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800"
              title={`Save writes directly to results/experiment/${runId}/reviews.jsonl`}
            >
              auto-saving → results/experiment/{runId}/reviews.jsonl
            </span>
          ) : fileHandle ? (
            <span className="rounded bg-slate-100 px-2 py-0.5">file: {fileHandleName}</span>
          ) : pendingHandle ? (
            <span className="flex items-center gap-1">
              <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                file: {fileHandleName} — disconnected
              </span>
              <button
                type="button"
                onClick={onReconnect}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:border-amber-400"
              >
                Reconnect
              </button>
            </span>
          ) : hasFileSystemAccess ? (
            <button
              type="button"
              onClick={onPickFile}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-400"
            >
              Choose reviews.jsonl...
            </button>
          ) : (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
              file-save unavailable — using browser storage
            </span>
          )}
          <button
            type="button"
            onClick={onExport}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-400"
          >
            Export JSONL
          </button>
        </span>
      </div>

      {activeResult ? (
        <p className="mt-2 text-xs text-slate-500">
          {activeResult.taskTitle ?? ''}
        </p>
      ) : null}
    </div>
  );
}
