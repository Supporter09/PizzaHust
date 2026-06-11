"use client";

import { use } from "react";

import ComboEditor from "@/components/admin/combo-editor";

export default function EditComboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ComboEditor comboId={Number(id)} />;
}