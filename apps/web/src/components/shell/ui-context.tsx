'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CreateApplicationInput } from '@heyreply/shared';

interface UIState {
  quickAddOpen: boolean;
  quickAddPrefill: Partial<CreateApplicationInput> | null;
  appId: string | null;
  paletteOpen: boolean;
}

/** Stable for the lifetime of the provider: components that only open things don't re-render when a sheet opens or closes. */
interface UIActions {
  openQuickAdd: (prefill?: Partial<CreateApplicationInput>) => void;
  closeQuickAdd: () => void;
  openApp: (id: string) => void;
  closeApp: () => void;
  setPaletteOpen: (v: boolean) => void;
}

const StateCtx = createContext<UIState | null>(null);
const ActionsCtx = createContext<UIActions | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddPrefill, setPrefill] = useState<Partial<CreateApplicationInput> | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const actions = useMemo<UIActions>(
    () => ({
      openQuickAdd: (prefill) => {
        setPrefill(prefill ?? null);
        setQuickAddOpen(true);
      },
      closeQuickAdd: () => setQuickAddOpen(false),
      openApp: setAppId,
      closeApp: () => setAppId(null),
      setPaletteOpen,
    }),
    [],
  );
  const { openQuickAdd } = actions;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role=dialog]')) return;
      if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        openQuickAdd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openQuickAdd]);

  const state = useMemo<UIState>(() => ({ quickAddOpen, quickAddPrefill, appId, paletteOpen }), [quickAddOpen, quickAddPrefill, appId, paletteOpen]);
  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </ActionsCtx.Provider>
  );
}

/** For components that only trigger things (open a sheet, open the palette). */
export function useUIActions() {
  const v = useContext(ActionsCtx);
  if (!v) throw new Error('useUIActions outside UIProvider');
  return v;
}

/** For the components that render the sheets and the palette, and need to know whether they are open. */
export function useUI() {
  const state = useContext(StateCtx);
  const actions = useContext(ActionsCtx);
  if (!state || !actions) throw new Error('useUI outside UIProvider');
  return { ...state, ...actions };
}
