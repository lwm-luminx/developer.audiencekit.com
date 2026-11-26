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
			'README.md': { slug: 'audiencekit', label: 'AudienceKit SDK', order: 1, description: 'The source-available AudienceKit SDK: Swift and Kotlin on one version, with Node, Python, PHP and Rust clients beside them.' },
			'swift/README.md': { slug: 'swift/audiencekit', label: 'AudienceKit', order: 1, description: 'AudienceCore, AudienceKit and AudienceKitUI: the Swift package for iOS 16+, macOS 13+ and Linux.' },
			'swift/Examples/README.md': { slug: 'swift/examples', label: 'Examples', order: 3, optional: true, description: 'Swift examples run by the SDK\'s tests: a "What\'s on" list by night, a news digest and a night out.' },
			'android/README.md': { slug: 'kotlin/audiencekit', label: 'AudienceKit', order: 1, description: 'The audiencekit Kotlin client (plain JVM) and audiencekit-android, for Android 8.0+.' },
			'core/README.md': { slug: 'kotlin/core', label: 'Kotlin Multiplatform core', order: 2, description: 'audiencekit-core, the Kotlin Multiplatform code shared by the JVM, Android and Apple targets.' },
			'android/examples/README.md': { slug: 'kotlin/examples', label: 'Examples', order: 4, optional: true, description: 'Kotlin examples run by the SDK\'s tests: a "What\'s on" list by night, a news digest and a night out.' },
			'CHANGELOG.md': { slug: 'changelog/audiencekit', label: 'AudienceKit', order: 1, description: 'Every release of the AudienceKit SDK, Swift and Kotlin together.' },
			// The server and scripting clients, each versioned on its own in the same repository.
			'node/README.md': { slug: 'node', label: 'Overview', order: 1, description: 'The audience-kit npm package: a typed Node 20+ client for the consumer GraphQL API.' },
			// Each server SDK's guides and reference, in its own sidebar group under its overview. `optional` pages are
			// left out until the SDK release that adds them.
			'node/docs/sign-in.md': { slug: 'node/sign-in', label: 'Signing people in', order: 1, optional: true, description: 'Facebook, Google, Apple and App Review sign-in on a Node server, one session per browser.' },
			'node/docs/websites.md': { slug: 'node/websites', label: 'Building a website', order: 2, optional: true, description: 'Service tokens, public listings, the community, news, calendars and cover passes on a Node site, worker or bot.' },
			'node/docs/reference.md': { slug: 'node/reference', label: 'Reference', order: 3, optional: true, description: 'Every call, model and helper in the Node SDK.' },
			'node/examples/README.md': { slug: 'node/examples', label: 'Examples', order: 4, optional: true, description: 'Runnable Node programs: a listings site, a news digest, Facebook sign-in, member actions and a community export.' },
			'python/README.md': { slug: 'python', label: 'Overview', order: 2, description: 'The audiencekit package for Python 3.10+, with blocking and asyncio clients.' },
			'python/docs/sign-in.md': { slug: 'python/sign-in', label: 'Signing people in', order: 1, optional: true, description: 'Facebook, Google, Apple and App Review sign-in on a Python server (Django, Flask, FastAPI), one session per browser.' },
			'python/docs/websites.md': { slug: 'python/websites', label: 'Building a website', order: 2, optional: true, description: 'Service tokens, public listings, the community, news, calendars and cover passes on a Python site or job.' },
			'python/docs/reference.md': { slug: 'python/reference', label: 'Reference', order: 3, optional: true, description: 'Every call, model and helper in the Python SDK.' },
			'python/examples/README.md': { slug: 'python/examples', label: 'Examples', order: 4, optional: true, description: 'Runnable Python programs: a listings site, a news digest, Facebook sign-in, member actions and a community export.' },
			'php/README.md': { slug: 'php', label: 'Overview', order: 3, description: 'audiencekit/audiencekit for PHP 8.1+, over any PSR-18 HTTP client.' },
			// The PHP SDK's guides and reference, in their own sidebar group under the overview. `optional` pages are
			// skipped when the checkout doesn't have them yet (a site build ahead of the SDK's main).
			'php/docs/sign-in.md': { slug: 'php/sign-in', label: 'Signing people in', order: 1, optional: true, description: 'Facebook, Google, Apple and App Review sign-in on a PHP website, keeping the session in PHP\'s session.' },
			'php/docs/websites.md': { slug: 'php/websites', label: 'Building a website', order: 2, optional: true, description: 'Service tokens, public listings, the community, news, calendars and cover passes on a PHP site or WordPress plugin.' },
			'php/docs/reference.md': { slug: 'php/reference', label: 'Reference', order: 3, optional: true, description: 'Every call, model and helper in the PHP SDK.' },
			'rust/README.md': { slug: 'rust', label: 'Overview', order: 4, description: 'The audiencekit crate, async on tokio and reqwest.' },
			'ruby/README.md': { slug: 'ruby', label: 'Overview', order: 5, description: 'The audience-kit gem for Ruby 3.2+ on Faraday: Rails and Sinatra sites, jobs, bots and scripts.' },
			'rust/docs/websites.md': { slug: 'rust/websites', label: 'Building a website', order: 1, optional: true, description: 'Credentials, public listings, the community and news from a Rust server, job or agent.' },
			'rust/docs/reference.md': { slug: 'rust/reference', label: 'Reference', order: 2, optional: true, description: 'Every call, model and error in the Rust crate.' },
			'ruby/docs/sign-in.md': { slug: 'ruby/sign-in', label: 'Signing people in', order: 1, optional: true, description: 'Facebook, Google, Apple and App Review sign-in on a Rails or Sinatra site, keeping the session in the framework\'s session.' },
			'ruby/docs/websites.md': { slug: 'ruby/websites', label: 'Building a website', order: 2, optional: true, description: 'API keys, service tokens, public listings, the community, news, calendars and cover passes on a Ruby site, job or bot.' },
			'ruby/docs/reference.md': { slug: 'ruby/reference', label: 'Reference', order: 3, optional: true, description: 'Every call, model and helper in the Ruby gem.' },
			'ruby/examples/README.md': { slug: 'ruby/examples', label: 'Examples', order: 4, optional: true, description: 'Runnable Ruby programs: a static listings page, a news digest, member actions and a community export.' },
			'rust/examples/README.md': { slug: 'rust/examples', label: 'Examples', order: 3, optional: true, description: 'Runnable Rust programs: a static listings page, a news digest and a community export.' },
			'node/CHANGELOG.md': { slug: 'changelog/node', label: 'Node', order: 3, description: 'Every release of the Node SDK.' },
			'python/CHANGELOG.md': { slug: 'changelog/python', label: 'Python', order: 4, description: 'Every release of the Python SDK.' },
			'php/CHANGELOG.md': { slug: 'changelog/php', label: 'PHP', order: 5, description: 'Every release of the PHP SDK.' },
			'rust/CHANGELOG.md': { slug: 'changelog/rust', label: 'Rust', order: 6, description: 'Every release of the Rust SDK.' },
			'ruby/CHANGELOG.md': { slug: 'changelog/ruby', label: 'Ruby', order: 7, description: 'Every release of the Ruby gem.' },
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
			'android/README.md': { slug: 'kotlin/staffkit', label: 'StaffKit', order: 3, description: 'com.audiencekit:staffkit, the staff calls for Android as extensions of the member client.' },
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

