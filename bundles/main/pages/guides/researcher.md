---
title: Run the researcher worker
description: Keep an audience's venues and events fresh with a local model in LM Studio and your Chrome.
sidebar:
  order: 4
---

The researcher (`workers/researcher/`) is a local worker for a Mac. It drives a model running in [LM Studio](https://lmstudio.ai) through tool calls: the model searches the web, opens pages in Chrome, compares what AudienceKit already stores, and proposes venues and events. The worker validates the proposals and upserts them through the [research endpoints](/api/rest/#research) with a [service token](/guides/service-tokens/).

It isn't deployed with the API, because it needs your machine's LM Studio and Chrome.

## Set up

1. Create a service token for the audience, as in [Automate with service tokens](/guides/service-tokens/).
2. In LM Studio, load a model that supports tool calling (for example `qwen/qwen3-30b-a3b`, `meta-llama-3.1-8b-instruct` or `mistralai/devstral-small`; 32k context or more works best) and start the local server on `http://localhost:1234`.
3. Start Chrome with remote debugging so the worker can use your signed-in sessions:

   ```sh
   open -na "Google Chrome" --args --remote-debugging-port=9222
   ```

   Or set `CHROME_MODE=launch` to have the worker start its own Chrome profile.
4. Install and configure the worker:

   ```sh
   cd workers/researcher
   npm install
   cp .env.example .env   # set AUDIENCEKIT_API_URL and AUDIENCEKIT_SERVICE_TOKEN
   npm run build
   node dist/index.js doctor
   ```

   `doctor` checks the token exchange, LM Studio and Chrome.

## Run

```sh
node dist/index.js plan                      # show what a pass would do
node dist/index.js run --dry-run --limit 1   # run one task and validate the batch without writing
node dist/index.js run                       # a full pass
node dist/index.js run --watch 360           # a pass every six hours
```

`run` also takes `--only metro|discover|verify` to run one kind of task and `--locale <label>` to work on one locale. For example, `run --only metro` maps metro areas without touching venues.

Each pass fetches the audience's snapshot and plans three kinds of task:

- **Metro**: lists the towns in a locale's metro area with their coordinates, so the locale's area grows to take in its suburbs. Runs when a locale has no metro area yet or it's more than 180 days old.
- **Discover**: finds and confirms the main venues in a locale with fewer than five.
- **Verify**: refreshes a venue last verified more than `STALE_AFTER_DAYS` ago. It starts on the venue's own website, uses its Google Maps place as context, collects its official social profiles, finds upcoming events and their regular hosts, and, when no Facebook Page is linked, finds the venue's Page and its numeric ID.

The API links a venue's Page by reading it with the audience's Facebook app. Until Meta approves Page Public Metadata Access, most Pages are refused and the venue keeps the reason in `facebook_link_error`.

Only stale venues are planned, so after an interruption or a failed batch, the next pass picks up where the last one stopped.

Payloads and a `report.json` for each pass are written under `RUNS_DIR`. The worker runs from `dist/`, so after pulling changes, run `npm run build` and restart it.

The [worker's README](https://github.com/lwm-luminx/audience_kit_api/tree/main/workers/researcher) has the full reference: every option and setting, the tools the model can call, and troubleshooting.

To run it in the background, install the LaunchAgent in `workers/researcher/launchd/com.audiencekit.researcher.plist`; the commands are in the file's header comment.
