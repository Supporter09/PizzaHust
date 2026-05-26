# Prompt hướng dẫn cập nhật `feature_list.json` cho PizzaHUST

> File này là **prompt template** để gửi cho Claude (hoặc bất kỳ AI coding assistant nào)
> khi bạn cần đồng bộ `feature_list.json` với Use Case Diagram và bộ Use Case Detail mới.
> Copy nguyên block dưới đây vào chat và đính kèm file cần thiết.

---

## Bối cảnh dự án

PizzaHUST là webapp đặt pizza COD, làm trong môn học. Stack: **Next.js + FastAPI + MySQL + Docker Compose**.
Source of truth cho task tracking là `Application/feature_list.json` — mọi feature đều có `id`, `name`,
`depends_on`, `status`, `owner`, `evidence`.

Pattern id (theo invariant):
- `infra-NNN` cho hạ tầng (auth, db, openapi…)
- `UN` cho use case của Guest/Customer
- `AN` cho Admin
- `KN` cho Kitchen Staff
- `TN` cho external Third-Party Delivery integration

5 owner cố định: `Minh`, `Thanh`, `Hieu`, `Hung`, `Hoang` (viết không dấu trong JSON để tránh trục trặc trên CI/Windows).

---

## Phạm vi đã chốt cho sprint hiện tại (17/05/2026 → 07/06/2026)

### Out-of-scope (không implement)
- **Nhánh AI Recommendation**: actor `AI Recommendation Service`, use case `AI1: Generate Personalized Menu Recommendation`, và `U10: Get AI Menu Recommendation` (extends U9).
- Lý do: chốt scope 3 tuần cho phần lõi (Ordering + Kitchen + Delivery + Admin). AI để sprint sau.
- Vị trí ID `U10` được **giữ trống** trong feature_list.json để khi nào add AI thì khớp lại với diagram, không phải renumber lần nữa.

### Use Case Diagram mới đã có những thay đổi sau so với `feature_list.json` ngày 02/05

#### 1. Đánh số lại nhánh Customer
| Cũ  | Mới  | Tên                          |
|-----|------|------------------------------|
| U10 | U11  | View Order History           |
| U11 | U12  | Manage Profile               |
| U12 | U13  | View Loyalty Points          |
| U13 | U14  | Redeem Points for Discount   |

ID `U10` **để trống** trong JSON cho lần thêm AI sau này.

#### 2. Tách rõ sub-use case (chỉ document, KHÔNG tách ID)
- `U3` Customize Pizza giờ có 3 sub: `U3.1` Select Pizza Size, `U3.2` Select Crust Type (\<\<include\>\>), `U3.3` Add Extra Toppings (\<\<extend\>\>).
- `U6` Place COD Order có 2 sub: `U6.1` Provide Delivery Information, `U6.2` Review and Confirm Order (\<\<include\>\>).

  > Lưu ý: trong `feature_list.json` giữ ở mức cha `U3`, `U6` và đặc tả sub-flow trong PRODUCT.md để
  > tránh phình ID. Chỉ tách ID khi sub-flow được implement bởi người khác.

#### 3. Kitchen rút từ 4 → 3 UC
- `K1` View Incoming Orders (gộp queue + priority hiển thị)
- `K2` Update Preparation Status (Receive → Preparing → Completed)
- `K3` Mark Order Ready for Dispatch (đã là K4 cũ; trigger T1 atomic)
- `K2 cũ` Process Prioritized Order, `K3 cũ` Update Preparation Status, `K4 cũ` Mark Ready for Dispatch
  → cần xoá / rename / hợp nhất.

#### 4. Domain changes (ảnh hưởng infra-006)
- Order state thêm trạng thái mới `DispatchPending` (khi T1 fail timeout).
- Order code format chốt: `PIZZ-XXXXXX` (6 ký tự uppercase A–Z 0–9). Đè lên thiết kế ULID cũ trong ARCHITECTURE.md.
- Combo có thêm field: `validity_start`, `validity_end` (datetime), `target_group` (int, optional).

#### 5. Phân vai mới (5 người)
- **Minh** — infra (auth, openapi, docker, ci, deploy)
- **Thanh** — Admin Ops (A5 Monitor Orders, A6 Customer Accounts), A7 Reports, T2 Webhook, QA/E2E
- **Hieu** — schema/migrations (infra-003), seeds, Admin Catalog (A1–A4)
- **Hung** — domain (infra-006), delivery mock (infra-005, T1), Kitchen (K1–K3), U6, U7, U14
- **Hoang** — Next.js shell (infra-008), Customer UX (U1–U5, U8, U9, U11–U13)

