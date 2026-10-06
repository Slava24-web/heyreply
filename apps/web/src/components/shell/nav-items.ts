import { BarChart3, BookMarked, Briefcase, LayoutDashboard, ListChecks, MapPin, Radio, Settings, Wallet } from 'lucide-react';

export const NAV = [
  { href: '/dashboard', key: 'overview', icon: LayoutDashboard },
  { href: '/applications', key: 'applications', icon: ListChecks },
] as const;

export const ANALYTICS_NAV = [
  { href: '/analytics/sources', key: 'sources', icon: Radio },
  { href: '/analytics/positions', key: 'positions', icon: Briefcase },
  { href: '/analytics/locations', key: 'locations', icon: MapPin },
  { href: '/analytics/salary', key: 'salary', icon: Wallet },
] as const;

export const BOTTOM_NAV = [
  { href: '/dictionaries', key: 'dictionaries', icon: BookMarked },
  { href: '/settings', key: 'settings', icon: Settings },
] as const;

export const AnalyticsIcon = BarChart3;
