**Project Overview**

* What problem does your system solve?
  PizzaHUST addresses the manual and fragmented process of pizza ordering and store operations. Customers currently need to order in person or by phone, while the store owner has difficulty managing menus, combo campaigns, order flow, kitchen coordination, delivery handoff, and sales reporting in a consistent way.
* Who are the target users of the system?
  * Businesses: store owner, admin staff, kitchen staff
  * General public: guests and registered customers who want to order pizza online
  * External partner: third-party delivery service integrated through API
* Briefly describe the proposed system
  PizzaHUST is a web-based online ordering and store management system for a pizza shop. It allows customers to browse menus, customize pizzas, place cash-on-delivery orders, and track order progress. It also supports store-side menu management, combo scheduling, kitchen order queue handling, delivery service integration, and basic sales reporting.

**Main Features**

* Online ordering platform for guests and registered customers
* Pizza customization by size, crust type, and optional toppings
* Menu management for pizzas, side dishes, categories, vegetarian menu, and kids menu
* Combo and promotion management with time-based availability
* Cart and checkout with cash on delivery
* Order tracking for both guests and registered customers
* Kitchen order queue for prioritizing and processing incoming orders
* Customer accounts, order history, and loyalty points
* Basic sales and financial statistics dashboard
* Integration with a third-party delivery service

**Version 1 (MVP)**

* Public menu browsing and item detail pages
* Pizza customization
* Cart and checkout with cash on delivery
* Guest checkout with order-code tracking
* Customer login/register with order history and loyalty points
* Basic order tracking
* Admin management for menu items, categories, combos, customers, and orders
* Kitchen order queue with prioritized order handling and preparation status updates
* Loyalty points for registered customers
* Basic sales and order reports
* Basic third-party delivery integration

**Out of Scope**

* Online payment gateway integration
* Internal delivery staff management portal
* AI-based menu recommendation widget

**Proposed System Architecture**

* Web application: Yes
* Mobile application: No
* Client-Server system: Yes
* Microservices: No
* Other: Modular monolith with containerized deployment

The proposed architecture is a web-based client-server system. The frontend is built as a responsive web application, the backend provides RESTful APIs and business logic, and the database stores all operational data. The system integrates with a third-party delivery service for delivery booking and delivery status synchronization.

**Technology Stack**

* Frontend: Next.js
* UI/Styling: Tailwind CSS
* Backend: Python FastAPI
* Database: MySQL
* Cloud/Deployment: Docker, deployed on AWS or a VPS
* API Style: RESTful API

**Does the team have experience with these technologies?**

* Some experience

**External Systems or APIs Required**

* Third-party delivery API for delivery request creation and order status synchronization

**Estimated Development Cost**

* For an academic project, the direct development cost is still moderate compared to a commercial product, but it should reflect UI/UX design effort, database design, implementation, integration, testing, and deployment support.
* Estimated direct project cost: 75,000,000 to 90,000,000 VND

**Estimated Infrastructure Cost**

* Development/demo phase: 0 to 1,000,000 VND per month
* Stable MVP deployment: 1,000,000 to 5,000,000 VND per month

**Expected Benefits of the System**

* Improves customer convenience through online ordering
* Reduces manual work for the shop owner
* Improves menu, combo, and order management
* Supports better order tracking and kitchen coordination
* Provides basic financial and sales insights
* Enhances customer experience and operational efficiency

**Estimated Project Duration**

* Approximately 14 weeks (about 3.5 months)
* If choosing from the given options, the closest answer is: 3 months

**Team Roles**

* Project/Technical Lead: system architecture, technical coordination, integration review
* Backend Developer: order flow, kitchen order queue, delivery integration, business logic
* Frontend/UI Lead: UI/UX design direction, responsive pages, customer and admin interfaces
* Product/UX Support: customer-facing screen support, flow validation, acceptance alignment
* Database Developer: schema design, migrations, reporting queries

**Main Technical Risks**

* Complexity of checkout and order processing logic
* Kitchen order queue prioritization and workflow synchronization
* Third-party delivery API integration
* Database design for pizza customization, combos, loyalty points, and order tracking
* Delivery API instability or integration difficulties

**External Risks**

* Limited time and coordination across team members
* Hosting or deployment issues near the final stage

**Risk Mitigation Plan**

* Keep the architecture simple and modular
* Limit the project strictly to MVP scope
* Prioritize risky modules early, especially checkout, kitchen order queue, and delivery integration
* Use mock services if the delivery API is unavailable during development
* Define frontend-backend-data contracts clearly before parallel implementation
* Conduct regular weekly reviews and testing throughout development

**Overall Feasibility of the Project**

* Feasible with some risks

This project is feasible because the MVP scope is clear, the architecture is practical for a student team, and the business scenario is realistic for a web-based ordering system. The main feasibility concerns are checkout consistency, kitchen queue logic, delivery integration, and team time management, but these risks can be controlled with early design work, disciplined scope management, and incremental implementation.
