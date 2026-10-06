'use client';
import { Popover as P, DropdownMenu as D, Tooltip as T } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ className, align = 'start', sideOffset = 6, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        className={cn('z-[70] rounded-[14px] border border-border bg-surface p-1.5 shadow-pop outline-none animate-fade-up', className)}
        {...props}
      />
    </P.Portal>
  );
}

export const Menu = D.Root;
export const MenuTrigger = D.Trigger;
export function MenuContent({ className, align = 'end', ...props }: React.ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Content
        align={align}
        sideOffset={6}
        className={cn('z-[70] min-w-48 rounded-[14px] border border-border bg-surface p-1.5 shadow-pop animate-fade-up', className)}
        {...props}
      />
    </D.Portal>
  );
}
export function MenuItem({ className, ...props }: React.ComponentProps<typeof D.Item>) {
  return (
    <D.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted',
        className,
      )}
      {...props}
    />
  );
}
export const MenuSeparator = () => <D.Separator className="my-1 h-px bg-border" />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => (
  <D.Label className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-subtle uppercase">{children}</D.Label>
);

export function Tip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-[80] rounded-[8px] bg-text px-2.5 py-1.5 text-xs text-bg shadow-pop">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
export const TipProvider = T.Provider;
