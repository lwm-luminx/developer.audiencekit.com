// Generates the GraphQL and StaffQL references, src/content/docs/reference/{graphql,staffql}/, from the schema dumps
// in the API bundle (scripts/bundle.mjs installs them in public/graphql/), so the reference never drifts from the API.
//
// Each view gets its own reference: the consumer view (the `graphql` endpoint the apps call) and the staff view (the
// same graph with the staff edges, as `staffql` serves it). A reference is one page per module plus pages for the
// root, the mutations and the subscriptions. The staff reference marks what the consumer view leaves out.
//
// Modules are the API's own: a module owns the mixin interfaces that declare it (`@mixin(extensionKey:)`), the
// permission namespace that guards its fields (`@requires(permissions: ["chat:read:*"])`), and every type reached from
// those first. Ownership of shared helper types is inferred from that walk, not declared. Runs before dev and build,
// after the bundle.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	buildSchema,
	getNamedType,
	isEnumType,
	isInputObjectType,
	isInterfaceType,
	isObjectType,
	isScalarType,
	isSpecifiedScalarType,
	isUnionType,
	valueFromASTUntyped,
} from 'graphql';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(site, 'src/content/docs/reference');

const bundle = JSON.parse(readFileSync(join(site, 'src/bundle.json'), 'utf8'));
const { views } = bundle.main;
const view = (name) => views.find((v) => v.name === name);
const loadSync = (v) => buildSchema(readFileSync(join(site, 'public', v.sdl), 'utf8'));

// Permission namespaces that belong to the audience itself rather than a module.
const CORE_NAMESPACES = new Set(['audience', 'users', 'platform', 'tenants']);
const CORE = 'core';
const label = (key) => (key === CORE ? 'Core' : key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));

// ---- AST helpers -------------------------------------------------------------------------------------------------

const directive = (node, name) => node?.astNode?.directives?.find((d) => d.name.value === name);
const argOf = (dir, name) => {
	const arg = dir?.arguments?.find((a) => a.name.value === name);
	return arg ? valueFromASTUntyped(arg.value) : undefined;
};
const permissions = (node) => argOf(directive(node, 'requires'), 'permissions') ?? [];
const namespaceModule = (node) => {
	const ns = permissions(node)[0]?.split(':')[0];
	return ns && !CORE_NAMESPACES.has(ns) ? ns : null;
};

// ---- Markdown helpers --------------------------------------------------------------------------------------------

