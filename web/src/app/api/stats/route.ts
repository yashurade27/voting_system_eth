import { connection } from "next/server";
import { getStats } from "@/lib/server/ballot-reader";
import { respond } from "@/lib/server/respond";

export async function GET() {
  await connection();
  return respond(getStats);
}
