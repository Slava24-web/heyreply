// Generates the raster brand assets from the logo mark: app icons, the apple-touch icon and the Open Graph images.
// Run after changing the logo, titles or colours:  pnpm --filter web assets:brand
// The output is committed (src/app/icon.svg, src/app/apple-icon.png, public/icons, public/og).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const PRIMARY = '#7a2e8e';
const ACCENT = '#d6336c';
const messages = Object.fromEntries(await Promise.all(['ru', 'en'].map(async (l) => [l, JSON.parse(await readFile(`messages/${l}.json`, 'utf8'))])));

/** The logo mark of components/logo.tsx on a 32 x 32 grid. */
const mark = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="9" fill="${PRIMARY}"/>
  <rect x="6.5" y="8.5" width="19" height="4" rx="2" fill="#fff" opacity=".55"/>
  <rect x="9.5" y="14.5" width="13" height="4" rx="2" fill="#fff" opacity=".8"/>
  <circle cx="16" cy="23.6" r="2.9" fill="${ACCENT}"/>
</svg>`;

await mkdir('public/icons', { recursive: true });
await mkdir('public/og', { recursive: true });
await writeFile('src/app/icon.svg', mark(32));
await sharp(Buffer.from(mark(180))).png().toFile('src/app/apple-icon.png');
for (const size of [192, 512]) await sharp(Buffer.from(mark(size))).png().toFile(`public/icons/icon-${size}.png`);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Greedy line wrapping for the SVG text (SVG has no automatic wrapping). */
function wrap(text, max) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > max) {
      lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  return [...lines, line];
}

for (const locale of ['ru', 'en']) {
  const title = wrap(messages[locale].auth.heroTitle, locale === 'ru' ? 16 : 20);
  const subtitle = wrap(messages[locale].meta.description, 58);
  const titleSvg = title.map((l, i) => `<text x="80" y="${300 + i * 96}" font-size="84" font-weight="700" fill="#f4eef6">${esc(l)}</text>`).join('');
  const subY = 300 + title.length * 96 + 20;
  const subSvg = subtitle.map((l, i) => `<text x="80" y="${subY + i * 46}" font-size="32" fill="#a99db0">${esc(l)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1a2f"/><stop offset="1" stop-color="#131015"/></linearGradient>
      <radialGradient id="glow" cx="0.85" cy="0.1" r="0.7"><stop offset="0" stop-color="${PRIMARY}" stop-opacity=".55"/><stop offset="1" stop-color="${PRIMARY}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <g transform="translate(80 70) scale(2.2)">${mark(32).replace(/<\/?svg[^>]*>/g, '')}</g>
    <text x="170" y="122" font-size="44" font-weight="600" fill="#f4eef6">heyreply</text>
    ${titleSvg}
    ${subSvg}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/og/${locale}.png`);
}
console.log('brand assets written');