// Escapes HTML outside code spans and pipes everywhere, so a description renders inside a table cell.
function inline(text) {
	return (text ?? '')
		.split(/(`[^`]*`)/)
		.map((part, i) => (i % 2 ? part : part.replace(/</g, '&lt;').replace(/>/g, '&gt;')))
		.join('')
		.replace(/\|/g, '\\|');
}
const oneLine = (text) => inline((text ?? '').replace(/\s+/g, ' ').trim());
// A description as its own paragraph(s): HTML escaped outside code, pipes kept.
const block = (text) => (text ?? '').split(/(```[\s\S]*?```|`[^`]*`)/).map((part, i) => (i % 2 ? part : part.replace(/</g, '&lt;').replace(/>/g, '&gt;'))).join('').trim();
const slug = (name) => name.toLowerCase();
const small = (text) => `<small>${text}</small>`;

// ---- One reference -----------------------------------------------------------------------------------------------

function generate({ name, dir, title, endpoint, compareTo, sidebarOrder, intro }) {
	const documented = view(name);
	if (!documented) return null;
	const schema = loadSync(documented);
	const other = compareTo && view(compareTo) ? loadSync(view(compareTo)) : null;
	const otherHas = (typeName, fieldName) => {
		const type = other?.getType(typeName);
		return Boolean(type && 'getFields' in type && type.getFields()[fieldName]);
	};
	const STAFF_ONLY = small('staffql only');

	const roots = {
		query: schema.getQueryType(),
		mutation: schema.getMutationType(),
		subscription: schema.getSubscriptionType(),
	};
	const rootNames = new Set(Object.values(roots).filter(Boolean).map((t) => t.name));
	const types = Object.values(schema.getTypeMap()).filter((t) => !t.name.startsWith('__') && !isSpecifiedScalarType(t) && !rootNames.has(t.name));

	// ---- Module ownership -------------------------------------------------------------------------------------------

	const owner = new Map(); // type name -> module key
	const seeds = new Map(); // module key -> [type]
	const seed = (key, type) => {
		const named = getNamedType(type);
		if (!named || named.name.startsWith('__') || isSpecifiedScalarType(named) || rootNames.has(named.name)) return;
		if (!seeds.has(key)) seeds.set(key, []);
		seeds.get(key).push(named);
	};

	// Mixin interfaces declare their module.
	for (const type of types) {
		const mixin = directive(type, 'mixin');
		if (mixin) seed(argOf(mixin, 'extensionKey'), type);
	}
	// The root's module edges (the field a mixin generates) and its guarded fields.
	const mixinFields = new Map(); // root field name -> module key
	for (const type of types) {
		const mixin = directive(type, 'mixin');
		if (mixin && argOf(mixin, 'on')?.includes(roots.query.name)) mixinFields.set(argOf(mixin, 'field'), argOf(mixin, 'extensionKey'));
	}
	// Every module the schema names: mixin keys and permission namespaces.
	const knownKeys = new Set([...mixinFields.values()]);
	for (const type of types) {
		const mixin = directive(type, 'mixin');
		if (mixin) knownKeys.add(argOf(mixin, 'extensionKey'));
		if ('getFields' in type) for (const f of Object.values(type.getFields())) for (const p of permissions(f)) if (!CORE_NAMESPACES.has(p.split(':')[0])) knownKeys.add(p.split(':')[0]);
	}
	// A root field named after a module (`locales`, `locale`, `closestLocale`) is that module's, even when it is
	// guarded by an audience-wide permission.
	const namedModule = (fieldName) => {
		const base = fieldName.replace(/^closest/, '').toLowerCase();
		return [...knownKeys].find((key) => base === key.replace(/_/g, '') || `${base}s` === key.replace(/_/g, '')) ?? null;
	};
	const fieldModule = (field) => mixinFields.get(field.name) ?? namespaceModule(field) ?? namedModule(field.name) ?? CORE;
	for (const field of Object.values(roots.query.getFields())) {
		const key = fieldModule(field);
		seed(key, field.type);
		for (const arg of field.args) seed(key, arg.type);
	}
	// Mutations and subscriptions: their permission namespace names their module; the payload and input follow.
	const operationModule = (field) => namespaceModule(field) ?? CORE;
	for (const root of [roots.mutation, roots.subscription].filter(Boolean)) {
		for (const field of Object.values(root.getFields())) {
			const key = operationModule(field);
			seed(key, field.type);
			for (const arg of field.args) seed(key, arg.type);
		}
	}

	// Layered walk: a type belongs to the module whose seeds reach it first. Ties go to a module over the core, then
	// to the module whose name begins the type's, then alphabetically, so the walk is deterministic.
	const prefers = (a, b, typeName) => {
		if (a === b) return a;
		if (a === CORE) return b;
		if (b === CORE) return a;
		const starts = (key) => typeName.toLowerCase().startsWith(key.replace(/_/g, '').replace(/s$/, ''));
		if (starts(a) !== starts(b)) return starts(a) ? a : b;
		return a < b ? a : b;
	};
	let frontier = new Map(); // type name -> module key, claimed this layer
	for (const [key, list] of seeds) for (const type of list) frontier.set(type.name, frontier.has(type.name) ? prefers(frontier.get(type.name), key, type.name) : key);
	while (frontier.size) {
		const next = new Map();
		const claim = (type, key) => {
			const named = getNamedType(type);
			if (named.name.startsWith('__') || isSpecifiedScalarType(named) || rootNames.has(named.name) || owner.has(named.name) || frontier.has(named.name)) return;
			next.set(named.name, next.has(named.name) ? prefers(next.get(named.name), key, named.name) : key);
		};
		for (const [typeName, key] of frontier) {
			owner.set(typeName, key);
			const type = schema.getType(typeName);
			if (isObjectType(type) || isInterfaceType(type)) {
				for (const iface of type.getInterfaces()) claim(iface, key);
				for (const field of Object.values(type.getFields())) {
					claim(field.type, key);
					for (const arg of field.args) claim(arg.type, key);
				}
			}
			if (isInputObjectType(type)) for (const field of Object.values(type.getFields())) claim(field.type, key);
			if (isUnionType(type)) for (const member of type.getTypes()) claim(member, key);
			if (isInterfaceType(type)) for (const impl of schema.getPossibleTypes(type)) claim(impl, key);
		}
		frontier = next;
	}
	for (const type of types) if (!owner.has(type.name)) owner.set(type.name, CORE);

	const modules = [...new Set([CORE, ...owner.values(), ...seeds.keys()])].sort((a, b) => (a === CORE ? -1 : b === CORE ? 1 : a.localeCompare(b)));
	const pageOf = (typeName) => {
		if (typeName === roots.query.name) return 'index';
		if (roots.mutation && typeName === roots.mutation.name) return 'mutations';
		if (roots.subscription && typeName === roots.subscription.name) return 'subscriptions';
		return owner.get(typeName) ?? CORE;
	};
	const typeLink = (type) => {
		const named = getNamedType(type);
		if (isSpecifiedScalarType(named)) return `\`${type}\``;
		const page = pageOf(named.name);
		return `[\`${type}\`](/reference/${dir}/${page === 'index' ? '' : `${page}/`}#${slug(named.name)})`;
	};
	const moduleLink = (key) => `[${label(key)}](/reference/${dir}/${key}/)`;

	// ---- Rendering --------------------------------------------------------------------------------------------------

	const requiresNote = (node) => {
		const perms = permissions(node);
		return perms.length ? ` ${small(`requires ${perms.map((p) => `\`${p}\``).join(' or ')}`)}` : '';
	};
	const staffOnlyField = (typeName, field) => (other && !otherHas(typeName, field.name) ? ` ${STAFF_ONLY}` : '');
	const argList = (field) => (field.args?.length ? `<br/>${field.args.map((a) => `\`${a.name}: ${a.type}\``).join('<br/>')}` : '');

	function fieldTable(typeName, fields, { args = true } = {}) {
		const rows = Object.values(fields).map(
			(f) => `| \`${f.name}\`${staffOnlyField(typeName, f)}${args ? argList(f) : ''} | ${typeLink(f.type)} | ${oneLine(f.description)}${requiresNote(f)} |`,
		);
		return ['| Field | Type | Description |', '| --- | --- | --- |', ...rows].join('\n');
	}
	function operationTable(root, fields) {
		const rows = fields.map(
			(f) => `| \`${f.name}\`${staffOnlyField(root.name, f)}${argList(f)} | ${typeLink(f.type)} | ${oneLine(f.description)}${requiresNote(f)} |`,
		);
		return ['| Operation | Returns | Description |', '| --- | --- | --- |', ...rows].join('\n');
	}
	const kindOf = (type) => (isObjectType(type) ? 'Object' : isInterfaceType(type) ? 'Interface' : isInputObjectType(type) ? 'Input' : isEnumType(type) ? 'Enum' : isUnionType(type) ? 'Union' : 'Scalar');

	function typeSection(type) {
		const out = [`### ${type.name}`, ''];
		const facts = [`*${kindOf(type)}*`];
		if (isObjectType(type) && type.getInterfaces().length) facts.push(`implements ${type.getInterfaces().map(typeLink).join(', ')}`);
		if (isInterfaceType(type)) {
			const impls = schema.getPossibleTypes(type);
			if (impls.length) facts.push(`implemented by ${impls.map(typeLink).join(', ')}`);
		}
		const mixin = directive(type, 'mixin');
		if (mixin) facts.push(`mixin edge \`${argOf(mixin, 'field')}\` on ${argOf(mixin, 'on').map((n) => (schema.getType(n) ? typeLink(schema.getType(n)) : `\`${n}\``)).join(', ')}`);
		const facet = directive(type, 'facet');
		if (facet) facts.push(`facet tag \`${argOf(facet, 'tag')}\``);
		if (other && !other.getType(type.name)) facts.push(STAFF_ONLY);
		out.push(facts.join(' · '), '');
		if (type.description) out.push(block(type.description), '');
		if (isObjectType(type) || isInterfaceType(type)) out.push(fieldTable(type.name, type.getFields()), '');
		if (isInputObjectType(type)) out.push(fieldTable(type.name, type.getFields(), { args: false }), '');
		if (isEnumType(type)) out.push(type.getValues().map((v) => `- \`${v.name}\`${v.description ? ` ${oneLine(v.description)}` : ''}`).join('\n'), '');
		if (isUnionType(type)) out.push(type.getTypes().map((t) => `- ${typeLink(t)}`).join('\n'), '');
		return out.join('\n');
	}

	const byKind = (list) =>
		[
			['Objects', list.filter((t) => isObjectType(t) && !t.name.endsWith('Payload'))],
			['Mutation payloads', list.filter((t) => isObjectType(t) && t.name.endsWith('Payload'))],
			['Inputs', list.filter(isInputObjectType)],
			['Interfaces', list.filter(isInterfaceType)],
			['Enums', list.filter(isEnumType)],
			['Unions', list.filter(isUnionType)],
			['Scalars', list.filter(isScalarType)],
		].filter(([, l]) => l.length);

	const frontmatter = (pageTitle, description, order, extra = []) =>
		['---', `title: ${JSON.stringify(pageTitle)}`, `description: ${JSON.stringify(description)}`, 'sidebar:', `  order: ${order}`, ...extra, 'editUrl: false', '---', '', `<!-- Generated by scripts/graphql-reference.mjs from ${documented.sdl}. Do not edit by hand. -->`, ''].join('\n');

	const out = join(outRoot, dir);
	rmSync(out, { recursive: true, force: true });
	mkdirSync(out, { recursive: true });

	const mutations = roots.mutation ? Object.values(roots.mutation.getFields()) : [];
	const subscriptions = roots.subscription ? Object.values(roots.subscription.getFields()) : [];
	const typesOf = (key) => types.filter((t) => owner.get(t.name) === key).sort((a, b) => a.name.localeCompare(b.name));
	const mutationsOf = (key) => mutations.filter((f) => operationModule(f) === key);
	const subscriptionsOf = (key) => subscriptions.filter((f) => operationModule(f) === key);
	const rootFieldsOf = (key) => Object.values(roots.query.getFields()).filter((f) => fieldModule(f) === key);

	// The root page: the endpoint, the modules and the root type's fields.
	{
		const moduleRows = modules.map((key) => {
			const edges = rootFieldsOf(key).map((f) => `\`${f.name}\``).join(', ');
			return `| ${moduleLink(key)} | ${edges} | ${typesOf(key).length} | ${mutationsOf(key).length} | ${subscriptionsOf(key).length} |`;
		});
		const md = [
			frontmatter(title, `${title}: every query, mutation, subscription and type of the ${name} view, by module.`, sidebarOrder, ['  label: Overview']),
			...intro,
			'',
			`Download the dumps: [SDL](/${documented.sdl}) and [introspection](/${documented.introspection}) (${bundle.main.version}), or the \`next\` branch's: [SDL](/graphql/next/${documented.sdl.split('/').pop()}) and [introspection](/graphql/next/${documented.introspection.split('/').pop()}).`,
			'',
			'## Modules',
			'',
			'A module adds its edge to the root and to the records it extends. An audience that hasn\'t installed a module has no edge for it, so its fields aren\'t refused, they don\'t exist; ask the schema (`__type`) before relying on one, or let the SDKs do it.',
			'',
			'| Module | Root fields | Types | Mutations | Subscriptions |',
			'| --- | --- | --- | --- | --- |',
			...moduleRows,
			'',
			`## ${roots.query.name}`,
			'',
			`The query root is the audience itself. ${block(roots.query.description ?? '')}`.trim(),
			'',
			fieldTable(roots.query.name, roots.query.getFields()),
			'',
		].join('\n');
		writeFileSync(join(out, 'index.md'), md);
	}

	// Mutations and subscriptions, grouped by module.
	const operationsPage = (file, pageTitle, root, fields, order, lead) => {
		if (!root) return;
		const sections = modules.flatMap((key) => {
			const list = fields.filter((f) => operationModule(f) === key);
			return list.length ? [`## ${label(key)}`, '', `See ${moduleLink(key)} for the inputs and payloads.`, '', operationTable(root, list), ''] : [];
		});
		writeFileSync(join(out, file), [frontmatter(pageTitle, `${pageTitle} of the ${name} view, by module.`, order), `<a id="${slug(root.name)}"></a>`, '', lead, '', ...sections].join('\n'));
	};
	operationsPage(
		'mutations.md',
		'Mutations',
		roots.mutation,
		mutations,
		sidebarOrder + 1,
		'Every mutation takes one `input` argument and returns a payload. The permissions listed are the ones that allow it, any one of them (see [Authentication](/api/authentication/)). When a record fails validation, the error\'s `extensions` carry the field errors (see [Errors](/api/errors/)).',
	);
	operationsPage(
		'subscriptions.md',
		'Subscriptions',
		roots.subscription,
		subscriptions,
		sidebarOrder + 2,
		'Subscriptions are served over Action Cable (see [Realtime](/api/realtime/)). The SDKs open one cable per session and multiplex every subscription on it.',
	);

	// One page per module.
	modules.forEach((key, i) => {
		const list = typesOf(key);
		const mixins = list.filter((t) => directive(t, 'mixin'));
		const edges = rootFieldsOf(key);
		const lead =
			key === CORE
				? 'The audience itself and what every module builds on: users, the viewer\'s state (`me`), tags and tribes, theme, locales and the platform\'s administration.'
				: `${mixins.map((m) => block(m.description)).filter(Boolean)[0] ?? ''}`.trim();
		const sections = [
			frontmatter(label(key), `The ${label(key).toLowerCase()} module of the ${name} view: its root fields, operations and types.`, sidebarOrder + 10 + i, key === CORE ? [] : ['  label: ' + JSON.stringify(label(key))]),
			lead,
			'',
		];
		if (edges.length) sections.push('## Root fields', '', fieldTable(roots.query.name, edges), '');
		const ops = mutationsOf(key);
		if (ops.length) sections.push('## Mutations', '', operationTable(roots.mutation, ops), '');
		const subs = subscriptionsOf(key);
		if (subs.length) sections.push('## Subscriptions', '', operationTable(roots.subscription, subs), '');
		for (const [kindTitle, kindList] of byKind(list)) sections.push(`## ${kindTitle}`, '', ...kindList.map(typeSection));
		writeFileSync(join(out, `${key}.md`), sections.join('\n'));
	});

	console.log(`graphql-reference: ${dir}: ${types.length} types in ${modules.length} modules, ${mutations.length} mutations, ${subscriptions.length} subscriptions`);
	return { modules: modules.length, types: types.length };
}

