# PizzaHust 8-Week Project Plan

## 1. Purpose

This document adapts the planning spirit of `PTKHT_Project/section2_planning.tex` to the current PizzaHust project. It is written for a 5-member team building a web MVP in 8 weeks, with the practical delivery path:

`Use case analysis -> screen design -> database design -> implementation -> testing -> final demo`

The plan is intentionally biased toward realistic academic delivery. It keeps the scope aligned with the approved PizzaHust MVP instead of expanding into enterprise-level operations.

## 2. Initial System Request

### 2.1 Business Need

PizzaHust needs a web application that allows customers to order pizzas and related menu items online. The first version must support product browsing, pizza customization, combo promotions, cash on delivery, basic order processing, kitchen workflow, third-party delivery integration, and basic sales reporting.

### 2.2 Business Requirements

#### Functional Requirements

- Allow guests to browse menus and place orders without registration.
- Allow registered customers to log in, view order history, and use loyalty points.
- Support pizza customization by size, crust type, and optional toppings.
- Support side dishes such as drinks, fries, pasta, and BBQ chicken.
- Support combo promotions with time-based availability.
- Support menu grouping such as appetizer, main course, dessert, vegetarian, and kids menu.
- Support cash on delivery only.
- Support kitchen order processing and readiness updates.
- Integrate with a third-party delivery API instead of managing internal delivery staff.
- Provide admin screens for managing products, combos, categories, orders, customers, and reports.
- Provide a simple AI recommendation feature for menu suggestion.

#### Non-Functional Requirements

- The system must be easy to use on desktop and mobile web.
- The architecture must be simple enough for a student team to deliver in 8 weeks.
- The database design must support future extension without forcing a redesign of core entities.
- The source code must be organized enough for parallel work by 5 members.

### 2.3 Business Value

- Gives the team a project with realistic business flow and enough technical depth for the course.
- Covers both customer-facing and admin-facing workflows.
- Creates a clear bridge between software analysis, UI design, database design, and implementation.
- Produces a demonstrable MVP with visible business value during final presentation.

### 2.4 Constraints

- Total schedule is 8 weeks.
- Payment method is limited to cash on delivery.
- Delivery is handled by a third-party API, not internal delivery staff.
- The team should focus on shipping a stable MVP, not a feature-heavy platform.
- Design and code decisions must prioritize implementation feasibility over unnecessary complexity.

## 3. Feasibility Snapshot

### 3.1 Technical Feasibility

- The approved scope is feasible for a 5-person team if architecture is kept simple and modular.
- A standard web stack with backend, relational database, and responsive frontend is sufficient.
- Third-party delivery should be integrated at API level only, with a mock fallback during development.
- AI recommendation should stay simple, such as preference-based suggestion backed by menu data.

### 3.2 Operational Feasibility

- The project can be split cleanly into analysis, design, backend, frontend, database, and testing streams.
- Weekly checkpoints reduce the chance of document work and coding work drifting apart.
- The system is small enough to test manually and with a limited automated test set.

### 3.3 Schedule Feasibility

- 8 weeks is realistic if core deliverables are locked early and the team avoids scope creep.
- The risky areas are checkout flow, kitchen workflow, and external delivery integration.
- These risky areas therefore need to be finished before the last 2 weeks.

## 4. Delivery Strategy

### 4.1 Recommended Working Model

The team should use a hybrid academic-delivery approach:

- Week 1 focuses on locking analysis and scope.
- Week 2 focuses on screens, architecture, and database design.
- Weeks 3 to 6 focus on feature implementation in prioritized vertical slices.
- Week 7 focuses on integration, testing, and bug fixing.
- Week 8 focuses on report finalization, deployment, and final demo.

This approach is more suitable than a pure phase model because it preserves academic documentation quality while still giving the team enough time to build and stabilize a real product.

### 4.2 Definition of Done Per Week

A week is considered complete only when:

- The agreed deliverables for that week are uploaded to the repo or shared workspace.
- The responsible member has completed a walkthrough for the team.
- Cross-dependencies for the next week are unblocked.
- Major issues are logged instead of being left implicit.

## 5. MVP Scope Estimation

### 5.1 Core MVP Modules

- Public menu browsing
- Pizza customization
- Cart and checkout
- Guest checkout and customer login
- Loyalty points for registered users
- Combo and category management
- Kitchen order workflow
- Third-party delivery request and status synchronization
- Admin product and order management
- Basic sales and order reports
- Simple AI recommendation widget

### 5.2 Items Explicitly Kept Out of Scope

- Online payment gateway
- Internal delivery staff portal
- Complex promotion engine
- Advanced analytics or BI dashboard
- Multi-branch support
- Real-time route optimization

## 6. Team Roles

### 6.1 Primary Role Assignment

| Member | Primary Role | Main Responsibility |
|---|---|---|
| Mai Văn Nhật Minh | Technical Lead | System architecture, backend structure, integration review, release coordination |
| Tạ Quốc Hùng | Backend Lead | Order flow, kitchen flow, delivery API integration, business logic |
| Nguyễn Xuân Chí Thành | Product and Documentation Lead | Requirement alignment, report writing, acceptance criteria, progress control |
| Ngô Mạnh Hiếu | Database and Reporting Lead | ERD, schema design, migrations, reporting queries, admin data support |
| Trần Hoàng | Frontend and UI Lead | Screen design, frontend implementation, responsive behavior, demo polish |

