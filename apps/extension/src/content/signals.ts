import type { Adapter } from '../types';

/** Words on a control that starts an application. */
export const APPLY_LABEL = /откликнуть|отправить\s+(отклик|заявк|резюме)|подать\s+заявк|easy\s+apply|\bapply\b|submit\s+(your\s+)?application|send\s+application/i;
/** Boards' own test hooks on apply controls (hh's data-qa, React test ids). */
export const APPLY_HOOK = '[data-qa*="response"], [data-qa*="apply"], [data-test*="apply"], [data-testid*="apply"]';

/** "Apply on company website", "Откликнуться на сайте работодателя": the application itself happens off the board. */
const EXTERNAL_LABEL =
  /на\s+сайте\s+(компании|работодателя)|на\s+сайт[еі]\s+(компанії|роботодавця)|(company|employer'?s?|corporate)\s+(site|website|career)|apply\s+(on|at)\s+(the\s+)?(company|employer|external)|external\s+(site|apply|application)|auf\s+der\s+(firmen|unternehmens)|sur\s+le\s+site/i;

/** Whether the click is on a control that applies to a vacancy (labels can be long when they name the job). */
export function isApplyControl(el: Element, label: string): boolean {
  if (el.matches(APPLY_HOOK)) return true;
  if (!APPLY_LABEL.test(label)) return false;
  return label.length < 60 || (label.length < 160 && EXTERNAL_LABEL.test(label));
}

/**
 * The click opens the employer's own site: either the control says so, or it is a link off the board. What happens
 * there is invisible to the extension, so it asks the user once they come back instead of guessing.
 */
export function leavesBoard(el: Element, label: string, adapter: Adapter, here: URL): boolean {
  if (EXTERNAL_LABEL.test(label)) return true;
  const href = el.closest('a[href]')?.getAttribute('href');
  if (!href) return false;
  try {
    const to = new URL(href, here);
    return /^https?:$/.test(to.protocol) && !adapter.hosts.test(to.hostname);
  } catch {
    return false;
  }
}

/**
 * Analytics and logging calls carry job ids and event names like "apply_click" but never mean the application went
 * through; they are ignored before anything else looks at them.
 */
export const TELEMETRY_URL =
  /\/(?:track(?:ing)?|analytics|metrics|telemetry|beacons?|collect|logs?|events?|stats|pixel|rum|impressions?|clickstream)(?:[/?.]|$)|\/li\/track|doubleclick|google-analytics|googletagmanager|mc\.yandex|\/clck\/|sentry|segment\.(?:io|com)|amplitude|mixpanel|hotjar|datadoghq|newrelic/i;

/** Network calls that look like an application being sent (URL or GraphQL operation name). */
const APPLY_URL = /apply|applic|response|negotiat|otklik|candidat|submit/i;
const APPLY_OPERATION = /apply|application|otklik|отклик/i;

export function isApplyRequest(method: string, url: string, body: string): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  if (TELEMETRY_URL.test(url)) return false;
  return APPLY_URL.test(url) || APPLY_OPERATION.test(body.slice(0, 400));
}
