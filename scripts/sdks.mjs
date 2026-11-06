// Imports the SDK family's documentation into src/content/docs/sdks/, as Starlight pages, by platform:
//
//   - AudienceKit, the public member-facing SDK (lwm-luminx/audience-kit-sdk): its READMEs (Swift, Kotlin, the
//     Kotlin Multiplatform core) and changelog. From .sdk/ (CI's checkout), else ../audience-kit-sdk, else a shallow
//     clone into .sdk/.
//   - StaffKit, the private staff-side SDK (lwm-luminx/staff-kit): its READMEs (Swift, Android), the binary package's
//     README and changelog. From .staff-kit/ (CI's checkout, when it has a token), else ../staff-kit; whichever is
//     found refreshes the committed snapshot in vendor/staff-kit/, and the pages are always rendered from the
//     snapshot, so the site builds without access to the private repository.
//
// Links between imported files become site links; links to anything else in a repository point at GitHub. The
// landing page, sdks/index.md, is written here too, with each SDK's version.
//
//   node scripts/sdks.mjs
//   node scripts/sdks.mjs --audience-kit path/to/audience-kit-sdk --staff-kit path/to/staff-kit
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(site, 'src/content/docs/sdks');
const { values: args } = parseArgs({ options: { 'audience-kit': { type: 'string' }, 'staff-kit': { type: 'string' } } });

// Each SDK repository: where its files come from, and which files become which pages.
// `slug` is the page's path under /sdks/; `order` its place in its sidebar group (astro.config.mjs lists the groups).
const SDKS = [
	{
		key: 'audience-kit-sdk',
		name: 'AudienceKit',
		repo: 'https://github.com/lwm-luminx/audience-kit-sdk',
		public: true,
		pages: {
			'README.md': { slug: 'audiencekit', label: 'AudienceKit SDK', order: 1, description: 'The open-source AudienceKit SDK for Swift and Kotlin: one repository, one version.' },
			'swift/README.md': { slug: 'swift/audiencekit', label: 'AudienceKit', order: 1, description: 'AudienceCore, AudienceKit and AudienceKitUI: the Swift package for iOS 16+, macOS 13+ and Linux.' },
			'android/README.md': { slug: 'kotlin/audiencekit', label: 'AudienceKit', order: 1, description: 'The audiencekit Kotlin client (plain JVM) and audiencekit-android, for Android 8.0+.' },
			'core/README.md': { slug: 'kotlin/core', label: 'Kotlin Multiplatform core', order: 2, description: 'audiencekit-core, the Kotlin Multiplatform code shared by the JVM, Android and Apple targets.' },
			'CHANGELOG.md': { slug: 'changelog/audiencekit', label: 'AudienceKit', order: 1, description: 'Every release of the AudienceKit SDK, Swift and Kotlin together.' },
		},
	},
	{
		key: 'staff-kit',
		name: 'StaffKit',
		repo: 'https://github.com/lwm-luminx/staff-kit',
		public: false,
		pages: {
			'README.md': { slug: 'staffkit', label: 'StaffKit SDK', order: 2, description: 'The private StaffKit SDK behind Focus, Velvet, Backstage and Arbiter, for Swift and Android.' },
			'swift/README.md': { slug: 'swift/staffkit', label: 'StaffKit', order: 2, description: 'StaffKitCore, StaffKit, StaffKitServices, StaffKitUI, StaffOnboarding and ArbiterUI: the staff-side Swift modules.' },
			'docs/BINARY_PACKAGE_README.md': { slug: 'swift/staffkit-binaries', label: 'StaffKit binary package', order: 3, description: 'Add StaffKit to an app outside the staff-kit repository as prebuilt XCFrameworks.' },
			'android/README.md': { slug: 'kotlin/staffkit', label: 'StaffKit', order: 3, description: 'com.audiencekit:staffkit, the staff calls for Android as extensions of the member client.' },
			'CHANGELOG.md': { slug: 'changelog/staffkit', label: 'StaffKit', order: 2, description: 'Every release of StaffKit.' },
		},
	},
];

