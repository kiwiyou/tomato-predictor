import { getCurrentArenas } from "@/lib/solved";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: { contest: string } }
) {
  const redis = Redis.fromEnv();
  const arenas = await getCurrentArenas(redis);
  const arena = arenas.find(
    (arena) => arena.arenaBojContestId === +params.contest
  );
  if (arena === undefined) {
    return new Response("Not Found", {
      status: 404,
    });
  }
  return Response.json(arena);
}
