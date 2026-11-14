// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// A page scripts/sdks.mjs may not have written (StaffKit is private: without a checkout or vendor/staff-kit/, its
// pages are left out), so the sidebar lists it only when it exists.
const page = (slug) => (existsSync(`src/content/docs/${slug}.md`) ? [{ slug }] : []);

// New Relic browser monitoring, the only measurement on this site (Google Analytics was removed 2026-11-14). It
// loads once NEW_RELIC_APPLICATION_ID names this site's browser app in the Hot Mess Productions account; while that
// is empty the site measures nothing.
//
// src/monitoring/new-relic-browser.html is New Relic's copy/paste snippet (Pro + SPA) with the application ID left
// as a placeholder. Its licenseKey is the account's browser key, which every page using it ships, so it isn't a
// secret. What the agent may send is set in NREUM.init at the top of that file: no cookie or stored session, no
// session replay, session trace, click capture or console log forwarding, no request bodies, and obfuscate rules
// that rewrite record IDs, sign-in and search query values, email addresses and URL fragments in every string
// before it leaves. New Relic still sees the visitor's IP address when the browser connects, as any server does.
//
// To update the agent, paste a fresh snippet over the file, put the NREUM.init line back as it was and replace the
// application ID with __NR_APPLICATION_ID__ again.
const NEW_RELIC_APPLICATION_ID = '';

function newRelicHead() {
	if (!/^\d+$/.test(NEW_RELIC_APPLICATION_ID)) return [];
	const snippet = readFileSync('src/monitoring/new-relic-browser.html', 'utf8');
	if (!snippet.includes('cookies_enabled:false') || !snippet.includes('obfuscate:[')) {
		throw new Error('new-relic-browser.html lost its filtering: restore the NREUM.init line');
	}
	// The file is New Relic's one script element: take what is between its opening tag and its closing tag.
	const script = snippet.slice(snippet.indexOf('>') + 1, snippet.lastIndexOf('</script>'));
	return [{ tag: /** @type {const} */ ('script'), content: script.replaceAll('__NR_APPLICATION_ID__', NEW_RELIC_APPLICATION_ID) }];
}

// developer.audiencekit.com: the AudienceKit developer documentation.
export default defineConfig({
	site: 'https://developer.audiencekit.com',
	// Pages that moved when the reference was split per view and the SDK pages were grouped by platform.
	redirects: {
		'/api/graphql-reference/': '/reference/staffql/',
		'/sdks/overview/': '/sdks/',
		'/sdks/swift/': '/sdks/swift/audiencekit/',
		'/sdks/kotlin/': '/sdks/kotlin/audiencekit/',
		'/sdks/core/': '/sdks/kotlin/core/',
		'/sdks/changelog/': '/sdks/changelog/audiencekit/',
	},
	integrations: [
		starlight({
			title: 'AudienceKit',
			description: 'Developer documentation for AudienceKit, the multi-tenant platform for audiences, places and events.',
			favicon: '/favicon.png',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/lwm-luminx/audience-kit-sdk' }],
			pagination: false,
			editLink: { baseUrl: 'https://github.com/lwm-luminx/developer.audiencekit.com/edit/main/' },
			// src/theme/ is the design system's tokens and fonts, from the API's bundle.
			customCss: ['./src/theme/tokens.css', './src/styles/audiencekit.css'],
			lastUpdated: true,
			// New Relic's browser agent, filtered (see newRelicHead above). No Google Analytics.
			head: newRelicHead(),
			// The start, API and guide pages come from the API's bundle (scripts/bundle.mjs); each page's sidebar.order
			// frontmatter sets its place.
			sidebar: [
				{ label: 'Start here', items: [{ autogenerate: { directory: 'start' } }] },
				{ label: 'API', items: [{ autogenerate: { directory: 'api' } }] },
				// The references are generated per view by scripts/graphql-reference.mjs: one page per module.
				{
					label: 'Reference',
					items: [
						{ label: 'GraphQL (consumer view)', collapsed: true, items: [{ autogenerate: { directory: 'reference/graphql' } }] },
						{ label: 'StaffQL (staff view)', collapsed: true, items: [{ autogenerate: { directory: 'reference/staffql' } }] },
					],
				},
				{ label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
				// The SDK pages come from audience-kit-sdk and staff-kit (scripts/sdks.mjs), by platform.
				{
					label: 'SDKs',
					items: [
						{ slug: 'sdks' },
						...page('sdks/audiencekit'),
						...page('sdks/staffkit'),
						{ label: 'iOS and macOS (Swift)', items: [{ autogenerate: { directory: 'sdks/swift' } }] },
						{ label: 'Android (Kotlin)', items: [{ autogenerate: { directory: 'sdks/kotlin' } }] },
						{ slug: 'sdks/ruby' },
						{ label: 'Changelogs', collapsed: true, items: [{ autogenerate: { directory: 'sdks/changelog' } }] },
					],
				},
				{ label: 'Project', items: [{ label: 'Contribute to these docs', slug: 'project/contributing-docs' }] },
			],
		}),
	],
});
