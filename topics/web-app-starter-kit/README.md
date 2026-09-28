# A web app starter kit built for the long run

A business application that clones a web app starter kit does not need to keep the starter's design. It may replace the entire UI, remove the sidebar and dashboard, introduce completely different workflows, and become a product the starter's authors never imagined. **That is a normal use of a starter, not a compatibility problem to prevent.**

The interesting question is whether the starter can remain useful to that application afterward. Can the application still benefit from an authentication fix, a security improvement, a dependency update, or a new shared capability without restoring the starter's layout or undoing its own product decisions?

That is a challenge for the **architecture of the starter kit**. It needs to separate reusable capabilities from its default product design, leave clear space for business functionality, and provide customization and maintenance mechanisms that work for very different applications.

The goal is not to keep downstream applications close to the template. It is to make the starter a useful foundation even when they are not.

This is a design direction, not a description of a finished upgrade system. The layouts, manifests, commands, and version numbers below are illustrative. Several implementation choices remain deliberately open.

## 1. The starter's design is a starting point, not a requirement

A starter may arrive as a polished SaaS application: authentication and account flows, a landing page, sign-up and waitlist functionality, a sidebar, menus, dialogs, buttons, and a conventional dashboard. That gives a team something useful immediately. It does not define what the team's product should become.

One downstream application might retain much of that structure. Another might be mobile-first. A third might be a full-screen workflow tool or a game-like experience with no dashboard at all. All are legitimate uses of the same starter.

What they may still share is a need for capabilities such as user/session handling, database infrastructure, security controls, APIs, and build/deployment conventions. The starter will continue improving those capabilities through patches, dependency updates, bug fixes, and new functionality. Those improvements should not be unnecessarily tied to keeping its default presentation.

The design question is therefore:

> How should we architect the starter so a business application can become very different from it and still selectively benefit from its future improvements?

This requires more than a promise that teams are free to edit the code. The starter needs clear ownership boundaries, replaceable presentation, deliberate branding and localization surfaces, version information, and tooling that understands which changes belong to the product and which affect the shared capabilities it uses.

The intended result is a managed way to receive useful improvements without repeatedly performing a difficult manual merge—or being pushed back toward the template. The work starts in the starter, before it is cloned.

## 2. Create separation before the clone

<!-- excerpt:separation -->
Prepare the starter so the downstream application already has a clear place to build its own product. Business logic, a different interface, and new workflows should not require scattering changes through the implementation of reusable starter capabilities.

Separate those capabilities from application-owned code before cloning. Make replacement, extension, configuration, branding, and localization explicit parts of the architecture—not accommodations each downstream team must invent afterward.
<!-- /excerpt:separation -->

Conceptually, a starter could establish a structure like this:

```text
application/
├── starter-owned-or-shared/
├── business-app-owned/
├── configuration/
├── branding/
├── localization/
└── tooling/
```

The exact directory names are not the important decision. The important decision is that the future business application already has a clearly defined place to grow.

The starter team should resolve questions such as:

- Which files remain starter-owned?
- Which files are expected to be customized downstream?
- Which files provide supported extension points?
- Which areas may be overridden but should not normally be edited directly?
- Which areas need protection?
- How can the application replace the starter's presentation without unnecessary changes to reusable capabilities?

These answers should shape the starter, not merely appear in a document added after cloning. A downstream team or coding agent should be able to see where new product work belongs without having to reverse-engineer the intended boundaries.

The business-owned area is not just a place to add pages inside the starter's existing shell. It must leave room for an application with a different shell—or no equivalent of that shell at all.

## 3. Separate reusable capabilities from the starter's own UI

<!-- excerpt:presentation -->
The application can replace the sidebar, dashboard, navigation, and entire page composition. Authentication, sessions, security controls, database infrastructure, and shared services may still be useful to that very different product.

Architect those capabilities so retaining them—and receiving improvements to them—does not unnecessarily require retaining the starter's presentation. A different product design is an expected outcome, not an exception to the architecture.
<!-- /excerpt:presentation -->

A professional SaaS-style starter—with a sidebar, menus, dialogs, buttons, and a conventional application shell—is one useful starting point. It is not the only product shape that should be possible.

