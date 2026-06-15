# 00 – Glossary & Project Context (nguồn sự thật để giữ nhất quán)

File này là **bảng tra cứu chuẩn**. Mọi section trong báo cáo PHẢI dùng
đúng các tên/mã trong file này. Nếu một section cần thêm entity/module/
endpoint/use case mới, hãy:

1. Đề xuất tên theo đúng convention bên dưới.
2. Thêm vào bảng tương ứng trong file này (dùng `str_replace`).
3. Báo ngắn gọn cho người dùng: "đã thêm X vào glossary vì Y".

Tránh tạo 2 tên khác nhau cho cùng một khái niệm (ví dụ vừa gọi
"Pizza Catalog Service" vừa gọi "Menu Management Module" cho cùng một
thứ).

## 1. Tóm tắt hệ thống (1 đoạn, dùng để mở bài mọi section)

PizzaHUST là một web app cho một cửa hàng pizza tại Hà Nội, gồm 2 mảng
chính: (1) **storefront** cho khách (Guest/Customer) — xem menu, tuỳ
chỉnh pizza, đặt hàng COD, theo dõi đơn, tích điểm; (2) **back-office**
cho Admin/Store Owner và Kitchen Staff — quản lý catalog/combo/khách
hàng/đơn hàng, hàng đợi bếp, báo cáo. Hệ thống tích hợp với một dịch vụ
giao hàng bên thứ ba qua API để đặt lịch giao và đồng bộ trạng thái giao
hàng. MVP V1 chạy trên web, kiến trúc client-server, **modular
monolith** đóng gói Docker, không có cổng thanh toán online (chỉ COD),
không có app mobile riêng, không có portal riêng cho nhân viên giao
hàng (out of scope).

## 2. Actors (cố định — không đổi tên)

| Actor (canonical name) | Loại | Mô tả ngắn |
|---|---|---|
| `Guest` | Primary, External | Khách chưa đăng nhập, đặt COD, track bằng order code |
| `Customer` | Primary, External (registered) | Guest + login, order history, loyalty points |
| `Admin / Store Owner` | Primary, Internal | Quản lý catalog, combo, khách hàng, đơn, báo cáo |
| `Kitchen Staff` | Primary, Internal | Xử lý kitchen queue, cập nhật trạng thái chuẩn bị, xác nhận dispatch |
| `Third-Party Delivery` | Supporting, External | Nhận booking giao hàng, trả delivery reference & status qua API |

> Lỗi thường gặp (theo `Requirement_Analysis_Session_Assignment`): KHÔNG
> coi front-end là actor, KHÔNG coi back-end là "system", KHÔNG coi
> database là actor. "System" = toàn bộ PizzaHUST backend+frontend như
> một hộp đen.

## 3. Mã Use Case (canonical numbering)

Quy ước tiền tố: `U` = use case của Guest/Customer (storefront), `A` =
Admin/Store Owner, `K` = Kitchen Staff, `T` = Third-Party Delivery
(system-to-system). Số không cần liên tục tuyệt đối nhưng PHẢI giữ đúng
các mã đã dùng trong file use case đã nộp.

### Đã viết detail đầy đủ (trong `PizzaHUST_UseCase_Analysis_1_.docx`)

| Mã | Tên | Actor(s) |
|---|---|---|
| U6 | Place COD Order | Guest, Customer |
| U7 | Track Order | Guest, Customer |
| A1 | Manage Pizza Catalog | Admin |
| A4 | Manage Combo Campaigns | Admin |
| K4 | Mark Order Ready for Dispatch | Kitchen Staff, Third-Party Delivery |

### Được tham chiếu, CHƯA viết detail

| Mã | Tên (đề xuất) | Quan hệ |
|---|---|---|
| U13 | Redeem Loyalty Points | `<extend>` của U6 (bước 5) |
| T2 | Sync Delivery Status | `<include>` trong U7 (bước 6) |

### Đề xuất các mã còn trống (CHỈ thêm vào use case diagram / viết
detail khi người dùng xác nhận cần — không tự ý viết spec đầy đủ cho
các mã này nếu không được yêu cầu, nhưng CÓ THỂ dùng các mã này khi viết
user stories / API / DB để mọi thứ khớp nhau)

