import { Settings2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { InstructionPreference } from '../../../shared/workspace';

/** Edit one private preference. The draft survives a failed save or a reload of the saved value. */
export function InstructionSettings({ preference, loading, loadError, onSave, onReload }: {
  preference?: InstructionPreference;
  loading: boolean;
  loadError?: string;
  onSave: (text: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState('');
  const toggle = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (open && preference && !loading) editor.current?.focus();
  }, [open, Boolean(preference), loading]);

  function close() {
    if (lock.current) return;
    setOpen(false);
    setDraft(undefined);
    setError(undefined);
    toggle.current?.focus();
  }

  async function save(text: string) {
    if (lock.current || loading || !preference) return;
    lock.current = true;
    setSaving(true);
    setError(undefined);
    setStatus('');
    try {
      await onSave(text);
      setDraft(undefined);
      setStatus(text.trim() ? 'Custom instruction saved.' : 'Built-in instruction restored.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your instruction.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  const text = draft ?? preference?.text ?? '';
  return (
    <div className="instruction-settings" onKeyDown={event => {
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        close();
      }
    }}>
      <button type="button" ref={toggle} className="button icon-button settings-toggle"
        aria-expanded={open} aria-controls="instruction-panel" aria-label="Investigation instructions"
        title="Investigation instructions" onClick={() => {
          if (open) close();
          else {
            setStatus('');
            setOpen(true);
          }
        }}>
        <Settings2 size={16} aria-hidden="true" />
      </button>
      {open && (
        <section id="instruction-panel" className="instruction-panel" aria-labelledby="instruction-title">
          <div className="panel-heading">
            <h2 id="instruction-title">Investigation instructions</h2>
            <button type="button" className="button icon-button button-quiet" disabled={saving}
              aria-label="Close investigation instructions" onClick={close}><X size={16} aria-hidden="true" /></button>
          </div>
          <p>Customize what your AI focuses on. FlowLens always includes the built-in instructions and JSON contract.</p>
          {loading && <p role="status">Loading your saved instruction…</p>}
          {loadError && <p className="error-text" role="alert">{loadError}</p>}
          {error && <p className="error-text" role="alert">{error}</p>}
          {status && <p className="instruction-status" role="status">{status}</p>}
          {(loadError || error) && (
            <button type="button" className="button button-quiet" disabled={loading || saving} onClick={() => {
              setError(undefined);
              void onReload();
            }}>Reload saved instruction</button>
          )}
          <form onSubmit={event => {
            event.preventDefault();
            void save(text);
          }}>
            <label htmlFor="instruction-text">Custom instruction</label>
            <textarea id="instruction-text" ref={editor} value={text} rows={5} disabled={loading || saving || !preference}
              onChange={event => { setDraft(event.currentTarget.value); setStatus(''); }}
              placeholder="For example, focus on retries and how to verify the failure." />
            <div className="instruction-actions">
              <button type="button" className="button button-quiet reset-instruction" disabled={saving || loading || !preference?.text}
                onClick={() => void save('')}>Reset to Default</button>
              <button type="button" className="button" disabled={saving} onClick={close}>Cancel</button>
              <button type="submit" className="button button-primary"
                disabled={saving || loading || !preference || text.trim() === preference.text}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
