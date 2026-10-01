import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function JsonPanel({ result }) {
  return (
    <section className="h-full overflow-auto rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Generated JSON</h3>
      <SyntaxHighlighter language="json" style={oneLight} customStyle={{ fontSize: '12px', margin: 0 }}>
        {JSON.stringify(result.extractedSpec ?? result.rawResponse ?? {}, null, 2)}
      </SyntaxHighlighter>
      {!result.jsonValid ? (
        <p className="mt-2 text-xs text-rose-700">JSON parse error: {result.parseError ?? 'Unknown parse error'}</p>
      ) : null}
    </section>
  );
}
