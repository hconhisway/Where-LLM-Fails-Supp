const RUN_INDEX_URL = '/results/experiment/index.json';

// Display labels for the runs shown anywhere in the UI. The on-disk
// run-id slugs (gpt5-full-matrix-v1 etc.) are an internal detail; reviewers
// should only see the shipping-ready model names.
const RUN_DISPLAY_NAMES = {
  'gpt5-full-matrix-v1': 'gpt5',
  'qwen35-plus-full-matrix-v1': 'qwen3.5plus',
  'gemini-vegalite-smoke': 'gemini3.1pro',
};

export function getRunDisplayName(runId) {
  if (!runId) {
    return runId ?? '';
  }
  return RUN_DISPLAY_NAMES[runId] ?? runId;
}

export async function listRuns() {
  const response = await fetch(RUN_INDEX_URL);
  if (!response.ok) {
    throw new Error(`Failed to load run index (${response.status})`);
  }

  const parsed = await response.json();
  const runIds = Array.isArray(parsed?.runIds) ? parsed.runIds : [];
  return runIds.filter((runId) => typeof runId === 'string' && runId.length > 0);
}

export function buildViewerDataUrl(runId) {
  return `/results/experiment/${encodeURIComponent(runId)}/viewer-data.json`;
}

export function buildImageUrl(imagePath) {
  if (!imagePath) {
    return null;
  }

  const normalizedPath = imagePath.replaceAll('\\', '/').replace(/^\.?\//, '');
  if (normalizedPath.startsWith('results/experiment/')) {
    return `/${normalizedPath}`;
  }
  return `/${normalizedPath}`;
}

export function summarizeBy(items, keyName) {
  const groups = new Map();
  for (const item of items) {
    const key = item[keyName] ?? 'unknown';
    const existing = groups.get(key) ?? {
      key,
      total: 0,
      jsonValid: 0,
      renderSuccess: 0,
    };
    existing.total += 1;
    if (item.jsonValid) {
      existing.jsonValid += 1;
    }
    if (item.renderSuccess) {
      existing.renderSuccess += 1;
    }
    groups.set(key, existing);
  }
  return [...groups.values()];
}
