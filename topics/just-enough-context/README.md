---
category: Agentic software development
cover: assets/cover.svg
description: >-
  A context-efficient architecture for agentic software development: focused agent
  context, searchable project knowledge, and small, timely human decisions.
thesis: >-
  Give specialist agents the context they need and humans focused decisions that
  can inform future work.
---

# Just Enough Context (JEC)

## Introduction

Delegating software development to agents requires more than the ability to generate code. A specialist needs to understand the assignment, discover the constraints that matter, and recognize when a decision belongs to a human. If every task begins with a repository-wide briefing and ends with a transcript to review, delegation can leave both the agent and its supervisor sorting through more information than the work requires.

The alternative is not to withhold context. It is to make relevant knowledge available as questions arise, and to ask for human attention in a form that makes the decision clear. **Just Enough Context** connects these two sides of delegation: enough understanding for the agent to proceed responsibly, and focused opportunities for the human to contribute judgment.

> **Vision:** A development system in which expert agents know how to find what they need, orchestrators coordinate without overloading them, and humans contribute judgment through small, timely decisions instead of reading walls of text—decisions that can inform future work when appropriate.

## TL;DR

**Just Enough Context (JEC)** is a proposed approach to agentic software development that treats context as something to deliberately assemble, retrieve, and refine—not as a large, static prompt delivered to every agent.

The architecture has three complementary pillars:

1. **Just Enough Context (JEC):** Specialized sub-agents work with focused, task-relevant context. Additional information is supplied dynamically, either by an orchestrator or through agent-driven discovery.
2. **Project Context Intelligence:** A searchable knowledge layer helps answer questions about code, past decisions, prior bugs, pull requests, issues, team conventions, and related project history. It may be maintained continuously, initialized explicitly, or built on demand.
3. **Just Enough Attention (JEA):** Humans participate through concise, decision-oriented cards rather than long reports. The informal nickname is **“Tinder for decisions.”**

The overarching goal is to reduce irrelevant context for AI agents and unnecessary cognitive load for humans, while retaining access to the details each actually needs. The design assumes **capable specialist agents that can exercise judgment** rather than needing every step of their information gathering prescribed. When a human makes a reusable decision, that knowledge should also be available to future agents.

## The problem

Agentic software-development systems can overwhelm both sides of a workflow:

- **Agents** receive too much general-purpose background material, even when their assigned task is narrow. This increases context-window use and makes relevant information harder to isolate.
- **Projects** contain important knowledge scattered across code, version history, pull requests, issue trackers, task systems, and written or informal design discussions.
- **Humans** are asked to read lengthy agent outputs, monitor complicated execution traces, or respond to broad questions requiring significant attention.

JEC proposes that context and attention should both be supplied **incrementally and purposefully**.

## Just Enough Context

### Core principle

A sub-agent should start with **the smallest useful orientation for its particular assignment**, not every piece of information the broader project contains.

A task-specific brief might include:

- The task's objective and expected outcome.
- The relevant subsystem or suspected code area.
- Constraints and acceptance criteria.
- Essential project conventions.
- Pointers or access paths to additional information.

This is a *starting point*, not an artificial ceiling. If the task requires more context, the agent must be able to acquire it.

**Knowing when enough is enough is part of the specialist's job.** A capable agent should judge which gaps matter and when it has sufficient understanding to proceed. The orchestrator can supply high-level guidance, constraints, or a token budget, but JEC is not intended to micromanage the agent's research process. The aim is useful context, not minimum context at any cost.

### Version A: Orchestrator-assembled context

In the initial model, an **orchestrator (or coordinator)** prepares the context before launching each specialized sub-agent.

**Sequence:**

1. The orchestrator receives or decomposes a software-development task.
2. It identifies a suitable sub-agent and that agent's responsibilities.
3. It gathers the most relevant context for that assignment.
4. It starts the sub-agent with the curated package.
5. If the sub-agent encounters an information gap, it requests additional context from the orchestrator.
6. The orchestrator retrieves and supplies the missing information; work continues.

**Key characteristic:** The orchestrator owns initial context selection and mediates subsequent requests.

### Version B: Sub-agent-assembled context