---

## Prompt template để cập nhật feature_list.json

```
Bạn là dev của dự án PizzaHUST. Mình vừa update Use Case Diagram và 5 đặc tả Use Case
chi tiết. Hãy đọc kĩ feature_list.json hiện tại + ảnh use case diagram + slide đặc tả
chi tiết mình đính kèm, rồi cập nhật feature_list.json theo các nguyên tắc sau:

NGUYÊN TẮC:
1. Giữ nguyên cấu trúc JSON, $schema, invariants. Không đổi pattern id.
2. Mỗi feature phải có đủ field: id, name, depends_on, status, owner, evidence.
   Với infra cũ đang có description thì giữ; UC chỉ cần các field tối thiểu.
3. Không tự ý đổi status từ "done" / "in-progress" của feature đã làm. Chỉ đổi nếu
   mình confirm bằng evidence mới.
4. depends_on phải phản ánh đúng critical path. Một số nguyên tắc:
   - UC Customer luôn depends_on ["U9"] (log in) nếu cần auth.
   - UC Kitchen depends_on ["U6"] (cần có order) + ["infra-003"] (cần schema).
   - UC Admin depends_on ["infra-004"] (auth + role guard).
   - UC liên quan delivery depends_on ["infra-005"].
   - UC đặt hàng (U6) depends_on ["U5", "infra-006"] (cart + domain).
5. Khi ID đổi (vd U10 cũ → U11 mới), giữ lại UC cũ với "status": "deprecated" KHÔNG được —
   chỉ rename, đồng thời update mọi depends_on tham chiếu tới ID cũ.
6. Khi UC bị gộp (vd K2 Process Prioritized Order gộp vào K1), xoá hẳn entry đó.
7. Owner mặc định lấy theo bảng phân vai mới (xem prompt). Nếu UC nằm ranh giới 2 người,
   ưu tiên người sở hữu phần lớn code path đó.
8. AI Recommendation (AI1, U10) là OUT-OF-SCOPE sprint này — KHÔNG thêm vào feature_list.
   ID U10 để trống (sau U9 nhảy thẳng tới U11), giữ chỗ cho lần thêm AI về sau.
9. Sau khi sửa, in ra DIFF tóm tắt: ADDED / REMOVED / RENAMED / OWNER_CHANGED / DEPS_CHANGED
   (mỗi dòng 1 entry).
10. Nếu thấy mâu thuẫn giữa slide và ARCHITECTURE.md / feature_list.json, đừng tự quyết —
    hỏi mình trước khi đổi.

INPUT MÌNH GỬI KÈM:
- feature_list.json hiện tại
- PizzaHust.png (Use Case Diagram tổng quan)
- PizzaHust_UseCase_Detail.pdf (đặc tả chi tiết 5 UC mẫu: U6, U7, A1, K3, A4)
- ARCHITECTURE.md (để biết state machine & module boundary)

OUTPUT MÌNH MUỐN:
1. File feature_list.json đã cập nhật (đầy đủ, không phải patch)
2. Block "DIFF SUMMARY" ngay bên dưới
3. Block "QUESTIONS" liệt kê những điểm mâu thuẫn chưa rõ (nếu có)
```

---

## Checklist sau khi áp prompt

- [ ] Đếm số UC khớp với scope sprint: **13 U (U10 trống) + 7 A + 3 K + 2 T = 25**.
- [ ] Tất cả ID hợp lệ theo regex hiện tại `^(infra-\d{3}|U\d+|A\d+|K\d+|T\d+)$` (KHÔNG cần mở rộng vì AI defer).
- [ ] Không có entry `U10`, `AI1`, hoặc tham chiếu tới chúng trong `depends_on`.
- [ ] Không còn entry nào trỏ `depends_on` tới ID đã bị xoá/đổi (vd K4 cũ).
- [ ] `max_in_progress: 1` vẫn được giữ (mỗi person tối đa 1 in-progress).
- [ ] Mỗi owner xuất hiện trong feature_list ít nhất 1 lần, không quá 8 task (cân bằng).
- [ ] Status mặc định khi tạo mới: `"todo"`, evidence: `""`.
- [ ] Owner trong JSON viết không dấu: `Hieu`, `Hung`, `Hoang`, `Thanh`, `Minh`.
- [ ] Đã chạy `python -c "import json; json.load(open('feature_list.json'))"` không lỗi.
- [ ] Đã chạy `verify.sh` (nếu có check feature_list schema) thấy xanh.

