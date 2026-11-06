import { cp, mkdir, rm } from 'node:fs/promises';

/**
 * Stage the files a browser loads into dist/.
 *
 * No bundler: the extension is three files and a manifest, so the build is a copy.
 * The release workflow zips dist/ and attaches it to a GitHub Release.
 */
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of ['manifest.json', 'README.md']) {
	await cp(new URL(entry, root), new URL(entry, dist));
}

await cp(new URL('src/', root), new URL('src/', dist), { recursive: true });

console.log('dist/ staged: manifest.json, README.md, src/');
