# 01 – System Requirements and Problem Analysis

## Khung lý thuyết (IT3180, slide "8 – Requirement Analysis")

- Requirements mô tả hệ thống **từ góc nhìn client**, phải:
  understandable bởi cả client và dev, được xây dựng cùng client.
- **Requirement Steps**: Feasibility study → Analyze (làm việc với
  client để hiểu requirements) → Model (tổ chức requirement một cách hệ
  thống) → Define/record/communicate → Specification.
- **Process model** ảnh hưởng cách viết requirements:
  - Heavyweight (waterfall): spec chi tiết, dùng cho acceptance testing,
    khó maintain.
  - Lightweight (Agile/sprint): mỗi sprint có requirement riêng, working
    code để verify, ít doc.
  - Middleweight (iterative refinement): requirement được refine qua
    từng iteration, outline trước rồi chi tiết dần.
  - PizzaHUST: feasibility doc nói "modular monolith", 14 tuần, "regular
    weekly reviews" → nên mô tả là **iterative/middleweight với heavyweight
    cho phần core (DB schema, overall architecture) theo đúng khuyến nghị
    của slide** ("develop system-wide requirements and overall system
    architecture early"). Nêu rõ lựa chọn này trong báo cáo (1 đoạn), vì
    nó giải thích lý do DB design & architecture được làm sớm và chi
    tiết.
- **Functional requirements**: mô tả chức năng hệ thống phải thực hiện —
  transactions, data, user interfaces.
- **Non-functional requirements** — 4 nhóm:
  - *Product*: performance, reliability, portability, usability...
  - *Organizational*: delivery, training, standards...
  - *External*: legal, interoperability...
  - *Marketing/PR* (ít dùng cho project sinh viên, có thể bỏ qua hoặc 1
    câu).
- **Stakeholder analysis**: ai bị ảnh hưởng — client, customers, users,
  senior management, administrators, computing staff.
- **Viewpoint analysis**: requirement nhìn từ góc mỗi nhóm stakeholder
  khác nhau.
- **Requirements phải Realistic và Verifiable**:
  - Sai: "The system must be easy to use." (không đo được)
  - Đúng: "After one day's training, an operator should be able to
    process 50 transactions per hour." (đo được → dùng cho acceptance
    testing)
- Khi requirement client đưa ra mâu thuẫn/quá đắt → cần ghi lại quá
  trình **negotiation** (1 đoạn ngắn là đủ cho báo cáo sinh viên, không
  cần kịch bản dài).
- Phân biệt **replacement system** vs **legacy system**: PizzaHUST thay
  thế quy trình order thủ công (điện thoại/tại quầy) → là *replacement*
  cho phần ordering, nhưng vẫn phải tương thích với cách vận hành bếp
  hiện tại (legacy workflow của nhân viên).

## Áp dụng cho PizzaHUST

Nguồn dữ liệu chính: `ProjectFeasibility.md`, `Topic.md`.

### 1.1 Problem Statement
Diễn giải lại (KHÔNG copy nguyên văn, paraphrase) đoạn "What problem does
your system solve?" trong `ProjectFeasibility.md`: quy trình đặt pizza
hiện tại thủ công/phân tán (đặt tại quầy hoặc điện thoại), chủ quán khó
quản lý menu, combo, luồng đơn, bếp, giao hàng, báo cáo doanh thu một
cách nhất quán.

### 1.2 Stakeholder Analysis
Dùng lại **Actors Summary** đã có (Guest, Customer, Admin/Store Owner,
Kitchen Staff, Third-Party Delivery) làm xương sống, nhưng mở rộng theo
mẫu slide "Stakeholder Analysis" (Client, Customers, Users, Senior
management, Administrators, Computing staff) để không thiếu nhóm nào:

| Stakeholder | Vai trò trong dự án |
|---|---|
| Client / Store Owner | Người đặt hàng dự án, ra quyết định nghiệp vụ (menu, giá, combo, chính sách giao hàng) |
| Admin staff | Vận hành catalog/combo/đơn hàng hàng ngày |
| Kitchen staff | Người dùng kitchen queue |
| Guest / Customer | Người dùng cuối storefront |
| Third-party delivery provider | Đối tác tích hợp API |
| Development team | Thiết kế, xây dựng, vận hành hệ thống (đề cập vai trò: PM/Tech Lead, Backend, Frontend/UI, Database, Product/UX — lấy từ "Team Roles" trong feasibility doc) |
| Hosting/computing staff | Vận hành Docker/VPS-AWS (có thể chính là team) |

### 1.3 Scope
- **In scope (V1/MVP)**: copy & paraphrase danh sách "Version 1 (MVP)"
  trong `ProjectFeasibility.md` — nên trình bày lại dưới dạng câu văn +
  bullet ngắn, nhóm theo module (xem `00_glossary_and_context.md` §4)
  để section 1 và section 4/5 khớp nhau ngay từ đầu.