---

## Snippet feature_list.json mẫu sau update

> Đây là gợi ý — đừng copy nguyên xi, hãy để AI viết lại dựa trên file gốc của bạn.

```jsonc
{
  "$schema": "./feature_list.schema.json",
  "invariants": {
    "max_in_progress": 1,
    "id_pattern": "^(infra-\\d{3}|U\\d+|A\\d+|K\\d+|T\\d+)$"
  },
  "features": [
    // ----- infra giữ nguyên hoặc tách nếu cần -----
    { "id": "infra-001", "name": "Application wrapper + harness", "depends_on": [], "status": "done", "owner": "Minh", "evidence": "verify.sh green at f17af03" },
    // ... infra-002 đến infra-008 giữ nguyên ...

    // ----- UC Guest/Customer (U10 BỎ TRỐNG - reserved for AI later) -----
    { "id": "U1",  "name": "Browse Menus",                  "depends_on": ["infra-006", "infra-008"],  "status": "todo", "owner": "Hoang", "evidence": "" },
    { "id": "U2",  "name": "View Item Details",             "depends_on": ["U1"],                       "status": "todo", "owner": "Hoang", "evidence": "" },
    { "id": "U3",  "name": "Customize Pizza",               "depends_on": ["U2"],                       "status": "todo", "owner": "Hoang", "evidence": "" },
    { "id": "U4",  "name": "View Combo Promotions",         "depends_on": ["U1", "A4"],                 "status": "todo", "owner": "Hoang", "evidence": "" },
    { "id": "U5",  "name": "Manage Cart",                   "depends_on": ["U3", "U4"],                 "status": "todo", "owner": "Hoang", "evidence": "" },
    { "id": "U6",  "name": "Place COD Order",               "depends_on": ["U5", "infra-006"],          "status": "todo", "owner": "Hung",  "evidence": "" },
    { "id": "U7",  "name": "Track Order",                   "depends_on": ["U6", "infra-005", "T2"],    "status": "todo", "owner": "Hung",  "evidence": "" },
    { "id": "U8",  "name": "Register",                      "depends_on": ["infra-004"],                "status": "todo", "owner": "Hoang", "evidence": "" },
    { "id": "U9",  "name": "Log In",                        "depends_on": ["infra-004"],                "status": "todo", "owner": "Hoang", "evidence": "" },
    // U10 reserved for "Get AI Menu Recommendation" — out of scope this sprint
    { "id": "U11", "name": "View Order History",            "depends_on": ["U6", "U9"],                 "status": "todo", "owner": "Hoang", "evidence": "" },
    { "id": "U12", "name": "Manage Profile",                "depends_on": ["U9"],                       "status": "todo", "owner": "Hoang", "evidence": "" },
    { "id": "U13", "name": "View Loyalty Points",           "depends_on": ["U9", "infra-006"],          "status": "todo", "owner": "Hoang", "evidence": "" },
    { "id": "U14", "name": "Redeem Points for Discount",    "depends_on": ["U6", "U13"],                "status": "todo", "owner": "Hung",  "evidence": "" },

    // ----- Admin -----
    { "id": "A1",  "name": "Manage Pizza Catalog",                  "depends_on": ["infra-004"],         "status": "todo", "owner": "Hieu",  "evidence": "" },
    { "id": "A2",  "name": "Manage Pizza Options and Side Dishes",  "depends_on": ["A1"],                "status": "todo", "owner": "Hieu",  "evidence": "" },
    { "id": "A3",  "name": "Manage Menu Categories",                "depends_on": ["A1"],                "status": "todo", "owner": "Hieu",  "evidence": "" },
    { "id": "A4",  "name": "Manage Combo Campaigns",                "depends_on": ["A1", "A2"],          "status": "todo", "owner": "Hieu",  "evidence": "" },
    { "id": "A5",  "name": "Monitor Orders and Delivery Exceptions","depends_on": ["U6", "infra-005"],   "status": "todo", "owner": "Thanh", "evidence": "" },
    { "id": "A6",  "name": "Manage Customer Accounts",              "depends_on": ["infra-004"],         "status": "todo", "owner": "Thanh", "evidence": "" },
    { "id": "A7",  "name": "View Sales and Order Reports",          "depends_on": ["U6"],                "status": "todo", "owner": "Thanh", "evidence": "" },

    // ----- Kitchen (rút 4 → 3) -----
    { "id": "K1", "name": "View Incoming Orders (queue)",         "depends_on": ["U6", "infra-003"],     "status": "todo", "owner": "Hung", "evidence": "" },
    { "id": "K2", "name": "Update Preparation Status",            "depends_on": ["K1"],                  "status": "todo", "owner": "Hung", "evidence": "" },
    { "id": "K3", "name": "Mark Order Ready for Dispatch",        "depends_on": ["K2", "infra-005", "T1"], "status": "todo", "owner": "Hung", "evidence": "" },

    // ----- Third-Party Delivery -----
    { "id": "T1", "name": "Request Delivery Service (mock-first)", "depends_on": ["infra-005", "K3"],    "status": "todo", "owner": "Hung",  "evidence": "" },
    { "id": "T2", "name": "Synchronize Delivery Status (webhook)", "depends_on": ["T1"],                 "status": "todo", "owner": "Thanh", "evidence": "" }
  ]
}
```

