# PizzaHust Final Report Refinement Plan

## Goal

Refine the final report in `/Documents/Final Report` as a **designed full-scope software engineering report** with **implementation status clearly marked**. The plan follows these confirmed rules:

- Sections **1 to 3** prioritize **original analysis artifacts**.
- Sections **4 to 10** prioritize **current code reality**.
- If a required diagram or image is missing, insert a **placeholder first** and continue drafting the section.
- The updated `Documents/PizzaHust.png` is the authoritative use-case overview image unless a more specific detailed artifact is required.

---

## Report Positioning

The report should not read as either:

- a pure proposal disconnected from the real repo, or
- a pure implementation dump with no software-engineering analysis.

Instead, it should present:

1. the original problem and requirements,
2. the designed full system,
3. the implemented subset and current verification status,
4. the gap between intended scope and current completion.

This framing must stay consistent across all sections.

---

## Source Priority

### Source Layer A: Original analysis truth

Use these first for Sections 1 to 3.

- `Documents/Topic.md`
- `Documents/InClassDocument/ProjectFeasibility.md`
- `Documents/PizzaHust.png`
- `Documents/UseCases/00-overview.md`
- `Documents/UseCases/01-customer.md`
- `Documents/UseCases/02-admin.md`
- `Documents/UseCases/03-kitchen.md`
- `Documents/UseCases/04-delivery.md`
- `Documents/Requirement_Analysis_Session_Assignment/*`

### Source Layer B: System design truth

Use these to explain designed architecture, behavior, contracts, and intended scope.

- `Application/PRODUCT.md`
- `Application/ARCHITECTURE.md`
- `Application/CONTRACTS.md`
- `DESIGN_BRIEF.md`
- `Design/README.md`
- `Design/*.html`

### Source Layer C: Current implementation truth

Use these first for Sections 4 to 10 when describing what currently exists.

- `Application/feature_list.json`
- `Application/progress.md`
- `Application/openapi.json`
- `Application/schema.dbml`
- `Application/backend/app/**`
- `Application/backend/app/infra/db/migrations/**`
- `Application/backend/tests/**`
- `Application/frontend/app/**`
- `Application/frontend/components/**`
- `Application/frontend/lib/**`
- `Application/frontend/tests/e2e/**`
- `Application/verify.sh`
- `Application/frontend/package.json`
- `Application/backend/pyproject.toml`

### Source Layer D: Report files to edit

- `Documents/Final Report/main.tex`
- `Documents/Final Report/latex_report/sections/01_requirements_problem_analysis.tex`
- `Documents/Final Report/latex_report/sections/02_use_case_analysis.tex`
- `Documents/Final Report/latex_report/sections/03_user_stories.tex`
- `Documents/Final Report/latex_report/sections/04_system_architecture.tex`
- `Documents/Final Report/latex_report/sections/05_component_architecture_design.tex`
- `Documents/Final Report/latex_report/sections/06_database_design.tex`
- `Documents/Final Report/latex_report/sections/07_user_interface_design.tex`
- `Documents/Final Report/latex_report/sections/08_component_implementation.tex`
- `Documents/Final Report/latex_report/sections/09_api_design_implementation.tex`
- `Documents/Final Report/latex_report/sections/10_testing_evaluation.tex`

---

## Global Writing Rules

### Required framing rule

Each section must be explicit about whether a statement refers to:

- `Original requirement`
- `Designed system`
- `Current implementation`

Do not mix those three silently in one paragraph.

### Evidence rule

Every important technical claim should come from one of:

- an original analysis artifact,
- a design artifact,
- a code/config/test artifact in the repo.

If evidence is weak, write the claim more cautiously.

### Status rule

For features, flows, or modules, use one of these labels consistently:

- `Designed and implemented`
- `Designed and partially implemented`
- `Designed but not yet implemented`

### Placeholder rule

When an image or diagram is needed but not yet available:

- insert a placeholder in the plan,
- continue writing the surrounding text,
- do not block the section on missing media.

### LaTeX rule

Every figure/table must have:

- caption,
- label,
- textual discussion in the section body.

---

## Section-by-Section Refinement Plan

## Section 1: System Requirements and Problem Analysis

### Target file

- `Documents/Final Report/latex_report/sections/01_requirements_problem_analysis.tex`

### Primary source priority

1. `Documents/Topic.md`
2. `Documents/InClassDocument/ProjectFeasibility.md`
3. `Documents/Requirement_Analysis_Session_Assignment/*`
4. `Application/PRODUCT.md` only to explain later design refinement

