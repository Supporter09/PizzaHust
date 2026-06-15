---
name: swe-report-pizzahust
description: "Use this skill whenever the user is writing, drafting, expanding, restructuring, or reviewing the LaTeX final report for their IT3180 - Introduction to Software Engineering (HUST SOICT) project, PizzaHUST (online pizza ordering & store management web app). Trigger this for ANY of the 10 required report sections - system requirements & problem analysis, use-case analysis, user stories, system architecture, component architecture & design, database design, user interface design, component implementation, API design & implementation, testing & evaluation - even if the user only mentions one section, asks for a diagram, asks to fix consistency/terminology across sections, asks for a LaTeX template/table (e.g. use-case specification table, ER diagram, API table), or asks to review/critique a draft against the course rubric. Also trigger for requests like 'viet tiep phan...', 'lam ho minh use case', 've so do kien truc', 'thiet ke database cho PizzaHUST', 'review lai chuong nay', or any mention of PizzaHUST, IT3180, or the report's section list."
---

# Viết & review báo cáo LaTeX môn IT3180 (PizzaHUST)

Skill này giúp viết, mở rộng và review từng phần của báo cáo cuối kỳ môn
**IT3180 – Introduction to Software Engineering** (HUST SOICT) cho dự án
**PizzaHUST** (web app đặt pizza online + quản lý cửa hàng), sao cho:

1. Đúng **khung kiến thức** đã học trong môn (Requirement Analysis,
   Requirement Modeling, 4+1 view, v.v. – xem `references/`).
2. Bám sát **bối cảnh dự án thật** (PizzaHUST), không viết chung chung.
3. **Nhất quán** giữa các phần (actor, mã use case, tên module, tên bảng
   DB, tên API...).
4. Có **checklist review** cho từng phần trước khi coi là "xong".
5. Xuất ra **LaTeX** sạch, dùng template có sẵn trong `assets/latex/`.

Đọc kỹ phần "Cách dùng skill" trước khi viết bất cứ nội dung nào.

## Bối cảnh dự án PizzaHUST (luôn ghi nhớ)

- **Hệ thống**: Web app đặt pizza online + quản lý cửa hàng cho một quán
  pizza tại Hà Nội (nguồn: `/mnt/project/Topic.md`,
  `/mnt/project/ProjectFeasibility.md`).
- **Stack**: Frontend Next.js + Tailwind CSS, Backend Python FastAPI,
  DB MySQL, RESTful API, đóng gói Docker, deploy AWS/VPS, kiến trúc
  **modular monolith** (không microservices).
- **Actors** (đã thống nhất trong use-case analysis):
  - **Guest** – khách chưa đăng nhập, đặt hàng kèm order code.
  - **Customer** – khách đã đăng ký, có order history & loyalty points.
  - **Admin / Store Owner** – quản lý catalog, combo, khách hàng, đơn,
    báo cáo.
  - **Kitchen Staff** – xử lý hàng đợi bếp, cập nhật trạng thái chuẩn bị.
  - **Third-Party Delivery** – actor hỗ trợ bên ngoài (API giao hàng).
- **5 use case đã viết chi tiết** (file
  `PizzaHUST_UseCase_Analysis(1).docx`, format theo
  `Use Case - Detail - Template.docx`):
  - **U6** – Place COD Order (Guest, Customer)
  - **A1** – Manage Pizza Catalog (Admin)
  - **K4** – Mark Order Ready for Dispatch (Kitchen Staff, Third-Party
    Delivery)
  - **A4** – Manage Combo Campaigns (Admin)
  - **U7** – Track Order (Guest, Customer)
  - Các use case được tham chiếu nhưng chưa viết detail: **U13** (Redeem
    loyalty points – extend của U6), **T2** (Delivery status sync –
    include trong U7). Nếu cần đầy đủ hệ thống (không chỉ 5 use case nộp
    cho buổi presentation), có thể cần viết thêm use case cho: đăng
    ký/đăng nhập, quản lý combo cho khách (Browse Combo), quản lý khách
    hàng (Admin), xem báo cáo doanh thu (Admin), v.v. — hỏi người dùng
    trước khi tự thêm use case mới.

File `references/00_glossary_and_context.md` chứa **bảng tên chuẩn**
(actor, module, entity DB, resource API...) — đây là "nguồn sự thật" để
giữ mọi phần nhất quán. Khi tạo thực thể/module/API mới, **luôn cập nhật
bảng này** và báo cho người dùng.

## Cấu trúc báo cáo (10 phần bắt buộc)

| # | Section (đề bài yêu cầu) | File hướng dẫn chi tiết |
|---|---|---|
| 1 | System requirements and problem analysis | `references/01_requirements_and_problem_analysis.md` |
| 2 | Use-case analysis | `references/02_usecase_analysis.md` |
| 3 | User stories | `references/03_user_stories.md` |
| 4 | System architecture | `references/04_system_architecture.md` |
| 5 | Component architecture and design | `references/05_component_design.md` |
| 6 | Database design | `references/06_database_design.md` |
| 7 | User interface design | `references/07_ui_design.md` |
| 8 | Component implementation | `references/08_component_implementation.md` |
| 9 | API design and implementation | `references/09_api_design.md` |
| 10 | Testing and evaluation | `references/10_testing_evaluation.md` |

Mỗi file trong `references/` có 3 phần giống nhau:
- **Khung lý thuyết** (theo slide IT3180 – trích từ
  `8__requirement_analysis*.pdf`, `9__Requirement_Modeling.pdf`,...)
