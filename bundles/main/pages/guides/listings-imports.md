---
title: Import listings files
description: The JSON Schema for listings import files, and how to check a file before uploading it.
sidebar:
  order: 5
---

Researched locales and venues, People, calendar listings, social profiles and divisions reach an audience as a **listings file**: JSON uploaded on Curate › Imports, posted to [`POST /v1/research/imports`](/api/rest/#research), or sent with the MCP `upload_listings` tool. Each upload runs as a dry run first; nothing is kept until someone imports it.

## The schema

Every listings file must match this JSON Schema (draft 2020-12):

- Versioned: `https://developer.audiencekit.com/schemas/listings-import/v1.json`
- Latest: `https://developer.audiencekit.com/schemas/listings-import/latest.json`

The versioned URL never changes once published; `latest` follows the newest version. Put the versioned URL in the file's `$schema` so editors check it as you type:

```json
{
  "$schema": "https://developer.audiencekit.com/schemas/listings-import/v1.json",
  "kind": "locales",
  "source": "road-trip-2026-11",
  "locales": [
    {
      "label": "missoula", "name": "Missoula", "state": "MT", "time_zone": "America/Denver", "include": true,
      "venues": [{ "name": "Union Club", "address": "208 E Main St, Missoula, MT 59802", "confidence": "high" }]
    }
  ]
}
```

The server checks uploads against the same schema and refuses a file that doesn't match, listing up to five errors with where each one is (`/locales/0: required property 'include'`). Before that, a file in a shape the importer didn't read previewed as an empty dry run ("0 locales added, 0 already there").

## Kinds

Say the file's `kind`; without it the kind is guessed from the shape (`events` means calendar, `locales` means locales, and so on), which can guess wrong.

| Kind | Holds | Things that catch people out |
| --- | --- | --- |
| `locales` | Locales and their venues | Each locale needs `include: true` or it is skipped. Venues need an `address`: Google places them by name and address, and skips ones it can't find or that are permanently closed. A `label` is the locale's key; pick one that can't clash with a same-named city (`birmingham-uk`). |
| `calendar` | Dated events at venues | Needs a `source` key and `regions` mapping each region to a locale label. There is no recurrence: expand a weekly night into `all_dates` (each with its UTC offset). Only dates within `horizon_days` (default 60) are listed. Import the locales file first so venues match. |
| `people` | Talent, organizations, committees, publishers | Matched by name; anyone already on People is left as they are. |
| `socials` | Social links to fill in | Only networks with no link yet are filled. |
| `social_proposals` | Social links to propose for review | `candidates` likeliest first. |
| `divisions` | Official divisions as nested locales | Parents before children. |

Each object accepts the fields its importer reads, plus reviewer fields it ignores (`note`, `notes`, `confidence`, `evidence_url`, `reason`, a calendar listing's `rrule` and `status: tentative`). Anything else is an error, so a typo like `adress` is caught rather than dropped.

## Check a file before uploading

With Python:

```sh
pip install jsonschema
python3 -c 'import json,sys,urllib.request,jsonschema
s=json.load(urllib.request.urlopen("https://developer.audiencekit.com/schemas/listings-import/latest.json"))
d=json.load(open(sys.argv[1]))
errors=list(jsonschema.Draft202012Validator(s).iter_errors(d))
[print("/".join(map(str,e.absolute_path)) or "/", e.message) for e in errors]; sys.exit(bool(errors))' my-file.json
```

or with Node: `npx ajv-cli validate --spec=draft2020 -s latest.json -d my-file.json`.

AI agents (Claude included) uploading with `upload_listings` should validate the file against the latest URL first, fix every error, then upload, read the dry run's rows (check each Google match) and import only once a person has said to.
