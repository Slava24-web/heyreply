/**
 * Injected into the active tab (activeTab + scripting) when the page has no board adapter: a company careers page,
 * an ATS the extension doesn't know. Runs in the page, so it must stay self-contained — no imports, no outer variables.
 * Order of trust: schema.org JobPosting, then the page heading, then og: tags and the document title.
 */
export function readVacancyFromPage() {
  const clean = (s: unknown) => (typeof s === 'string' ? s : '').replace(/\s+/g, ' ').trim();
  const meta = (name: string) => clean(document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content'));
  let position = '';
  let company = '';
  let place = '';
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent ?? '');
      const nodes: Record<string, unknown>[] = Array.isArray(data) ? data : data?.['@graph'] ?? [data];
      const job = nodes.find((n) => n && [n['@type']].flat().includes('JobPosting'));
      if (!job) continue;
      const org = job.hiringOrganization as { name?: string } | string | undefined;
      const loc = [job.jobLocation].flat()[0] as { address?: { addressLocality?: string; addressRegion?: string } } | undefined;
      position = clean(job.title);
      company = clean(typeof org === 'string' ? org : org?.name);
      place = clean(loc?.address?.addressLocality || loc?.address?.addressRegion);
      break;
    } catch {
      /* malformed block */
    }
  }
  // "Frontend Developer at Acme | Careers", "Frontend Developer — Acme"
  const title = meta('og:title') || clean(document.title);
  const at = title.match(/^(.+?)\s+(?:at|@|в|в компании|bei|chez)\s+(.+?)(?:\s+[|·—–-]\s+.*)?$/i);
  const parts = title.split(/\s+[|·—–-]\s+/).map(clean).filter(Boolean);
  position ||= clean(document.querySelector('h1')?.textContent) || at?.[1] || parts[0] || '';
  company ||= at?.[2] || meta('og:site_name') || (parts.length > 1 ? parts[parts.length - 1] : '');
  return {
    positionName: position.slice(0, 160),
    companyName: company.slice(0, 160),
    locationName: place || null,
    vacancyUrl: /^https?:$/.test(location.protocol) ? location.href : null,
  };
}