- **Áp dụng cho PizzaHUST** (nội dung cụ thể, gợi ý dựa trên
  `ProjectFeasibility.md`, `Topic.md`, use case đã có)
- **Checklist review** riêng cho phần đó

`references/review_checklist.md` là checklist **tổng** (cross-section),
dùng khi người dùng yêu cầu "review toàn bộ báo cáo" hoặc trước khi nộp.

`references/latex_writing_guide.md` là quy ước LaTeX chung (numbering,
figure/table, label/ref, code listing, terminology) áp dụng cho mọi
phần.

## Cách dùng skill

1. **Xác định phần đang làm.** Nếu người dùng không nói rõ, hỏi (1 câu,
   dùng `ask_user_input_v0` nếu hợp lý) hoặc suy luận từ ngữ cảnh.
2. **Đọc file reference tương ứng** trước khi viết — đừng tự bịa khung
   lý thuyết, vì giảng viên chấm theo khung của môn.
3. **Kiểm tra `00_glossary_and_context.md`** để dùng đúng tên
   actor/module/entity/API đã thống nhất. Nếu nội dung mới phát sinh
   tên mới (ví dụ thêm một entity DB, một module mới), cập nhật file
   này (qua `str_replace`) và nói rõ với người dùng đã thêm gì.
4. **Viết nội dung bằng LaTeX**, dùng template trong `assets/latex/`:
   - `assets/latex/main.tex` — khung tài liệu, `\input` từng section.
   - `assets/latex/preamble.tex` — các package cần dùng.
   - `assets/latex/sections/0X_*.tex` — mỗi phần một file. Phần 2
     (`02_use_case_analysis.tex`) đã có sẵn 5 use case viết theo
     template mới — dùng làm mẫu cho use case mới.
   - `assets/latex/usecase_template.tex` — macro/environment
     `\begin{usecase}...\end{usecase}` để viết use case spec đúng format
     Word template (longtable cho alternative flows / input / output).
   - Ngôn ngữ nội dung báo cáo: **tiếng Anh** (giống các tài liệu use
     case đã có). Nếu người dùng muốn tiếng Việt, hỏi lại trước khi đổi
     toàn bộ.
5. **Sau khi viết xong một đoạn/section**, tự chạy qua checklist review
   của phần đó (cuối file reference) — nêu rõ các điểm đã tự kiểm tra,
   và các điểm người dùng cần xác nhận (ví dụ số liệu nghiệp vụ, giá
   tiền, tên thật của team).
6. **Nếu được yêu cầu "review"** (không phải viết mới): đọc nội dung
   hiện có, áp checklist phần đó + checklist tổng, trả lời theo dạng
   "✅ đạt / ⚠️ cần sửa / ❌ thiếu" + lý do ngắn — KHÔNG dùng bullet khi
   từ chối, nhưng review checklist thì dùng bảng/list là hợp lý vì đây
   là nội dung có cấu trúc.
7. **Khi tạo diagram** (use case diagram, ER diagram, sequence diagram,
   component diagram, deployment diagram): ưu tiên **PlantUML** hoặc
   **Mermaid** (text-based, dễ version control, dễ chỉnh), xuất file
   `.puml`/`.mmd` cùng hướng dẫn render, hoặc dùng Visualizer
   (`visualize:show_widget`) để preview nhanh trước khi chốt rồi mới
   convert sang ảnh để `\includegraphics` trong LaTeX. Đừng vẽ ASCII art
   trong LaTeX.
8. Nếu cần xem lại nguyên văn các file dự án, đường dẫn:
   - `/mnt/project/ProjectFeasibility.md`
   - `/mnt/project/Topic.md`
   - `/mnt/project/PizzaHUST_UseCase_Analysis_1_.docx`
   - `/mnt/project/Use_Case_-_Detail_-_Template.docx`
   - `/mnt/project/Requirement_Analysis_Session_Assignment`
   - Slide deck (ảnh đã giải nén nếu cần xem lại):
     `8__requirement_analysis.pdf`, `9__Requirement_Modeling.pdf`,
     `7__project_management.pdf`, `17__Configuration_Management.pdf`.

## Thứ tự viết khuyến nghị

Không bắt buộc viết theo đúng thứ tự 1→10, nhưng có phụ thuộc logic —
xem `references/review_checklist.md` mục "Thứ tự viết & phụ thuộc" để
biết phần nào nên xong trước phần nào (ví dụ: Database design và System
architecture nên có bản nháp trước khi viết Component design, API
design, Component implementation).

## Lưu ý khi viết (giọng văn báo cáo học thuật)

- Văn phong báo cáo: khách quan, mạch lạc, có lý do ("we chose X because
  Y"), không quảng cáo ("hệ thống tuyệt vời nhất").
- Mỗi hình/bảng phải có **caption + label**, và được **tham chiếu trong
  văn bản** (`Figure~\ref{...}`, `Table~\ref{...}`) — không thả hình
  "trôi" không giải thích.
- Mọi yêu cầu (requirement), use case, user story, API endpoint, test
  case nên có **mã định danh** để dễ trace (xem
  `00_glossary_and_context.md` cho quy ước đặt mã).
- Khi có giả định/số liệu chưa chốt (giá pizza, % loyalty point, SLA...),
  đánh dấu rõ bằng `% TODO:` trong LaTeX và nói với người dùng — không tự
  bịa số liệu nghiệp vụ quan trọng rồi coi là final.
