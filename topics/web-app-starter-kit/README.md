# An upgradeable web app starter kit

A starter kit should be more than a fast first commit. It should give a business application a foundation that can keep improving after the application becomes something of its own.

That is the difficult part. Authentication, account flows, security controls, dependencies, and infrastructure continue to evolve in the starter. Meanwhile, the application acquires business logic, a distinct interface, its own dependencies, branding, and translations. A year later, copying the starter's latest files is no longer an upgrade strategy.

The idea is to design that long-lived relationship **before the clone**: clear ownership, a versioned contract, supported customization, and a plan-first upgrade process that humans and AI agents can both understand.

**Status:** This topic describes a proposed architecture and an exploration plan, not a released upgrade system. Paths, manifests, version numbers, reports, and commands are illustrative. The accompanying working design brief (`web_app_starter_upgrade_notes.md`), included in full in the interactive edition, preserves the detailed source notes, examples, workstreams, and open questions.

## 1. The clone is the beginning, not the end

A starter often contains two things that look inseparable at first:

- **Platform capabilities:** authentication, sessions, database infrastructure, registration, waitlists, security controls, shared APIs, utilities, and build/deployment conventions.
- **A sample product:** a sidebar, navigation, dashboard, page composition, menus, and a default workflow.

The sample product makes the starter immediately useful. But it must not become a condition of receiving future platform improvements.

A downstream application might become a conventional SaaS dashboard, a mobile-first tool, a full-screen workflow, or a game-like authenticated experience. All of them may still need secure sessions. None should have to retain the starter's sidebar to get a session fix.

The desired outcome is therefore not “make every application look like the starter.” It is **preserve the ability to adopt useful starter changes while allowing the application to become a different product**.

## 2. Establish ownership before customization

<!-- excerpt:ownership -->
Separate starter-owned capabilities from business-owned code before the first application is created. Provide explicit extension points, configuration, and replaceable UI rather than forcing ordinary product work into core implementation files.

The boundary is not a ban on change. It makes the future upgrade cost of a change visible, so teams and agents can distinguish supported customization from deliberate divergence.
<!-- /excerpt:ownership -->

An initial ownership model could use six categories:

| Category | Intended treatment during an upgrade |
| --- | --- |
| Starter core | Compare against the recorded baseline; inspect every downstream modification before applying incoming changes. |
| Extension point | Preserve the application's implementation; validate it against the target interface. |
| Business-owned | Preserve it. Any migration that needs to change it must be explicit and reviewed. |
| Generated | Change the authoritative inputs and regenerate with compatible tooling. |
| Configuration | Preserve application values and migrate their schema when necessary. |
| Replaceable UI | Allow replacement or removal; do not silently reinstall the default interface. |

One possible layout is:

```text
application/
├── platform/          # starter capabilities and contracts
├── business/          # product logic and workflows
├── extensions/        # app implementations of supported interfaces
├── configuration/    # app values against documented schemas
├── branding/          # app-owned identity and assets
├── locales/           # separate defaults, business strings, overrides
└── tooling/           # inspection, validation, and migrations
```

The names are not the architecture. The architecture is the ownership and interface contract behind them. Moving a file into `platform/` does not make it independently upgradeable if business code still depends on its internals.

Document those rules for people and encode them in machine-readable metadata where practical. An agent should not have to infer ownership from a path name or reconstruct it from Git history. Unknown or overlapping ownership rules should produce a review item, not permission to overwrite a file.

### Divergence is a supported decision

“Protected” should identify important invariants or expensive changes, not turn the whole starter into an untouchable framework.

Replacing navigation, removing the dashboard shell, or supplying business-specific email templates may be perfectly reasonable. Record the divergence, why it exists, which capability it affects, and how it is validated. Otherwise the next upgrade may mistake an intentional removal for a missing file and bring it back.

If agents repeatedly need exceptions for ordinary application work, improve the extension model instead of merely adding more prohibitions.

## 3. Give the application a versioned baseline

<!-- excerpt:baseline -->
A downstream application needs an explicit starter identity and baseline version that survive cloning. “Based on contract version X, with these recorded exceptions” is a more useful starting point than “forked from some old commit.”

The baseline identifies the old starter state; it does not prove compatibility by itself. Validation and a record of intentional divergences explain what the application actually preserves.
<!-- /excerpt:baseline -->

A conceptual record might look like this:

