# Kế hoạch PizzaHust Sau Giai Đoạn Feasibility và Use Case

## 1. Mục tiêu của kế hoạch

Tài liệu này cập nhật lại kế hoạch triển khai PizzaHust sau khi nhóm đã hoàn thành phần feasibility và general use case diagram. Kế hoạch mới bám theo MVP đã refine, ưu tiên hoàn thiện `UI/UX + ERD + flow đặc tả` trong 2 tuần tới, sau đó chuyển dần sang thiết kế kỹ thuật, code, kiểm thử và demo theo hướng Agile.

Điểm thay đổi quan trọng:

- Không tính lại feasibility và general use case diagram vào tuần làm việc tiếp theo
- Không phân công riêng task viết report trong weekly plan
- `Nguyễn Xuân Chí Thành` được xem là resource chính thức cho mảng `UI/UX` cùng `Trần Hoàng`
- MVP chính không bao gồm `AI recommendation`
- Kitchen flow được chuẩn hóa theo logic `Kitchen Order Queue`

## 2. Phạm vi MVP đã khóa

### 2.1 Các chức năng nằm trong MVP

- Duyệt menu và xem chi tiết món
- Tùy chỉnh pizza theo size, crust type và topping
- Quản lý giỏ hàng
- Checkout và thanh toán bằng tiền mặt khi nhận hàng
- Guest checkout và theo dõi đơn bằng mã đơn
- Customer login/register, lịch sử đơn hàng, loyalty points, đổi điểm khi checkout
- Admin quản lý pizza, topping, món ăn kèm, category, combo campaign, đơn hàng, khách hàng
- Kitchen order queue, xử lý đơn ưu tiên, cập nhật trạng thái chuẩn bị, bàn giao giao vận
- Tích hợp dịch vụ giao hàng bên thứ ba
- Báo cáo cơ bản về đơn hàng và doanh thu

### 2.2 Các mục ngoài phạm vi MVP

- Online payment gateway
- Cổng quản lý shipper nội bộ
- AI recommendation widget
- Advanced analytics hoặc BI dashboard
- Multi-branch support

## 3. Vai trò và phân công chính

| Thành viên | Vai trò chính | Trách nhiệm trọng tâm |
|---|---|---|
| Mai Văn Nhật Minh | Technical Lead | Kiến trúc hệ thống, review tích hợp, chốt module boundary, điều phối release |
| Tạ Quốc Hùng | Backend Lead | Order flow, kitchen order queue, delivery integration, nghiệp vụ lõi |
| Nguyễn Xuân Chí Thành | Product/UX Support | Đồng thiết kế UI/UX, rà use case, kiểm tra acceptance flow, hỗ trợ refine trải nghiệm |
| Ngô Mạnh Hiếu | Database and Reporting Lead | ERD, schema, migration direction, reporting query, dữ liệu demo |
| Trần Hoàng | Frontend and UI Lead | Dẫn dắt UI/UX, component inventory, frontend implementation direction, responsive behavior |

### 3.1 Nguyên tắc phối hợp

- Mỗi module phải có một người sở hữu chính và ít nhất một người hỗ trợ
- `Hoàng + Chí Thành` là cặp ưu tiên cho các đầu việc liên quan `wireflow`, `screen behavior`, `UX consistency`, `component naming`
- `Nhật Minh + Quốc Hùng` là cặp ưu tiên cho các đầu việc liên quan `order lifecycle`, `kitchen queue`, `delivery integration`
- `Hiếu` cần tham gia sớm từ giai đoạn UI/flow để bảo đảm không lệch thiết kế dữ liệu
- Không tạo task riêng kiểu `viết report`; chỉ giữ các task phục vụ sản phẩm như `use case alignment`, `acceptance flow`, `UI/UX review`, `backlog refinement`

## 4. Kế hoạch 10 tuần

## Tuần 1: 23/03/2026 - 29/03/2026

### Mục tiêu chính

Hoàn thiện `full UI/UX` cho toàn bộ MVP và chốt `ERD v1`.

### Deliverables

- Bộ screen đầy đủ cho guest, customer, admin, kitchen
- User flow và screen flow hoàn chỉnh
- Design guideline cơ bản cho màu sắc, typography, component reuse
- ERD v1, danh sách bảng, quan hệ chính, bảng trung gian
- Mapping giữa `use case -> screen -> bảng dữ liệu`

### Phân công

