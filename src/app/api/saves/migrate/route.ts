import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { saves } = await req.json() as {
    saves: { slot_number: number; label_name: string; turn: number; game_state: unknown }[];
  };

  if (!Array.isArray(saves)) {
    return NextResponse.json({ error: "saves must be an array" }, { status: 400 });
  }

  const db = getDb();

  // Find which slots are already occupied
  const existing = db.prepare(
    "SELECT slot_number FROM save_slots WHERE user_id = ?"
  ).all(user.userId) as { slot_number: number }[];
  const usedSlots = new Set(existing.map((r) => r.slot_number));

  const insert = db.prepare(`
    INSERT INTO save_slots (id, user_id, slot_number, label_name, turn, game_state, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  let migrated = 0;
  for (const save of saves) {
    if (save.slot_number < 1 || save.slot_number > 4) continue;
    if (usedSlots.has(save.slot_number)) continue;

    insert.run(
      crypto.randomUUID(),
      user.userId,
      save.slot_number,
      save.label_name || "",
      save.turn || 0,
      JSON.stringify(save.game_state),
    );
    usedSlots.add(save.slot_number);
    migrated++;
  }

  return NextResponse.json({ migrated });
}
