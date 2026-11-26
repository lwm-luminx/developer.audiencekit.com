// Installs the AudienceKit API's documentation bundle into the site: its pages into src/content/docs/, its theme into
// src/theme/, and its schema dumps and validator into public/graphql/ (served at /graphql/… for client repositories'
// CI). The bundle is exported by the private audience_kit_api repository (bin/developer-docs.mjs) on every build of
// its main and next branches, and committed to this repository as bundles/main/ and bundles/next/.
//
//   node scripts/bundle.mjs                      # bundles/
//   node scripts/bundle.mjs ../audience_kit_api  # export from a local checkout of the API (to preview a docs change)
//   node scripts/bundle.mjs path/to/bundle       # one bundle directory (one with a manifest.json)
//
// The site is built from the main bundle (production). The next bundle's schema dumps are served too, at
// /graphql/next/…, for clients that track the API's next branch.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The content directories the bundle owns. Everything in them is replaced on each run (and not committed).
const OWNED = ['start', 'api', 'guides'];
// Pages the API's bundle still carries that the site imports from elsewhere: the Ruby gem's docs come from
// audience-kit-sdk (scripts/sdks.mjs), like every other SDK's.
const IMPORTED_ELSEWHERE = ['pages/sdks/ruby.md'];

const isBundle = (dir) => existsSync(join(dir, 'manifest.json'));
// The exporter in an audience_kit_api checkout, or in the retired audience-kit monorepo's api/ submodule.
const exporter = (dir) => [join(dir, 'bin/developer-docs.mjs'), join(dir, 'api/bin/developer-docs.mjs')].find((path) => existsSync(path));

function exportFrom(checkout, channel) {
	const out = join(site, '.bundles', channel);  // gitignored
	execFileSync('node', [exporter(checkout), '--out', out, '--channel', channel], { stdio: 'inherit' });
	return out;
}

function locate(arg, channel) {
	if (arg) {
		const dir = resolve(arg);
		if (isBundle(join(dir, channel))) return join(dir, channel);
		if (isBundle(dir)) return channel === 'main' ? dir : null;
		if (exporter(dir)) {
			// The checkout stands in for production; next's schemas still come from bundles/next.
			if (channel === 'main') return exportFrom(dir, 'local');
		} else throw new Error(`${arg} is neither a bundle, a directory of bundles, nor an audience_kit_api checkout`);
	}
	const committed = join(site, 'bundles', channel);
	if (isBundle(committed)) return committed;
	if (channel === 'main') throw new Error('bundles/main/ is missing; pass a bundle or an audience_kit_api checkout');
	return null;
}

function verify(dir) {
	const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
	if (manifest.format !== 1) throw new Error(`${dir}: bundle format ${manifest.format} is not supported (expected 1)`);
	for (const [path, sha] of Object.entries(manifest.files)) {
		const actual = createHash('sha256').update(readFileSync(join(dir, path))).digest('hex');
		if (actual !== sha) throw new Error(`${dir}/${path} does not match its manifest checksum`);
	}
	return manifest;
}

const arg = process.argv[2];
const mainDir = locate(arg, 'main');
const main = verify(mainDir);

const content = join(site, 'src/content/docs');
for (const owned of OWNED) rmSync(join(content, owned), { recursive: true, force: true });
cpSync(join(mainDir, 'pages'), content, {
	recursive: true,
	filter: (from) => !IMPORTED_ELSEWHERE.some((page) => from === join(mainDir, page)),
});
// Pages the API's bundle may still carry that are for the team, not the public (Rick, 2026-11-24: "remove Deploy to
// Heroku and any internal info"). The API moved them out of its bundle; this keeps older bundles from publishing them.
const INTERNAL = ['pages/guides/deploy-heroku.md', 'pages/start/local-development.md', 'pages/guides/researcher.md'];
for (const page of INTERNAL) rmSync(join(content, page.slice('pages/'.length)), { force: true });
// The pages' source is in the private API repository, so they get no "Edit page" link.
for (const page of main.pages.filter((page) => !INTERNAL.includes(page) && !IMPORTED_ELSEWHERE.includes(page))) {
	const path = join(content, page.slice('pages/'.length));
	writeFileSync(path, readFileSync(path, 'utf8').replace(/^---\n/, '---\neditUrl: false\n'));
}

rmSync(join(site, 'src/theme'), { recursive: true, force: true });
cpSync(join(mainDir, 'theme'), join(site, 'src/theme'), { recursive: true });

const graphql = join(site, 'public/graphql');
rmSync(graphql, { recursive: true, force: true });
cpSync(join(mainDir, 'graphql'), graphql, { recursive: true });

const nextDir = locate(arg, 'next');
const next = nextDir ? verify(nextDir) : null;
if (next) cpSync(join(nextDir, 'graphql'), join(graphql, 'next'), { recursive: true });

// What the site was built from, for the footer and for anyone debugging a stale page.
const summary = (m) => m && { version: m.version, commit: m.commit, apiVersion: m.apiVersion, views: m.views };
writeFileSync(join(site, 'src/bundle.json'), `${JSON.stringify({ main: summary(main), next: summary(next) }, null, 2)}\n`);
writeFileSync(join(graphql, 'manifest.json'), `${JSON.stringify({ main: summary(main), next: summary(next) }, null, 2)}\n`);
console.log(`Installed ${main.version}${next ? ` (+ next ${next.version} schemas)` : ''}`);