```yaml
starter:
  id: company-webapp-starter
  baseline_version: 3.2.1

exceptions:
  - capability: default-navigation
    decision: replaced
    reason: The product uses a full-screen workflow.
```

A practical implementation also needs an unambiguous way to retrieve that exact baseline: for example, a release artifact or commit identifier. The distribution mechanism remains an open choice; a package, template release, Git history, or a combination may be appropriate.

Do not advance the baseline merely because some files were copied successfully. Advance it after the target contract has been validated and the upgrade report records the result. If a selective upgrade leaves required target changes unapplied, record the partial state rather than claiming complete compatibility.

### The semantic three-way comparison

Use three known states to reason about an upgrade:

```text
A = old starter baseline
B = current business application
C = target starter release

A → B reveals downstream customization.
A → C reveals incoming starter changes.

D = the upgraded business application,
    preserving business intent and the validated target contract.
```

Git can help compare and merge text. The additional value comes from understanding **ownership, dependency requirements, configuration, branding, localization, migrations, and invariants**.

A clean text merge is not evidence that a session contract still works. A text conflict is not necessarily a design conflict if one side is a deliberately replaced UI.

## 4. Make customization an interface

Branding and localization are not incidental edits. They are predictable sources of downstream change and should have deliberate homes.

### Branding belongs to the application

A branding contract should cover more than colors and a logo:

- Product and company names, logos, favicon, and app icons.
- Theme tokens, typography, images, and illustrations.
- Browser titles, metadata, and social previews.
- Email identity and templates.
- Default copy, legal/footer content, and login/sign-up presentation.

The useful question is: **Where can a team or agent express the business identity without editing starter-core implementation?**

Central configuration, theme tokens, assets, and documented overrides are possible answers. The exact mechanism should fit the stack. The upgrade rule is stable: incoming starter defaults must not erase app-owned identity. Schema changes may require migrations, but the application's values still belong to it.

### Localization needs separate ownership

Keep starter-provided strings separate from business-specific strings. If the application can override a starter string, make that override explicit rather than editing the default in place.

```text
locales/
├── starter/       # versioned starter defaults
├── business/      # business-domain strings
└── overrides/     # app-owned overrides of supported starter keys
```

The chosen localization framework determines the exact lookup and fallback behavior. Within that behavior, a supported override takes precedence over its starter default; business strings should have their own namespace rather than compete accidentally for the same keys.

An upgrade should report added, removed, renamed, and deprecated starter keys; missing or stale translations; duplicate keys and namespace collisions; and overrides whose targets no longer exist. Automatically renaming an override is appropriate only when a documented migration establishes the mapping. Translation meaning still deserves review when the underlying flow changes.

### Replaceable UI is different from broken infrastructure

An application with no sidebar is not necessarily incompatible. An application that accidentally removed required authentication middleware may be.

Describe which capabilities are optional and which invariants remain required when a capability is enabled. Validate those invariants independently of the starter's default page composition wherever possible.

## 5. Reconcile dependencies by compatibility, not recency

<!-- excerpt:dependencies -->
The application and the starter may update the same dependency independently. Replacing the application's dependency manifest with the starter's can undo downstream work; always keeping the newer version can also break the starter's assumptions.

Compare the old baseline, the application's actual dependency state, and the target starter's requirements. Choose a version only with evidence about API compatibility, security requirements, peer dependencies, and the application's own usage.
<!-- /excerpt:dependencies -->

For example, the baseline used Library X 3.x, the starter moved to 4.x, and the business application already moved to 5.x. Neither “take incoming” nor “take the highest version” answers whether the target starter code works with 5.x.

For each overlapping dependency, inspect:

1. The old starter requirement, the downstream requirement and resolved version, and the incoming starter requirement.
2. The APIs used by both starter code and business code.
3. Related plugins, peer constraints, and framework compatibility.
4. Any security minimums, known incompatibilities, and supported migration path.
5. The validation that would justify keeping, upgrading, or otherwise changing it.

An illustrative plan might say:

| Dependency | Proposed action | Required evidence |
| --- | --- | --- |
| Library X: downstream 5.x, target starter 4.x | Keep 5.x only if supported; otherwise review | Target starter compatibility tests plus app usage checks. |
| Auth library: downstream 4.x, target starter 5.x | Apply the documented v5 migration | Session and sign-in integration tests, configuration checks, and business-flow tests. |
| Date library: downstream 2.x, target starter 3.x | Review direct business API usage | Migration coverage and tests for affected date behavior. |