The downstream product might be a highly customized workflow application, a mobile-first experience, a game-like interface, a full-screen interactive product, or an application with no sidebar at all. Its authenticated experience may be structurally unrelated to the default UI.

The architecture therefore needs to distinguish two categories:

| Broadly reusable platform capabilities | Starter-specific presentation choices |
| --- | --- |
| Authentication and user/session handling | Sidebar and default navigation |
| Database infrastructure | Dashboard structure |
| Registration, sign-up, and waitlist capabilities | Page composition |
| Shared security controls | Menu organization |
| Common APIs, services, and cross-cutting utilities | Visual hierarchy |
| Build and deployment conventions | Default product workflow |

For example, imagine an application that replaces the dashboard with a full-screen interactive experience but continues using the starter's session handling. A later session-security fix should be evaluated against that session implementation and its integration with the application—not against whether the old dashboard still exists. Applying the fix should not recreate the deleted dashboard.

The point is not to remove useful UI from the starter or require every application to discard it. The default UI remains valuable to products that want it. The architecture should make keeping, adapting, and replacing it ordinary choices, while keeping reusable capabilities as independent of those choices as practical.

## 4. Use AI agents as architecture stress tests

<!-- excerpt:experiments -->
Ask AI coding agents to build radically different applications from the starter. Do not judge the experiment by how faithfully they retain its design. Observe which capabilities remain useful and where creating the requested product forces them to modify, replace, bypass, or fight the starter.

Use that evidence to improve the starter's separation and extension points. The main output is a better architecture for downstream freedom, not the experimental applications themselves.
<!-- /excerpt:experiments -->

This is a way to test the architecture against actual downstream development rather than relying entirely on the starter team's expectations.

Give multiple agents tasks such as:

- Build a conventional business dashboard.
- Build a mobile-first SaaS product.
- Build an application with a radically different layout.
- Build a game-like authenticated experience.
- Build a workflow-heavy enterprise application.
- Build a product with extensive branding customization.
- Build an application with substantial localization requirements.

Then inspect what happened. Which starter files did the agents edit or replace entirely? Which files caused friction? Which primitives remained useful across the different applications? Which directories naturally became business territory? Which assumptions proved too rigid?

Most importantly, distinguish a legitimate product decision from unnecessary coupling. Removing a sidebar is not a failed experiment. Having to rewrite session handling just to remove that sidebar would be evidence to investigate in the starter's architecture.

Ask which modifications would make future improvements difficult to adopt, and which boundaries or extension points would avoid that difficulty **without giving up the requested product design**.

The output should help define the starter's supported extension and replacement model. These are tests of whether the starter serves different products, not tests of whether agents can be persuaded to keep products similar.

## 5. Use ownership to preserve the application's choices

Ownership rules should tell an upgrade tool what it is maintaining and what it must leave alone. They are not a way to reserve the application's design decisions for the starter team.

The starter should distinguish reusable implementation, application-owned work, and supported replacement or extension surfaces:

| Category | Meaning |
| --- | --- |
| **Starter core** | Reusable implementation maintained by the starter. Provide ways to use and extend it without direct edits where practical; inspect direct modifications when upgrading it. |
| **Extension point** | Designed to be implemented or overridden by the business application. |
| **Business-owned** | Downstream application code that starter upgrades should not overwrite. |
| **Generated** | Produced by tooling rather than maintained by hand. |
| **Configuration** | Supported values that intentionally alter starter behavior. |
| **Replaceable UI** | Default presentation that the application can keep, adapt, or remove. An upgrade must not assume it still exists or restore it merely because it was in the starter. |

These classifications should eventually be machine-readable. An illustrative ownership manifest could look like this:

```yaml
starter:
  version: 3.4.0

ownership:
  starter_core:
    - src/platform/**
    - src/auth/**

  extension_points:
    - src/app/**
    - src/integrations/**

  business_owned:
    - src/business/**

  generated:
    - generated/**
```

The actual format should fit the technology stack. The important property is that an upgrade agent does not have to infer ownership solely from Git history.

### Do not over-protect the starter

There is a tension here. If too much code is declared untouchable, downstream teams will find the starter restrictive and bypass its rules.