The more advanced model delegates more control to the specialist sub-agent.

The sub-agent still receives an initial orientation, but **it decides what information its work requires** and can find that information directly through authorized project knowledge sources.

This is analogous to **bringing in an expert contractor**. The contractor receives a briefing but, as the domain specialist, knows which drawings, records, standards, people, and prior decisions to consult. Expertise includes the ability to recognize missing information and request or retrieve it. The same applies to *how* the information is found: the specialist should choose among the retrieval methods and tools available to it rather than follow a centrally prescribed search strategy.

**Sequence:**

1. The orchestrator defines the task, boundaries, and authorized access.
2. The specialist sub-agent evaluates what it needs to know.
3. The sub-agent retrieves or assembles its own context from available sources.
4. It works on the assignment, gathering more information as new questions arise.
5. It escalates unresolved questions, permissions, or human decisions when appropriate.

**Key characteristic:** The sub-agent is responsible for context discovery and refinement within its authorized scope.

### How the versions relate

| Dimension | Version A: Orchestrator-led | Version B: Agent-led |
|---|---|---|
| Initial context | Curated centrally | Minimal orientation plus discovery capability |
| Who chooses additional information? | Sub-agent requests; orchestrator retrieves | Sub-agent identifies and retrieves directly |
| Orchestrator's main job | Coordination **and** context assembly | Coordination, task boundaries, access, oversight |
| Primary advantage | Centralized control and predictability | Greater specialist autonomy and adaptability |
| Main design challenge | Orchestrator could become a bottleneck | Discovery quality, access control, and context discipline |

These versions are not necessarily mutually exclusive: an eventual system could combine curated startup context with agent-directed follow-up retrieval.

The degree of independence is determined by ordinary agent design—its instructions, authorization, and available tools (including MCP-accessible tools where appropriate). JEC does not require a separate autonomy-control mechanism.

## Project Context Intelligence

### A knowledge source that can answer project questions

Both JEC versions depend on an accessible source of **task-relevant project knowledge**. The proposed starting point is a retrieval-augmented generation (**RAG**) system, potentially backed by a **vector database**.

Rather than handing every agent a massive repository-wide briefing, the system should respond to specific questions at the point of need. In the agent-led version, the specialist chooses what to ask and which available method is best suited to answer it.

### Representative questions an agent should be able to ask

**Prior incidents and fixes**

- Have we encountered similar bugs before?
- What did earlier fixes change, and why?

**Code and implementation history**

- What is the development history of the code related to this bug?
- Which pull requests modified the relevant component?

**Standards and conventions**

- What coding conventions and engineering standards does this company or team follow?
- Are there architectural practices specific to this subsystem?

**Prior discussions and decisions**

- Has this concept, tradeoff, or implementation strategy been discussed previously?
- Were relevant decisions recorded in issues, PR conversations, or design documents?

The ambition is broader than simply finding documents: the knowledge layer should **assemble relevant, useful answers**, with links to underlying evidence when possible. If sources conflict or seem outdated, the agent can investigate and reconcile them, or ask the orchestrator for clarification when it cannot resolve the uncertainty itself.

### Potential source material

The knowledge layer could mine and connect:

- Source code and repository structure.
- Git commit history and code changes.
- Pull requests, review comments, and associated discussions.
- Issues, bug reports, task tickets, and project-management records.
- Team conventions, engineering standards, and documentation.
- Architecture or design discussions and decision records, when accessible.

The exact set depends on what a project actually uses and permits access to.

### Two operational modes

**Mode 1 — Continuously maintained knowledge base**

A project already has a retrieval system that regularly ingests and indexes relevant artifacts. When an agent arrives, project knowledge is ready to query.

**Mode 2 — Knowledge-base initialization**

A project has no suitable knowledge base yet. A supporting mechanism—possibly invoked by the orchestrator or sub-agent, or run as a separate setup step—mines available repositories, pull requests, issues, and other sources and constructs a searchable index.

**Instant, automated cold starts are not a requirement of JEC.** A project may need manual or explicit initialization before agents use it. How quickly a knowledge base can be prepared is a later implementation and optimization question; the conceptual requirement is that usable project knowledge be available when the agent needs it.

