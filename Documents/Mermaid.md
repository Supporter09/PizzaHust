flowchart LR
    Guest["Guest"]
    Customer["Customer"]
    Admin["Admin / Store Owner"]
    Kitchen["Kitchen Staff"]
    AIActor["AI Recommendation Service"]
    DeliveryAPI["Third-Party Delivery Service"]

    Customer -.->|inherits| Guest

    subgraph SYS["PizzaHut Online Ordering System"]
        direction LR

        subgraph CUS["Customer Ordering"]
            direction TB
            U1["U1 Browse Menus"]
            U2["U2 View Item Details"]
            U3["U3 Customize Pizza"]
            U3_1["U3.1 Select Pizza Size"]
            U3_2["U3.2 Select Crust Type"]
            U3_3["U3.3 Add Extra Toppings"]
            U4["U4 View Combo Promotions"]
            U5["U5 Manage Cart"]
            U6["U6 Place COD Order"]
            U6_1["U6.1 Provide Delivery Information"]
            U6_2["U6.2 Calculate Delivery Fee"]
            U6_3["U6.3 Confirm Cash on Delivery"]
            U7["U7 Track Order"]
            U7_1["U7.1 Synchronize Delivery Status"]
            U8["U8 Register"]
            U9["U9 Log In"]
            U10["U10 Get AI Menu Recommendation"]
            U11["U11 View Order History"]
            U12["U12 Manage Profile"]
            U13["U13 View Loyalty Points"]
            U14["U14 Redeem Points for Discount"]
        end

        subgraph ADM["Administration"]
            direction TB
            A1["A1 Manage Pizza Catalog"]
            A2["A2 Manage Pizza Options and Side Dishes"]
            A3["A3 Manage Menu Categories"]
            A4["A4 Manage Combo Campaigns"]
            A5["A5 Monitor Orders and Delivery Integration"]
            A6["A6 Manage Customer Accounts"]
            A7["A7 View Sales and Order Reports"]
        end

        subgraph KIT["Kitchen Operations"]
            direction TB
            K1["K1 View Incoming Orders"]
            K2["K2 Update Preparation Status"]
            K3["K3 Mark Order Ready for Dispatch"]
        end

        subgraph INT["External Services Integration"]
            direction TB
            T1["T1 Request Delivery Service"]
            T2["T2 Synchronize Delivery Status"]
            AI1["AI1 Generate Personalized Menu Recommendation"]
        end
    end

    Guest --- U1
    Guest --- U2
    Guest --- U3
    Guest --- U4
    Guest --- U5
    Guest --- U6
    Guest --- U7
    Guest --- U8
    Guest --- U10

    Customer --- U9
    Customer --- U11
    Customer --- U12
    Customer --- U13
    Customer --- U14

    Admin --- A1
    Admin --- A2
    Admin --- A3
    Admin --- A4
    Admin --- A5
    Admin --- A6
    Admin --- A7

    Kitchen --- K1
    Kitchen --- K2
    Kitchen --- K3

    AIActor --- AI1
    DeliveryAPI --- T1
    DeliveryAPI --- T2

    U3 -->|include| U3_1
    U3 -->|include| U3_2
    U3_3 -.->|extend| U3

    U6 -->|include| U6_1
    U6 -->|include| U6_2
    U6 -->|include| U6_3
    U14 -.->|extend| U6

    U10 -->|include| AI1
    U7 -->|include| U7_1
    U7_1 -->|include| T2
    K3 -->|include| T1
