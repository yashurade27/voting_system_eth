import type { NextRequest } from "next/server";
import { getElection } from "@/lib/server/ballot-reader";
import { respond } from "@/lib/server/respond";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/elections/[id]">) {
  const { id } = await ctx.params;
  return respond(() => getElection(Number(id)));
}