The version numbers are examples, not recommendations for particular libraries. Resolve the selected dependency graph with the package manager and validate the resulting lockfile state; do not treat a hand-merged manifest as a completed dependency upgrade.

## 6. Build validation before automated upgrading

Before building a tool that changes an application, build one that can explain whether the important starter contracts still hold.

Useful checks include authentication and session behavior, required configuration, security headers and middleware, database assumptions, API contracts, build configuration, and other documented invariants. Ownership inspection should identify modified core files, misplaced business logic, misuse of extension points, and potential copies of core code that will not receive future fixes. Some of that inspection will need heuristics or human review; not every architectural rule is mechanically provable.

The starter suite and the business suite answer different questions:

- **Starter compatibility:** Does the shared foundation still satisfy the intended contract?
- **Business regression:** Does this particular product still behave correctly?

Both matter. Neither a passing build nor an agent's confidence replaces them.

### Upgrade the upgrade tooling first

After identifying the current and target baseline, obtain upgrade/validation tooling that explicitly supports that migration path **before modifying the application**.

“Latest compatible” is important. The newest tool may not understand a very old baseline or run in its environment. Pin the selected tool version, use a trusted source, and establish its compatibility before executing migrations. If the path requires intermediate releases, the plan should say so rather than silently skipping them.

Potential tooling responsibilities include ownership inspection, readable and structured planning, known migrations and codemods, file moves, import rewrites, configuration changes, dependency reconciliation, and post-upgrade verification. These are proposed responsibilities, not commands supplied by this topic.

## 7. Use a plan-first upgrade workflow

<!-- excerpt:workflow -->
Identify the current application state, update compatible upgrade tooling, and produce a plan before changing files. Apply approved changes, reconcile the application-specific differences, then run both starter and business validation.

Finish with an upgrade report that records what changed, what passed, and what remains exceptional. Unresolved conflicts are an outcome to surface, not something to hide behind a new baseline number.
<!-- /excerpt:workflow -->

The proposed process has seven phases:

| Phase | Work | Output or decision |
| --- | --- | --- |
| 1. Identify state | Read baseline, ownership, divergences, dependencies, localization, and branding. Inspect downstream changes. | A reproducible starting state and target. |
| 2. Update tooling | Select trusted tooling that supports both ends of the migration. | A pinned tool version and supported migration path. |
| 3. Analyze | Compare baseline → app and baseline → target; classify proposed changes. | Human-readable and machine-readable plan before edits. |
| 4. Apply | Apply approved starter updates and supported migrations. | Reviewable changes without blind replacement of business files. |
| 5. Reconcile | Resolve core customizations, dependencies, configuration, branding, translations, UI replacements, and API contracts. | Explicit decisions, with unresolved items escalated. |
| 6. Validate | Run unit/integration tests, starter integrity, business tests, type/build checks, security/dependency checks, localization, and migration verification. | Evidence for the resulting application state. |
| 7. Report | Record old/new baseline, automated/manual changes, conflicts, dependency decisions, validation, and exceptions. | An inspectable record for review and the next upgrade. |

A plan should distinguish **automatic**, **safe but requiring validation**, **conflict**, and **judgment required**. Even an unchanged starter-owned file is not automatically safe in every context: its new behavior may require a migration elsewhere.

Use an isolated branch or worktree with a recorded starting commit, and inspect existing uncommitted work before applying a plan. Keep the upgrade reviewable and reversible in source control. Database or external-state migrations need their own backup, recovery, and deployment plan; reverting a commit does not undo them.

## 8. Give the agent an explicit operating contract

An AI agent should not be asked simply to “merge the latest starter.” Give it the ownership model, supported capabilities, baseline identity, migration instructions, validation commands, and stop conditions.

Repository instructions might live in `AGENTS.md`, an upgrade guide, and a machine-readable manifest. The exact filenames matter less than making the rules discoverable and consistent.

A useful conceptual contract is:

```text
1. Read the manifest, current baseline, target release, and recorded exceptions.
2. Inspect downstream modifications before editing starter-owned code.
3. Preserve business-owned code, branding, overrides, and configuration.
   Any required change there must be part of an explicit migration plan.
4. Produce a plan before applying changes.
5. Reconcile dependencies semantically; do not replace the manifest wholesale.
6. Apply supported migrations and codemods within the approved scope.
7. Run starter compatibility checks and the business application's checks.
8. Stop when a required invariant cannot be preserved or verified.
9. Report changes, decisions, validation evidence, and unresolved exceptions.
```