// Where a repository's files are read from: a checkout, or (StaffKit) the committed snapshot.
function locate(sdk) {
	const arg = args[sdk.key === 'audience-kit-sdk' ? 'audience-kit' : 'staff-kit'];
	if (arg) return { dir: resolve(arg), checkout: true };
	for (const dir of [join(site, `.${sdk.key}`), join(site, '.sdk'), resolve(site, '..', sdk.key)]) {
		if (existsSync(join(dir, 'VERSION')) && existsSync(join(dir, 'README.md')) && (dir !== join(site, '.sdk') || sdk.key === 'audience-kit-sdk')) return { dir, checkout: true };
	}
	if (sdk.public) {
		execFileSync('git', ['clone', '--depth', '1', `${sdk.repo}.git`, join(site, '.sdk')], { stdio: 'inherit' });
		return { dir: join(site, '.sdk'), checkout: true };
	}
	const vendored = join(site, 'vendor', sdk.key);
	if (!existsSync(join(vendored, 'VERSION'))) return null;
	return { dir: vendored, checkout: false };
}

// Copies the files the pages need (and VERSION) from a checkout of a private repository into vendor/, so the next
// build without the checkout has them.
function snapshot(sdk, dir) {
	const vendored = join(site, 'vendor', sdk.key);
	rmSync(vendored, { recursive: true, force: true });
	mkdirSync(vendored, { recursive: true });
	for (const file of [...Object.keys(sdk.pages), 'VERSION']) {
		mkdirSync(join(vendored, dirname(file)), { recursive: true });
		cpSync(join(dir, file), join(vendored, file));
	}
	const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
	writeFileSync(join(vendored, 'SNAPSHOT.md'), `Snapshot of ${sdk.repo} at ${commit}, taken by scripts/sdks.mjs on ${new Date().toISOString().slice(0, 10)}. Refresh it by running the script with a checkout of the repository available.\n`);
}

const quote = (text) => JSON.stringify(text);
const allPages = Object.fromEntries(SDKS.flatMap((sdk) => Object.entries(sdk.pages).map(([file, page]) => [`${sdk.key}/${file}`, page])));

function rewriteLinks(sdk, dir, markdown, from) {
	return markdown.replace(/(\]\()([^)\s]+)(\))/g, (match, open, target, close) => {
		if (/^([a-z]+:|#|\/)/i.test(target)) return match;
		const [path, hash = ''] = target.split('#');
		const file = posix.normalize(posix.join(posix.dirname(from), path));
		const anchor = hash ? `#${hash}` : '';
		const page = allPages[`${sdk.key}/${file}`];
		if (page) return `${open}/sdks/${page.slug}/${anchor}${close}`;
		// StaffKit's submodule is the public SDK: its files are documented here too.
		const inSubmodule = file.match(/^audience-kit-sdk\/(.+)$/);
		if (inSubmodule && allPages[`audience-kit-sdk/${inSubmodule[1]}`]) return `${open}/sdks/${allPages[`audience-kit-sdk/${inSubmodule[1]}`].slug}/${anchor}${close}`;
		const kind = existsSync(join(dir, file)) && !/\.[a-z0-9]+$/i.test(file) ? 'tree' : 'blob';
		return `${open}${sdk.repo}/${kind}/main/${file}${anchor}${close}`;
	});
}

// Only this script's pages are replaced: the bundle's Ruby page (sdks/ruby.md) lives in the same directory.
for (const page of [...Object.values(allPages), { slug: 'index' }]) rmSync(join(out, `${page.slug}.md`), { force: true });
mkdirSync(out, { recursive: true });
const versions = {};
const imported = new Set();
for (const sdk of SDKS) {
	const found = locate(sdk);
	if (!found) {
		// A private SDK without a checkout or a snapshot: its pages are left out, and the landing page says so.
		console.log(`${sdk.name}: no checkout and no snapshot in vendor/${sdk.key}, so its pages are not built`);
		continue;
	}
	imported.add(sdk.key);
	const { dir, checkout } = found;
	if (checkout && !sdk.public) snapshot(sdk, dir);
	const source = sdk.public || checkout ? dir : join(site, 'vendor', sdk.key);
	const version = readFileSync(join(source, 'VERSION'), 'utf8').trim();
	versions[sdk.key] = version;
	for (const [from, page] of Object.entries(sdk.pages)) {
		let body = readFileSync(join(source, from), 'utf8');
		const h1 = body.match(/^# (.+)\n+/);
		const title = h1 ? h1[1] : page.label;
		if (h1) body = body.slice(h1[0].length);
		const note = sdk.public
			? `<!-- Imported by scripts/sdks.mjs from ${from} in ${sdk.key} ${version}. Edit it there. -->`
			: `<!-- Imported by scripts/sdks.mjs from ${from} in ${sdk.key} ${version} (snapshot in vendor/${sdk.key}). Edit it there. -->`;
		const frontmatter = [
			'---',
			`title: ${quote(title)}`,
			`description: ${quote(page.description)}`,
			'sidebar:',
			`  label: ${quote(page.label)}`,
			`  order: ${page.order}`,
			`editUrl: ${quote(`${sdk.repo}/edit/main/${from}`)}`,
			'---',
			'',
			note,
			'',
		].join('\n');
		const target = join(out, `${page.slug}.md`);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, frontmatter + rewriteLinks(sdk, source, body, from));
	}
	console.log(`Imported ${Object.keys(sdk.pages).length} pages from ${sdk.key} ${version}${checkout ? '' : ' (snapshot)'}`);
}