- **Out of scope**: online payment gateway, internal delivery staff
  management portal, AI-based menu recommendation widget — nêu rõ lý do
  (theo Risk Mitigation: giữ architecture đơn giản, giới hạn MVP).

### 1.4 Functional Requirements (FR)
Đề xuất đánh mã `FR-<module>-<số>` (module = viết tắt module ở
`00_glossary_and_context.md` §4, ví dụ `CAT` = Catalog, `ORD` = Cart &
Ordering, `TRK` = Order Tracking, `KIT` = Kitchen Queue, `DLV` =
Delivery Integration, `LOY` = Customer & Loyalty, `RPT` = Reporting,
`AUTH`). Mỗi FR: 1 câu mô tả + actor liên quan + (tuỳ chọn) use case mã
sẽ implement nó. Ví dụ:

> **FR-ORD-01**: The system shall allow a Guest or Customer to customize
> a pizza by selecting size (S/M/L), crust type (crispy or soft, free),
> and optional toppings priced according to the selected size. →
> implemented by U3.
>
> **FR-ORD-05**: The system shall apply a fixed 22,000 VND delivery fee
> for orders within inner Hanoi and reject addresses outside this area.
> → implemented by U6 (basic flow step 4, alt flow 1).

Nhóm FR theo module để section 1 đọc như một "spec rút gọn" và sẽ được
trace tới use case ở section 2 và test case ở section 10. KHÔNG cần liệt
kê lại *toàn bộ* nội dung use case ở đây — chỉ liệt kê requirement ở mức
"điều hệ thống phải làm được", use case ở section 2 mới mô tả *cách*
tương tác.

### 1.5 Non-Functional Requirements (NFR)
Tổ chức theo 4 nhóm của slide, mỗi NFR viết theo dạng **verifiable**
(có số đo) khi có thể:

- **Product (performance/reliability/usability/portability)**
  - Ví dụ: "The cart total shall update within 1 second after a topping
    is added/removed."
  - "The system shall remain responsive for at least N concurrent users
    during lunch/dinner peak hours" (nếu chưa có số liệu thật, đánh
    `% TODO:` và hỏi nhóm).
  - "The storefront shall be usable on common desktop and mobile browser
    viewports" (responsive web — không có app riêng).
- **Organizational**
  - Timeline: 14 tuần (~3.5 tháng), theo "Estimated Project Duration".
  - Coding standards/CM: PEP8 (Python), ESLint/Prettier (TS) — liên kết
    sang section 8.
- **External**
  - Không tích hợp cổng thanh toán → giảm yêu cầu PCI; nhưng vẫn cần bảo
    vệ dữ liệu cá nhân khách hàng (tên, SĐT, địa chỉ) — nêu 1 NFR về data
    handling.
  - Tích hợp API bên thứ ba: cần xử lý timeout/lỗi (đã có alt flow trong
    K4 — tham chiếu lại ở đây cho nhất quán).
- **Cost/Infra constraint**: nêu ngắn estimated infra cost
  (0–1tr VND/tháng dev, 1–5tr VND/tháng MVP) như một constraint ảnh hưởng
  tới lựa chọn architecture (container hoá, modular monolith thay vì
  microservices).

### 1.6 Assumptions & Constraints
- Team có "some experience" với stack đã chọn → ảnh hưởng tới quyết định
  kiến trúc (đơn giản hoá) ở section 4.
- Delivery API có thể chưa sẵn sàng khi dev → giả định dùng mock service
  (liên kết sang section 8 & 10).
- Giả định 1 cửa hàng (single-tenant), không multi-store — nếu sai, cần
  sửa lại scope.

## Checklist review – Section 1

- [ ] Problem statement không copy nguyên văn từ feasibility doc (đã
      paraphrase).
- [ ] Stakeholder list không chỉ là Actors Summary thu nhỏ — có thêm
      development/computing staff.
- [ ] Scope (in/out) khớp 100% với `ProjectFeasibility.md` (không thêm/
      bớt feature ngoài tài liệu mà không hỏi).
- [ ] Mỗi FR có mã, actor, và (nếu có thể) tham chiếu use case sẽ hiện
      thực hoá nó — để section 2 trace ngược lại được.
- [ ] Mọi NFR được viết dưới dạng *verifiable* (có số đo hoặc tiêu chí
      pass/fail rõ ràng) — nếu không có số liệu thật, đánh `% TODO:` và
      hỏi người dùng, KHÔNG tự bịa số.
- [ ] Có đề cập rõ process model (iterative/middleweight) và lý do, vì
      các section sau (architecture, DB) sẽ dựa vào lập luận này để giải
      thích "tại sao làm DB/architecture sớm và chi tiết".
- [ ] Không có actor/module/tên nào khác với `00_glossary_and_context.md`
      (nếu có khái niệm mới, đã thêm vào glossary).
