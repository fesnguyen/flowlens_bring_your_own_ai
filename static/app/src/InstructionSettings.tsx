import { useState } from 'react';
import {
  activeInstruction, createInstruction, maxInstructionBytes, removeInstruction, type InstructionPreferences,
} from './inspection/instructions';

/** Select the foundation or manage optional preferences shared by Copy and Package. */
export function InstructionSettings({ preferences, onChange }: {
  preferences: InstructionPreferences;
  onChange: (update: (current: InstructionPreferences) => InstructionPreferences) => void;
}) {
  const [error, setError] = useState<string>();

  function save(name: string, text: string) {
    const id = crypto.randomUUID();
    // Validate synchronously for feedback, then apply against the latest preferences.
    const instruction = createInstruction(id, name, text);
    onChange(current => ({ custom: [...current.custom, instruction], selectedId: id }));
    setError(undefined);
  }

  return (
    <details className="instruction-settings">
      <summary>Investigation instructions</summary>
      <div className="instruction-controls">
        <label htmlFor="instruction-choice">Use for Copy and Export</label>
        <select id="instruction-choice" value={preferences.selectedId}
          onChange={event => {
            const selectedId = event.currentTarget.value;
            onChange(current => ({ ...current, selectedId }));
          }}>
          <option value="">Built-in default</option>
          {preferences.custom.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
        {activeInstruction(preferences) && (
          <button className="header-action" type="button"
            onClick={() => onChange(current => removeInstruction(current, preferences.selectedId))}>
            Remove selected instruction
          </button>
        )}
      </div>

      {/* Pasted and imported preferences both extend the built-in instruction. */}
      <form className="instruction-form" onSubmit={event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
          save(String(data.get('name')), String(data.get('instruction')));
          form.reset();
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Could not add the instruction.');
        }
      }}>
        <label htmlFor="instruction-name">Name</label>
        <input id="instruction-name" name="name" type="text" maxLength={80} required />
        <label htmlFor="instruction-text">Custom instruction</label>
        <textarea id="instruction-text" name="instruction" rows={4} required />
        <button className="header-action" type="submit">Add instruction</button>
      </form>
      <div className="instruction-controls">
        <label htmlFor="instruction-file">Import instruction (.md or .txt)</label>
        <input id="instruction-file" type="file" accept=".md,.txt,text/plain,text/markdown"
          onChange={async event => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            input.value = '';
            try {
              if (file.size > maxInstructionBytes) throw new Error('Instruction file exceeds the 32 KiB limit.');
              const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
              save(file.name.replace(/\.(?:md|txt)$/i, '').slice(0, 80), text);
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Could not read the instruction file.');
            }
          }} />
      </div>
      {error && <p role="alert" className="inspection-error">{error}</p>}
    </details>
  );
}
