import { QueueClient } from "./queue-client";

export const metadata = { title: "Kitchen Queue · PizzaHust" };

export default function KitchenPage() {
  return <QueueClient />;
}
