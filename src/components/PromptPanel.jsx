export default function PromptPanel({ prompt }) {
  return (
    <section className="h-full overflow-auto rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Prompt</h3>
      <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{prompt}</pre>
    </section>
  );
}
