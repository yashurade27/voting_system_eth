import type { NextRequest } from "next/server";
import { getVoterStatus } from "@/lib/server/ballot-reader";
import { respond } from "@/lib/server/respond";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/elections/[id]/voters/[address]">) {
  const { id, address } = await ctx.params;
  return respond(() => getVoterStatus(Number(id), address));
}
