import { buildImageUrl } from '@/lib/data.js';

export default function ResultCard({ result }) {
  const imageUrl = buildImageUrl(result.imagePath);
  const promptParts = parsePrompt(result.prompt);
  const responseText = result.rawResponse?.trim() || 'No response text available.';

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            {result.taskId} · {result.taskTitle}
          </p>
          <p className="text-sm text-slate-600">
            {result.modelId} / {result.grammarId} / {result.difficulty} / source {result.source}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge active={result.jsonValid}>JSON valid</Badge>
          <Badge active={result.renderSuccess}>Render success</Badge>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5">
        <Section title="Visualization Goal">
          <p className="text-sm leading-6 text-slate-700">{promptParts.visualizationGoal}</p>
        </Section>

        <Section title="Data" subtitle={promptParts.datasetPath}>
          <CodeBlock>{promptParts.datasetText}</CodeBlock>
        </Section>

        <Section title="Visualization Result">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${result.taskId} render`}
              loading="lazy"
              className="max-h-[32rem] w-full rounded-xl border border-slate-200 object-contain"
            />
          ) : (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              Render failed: {result.renderError ?? 'Unknown error'}
            </div>
          )}
        </Section>

        <Section title="Response TXT">
          <CodeBlock>{responseText}</CodeBlock>
        </Section>
      </div>
    </article>
  );
}

function Badge({ active, children }) {
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-medium ${
        active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}
    >
      {children}
    </span>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
      <code>{children}</code>
    </pre>
  );
}

function parsePrompt(prompt) {
  if (!prompt) {
    return {
      visualizationGoal: 'No prompt available.',
      datasetPath: '',
      datasetText: 'No input data available.',
    };
  }

  const goalMatch = prompt.match(/Visualization goal:\n([\s\S]*?)\n\nFull data input from/i);
  const dataMatch = prompt.match(/Full data input from "([^"]+)"\s*:\n([\s\S]*)$/i);
  const datasetText = dataMatch?.[2]?.trim() ?? '';

  return {
    visualizationGoal: goalMatch?.[1]?.trim() ?? prompt.trim(),
    datasetPath: dataMatch?.[1] ?? '',
    datasetText: formatJsonText(datasetText) || 'No input data available.',
  };
}

function formatJsonText(text) {
  if (!text) {
    return '';
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
