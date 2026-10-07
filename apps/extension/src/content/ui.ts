declare const __E2E__: boolean;

/** In-page notices (shadow DOM, so the board's CSS can't touch them and ours can't leak into the board). */
const RU = /^ru\b/i.test(navigator.language);
const HOST_ID = 'heyreply-toast';

const CSS = `.box{position:fixed;right:20px;bottom:20px;z-index:2147483647;display:flex;flex-direction:column;gap:2px;max-width:340px;padding:12px 16px;border-radius:12px;background:#2a1633;color:#fff;font:13px/1.35 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28);border-left:4px solid #e0457b;animation:in .25s ease-out}b{font-weight:600}span{opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row{display:flex;gap:8px;margin-top:8px}button{all:unset;cursor:pointer;padding:5px 12px;border-radius:8px;font-weight:600;background:#e0457b;color:#fff}button.no{background:rgba(255,255,255,.12)}button:focus-visible{outline:2px solid #fff;outline-offset:2px}@keyframes in{from{opacity:0;transform:translateY(8px)}}@media(prefers-reduced-motion:reduce){.box{animation:none}}`;

function mount(build: (box: HTMLDivElement) => void): HTMLElement {
  document.getElementById(HOST_ID)?.remove();
  const host = document.createElement('div');
  host.id = HOST_ID;
  // Open only in test builds, so Playwright can press the prompt's buttons
  const root = host.attachShadow({ mode: __E2E__ ? 'open' : 'closed' });
  const box = document.createElement('div');
  box.className = 'box';
  build(box);
  const style = document.createElement('style');
  style.textContent = CSS;
  root.append(style, box);
  document.documentElement.append(host);
  return host;
}

function lines(box: HTMLElement, title: string, text: string) {
  const b = document.createElement('b');
  b.textContent = title;
  const span = document.createElement('span');
  span.textContent = text;
  box.append(b, span);
}

export function toast(msg: { companyName: string; positionName: string; count: number }) {
  const more = msg.count > 1 ? (RU ? ` и ещё ${msg.count - 1}` : ` and ${msg.count - 1} more`) : '';
  const host = mount((box) => {
    box.setAttribute('role', 'status');
    lines(box, RU ? 'Отклик сохранён в heyreply' : 'Application saved to heyreply', `${msg.companyName} · ${msg.positionName}${more}`);
  });
  setTimeout(() => host.remove(), 5000);
}

export type AskReason = 'external' | 'unconfirmed';

/**
 * Asks whether the user really applied, when the extension saw the attempt but can't see the result: the apply form
 * lives on the employer's site, or the board didn't confirm the submission. Resolves false on "No" or when ignored.
 */
export function ask(reason: AskReason, vacancy: { companyName: string; positionName: string }): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (yes: boolean) => {
      if (done) return;
      done = true;
      host.remove();
      resolve(yes);
    };
    const title =
      reason === 'external'
        ? RU ? 'Вы откликнулись на сайте работодателя?' : 'Did you apply on the employer’s site?'
        : RU ? 'Отклик отправлен?' : 'Did your application go through?';
    const host = mount((box) => {
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'heyreply');
      lines(box, title, `${vacancy.companyName} · ${vacancy.positionName}`);
      const row = document.createElement('div');
      row.className = 'row';
      const yes = document.createElement('button');
      yes.textContent = RU ? 'Да, сохранить' : 'Yes, save it';
      yes.addEventListener('click', () => finish(true));
      const no = document.createElement('button');
      no.className = 'no';
      no.textContent = RU ? 'Нет' : 'No';
      no.addEventListener('click', () => finish(false));
      row.append(yes, no);
      box.append(row);
    });
    setTimeout(() => finish(false), 45_000);
  });
}
