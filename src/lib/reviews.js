// Persistence layer for rubric reviews.
//
// Storage strategy (per review session / run):
//   1) When a reviewer picks a "reviews file" using the File System Access API,
//      each saved review is appended to that file as one JSON line (JSONL).
//      The file also serves as the source of truth on reload.
//   2) In-flight ratings (before pressing Save) are persisted to localStorage
//      as drafts keyed by (runId, reviewer, caseId).
//   3) If the File System Access API is not available, completed reviews are
//      kept entirely in localStorage and can be exported as JSONL.
//
// Each review record shape:
//   {
//     schemaVersion: 1,
//     runId,
//     caseId,          // unique per result (recordPath)
//     reviewer,        // initials or name entered by the user
//     timestamp,       // ISO string when saved
//     grammarId,
//     modelId,
//     taskId,
//     ratings: {
//       // score is 'pass' | 'fail' | 'n/a'. Fail requires notes (and, per
//       // review-guidelines.md, notes should be tagged [LLM] or [grammar]).
//       // Rubric v2 (11 items): S1/S2/S3, E1/E2/E3, F1/F2, Y1/Y2/Y3.
//       S1: { score: 'pass' | 'fail' | 'n/a', notes: string },
//       S2: {...}, S3: {...},
//       E1: {...}, E2: {...}, E3: {...},
//       F1: {...}, F2: {...},
//       Y1: {...}, Y2: {...}, Y3: {...},
//     },
//     overallComment: string,
//     flagged: boolean,
//   }

import { RUBRIC_ITEM_CODES, SCORE_VALUES, isNaScore } from '@/lib/rubric.js';

const SCHEMA_VERSION = 1;
const DRAFT_PREFIX = 'llm-vis-reviews.draft';
const REVIEWS_FALLBACK_PREFIX = 'llm-vis-reviews.fallback';
const LAST_REVIEWER_KEY = 'llm-vis-reviews.lastReviewer';

// Display-only rewrites for reviewer names. The on-disk reviews.jsonl files
// were authored under the older `claude-opus-4-7` identifier; the shipping
// model is `claude-opus-4-6`, so we surface that name everywhere the reviewer
// is rendered. Storage keys still use the original string so any cached
// drafts written under the old name continue to load.
const REVIEWER_DISPLAY_REWRITES = {
  'claude-opus-4-7': 'claude-opus-4-6',
};

function rewriteReviewerName(name) {
  if (!name) {
    return name;
  }
  return REVIEWER_DISPLAY_REWRITES[name] ?? name;
}

function rewriteReviewReviewer(review) {
  if (!review || typeof review !== 'object') {
    return review;
  }
  const rewritten = rewriteReviewerName(review.reviewer);
  if (rewritten === review.reviewer) {
    return review;
  }
  return { ...review, reviewer: rewritten };
}

export const hasFileSystemAccess =
  typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

export function createEmptyRatings() {
  const ratings = {};
  for (const code of RUBRIC_ITEM_CODES) {
    ratings[code] = { score: null, notes: '' };
  }
  return ratings;
}

export function createEmptyReview({ runId = '', caseId = '', reviewer = '' } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    runId,
    caseId,
    reviewer,
    timestamp: null,
    grammarId: null,
    modelId: null,
    taskId: null,
    ratings: createEmptyRatings(),
    overallComment: '',
    flagged: false,
  };
}

export function isReviewComplete(review) {
  if (!review || !review.ratings) {
    return false;
  }
  return RUBRIC_ITEM_CODES.every((code) => {
    const rating = review.ratings[code];
    if (!rating || !SCORE_VALUES.includes(rating.score)) {
      return false;
    }
    // Pass and N/A don't need notes; fail does, because the whole point of
    // the score is to flag a specific deviation.
    if (rating.score !== 'pass' && !isNaScore(rating.score) && !rating.notes.trim()) {
      return false;
    }
    return true;
  });
}

export function getCompletedItemCount(review) {
  if (!review || !review.ratings) {
    return 0;
  }
  return RUBRIC_ITEM_CODES.reduce((total, code) => {
    const rating = review.ratings[code];
    if (rating && SCORE_VALUES.includes(rating.score)) {
      return total + 1;
    }
    return total;
  }, 0);
}

