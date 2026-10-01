import { buildImageUrl } from '@/lib/data.js';

export default function ImagePanel({ result }) {
  const imageUrl = buildImageUrl(result.imagePath);

  return (
    <section className="h-full overflow-auto rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Rendered Visualization</h3>
      {imageUrl ? (
        <img src={imageUrl} alt={`${result.taskId} render`} className="w-full rounded border border-slate-200" />
      ) : (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Render failed: {result.renderError ?? 'Unknown error'}
        </div>
      )}
    </section>
  );
}
