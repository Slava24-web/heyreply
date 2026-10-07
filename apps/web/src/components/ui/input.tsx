'use client';
import { createContext, forwardRef, useContext, useId } from 'react';
import { cn } from '@/lib/utils';

export const fieldClass =
  'w-full rounded-field border border-border bg-surface px-3 text-sm text-text placeholder:text-subtle transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:opacity-60 aria-[invalid=true]:border-danger';

/** The id a <Field> gives its label; the control inside picks it up unless it has an id or its own accessible name. */
export const FieldIdContext = createContext<string | undefined>(undefined);
export const useFieldId = (own?: { id?: string; 'aria-label'?: string; 'aria-labelledby'?: string }) => {
  const ctx = useContext(FieldIdContext);
  return own?.id ?? (own?.['aria-label'] || own?.['aria-labelledby'] ? undefined : ctx);
};

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { size_?: 'md' | 'lg' }>(
  ({ className, size_ = 'md', ...props }, ref) => {
    const id = useFieldId(props);
    return <input ref={ref} id={id} className={cn(fieldClass, size_ === 'lg' ? 'h-12 text-[15px]' : 'h-10', className)} {...props} />;
  },
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => {
  const id = useFieldId(props);
  return <textarea ref={ref} id={id} className={cn(fieldClass, 'min-h-24 resize-y py-2.5 leading-relaxed', className)} {...props} />;
});
Textarea.displayName = 'Textarea';

export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => {
  const id = useFieldId(props);
  return (
  <select
    ref={ref}
    id={id}
    className={cn(
      fieldClass,
      'h-10 cursor-pointer appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9',
      "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239a8fa2' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
      className,
    )}
    {...props}
  >
    {children}
  </select>
  );
});
NativeSelect.displayName = 'NativeSelect';

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  labelAside,
}: {
  label: React.ReactNode;
  /** Something that belongs next to the label but is not part of it (a "forgot password?" link) */
  labelAside?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-muted">
          {label}
        </label>
        {labelAside}
      </div>
      <FieldIdContext value={id}>{children}</FieldIdContext>
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-text', className)}>
      <input type="checkbox" className="size-4 cursor-pointer rounded accent-[var(--primary)]" {...props} />
      {label}
    </label>
  );
}
