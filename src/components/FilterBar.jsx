export default function FilterBar({
  mode,
  onModeChange,
  taskOptions,
  grammarOptions,
  selectedTaskId,
  selectedGrammarId,
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <ButtonGroup label="Browse Mode">
        <SelectionButton active={mode === 'task'} onClick={() => onModeChange('task')}>
          Same task, different grammars
        </SelectionButton>
        <SelectionButton active={mode === 'grammar'} onClick={() => onModeChange('grammar')}>
          Same grammar, different tasks
        </SelectionButton>
      </ButtonGroup>

      {mode === 'task' ? (
        <ButtonGroup label="Task">
          {taskOptions.map((task) => (
            <SelectionButton
              key={task.id}
              active={task.id === selectedTaskId}
              onClick={() => onModeChange('task', task.id)}
              title={task.title}
            >
              {task.id}
              <span className="ml-2 text-[11px] opacity-75">{task.count}</span>
            </SelectionButton>
          ))}
        </ButtonGroup>
      ) : (
        <ButtonGroup label="Grammar">
          {grammarOptions.map((grammar) => (
            <SelectionButton
              key={grammar.id}
              active={grammar.id === selectedGrammarId}
              onClick={() => onModeChange('grammar', grammar.id)}
            >
              {grammar.id}
              <span className="ml-2 text-[11px] opacity-75">{grammar.count}</span>
            </SelectionButton>
          ))}
        </ButtonGroup>
      )}
    </div>
  );
}

function ButtonGroup({ label, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SelectionButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
          : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