// An examples page shows each program it lists, so the code is on the site and not only in the repository: every
// file its table links to, in the order linked, as a code block under its own heading.
const EXAMPLE_LANGUAGES = { ts: 'ts', js: 'js', py: 'python', rs: 'rust', php: 'php', rb: 'ruby', swift: 'swift', kt: 'kotlin' };
function exampleSources(dir, markdown) {
	const files = [...new Set([...markdown.matchAll(/\]\(((?:\.\.\/)*[\w./-]+\.(\w+))\)/g)].map((m) => m[1]))].filter(
		(file) => EXAMPLE_LANGUAGES[file.split('.').pop()] && existsSync(join(dir, file)),
	);
	return files
		.map((file) => {
			const code = readFileSync(join(dir, file), 'utf8').trimEnd();
			const name = posix.basename(file);
			return `\n## ${name}\n\n\`\`\`${EXAMPLE_LANGUAGES[file.split('.').pop()]} title="${name}"\n${code}\n\`\`\`\n`;
		})
		.join('');
}

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

// The READMEs and changelogs carry maintainers' notes: who asked for a change and when, and links into the
// private API repository. Those stay in the repositories; the published pages drop them (outside code blocks).
// The paragraphs on which old copies stay under the MIT License stay in the repositories' READMEs and licenses too;
// the site doesn't repeat them.
function publicMarkdown(markdown) {
	return markdown
		.split(/(^```[\s\S]*?^```)/m)
		.map((part, index) =>
			index % 2
				? part
				: part
						.replace(/^[^\n]*(?:released|published) under the MIT License[\s\S]*?(?:\n\n|(?![\s\S]))/gm, '\n')
						.replace(/\s*\((?:[^()]|\([^()]*\))*(?:Rick, \d{4}-|audience_kit_api)(?:[^()]|\([^()]*\))*\)/g, '')
						.replace(/,?\s*(?:See |see )?the API's `doc\/[\w./-]+\.md`(?:, "[^"]*")?/g, '')
						.replace(/\s*\(doc\/[\w./-]+\.md\)/g, '')
						.replace(/since audience_kit_api \s*#\d+/g, 'for some time')
						.replace(/audience_kit_api(?:\s*#\d+(?:,\s*#\d+)*)?/g, 'the API')
						.replace(/ +([.,:;])/g, '$1'),
		)
		.join('');
}

// The site points only at current releases (Rick, 2026-11-26: steer people away from older versions). Changelogs keep
// the latest releases, from after the move off the MIT License, without the license-history bullets or the pointers
// to the per-platform changelogs that came before; install lines name the current version.
const CHANGELOG_RELEASES = 25;
function currentOnly(markdown, from, version) {
	if (/CHANGELOG\.md$/.test(from)) {
		const [preamble, ...releases] = markdown.split(/^(?=## )/m);
		const kept = [];
		for (const release of releases) {
			if (/MIT License/.test(release) || kept.length === CHANGELOG_RELEASES) break;
			const trimmed = release.replace(/^- License[\s\S]*?(?=^- |^## |(?![\s\S]))/gm, '');
			if (trimmed.replace(/^## .*$/m, '').trim()) kept.push(trimmed);
		}
		const intro = preamble.replace(/^One changelog[\s\S]*?(?:\n\n|(?![\s\S]))/m, '').trim();
		return `${intro ? `${intro}\n\n` : ''}The latest releases, newest first.\n\n${kept.join('')}`;
	}
	return markdown
		.replace(/(\.package\(url: "[^"]+", from: ")\d+\.\d+\.\d+(")/g, `$1${version}$2`)
		.replace(/a tag \(`\d+\.\d+\.\d+`, no `v`\)/g, `a tag (\`${version}\`, no \`v\`)`)
		.replace(/ with a GitHub release; the\s+\[releases page\]\([^)]*\) lists them\./g, '.')
		.replace(/bare `\d+\.\d+\.\d+` tags/g, 'bare version tags')
		.replace(/("com\.audiencekit:audiencekit[\w-]*:)\d+\.\d+\.\d+(")/g, `$1${version}$2`)
		.replace(/(set-version\.sh )\d+\.\d+\.\d+/g, `$1${version}`)
		.replace(/tags the release \(`\d+\.\d+\.\d+`, no `v`\)/g, `tags the release (\`${version}\`, no \`v\`)`);
}

// Only this script's pages are replaced.
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
		if (page.optional && !existsSync(join(source, from))) {
			console.log(`${sdk.name}: ${from} isn't in this checkout yet, so /sdks/${page.slug}/ is left out`);
			continue;
		}
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
		if (/(^|\/)examples\/README\.md$/i.test(from)) body += exampleSources(join(source, dirname(from)), body);
		writeFileSync(target, frontmatter + rewriteLinks(sdk, source, currentOnly(publicMarkdown(body), from, version), from));
	}
	console.log(`Imported ${Object.keys(sdk.pages).length} pages from ${sdk.key} ${version}${checkout ? '' : ' (snapshot)'}`);
}

// The landing page: the family, by platform, with versions.
const ak = versions['audience-kit-sdk'];
const staff = imported.has('staff-kit');
const staffRow = staff
	? `| A staff tool: the door, listings, chat moderation, decisions (Focus, Velvet, Backstage, Arbiter) | [StaffKit for Swift](/sdks/swift/staffkit/) | [StaffKit for Android](/sdks/kotlin/staffkit/) | ${versions['staff-kit']} |`
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

Two SDKs for apps, each for Swift and Kotlin and released together on one version per repository, plus clients for servers and scripts. Pick by what you are building:

| Your app | iOS and macOS | Android | Version |
| --- | --- | --- | --- |
| An audience's own app, for its members (Hot Mess, Hack Different) | [AudienceKit for Swift](/sdks/swift/audiencekit/) | [AudienceKit for Kotlin](/sdks/kotlin/audiencekit/) | ${ak} ([changelog](/sdks/changelog/audiencekit/)) |
${staffRow}
| A server, website or script | [Node and TypeScript](/sdks/node/), [Python](/sdks/python/), [PHP](/sdks/php/), [Rust](/sdks/rust/), [Ruby](/sdks/ruby/) | | Each versioned on its own (changelogs: [Node](/sdks/changelog/node/), [Python](/sdks/changelog/python/), [PHP](/sdks/changelog/php/), [Rust](/sdks/changelog/rust/), [Ruby](/sdks/changelog/ruby/)) |

## AudienceKit

[AudienceKit](/sdks/audiencekit/) is source-available (see the license below) at [lwm-luminx/audience-kit-sdk](https://github.com/lwm-luminx/audience-kit-sdk). It signs people in, then reads the audience as the [consumer view](/reference/graphql/) serves it: venues, people, locales, events, lineups, chat, cover, and the audience's branding. Swift ships as a package (\`AudienceCore\`, \`AudienceKit\`, \`AudienceKitUI\`) resolved by version tag; Kotlin as \`com.audiencekit:audiencekit\` and \`audiencekit-android\`, built from a checkout until it is published to Maven; and the [Kotlin Multiplatform core](/sdks/kotlin/core/) is the code both share.

## StaffKit

${staff ? '[StaffKit](/sdks/staffkit/)' : 'StaffKit'} is private at [lwm-luminx/staff-kit](https://github.com/lwm-luminx/staff-kit) and builds on AudienceKit. It adds the staff session (the platform sign-in and the chosen audience, shared between the staff apps), and the calls of the [staff view](/reference/staffql/): venue and talent management, the door, chat moderation and the decision queue. Android adds \`com.audiencekit:staffkit\` as extension functions on the member client.${staff ? '' : ' Its pages are published from its own repository.'}

## Server and scripting clients

The [Node](/sdks/node/), [Python](/sdks/python/), [PHP](/sdks/php/), [Rust](/sdks/rust/) and [Ruby](/sdks/ruby/) clients live in the same repository and send the same module-shaped GraphQL documents as the Swift and Kotlin SDKs, so a website, a bot or a backend job reads an audience the way the apps do. Each takes the token your sign-in produced, or an [application API key](/api/authentication/) for a server acting as an app of one audience.

## Which endpoint

AudienceKit calls the audience's \`graphql\` endpoint, StaffKit its \`staffql\` endpoint. The two serve the same graph; [GraphQL](/api/graphql/) explains the difference, and the SDKs' door and management calls always use \`staffql\`.

## License

The SDKs are **source-available, not open source**. They ship under the [AudienceKit SDK License](https://github.com/lwm-luminx/audience-kit-sdk/blob/main/LICENSE), which lets you build them into apps and services that connect to AudienceKit as hosted by Love Wins Media (audiencekit.com, the audiences' own domains, and the development instances it provides), and nothing else: not another implementation of the API. Changes are allowed only in a GitHub fork of the repository, after written notice to Love Wins Media (an app that only depends on the unchanged SDK needs neither), and misrepresenting where the code came from is prohibited. Any other use needs written permission from Love Wins Media, Inc. See [Licensing](/licensing/) for a plain-language summary.

## Versions and the API

Each SDK sends its version with every call, and the API refuses versions older than its minimum, so keep up with the changelogs. Clients that track the API's \`next\` branch can validate their documents against [/graphql/next/](/graphql/manifest.json) in CI (see [Validate documents](/api/validate-documents/)).
`,
);
writeFileSync(join(site, 'src/sdk.json'), `${JSON.stringify(versions, null, 2)}\n`);
console.log(`Wrote /sdks/ (AudienceKit ${ak}${staff ? `, StaffKit ${versions['staff-kit']}` : ''})`);
