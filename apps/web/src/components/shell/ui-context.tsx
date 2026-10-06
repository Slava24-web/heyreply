'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CreateApplicationInput } from '@heyreply/shared';

interface UIState {
  quickAddOpen: boolean;
  quickAddPrefill: Partial<CreateApplicationInput> | null;
  openQuickAdd: (prefill?: Partial<CreateApplicationInput>) => void;
  closeQuickAdd: () => void;
  appId: string | null;
  openApp: (id: string) => void;
  closeApp: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

const Ctx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddPrefill, setPrefill] = useState<Partial<CreateApplicationInput> | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openQuickAdd = useCallback((prefill?: Partial<CreateApplicationInput>) => {
    setPrefill(prefill ?? null);
    setQuickAddOpen(true);
  }, []);

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

  const value = useMemo<UIState>(
    () => ({
      quickAddOpen,
      quickAddPrefill,
      openQuickAdd,
      closeQuickAdd: () => setQuickAddOpen(false),
      appId,
      openApp: setAppId,
      closeApp: () => setAppId(null),
      paletteOpen,
      setPaletteOpen,
    }),
    [quickAddOpen, quickAddPrefill, openQuickAdd, appId, paletteOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI outside UIProvider');
  return v;
}