### Technical considerations to explore

The vector database is a useful starting hypothesis, not a commitment to a single storage technology. A practical implementation may combine semantic retrieval with keyword search, structured metadata, source-code navigation, and relationship-aware retrieval.

Important questions include freshness of indexed information, source provenance, permission boundaries, answer quality, deduplication, indexing cost, and how to distinguish authoritative decisions from historical discussion. Agents should have sufficiently current information to work responsibly, but the specific updating and verification mechanisms are implementation choices, not settled parts of this proposal.

## Just Enough Attention (JEA)

*“Tinder for decisions”*

### The human-in-the-loop problem

A human may be responsible for reviewing findings, confirming assumptions, supplying missing information, making design decisions, and approving results. But expecting the human to read long, dense agent transcripts is unreliable and attention-intensive.

**Just Enough Attention (JEA)** proposes a different interaction model: present **one meaningful item at a time** as a short, highly readable card.

The format draws on **flashcards** and the familiar **swipe interaction** used by dating apps. Its purpose is not entertainment; it is to make decision-making manageable.

### A simple card interaction

Each card should capture a discrete issue, finding, assumption, or question and give the human a fast path forward.

Possible actions:

- **Agree / accept** — the proposal or finding is satisfactory.
- **Disagree / reject** — the agent should reconsider or change course.
- **Clarify / discuss** — the human needs to add context or resolve ambiguity.

The precise gestures or buttons are a UI design choice. The core idea is **low-friction, atomic decisions**, not swiping for its own sake.

### When cards appear

Cards could be used throughout the lifecycle:

1. **Initial knowledge capture:** Collect or validate project context without lengthy questionnaires.
2. **During execution:** Ask targeted questions when an agent discovers missing information, ambiguity, or a consequential tradeoff.
3. **Preliminary review:** Show findings or emerging recommendations requiring human judgment.
4. **Final review:** Break completion reports or approval decisions into digestible items.

JEA may also be useful **outside software development** as a general human–AI interaction pattern.

### Decisions create reusable knowledge

A human answer should not disappear into an agent's transient conversation if it establishes something that future work may need. **When appropriate, accepted, rejected, or clarified card decisions should feed back into project knowledge.**

A useful conceptual attribute of a card is its **scope**—what kind of decision is being made and where it belongs:

| Scope | Where the decision belongs |
|---|---|
| **Project** | A reusable convention, standard, or decision that may inform future tasks |
| **Issue / task** | A decision relevant to the current bug, feature, or assignment |
| **Internal / transient** | A local direction for the current agent or run, not necessarily lasting project knowledge |

The scope helps the system distinguish decisions worth retaining and retrieving later from temporary steering. This closes a useful loop: **human judgments can become context for the next specialist agent**.

### Ask only when a human can change the outcome

JEA is not a request for human approval at every step. A capable agent should resolve ordinary questions itself, consult project knowledge, or ask the orchestrator when appropriate. The orchestrator can offer simple guidance such as: **“Ask the human only when the answer could materially change the outcome.”** The agent applies that guidance using its own judgment.

### Avoiding card overload

The design should account for the fact that **too many cards can become another wall of text**.

Potential design principles to investigate:

- Surface only decisions that genuinely benefit from human participation.
- Keep one clear issue per card, with optional details available on demand.
- Prioritize urgent or blocking items.
- Group or defer lower-value items when possible.
- Avoid asking the same question when an existing decision already answers it.

These are possible implementation principles rather than fixed requirements. At the interface boundary, the mechanism that presents cards should accept or validate a consistent, usable **card format**; the details of scheduling, batching, or swipe mechanics can be decided later.

## Putting the three pillars together

The workflow is **a cycle, not a choice between gathering information and asking the human**. The agent starts by gathering enough context to begin. This may involve project knowledge, an orchestrator, or focused human input. Then it works. Whenever the work exposes a new information gap, it returns to context gathering and continues from there.

