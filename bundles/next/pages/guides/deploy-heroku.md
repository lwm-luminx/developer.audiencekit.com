---
title: Deploy to Heroku
description: Run the API, the admin console and the background worker on one Heroku app.
sidebar:
  order: 5
---

One Heroku app builds the API's repository (`lwm-luminx/audience_kit_api`) and runs each component as its own process type, as defined in its `Procfile`:

| Process | Runs |
| --- | --- |
| `release` | `db:migrate` before each release goes live |
| `web` | Puma: the API, plus the admin console for `admin.*` hosts and for browsers on any other host but `api.*` |
| `worker` | Resque. Off by default; scale it with `heroku ps:scale worker=1`. |

The build uses two buildpacks, as `app.json` lists them. `heroku/nodejs` builds the admin console (`app/frontend`, served through Vite Ruby) into `public/vite` with `package.json`'s `build` script, then `heroku/ruby` installs the gems. `VITE_RUBY_SKIP_ASSETS_PRECOMPILE_EXTENSION=true` keeps the Ruby buildpack's `assets:precompile` from building the console a second time.

## Set up the app

```sh
heroku buildpacks:clear -a audience-kit
heroku buildpacks:add -a audience-kit heroku/nodejs
heroku buildpacks:add -a audience-kit heroku/ruby
heroku config:set -a audience-kit RAILS_MASTER_KEY="$(cat api/config/master.key)"
heroku addons:create -a audience-kit heroku-postgresql:essential-0
heroku addons:create -a audience-kit heroku-redis:mini
heroku addons:create -a audience-kit bucketeer:hobbyist
```

## Configuration

| Setting | Purpose |
| --- | --- |
| `RAILS_MASTER_KEY` | Decrypts the credentials file used by the Facebook, Google, AWS, Eventbrite, Ticketmaster and Stripe integrations, and the Active Record encryption keys that protect tenants' push keys. |
| `SECRET_KEY_BASE` | Signs every JWT. Keep it stable, or every user and service JWT stops working. |
| `FACEBOOK_SECRET`, `FACEBOOK_CALLBACK_SECRET`, `GOOGLE_API_KEY`, `AWS_SECRET_KEY` | Runtime secrets, read from config vars in production. |
| `BUCKETEER_*` | Set by the Bucketeer add-on. Photos are stored under `public/photos/` in its S3 bucket and served straight from there. |
| `ADMIN_HOSTS` | Optional. Extra hosts that serve the admin console. |
| `ADMIN_ORIGINS` | Optional. Extra browser origins allowed to call the API. |

The console fetches `/v1/admin/config` from its serving API before starting. API URL and Facebook login IDs come from runtime Rails credentials for `RAILS_ENV`; secrets are never returned. GraphiQL is enabled outside production. Promoting a bundle does not carry staging login settings into production.

To build the encrypted credentials from `config/secrets.yml`, run this in the API checkout:

```sh
SOURCE=production FORCE=1 FACEBOOK_SECRET=... GOOGLE_API_KEY=... bin/rails credentials:import_secrets
```

It creates `config/master.key` if there is none (set it as `RAILS_MASTER_KEY`) and lists any keys that are still blank.

### Tenant push and payment keys

Push and payment keys aren't platform secrets: each tenant's APNs key and Firebase service account, and its Stripe and Square keys for cover charges, are set inside the Payments and Push plugin cards on its Extensions page in the platform console and stored encrypted on the tenant.

The Payments plugin card lists the URLs to give each provider:

- **Stripe**: a Connect webhook endpoint at `<API>/v1/payments/stripe/webhook/<audience ID>` for `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded` and `charge.dispute.created`; its signing secret goes in the card.
- **Square**: a tenant can set its production application, its sandbox application, neither or both, inside one Square card with a Production/Sandbox selector. Staging builds (anything on the `next` preview) take cover through the sandbox, with test cards; everything else through production. Each application's OAuth redirect URL is `<API>/v1/payments/square/return`, with a webhook subscription at `<API>/v1/payments/square/webhook/<audience ID>` (production) or `…/<audience ID>/sandbox` (sandbox) for `payment.updated`, `refund.updated`, `dispute.created` and `oauth.authorization.revoked`; an existing Square application serves both, but its Sandbox and Production tabs have their own credentials and webhooks, so each tab needs its own subscription, and each signature key is saved in its card's Webhook section, apart from the application ID and secret. Square's Send test event shows on the card as the last delivery, with whether its signature matched. Each card has a How to set up guide with these URLs to copy and the Apple Pay processing certificate steps. A venue connects a sandbox test account from its Cover charge panel, beside its real one. Square access tokens last 30 days; the daily Refresh Square tokens operation renews them.