| Mã | Tên (đề xuất) | Actor(s) | Ghi chú |
|---|---|---|---|
| U1 | Browse Menu / Categories | Guest, Customer | gồm vegetarian & kids menu |
| U2 | View Item Detail | Guest, Customer | pizza, side dish, combo |
| U3 | Customize Pizza | Guest, Customer | size/crust/topping, live price |
| U4 | Manage Cart | Guest, Customer | add/update/remove |
| U5 | Browse Combo Promotions | Guest, Customer | hiển thị combo theo khung giờ |
| U8 | Register Account | Guest | tạo Customer account |
| U9 | Login | Customer | |
| U10 | View Order History | Customer | |
| U11 | Manage Profile | Customer | |
| A2 | Manage Side Dishes | Admin | tương tự A1 |
| A3 | Manage Menus & Categories | Admin | appetizer/main/dessert/vegetarian/kids |
| A5 | Manage Customer Accounts | Admin | |
| A6 | Manage Orders / Manual Delivery Retry | Admin | alt flow 1 của K4 |
| A7 | View Sales & Financial Reports | Admin | |
| K1 | View Kitchen Queue | Kitchen Staff | |
| K2 | Update Preparation Status | Kitchen Staff | Pending→Preparing→Completed |
| K3 | Prioritize Kitchen Queue | Kitchen Staff | |
| T1 | Create Delivery Booking | (system→3rd party) | xảy ra trong bước 5 của K4 |

> Nếu người dùng yêu cầu viết thêm use case detail cho các mã ở bảng 3,
> dùng đúng mã/tên này trừ khi người dùng muốn đổi — và nếu đổi, cập
> nhật lại bảng này.

## 4. Module / Component (Logical View — dùng cho section 4 & 5)

| Module (canonical) | Trách nhiệm chính | Use case liên quan |
|---|---|---|
| Catalog Module | Pizza, size, crust, topping, side dish, category CRUD & query | A1, A2, A3, U1–U3 |
| Combo Module | Tạo/lên lịch combo, validate giá & ngày | A4, U5 |
| Cart & Ordering Module | Cart, pricing engine, checkout, order creation | U3–U6, U13 |
| Order Tracking Module | Trạng thái & timeline đơn hàng | U7 |
| Kitchen Queue Module | Hàng đợi bếp, trạng thái chuẩn bị, dispatch | K1–K4 |
| Delivery Integration Module | Adapter gọi API bên thứ 3, nhận webhook | K4(5–7), T1, T2 |
| Customer & Loyalty Module | Account, order history, loyalty points | U8–U13, A5 |
| Reporting Module | Thống kê doanh thu/đơn hàng | A7 |
| Auth & Access Control | Đăng nhập, JWT, phân quyền theo actor | cross-cutting |

## 5. Entity DB chính (đề xuất canonical — chốt lại ở section 6)

`customers`, `staff` (admin/kitchen, có cột `role`), `categories`,
`pizzas`, `pizza_sizes`, `crusts`, `toppings`, `topping_prices`,
`side_dishes`, `combos`, `combo_items`, `orders`, `order_items`,
`order_item_toppings`, `order_status_history`, `kitchen_queue`,
`delivery_bookings`, `loyalty_transactions`.

Chi tiết cột, khoá, kiểu dữ liệu → `references/06_database_design.md`.
Khi section 6 chốt schema thật, **đồng bộ lại danh sách này**.

## 6. API resource naming (đề xuất canonical — chốt ở section 9)

Base path: `/api/v1`. Tài nguyên dùng danh từ số nhiều, kebab/snake nếu
nhiều từ: `categories`, `pizzas`, `side-dishes`, `combos`, `cart`,
`orders`, `auth`, `customers/me`, `admin/pizzas`, `admin/combos`,
`admin/customers`, `admin/orders`, `admin/reports`, `kitchen/orders`,
`delivery/webhook`.

## 7. Thuật ngữ / chính tả cần giữ thống nhất

- "Cash on delivery (COD)" — không viết "tiền mặt khi nhận hàng" trong
  báo cáo tiếng Anh.
- "Inner Hanoi delivery fee" = 22,000 VND (cố định, theo `Topic.md`).
- Crust: "crispy crust" / "soft (traditional) crust" — cả hai **free**
  (không cộng giá).
- Pizza sizes: `S`, `M`, `L` — mỗi size có giá pizza riêng VÀ giá
  topping riêng (theo `Topic.md`: "thêm topping ... với giá khác nhau
  tuỳ loại kích cỡ").
- Toppings nêu trong đề: extra cheese topping (`extra cheese`), edge
  cheese (`cheese-stuffed crust` / "extra cheese in the rim" — gọi là
  `edge cheese topping`), double sauce cho "một số loại đặc biệt"
  (`double sauce`, chỉ áp dụng cho pizza đặc biệt — cần điều kiện
  `applicable_pizza_ids` hoặc cờ `is_special`).
- Order code format: `PIZZ-XXXXXX` (uppercase letters + digits), ví dụ
  `PIZZ-AB1234`.
- Order status pipeline (theo U7 output data): `Received → Preparing →
  Ready for Dispatch → Delivering → Delivered / Delivery Failed`.
- Kitchen-side status (theo K4): order phải ở `Completed` trước khi
  Kitchen Staff confirm dispatch → chuyển `Ready for Dispatch`. Cần làm
  rõ trong DB design: `Completed` (kitchen-internal) khác với
  `Preparing`/`Ready for Dispatch` (customer-facing) — đề xuất cột
  `kitchen_status` riêng với `order_status` khách thấy, map 1-nhiều.
