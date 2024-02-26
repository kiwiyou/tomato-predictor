import { redis } from "~/redis";
import { differenceInDays, isBefore, parseISO } from "date-fns";
import { getContestants, getContests, getCurrentArenas, unfix } from "~/solved";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: { contest: string } },
) {
  let E = await redis.get<number[]>(`E.${params.contest}`);
  if (E === null) {
    const arenas = await getCurrentArenas();
    const arena = arenas.find(
      (arena) => arena.arenaBojContestId === +params.contest,
    );
    if (arena === undefined) {
      return new Response("Not Found", {
        status: 404,
      });
    }
    const C = parseISO(arena.startTime);
    const handles = await getContestants(arena.arenaId);
    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(`[`);
        controller.enqueue("]");
        controller.close();
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
  return Response.json(E);
}
