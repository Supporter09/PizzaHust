# 03 – User Stories

## Khung lý thuyết

Slide requirement analysis không trình bày user story trực tiếp, nhưng
đặt nền: phần "Lightweight Processes: Agile Development" nói **mỗi
sprint có requirement riêng** và "working code dùng để verify
requirement". User story là công cụ chuẩn để chia requirement thành các
đơn vị nhỏ, ước lượng và lên kế hoạch sprint — bổ sung cho use case
(use case = mô tả tương tác đầy đủ; user story = đơn vị công việc nhỏ,
có thể đưa vào 1 sprint).

Format chuẩn:

> **As a** `<role>`, **I want** `<goal>` **so that** `<benefit>`.

Kèm **Acceptance Criteria** (Given/When/Then hoặc bullet "Done when...")
— đây là phần quan trọng nhất vì nó **verifiable** (liên kết với NFR ở
section 1 và test case ở section 10).

Nguyên tắc **INVEST**: Independent, Negotiable, Valuable, Estimable,
Small, Testable — dùng để tự kiểm tra mỗi story trước khi đưa vào bảng.

## Áp dụng cho PizzaHUST

### Quan hệ User Story ↔ Use Case
- Một use case lớn (ví dụ U6 Place COD Order) thường tách thành **nhiều
  user story nhỏ** theo các bước trong basic flow (ví dụ: nhập thông tin
  giao hàng, áp dụng phí ship, redeem điểm, submit order, nhận order
  code).
- Một số user story KHÔNG cần use case riêng (ví dụ: lọc menu theo
  "vegetarian"/"kids" — chỉ là 1 story nhỏ thuộc U1 Browse Menu).
- Mỗi story nên có cột "Related Use Case" trỏ về mã ở
  `00_glossary_and_context.md` §3. Nếu story không khớp use case nào,
  có thể đó là dấu hiệu thiếu use case (báo cho người dùng) hoặc story
  quá nhỏ/kỹ thuật (OK, vẫn để trống cột này).

### Tổ chức theo Epic (nhóm theo module ở §4 glossary)
Đề xuất nhóm user story thành các epic trùng với module, để section 3
"soi gương" section 4/5:

- **Epic: Storefront Browsing & Customization** (U1–U3)
- **Epic: Cart & Checkout** (U4, U6, U13)
- **Epic: Order Tracking** (U7, T2)
- **Epic: Account & Loyalty** (U8–U11, U13)
- **Epic: Catalog Management** (A1–A3)
- **Epic: Combo & Promotion Management** (A4)
- **Epic: Kitchen Operations** (K1–K4)
- **Epic: Delivery Integration** (K4, T1, T2)
- **Epic: Reporting** (A7)

### Ví dụ story (rút từ U6, để minh hoạ mức độ chi tiết mong đợi)

> **US-ORD-12**: As a **Guest**, I want to **enter my recipient name,
> phone number, delivery address, and an optional note**, so that **the
> store can deliver my order correctly**.
>
> *Acceptance criteria*
> - Given the form is shown, when phone number does not match Vietnamese
>   mobile format (10 digits, starting 03/07/08/09), then the field is
>   highlighted with a validation error and the form is not submitted.
> - Given a valid delivery address outside inner Hanoi, when the user
>   submits, then the system shows "address not supported" and stays on
>   step 3.
> - Given all fields valid, when submitted, then the system proceeds to
>   apply the 22,000 VND delivery fee and show the updated total.
>
> *Related use case*: U6 (steps 2–4, alt flows 1–2). *Priority*: Must
> have (MVP). *Estimate*: 3 story points (đánh giá, hỏi nhóm nếu cần số
> thật).

### Bảng tổng hợp (LaTeX longtable)
Cột đề xuất: `ID`, `As a... / I want... / so that...` (1 ô, có thể wrap),
`Acceptance Criteria` (liệt kê ngắn, 2–4 bullet), `Related Use Case`,
`Priority` (Must/Should/Could — MoSCoW, vì dễ giải thích hơn Fibonacci
cho báo cáo), `Sprint/Phase` (tuỳ chọn — nếu báo cáo có lịch sprint thì
điền, nếu không thì bỏ cột này, đừng bịa).

### Mức độ chi tiết phù hợp
- Mục tiêu: bao phủ **toàn bộ MVP feature list** trong
  `ProjectFeasibility.md`, không chỉ 5 use case đã viết detail.
- Story KHÔNG cần dài như use case — 1–3 acceptance criteria là đủ cho
  story nhỏ; story phức tạp (map tới use case có nhiều alt flow) có thể
  tách thành 2–3 story con thay vì 1 story to với 6+ tiêu chí.
- Tránh trùng lặp: nếu acceptance criteria của 1 story chỉ là chép lại
  basic flow của use case mà không thêm gì, story đó nên gộp/bỏ — user
  story phải *bổ sung* góc nhìn "Definition of Done" cho dev, không phải
  bản tóm tắt use case.

## Checklist review – Section 3

- [ ] Mỗi story đúng format "As a / I want / so that" — role là 1 trong
      5 actor canonical (không có role mới chưa có trong glossary).
- [ ] Mỗi story có ≥1 acceptance criterion **verifiable** (có thể viết
      thành test case ở section 10).
- [ ] Story bao phủ toàn bộ MVP feature list trong
      `ProjectFeasibility.md` — không thiếu mảng lớn nào (ví dụ nếu
      thiếu hẳn epic "Loyalty" hoặc "Reporting", cần bổ sung).
- [ ] Story áp dụng INVEST (đặc biệt "Small" và "Testable") — không có
      story dài như 1 đặc tả use case.
- [ ] Cột "Related Use Case" dùng đúng mã ở
      `00_glossary_and_context.md` §3; nếu cần mã mới, đã thêm vào
      glossary.
- [ ] Không bịa số liệu (sprint number, story point) nếu nhóm chưa chốt
      — đánh `% TODO:` và hỏi, hoặc bỏ cột.
