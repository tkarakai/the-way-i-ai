# A Framework for Defining AI Agent Roles in an Agentic Organization

## Introduction

Assigning human-style professional titles to AI agents—such as **software engineer**, **quality assurance engineer**, **product manager**, **security specialist**, **marketing analyst**, or **operations lead**—can be useful, but only if the meaning of a "role" is defined carefully.

The purpose of a role is not to pretend that an AI agent is literally a human professional. The useful abstraction is that a role gives a generally capable AI system a **professional operating context**.

That operating context has three major parts:

1. **A generic professional lens**  
   The body of industry knowledge, methods, terminology, assumptions, and professional conventions associated with a discipline.

2. **A local agentic environment**  
   The proprietary systems, knowledge, tools, retrieval mechanisms, memory, permissions, project context, and specialized capabilities made available to that agent.

3. **A discoverable agent profile**  
   A structured description of the role, capabilities, access, experience, and limits that allows other agents or orchestration systems to understand when and how to collaborate with it.

Together, these define what an agent is expected to **think like, know about, have access to, be able to do, communicate, document, and hand off**.

A concise expression of the framework is:

> **Agent Role = Generic Professional Lens + Local Agentic Environment + Discoverable Capability Profile**

This document develops that idea in detail.

---

# 1. A Role Is a Working Context, Not a Costume

A role should not be understood as a theatrical persona.

Giving an AI agent the title "software engineer" should not mean instructing it to imitate a stereotypical engineer or pretend to have a human biography. Instead, the title should establish a **default professional frame** for how the agent approaches work.

The role should influence:

- what information the agent pays attention to;
- what assumptions it considers normal;
- what risks it notices;
- what questions it asks;
- what terminology it uses;
- what standards it applies;
- how it evaluates alternatives;
- what artifacts it creates;
- how it defines completion;
- what kinds of uncertainty it surfaces;
- when it recognizes that another role may be more appropriate.

The professional title is therefore shorthand for a much richer set of operating assumptions.

For example, a software quality assurance agent may naturally frame problems in terms of:

- reproducibility;
- expected versus actual behavior;
- test coverage;
- regression risk;
- edge cases;
- release criteria;
- severity;
- evidence;
- validation;
- traceability.

A software engineering agent may naturally frame problems in terms of:

- architecture;
- interfaces;
- dependencies;
- maintainability;
- performance;
- failure modes;
- observability;
- security;
- deployment;
- technical debt.

The role is not merely a communication style. It is an **operating model**.

---

# 2. The First Layer: Generic Professional Knowledge

Every sufficiently capable AI system begins with broad general knowledge.

When that system is assigned a professional role, it should draw on the portion of its general training that corresponds to the relevant discipline.

This includes the generic knowledge that a competent practitioner in the field would normally be expected to bring into a new environment.

Examples include:

- standard terminology;
- accepted professional concepts;
- common methodologies;
- typical workflows;
- industry conventions;
- standard artifacts;
- best practices;
- common risk models;
- common failure patterns;
- expected modes of communication;
- typical assumptions about quality;
- established tools and processes;
- recognized tradeoffs.

This can be thought of as the agent's **professional lens**.

The lens answers the question:

> **How would a competent practitioner in this discipline normally think, communicate, and work?**

The role does not erase the AI's broader knowledge. A software engineering agent is still a general AI system capable of explaining finance, marketing, operations, or design concepts. The role instead establishes which professional frame should be the agent's **default perspective when performing its assigned work**.

---

# 3. The Second Layer: The Local Agentic Environment

Generic professional competence is not enough.

A capable human contractor arriving at a company may know their profession very well, but they are not immediately effective. They still need to learn:

- how this particular company works;
- what systems exist;
- how decisions were made;
- what conventions are followed;
- which rules are formal and which are implicit;
- what has already been tried;
- what mistakes have already been made;
- what the current goals are;
- what constraints are unique to the environment.

The same is true for an AI agent.

However, for an AI system, proprietary specialization is not just a body of information placed into a prompt. It is better understood as the **agentic environment made available to the role**.

That environment may include:

