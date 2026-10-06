import { build, context } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const watch = process.argv.includes('--watch');
const zip = process.argv.includes('--zip');
// Test build: pre-grants localhost so automated runs don't need the runtime permission prompt
const e2e = process.argv.includes('--e2e');
const out = 'dist';

const ICON = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#7a2e8e"/>
  <rect x="7" y="8" width="18" height="3.4" rx="1.7" fill="#fff" opacity=".6"/>
  <rect x="10" y="14.3" width="12" height="3.4" rx="1.7" fill="#fff" opacity=".85"/>
  <circle cx="16" cy="23.2" r="2.6" fill="#e0457b"/>
</svg>`;

await rm(out, { recursive: true, force: true });
await mkdir(`${out}/icons`, { recursive: true });
for (const size of [16, 32, 48, 128]) await sharp(Buffer.from(ICON(size))).png().toFile(`${out}/icons/${size}.png`);
const manifest = JSON.parse(await (await import('node:fs/promises')).readFile('src/manifest.json', 'utf8'));
if (e2e) manifest.host_permissions = ['http://localhost/*'];
await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
await cp('src/popup/popup.html', `${out}/popup.html`);
await cp('src/popup/popup.css', `${out}/popup.css`);

const options = {
  entryPoints: { background: 'src/background.ts', content: 'src/content/index.ts', popup: 'src/popup/popup.ts' },
  outdir: out,
  bundle: true,
  format: 'iife',
  target: ['chrome120', 'firefox128'],
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  // Test builds mark pages where the content script ran (visible to Playwright); stripped from release builds
  define: { __E2E__: e2e ? 'true' : 'false' },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
  if (zip) {
    const { version } = JSON.parse(await (await import('node:fs/promises')).readFile('src/manifest.json', 'utf8'));
    const name = `heyreply-extension-${version}.zip`;
    execSync(`cd ${out} && zip -qr ../${name} .`);
    await writeFile(`${out}/.zipname`, name);
    console.log(`Packed ${name}`);
  }
}
