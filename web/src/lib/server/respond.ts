import "server-only";
import { NotDeployedError } from "./ballot-reader";

export async function respond<T>(load: () => Promise<T | null>) {
  try {
    const data = await load();
    if (data === null) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NotDeployedError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    return Response.json(
      { error: "Could not reach the Ethereum node. Is `npm run chain` running?" },
      { status: 502 },
    );
  }
}