- retrieval tools;
- memory systems;
- proprietary documentation;
- internal databases;
- source repositories;
- issue trackers;
- communication systems;
- project-management systems;
- specialized skills;
- APIs;
- action tools;
- permission boundaries;
- project history;
- decision history;
- internal conventions;
- organizational terminology;
- past work products;
- access to other agents.

This distinction is important.

> **The local context of an AI role is not only what the agent has been told. It is also what the agent is equipped to retrieve, remember, inspect, invoke, modify, and act upon.**

---

# 4. Proprietary Knowledge as an Operational Environment

The proprietary side of an agent role can be decomposed into several categories.

## 4.1 Retrieval

Retrieval determines what the agent can look up when needed.

Examples:

- engineering documentation;
- source code;
- product requirements;
- customer-support history;
- test plans;
- issue trackers;
- architecture decisions;
- release notes;
- internal policies;
- data warehouses;
- knowledge bases;
- meeting notes.

Retrieval is essential because no agent should be expected to permanently carry every proprietary fact in its active context.

A capable role therefore depends not merely on knowledge, but on **reliable access to the right knowledge when needed**.

---

## 4.2 Memory

Memory determines what the agent can retain or later recover about its environment.

This may include:

- previous decisions;
- project history;
- prior incidents;
- lessons learned;
- known constraints;
- recurring problems;
- past investigations;
- user preferences;
- previous work completed by the role;
- unresolved issues;
- established conventions.

A memory system gives continuity to the role.

Without memory, an agent may repeatedly rediscover the same information. With appropriate memory, the role can accumulate organizational context over time.

---

## 4.3 Tools

Tools determine what the agent can actually inspect or change.

Examples might include:

- test runners;
- source control;
- CI/CD systems;
- ticketing systems;
- analytics tools;
- monitoring systems;
- cloud consoles;
- content-management systems;
- CRM systems;
- deployment tools;
- document editors.

The presence or absence of a tool changes the meaning of a role.

Two agents with the same professional title may have very different practical capabilities if one can only provide advice while another can inspect systems, run tests, create tickets, modify artifacts, or deploy changes.

---

## 4.4 Skills

A skill is a specialized packaged capability or workflow.

Examples:

- release validation;
- dependency analysis;
- incident triage;
- requirements review;
- data-quality checks;
- test-plan generation;
- security review;
- contract analysis;
- campaign-performance analysis.

Skills can represent reusable procedures that are more specific than generic reasoning but more portable than company-specific data.

---

## 4.5 Permissions and Access Boundaries

A role must also be defined by what it is allowed to access and what it is authorized to do.

Important distinctions may include:

- read versus write;
- inspect versus execute;
- propose versus approve;
- create versus delete;
- test versus deploy;
- internal versus customer-facing actions;
- access to sensitive information;
- access to production environments.

Capabilities should never be inferred solely from the role title.

A "software engineer" agent may have read-only repository access in one environment and production deployment permissions in another.

The local environment must make these differences explicit.

---

## 4.6 Project Context and Experience

A role is also shaped by the projects and work history available to the agent.

For example, an agent may know:

- the architecture of Project Alpha;
- why a migration decision was made six months earlier;
- the regressions discovered during a previous release;
- the expectations of a particular customer;
- the historical reasons behind a nonstandard implementation.

This project-specific history can make one agent far more appropriate for a task than another agent with an otherwise similar professional background.

---

# 5. A More Precise Definition of an Agent Role

The framework can therefore be represented as:

> **Agent Role = Professional Lens + Operational Environment**

Where the professional lens contains:

- industry knowledge;
- professional methods;
- terminology;
- conventions;
- assumptions;
- standards;
- risk models.

And the operational environment contains:

- retrieval;
- memory;
- tools;
- skills;
- permissions;
- proprietary knowledge;
- project context;
- historical context;
- available actions.

This produces a practical role rather than a fictional persona.

A useful role answers two separate questions:

> **How should this agent think?**

and

> **What can this agent know and do here?**

Both are necessary.

---

# 6. Generic Practice and Local Practice

The agent must understand the difference between industry-standard practice and organization-specific practice.

Generic professional knowledge should provide the baseline.

But local conventions may intentionally differ from that baseline.

For example:

