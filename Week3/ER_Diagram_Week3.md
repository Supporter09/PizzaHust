# PizzaHUST – ER Diagram (Week 3 Final)

```mermaid
erDiagram
    users {
        int user_id PK
        varchar full_name
        varchar email
        varchar phone_number
        varchar password_hash
        varchar address
        boolean is_locked
        enum role
        int current_points
        int total_points_earned
        enum membership_tier
    }

    categories {
        int category_id PK
        varchar name
        text description
        int sort_order
        boolean is_active
    }

    products {
        int product_id PK
        int category_id FK
        varchar name
        int base_price_vnd
        boolean is_pizza
        varchar image_url
        boolean is_active
    }

    pizza_sizes {
        int size_id PK
        varchar name
        int price_modifier_vnd
    }

    pizza_crusts {
        int crust_id PK
        varchar name
    }

    toppings {
        int topping_id PK
        varchar name
        int price_vnd
    }

    combos {
        int combo_id PK
        varchar name
        text description
        int combo_price_vnd
        int target_group
        datetime validity_start
        datetime validity_end
        boolean is_active
    }

    combo_items {
        int combo_item_id PK
        int combo_id FK
        int product_id FK
        int quantity
    }

    orders {
        int order_id PK
        varchar order_code
        int user_id FK
        varchar recipient_name
        varchar recipient_phone
        varchar delivery_address
        int total_amount_vnd
        int delivery_fee_vnd
        varchar payment_method
        enum current_status
        datetime promised_at
        varchar delivery_reference
        datetime created_at
    }

    order_items {
        int order_item_id PK
        int order_id FK
        int product_id FK
        int combo_id FK
        int size_id FK
        int crust_id FK
        int quantity
        int unit_price_vnd
        varchar notes
    }

    order_item_toppings {
        int id PK
        int order_item_id FK
        int topping_id FK
        int quantity
        int price_at_time_vnd
    }

    order_tracking {
        int tracking_id PK
        int order_id FK
        int updated_by FK
        enum status
        datetime created_at
        varchar note
    }

    webhook_events {
        int id PK
        varchar event_id
        datetime received_at
    }

    users ||--o{ orders : "places"
    users ||--o{ order_tracking : "updates"
    categories ||--o{ products : "contains"
    products ||--o{ combo_items : "included in"
    combos ||--o{ combo_items : "has"
    combos ||--o{ order_items : "ordered as"
    products ||--o{ order_items : "ordered as"
    orders ||--o{ order_items : "has"
    order_items ||--o{ order_item_toppings : "topped with"
    toppings ||--o{ order_item_toppings : "used in"
    pizza_sizes ||--o{ order_items : "sized"
    pizza_crusts ||--o{ order_items : "crusted"
    orders ||--o{ order_tracking : "tracked by"
```

## Ghi chú thiết kế

| Quyết định | Lý do |
|---|---|
| `order_items.product_id XOR combo_id` | CHECK constraint – một item chỉ là pizza đơn hoặc combo, không bao giờ cả hai |
| `combos.is_active` | APScheduler chạy mỗi 60s, tự flip `False` khi `validity_end < now()` |
| `products.is_active` | Admin deactivate thay vì xóa – giữ lịch sử order |
| `categories.sort_order` | UI kéo thả, persist qua `PUT /api/admin/categories/reorder` |
| `webhook_events.event_id` UNIQUE | Idempotency – delivery webhook trùng lặp không gây trạng thái lỗi |
| `users.total_points_earned` | Dùng tính tier upgrade (STANDARD→SILVER→GOLD) độc lập với điểm hiện tại |
