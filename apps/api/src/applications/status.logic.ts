import { STATUS_STAGE, type AppStatus } from '@heyreply/shared';

const NOT_A_RESPONSE: AppStatus[] = ['APPLIED', 'VIEWED', 'NO_RESPONSE', 'DECLINED'];
const FINAL: AppStatus[] = ['ACCEPTED', 'REJECTED', 'DECLINED', 'NO_RESPONSE'];

/** Did the company respond when the application moved into this status? Rejection counts as a response. */
export const isResponse = (s: AppStatus) => !NOT_A_RESPONSE.includes(s);
export const isFinal = (s: AppStatus) => FINAL.includes(s);

export interface StatusState {
  status: AppStatus;
  maxStage: number;
  firstResponseAt: Date | null;
  finishedAt: Date | null;
}

/** Pure transition used by create, status change and bulk updates. */
export function applyTransition(prev: StatusState | null, next: AppStatus, at: Date): StatusState {
  const stage = STATUS_STAGE[next];
  return {
    status: next,
    maxStage: Math.max(prev?.maxStage ?? 1, stage),
    firstResponseAt: prev?.firstResponseAt ?? (isResponse(next) ? at : null),
    finishedAt: isFinal(next) ? at : null,
  };
}
