// Rubric definition mirrors benchmark/rubric.md (visualization generation rubric).
// Each item is rated Pass / Fail / N/A, with free-text notes required on Fail.
// Pass absorbs small, inconsequential variation (axis slightly wider than the
// data, title one filler word off). Fail covers both outright-wrong checks
// (wrong chart family, swapped axes, fabricated data) and nameable quality
// problems a visualization expert would ask to fix (axis so wide the data
// reads as flat, legend cluttered with internal series, palette drifts on one
// category, unrequested extra marks). If it bothers you enough to write a
// note, it's a Fail — see benchmark/review-guidelines.md for the subtlety
// calls and the [LLM] / [grammar] tag convention.

export const RUBRIC_SECTIONS = [
  {
    id: 'S',
    title: 'Structure',
    description:
      'Chart identity and layout only: family, sub-variant, composition, scale.',
    items: [
      {
        code: 'S1',
        name: 'Chart family',
        check:
          'Requested family (bar, line, scatter, area, pie, ...) is present.',
      },
      {
        code: 'S2',
        name: 'Variant, composition, required marks',
        check:
          'Requested sub-variant (grouped, stacked, normalized-stacked, multi-series) and composition (single-view, layered, dual-axis, faceted) match; any required reference / rule / annotation layers are present and no extra layers appear.',
      },
      {
        code: 'S3',
        name: 'Scale type, domain',
        check:
          'Scale type matches data role (linear / ordinal / band), bar/area charts baseline at 0 unless the task permits otherwise, and any explicit range/domain constraint (e.g. 0–100 for share-percent) is honored.',
      },
    ],
  },
  {
    id: 'E',
    title: 'Encoding',
    description: 'Channel-field binding given the structure.',
    items: [
      {
        code: 'E1',
        name: 'Measure selection',
        check:
          'The intended quantitative field (or comparison / share metric) is on the value-bearing channel; no decoy measure; no redundant measure on a second channel.',
      },
      {
        code: 'E2',
        name: 'Field-role binding',
        check:
          'Requested categorical fields are on the correct axis / group / series / facet / color channels.',
      },
      {
        code: 'E3',
        name: 'Orientation',
        check:
          'Positional channels carry the variables the prompt specifies or implies (e.g., horizontal bars put the category on y, the measure on x).',
      },
    ],
  },
  {
    id: 'F',
    title: 'Fidelity',
    description:
      'Match between request and output — both data correctness and scope precision.',
    items: [
      {
        code: 'F1',
        name: 'Data fidelity',
        check:
          "Every row, value, and category label matches the dataset; no dropped, fabricated, or silently transformed data; time and ordered-category axes preserve the data's intended order.",
      },
      {
        code: 'F2',
        name: 'Scope / minimalism',
        check:
          'Nothing present that the prompt did not ask for: no unrequested trendlines, combo marks, extra facets, secondary axes, annotations, or added layers. A bar chart prompt answered with a bar+line combo fails F2.',
      },
    ],
  },
  {
    id: 'Y',
    title: 'Stylistic',
    description:
      'Aesthetic and rendering choices, independent of meaning.',
    items: [
      {
        code: 'Y1',
        name: 'Title',
        check:
          'Title present when requested; text matches exactly when the prompt wraps it in backticks.',
      },
      {
        code: 'Y2',
        name: 'Legend',
        check:
          'Legend present when requested (absent when the prompt says not to include one); labels match the data categories (not Series 1, Series 2, ...).',
      },
      {
        code: 'Y3',
        name: 'Palette and layout',
        check:
          'Specified palette / hex codes are used when given; labels, legends, titles, and marks are readable with no important overlap, clipping, or off-canvas content.',
      },
    ],
  },
];

export const RUBRIC_ITEMS = RUBRIC_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, sectionId: section.id })),
);

export const RUBRIC_ITEM_CODES = RUBRIC_ITEMS.map((item) => item.code);

export const SCORE_OPTIONS = [
  { value: 'pass', label: 'Pass', key: '1' },
  { value: 'fail', label: 'Fail', key: '2' },
  { value: 'n/a', label: 'N/A', key: '3' },
];

// Accepted score values. The UI writes `n/a` (matches `rubric.md` and the
// autograder), but earlier reviews were stored as `na` (pre-migration spelling
// used by the old viewer and some hand-reviewed rows). Both parse as valid.
// The `NA_SCORES` set is the single source of truth for "is this the N/A
// score?" so the hardcoded checks in reviews.js / ReviewerView.jsx /
// RubricForm.jsx stay consistent.
export const NA_SCORES = new Set(['n/a', 'na']);
export const SCORE_VALUES = [...SCORE_OPTIONS.map((option) => option.value), 'na'];

export function isNaScore(score) {
  return NA_SCORES.has(score);
}