| Thành viên | Công việc chính |
|---|---|
| Mai Văn Nhật Minh | Review screen flow theo logic hệ thống, chốt module boundary mức cao giữa frontend/backend/DB, rà tính nhất quán giữa UI flow và use case |
| Tạ Quốc Hùng | Đặc tả flow cart, checkout, kitchen order queue, delivery handoff; xác định order states và điều kiện chuyển trạng thái; hỗ trợ Hiếu chốt entity liên quan order |
| Nguyễn Xuân Chí Thành | Đồng thiết kế UI/UX cùng Hoàng cho các màn hình customer-facing; rà use case để không thiếu screen hay flow; hỗ trợ chuẩn hóa tên màn hình, thao tác, trạng thái nghiệp vụ |
| Ngô Mạnh Hiếu | Thiết kế ERD v1; liệt kê bảng, khóa chính/ngoại, bảng loyalty, bảng tracking, bảng combo; chốt data dictionary bản đầu |
| Trần Hoàng | Dẫn dắt full UI/UX cho toàn bộ screen MVP; phân chia phần việc UI với Chí Thành; chuẩn bị prototype và wireflow để team review |

### Deadline

- Review giữa tuần: `Thứ năm 26/03/2026`
- Chốt tuần: `Chủ nhật 29/03/2026`

### Exit criteria

- Không còn screen nào của MVP bị thiếu
- ERD đủ rõ để bắt đầu tách API/module
- Team thống nhất order states, kitchen queue logic, loyalty logic ở mức MVP

## Tuần 2: 30/03/2026 - 05/04/2026

### Mục tiêu chính

Chuyển từ thiết kế sang đặc tả kỹ thuật và chuẩn bị code.

### Deliverables

- UI/UX final sau review
- ERD v2 đã chốt
- API/module list
- Flow spec cho các nghiệp vụ chính
- Backlog implementation theo ưu tiên
- Kế hoạch bắt đầu code từ tuần kế tiếp

### Phân công

| Thành viên | Công việc chính |
|---|---|
| Mai Văn Nhật Minh | Chốt kiến trúc hệ thống và cấu trúc project; định nghĩa module/backend boundary, convention API, auth/role strategy; rà dependency giữa frontend và backend |
| Tạ Quốc Hùng | Viết flow spec cho order lifecycle, checkout, kitchen queue, delivery synchronization; xác định case lỗi và case chặn nghiệp vụ cần xử lý sớm |
| Nguyễn Xuân Chí Thành | Hỗ trợ refine UI/UX sau review; chuẩn hóa screen naming, component naming, user flow wording; cùng Hoàng chốt screen spec để frontend code không phải đoán |
| Ngô Mạnh Hiếu | Cập nhật ERD v2; đề xuất migration order, seed data structure, reporting query direction; chốt mapping `screen/form -> bảng/cột dữ liệu` |
| Trần Hoàng | Hoàn thiện mockup/prototype fidelity cao; tạo component inventory cho frontend; chốt asset/layout spec và handoff cho giai đoạn code |

### Deadline

- Review giữa tuần: `Thứ năm 02/04/2026`
- Chốt tuần: `Chủ nhật 05/04/2026`

### Exit criteria

- Có thể bắt đầu code mà không phải đoán screen, bảng dữ liệu, hay flow nghiệp vụ
- API contract và data contract mức đầu đủ để backend/frontend làm song song
- Backlog tuần 3-4 được sắp theo ưu tiên rõ ràng

## Tuần 3-4: 06/04/2026 - 19/04/2026

### Trọng tâm

- Setup project skeleton
- Thiết lập auth và role
- Hoàn thiện catalog/menu foundation
- Tạo base schema, migration, seed data
- Dựng frontend shell và routing chính

### Phân công chính

| Thành viên | Công việc trọng tâm |
|---|---|
| Nhật Minh | Kiến trúc codebase, nền tảng dự án, review tích hợp |
| Quốc Hùng | Catalog service, cart skeleton, order state model |
| Chí Thành | Hỗ trợ UI refinement, acceptance flow, rà độ khớp giữa flow và giao diện |
| Mạnh Hiếu | Migration, seed, schema refinement |
| Trần Hoàng | Frontend shell, menu pages, product detail page, cart UI base |

## Tuần 5-6: 20/04/2026 - 03/05/2026

### Trọng tâm

- Hoàn thiện cart và COD checkout
- Hoàn thiện guest tracking và customer account flow
- Triển khai loyalty points
- Triển khai kitchen order queue
- Hoàn thiện admin order monitoring cơ bản

### Phân công chính

| Thành viên | Công việc trọng tâm |
|---|---|
| Nhật Minh | Review flow checkout, giữ consistency hệ thống |
| Quốc Hùng | Implement checkout, order creation, kitchen queue logic |
| Chí Thành | Hỗ trợ UI/UX cho checkout, tracking, account flow; kiểm tra trải nghiệm người dùng theo use case |
| Mạnh Hiếu | Schema cho order, loyalty, reporting |
| Trần Hoàng | Checkout UI, auth UI, account UI, tracking UI, kitchen UI |