### Current issues to fix

- The section is too short for a final report.
- Functional requirements are presented as a compact list instead of a traceable requirement set.
- Stakeholder analysis is missing depth.
- Process/requirements approach is not explained.
- Original scope and later scope refinement are not clearly separated.

### Required rewrite structure

1. Problem context and business motivation
2. Stakeholder analysis
3. Scope definition
4. Requirement engineering approach
5. Functional requirements
6. Non-functional requirements
7. Assumptions and constraints
8. Summary of designed full scope vs current implementation note

### Writing actions

- Rewrite the problem statement by paraphrasing `Topic.md` and `ProjectFeasibility.md`.
- Add a stakeholder table:
  - Store owner / client
  - Admin staff
  - Kitchen staff
  - Guest
  - Customer
  - Third-party delivery provider
  - Development team
- Add in-scope and out-of-scope subsections based on the original artifacts.
- Add a short subsection explaining the project used an iterative refinement approach.
- Replace the short FR table with requirement groups and IDs such as:
  - `FR-CAT-*`
  - `FR-ORD-*`
  - `FR-AUTH-*`
  - `FR-ADM-*`
  - `FR-KIT-*`
  - `FR-DLV-*`
  - `FR-RPT-*`
- Rewrite NFRs so they are measurable where possible.
- Add a short paragraph stating that some later design refinements expanded the original requirement model.

### Placeholder needs

- None required unless you later want a stakeholder diagram.

### Review checklist

- Problem statement matches the client problem, not implementation details.
- Original scope is clearly distinguished from later design additions.
- Each requirement group maps naturally to later use cases and architecture.
- NFRs are verifiable or explicitly constrained.

---

## Section 2: Use-Case Analysis

### Target file

- `Documents/Final Report/latex_report/sections/02_use_case_analysis.tex`

### Primary source priority

1. `Documents/PizzaHust.png`
2. `Documents/UseCases/00-overview.md`
3. `Documents/UseCases/01-customer.md`
4. `Documents/UseCases/02-admin.md`
5. `Documents/UseCases/03-kitchen.md`
6. `Documents/UseCases/04-delivery.md`
7. `Application/PRODUCT.md` only for status alignment

### Current issues to fix

- The section currently leans too much on generated diagrams.
- The updated overview artifact should be foregrounded.
- The distinction between overview use-case model and detailed use-case specifications needs to be stronger.
- Detailed use cases are too compressed for a final report.

### Required rewrite structure

1. Actor model
2. Use-case overview
3. Use-case relationships
4. Use-case catalog by actor group
5. Selected detailed use-case specifications
6. Implementation status note

### Writing actions

- Replace or demote generated overview figures in favor of the updated `Documents/PizzaHust.png`.
- Add a clear explanation of actor relationships, especially `Customer` inheriting `Guest` behavior.
- Add a use-case catalog table with:
  - ID
  - Name
  - Primary actor
  - Supporting actor
  - Purpose
  - Status
- Expand the detailed use-case part from terse summary tables into fuller specifications for representative flows.
- Recommended detailed set:
  - `U6 Place COD Order`
  - `U7 Track Order`
  - `A4 Manage Combo Campaigns`
  - `A5 Monitor Orders and Delivery Exceptions`
  - `K3 Mark Order Ready for Dispatch`
  - `T2 Synchronize Delivery Status`
- If a cleaner detailed diagram is needed and not available, insert placeholder text.

### Placeholder needs

- Possible placeholder for a cleaner actor/use-case relation diagram if the updated PNG is only suitable as the overview.

### Review checklist

- Updated `PizzaHust.png` is visibly treated as the authoritative overview.
- Include/extend/generalization relations are explained in text.
- Detailed use cases are consistent with Sections 1, 3, and 9.
- Status labels are clear and honest.

---

## Section 3: User Stories

### Target file

- `Documents/Final Report/latex_report/sections/03_user_stories.tex`

### Primary source priority

1. `Documents/Topic.md`
2. `Documents/InClassDocument/ProjectFeasibility.md`
3. `Documents/UseCases/*`
4. `Application/PRODUCT.md` for designed scope completeness
5. `Application/feature_list.json` for implementation status

### Current issues to fix

- Stories are too compressed.
- Several entries bundle multiple use cases together.
- Acceptance criteria are not explicit enough.
- The section does not yet read like a real software-engineering backlog view.

### Required rewrite structure

1. Role of user stories in the project
2. Story organization by epic
3. Story tables with acceptance criteria
4. Traceability to use cases
5. Status note

