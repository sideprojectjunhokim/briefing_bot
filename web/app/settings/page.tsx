import { hasDb, getCurrentSetup, getIndex, type CurrentSetup } from "@/lib/db";
import { MODULE_ORDER } from "@/lib/modules";
import { Settings } from "@/components/folders/Settings";

// 저장하면 바로 다시 읽어야 해서 캐시하지 않는다
export const dynamic = "force-dynamic";

const DEMO: CurrentSetup = {
  keys: MODULE_ORDER.map((m) => m.key),
  custom: [],
  pickMax: 8,
};

export default async function SettingsPage() {
  if (!hasDb) return <Settings current={DEMO} index={[]} demo />;

  const [current, index] = await Promise.all([getCurrentSetup(), getIndex()]);
  return <Settings current={current} index={index} demo={false} />;
}