The goal is not **“never change the starter.”** The goal is **“make it obvious which changes increase future upgrade cost.”**

Record downstream decisions so future tooling understands them. For example:

```text
Application-owned choices:
- default navigation replaced
- dashboard shell removed
- email templates owned by the business application
```

These are normal product choices, not compatibility failures. The record tells the upgrade tool not to reintroduce the default navigation, dashboard, or templates.

A direct change to a shared session implementation may create a different kind of issue: an incoming fix might depend on behavior that the application changed. That deserves an explicit compatibility assessment and, where needed, a recorded exception. It should not be confused with choosing a different UI.

Freedom to change the product does not make every implementation change automatically compatible. The starter's responsibility is to avoid unnecessary coupling, make the real costs visible, and distinguish those costs from harmless differences in design.

## 6. Treat branding as a supported customization surface

Branding should not be an ad-hoc collection of edits scattered across starter implementation files. It is an expected part of creating a downstream product, so the starter should document where it belongs.

The branding surface may include:

- Logos, favicon, and app icons.
- Product and company names.
- Colors, theme tokens, and typography.
- Images and illustrations.
- Email branding.
- Metadata, browser titles, and social previews.
- Default copy.
- Legal and footer content.
- Login and sign-up visual treatment.

A downstream team or AI agent should be able to answer:

> Where do I put this application's branding without modifying starter-core implementation?

Ideally, starter updates should not overwrite those choices. A central branding configuration or theme contract may be a useful development direction, especially if ordinary branding currently requires editing many unrelated source files.

The implementation is still a design choice. The architectural commitment is that branding belongs to the business application and has a supported home, rather than surviving as accidental patches against core code.

A theme contract is useful for an application keeping the default components. It must not be the only way to express a different product: an application replacing the entire presentation should be able to own that presentation rather than squeeze it into the starter's theme options.

## 7. Separate starter and business localization

Localization is another predictable collision between starter evolution and business customization. The starter needs its own strings, the business application needs domain-specific strings, and the application may also want to override some starter wording.

The design should answer:

- Where do starter-provided and business-specific strings live?
- Which starter strings may the application override?
- Are downstream strings stored separately?
- What happens when the starter adds, renames, or removes a key?
- How are missing and stale translations detected?

Instead of requiring applications to edit the starter's translation files directly, separate the ownership into namespaces:

```text
locales/
├── starter/
│   ├── en.json
│   ├── de.json
│   └── ...
└── business/
    ├── en.json
    ├── de.json
    └── ...
```

Equivalent namespacing inside the chosen localization framework could serve the same purpose. An explicit override layer may also be useful:

```text
starter defaults
      ↓
business overrides
      ↓
runtime strings
```

This is preferable to creating perpetual merge conflicts inside shared JSON files.

Upgrade tooling could then detect added and removed starter keys, downstream overrides that target removed keys, missing translations, duplicate keys, namespace collisions, and deprecated strings. Whether overrides can survive key renames automatically is a question the localization contract still needs to resolve.

## 8. Treat the starter as a versioned contract

A starter needs a version identity that survives cloning. The business application should be able to identify both its current starter baseline and a potential compatible target:

```text
Current application starter baseline: 3.2.1
Latest compatible starter baseline: 3.5.0
```

This can be recorded in metadata rather than inferred only from Git ancestry:

```yaml
starter:
  id: company-webapp-starter
  baseline_version: 3.2.1
  last_upgrade: 2026-09-01
```

The application is no longer merely “a fork from some old commit.” It is **“an application based on starter contract version X.”**

That gives humans and agents a known baseline for understanding incoming changes. It does not mean the application promises to resemble that version's default product. Version identity should be understood alongside which capabilities the application uses, which areas it owns, and any implementation changes that need special treatment.

The canonical source of a version and the way releases are distributed still need to be chosen.

## 9. Build upgrade and validation tooling into the starter

<!-- excerpt:tooling -->
Ship tooling that helps a downstream application receive useful starter improvements without undoing its product decisions. It should understand retained capabilities, replaced UI, business-owned code, and real implementation conflicts—not treat every difference from the template as something to repair.

Upgrade the upgrade tooling first: obtain the latest compatible tooling that understands the current application and incoming starter version before attempting the migration.
<!-- /excerpt:tooling -->