### Writing actions

- Introduce epics aligned to the system modules:
  - Storefront browsing and customization
  - Cart and checkout
  - Tracking and loyalty
  - Authentication and profile
  - Admin catalog management
  - Admin operations and reporting
  - Kitchen operations
  - Delivery synchronization
- Rewrite story rows so each story has:
  - ID
  - As a / I want / so that
  - Acceptance criteria
  - Related use case
  - Status
- Split bundled story lines such as `US-U8/U9` into individual stories.
- Add at least one explicit traceability table from story to use case and implementation artifact.

### Placeholder needs

- None required.

### Review checklist

- Stories read like backlog items, not restated use cases.
- Acceptance criteria are specific enough to support testing.
- Designed full scope is visible, but current implementation status is marked.

---

## Section 4: System Architecture

### Target file

- `Documents/Final Report/latex_report/sections/04_system_architecture.tex`

### Primary source priority

1. `Application/ARCHITECTURE.md`
2. `Application/frontend/package.json`
3. `Application/backend/pyproject.toml`
4. `Application/docker-compose.yml`
5. `Application/PRODUCT.md`
6. `infra/terraform/**`

### Current issues to fix

- The current structure is acceptable but still too brief.
- Designed architecture and actual repo structure need clearer separation.
- Runtime topology and deployment assumptions need sharper wording.

### Required rewrite structure

1. Architectural style
2. Architecture rationale
3. Technology stack
4. Logical runtime topology
5. Backend boundary model
6. Security architecture
7. Deployment/development environment note

### Writing actions

- Keep modular monolith as the main architectural conclusion.
- Add rationale for not choosing microservices.
- Verify all framework/library version mentions from actual manifests.
- Clarify that Docker Compose represents local/demo runtime topology.
- If needed, keep the current architecture figure and strengthen its surrounding explanation.
- Add a short paragraph connecting architecture choices to project constraints from Section 1.

### Placeholder needs

- Placeholder only if a cleaner deployment/runtime figure is needed than the existing one.

### Review checklist

- Architecture style is justified, not just named.
- Versions match manifests exactly.
- The report does not imply production deployment evidence unless that evidence exists.

---

## Section 5: Component Architecture and Design

### Target file

- `Documents/Final Report/latex_report/sections/05_component_architecture_design.tex`

### Primary source priority

1. `Application/frontend/components/**`
2. `Application/frontend/lib/api/**`
3. `Application/backend/app/api/**`
4. `Application/backend/app/domain/**`
5. `Application/backend/app/infra/**`
6. `Application/ARCHITECTURE.md`

### Current issues to fix

- The section currently reads too much like a package inventory.
- Responsibilities and interfaces are not explained deeply enough.
- Real collaboration paths need stronger examples.

### Required rewrite structure

1. Frontend component architecture
2. Backend component architecture
3. Data and integration support components
4. Component interaction scenarios
5. Design rationale

### Writing actions

- Keep frontend and backend diagrams, but strengthen the text around them.
- Turn component tables into design-oriented descriptions:
  - responsibility,
  - inputs/outputs,
  - dependencies,
  - key files.
- Add 3 or 4 interaction narratives:
  - pizza quote flow,
  - combo customization flow,
  - admin combo editing flow,
  - delivery callback flow.
- Explicitly mention where the frontend follows shared API wrappers and where it still has mixed access patterns.

### Placeholder needs

- None unless a dedicated interaction diagram is added later.

### Review checklist

- Each major component has a clear role.
- Interactions are explained as collaborations, not only file lists.
- Text matches current code reality.

---

## Section 6: Database Design

### Target file

- `Documents/Final Report/latex_report/sections/06_database_design.tex`

### Primary source priority

1. `Application/schema.dbml`
2. `Application/backend/app/infra/db/models.py`
3. `Application/backend/app/infra/db/migrations/**`
4. `Week 1/ERD.pdf`
5. `Week 1/Data Dictionary.docx`

### Current issues to fix

- The section relies heavily on DBML without fully explaining later schema evolution.
- Important tables and rules need stronger narrative treatment.
- The distinction between early ERD and actual evolved schema should be explicit.

### Required rewrite structure

1. Database design goals
2. Early conceptual ERD vs evolved implementation schema
3. Entity groups and relationships
4. Key integrity and business rules
5. Schema evolution through migrations
6. Current design limitations or deferred areas

### Writing actions