## Deploy

Deploy from the Heroku dashboard's Deploy tab (GitHub, `lwm-luminx/audience_kit_api`, branch `main`), or submit a committed source archive through the [Heroku Build API](https://devcenter.heroku.com/articles/build-and-release-using-the-api). `GET /up` is the health check. `/status` reports database connectivity and the minimum app versions; the apps also `POST` their device there, and `POST /` still answers for builds already shipped.

To serve an audience's admin console, add `admin.<audience domain>` as a custom domain on the app. See [Connect a domain](/guides/domains/).

## Preview API (`next`)

The `next` branch runs on `audience-kit-next`, the staging stage of the `audience-kit` pipeline. Configure production (`audience-kit`) to deploy `main` and preview to deploy `next`. It runs the new API and console code against production data: it shares production's database, Redis, Bucketeer storage and encrypted application credentials, with separate hosts and a separate session signing key, so its data changes affect production. Each API is one environment, set by `RAILS_ENV`:

| API | `RAILS_ENV` | Builds |
| --- | --- | --- |
| `api.local.audiencekit.com` | `development` | Local development |
| `api.next.audiencekit.com` | `staging` | Staging builds of the apps, and the `next` console |
| `api.audiencekit.com` | `production` | Release builds |

`staging` runs production's settings (`config/environments/staging.rb` loads `production.rb`) with the `staging:` credentials: the API endpoint, and the AudienceKit - Next Facebook app as the platform app. Every request is a staging build, so people sign in with each audience's staging Facebook app and cover charges go through payment sandboxes. Active Record encryption keys are top-level credentials, shared with production, so the preview reads production's encrypted data. The provisioning script below describes an isolated setup for a new preview app; do not run it unchanged against the current shared setup.

| Host | Serves |
| --- | --- |
| `api.next.audiencekit.com` | The preview API (`API_HOST`) |
| `admin.next.audiencekit.com` | The platform console (`PLATFORM_ADMIN_HOST`) |
| `<subdomain>.api.next.audiencekit.com`, `<subdomain>.admin.next.audiencekit.com` | An audience's API and console |

Register the two explicit API/admin hosts above as well as three wildcard domains: `*.next`, `*.api.next` and `*.admin.next`, each with its own Heroku DNS target and ACM coverage. Explicit host records are required because the nested wildcards create DNS parent names that do not inherit `*.next`.

To set it up, with the Heroku CLI signed in as an owner of `audience-kit`:

1. Run `scripts/heroku/provision-next.sh`. It creates the app and pipeline, adds Postgres `essential-0` and Redis `mini`, copies production's config vars except add-on URLs, signing and encryption keys and hosts, sets the `next` hosts, adds the five domains with ACM, and prints the DNS records.
2. Add those five CNAME records to `audiencekit.com` at Namecheap (hosts `api.next`, `admin.next`, `*.next`, `*.api.next`, `*.admin.next`). ACM issues the certificates once they resolve.
3. In the app's Deploy tab, connect `lwm-luminx/audience-kit` and enable automatic deploys from `next`, then deploy the branch once. The release phase migrates the empty database.
4. Add `https://admin.next.audiencekit.com/` to the AudienceKit - Next Facebook app's allowed JavaScript SDK domains so the platform console can sign in. That app is deliberately outside the Love Wins Media business portfolio, so people who sign in on the preview get their own preview accounts, separate from their production ones, to experiment with.

Keep the current shared preview without a Scheduler job or worker dyno so it does not duplicate production maintenance or consume the shared job queue. Uploads use the shared Bucketeer bucket. An isolated preview provisioned from scratch has no Bucketeer bucket until storage is configured separately.
