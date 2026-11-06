---
title: Theme an audience
description: Pick a design system preset, override the tenant tokens, and pass the contrast checks the API enforces.
sidebar:
  order: 1
---

Every AudienceKit screen is drawn from one design system. An audience changes only its **tenant layer**: its accent and spectrum colors. Surfaces, text, status colors, type, spacing and shape are locked so every audience stays readable and familiar.

## The theme object

An audience's theme is stored on the audience and looks like this:

```json
{
  "preset": "hot_mess",
  "tagline": "Queer nights out, all in one place.",
  "light": { "accent": "#b8236f" },
  "dark": {}
}
```

| Field | Rules |
| --- | --- |
| `preset` | `default` or `hot_mess`. Each preset is a light and dark pair of themes. Defaults to `default`. |
| `tagline` | Optional. One line about the audience in its own voice, up to 120 characters. |
| `light`, `dark` | Optional overrides for each mode. Keys must be tenant tokens, and values must be six-digit hex colors such as `#1a2b3c`. |

## Tenant tokens

These are the only tokens an audience can override:

| Group | Tokens |
| --- | --- |
| Accent | `accent`, `accent-strong`, `accent-soft`, `accent-ink`, `on-accent`, `focus` |
| Spectrum | `spectrum-1` … `spectrum-6`, `on-spectrum-1` … `on-spectrum-6` |

The list lives in `config/theme_presets.json`, which `bin/rake design:tokens` generates from the design system's `tokens.json`.

## Contrast rules

The API resolves each mode (the preset's values with your overrides applied) and refuses the theme if any of these pairs falls short:

| Foreground | On | Minimum |
| --- | --- | --- |
| `on-accent` | `accent`, `accent-strong` | 4.5:1 |
| `accent-ink` | `surface`, `surface-raised`, `surface-sunken`, `accent-soft` | 4.5:1 |
| `focus` | `surface`, `surface-raised`, `surface-sunken` | 3:1 |
| `on-spectrum-N` | `spectrum-N` | 4.5:1 |

A failure names the pair and the ratio, for example "light on-accent on accent has contrast 3.21:1; it needs 4.5:1". Override the matching foreground token too when you change a fill.

## Update a theme

Admins edit themes on the admin console's Appearance page, or with the `updateAudienceTheme` mutation. The mutation replaces the whole theme, so send every override you want to keep:

```graphql
mutation {
  updateAudienceTheme(input: {
    theme: {
      preset: "default"
      tagline: "Find the nights where your people are."
      light: [{ name: "accent", value: "#7a3fb0" }, { name: "accent-strong", value: "#5f2f8c" }]
      dark: []
    }
  }) {
    audience { theme { preset light { name value } } }
  }
}
```

## Apply a theme in a client

1. Fetch the theme with GraphQL (`theme { … }`, on the query root, which is the audience) or, before sign-in, from `GET /v1/branding`.
2. Set `data-theme` on the root element to the preset's theme for the current mode: `light` or `dark` for the default preset, `hot_mess` or `hot_mess_dark` for Hot Mess. Follow `prefers-color-scheme`.
3. Set each override for the current mode as a CSS custom property on the root, such as `--accent: #b8236f`.

The admin console does exactly this in `app/frontend/design/theme.ts`. Its generated stylesheet, `app/frontend/design/tokens.css`, defines every token for every theme, and these docs load the same file.
