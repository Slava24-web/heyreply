import {
  BadgeCheck,
  CircleSlash,
  Eye,
  FileCode2,
  Hourglass,
  PhoneCall,
  Send,
  Star,
  Undo2,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { AppStatus } from '@heyreply/shared';

export type BadgeVariant = 'outline' | 'soft' | 'solid' | 'dashed' | 'muted';

export const STATUS_META: Record<AppStatus, { color: string; icon: LucideIcon; variant: BadgeVariant }> = {
  APPLIED: { color: 'var(--st-applied)', icon: Send, variant: 'outline' },
  VIEWED: { color: 'var(--st-viewed)', icon: Eye, variant: 'soft' },
  SCREENING: { color: 'var(--st-screening)', icon: PhoneCall, variant: 'soft' },
  TEST_TASK: { color: 'var(--st-test)', icon: FileCode2, variant: 'soft' },
  INTERVIEW: { color: 'var(--st-interview)', icon: Users, variant: 'solid' },
  FINAL_INTERVIEW: { color: 'var(--st-interview)', icon: UsersRound, variant: 'solid' },
  OFFER: { color: 'var(--st-offer)', icon: Star, variant: 'solid' },
  ACCEPTED: { color: 'var(--st-offer)', icon: BadgeCheck, variant: 'solid' },
  REJECTED: { color: 'var(--st-rejected)', icon: CircleSlash, variant: 'muted' },
  DECLINED: { color: 'var(--st-declined)', icon: Undo2, variant: 'outline' },
  NO_RESPONSE: { color: 'var(--st-noresponse)', icon: Hourglass, variant: 'dashed' },
};

export const STAGE_LABEL_KEYS = ['applied', 'screening', 'test', 'interview', 'offer'] as const;
