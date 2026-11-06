// @ts-check
import { existsSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// A page scripts/sdks.mjs may not have written (StaffKit is private: without a checkout or vendor/staff-kit/, its
// pages are left out), so the sidebar lists it only when it exists.
const page = (slug) => (existsSync(`src/content/docs/${slug}.md`) ? [{ slug }] : []);

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
			// Google Analytics 4: the AudienceKit property, whose one web stream also covers audiencekit.com and the console.
			head: [
				{ tag: 'script', attrs: { async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-W5LTH459WQ' } },
				{
					tag: 'script',
					content: "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-W5LTH459WQ');",
				},
			],
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
