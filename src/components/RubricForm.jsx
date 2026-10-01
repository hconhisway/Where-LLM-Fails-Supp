import { useEffect, useMemo, useRef } from 'react';

import { RUBRIC_SECTIONS, SCORE_OPTIONS, isNaScore } from '@/lib/rubric.js';
import { getCompletedItemCount, isReviewComplete } from '@/lib/reviews.js';

// RubricForm renders the scoring form for a single case. The parent owns the
// review state and receives updates via the provided callbacks; this keeps the
// form itself pure and easy to reset when navigating between cases.
export default function RubricForm({
  review,
  onScoreChange,
  onNotesChange,
  onReviewerChange,
  onOverallCommentChange,
  onFlaggedChange,
  onSave,
  onReset,
  promptText,
  saveDisabledReason,
  statusMessage,
  autoAdvance,
  onAutoAdvanceChange,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) {
  const focusedCodeRef = useRef(null);
  const totalItems = useMemo(
    () => RUBRIC_SECTIONS.reduce((sum, section) => sum + section.items.length, 0),
    [],
  );
  const completed = getCompletedItemCount(review);
  const complete = isReviewComplete(review);

  // Keyboard shortcuts: 1/2/3 on the focused item picks a score; Enter (with
  // modifier) saves; arrows navigate.
  useEffect(() => {
    function handleKey(event) {
      const target = event.target;
      const isEditableText =
        target instanceof HTMLElement && target.tagName === 'TEXTAREA';
      const code = focusedCodeRef.current;

      if (isEditableText) {
        // Let textareas capture everything except Ctrl/Cmd+Enter as save.
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          if (!saveDisabledReason) {
            onSave?.();
          }
        }
        return;
      }

      if (event.key >= '1' && event.key <= '4' && code) {
        const option = SCORE_OPTIONS.find((item) => item.key === event.key);
        if (option) {
          event.preventDefault();
          onScoreChange?.(code, option.value);
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!saveDisabledReason) {
          onSave?.();
        }
        return;
      }

      if (event.key === 'ArrowLeft' && hasPrev) {
        event.preventDefault();
        onPrev?.();
      } else if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault();
        onNext?.();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hasNext, hasPrev, onNext, onPrev, onSave, onScoreChange, saveDisabledReason]);

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!saveDisabledReason) {
          onSave?.();
        }
      }}
    >
      <ReviewerHeader
        review={review}
        onReviewerChange={onReviewerChange}
        completed={completed}
        total={totalItems}
        autoAdvance={autoAdvance}
        onAutoAdvanceChange={onAutoAdvanceChange}
      />

      <GoalAndDataDisclosure promptText={promptText} />

      <div className="space-y-5 pt-2">
        {RUBRIC_SECTIONS.map((section) => (
          <section
            key={section.id}
            aria-labelledby={`rubric-section-${section.id}`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <header className="mb-4">
              <h3
                id={`rubric-section-${section.id}`}
                className="text-sm font-semibold text-slate-900"
              >
                {section.id} — {section.title}
              </h3>
              <p className="mt-1 text-xs text-slate-500">{section.description}</p>
            </header>

            <div className="space-y-4">
              {section.items.map((item) => (
                <RubricRow
                  key={item.code}
                  item={item}
                  rating={review.ratings[item.code]}
                  onScoreChange={(value) => onScoreChange?.(item.code, value)}
                  onNotesChange={(value) => onNotesChange?.(item.code, value)}
                  onFocus={() => {
                    focusedCodeRef.current = item.code;
                  }}
                  onBlur={() => {
                    if (focusedCodeRef.current === item.code) {
                      focusedCodeRef.current = null;
                    }
                  }}
                />
              ))}
            </div>
          </section>
        ))}

        <section
          aria-labelledby="rubric-section-overall"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3
            id="rubric-section-overall"
            className="mb-4 text-sm font-semibold text-slate-900"
          >
            Overall
          </h3>

          <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!review.flagged}
              onChange={(event) => onFlaggedChange?.(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Flag this case for discussion
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Overall comment
            <textarea
              rows={3}
              value={review.overallComment ?? ''}
              onChange={(event) => onOverallCommentChange?.(event.target.value)}
              placeholder="Optional notes that span multiple rubric items"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
        </section>
      </div>

      <div className="sticky bottom-0 mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/90 px-1 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next →
          </button>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:border-slate-400"
        >
          Reset
        </button>

        <div className="ml-auto flex items-center gap-3">
          {statusMessage ? (
            <span className="text-xs text-slate-500">{statusMessage}</span>
          ) : null}
          <button
            type="submit"
            disabled={!!saveDisabledReason}
            title={saveDisabledReason || 'Save this review (Ctrl/Cmd + Enter)'}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {complete ? 'Save review' : `Save (${completed}/${totalItems})`}
          </button>
        </div>
      </div>
    </form>
  );
}

