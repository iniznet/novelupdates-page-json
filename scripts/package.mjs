import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

/**
 * Stage the extension twice, once per browser.
 *
 * The scripts are the same. Only the manifest differs: Chrome ignores an
 * unknown key but warns about it, and Firefox refuses to load a build with no
 * gecko id. dist/<target>/ is what "Load unpacked" points at, and the release
 * workflow zips each one.
 */
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const base = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));

const targets = {
	chrome: (manifest) => {
		const { browser_specific_settings, ...rest } = manifest;

		return rest;
	},
	firefox: (manifest) => manifest
};

await rm(dist, { recursive: true, force: true });

for (const [target, shape] of Object.entries(targets)) {
	const out = new URL(`${target}/`, dist);

	await mkdir(out, { recursive: true });
	await writeFile(new URL('manifest.json', out), `${JSON.stringify(shape(base), null, 2)}\n`);
	await cp(new URL('src/', root), new URL('src/', out), { recursive: true });
	await cp(new URL('README.md', root), new URL('README.md', out));

	console.log(`dist/${target}/ ready`);
}

console.log(`version ${base.version}`);
