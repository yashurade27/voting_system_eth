import { Suspense } from "react";
import { ElectionScreen, ElectionSkeleton } from "@/components/election-screen";

export default function ElectionPage({ params }: PageProps<"/elections/[id]">) {
  return (
    <Suspense fallback={<ElectionSkeleton />}>
      <ResolvedElection params={params} />
    </Suspense>
  );
}

async function ResolvedElection({ params }: Pick<PageProps<"/elections/[id]">, "params">) {
  const { id } = await params;
  return <ElectionScreen id={Number(id)} />;
}