### 6.2 Collaboration Rules

- Every module must have one primary owner and one support owner.
- No one works in isolation on a critical flow without at least one review from another member.
- Frontend and backend contracts must be written before parallel implementation starts.
- Documentation must be updated continuously instead of being delayed until the last week.

## 7. Weekly Roadmap

## Week 1: Scope Lock and Analysis Completion

### Required Outputs

- Finalized project scope
- Approved use case list and general use case diagram
- Screen inventory for customer, admin, and kitchen flows
- Initial backlog and priority list
- Working agreement for the 5-member team

### Weekly Tasks

| Member | Main Tasks |
|---|---|
| Mai Văn Nhật Minh | Propose technical direction, identify risky modules, define top-level architecture candidates |
| Tạ Quốc Hùng | Refine order lifecycle, kitchen workflow, and delivery integration logic |
| Nguyễn Xuân Chí Thành | Consolidate requirements from topic, maintain report consistency, finalize scope statement |
| Ngô Mạnh Hiếu | Identify domain entities and draft initial data object list |
| Trần Hoàng | Produce screen map and low-fidelity wireframe list for all main pages |

### Exit Criteria

- The team agrees on exactly what is in MVP and what is out.
- Use case analysis is stable enough to support UI and DB design in Week 2.

## Week 2: Screen Design and Database Design

### Required Outputs

- High-level architecture decision
- Main screen designs or structured wireframes
- Initial ERD and table list
- API/module inventory
- Development environment and repository conventions

### Weekly Tasks

| Member | Main Tasks |
|---|---|
| Mai Văn Nhật Minh | Lock architecture, define module boundaries, define backend project structure and API conventions |
| Tạ Quốc Hùng | Draft service flow for cart, checkout, kitchen, and delivery integration |
| Nguyễn Xuân Chí Thành | Write planning and design documentation, track design consistency across teams |
| Ngô Mạnh Hiếu | Create ERD, define tables, keys, and relationships, prepare migration plan |
| Trần Hoàng | Produce screen designs for public pages, customer pages, admin pages, and kitchen dashboard |

### Exit Criteria

- Screen flows and database design are approved by the team.
- Backend and frontend can start implementation in parallel without guessing.

## Week 3: Foundation Build

### Required Outputs

- Project skeleton running locally
- Authentication and role setup
- Base database migrations and seed data
- Public menu pages and frontend shell
- Initial admin and kitchen access structure

### Weekly Tasks

| Member | Main Tasks |
|---|---|
| Mai Văn Nhật Minh | Set up backend foundation, authentication, role structure, shared coding conventions |
| Tạ Quốc Hùng | Implement catalog services, cart logic skeleton, and order state model |
| Nguyễn Xuân Chí Thành | Prepare test checklist for core flows, update weekly progress documentation |
| Ngô Mạnh Hiếu | Implement migrations, seeders, sample menu data, and basic admin data support |
| Trần Hoàng | Build frontend shell, navigation, menu pages, product detail page, and cart UI base |

### Exit Criteria

- The app can run locally with seeded data.
- The team has a working base to continue feature development.

## Week 4: Core Ordering Flow

### Required Outputs

- Guest checkout flow
- Customer login and account flow
- Cart-to-checkout pipeline
- Loyalty point earning logic draft
- Kitchen queue visibility

### Weekly Tasks

| Member | Main Tasks |
|---|---|
| Mai Văn Nhật Minh | Review checkout architecture, enforce consistency across services and controllers |
| Tạ Quốc Hùng | Implement checkout logic, order creation, kitchen queue handoff, and order tracking structure |
| Nguyễn Xuân Chí Thành | Validate use cases against implementation, prepare acceptance criteria for ordering flow |
| Ngô Mạnh Hiếu | Finalize order-related schema, loyalty point tables, and admin order query support |
| Trần Hoàng | Implement checkout pages, login/register pages, account pages, and order tracking UI |

### Exit Criteria

- A user can browse, customize, add to cart, and place a COD order.
- Kitchen staff can see newly created orders.

## Week 5: Admin, Kitchen, and AI Recommendation

### Required Outputs

- Admin management for pizzas, options, categories, and combos
- Kitchen status update flow
- AI recommendation MVP
- Customer history and loyalty display

### Weekly Tasks

| Member | Main Tasks |
|---|---|
| Mai Văn Nhật Minh | Review integration quality, refactor unstable backend areas, support difficult implementation blockers |
| Tạ Quốc Hùng | Implement kitchen progress flow and delivery request trigger points |
| Nguyễn Xuân Chí Thành | Track feature completeness, update reports, prepare mid-project review materials |
| Ngô Mạnh Hiếu | Implement admin data operations, combo schedule logic, and reporting query drafts |
| Trần Hoàng | Implement admin screens, kitchen dashboard, order history UI, and AI recommendation widget UI |

### Exit Criteria

