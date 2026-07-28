import { NextResponse } from "next/server";
import { applySetup, hasDb, type SetupTopic } from "@/lib/db";
import { MODULE_ORDER } from "@/lib/modules";
import { presetOf, isCurated } from "@/lib/topics";

export const runtime = "nodejs";

const CURATED = new Set(MODULE_ORDER.map((m) => m.key));

/** 온보딩에서 고른 값을 반영. 로그인 직후 한 번만 불린다. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    keys?: unknown;
    custom?: unknown;
    starred?: unknown;
    pickMax?: unknown;
  };

  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string") : [];
  const pickMax = Number(body.pickMax);

  // 코드에 소스가 있는 것과 검색으로 채우는 것으로 가른다
  const pickedModules = keys.filter((k) => CURATED.has(k));
  const topics: SetupTopic[] = [];
  for (const k of keys) {
    const p = presetOf(k);
    if (p && !isCurated(p))
      topics.push({ key: p.key, label: p.label, query: p.query!, custom: false, enabled: true });
  }

  // 직접 친 관심사. 검색어는 라벨 그대로 쓴다 — 사용자가 아는 말이 곧 검색어다
  if (Array.isArray(body.custom)) {
    for (const c of body.custom) {
      if (!c || typeof c !== "object") continue;
      const { key, label } = c as { key?: unknown; label?: unknown };
      if (typeof key !== "string" || typeof label !== "string") continue;
      const trimmed = label.trim().slice(0, 40);
      if (!trimmed || !key.startsWith("my-")) continue;
      // 꺼진 커스텀도 행을 남긴다 — 지우면 다시 켤 방법이 없다
      topics.push({ key, label: trimmed, query: trimmed, custom: true, enabled: keys.includes(key) });
    }
  }

  // 하나도 안 고른 상태를 반영하면 큐가 영영 빈다
  if (pickedModules.length === 0 && topics.filter((t) => t.enabled).length === 0) {
    return NextResponse.json({ error: "관심사를 하나 이상 골라야 합니다" }, { status: 400 });
  }
  if (!Number.isInteger(pickMax) || pickMax < 1 || pickMax > 20) {
    return NextResponse.json({ error: "pickMax는 1~20" }, { status: 400 });
  }

  if (!hasDb) return NextResponse.json({ ok: true, persisted: false });

  const starred = Array.isArray(body.starred)
    ? body.starred.filter((k): k is string => typeof k === "string")
    : [];

  await applySetup(pickedModules, topics, pickMax, starred);
  return NextResponse.json({ ok: true, persisted: true, modules: pickedModules.length, topics: topics.length });
}