Define which changes the agent may apply autonomously and which require review. Missing baseline data, ambiguous ownership, unsupported dependency combinations, destructive migrations, and unverified security-sensitive behavior are reasons to surface a decision rather than improvise authority.

Permission to edit code is not automatically permission to migrate production data or deploy. Those boundaries should be explicit too.

The objective is not to eliminate judgment. It is to make clear **where judgment is needed, who may exercise it, and what evidence must remain afterward**.

## 9. Use AI agents to stress-test the architecture

<!-- excerpt:stress-test -->
Give multiple agents the starter and ask them to build intentionally different applications: a dashboard, a mobile-first product, a radically different layout, a game-like experience, a workflow-heavy enterprise app, and products with extensive branding or localization.

The applications are experiments. Observe which starter files the agents edit, replace, bypass, or struggle with, then use that evidence to refine the ownership boundaries and extension points.
<!-- /excerpt:stress-test -->

For each experiment, record the task, starter baseline, instructions, modifications, friction, and validation results. Ask:

- Which primitives remained useful across different products?
- Where did business code naturally accumulate?
- Which supposedly reusable files had to be replaced?
- Which starter assumptions forced changes to core code?
- Which changes would make a future upgrade difficult?
- Would a better extension point have avoided that difficulty?

Then rehearse an actual starter update against the experimental applications. A successful first build tests usability; a successful later upgrade tests the relationship this architecture is supposed to support.

Treat repeated boundary violations as evidence to investigate, not automatic proof of agent failure. An instruction cannot compensate for an extension point that does not exist.

## 10. Explore in small, testable workstreams

Start by mapping the existing starter rather than designing a large abstract upgrade framework in isolation.

1. **Repository architecture:** separate reusable capabilities from default UI; define ownership, configuration, and extension boundaries.
2. **Metadata:** record starter identity, baseline, ownership, and protected invariants.
3. **Validation:** prove that important contracts can be checked before automating changes.
4. **Agent experiments:** create varied downstream apps and refine the extension model from observed friction.
5. **Customization:** formalize branding, localization, and intentional replacement.
6. **Dependency reconciliation:** prototype a three-way dependency report and compatibility decisions.
7. **Upgrade tooling:** introduce plan-first upgrades, then supported migrations and codemods.
8. **Agent guidance and reports:** make scope, review decisions, validation evidence, and upgrade history durable.

Conceptual interfaces such as `starter validate` and `starter upgrade --to <version>` describe the intended experience. They are not implemented or installable commands in this repository.

Machine-readable contracts can grow alongside demonstrated needs: an ownership manifest, extension and capability registries, compatibility tests, dependency constraints, migration definitions, deprecation metadata, branding schemas, localization namespaces, and structured reports. Start with the smallest set that enables a real validation or upgrade decision.

## 11. Keep the unresolved choices visible

There is no single implementation prescribed here. Important choices remain:

- **Architecture:** dedicated core directories, packages, copied components, wrappers, inheritance, or some combination? Which files cannot realistically be separated?
- **Distribution:** Git, packages, template artifacts, or a hybrid? What is the canonical, reproducible source of each baseline?
- **Migration paths:** how are migrations versioned, and which skipped-version upgrades are supported?
- **Ownership:** which protections are hard invariants, which indicate high upgrade cost, and how are exceptions recorded?
- **Dependencies:** which are platform-owned, which are business-owned, and how are peer/framework constraints represented?
- **Localization:** which keys are overridable, what are the fallback rules, and when can a rename be migrated automatically?
- **Branding:** can ordinary changes be expressed without implementation edits, and where are new extension points needed?
- **Agent authority:** what may be automatic, what needs review, and what validation is sufficient to declare success?

The working brief develops these questions further. They are an exploration agenda, not evidence that an implementation already exists.

## 12. What success looks like

A downstream team should be able to say:

> We are based on starter contract X. We own these areas and intentionally diverged in these places. For target Y, we can inspect a plan, preserve our product, reconcile dependencies, run supported migrations, validate the shared foundation and our business behavior, and see exactly where review is still needed.

That is the transition from a disposable template to an **upgradeable application foundation**.

The guiding principle is simple: **design the starter, the business application, and the upgrade process as a long-lived relationship rather than a one-time clone.** AI agents make explicit boundaries and verifiable contracts more valuable, not less necessary.