- Keep DBML figures if accurate, but rewrite their interpretation text.
- Add a short subsection on evolution from initial ERD to current schema.
- Expand explanation of:
  - users/roles,
  - catalog and category structure,
  - generic options model,
  - combos and choice-slot modeling,
  - guest/customer orders,
  - snapshot strategy in order item options,
  - tracking and webhook/idempotency support,
  - kitchen queue view.
- Cross-check every schema statement against migrations and models before finalizing it.

### Placeholder needs

- Placeholder if one more focused ER figure is needed for auth/order tracking and not yet available.

### Review checklist

- Section shows both design intent and actual evolved schema.
- Table names and rules match code.
- Snapshot and workflow modeling are explained clearly.

---

## Section 7: User Interface Design

### Target file

- `Documents/Final Report/latex_report/sections/07_user_interface_design.tex`

### Primary source priority

1. `Design/README.md`
2. `DESIGN_BRIEF.md`
3. `Design/*.html`
4. `Design/screens/*`
5. `Application/frontend/app/**`
6. `Application/frontend/components/**`

### Current issues to fix

- The section is functional but shallow.
- It needs a clearer distinction between prototype intent and production implementation.
- The report should better explain navigation, visual system, responsive behavior, and accessibility intent.

### Required rewrite structure

1. UI design goals
2. Prototype set and design process
3. Information architecture and navigation
4. Representative screen groups
5. Visual system
6. Responsive and accessibility considerations
7. Prototype-to-implementation alignment note

### Writing actions

- Use the design bundle as the primary source for UI intent.
- Add a table mapping prototype screens to implemented routes where possible.
- Expand the visual system subsection:
  - typography,
  - theme,
  - layout,
  - reusable controls,
  - staff vs customer UI distinction.
- Keep accessibility wording cautious and evidence-based.
- If production screenshots are missing, keep placeholders and continue writing.

### Placeholder needs

- Placeholder for any production screenshots not yet prepared.
- Placeholder for a UI flow diagram if you want one later.

### Review checklist

- Reader can distinguish prototype, designed interaction, and implemented screen.
- UI text is specific to PizzaHust, not generic web-app writing.

---

## Section 8: Component Implementation

### Target file

- `Documents/Final Report/latex_report/sections/08_component_implementation.tex`

### Primary source priority

1. `Application/feature_list.json`
2. `Application/progress.md`
3. backend/frontend implementation files
4. tests
5. `Application/PRODUCT.md`

### Current issues to fix

- This section currently over-compresses major implementation work.
- It risks implying fuller completion than the repo actually shows.
- It needs clearer vertical slices with real evidence.

### Required rewrite structure

1. Implementation strategy
2. Core implemented vertical slices
3. Key business-rule implementation examples
4. Integration implementation
5. Partially implemented or deferred slices

### Writing actions

- Rewrite this section around concrete vertical slices:
  - public catalog,
  - pizza customization and quoting,
  - combo customization,
  - cart and checkout/order placement,
  - authentication/profile,
  - admin catalog and combos,
  - admin operations,
  - kitchen and delivery flow.
- For each slice, describe:
  - user-facing entry point,
  - backend modules,
  - data model support,
  - test evidence,
  - status.
- Use `feature_list.json` and `progress.md` to prevent stale claims.
- Add a dedicated subsection for designed-but-not-fully-implemented areas.

### Placeholder needs

- None required.

### Review checklist

- No incomplete feature is described as fully complete.
- Implementation examples map to real repo files and tests.
- The section reads as engineering implementation evidence, not architecture repetition.

---

## Section 9: API Design and Implementation

### Target file

- `Documents/Final Report/latex_report/sections/09_api_design_implementation.tex`

### Primary source priority

1. `Application/openapi.json`
2. `Application/CONTRACTS.md`
3. `Application/backend/app/api/**`
4. `Application/frontend/lib/api/**`
5. `Application/verify.sh`

### Current issues to fix

- The section needs stronger examples and cleaner separation between conventions and concrete API groups.
- Some endpoint inventory language is too broad.
- It should better explain contract-generation workflow and current API status.

### Required rewrite structure

1. API style and conventions
2. Authentication and security model
3. Error model
4. API surface by module
5. Representative endpoint examples
6. Contract generation and drift control
7. Implemented vs designed API coverage note

### Writing actions

- Recompute API counts and groups from `openapi.json`.
- Add clearer grouping:
  - config,
  - catalog,
  - cart and order,
  - auth and loyalty,
  - admin,
  - kitchen,
  - webhook/integration.
- Add concrete request/response examples for a few critical endpoints.
- Clarify which contract areas exist as design/current contract even if frontend coverage is incomplete.
- Keep the OpenAPI generation workflow and drift gate explanation.