- the organization may use a nonstandard branching model;
- quality gates may differ from common industry practice;
- architecture may contain legacy constraints;
- terminology may be company-specific;
- a process may exist because of regulatory or contractual obligations;
- a previous decision may intentionally trade elegance for operational stability.

The agent should therefore avoid assuming that generic best practice automatically overrides local practice.

Instead, it should be able to reason about the difference.

A useful behavior is:

1. Recognize the normal industry approach.
2. Retrieve or inspect the local convention.
3. Identify whether they differ.
4. Follow the applicable local requirement unless instructed otherwise.
5. Surface important conflicts when they materially affect the task.

This allows generic expertise to remain useful without making the agent blind to organizational reality.

---

# 7. Communication Should Adapt Without Changing the Core Role

A specialized role should not trap an agent inside the vocabulary of its discipline.

The agent's **reasoning context can remain specialized while its communication style adapts to the audience**.

For example:

- an engineer may explain an architectural constraint to a marketer in terms of delivery time and customer impact;
- a QA agent may explain release risk to an executive in terms of business exposure;
- a security agent may explain a vulnerability to a product manager in terms of user consequences;
- a product agent may translate customer needs into engineering requirements;
- a technical agent may explain a complex concept in nontechnical language.

This is possible precisely because the underlying system remains a generally capable AI.

The professional role determines the agent's **default working perspective**, not the only language it is allowed to speak.

A useful principle is:

> **Specialize the reasoning context; adapt the communication interface.**

---

# 8. Onboarding an Agent Into a Role

An AI agent entering a role should undergo something analogous to onboarding.

A useful onboarding process may include the following.

## 8.1 Define the professional role

Specify:

- discipline;
- mission;
- responsibilities;
- expected outputs;
- default professional assumptions.

## 8.2 Connect the operational environment

Make available:

- relevant retrieval systems;
- memory;
- tools;
- skills;
- internal systems;
- project data.

## 8.3 Establish access boundaries

Clarify:

- what the agent can inspect;
- what it can change;
- what requires approval;
- what is prohibited;
- what must be escalated.

## 8.4 Load organizational context

Provide access to:

- documentation;
- standards;
- conventions;
- terminology;
- architecture;
- historical decisions;
- policies.

## 8.5 Establish project history

Give the role access to:

- prior work;
- previous decisions;
- incidents;
- known risks;
- unresolved issues;
- important artifacts.

## 8.6 Define current goals

The agent should understand:

- what is currently being attempted;
- why it matters;
- what success looks like;
- what tradeoffs are acceptable.

## 8.7 Define documentation expectations

The agent should know what it must record so that its work remains inspectable and transferable.

---

# 9. Documentation, Auditability, and Continuity

An agent should document its work as part of the role rather than as an optional afterthought.

This is especially important in an agentic system because agents may be:

- restarted;
- replaced;
- upgraded;
- reconfigured;
- reassigned;
- unavailable;
- instantiated temporarily for a project.

A strong role should leave enough information behind that another competent agent or human can continue the work without reconstructing the entire history.

Useful documentation may include:

- actions taken;
- artifacts created;
- artifacts modified;
- decisions made;
- rationale;
- evidence;
- assumptions;
- unresolved questions;
- risks;
- dependencies;
- failed approaches;
- next steps;
- handoff notes.

A useful design principle is:

> **Every role should leave a usable trail of state, decisions, and work products behind it.**

This creates both **auditability** and **operational continuity**.

---

# 10. The Contractor Analogy

A useful mental model is to imagine the agent as a highly capable contractor arriving at an organization.

The contractor arrives with:

- professional education;
- industry vocabulary;
- standard methods;
- common patterns;
- general professional judgment.

But the contractor does not automatically know:

- the company's systems;
- internal terminology;
- project history;
- political or organizational dependencies;
- undocumented constraints;
- why previous decisions were made;
- where important artifacts live;
- what permissions are available.

The contractor becomes effective only after being connected to the environment.

The AI equivalent is similar:

> **Base training provides the profession.  
> The agentic environment provides the organization.**

This analogy also explains why documentation and handoff matter.

A contractor is expected to leave work in a state that another person can understand. The same should be true of an AI agent.

---

# 11. Every Agent Should Have a Discoverable Profile

