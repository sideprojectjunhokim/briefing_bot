import { NextResponse } from "next/server";
import { applySetup, hasDb } from "@/lib/db";
import { MODULE_ORDER } from "@/lib/modules";

export const runtime = "nodejs";

const VALID = new Set(MODULE_ORDER.map((m) => m.key));

/** 온보딩에서 고른 값을 반영. 로그인 직후 한 번만 불린다. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { modules?: unknown; pickMax?: unknown };

  const modules = Array.isArray(body.modules)
    ? body.modules.filter((m): m is string => typeof m === "string" && VALID.has(m))
    : [];
  const pickMax = Number(body.pickMax);

  // 하나도 안 고른 상태를 반영하면 전 모듈이 muted가 되어 큐가 영영 빈다
  if (modules.length === 0) {
    return NextResponse.json({ error: "모듈을 하나 이상 골라야 합니다" }, { status: 400 });
  }
  if (!Number.isInteger(pickMax) || pickMax < 1 || pickMax > 20) {
    return NextResponse.json({ error: "pickMax는 1~20" }, { status: 400 });
  }

  if (!hasDb) return NextResponse.json({ ok: true, persisted: false });

  await applySetup(modules, pickMax);
  return NextResponse.json({ ok: true, persisted: true });
}