// The landing page: the family, by platform, with versions.
const ak = versions['audience-kit-sdk'];
const staff = imported.has('staff-kit');
const staffRow = staff
	? `| A staff tool: the door, listings, chat moderation, decisions (Focus, Velvet, Backstage, Arbiter) | [StaffKit for Swift](/sdks/swift/staffkit/), also as a [binary package](/sdks/swift/staffkit-binaries/) | [StaffKit for Android](/sdks/kotlin/staffkit/) | ${versions['staff-kit']} ([changelog](/sdks/changelog/staffkit/)) |`
	: '| A staff tool: the door, listings, chat moderation, decisions (Focus, Velvet, Backstage, Arbiter) | StaffKit for Swift, from [lwm-luminx/staff-kit](https://github.com/lwm-luminx/staff-kit) | StaffKit for Android, from the same repository | |';
writeFileSync(
	join(out, 'index.md'),
	`---
title: SDKs
description: The AudienceKit SDK family for iOS, macOS and Android, and what each package is for.
sidebar:
  order: 0
  label: Overview
editUrl: false
---

<!-- Generated by scripts/sdks.mjs. Do not edit by hand. -->

Two SDKs, each for Swift and Kotlin, released together on one version per repository. Pick by what your app is:

| Your app | iOS and macOS | Android | Version |
| --- | --- | --- | --- |
| An audience's own app, for its members (Hot Mess, Hack Different) | [AudienceKit for Swift](/sdks/swift/audiencekit/) | [AudienceKit for Kotlin](/sdks/kotlin/audiencekit/) | ${ak} ([changelog](/sdks/changelog/audiencekit/)) |
${staffRow}
| A server or script | [Ruby](/sdks/ruby/) | | |

## AudienceKit

[AudienceKit](/sdks/audiencekit/) is open source (MIT) at [lwm-luminx/audience-kit-sdk](https://github.com/lwm-luminx/audience-kit-sdk). It signs people in, then reads the audience as the [consumer view](/reference/graphql/) serves it: venues, people, locales, events, lineups, chat, cover, and the audience's branding. Swift ships as a package (\`AudienceCore\`, \`AudienceKit\`, \`AudienceKitUI\`) resolved by version tag; Kotlin as \`com.audiencekit:audiencekit\` and \`audiencekit-android\`, built from a checkout until it is published to Maven; and the [Kotlin Multiplatform core](/sdks/kotlin/core/) is the code both share.

## StaffKit

${staff ? '[StaffKit](/sdks/staffkit/)' : 'StaffKit'} is private at [lwm-luminx/staff-kit](https://github.com/lwm-luminx/staff-kit) and builds on AudienceKit. It adds the staff session (the platform sign-in and the chosen audience, shared between the staff apps), and the calls of the [staff view](/reference/staffql/): venue and talent management, the door, chat moderation and the decision queue. Swift apps outside the repository add it as a ${staff ? '[binary package](/sdks/swift/staffkit-binaries/)' : 'binary package'} of prebuilt XCFrameworks; Android adds \`com.audiencekit:staffkit\` as extension functions on the member client.${staff ? '' : ' Its pages are published from its own repository.'}

## Which endpoint

AudienceKit calls the audience's \`graphql\` endpoint, StaffKit its \`staffql\` endpoint. The two serve the same graph; [GraphQL](/api/graphql/) explains the difference, and the SDKs' door and management calls always use \`staffql\`.

## Versions and the API

Each SDK sends its version with every call, and the API refuses versions older than its minimum, so keep up with the changelogs. Clients that track the API's \`next\` branch can validate their documents against [/graphql/next/](/graphql/manifest.json) in CI (see [Validate documents](/api/validate-documents/)).
`,
);
writeFileSync(join(site, 'src/sdk.json'), `${JSON.stringify(versions, null, 2)}\n`);
console.log(`Wrote /sdks/ (AudienceKit ${ak}${staff ? `, StaffKit ${versions['staff-kit']}` : ''})`);