rmSync(outRoot, { recursive: true, force: true });

generate({
	name: 'consumer',
	dir: 'graphql',
	title: 'GraphQL reference',
	endpoint: '/v1/audience/:audience_id/graphql',
	compareTo: null,
	sidebarOrder: 0,
	intro: [
		'The **consumer view** is the audience graph as `POST /v1/audience/:audience_id/graphql` serves it to an audience\'s own apps: a signed-in member gets their own records and the audience\'s public ones, whatever their role. Fields no member could use aren\'t in this schema at all. Staff tools use [StaffQL](/reference/staffql/) instead; [GraphQL](/api/graphql/) explains the two endpoints.',
		'',
		'The [Swift](/sdks/swift/audiencekit/) and [Kotlin](/sdks/kotlin/audiencekit/) SDKs wrap the common queries of this view.',
	],
});

generate({
	name: 'staff',
	dir: 'staffql',
	title: 'StaffQL reference',
	endpoint: '/v1/audience/:audience_id/staffql',
	compareTo: 'consumer',
	sidebarOrder: 0,
	intro: [
		'The **staff view** is the whole audience graph as `POST /v1/audience/:audience_id/staffql` serves it to staff tools (the console, Focus, Velvet, Backstage, a venue device): every field, resolved with the caller\'s role. Each field says which permissions let a caller use it. Anyone without a staff role is turned away with `403 no_permission`; [GraphQL](/api/graphql/) explains the two endpoints and [Authentication](/api/authentication/) the roles.',
		'',
		'Fields and types marked <small>staffql only</small> are not in the [consumer view](/reference/graphql/). [StaffKit](/sdks/#staffkit) wraps the staff calls for Swift and Kotlin.',
	],
});