function ReviewerHeader({
  review,
  onReviewerChange,
  completed,
  total,
  autoAdvance,
  onAutoAdvanceChange,
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        Reviewer
        <input
          type="text"
          value={review.reviewer ?? ''}
          onChange={(event) => onReviewerChange?.(event.target.value)}
          placeholder="Your initials"
          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={!!autoAdvance}
          onChange={(event) => onAutoAdvanceChange?.(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Auto-advance after save
      </label>

      <span className="ml-auto text-xs font-medium text-slate-500">
        {completed} / {total} items rated
      </span>
    </div>
  );
}

// Parse a task prompt into its named sections. The prompts produced by this
// benchmark follow a stable shape:
//
//   You are a data visualization expert. ...
//
//   Visualization goal:
//   <goal body>
//
//   Full data input from "<path>":
//   <json array>
//
//   Output rule:
//   ...
//
// We split on the section headers so the reviewer can see the "goal" and
// "data" separately rather than one wall of text. If the shape doesn't match
// (e.g. custom prompts from a future run), we fall back to showing the whole
// prompt under "Visualization goal" so nothing is hidden.
function parsePromptSections(promptText) {
  if (!promptText || typeof promptText !== 'string') {
    return { goal: '', data: '', fallback: '' };
  }

  const goalMatch = promptText.match(
    /Visualization goal:\s*\n([\s\S]*?)(?=\n\s*Full data input from|\n\s*Output rule:|$)/i,
  );
  const dataMatch = promptText.match(
    /Full data input from[^\n]*\n([\s\S]*?)(?=\n\s*Output rule:|$)/i,
  );

  const goal = goalMatch ? goalMatch[1].trim() : '';
  const data = dataMatch ? dataMatch[1].trim() : '';

  if (!goal && !data) {
    return { goal: '', data: '', fallback: promptText.trim() };
  }

  return { goal, data, fallback: '' };
}

function GoalAndDataDisclosure({ promptText }) {
  if (!promptText) {
    return null;
  }
  const { goal, data, fallback } = parsePromptSections(promptText);
  const goalBody = goal || fallback;

  return (
    <div className="mb-3 space-y-2">
      {goalBody ? (
        <details
          open
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <summary className="cursor-pointer rounded-xl px-4 py-2 text-sm font-medium text-slate-700 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
            Visualization goal
          </summary>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-800">
            {goalBody}
          </pre>
        </details>
      ) : null}

      {data ? (
        <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer rounded-xl px-4 py-2 text-sm font-medium text-slate-700 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
            Data
          </summary>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-slate-200 bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-100">
            {data}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function RubricRow({ item, rating, onScoreChange, onNotesChange, onFocus, onBlur }) {
  // Fail requires notes — the point of the score is to flag a specific
  // deviation. Pass and N/A don't need a note.
  const scoreNeedsNotes =
    rating?.score && rating.score !== 'pass' && !isNaScore(rating.score);
  const needsNotes = scoreNeedsNotes && !rating?.notes?.trim();

  return (
    <div
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={-1}
      className={`rounded-lg border px-3 py-3 transition ${
        rating?.score
          ? rating.score === 'pass'
            ? 'border-emerald-200 bg-emerald-50/60'
            : rating.score === 'fail'
              ? 'border-rose-200 bg-rose-50/60'
              : 'border-slate-200 bg-slate-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {item.code} — {item.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.check}</p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label={`${item.code} score`}
        className="flex flex-wrap gap-2"
      >
        {SCORE_OPTIONS.map((option) => {
          // Treat the legacy `na` spelling as a synonym for `n/a` so older
          // rows render with the N/A button highlighted.
          const active =
            rating?.score === option.value ||
            (isNaScore(option.value) && isNaScore(rating?.score));
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onScoreChange?.(option.value)}
              onFocus={onFocus}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                active
                  ? option.value === 'pass'
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                    : option.value === 'fail'
                      ? 'border-rose-500 bg-rose-500 text-white shadow-sm'
                      : 'border-slate-500 bg-slate-500 text-white shadow-sm'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              {option.label}
              <span className="ml-1 text-[10px] opacity-70">[{option.key}]</span>
            </button>
          );
        })}
      </div>

      <label className="mt-2 block text-xs font-medium text-slate-600">
        Notes{scoreNeedsNotes ? ' (required)' : ''}
        <input
          type="text"
          value={rating?.notes ?? ''}
          onChange={(event) => onNotesChange?.(event.target.value)}
          onFocus={onFocus}
          placeholder={
            scoreNeedsNotes
              ? 'Which failure mode triggered this?'
              : 'Optional note'
          }
          className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm shadow-sm focus:outline-none ${
            needsNotes ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-slate-500'
          }`}
        />
      </label>
    </div>
  );
}
