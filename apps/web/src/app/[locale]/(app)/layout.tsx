import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { MobileNav } from '@/components/shell/mobile-nav';
import { CommandPalette } from '@/components/shell/command-palette';
import { ConsentGate } from '@/components/legal/consent-gate';
import { AuthGate } from '@/components/shell/auth-gate';
import { DonateProvider } from '@/components/shell/donate';
import { getDonateUrl } from '@/lib/donate';
import { UIProvider } from '@/components/shell/ui-context';
import { ThemeSync } from '@/components/shell/theme-sync';
import { QuickAddSheet } from '@/components/applications/quick-add';
import { ApplicationSheet } from '@/components/applications/application-sheet';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DonateProvider url={getDonateUrl()}>
    <UIProvider>
      <AuthGate>
      <ThemeSync />
      <ConsentGate />
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12">{children}</main>
        </div>
      </div>
      <MobileNav />
      <QuickAddSheet />
      <ApplicationSheet />
      <CommandPalette />
      </AuthGate>
    </UIProvider>
    </DonateProvider>
  );
}