// -------------------- Reviewer identity --------------------

export function getLastReviewer() {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const stored = window.localStorage.getItem(LAST_REVIEWER_KEY) ?? '';
    return rewriteReviewerName(stored);
  } catch {
    return '';
  }
}

export function setLastReviewer(reviewer) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LAST_REVIEWER_KEY, reviewer);
  } catch {
    /* ignore */
  }
}

// -------------------- Drafts (unsaved ratings) --------------------

function draftKey({ runId, reviewer, caseId }) {
  return `${DRAFT_PREFIX}:${runId}:${reviewer}:${caseId}`;
}

export function loadDraft({ runId, reviewer, caseId }) {
  if (typeof window === 'undefined' || !runId || !caseId) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(draftKey({ runId, reviewer, caseId }));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(review) {
  if (typeof window === 'undefined' || !review?.runId || !review?.caseId) {
    return;
  }
  try {
    window.localStorage.setItem(
      draftKey({ runId: review.runId, reviewer: review.reviewer, caseId: review.caseId }),
      JSON.stringify(review),
    );
  } catch {
    /* ignore quota errors */
  }
}

export function clearDraft({ runId, reviewer, caseId }) {
  if (typeof window === 'undefined' || !runId || !caseId) {
    return;
  }
  try {
    window.localStorage.removeItem(draftKey({ runId, reviewer, caseId }));
  } catch {
    /* ignore */
  }
}

// -------------------- Server-side write API (vite dev/preview only) --------------------
//
// In dev, vite mounts a small middleware (see viewer/vite-plugins/reviews-api.js)
// that writes directly to results/experiment/<runId>/reviews.jsonl on disk.
// When that endpoint is reachable, the Save button can append straight to the
// canonical file — no File System Access picker, no per-reload reconnect.
//
// We probe /api/reviews/health once on mount and cache the result.

let serverWriteAvailableCache = null;

export async function probeServerWriteApi({ force = false } = {}) {
  if (typeof window === 'undefined') {
    return false;
  }
  if (!force && serverWriteAvailableCache !== null) {
    return serverWriteAvailableCache;
  }
  try {
    const response = await fetch('/api/reviews/health', { cache: 'no-store' });
    if (!response.ok) {
      serverWriteAvailableCache = false;
      return false;
    }
    const payload = await response.json().catch(() => null);
    serverWriteAvailableCache = Boolean(payload?.ok);
    return serverWriteAvailableCache;
  } catch {
    serverWriteAvailableCache = false;
    return false;
  }
}

export function isServerWriteAvailableSync() {
  return serverWriteAvailableCache === true;
}

export async function appendReviewToServer(runId, review) {
  if (!runId) {
    throw new Error('appendReviewToServer: runId is required.');
  }
  const response = await fetch(
    `/api/reviews/${encodeURIComponent(runId)}/append`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = payload?.error ? `: ${payload.error}` : '';
    throw new Error(`Server append failed (${response.status})${detail}`);
  }
  return response.json().catch(() => ({}));
}

export async function rewriteReviewsToServer(runId, reviews) {
  if (!runId) {
    throw new Error('rewriteReviewsToServer: runId is required.');
  }
  const response = await fetch(`/api/reviews/${encodeURIComponent(runId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviews }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = payload?.error ? `: ${payload.error}` : '';
    throw new Error(`Server rewrite failed (${response.status})${detail}`);
  }
  return response.json().catch(() => ({}));
}

// -------------------- Run-dir reviews.jsonl (read-only, served statically) --------------------
//
// If a reviews.jsonl sits next to the run's viewer-data.json (i.e. at
// /results/experiment/<runId>/reviews.jsonl), we treat it as a read-only
// source of already-written reviews and auto-load it on mount. Useful for
// sharing pre-written rubric scores (e.g. committed alongside the run) so
// reviewers don't have to pick a file just to *see* existing ratings.

export function buildRunReviewsUrl(runId) {
  if (!runId) {
    return null;
  }
  return `/results/experiment/${encodeURIComponent(runId)}/reviews.jsonl`;
}

export async function fetchRunReviews(runId) {
  const url = buildRunReviewsUrl(runId);
  if (!url) {
    return [];
  }
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      // 404 is the normal case when no run-dir reviews file exists yet.
      return [];
    }
    const text = await response.text();
    if (!text.trim()) {
      return [];
    }
    return parseJsonl(text);
  } catch (error) {
    console.warn('Failed to fetch run-dir reviews.jsonl', error);
    return [];
  }
}

// -------------------- File System Access: JSONL file --------------------

export async function pickReviewsFile({ suggestedName = 'reviews.jsonl' } = {}) {
  if (!hasFileSystemAccess) {
    throw new Error('File System Access API is not available in this browser.');
  }
  // NOTE: using a made-up MIME like `application/jsonl` causes macOS/Chrome to
  // grey out existing .jsonl files in the save-file dialog (the OS can't map
  // the file to any of the listed MIME types, so the file is shown but not
  // selectable). Stick to real MIME types so existing reviews files are
  // selectable when a user wants to bind to one.
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: 'JSON Lines / JSON',
        accept: {
          'application/json': ['.jsonl', '.json'],
          'application/x-ndjson': ['.jsonl', '.ndjson'],
          'text/plain': ['.jsonl', '.json', '.ndjson', '.txt'],
        },
      },
    ],
    // Keep the "All Files" escape hatch on by omitting excludeAcceptAllOption;
    // that way even if the MIME filter ever mis-identifies a file, the user
    // can flip to All Files and pick it.
  });
  return handle;
}

export async function readReviewsFromHandle(handle) {
  if (!handle) {
    return [];
  }
  try {
    const file = await handle.getFile();
    const text = await file.text();
    if (!text.trim()) {
      return [];
    }
    return parseJsonl(text);
  } catch (error) {
    console.warn('Failed to read reviews file', error);
    return [];
  }
}

export async function appendReviewToHandle(handle, review) {
  if (!handle) {
    throw new Error('No reviews file selected.');
  }

  // The File System Access API does not expose a true "append" mode across
  // browsers, so read the existing content and rewrite with the new line
  // appended. For review workflows (small files, infrequent writes) this is
  // fine and keeps the on-disk format as plain JSONL.
  const file = await handle.getFile();
  const existing = await file.text();
  const line = `${JSON.stringify(review)}\n`;
  const nextText = existing.endsWith('\n') || existing.length === 0 ? existing + line : existing + '\n' + line;
  const writable = await handle.createWritable();
  try {
    await writable.write(nextText);
  } finally {
    await writable.close();
  }
}

export async function rewriteReviewsToHandle(handle, reviews) {
  if (!handle) {
    throw new Error('No reviews file selected.');
  }
  const body = reviews.map((review) => JSON.stringify(review)).join('\n') + (reviews.length ? '\n' : '');
  const writable = await handle.createWritable();
  try {
    await writable.write(body);
  } finally {
    await writable.close();
  }
}

// -------------------- Fallback storage (no File System Access) --------------------

function fallbackKey(runId) {
  return `${REVIEWS_FALLBACK_PREFIX}:${runId}`;
}

export function loadFallbackReviews(runId) {
  if (typeof window === 'undefined' || !runId) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(fallbackKey(runId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(rewriteReviewReviewer) : [];
  } catch {
    return [];
  }
}

export function saveFallbackReviews(runId, reviews) {
  if (typeof window === 'undefined' || !runId) {
    return;
  }
  try {
    window.localStorage.setItem(fallbackKey(runId), JSON.stringify(reviews));
  } catch {
    /* ignore quota errors */
  }
}

export function exportReviewsAsJsonl(reviews) {
  return reviews.map((review) => JSON.stringify(review)).join('\n') + (reviews.length ? '\n' : '');
}

export function downloadJsonl(reviews, filename = 'reviews.jsonl') {
  if (typeof window === 'undefined') {
    return;
  }
  const blob = new Blob([exportReviewsAsJsonl(reviews)], { type: 'application/jsonl' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -------------------- File handle persistence (IndexedDB) --------------------
//
// File System Access handles are not serializable into localStorage, but they
// are structured-cloneable, which means IndexedDB can persist them across
// reloads. We key handles by runId so each reviewed run can be wired back up
// to its own reviews.jsonl file.

const HANDLE_DB_NAME = 'llm-vis-reviews';
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE = 'file-handles';

function openHandleDB() {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(HANDLE_DB_NAME, HANDLE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked.'));
  });
}

async function runHandleTxn(mode, action) {
  const db = await openHandleDB();
  if (!db) {
    return undefined;
  }
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(HANDLE_STORE, mode);
      const store = tx.objectStore(HANDLE_STORE);
      const request = action(store);
      let result;
      if (request) {
        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => reject(request.error);
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted.'));
    } catch (error) {
      reject(error);
    }
  });
}

export async function getStoredFileHandle(runId) {
  if (!runId) {
    return null;
  }
  try {
    const handle = await runHandleTxn('readonly', (store) => store.get(runId));
    return handle ?? null;
  } catch (error) {
    console.warn('Failed to read stored file handle', error);
    return null;
  }
}

export async function putStoredFileHandle(runId, handle) {
  if (!runId || !handle) {
    return;
  }
  try {
    await runHandleTxn('readwrite', (store) => store.put(handle, runId));
  } catch (error) {
    console.warn('Failed to persist file handle', error);
  }
}

export async function clearStoredFileHandle(runId) {
  if (!runId) {
    return;
  }
  try {
    await runHandleTxn('readwrite', (store) => store.delete(runId));
  } catch (error) {
    console.warn('Failed to clear stored file handle', error);
  }
}

export async function queryHandlePermission(handle, { mode = 'readwrite' } = {}) {
  if (!handle || typeof handle.queryPermission !== 'function') {
    return 'denied';
  }
  try {
    return await handle.queryPermission({ mode });
  } catch {
    return 'denied';
  }
}

export async function requestHandlePermission(handle, { mode = 'readwrite' } = {}) {
  if (!handle || typeof handle.requestPermission !== 'function') {
    return 'denied';
  }
  try {
    return await handle.requestPermission({ mode });
  } catch {
    return 'denied';
  }
}

// Merge two review lists, deduplicating by (caseId, reviewer, timestamp). Used
// when reconciling the on-disk file against the localStorage cache after a
// reload, so reviews saved while the file was disconnected can be flushed back
// to disk.
export function mergeReviewLists(a = [], b = []) {
  const seen = new Set();
  const merged = [];
  for (const review of [...a, ...b]) {
    if (!review) {
      continue;
    }
    const key = `${review.caseId ?? ''}|${review.reviewer ?? ''}|${review.timestamp ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(review);
  }
  return merged;
}

// -------------------- Shared parsing --------------------

export function parseJsonl(text) {
  const reviews = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        reviews.push(rewriteReviewReviewer(parsed));
      }
    } catch (error) {
      console.warn('Skipping malformed review line:', error);
    }
  }
  return reviews;
}

// Given a list of reviews, return the most recent one per caseId (per reviewer if
// a reviewer filter is provided).
export function buildReviewIndex(reviews, { reviewer } = {}) {
  const index = new Map();
  for (const review of reviews) {
    if (!review?.caseId) {
      continue;
    }
    if (reviewer && review.reviewer && review.reviewer !== reviewer) {
      continue;
    }
    const existing = index.get(review.caseId);
    if (!existing) {
      index.set(review.caseId, review);
      continue;
    }
    // Prefer the more-complete review. A stale localStorage-cached v1 row
    // (5 items, newer timestamp) must not shadow a canonical v2 file row
    // (11 items, older timestamp). Only break ties by timestamp when both
    // rows have the same level of completeness.
    const existingCount = getCompletedItemCount(existing);
    const nextCount = getCompletedItemCount(review);
    if (nextCount > existingCount) {
      index.set(review.caseId, review);
      continue;
    }
    if (nextCount < existingCount) {
      continue;
    }
    const existingTs = Date.parse(existing.timestamp ?? '') || 0;
    const nextTs = Date.parse(review.timestamp ?? '') || 0;
    if (nextTs >= existingTs) {
      index.set(review.caseId, review);
    }
  }
  return index;
}
