# Operational readiness checklist

Setup checklist for a publication with its own repository, domain, content and maintainer. See the [operations SOP](operations.md) for architecture and recurring procedures.

**Selected services:** hosted GoatCounter for readership **and** Cloudflare Web Analytics for real-user performance; Google Search Console for search visibility.

## Project inputs

| Input | Required value |
| --- | --- |
| Repository (`OWNER/REPO`) | Project owner's GitHub account or organization and repository name |
| Production domain (`DOMAIN`) | Project's apex domain, without `www` |
| Canonical publication URL | `https://DOMAIN/` |
| Default and deployment branch | `main` |
| Operating owner | Maintainer responsible for deployments and monitoring |
| DNS provider | Cloudflare, using the nameservers assigned to the project's zone |

Substitute these inputs in the steps below and obtain verification values and provider identifiers from the project's accounts. Check each item only after verifying its outcome. Keep execution evidence, account-setting snapshots and security findings in a private project record.

## Project configuration and local environment

### PROJECT-01 — Set the publication identity and content

- [ ] Verify all project-specific source values and content before the first release.

1. Set the collection copy, author identity, `repositoryUrl` and canonical `siteUrl` in `topics/topics.json`. Use the new production URL with its trailing slash.
2. Supply the project's own topics, assets and topic order. Review About, Privacy, Licensing and security/contact wording for the actual maintainer and services. Follow the source ownership and content rules in `AGENTS.md`.
3. Update the sitemap URL in `robots.txt`, publication links in the root README, and the domain/repository/owner configuration in the operations SOP. Search authored sources for the previous project's domain and repository; review each match rather than replacing unrelated citations or examples.
4. Check that generated canonical URLs, feed/sitemap links, Markdown editions and policy links use the new identity. Keep generated output out of Git.

**Done when:** the reviewed sources and generated bundle describe the intended project and owner, without accidental links to the original publication.

### LOCAL-01 — Prepare and validate a fresh checkout

- [ ] Install the local toolchain and validate the project's publication bundle.

1. Install Node.js 24, Git and GitHub CLI (`gh`); authenticate the CLI to the intended account and confirm access to `OWNER/REPO`. Do not record authentication tokens here.
2. Run `npm ci` and `npx playwright install chromium`.
3. Run the SOP's [local validation procedure](operations.md#local-build-and-validation), including type checking, tests, publication build, source/output check and browser tests.
4. Preview the homepage and representative topics at desktop and narrow widths, in both designs and themes. Verify content, navigation, search and relevant interactions.
5. Record the source revision, validation results and any unresolved failures.

## DNS and Pages

### DNS-01 — Configure and verify the canonical domain

- [ ] Verify domain ownership, authoritative DNS and the apex-only hostname policy.

