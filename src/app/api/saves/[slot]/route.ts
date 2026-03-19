import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ slot: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slot } = await params;
  const slotNum = parseInt(slot, 10);
  if (isNaN(slotNum) || slotNum < 1 || slotNum > 4) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare(
    "SELECT game_state FROM save_slots WHERE user_id = ? AND slot_number = ?"
  ).get(user.userId, slotNum) as { game_state: string } | undefined;

  if (!row) return NextResponse.json({ game_state: null });
  return NextResponse.json({ game_state: JSON.parse(row.game_state) });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slot } = await params;
  const slotNum = parseInt(slot, 10);
  if (isNaN(slotNum) || slotNum < 1 || slotNum > 4) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const body = await req.json();
  const { game_state, label_name, turn } = body;

  const db = getDb();
  db.prepare(`
    INSERT INTO save_slots (id, user_id, slot_number, label_name, turn, game_state, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, slot_number) DO UPDATE SET
      label_name = excluded.label_name,
      turn = excluded.turn,
      game_state = excluded.game_state,
      updated_at = datetime('now')
  `).run(
    crypto.randomUUID(),
    user.userId,
    slotNum,
    label_name || "",
    turn || 0,
    JSON.stringify(game_state),
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slot } = await params;
  const slotNum = parseInt(slot, 10);
  if (isNaN(slotNum) || slotNum < 1 || slotNum > 4) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("DELETE FROM save_slots WHERE user_id = ? AND slot_number = ?").run(user.userId, slotNum);

  return NextResponse.json({ ok: true });
}