Moving from starter version A to version B requires knowledge of both states. The downstream application should first obtain upgrade and validation tooling that understands that path. “Latest compatible” matters: the tool must understand the application's current baseline as well as the target.

This tooling could have several responsibilities.

### Validation

For the starter capabilities the application uses, validate the behavior that matters: authentication contracts, session behavior, required configuration, security headers, middleware, database assumptions, API contracts, build configuration, and other known invariants.

Those checks should establish that the capability works in this application. A missing default sidebar is not a failed authentication contract. Validation must distinguish optional starter features and presentation from the requirements of the capabilities actually retained.

### Ownership inspection

Identify starter files changed downstream, protected implementation modified, extension points used incorrectly, starter code copied into business-owned areas, and business logic placed inside starter-core areas. These findings help locate changes that may need reconciliation.

Also identify intentional replacements and removals. Inspection should explain what they mean for an incoming change, not classify them as errors merely because the current application differs from the baseline.

### Upgrade planning

Make the impact visible before making changes. An illustrative report could look like this:

```text
SAFE TO APPLY
- 18 starter files unchanged downstream
- 7 dependency updates
- 3 new starter files

PRESERVE APPLICATION CHOICES
- navigation replaced: keep the application's navigation
- dashboard removed: do not restore the default shell

REVIEW REQUIRED
- auth/session.ts modified downstream
- localization base file modified

CONFLICT
- library X:
    starter target: 5.1
    business app: 6.0
```

Those labels describe the proposed plan; successful application still needs validation.

### Automated migration

Where a migration is understood, tooling could apply codemods, move files, migrate configuration formats, add required files, update dependency ranges, and rewrite imports.

### Post-upgrade verification

Run unit and integration tests, starter compatibility checks, security checks, type and build checks, dependency checks, and migration verification.

These are proposed capabilities of the starter's tooling, not tools implemented by this article. The architectural point is that inspection and maintenance are part of the starter's long-term offering, not an unrelated problem left to each downstream application.

## 10. Reconcile dependencies instead of merging manifests blindly

Both the starter and the business application may keep dependencies current independently. That makes dependency management one of the harder parts of the long-lived relationship.

Consider this progression:

```text
Starter originally used Library X 3.x

Later:
Starter upgrades Library X → 4.x
Business app independently upgrades Library X → 5.x
```

Copying the new starter's manifest could downgrade the business application. Simply keeping the downstream version could also leave the incoming starter code relying on incompatible APIs. Dependency updates should therefore not be treated as ordinary text-file merges.

For each overlapping dependency, tooling should understand:

- The current downstream version.
- The old and new starter requirements.
- Whether the downstream version satisfies the incoming requirement.
- Whether the starter relies on APIs that changed between versions.
- Whether an incoming version is a security requirement.
- Whether a migration is needed.
- Whether the business application has related plugins or peer dependencies.

An illustrative reconciliation report might propose:

```text
library-x
  downstream: 5.0
  incoming starter: 4.0
  proposed action: KEEP DOWNSTREAM VERSION IF COMPATIBLE
  validation: run starter compatibility suite

auth-library
  downstream: 4.1
  incoming starter: 5.0
  proposed action: UPGRADE
  reason: starter now depends on v5 API
  migration: available

date-library
  downstream: 2.3
  incoming starter: 3.0
  proposed action: MANUAL REVIEW
  reason: downstream contains direct API usage
```

The decision should be based on compatibility and dependency intent, not on automatically preferring either manifest. The application's independent dependency choices are part of its development, not drift to undo. The tool needs to determine which combinations work, where migrations are available, and where a real conflict requires judgment.

## 11. Think in terms of a semantic three-way upgrade

A useful model for future tooling compares three states:

```text
A = old starter baseline
B = current business application
C = new starter version
```

The system asks what changed from **A → B** because of the business application, and what changed from **A → C** because of the starter. It then attempts to produce:

```text
D = upgraded business application
```

The aim is to bring relevant starter improvements into the existing business application while preserving its product decisions. D is not an attempt to make B look more like C.

This resembles a three-way merge, but the opportunity is to make it more semantic than Git by understanding ownership, dependencies, configuration, localization, branding, known migrations, and starter invariants.