> Lưu ý owner: `Hieu`, `Hung`, `Hoang`, `Thanh`, `Minh` đều không dấu trong JSON.
> Nếu PRODUCT.md / báo cáo cuối kỳ đang dùng có dấu thì giữ nguyên ở đó, chỉ JSON không dấu.

---

## Cập nhật ARCHITECTURE.md kèm theo

Nếu sau khi áp prompt feature_list, có thay đổi sau cần đồng bộ sang `ARCHITECTURE.md`:

### 1. Order State Machine — thêm state `DispatchPending`

```
| Preparing       | DispatchPending  | K3 attempt → T1 fail timeout |
| DispatchPending | ReadyForDispatch | A5 admin retry → T1 ok       |
| DispatchPending | Cancelled        | A5 admin cancel              |
```

Terminal states không đổi.

### 2. Order Code — thay nguyên đoạn

```diff
- `backend/app/domain/order_code.py::generate()` returns a ULID, displayed as 26-char Crockford base32.
+ `backend/app/domain/order_code.py::generate()` returns `PIZZ-` + 6 random chars from
+  Crockford base32 alphabet (excludes I, L, O, U for readability), with DB-level uniqueness check
+  and at most 3 retries on collision.
```

### 3. Combo schema — bổ sung field

Trong section Database / Combo model:

```
- validity_start: datetime (when combo becomes visible)
- validity_end:   datetime (must be > validity_start)
- target_group:   int, nullable (intended number of diners)
- status:         enum [Scheduled, Active, Expired] — auto-computed from validity window
```

### 4. AI Module — KHÔNG thêm vào ARCHITECTURE.md sprint này

Defer cùng với UC AI1/U10. Khi nào triển khai, sẽ thêm:
- Module path: `backend/app/domain/recommendation.py` (pure) + `backend/app/api/ai.py` (router)
- Endpoint: `POST /api/ai/recommend`
- Strategy / cache / fallback rules

---

## Kết luận

Mỗi khi requirement thay đổi:
1. Update Use Case Diagram trước (đây là source of truth)
2. Áp prompt template ở mục trên cho AI assistant
3. Review DIFF SUMMARY, trả lời block QUESTIONS nếu có
4. Đồng bộ ARCHITECTURE.md nếu có thay đổi state machine / endpoint
5. Commit cả 3 file (`feature_list.json` + `ARCHITECTURE.md` + Use Case slide PDF) trong cùng 1 PR
6. Chạy `verify.sh` xanh trước khi merge.

### Quy ước cho lần thêm AI sau (sprint kế tiếp)
Khi reactivate AI:
1. Mở rộng `id_pattern` thành `^(infra-\d{3}|U\d+|A\d+|K\d+|T\d+|AI\d+)$`
2. Thêm entry `U10` đúng vị trí trống đã reserve
3. Thêm entry `AI1` mới
4. Update `U10.depends_on = ["U9", "AI1"]`
