'use client';
import { Dialog } from 'radix-ui';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 440,
  header,
  onEscapeKeyDown,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  header?: React.ReactNode;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
}) {
  const tc = useTranslations('common');
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(31_23_36/28%)] backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-[fade-up_200ms_ease] dark:bg-black/50" />
        <Dialog.Content
          onEscapeKeyDown={onEscapeKeyDown}
          style={{ ['--w' as string]: `${width}px` }}
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-pop outline-none',
            // mobile: bottom sheet
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-panel border-t border-border',
            // desktop: right side panel
            'md:inset-y-3 md:right-3 md:left-auto md:bottom-3 md:max-h-none md:w-[var(--w)] md:rounded-panel md:border',
            'data-[state=open]:animate-[sheet-in_220ms_cubic-bezier(.2,.8,.2,1)]',
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong md:hidden" />
          {header ?? (
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 pt-5 pb-4">
              <div>
                <Dialog.Title className="font-display text-lg font-medium tracking-tight">{title}</Dialog.Title>
                {description ? <Dialog.Description className="mt-1 text-[13px] text-muted">{description}</Dialog.Description> : null}
              </div>
              <Dialog.Close className="rounded-[8px] p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label={tc('close')}>
                <X className="size-4" />
              </Dialog.Close>
            </div>
          )}
          {header ? (
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
          ) : null}
          {!description ? <Dialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</Dialog.Description> : null}
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? <div className="border-t border-border px-6 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
      <style>{`@keyframes sheet-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}@media (max-width:767px){@keyframes sheet-in{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}}`}</style>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  danger,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[61] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-border bg-surface p-6 shadow-pop animate-fade-up">
          <Dialog.Title className="font-display text-base font-medium">{title}</Dialog.Title>
          {description ? <Dialog.Description className="mt-2 text-sm text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close className="h-10 rounded-field border border-border-strong px-4 text-sm hover:bg-surface-2">{cancelLabel}</Dialog.Close>
            <button
              autoFocus
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={cn('h-10 rounded-field px-4 text-sm font-medium text-white', danger ? 'bg-danger' : 'bg-primary text-primary-fg')}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