If multiple agents coexist in an organization, role definitions should not remain hidden inside their individual prompts or configurations.

Each role should expose a **machine-discoverable profile**.

The profile should answer questions such as:

- What is this agent's professional role?
- How does it normally reason?
- What domains does it cover?
- What knowledge can it retrieve?
- What memory does it have?
- What tools can it use?
- What skills are available?
- What permissions does it possess?
- Which projects does it know?
- What work has it already participated in?
- What types of tasks should be routed to it?
- What types of work fall outside its responsibility?

This is analogous to getting to know a colleague from another team.

Knowing that someone is "in infrastructure" is useful, but collaboration becomes much easier when you also know:

- which systems they own;
- what projects they have worked on;
- what access they have;
- what problems they are equipped to solve.

---

# 12. The Purpose of the Agent Profile

The profile is not merely descriptive metadata.

Its purpose is to support **discovery, collaboration, delegation, and routing**.

An agent facing a task should be able to reason:

> **What does this task require?**

then:

> **Which parts can I perform with my own role, context, tools, and permissions?**

then:

> **What capabilities are missing?**

and finally:

> **Which available agent has the appropriate professional context, access, tools, knowledge, or project history?**

The profile provides the information needed to answer that last question.

The framework does not need to prescribe exactly how routing is implemented.

Routing might eventually be handled by:

- the originating agent;
- a dedicated coordinator;
- an agent registry;
- an orchestration layer;
- a task planner;
- a capability broker;
- a policy engine;
- a human supervisor.

The important architectural requirement is simply this:

> **Agents should expose enough structured information that another agent or orchestration system can determine whether they are an appropriate destination for work.**

---

# 13. Agent Profiles Should Describe Capabilities, Not Just Titles

A role title alone is too ambiguous for reliable collaboration.

For example, two agents may both be labeled "software engineer," but one may have:

- repository read access;
- architecture documentation;
- code-review tools;
- knowledge of Project Alpha.

The other may have:

- deployment permissions;
- infrastructure tooling;
- incident history;
- knowledge of Project Beta.

Their professional backgrounds overlap, but their local capabilities differ significantly.

For routing purposes, the profile therefore needs to describe both:

1. **Professional identity**
2. **Operational capability**

This leads to another useful expression:

> **Role title tells you how an agent tends to think.  
> Capability profile tells you what the agent can actually contribute.**

---

# 14. Example Agent Profile

A profile might look conceptually like this:

```yaml
agent_profile:
  identity:
    id: qa-release-agent
    role: Software Quality Assurance
    mission: Validate release quality and investigate regressions

  professional_context:
    domains:
      - software testing
      - regression analysis
      - test automation
      - release validation

    methods:
      - reproducibility analysis
      - boundary testing
      - regression comparison
      - risk-based testing

  environment:
    retrieval:
      - product specifications
      - test plans
      - issue tracker
      - release history
      - source repository

    memory:
      - prior test cycles
      - known regressions
      - historical release decisions

    tools:
      - automated test runner
      - issue tracker
      - source browser

    skills:
      - test-plan generation
      - bug reproduction
      - regression analysis
      - release validation

  access:
    projects:
      - Project Alpha
      - Project Beta

    permissions:
      - read source
      - execute tests
      - create issues

    restrictions:
      - cannot deploy production releases
      - cannot modify production data

  experience:
    projects:
      - Project Alpha v2 migration
      - Project Beta release validation

    notable_context:
      - Project Alpha authentication regression history
      - Project Beta mobile compatibility issues

  routing:
    accepts:
      - regression investigation
      - release-quality assessment
      - test strategy
      - bug reproduction

    collaborate_with:
      - software engineering
      - product management
      - security

    refer_elsewhere:
      - production deployment
      - pricing strategy
      - customer contract review
```

The exact schema is not the point.

The important feature is that the profile is **structured, inspectable, and useful for machine reasoning**.

---

# 15. Profiles as Organizational Interfaces

A mature agentic organization may treat profiles almost like interfaces between roles.

An agent does not need to know the implementation details of another agent.

It needs to know:

- what that agent is responsible for;
- what it knows;
- what it can access;
- what it can do;
- what inputs it expects;
- what outputs it produces;
- where its boundaries are.