### Placeholder needs

- Placeholder for any additional sequence diagram or API table graphic if needed.

### Review checklist

- Endpoint descriptions match current contract files.
- The section demonstrates both design quality and implementation discipline.
- Security and error-handling conventions are explicit.

---

## Section 10: Testing and Evaluation

### Target file

- `Documents/Final Report/latex_report/sections/10_testing_evaluation.tex`

### Primary source priority

1. `Application/verify.sh`
2. `Application/backend/tests/**`
3. `Application/frontend/**/*.test.ts`
4. `Application/frontend/tests/e2e/**`
5. `Application/progress.md`
6. `Application/feature_list.json`

### Current issues to fix

- Counts are stale and must be updated.
- Evaluation is too high-level.
- The section should connect testing back to requirements and use cases more directly.

### Known counts to use as current baseline

- Backend `test_*.py` files: **58**
- Frontend unit test files `*.test.ts` and `*.test.tsx`: **21**
- Playwright spec files `*.spec.ts`: **23**
- Frontend `page.tsx` route files: **28**
- OpenAPI path count baseline: **59**

These numbers should be rechecked again immediately before final submission if the repo changes.

### Required rewrite structure

1. Test strategy
2. Verification workflow
3. Test inventory
4. Representative coverage by subsystem
5. Evaluation against goals
6. Limitations and remaining risks

### Writing actions

- Make `verify.sh` the backbone of the QA narrative.
- Explain the layered strategy:
  - lint and static checks,
  - backend unit/integration tests,
  - schema/contract drift checks,
  - frontend unit tests,
  - browser e2e,
  - smoke flow.
- Replace broad evaluation wording with subsystem-based evidence.
- Add an explicit limitations subsection:
  - no formal accessibility audit evidence,
  - no production-scale performance benchmark,
  - some designed full-scope features remain partial or pending,
  - demo/runtime topology differs from real production deployment.

### Placeholder needs

- Optional placeholder for a requirement-to-test traceability matrix if not yet built.

### Review checklist

- Counts are current.
- Evaluation claims are supported by actual verification evidence.
- Limitations are honest and specific.

---

## Cross-Section Consistency Pass

This pass happens after all ten sections are rewritten.

### Objectives

- Standardize actor names.
- Standardize use-case IDs.
- Standardize module names.
- Standardize API resource names.
- Standardize database entity names.
- Standardize scope/status vocabulary.

### Specific checks

- `Guest`, `Customer`, `Admin / Store Owner`, `Kitchen Staff`, `Third-Party Delivery`
- `U`, `A`, `K`, `T` identifiers match across Sections 2, 3, 8, and 9
- `Designed and implemented` / `Designed and partially implemented` / `Designed but not yet implemented`
- Architecture, database, API, and implementation sections do not contradict each other
- Every figure/table is cited in surrounding prose

---

## Editing Sequence

### Phase 1: Foundation sections

1. Section 1
2. Section 2
3. Section 3

### Phase 2: Technical truth sections

4. Section 4
5. Section 6
6. Section 9

### Phase 3: Design and implementation sections

7. Section 5
8. Section 7
9. Section 8
10. Section 10

### Phase 4: Final polish

11. Cross-section consistency pass
12. Figure/table placeholder pass
13. LaTeX cleanup and compile check

---

## Deliverables Per Editing Round

For each section refinement round, produce:

1. Updated `.tex` section content
2. List of sources used
3. List of claims intentionally softened due to weak evidence
4. List of placeholders inserted
5. Open questions for you

---

## Subsection-Level Writing Checklist

Use this as the operational checklist while editing each `.tex` file.

## `01_requirements_problem_analysis.tex`

### Subsection checklist

- [ ] Add `Problem context` subsection
- [ ] Add `Business motivation` paragraph tied to manual ordering and store-operation fragmentation
- [ ] Add `Stakeholder analysis` subsection
- [ ] Add stakeholder table with role, interest, and system expectation columns
- [ ] Add `Scope definition` subsection
- [ ] Split scope into `In scope` and `Out of scope`
- [ ] Add `Requirement engineering approach` subsection
- [ ] Explain iterative refinement / middleweight process choice
- [ ] Add `Functional requirements` subsection
- [ ] Group FRs by module family instead of one flat list
- [ ] Add explicit FR IDs
- [ ] Add `Non-functional requirements` subsection
- [ ] Group NFRs by performance, security, usability, maintainability, reliability, deployment constraints
- [ ] Add `Assumptions and constraints` subsection
- [ ] Add `Designed full scope vs current implementation` note at the end