```text
Human / Project request
          |
          v
   Orchestrator
 (scope and delegate)
          |
          v
   Specialist sub-agent
          |
          v
   +----------------------------------+ <------------------+
   | Gather / refine context          |                    |
   |  - Project knowledge             |                    |
   |  - Orchestrator, if brokering    |                    |
   |  - Human JEA card, if needed     |                    |
   +----------------------------------+                    |
          |                                                |
          v                                                |
       Do the work                                         |
          |                                                |
          +---- More information needed? ---- Yes ---------+
          |
          No
          |
          v
  Implementation / findings
          |
          v
  Focused human review (JEA where useful)
          |
          v
  Retain appropriately scoped decisions
  as knowledge for future work
```

The return to context gathering can happen repeatedly, not only at the beginning. Human decisions made during context gathering or review can also become project or task knowledge, depending on their scope.

### Example: A bug-fixing assignment

1. An orchestrator assigns a bug to a debugging sub-agent.
2. The sub-agent receives a short brief describing the symptom, relevant constraints, and likely code area.
3. It asks the knowledge layer whether similar bugs have been reported and which PRs previously changed the affected code.
4. It discovers a past discussion involving two possible fixes. If the choice could materially change the result and needs a human decision, the system presents a concise JEA card.
5. The human accepts, rejects, or clarifies the recommendation. The sub-agent has enough context to start work.
6. During implementation, the agent discovers another relevant dependency it did not anticipate. It returns to the knowledge layer for more information, then resumes its work.
7. When finished, it presents a focused review rather than an unfiltered agent log.
8. Any human decision that establishes reusable project or issue knowledge is retained with the appropriate scope.

This is an illustrative flow, not a tested implementation. The important behavior is that **context gathering and execution can alternate as many times as the work requires**.

## Architectural responsibilities

| Component | Proposed responsibility |
|---|---|
| **Orchestrator** | Interpret and decompose tasks; delegate work; set constraints; optionally prepare or broker context |
| **Specialist sub-agent** | Execute the assigned work; identify gaps; request or independently retrieve context |
| **Context retrieval service** | Answer questions against project artifacts and return pertinent evidence |
| **Knowledge ingestion/indexing mechanism** | Prepare or maintain a project knowledge base, including through explicit initialization |
| **Human decision interface (JEA)** | Convert consequential questions or findings into valid, actionable cards; capture responses and their scope |
| **Human reviewer / expert** | Contribute missing knowledge, resolve tradeoffs, and approve or redirect work |
| **Decision feedback** | Make human decisions available as project or issue knowledge when appropriate |

## Assessing whether the approach works

The primary question is whether **the overall agentic development workflow** produces better results with less wasted context and less unnecessary human attention—not whether one retrieval algorithm is especially precise.

Useful end-to-end evaluation dimensions include:

- **Task success and quality:** Does the system complete the assignment correctly and produce useful, maintainable results?
- **Token efficiency:** How much context and generation effort does it spend to achieve that result?
- **Latency:** How long does the work take, including retrieval and any necessary human input?
- **Human effort:** How much reading, interruption, and decision-making is required of the human?

These measures should be considered together: token savings are not a success if the work gets worse, and fewer interruptions are not a success if critical human decisions are missed. **Retrieval precision** can be an informative metric for the knowledge subsystem, but it is not a system-level success criterion for JEC itself.

The approach leaves room for different implementations. Tool selection and permissions are part of normal agent design; agents decide what information they need and how to seek it. Knowledge-base initialization, refresh, retrieval internals, and card presentation mechanics are implementation and optimization matters. Those details matter when building the system, but they are not necessary to articulate the concept.

## Possible phased exploration

**Phase 1 — Orchestrator-mediated JEC:** Start with task-specific agent briefs and explicit requests for missing context.

**Phase 2 — Project knowledge layer:** Make prior code changes, issues, conventions, and discussions searchable, using an existing knowledge base or an explicit initialization step.

**Phase 3 — Agent-led context assembly:** Permit specialist agents to decide which context they need and retrieve it within clear boundaries.

**Phase 4 — Just Enough Attention:** Prototype decision cards for clarification, tradeoff selection, and review; capture appropriately scoped decisions as reusable knowledge and refine the amount of interruption.

These phases are a suggested roadmap for testing the ideas, not a prescribed implementation sequence.
