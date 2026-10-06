'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { TipProvider } from './ui/popover';
import { ApiError } from '@/lib/api';

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    // Enable color transitions only after the first paint, so theme hydration never flashes.
    const id = requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <Toaster
      theme={(resolvedTheme as 'light' | 'dark') ?? 'light'}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: '!rounded-[14px] !border-border !bg-surface !text-text !shadow-pop !font-sans',
          description: '!text-muted',
          actionButton: '!bg-primary !text-primary-fg !rounded-[8px]',
        },
      }}
    />
  );
}

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
        <TipProvider>
          {children}
          <ThemedToaster />
        </TipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