### Content checklist

- [ ] Problem statement paraphrases original artifacts, not repo summaries
- [ ] Inner Hanoi delivery fee and COD-only come from original requirements
- [ ] Single-store assumption is stated explicitly
- [ ] Original requirement scope is separated from later v2 refinement
- [ ] NFR statements avoid vague terms like “easy to use” without criteria

### Figure/table checklist

- [ ] Functional requirements table has labels and traceable IDs
- [ ] Non-functional requirements table has labels and verifiable wording
- [ ] Optional stakeholder diagram marked as placeholder only if needed

### Status/accuracy checklist

- [ ] No implementation-only feature is presented as original client requirement unless evidenced
- [ ] Any later additions are clearly framed as design refinement

---

## `02_use_case_analysis.tex`

### Subsection checklist

- [ ] Add `Actors` subsection
- [ ] Add `Use-case overview` subsection
- [ ] Add `Use-case relationships` subsection
- [ ] Add `Use-case catalog` subsection
- [ ] Add `Selected detailed use-case specifications` subsection
- [ ] Add `Implementation status note` subsection

### Content checklist

- [ ] Use updated `Documents/PizzaHust.png` as the main overview artifact
- [ ] Explain `Customer` as an extension/generalization of `Guest`
- [ ] Explain supporting role of `Third-Party Delivery`
- [ ] Describe include/extend/generalization relationships in text
- [ ] Catalog all important U/A/K/T use cases needed for full designed scope
- [ ] Mark each use case with status:
  - [ ] Designed and implemented
  - [ ] Designed and partially implemented
  - [ ] Designed but not yet implemented

### Detailed use-case checklist

- [ ] Expand `U6 Place COD Order`
- [ ] Expand `U7 Track Order`
- [ ] Expand `A4 Manage Combo Campaigns`
- [ ] Expand `A5 Monitor Orders and Delivery Exceptions`
- [ ] Expand `K3 Mark Order Ready for Dispatch`
- [ ] Expand `T2 Synchronize Delivery Status`
- [ ] Ensure each detailed use case includes trigger, preconditions, main flow, alternatives, postconditions

### Figure/table checklist

- [ ] Insert overview use-case image using updated `PizzaHust.png`
- [ ] Add caption and label for the overview image
- [ ] Add textual explanation immediately after the figure
- [ ] Add use-case catalog table with actor and status columns
- [ ] Add placeholder only if a cleaner actor/use-case detail diagram is still needed

### Status/accuracy checklist

- [ ] Do not silently replace original analysis use cases with implementation-only convenience flows
- [ ] Keep designed full scope visible even if not fully implemented

---

## `03_user_stories.tex`

### Subsection checklist

- [ ] Add `Role of user stories` subsection
- [ ] Add `Story organization by epic` subsection
- [ ] Add `Customer-facing stories` subsection
- [ ] Add `Staff-facing stories` subsection
- [ ] Add `Traceability` subsection
- [ ] Add `Implementation status note` subsection

### Content checklist

- [ ] Use one story per row where possible
- [ ] Remove bundled rows like `US-U8/U9` unless justified
- [ ] Keep epic grouping aligned with system modules
- [ ] Write acceptance criteria that can map to testing
- [ ] Tie stories back to related use cases
- [ ] Mark status per story or per epic where appropriate

### Story coverage checklist

- [ ] Browsing and menu discovery
- [ ] Pizza customization
- [ ] Combo browsing and combo customization
- [ ] Cart management
- [ ] COD checkout and order placement
- [ ] Tracking
- [ ] Registration and login
- [ ] Profile and loyalty
- [ ] Admin catalog
- [ ] Admin order/customer/reporting operations
- [ ] Kitchen operations
- [ ] Delivery synchronization

### Figure/table checklist

- [ ] Story table includes ID, story text, acceptance criteria, related use case, status
- [ ] Traceability table maps story to use case, API/UI/test evidence
- [ ] No placeholder required unless you later want an epic map diagram

### Status/accuracy checklist

- [ ] Stories represent designed full scope
- [ ] Implementation status is marked rather than implied

---

## `04_system_architecture.tex`

### Subsection checklist

- [ ] Add or refine `Architectural style`
- [ ] Add `Architecture rationale`
- [ ] Add `Technology stack`
- [ ] Add `Runtime topology`
- [ ] Add `Backend boundary model`
- [ ] Add `Security architecture`
- [ ] Add `Deployment and environment note`

