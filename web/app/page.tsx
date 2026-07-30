import { redirect } from "next/navigation";
import { getQueueView } from "@/lib/data";
import { QueueStack } from "@/components/folders/QueueStack";
import { currentUserId } from "@/lib/session-server";

// 큐는 읽을 때마다 달라진다. 예전엔 revalidate=300으로 캐시했는데, 그때는
// 화면이 읽기 전용이라 상관없었다. 지금은 캐시된 큐를 보여 주면 방금 읽은 게
// 다시 올라온다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await currentUserId();
  if (userId === null) redirect("/onboarding");
  const { queue, index, failures, nudge, demo } = await getQueueView(userId);
  return (
    <QueueStack
      queue={queue}
      index={index}
      failures={failures}
      nudge={nudge}
      demo={demo}
    />
  );
}
