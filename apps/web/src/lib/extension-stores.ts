/**
 * Where to install the browser extension, set per deployment (the listings only exist after the store review).
 * Server-side only; only https links to the expected store are accepted, so a mistyped or hostile value can't become a script URL.
 */
export interface ExtensionStores {
  chrome: string | null;
  firefox: string | null;
}

function storeUrl(raw: string | undefined, hosts: string[]): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getExtensionStores(): ExtensionStores {
  return {
    chrome: storeUrl(process.env.EXTENSION_CHROME_URL, ['chromewebstore.google.com', 'chrome.google.com']),
    firefox: storeUrl(process.env.EXTENSION_FIREFOX_URL, ['addons.mozilla.org']),
  };
}
