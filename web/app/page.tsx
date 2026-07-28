import { getQueueView } from "@/lib/data";
import { QueueStack } from "@/components/folders/QueueStack";

// 큐는 읽을 때마다 달라진다. 예전엔 revalidate=300으로 캐시했는데, 그때는
// 화면이 읽기 전용이라 상관없었다. 지금은 캐시된 큐를 보여 주면 방금 읽은 게
// 다시 올라온다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { queue, unreadByModule, failures, nudge, demo } = await getQueueView();
  return (
    <QueueStack
      queue={queue}
      unreadByModule={unreadByModule}
      failures={failures}
      nudge={nudge}
      demo={demo}
    />
  );
}