For example, B may have removed the dashboard while C improved it. That does not by itself mean D should regain a dashboard. A session fix in C may still be relevant to B. Knowing which capabilities the app retains and which areas it owns is what lets the tool reason about those changes differently.

## 12. Make the repository understandable to upgrade agents

Implementation and maintenance may increasingly be performed by AI coding agents. The starter should therefore provide explicit instructions rather than rely on tribal knowledge.

An agent needs to know what the starter maintains, what the application owns, which shared implementations warrant special care, and which extension points are supported. It also needs to know which features are optional, which invariants apply to the capabilities in use, and how branding, localization, and dependencies are handled.

Most importantly, it must not interpret its upgrade task as restoring the starter's preferred design. A radically different application may be using the starter exactly as intended.

The repository should explain how an upgrade is performed, which tests establish success, and when the agent must stop and ask for review.

Possible instruction and metadata files include:

```text
AGENTS.md
UPGRADE.md
starter-manifest.yaml
```

The filenames are not prescribed. The important thing is that the operating contract is explicit. Conceptually, it could instruct an agent to:

```text
1. Read the starter manifest and current baseline version.
2. Do not modify business-owned directories unless required by a
   documented migration.
3. Preserve the application's UI, workflows, branding, localization
   overrides, and business configuration. Do not restore removed
   starter presentation as part of an upgrade.
4. Compare the incoming starter version against the current baseline.
5. Inspect downstream modifications to starter-core files.
6. Generate an upgrade plan before changing files.
7. Reconcile dependencies semantically; do not blindly replace the
   dependency manifest.
8. Apply supported migrations and codemods.
9. Run compatibility validation for the retained starter capabilities.
10. Run the business application's own validation suite.
11. If a required invariant of a retained capability cannot be preserved
    automatically, stop and surface the conflict explicitly.
12. Produce an upgrade report.
```

These instructions make autonomous or semi-autonomous work less ambiguous. They do not remove the need to decide what agents may do independently and what requires review.

## 13. Make important rules machine-detectable where practical

If an important rule exists only in somebody's head—or only in prose—an automated agent is more likely to miss or violate it.

The starter could eventually provide some combination of:

- A starter version manifest.
- An ownership/path manifest and protected-file list.
- An extension-point registry.
- A feature/capability registry.
- Upgrade migration definitions.
- A compatibility test suite.
- Dependency constraints.
- Deprecation metadata.
- Localization namespaces.
- A branding configuration schema.
- Structured upgrade reports.

This is not an argument for inventing all of those artifacts immediately. It is an argument for making important upgrade rules both documented and machine-detectable where practical, so the architecture is understandable to tooling as well as to people.

Those rules should describe the application's choices as well as the starter's requirements. “This UI was replaced; preserve its replacement” is useful machine-readable knowledge, just as a required session invariant is.

## 14. Let the architecture support a repeatable upgrade process

Once ownership, customization, version identity, and tooling exist, they can support a deliberate downstream upgrade process.

### Phase 1 — Identify state

Determine the current and target starter versions, retained and replaced capabilities, downstream modifications to starter implementation, business-owned areas, dependency state, localization state, and branding configuration.

### Phase 2 — Update upgrade tooling

Obtain the newest compatible upgrade/validation tooling that understands the migration path.

### Phase 3 — Analyze before changing

Produce both a human-readable and a machine-readable plan. Classify changes as automatic, safe but requiring validation, conflicting, or requiring human/agent judgment.

### Phase 4 — Apply starter changes

Apply the improvements appropriate for the capabilities this application uses. Preserve business-owned areas and deliberate UI replacements. An incoming default feature is not automatically a feature the business application should acquire.

### Phase 5 — Reconcile

Reconcile starter-core changes and downstream modifications, dependencies, configuration, branding, localization, UI replacements, and API contracts.

### Phase 6 — Validate

Run integrity checks for retained starter capabilities, the business application's tests, build and type checks, security checks, dependency validation, and localization validation. Verify the resulting business application, not its resemblance to the starter.

### Phase 7 — Produce an upgrade report

