/**
 * Runs in the page's own JS world (the content-script world can't see the page's network calls).
 * It only observes: when a state-changing request that looks like "apply" succeeds, the isolated content script is told
 * (via a DOM event) which URL/body it was, so it can work out the vacancy and record the application in real time.
 */
const APPLY_URL = /apply|applic|response|negotiat|otklik|candidat|submit/i;
const MAX_BODY = 4000;

// GraphQL-style APIs hide the intent in the operation name rather than the URL
const APPLY_OPERATION = /apply|application|otklik|отклик/i;

function emit(method: string, url: string, body: string) {
  if (method === 'GET' || method === 'HEAD' || !(APPLY_URL.test(url) || APPLY_OPERATION.test(body.slice(0, 400)))) return;
  window.dispatchEvent(new CustomEvent('heyreply:apply', { detail: JSON.stringify({ url: url.slice(0, 1000), body: body.slice(0, MAX_BODY) }) }));
}

function bodyText(body: unknown): string {
  try {
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (body instanceof FormData) return [...body.entries()].map(([k, v]) => (typeof v === 'string' ? `${k}=${v}` : k)).join('&');
  } catch {
    /* unreadable body */
  }
  return '';
}

const nativeFetch = window.fetch;
window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
  const promise = nativeFetch.call(this, input, init);
  try {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = input instanceof Request ? input.url : String(input);
    const body = bodyText(init?.body);
    promise.then((res) => res.ok && emit(method, url, body)).catch(() => {});
  } catch {
    /* never break the page */
  }
  return promise;
};

const open = XMLHttpRequest.prototype.open;
const send = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function (this: XMLHttpRequest & { __hr?: { method: string; url: string } }, method: string, url: string | URL, ...rest: unknown[]) {
  this.__hr = { method: method.toUpperCase(), url: String(url) };
  return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
} as typeof XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.send = function (this: XMLHttpRequest & { __hr?: { method: string; url: string } }, body?: Document | XMLHttpRequestBodyInit | null) {
  try {
    const meta = this.__hr;
    if (meta) this.addEventListener('load', () => this.status >= 200 && this.status < 300 && emit(meta.method, meta.url, bodyText(body)));
  } catch {
    /* never break the page */
  }
  return send.call(this, body);
};
export {};