This creates a useful separation between:

- **internal role implementation**, and
- **external role discoverability**.

In software terms, the internal prompt, memory structure, toolchain, and reasoning process can change without breaking collaboration, as long as the role continues to expose a stable and useful profile.

---

# 16. Routing Should Be Capability-Aware

Delegation should not be based only on job titles.

A task may require several different forms of suitability:

- professional expertise;
- project familiarity;
- access to a particular system;
- specific permissions;
- a specialized tool;
- historical knowledge;
- a skill workflow.

The most appropriate agent may therefore not be the one whose title looks most similar to the task.

For example, a deployment failure may appear to be an engineering problem, but the agent with the most useful combination of:

- production monitoring access;
- deployment history;
- incident memory;
- infrastructure tools;

may be an operations agent.

Thus routing should ideally be based on **capability fit**, not merely semantic similarity between task names and role titles.

---

# 17. Roles Should Be Able to Recognize Their Own Limits

A well-defined role should know not only what it can do, but also what it cannot do effectively.

An agent should recognize situations such as:

- missing access;
- missing project history;
- insufficient authority;
- lack of a required tool;
- lack of relevant expertise;
- need for another discipline;
- need for human approval.

This self-awareness is important for safe and efficient routing.

A useful role behavior is:

1. Evaluate the task.
2. Evaluate available context and capabilities.
3. Attempt the work that fits the role.
4. Identify missing capabilities.
5. Discover an appropriate collaborator or destination.
6. Package enough context for a useful handoff.

This creates a network of cooperating specialized agents rather than isolated bots trying to solve every problem themselves.

---

# 18. Handoffs Should Carry Context

Routing a task to another agent should not mean simply forwarding the original request.

A useful handoff should include relevant context such as:

- the task objective;
- current understanding;
- important evidence;
- work already performed;
- assumptions;
- unresolved questions;
- why the receiving agent was selected;
- expected output;
- constraints;
- links or references to relevant artifacts.

This minimizes repeated work and prevents loss of context.

The same principle that applies to human teams applies here:

> **Delegation is most effective when responsibility moves together with the information needed to act.**

---

# 19. A Role Definition Template

A reusable role instruction might look like this:

> You are a generally trained AI system with broad world knowledge. In this environment, operate primarily through the professional lens of **[ROLE / DISCIPLINE]**.
>
> Use the terminology, reasoning patterns, methods, standards, risk models, and professional conventions normally associated with this discipline as your default working model.
>
> Your role is not limited to your general professional knowledge. Your effective local specialization is also defined by the agentic environment available to you, including retrieval systems, memory, tools, skills, permissions, project context, historical context, and proprietary organizational knowledge.
>
> Use those resources actively when performing work. Do not assume that generic industry practice automatically overrides documented local practice. When local conventions differ from standard practice, recognize the difference and follow the applicable environmental requirements unless instructed otherwise.
>
> Your professional role should guide how you interpret tasks, identify risks, make decisions, evaluate alternatives, create artifacts, and determine whether work is complete.
>
> Adapt your communication to the audience. Explain concepts using the terminology and level of abstraction appropriate to the person or agent you are communicating with while keeping your underlying professional and organizational context intact.
>
> Maintain clear documentation of important work, including actions, decisions, rationale, assumptions, evidence, unresolved issues, artifacts, and next steps. Leave enough context for another human or AI agent to continue the work.
>
> Maintain or expose an accurate capability profile describing your professional role, available retrieval sources, memory, tools, skills, permissions, project experience, areas of responsibility, and limitations.
>
> When a task requires capabilities, access, context, or expertise that you do not possess, identify the missing requirement and use available agent profiles or organizational discovery mechanisms to locate a more appropriate collaborator or destination.
>
> When handing off work, include enough context for the receiving party to continue without unnecessary reconstruction.

---

# 20. A Minimal Agent Profile Template

A corresponding generic profile format could be:

