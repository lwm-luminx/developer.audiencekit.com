---
title: Licensing
description: What the AudienceKit SDK License lets you do with the SDKs, in plain language, and where the binding text lives.
---

:::note
This page is a summary to help you find your way. The license text in each repository is what binds; where they differ, the license wins.
:::

## The SDKs are source-available

The AudienceKit SDKs ([audience-kit-sdk](https://github.com/lwm-luminx/audience-kit-sdk), and StaffKit) are published so you can read them, build them into your apps and services, and see exactly what they send. They are **not open source**. They ship under the [AudienceKit SDK License](https://github.com/lwm-luminx/audience-kit-sdk/blob/main/LICENSE) whose central condition is that the SDKs, and anything derived from them, may be used only with AudienceKit as hosted by Love Wins Media, Inc.

## What you can do

- Build the SDKs into apps, websites, bots and services that connect to the hosted AudienceKit API (`api.audiencekit.com`, the audiences' own domains, and the development instances Love Wins Media provides).
- Ship those apps commercially. AudienceKit takes no commission on your sales; platform plans carry their own costs.
- Read and audit the source, and report security issues.

## What you can't do

- Use the SDKs, or code derived from them, with another implementation of the AudienceKit API, or to build one.
- Change the SDKs anywhere but a fork of their repository, made with GitHub's fork function, and only after telling Love Wins Media in writing (for example, by opening an issue titled "Derived work notice" that names you, how to reach you, and the fork). An app that only calls or depends on the unchanged SDK needs no fork or notice.
- Misrepresent where the code came from, or remove or alter its copyright and attribution notices.

Any other use needs a written agreement signed by Love Wins Media, Inc., and an audience credential issued for it.

## Our open-source libraries

The general-purpose libraries Love Wins Media publishes, such as graph_query and retcon, are different: they're open source under the MIT License and carry none of the conditions above. See [Open-source libraries](/open-source/).

## These docs and the platform

The text of this site, the API, the admin consoles and the apps are copyright Love Wins Media, Inc., all rights reserved. The [site's repository](https://github.com/lwm-luminx/developer.audiencekit.com) is public so it can be read and security-scanned, not reused; see its [NOTICE](https://github.com/lwm-luminx/developer.audiencekit.com/blob/main/NOTICE.md).

Questions about licensing: [hello@audiencekit.com](mailto:hello@audiencekit.com).
