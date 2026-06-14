"use client";

import { formatOrderStatus } from "@/lib/order-status";

export const URGENT_AFTER_MIN = 10;

export function ageMinutes(createdAt: string, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 60_000));
}

export function isUrgent(status: string, createdAt: string, now: Date = new Date()): boolean {
  return status === "Received" && ageMinutes(createdAt, now) >= URGENT_AFTER_MIN;
}

export function statusLabel(status: string): string {
  return formatOrderStatus(status);
}
