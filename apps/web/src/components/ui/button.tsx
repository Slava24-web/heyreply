import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_6px_20px_-8px_var(--primary)]',
        outline: 'border border-border-strong bg-surface text-text hover:bg-surface-2',
        ghost: 'text-text hover:bg-surface-2',
        soft: 'bg-primary-soft text-primary hover:brightness-95 dark:hover:brightness-125',
        danger: 'bg-danger text-white hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-8 rounded-[8px] px-3 text-[13px]',
        md: 'h-10 rounded-field px-4 text-sm',
        lg: 'h-12 rounded-[12px] px-5 text-[15px]',
        icon: 'size-9 rounded-field',
        'icon-sm': 'size-8 rounded-[8px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
