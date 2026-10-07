import { cn } from '@/lib/utils';

/** One look for every item of the sidebar menu (pages and the donate link), so none of them reads as secondary. */
export const navItemClass = (active: boolean, collapsed: boolean) =>
  cn(
    'group relative flex h-10 items-center gap-3 rounded-field px-3 text-sm font-medium transition-colors',
    active ? 'bg-surface text-text shadow-[0_1px_3px_rgb(31_23_36/8%)] dark:bg-surface-2' : 'text-muted hover:bg-surface/60 hover:text-text dark:hover:bg-surface-2/60',
    collapsed && 'justify-center px-0',
  );
