import type { NextRequest } from "next/server";
import { getActivity } from "@/lib/server/ballot-reader";
import { respond } from "@/lib/server/respond";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/elections/[id]/activity">) {
  const { id } = await ctx.params;
  return respond(() => getActivity(Number(id)));
}
