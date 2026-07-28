// 화면이 쓰는 데이터 한 곳. 실데이터(Neon)와 데모를 여기서 스왑한다.
import {
  hasDb,
  getUnread,
  getIndex,
  getStandingFailures,
  getSkipNudge,
  getModuleArchive,
  type Briefing,
  type IndexEntry,
  type SkipNudge,
} from "./db";
import { DEMO_QUEUE } from "./demo";
import { metaOf } from "./modules";

export interface QueueView {
  /** 안 읽은 것 전부, 시간 역순. 개수는 정해져 있지 않다 */
  queue: Briefing[];
  /** 사이드바 색인 = 지금 받기로 한 것 전부 */
  index: IndexEntry[];
  failures: { module_key: string; error: string | null }[];
  /** "이 모듈 줄일까요?" — 없으면 null */
  nudge: SkipNudge | null;
  demo: boolean;
}

function demoIndex(): IndexEntry[] {
  const counts: Record<string, number> = {};
  for (const b of DEMO_QUEUE) counts[b.module_key] = (counts[b.module_key] ?? 0) + 1;
  return Object.entries(counts).map(([key, unread]) => ({
    key,
    label: metaOf(key).name,
    unread,
    topic: false,
  }));
}

export async function getQueueView(): Promise<QueueView> {
  if (!hasDb) {
    return { queue: DEMO_QUEUE, index: demoIndex(), failures: [], nudge: null, demo: true };
  }

  // 넷 다 서로 독립이라 같이 던진다
  const [queue, index, failures, nudge] = await Promise.all([
    getUnread(),
    getIndex(),
    getStandingFailures(),
    getSkipNudge(),
  ]);
  return { queue, index, failures, nudge, demo: false };
}

export interface ArchiveView {
  briefings: Briefing[];
  index: IndexEntry[];
  demo: boolean;
}

/** 모듈 하나의 지난 장들 — 읽은 것도 포함한다(그게 아카이브의 용도다) */
export async function getArchiveView(moduleKey: string): Promise<ArchiveView> {
  if (!hasDb) {
    const briefings = DEMO_QUEUE.filter((b) => b.module_key === moduleKey);
    return { briefings, index: demoIndex(), demo: true };
  }
  const [briefings, index] = await Promise.all([getModuleArchive(moduleKey), getIndex()]);
  return { briefings, index, demo: false };
}