Record the previous and resulting starter baseline state, automated and manual changes, resolved conflicts, dependency changes, validation results, preserved application choices, and remaining compatibility exceptions. If only part of a target release was adopted, record that rather than implying the whole target contract was validated.

The report becomes useful context for the next upgrade. The process is an outcome of the architectural design—not a substitute for establishing the boundaries in the first place.

## 15. Explore the design through concrete workstreams

The ideas can be developed through several related workstreams:

| Workstream | What to establish |
| --- | --- |
| **Repository architecture** | Starter-owned areas, business-owned areas, extension points, replaceable UI, and configuration boundaries. |
| **Starter metadata** | Starter identity, version, ownership rules, and protected invariants. |
| **Validation tooling** | A way to detect important compatibility issues. |
| **Upgrade tooling** | A plan-first upgrade mechanism with supported migrations. |
| **Dependency reconciliation** | A comparison and reporting prototype that understands compatibility. |
| **Branding contract** | Centralized, documented customization surfaces. |
| **Localization contract** | Separate ownership and explicit override behavior. |
| **Agent instructions** | Repository-level guidance for development and upgrading. |
| **Agent stress testing** | Intentionally different downstream applications used to refine the architecture. |

Conceptual tooling interfaces might be:

```bash
starter validate
starter upgrade --to <version>
```

These illustrate the intended experience, not commands currently supplied by this repository.

## 16. Start with validation, not an ambitious merge engine

A reasonable sequence of exploration is:

1. **Map the current starter.** Identify reusable platform primitives versus default application and UI choices.
2. **Define ownership boundaries.** Decide what remains starter-owned and where business code belongs.
3. **Create the first manifest.** Encode baseline version and ownership information.
4. **Build validation before upgrade tooling.** First prove that retained capabilities can be checked independently of the default product design.
5. **Run agent stress-test projects.** Ask for genuinely different products and observe where the starter supports them or gets in the way.
6. **Refine the extension and replacement points.** Improve the architecture rather than narrowing the products it permits.
7. **Design branding and localization ownership.** Make normal customization explicit.
8. **Prototype dependency reconciliation.** Establish how compatibility decisions will be made.
9. **Build a plan-first upgrade tool.** Automate changes on top of an inspectable plan.
10. **Create upgrade-agent instructions and structured reports.** Make the procedure and its results transferable.

This sequence allows the starter's supported model to emerge from real downstream use rather than assuming the right separation can be designed perfectly in advance.

## 17. Keep the open architectural questions explicit

Several decisions remain unresolved. They are questions to explore, not blockers to starting.

### Architecture

Should starter-core functionality live under a dedicated directory? Should the business application have its own top-level application directory? Which existing files cannot realistically be separated? Should applications inherit components, copy them, or wrap them?

### Upgrade mechanism

Should distribution use Git history, a package, a template release, an artifact, or a combination? What is the canonical source of a starter version? How are migrations versioned? Can upgrades skip multiple starter versions?

### Ownership

Are protected files immutable, or do they simply represent high upgrade cost? How should application-owned replacements be recorded separately from modifications that actually change shared capability contracts?

### Dependencies

Which dependencies belong to starter infrastructure and which are entirely downstream-owned? How should framework versions and peer dependencies be handled?

### Localization

Should the application use separate namespaces? Which starter strings may be overridden? Can overrides survive key renames automatically?

### Branding

Can normal branding be expressed through configuration and assets? Which branding changes currently require implementation changes?

### AI agents

What may an agent change autonomously? Which conflicts require review? What validation is sufficient for it to declare an upgrade successful?

## 18. From a one-time template to a lasting foundation

The design succeeds when a business application can become a very different product and still find the starter useful:

> Our application no longer looks or works like the starter's default product. We know which starter capabilities we still use, which areas we own, and which implementation changes need special treatment. When a new release arrives, we can identify relevant improvements, reconcile dependencies, run migrations, and validate the result without undoing our product decisions.

That is an **upgradeable application foundation**, not a template the application must keep resembling.

Clear ownership, versioned contracts, machine-readable metadata, validation tooling, semantic dependency reconciliation, supported customization, and plan-first upgrades all serve that purpose. Agent experiments help discover whether the architecture actually makes it possible.

**The downstream application is free to become its own product. The starter should be designed to remain useful when it does.**