1. Register/control `DOMAIN`, add its zone to Cloudflare and set the registrar to the nameservers assigned to that zone.
2. In GitHub account/organization **Settings → Pages**, add and verify the domain using GitHub's exact ownership TXT record. Retain that record.
3. Add DNS-only apex A records using [GitHub's current Pages addresses](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). Add IPv6 only using GitHub's documented values if desired; remove conflicting records.
4. Keep `www` absent for this apex-only setup. Retain Google's separate verification TXT record once SEARCH-01 is completed.
5. Query the zone's authoritative nameservers for the apex A records, ownership TXT record and absent `www`. Record the nameserver and answers; allow recursive caches time to expire.

**Done when:** the new domain's ownership and authoritative records match its intended GitHub Pages configuration.

### HOST-01 — Enable Actions publishing and enforce HTTPS

- [ ] Verify Actions publishing, the custom domain and enforced HTTPS.

1. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**.
2. Set the custom domain to `DOMAIN`. Wait for GitHub's DNS check and certificate provisioning, then enable **Enforce HTTPS**.
3. Verify the approved certificate covers the hostname and record the Pages settings. Do not use branch-folder publishing.

### HOST-02 — Restrict production deployments to main

- [ ] Verify the `github-pages` environment allows only `main`.

1. Open **Settings → Environments → github-pages → Deployment branches and tags**; create the environment if needed.
2. Select specific branches/tags and allow only the `main` branch. Keep the workflow's deploy condition restricted to `main` and non-PR events.
3. Retain Pages/OIDC write permissions only on the deployment job, then verify the resulting environment policy.

## GitHub settings

Create or edit one `main` branch protection rule under **Settings → Branches**. Avoid overlapping rulesets that duplicate it. Security menu labels may appear under **Advanced Security** or **Code security and analysis**.

### GH-01 — Configure branch guards

- [ ] Verify administrator enforcement, linear history and disabled force pushes/deletion on `main`.

1. Create/edit the `main` protection rule. Require linear history and apply the protections to administrators (the UI may call this disallowing bypass).
2. Leave force pushes and branch deletion disabled.
3. Save and verify the effective protection settings.

### GH-02 — Require the actual build check before merging

- [ ] Enforce the successful `build` status check on `main`.

1. In the protection rule, enable **Require a pull request before merging** and **Require status checks to pass before merging**.
2. Select **build**, produced by GitHub Actions. If unavailable, let the workflow complete on a PR, then select the exact check name it produces.
3. Enable **Require branches to be up to date before merging** and retain administrator enforcement.
4. Save and verify a PR with a failing/incomplete build cannot merge. Record the PR/check evidence; do not merge the test failure.

Do not require **deploy** or the production deployment before merge: deployment runs on `main` after merging. See [GitHub's branch-protection guide](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

### GH-03 — Apply a workable review and conversation policy

- [ ] Record and apply the review policy, and require resolution of review conversations.

1. Enable **Require conversation resolution before merging** in the protection rule.
2. For a solo maintainer, retain PRs and required CI while recording that independent human approval is not required. The author cannot approve their own PR; an AI review is not an independent human approval.
3. With an available independent maintainer, require at least one approval and dismiss stale approvals. Configure matching `CODEOWNERS` entries before relying on required Code Owner review; leave that requirement off when no usable owners exist.
4. Save, record the chosen policy and verify the resulting settings and merge behavior.

### GH-04 — Restrict fork workflow execution

- [ ] Require approval for all external contributors' fork PR workflows.

1. Open **Settings → Actions → General**.
2. Under approval for fork pull request workflows, select **Require approval for all external contributors** and save.
3. Retain the `pull_request` trigger; do not use `pull_request_target` to execute untrusted code in a privileged context.
4. Re-read the setting and record `all_external_contributors` or its current equivalent. Review a genuine fork run's approval gate when available.

### GH-05 — Restrict allowed Actions and enforce full SHA pins

- [ ] Apply an Actions allowlist and repository-level full-length SHA enforcement.

1. Under **Settings → Actions → General → Actions permissions**, allow the owner and selected other Actions.
2. Allow the official `actions/*` namespace used by this workflow. Review any additional entry; the inherited workflow needs no other external Action namespace.
3. Enable **Require actions to be pinned to a full-length commit SHA**, if available, and save. Record an unavailable control rather than claiming it is enabled.
4. Run the publication workflow, including the composite Pages upload, to confirm required dependencies are allowed. Record the settings and successful run; retain weekly Dependabot updates to pinned SHAs.

See [GitHub's Actions settings guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).

### GH-06 — Configure least-privilege workflow tokens

- [ ] Verify read-only defaults and disabled PR creation/approval by the default workflow token.

Under **Settings → Actions → General → Workflow permissions**, select read-only contents/packages permissions and leave **Allow GitHub Actions to create and approve pull requests** off. Verify that Pages/OIDC writes belong only to deployment and checkout uses `persist-credentials: false`.

### GH-07 — Enable dependency vulnerability monitoring and fixes

- [ ] Enable and verify the dependency graph, Dependabot alerts and Dependabot security updates.

1. Open repository security settings and confirm the dependency graph is enabled/available.
2. Enable **Dependabot alerts** and **Dependabot security updates**. Keep the inherited weekly Actions/npm version-update configuration.
3. Inspect **Security → Dependabot** for a completed scan. Review real alerts and update PRs through normal CI; an empty inbox alone does not prove scanning ran.
4. Record settings and scan evidence. Configure delivery under MON-01.

### GH-08 — Enable secret scanning and push protection

- [ ] Verify secret scanning and secret-scanning push protection are enabled.

Enable both in repository security settings, verify their effective status and review genuine alerts. Do not commit a real credential to test them.

## Contact and security reporting

### CONTACT-02 — Enable GitHub private vulnerability reporting

- [ ] Enable private vulnerability reporting, publish the correct route and verify access/notifications.

1. In repository security settings, enable **Private vulnerability reporting**.
2. Publish `SECURITY.md` on the default branch with a link to `https://github.com/OWNER/REPO/security` and instructions to select **Report a vulnerability**. State that reporting requires a GitHub account and sign-in.
3. Verify the Security page displays the policy and reporting button for an appropriate non-maintainer account. Check the logged-out sign-in/return path. Point the published `security.txt` contact and policy to the same Security page; rebuild and verify both links and expiry.
4. Configure the maintainer's security-report subscriptions and notification delivery. With an authorized, consenting tester, use a clearly labeled benign report to verify receipt; record only non-sensitive evidence.
5. Deploy the policy/contact configuration and verify the live discovery file and form.

See [GitHub's private-reporting setup and notification prerequisites](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

### CONTACT-03 — Configure public feedback and contact wording

- [ ] Advertise a usable public feedback route and state its account requirement.

1. Enable repository Issues under **Settings → General → Features** and link the project's issue entry point for non-sensitive feedback. Label it public and requiring a GitHub account; subscribe the maintainer to relevant notifications.
2. Review contact wording in About, Privacy, Licensing and the security policy. A bare GitHub profile must not imply a private inbox.
3. If contact without a GitHub account is required, supply an actual public alias or approved form destination. Do not invent an email address or infer one from commits.
4. Verify advertised routes for their stated audience, including a logged-out check. Record the chosen policy and any intentionally unsupported audience. Keep sensitive reports on CONTACT-02's private route.

## GoatCounter and Cloudflare Web Analytics

Each project needs its own GoatCounter and Cloudflare Web Analytics sites and identifiers. Activation requires shared analytics integration support.

### ANALYTICS-01 — Configure the hosted GoatCounter site

- [ ] Create/access the project's hosted GoatCounter account and register its production site.

1. Create the site for `DOMAIN` in [GoatCounter](https://www.goatcounter.com/).
2. Record the assigned site/dashboard location and exact HTTPS collection endpoint. Keep administrative credentials private.
3. Obtain the genuine public client configuration/snippet from the account; follow the [installation guide](https://www.goatcounter.com/help/start).
4. Configure maintainer-visit exclusions and dashboard access. Keep local tracking disabled.

### ANALYTICS-02 — Configure the Cloudflare Web Analytics site

- [ ] Add the project's hostname and obtain its manual snippet.

1. Open **Cloudflare → Web Analytics → Add a site**, enter `DOMAIN`, and copy its assigned public beacon token and current snippet.
2. Use the documented **site not proxied through Cloudflare** setup. Keep DNS-only GitHub Pages hosting.
3. Record the dashboard location and public client configuration without account/API credentials. Follow [Cloudflare's setup guide](https://developers.cloudflare.com/web-analytics/get-started/).

### ANALYTICS-03 — Activate and verify both services for this domain

- [ ] Configure both provider identities, production hostname, CSP and privacy disclosure, then verify live collection.

Dependencies: ANALYTICS-01 and ANALYTICS-02, and shared integration support in the inherited source.

1. Configure the project's real provider identifiers and exact production hostname in the shared integration. Keep local and PR previews uncounted; do not copy snippets into articles or generated HTML.
2. Restrict GoatCounter page paths to canonical paths without search queries/fragments and inspect referrer handling. See its [JavaScript API](https://www.goatcounter.com/help/js).
3. Verify CSP allows only the intended script/collection endpoints alongside existing restrictions: GoatCounter uses `https://gc.zgo.at` and the assigned site's `/count` endpoint; Cloudflare uses `https://static.cloudflareinsights.com/beacon.min.js` and, for this non-proxied setup, `https://cloudflareinsights.com/cdn-cgi/rum`. Verify the actual snippets against [GoatCounter CSP guidance](https://www.goatcounter.com/help/csp) and [Cloudflare collection details](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/).
4. Inspect outgoing payloads with harmless query/referrer markers. Cloudflare's documented absence of query-string logging does not prove its beacon never transmits them. Verify transmission/retention before acceptance; record an unresolved privacy mismatch and leave activation unchecked rather than changing reader URLs to conceal it. See [Cloudflare's FAQ](https://developers.cloudflare.com/web-analytics/faq/).
5. Publish accurate `pages/privacy.md` disclosure of both services, their purposes, third-party requests, query/referrer handling and relevant retention. Publish disclosure changes together with analytics activation.
6. Run local validation. Verify collection occurs as intended on production, no local/preview collection, no duplicate counts for design/theme switches, no CSP violations, and usable reading with either provider blocked.
7. Deploy through REL-01, verify the live privacy text and inspect both dashboards for the intended visit/performance data. Allow processing time; Cloudflare beacons can arrive when a page is hidden/leaving.

**Done when:** both live integrations, their privacy disclosures and collection checks pass. Loading a script alone is insufficient.

## Search visibility

### SEARCH-01 — Verify Google Search Console

- [ ] Verify the domain property and submit/inspect the production sitemap.

1. Sign in to [Search Console](https://search.google.com/search-console/), add a **Domain** property, and enter `DOMAIN` without a protocol or `www`.
2. Add Google's exact TXT verification record at Cloudflare's apex (`@`), then choose **Verify**. Retain the record.
3. Submit `https://DOMAIN/sitemap.xml` under **Sitemaps**. Inspect the homepage and a topic for reachability, selected canonical and indexing state; request indexing where appropriate.
4. Record verification, sitemap processing and indexing issues. Confirm access to Performance and Page indexing reports; reporting can take time to accumulate.

No site analytics script is required. See Google's [property setup](https://support.google.com/webmasters/answer/34592?hl=en) and [ownership verification](https://support.google.com/webmasters/answer/9008080?hl=en). Submission does not guarantee indexing.

## Initial deployment and monitoring activation

### REL-01 — Publish and verify the project's first release

- [ ] Deploy the reviewed project configuration/content and verify the live publication.

1. Finish the applicable setup and run [local validation](operations.md#local-build-and-validation). Account features requiring a successful workflow can be completed after its first run; keep the corresponding tasks open until verified.
2. Open/update a PR, inspect the **build** result and downloadable preview, and merge under the chosen policy. Wait for **build** and **deploy** on `main`.
3. Follow the SOP's [post-deployment checks](operations.md#deployment-and-post-deployment-verification) against this project's domain, including HTTPS, a nested 404, search/assets, feed/sitemap, Markdown/LLM editions, `security.txt` and `/version.json`.
4. Record the PR, successful run URL, deployed full revision and footer edition. Analytics/contact activation must also receive its own live verification.

**Done when:** the live project serves the reviewed edition and required files/behaviors. A local bundle is insufficient.

### MON-01 — Verify maintainer notification delivery

- [ ] Configure Actions/security/issue notifications and prove the intended delivery path.

1. Under personal **Settings → Notifications**, configure web/email delivery for Actions failures and repository/security activity. Confirm the destination address without recording it here if private.
2. Under repository **Watch → Custom**, subscribe to relevant issue/security activity. Private-report delivery is also verified under CONTACT-02.
3. Use an authorized, non-production workflow failure, such as a test PR that is never merged, to verify receipt. Restore/close the test and record the run/result.
4. Record coverage limits. Built-in Actions notifications cover runs the user triggers; if other actors' failures must reliably notify the maintainer, configure and test explicit coverage before claiming it.

See [workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs) and [repository subscriptions](https://docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications).

### MON-02 — Assign an owner and perform the first monitoring cycle

- [ ] Record the operating owner/cadence and complete the first cycle.

1. Confirm the operating owner from the project inputs and record the weekly/monthly review cadence from the SOP.
2. Perform a live-site/HTTPS/edition check.
3. After activation, review GoatCounter readership and Cloudflare performance separately. Record the initial observation/window; do not sum their traffic counts.
4. Inspect Google Search Console's indexing report and record actionable errors/exclusions.
5. Inspect dependency/security notifications and `security.txt` expiry. Record the next review and rebuild-before-expiry date.

**Done when:** the first cycle has evidence and an owner/cadence is recorded. Automated uptime and production JavaScript-error reporting are outside the configured coverage.