### Content checklist

- [ ] Explain why modular monolith fits scope, team size, and timeline
- [ ] Explain why this is not a microservice system
- [ ] Verify framework versions from local manifests only
- [ ] Distinguish designed architecture from demonstrated runtime evidence
- [ ] Tie architecture choices back to constraints from Section 1

### Figure/table checklist

- [ ] Technology stack table uses actual versions
- [ ] Runtime architecture figure is retained or replaced intentionally
- [ ] Every architecture figure has explanatory text
- [ ] Placeholder used only if runtime/deployment figure must be redone

### Status/accuracy checklist

- [ ] Do not imply production deployment proof if only local/demo topology is verified

---

## `05_component_architecture_design.tex`

### Subsection checklist

- [ ] Add/refine `Frontend component architecture`
- [ ] Add/refine `Backend component architecture`
- [ ] Add `Data and integration support components`
- [ ] Add `Component interaction scenarios`
- [ ] Add `Design rationale`

### Content checklist

- [ ] Describe responsibilities, not only folders
- [ ] Identify major frontend groups:
  - [ ] routes
  - [ ] customer shared components
  - [ ] admin components
  - [ ] combo components
  - [ ] API client and auth state
- [ ] Identify major backend groups:
  - [ ] routers
  - [ ] domain modules
  - [ ] DB infra
  - [ ] auth infra
  - [ ] delivery infra
- [ ] Explain mixed frontend API access pattern honestly

### Interaction scenario checklist

- [ ] Pizza quote flow
- [ ] Combo customization flow
- [ ] Admin combo editing flow
- [ ] Delivery callback flow

### Figure/table checklist

- [ ] Frontend component figure has updated discussion
- [ ] Backend component figure has updated discussion
- [ ] Component overview tables describe inputs/dependencies, not only examples
- [ ] Placeholder only if new interaction figure is required later

### Status/accuracy checklist

- [ ] Scenarios are derived from current code paths, not only planned flows

---

## `06_database_design.tex`

### Subsection checklist

- [ ] Add/refine `Database design goals`
- [ ] Add `Conceptual ERD vs evolved schema`
- [ ] Add `Entity groups and relationships`
- [ ] Add `Key integrity and business rules`
- [ ] Add `Schema evolution through migrations`
- [ ] Add `Current limitations or deferred areas`

### Content checklist

- [ ] Explain the relationship between Week 1 ERD and current schema
- [ ] Explain guest vs registered customer order modeling
- [ ] Explain generic option groups and per-product enablement
- [ ] Explain combo slot design
- [ ] Explain snapshot strategy in `order_item_options`
- [ ] Explain tracking/history tables and webhook/idempotency support
- [ ] Explain kitchen queue view as read model

### Figure/table checklist

- [ ] Catalog/options diagram verified against actual schema
- [ ] Combo diagram verified against actual schema
- [ ] Orders/tracking diagram verified against actual schema
- [ ] Schema evolution table references actual migration changes
- [ ] Placeholder only if an additional focused ER subdiagram is needed

### Status/accuracy checklist

- [ ] No table or rule is described as current unless backed by models/migrations
- [ ] Designed/evolved differences are called out explicitly

---

## `07_user_interface_design.tex`

### Subsection checklist

- [ ] Add `UI design goals`
- [ ] Add `Prototype set and design process`
- [ ] Add `Information architecture and navigation`
- [ ] Add `Representative screen groups`
- [ ] Add `Visual system`
- [ ] Add `Responsive and accessibility considerations`
- [ ] Add `Prototype-to-implementation alignment note`

### Content checklist

- [ ] Use design mockups as primary source of UI intent
- [ ] Distinguish static prototype from production frontend
- [ ] Explain differences between customer-facing and staff-facing interfaces
- [ ] Describe navigation structure for public, account, admin, and kitchen areas
- [ ] Describe typography/theme/layout briefly but concretely
- [ ] Keep accessibility language evidence-based

### Screen mapping checklist

- [ ] Home and menu
- [ ] Item detail/customizer
- [ ] Combo list and combo customizer
- [ ] Cart and checkout
- [ ] Tracking and order history
- [ ] Login/register/account
- [ ] Admin catalog
- [ ] Admin orders/customers/reports
- [ ] Kitchen queue

### Figure/table checklist

- [ ] Add prototype-to-route mapping table
- [ ] Add placeholders for screenshots still missing
- [ ] Every inserted image is discussed in text

### Status/accuracy checklist