- Admin and kitchen users can perform core daily operations.
- The AI recommendation feature is demonstrable end to end.

## Week 6: Integration and Reporting Completion

### Required Outputs

- Third-party delivery integration or mock integration
- Order tracking synchronized with delivery state
- Basic reports for orders, revenue, and top-selling items
- Responsive refinement for key screens

### Weekly Tasks

| Member | Main Tasks |
|---|---|
| Mai Văn Nhật Minh | Lead integration review, resolve cross-module inconsistencies, prepare release branch strategy |
| Tạ Quốc Hùng | Implement delivery API request and status synchronization, add failure handling and retry rules |
| Nguyễn Xuân Chí Thành | Prepare user acceptance flow, keep report and actual implementation aligned |
| Ngô Mạnh Hiếu | Finalize reporting queries, optimize schema usage, prepare realistic demo dataset |
| Trần Hoàng | Refine responsive frontend, connect tracking and admin reporting views to real data |

### Exit Criteria

- MVP is feature-complete.
- Reports and delivery integration are functioning at MVP level.

## Week 7: Testing and Stabilization

### Required Outputs

- Bug list and fix status
- Release candidate build
- Finalized seed/demo dataset
- UAT checklist and internal walkthrough

### Weekly Tasks

| Member | Main Tasks |
|---|---|
| Mai Văn Nhật Minh | Coordinate code freeze, review major bugs, improve deployment readiness |
| Tạ Quốc Hùng | Fix backend edge cases and integration bugs in checkout, kitchen, and delivery |
| Nguyễn Xuân Chí Thành | Lead UAT sessions, maintain issue board, drive priority decisions for final fixes |
| Ngô Mạnh Hiếu | Validate data integrity, report accuracy, and migration reliability |
| Trần Hoàng | Fix UI and usability issues, polish demo-critical screens, ensure responsive consistency |

### Exit Criteria

- No critical bug remains in the main demo flow.
- The team has one stable release candidate.

## Week 8: Final Delivery, Report, and Demo

### Required Outputs

- Final working demo
- Final report package
- Final slides and speaking flow
- Deployment or demo environment
- Backup demo plan

### Weekly Tasks

| Member | Main Tasks |
|---|---|
| Mai Văn Nhật Minh | Final technical validation, deployment readiness, demo environment setup |
| Tạ Quốc Hùng | Prepare backend demo path, verify integrations, prepare fallback handling for live demo |
| Nguyễn Xuân Chí Thành | Finalize report narrative, consolidate all written materials, coordinate presentation flow |
| Ngô Mạnh Hiếu | Finalize ERD, database screenshots, reporting evidence, and supporting data materials |
| Trần Hoàng | Final UI polish, capture screenshots, prepare demo script visuals and walkthrough support |

### Exit Criteria

- The team can demonstrate the entire MVP without dependency on unfinished features.
- Report, screenshots, diagrams, and product behavior are consistent with each other.

## 8. Ownership by Module

| Module | Primary Owner | Support Owner |
|---|---|---|
| Requirements, report coherence, acceptance criteria | Nguyễn Xuân Chí Thành | Mai Văn Nhật Minh |
| Architecture and code integration | Mai Văn Nhật Minh | Tạ Quốc Hùng |
| Ordering, kitchen, delivery API logic | Tạ Quốc Hùng | Mai Văn Nhật Minh |
| Database, migrations, reports | Ngô Mạnh Hiếu | Tạ Quốc Hùng |
| UI design and frontend implementation | Trần Hoàng | Nguyễn Xuân Chí Thành |
| Admin module | Ngô Mạnh Hiếu | Trần Hoàng |
| AI recommendation feature | Trần Hoàng | Mai Văn Nhật Minh |

## 9. Main Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Scope grows after Week 2 | High | Freeze MVP scope after Week 2 and move new ideas to backlog |
| Frontend and backend mismatch | High | Freeze API contracts in Week 2 and review them before Week 3 coding |
| Delivery API instability | Medium | Build with mock service first and switch to real integration when stable |
| Documentation lags behind implementation | High | Thành updates report weekly and joins all review checkpoints |
| Reporting queries become too complex late | Medium | Hiếu prepares schema and reporting strategy from Week 2 |
| Demo flow breaks under time pressure | High | Maintain a stable demo branch and seed data from Week 7 |

## 10. Recommended Tools

- `Draw.io` or `Figma`: use case diagram, screen flow, UI mockups
- `MySQL Workbench` or equivalent: ERD and schema design
- `GitHub` or `GitLab`: source control and issue tracking
- `Jira`, `Trello`, or `Notion`: weekly task board
- `Postman` or `Bruno`: API verification
- `Discord`, `Zalo`, or `Messenger`: communication

## 11. Final Recommendation

The team should treat Weeks 1 and 2 as locking weeks, Weeks 3 to 6 as build weeks, Week 7 as stabilization week, and Week 8 as delivery week. The biggest mistake to avoid is spending too long polishing diagrams or screens while delaying the ordering flow, database structure, and integration backbone.

If the team follows this plan with weekly checkpoints and clear ownership, the PizzaHust MVP is realistic within 8 weeks for a 5-person team.