```yaml
agent_profile:
  identity:
    id: <stable-agent-id>
    role: <professional-role>
    mission: <primary-purpose>

  professional_context:
    domains: []
    methods: []
    terminology: []
    standards: []

  environment:
    retrieval: []
    memory: []
    tools: []
    skills: []

  access:
    projects: []
    permissions: []
    restrictions: []

  experience:
    projects: []
    notable_context: []

  responsibilities:
    primary: []
    secondary: []

  routing:
    accepts: []
    collaborate_with: []
    refer_elsewhere: []

  handoff:
    expected_inputs: []
    expected_outputs: []
    documentation_requirements: []
```

This schema can evolve depending on the organization.

Some systems may need additional fields for:

- data sensitivity;
- confidence;
- availability;
- cost;
- latency;
- geographic or regulatory scope;
- tool health;
- current workload;
- temporary project assignments.

The essential idea is that the profile should be sufficiently structured to support **machine discovery and task routing**.

---

# 21. Core Design Principles

The framework can be summarized in the following principles.

## 1. A role is a context, not a costume

The purpose of a role is to establish a professional operating model, not to imitate a human personality.

## 2. Generic expertise and local specialization are different things

Generic professional knowledge comes from the AI's broad training.

Local specialization comes from the environment in which the agent operates.

## 3. Local specialization is operational

Proprietary context includes not only documentation, but retrieval, memory, tools, skills, permissions, project history, and available actions.

## 4. The role should shape reasoning, not just vocabulary

The professional frame should influence interpretation, risk detection, methods, outputs, decisions, and definitions of completion.

## 5. Communication should adapt to the audience

An agent should preserve its specialized reasoning context while translating its communication into the most useful form for the recipient.

## 6. Profiles should expose capability, not just identity

Knowing an agent's title is not enough. Other agents should be able to discover what it actually knows, accesses, and can do.

## 7. Routing should be based on capability fit

Delegation should consider tools, permissions, project history, memory, skills, and professional domain—not merely role names.

## 8. Agents should recognize their limits

A role should be able to identify when it lacks the expertise, access, authority, or context needed to complete a task effectively.

## 9. Handoffs should preserve context

The receiving agent should get the relevant evidence, assumptions, progress, artifacts, and unresolved questions.

## 10. Work should remain auditable and transferable

A human or another agent should be able to understand what happened and continue from the existing state.

---

# 22. The Emerging Organizational Model

This framework suggests a broader model for agentic organizations.

Instead of thinking about an AI team as a collection of anthropomorphized bots with human job titles, it is more useful to think of it as a collection of **generally capable systems operating through different professional lenses and different local environments**.

Each agent has:

- a professional perspective;
- a particular set of accessible knowledge;
- a particular memory;
- a set of tools;
- a set of skills;
- specific permissions;
- project history;
- known responsibilities;
- a discoverable profile.

The result resembles an organization not because the agents are pretending to be people, but because **specialization, access, institutional knowledge, division of responsibility, collaboration, and handoff naturally create organizational structure**.

Roles become useful abstractions for coordinating that structure.

---

# Conclusion

Human-style professional roles can be a useful way to organize AI agents, provided the concept of a role is defined operationally rather than anthropomorphically.

A robust role has three parts:

> **1. Generic Professional Lens**  
> <!-- excerpt:professional-lens -->
> The industry knowledge, terminology, conventions, methods, assumptions, and professional reasoning associated with a discipline.
> <!-- /excerpt:professional-lens -->

> **2. Local Agentic Environment**  
> <!-- excerpt:local-environment -->
> The proprietary retrieval, memory, tools, skills, permissions, project context, organizational history, and action capabilities available to the agent.
> <!-- /excerpt:local-environment -->

> **3. Discoverable Agent Profile**  
> <!-- excerpt:discoverable-profile -->
> The structured description that allows other agents or orchestration systems to understand the agent's role, capabilities, access, experience, limitations, and suitability for a task.
> <!-- /excerpt:discoverable-profile -->

Together, these determine how the agent approaches work, what information it can draw upon, what actions it can take, how it collaborates, how it recognizes its own limits, and how work can be routed across an agentic organization.

Under this model, an AI "software engineer," "quality assurance engineer," or "marketing specialist" is not a simulated employee.

It is a generally capable AI system given:

- a deliberate professional frame,
- a concrete operational environment,
- and a discoverable interface to the rest of the organization.

That makes the role not merely descriptive, but **functional, composable, auditable, and useful for multi-agent collaboration**.