- [ ] Report does not imply all prototype screens are fully implemented

---

## `08_component_implementation.tex`

### Subsection checklist

- [ ] Add/refine `Implementation strategy`
- [ ] Add `Core implemented vertical slices`
- [ ] Add `Business-rule implementation examples`
- [ ] Add `Integration implementation`
- [ ] Add `Partially implemented and deferred slices`

### Vertical slice checklist

- [ ] Public catalog
- [ ] Pizza customization and quote
- [ ] Combo customization
- [ ] Cart and order placement
- [ ] Authentication and profile
- [ ] Admin catalog and options
- [ ] Admin combos
- [ ] Admin operational views
- [ ] Kitchen workflow
- [ ] Delivery integration

### Per-slice writing checklist

- [ ] User-facing entry point
- [ ] Backend route(s)
- [ ] Domain/service logic
- [ ] Data model support
- [ ] Test evidence
- [ ] Status label

### Content checklist

- [ ] Use `feature_list.json` and `progress.md` as the status anchor
- [ ] Separate finished slices from partially implemented ones
- [ ] Keep design-scope claims distinct from actual code completion

### Figure/table checklist

- [ ] Vertical slices table updated to match current scope
- [ ] Any deferred feature list is clearly marked as not fully implemented
- [ ] Placeholder only if an implementation workflow figure is later needed

### Status/accuracy checklist

- [ ] No incomplete slice is written as complete

---

## `09_api_design_implementation.tex`

### Subsection checklist

- [ ] Add/refine `API style and conventions`
- [ ] Add `Authentication and security model`
- [ ] Add `Error model`
- [ ] Add `API surface by module`
- [ ] Add `Representative endpoint examples`
- [ ] Add `Contract generation and drift control`
- [ ] Add `Implemented vs designed API coverage note`

### Content checklist

- [ ] Recompute API groups from current `openapi.json`
- [ ] Explain session cookie and CSRF model
- [ ] Explain error envelope structure
- [ ] Separate public, customer, admin, kitchen, and webhook APIs
- [ ] Include representative examples for:
  - [ ] quote
  - [ ] login
  - [ ] order placement
  - [ ] admin combo or item management
  - [ ] retry dispatch or webhook

### Figure/table checklist

- [ ] API surface table uses current grouping
- [ ] Representative endpoints table reflects real paths
- [ ] Sequence diagrams are marked as implemented vs planned where necessary
- [ ] Placeholder inserted if a better request/response diagram is later desired

### Status/accuracy checklist

- [ ] Contract-level designed endpoints are not confused with fully UI-complete features

---

## `10_testing_evaluation.tex`

### Subsection checklist

- [ ] Add/refine `Test strategy`
- [ ] Add `Verification workflow`
- [ ] Add `Test inventory`
- [ ] Add `Representative subsystem coverage`
- [ ] Add `Evaluation against goals`
- [ ] Add `Limitations and remaining risks`

### Content checklist

- [ ] Use `verify.sh` as the main verification narrative
- [ ] Update all test counts before final submission
- [ ] Connect tests back to requirements/use cases where practical
- [ ] Explain static checks, backend tests, frontend tests, e2e, smoke, and drift checks
- [ ] Add explicit limitations subsection

### Current baseline checklist

- [ ] Backend test file count: 58
- [ ] Frontend unit test file count: 21
- [ ] Playwright spec count: 23
- [ ] Frontend page route count: 28
- [ ] OpenAPI path baseline: 59
- [ ] Recheck these counts right before final lock

### Figure/table checklist

- [ ] Test inventory table updated
- [ ] QA workflow table updated from `verify.sh`
- [ ] Optional traceability matrix placeholder inserted if not yet built

### Status/accuracy checklist

- [ ] No claim of accessibility/performance validation without actual evidence
- [ ] Limitations are explicit and concrete

---

## Final Global Lock Checklist

- [ ] Every section states whether claims are original requirement, designed system, or current implementation
- [ ] All feature status language is standardized
- [ ] All actor/use-case/module/entity names are consistent
- [ ] All figures have captions, labels, and textual references
- [ ] All placeholders are easy to find and replace
- [ ] Final counts and versions are rechecked immediately before submission

---

## Suggested Working Mode For The Next Step

Work section-by-section in reviewable batches:

1. Rewrite Sections 1 to 3 first for approval
2. Then rewrite Sections 4, 6, and 9
3. Then finish Sections 5, 7, 8, and 10
4. End with the consistency pass and compile check

This keeps the highest-risk framing decisions locked early before the technical sections are polished around them.