## Tuần 7-8: 04/05/2026 - 17/05/2026

### Trọng tâm

- Admin management
- Combo/category management
- Delivery integration
- Basic reports
- Responsive refinement

### Phân công chính

| Thành viên | Công việc trọng tâm |
|---|---|
| Nhật Minh | Integration review, xử lý điểm nghẽn |
| Quốc Hùng | Delivery API/mock integration, error handling |
| Chí Thành | Hỗ trợ UI/UX cho admin flow, rà soát hành vi thực tế với use case |
| Mạnh Hiếu | Reporting queries, dữ liệu demo, tối ưu schema sử dụng |
| Trần Hoàng | Admin screens, reporting views, polish responsive UI |

## Tuần 9-10: 18/05/2026 - 31/05/2026

### Trọng tâm

- Test tích hợp
- Sửa lỗi
- UAT nội bộ
- Chốt demo flow
- Chốt môi trường demo và tài liệu hỗ trợ thuyết trình

### Phân công chính

| Thành viên | Công việc trọng tâm |
|---|---|
| Nhật Minh | Code freeze, release coordination, deployment/demo environment |
| Quốc Hùng | Fix bug nghiệp vụ và integration |
| Chí Thành | Hỗ trợ UAT, rà soát user flow demo, kiểm tra độ mượt của trải nghiệm |
| Mạnh Hiếu | Data integrity, report accuracy, demo dataset |
| Trần Hoàng | UI polish, demo-critical screens, visual materials |

## 5. Phân chia ownership theo module

| Module | Owner chính | Owner hỗ trợ |
|---|---|---|
| Kiến trúc hệ thống và tích hợp | Mai Văn Nhật Minh | Tạ Quốc Hùng |
| Order flow, kitchen queue, delivery integration | Tạ Quốc Hùng | Mai Văn Nhật Minh |
| UI/UX tổng thể và frontend implementation direction | Trần Hoàng | Nguyễn Xuân Chí Thành |
| UX consistency, screen behavior, acceptance flow | Nguyễn Xuân Chí Thành | Trần Hoàng |
| Database, migration, reporting | Ngô Mạnh Hiếu | Tạ Quốc Hùng |
| Admin module | Ngô Mạnh Hiếu | Trần Hoàng |

## 6. Rủi ro chính và hướng giảm thiểu

| Rủi ro | Mức ảnh hưởng | Hướng giảm thiểu |
|---|---|---|
| UI/UX và use case lệch nhau | Cao | Chốt mapping `use case -> screen -> data` ngay trong Tuần 1 |
| Frontend và backend lệch contract | Cao | Khóa API/module list và flow spec trong Tuần 2 |
| Kitchen queue logic không rõ | Cao | Đặc tả order states, priority rules, handoff rules ngay từ Tuần 1 |
| Delivery API không ổn định | Trung bình | Làm mock integration trước, tách rõ retry và fallback handling |
| DB thiết kế muộn hoặc phải sửa lớn | Cao | Hoàn tất ERD v1 trong Tuần 1 và ERD v2 trong Tuần 2 |
| Dồn quá nhiều code về cuối kỳ | Cao | Xen kẽ DB, backend, frontend ngay từ Tuần 3 thay vì làm tuần tự cứng |

## 7. Công cụ khuyến nghị

- `Figma` hoặc `Draw.io`: use case diagram, screen flow, UI mockup
- `MySQL Workbench`: ERD và schema design
- `GitHub` hoặc `GitLab`: source control và issue tracking
- `Jira`, `Trello` hoặc `Notion`: sprint board và theo dõi đầu việc
- `Postman` hoặc `Bruno`: kiểm tra API
- `Discord`, `Zalo` hoặc `Messenger`: trao đổi nội bộ

## 8. Kết luận

Kế hoạch mới xem feasibility và general use case diagram là phần đã hoàn tất, sau đó dồn lực ngay vào `UI/UX + ERD + flow đặc tả` trong 2 tuần đầu để tạo nền tảng chắc cho giai đoạn code. Cách chia việc này giúp nhóm tránh tình trạng vừa code vừa đoán màn hình, đoán dữ liệu, hoặc đổi logic nghiệp vụ quá muộn.

Nếu giữ đúng mốc review cuối tuần và bám phạm vi MVP đã khóa, PizzaHust vẫn là một đồ án khả thi trong khung 10 tuần còn lại, đồng thời đủ linh hoạt để cập nhật yêu cầu theo mô hình Agile.
