import { useEffect, useState } from 'react';
import type { ResolverDefinitions } from '../../../src/definitions';

export default function App() {
  const [bridgeStatus, setBridgeStatus] = useState('Connecting to Jira…');
  const [resolverStatus, setResolverStatus] = useState('Connecting to the resolver…');
  const [issueKey, setIssueKey] = useState<string>();

  useEffect(() => {
    let active = true;

    // Bridge checks for Jira's host at import time. Load it here so a standalone
    // Vite preview can still render the layout and explain the missing context.
    void import('@forge/bridge').then(({ makeInvoke, view }) => {
      if (!active) return;
      const invoke = makeInvoke<ResolverDefinitions>();

      // Check independently so a resolver failure does not hide working context.
      void view.getContext().then(
        (context) => {
          if (!active) return;
          const key: unknown = context.extension.issue?.key;
          if (typeof key === 'string') setIssueKey(key);
          setBridgeStatus('Connected to Jira through Forge Bridge.');
        },
        () => {
          if (active) setBridgeStatus('Jira context unavailable. Open this panel inside a Jira issue.');
        },
      );

      void invoke('health').then(
        (response) => {
          if (active) setResolverStatus(response.message);
        },
        () => {
          if (active) setResolverStatus('Resolver connection failed. Check the Forge deployment or tunnel.');
        },
      );
    }).catch(() => {
      if (!active) return;
      setBridgeStatus('Jira context unavailable. Open this panel inside a Jira issue.');
      setResolverStatus('Use the deployed panel or Forge tunnel to connect to the backend.');
    });

    // Avoid updating state after unmount (including StrictMode's dev remount).
    return () => { active = false; };
  }, []);

  return (
    <main>
      <h1>FlowLens — Bring Your Own AI</h1>
      <p>Welcome to FlowLens. Your starting point for understanding code flows in Jira.</p>
      {issueKey && <p>Current issue: <strong>{issueKey}</strong></p>}
      <section aria-label="Connection status" aria-live="polite">
        <h2>Connection status</h2>
        <p><strong>Bridge:</strong> {bridgeStatus}</p>
        <p><strong>Backend:</strong> {resolverStatus}</p>
      </section>
    </main>
  );
}
