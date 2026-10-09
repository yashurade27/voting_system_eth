import { connection } from "next/server";
import { listElections } from "@/lib/server/ballot-reader";
import { respond } from "@/lib/server/respond";

export async function GET() {
  await connection();
  return respond(listElections);
}
