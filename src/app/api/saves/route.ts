import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = db.prepare(
    "SELECT slot_number, label_name, turn, updated_at FROM save_slots WHERE user_id = ? ORDER BY slot_number"
  ).all(user.userId) as { slot_number: number; label_name: string; turn: number; updated_at: string }[];

  const existing = new Map(rows.map((r) => [r.slot_number, r]));
  const slots = [];
  for (let i = 1; i <= 4; i++) {
    const row = existing.get(i);
    if (row) {
      slots.push({
        slotNumber: i,
        labelName: row.label_name,
        turn: row.turn,
        updatedAt: row.updated_at,
        isEmpty: false,
      });
    } else {
      slots.push({ slotNumber: i, labelName: "", turn: 0, updatedAt: "", isEmpty: true });
    }
  }

  return NextResponse.json(slots);
}
