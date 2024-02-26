import { redis } from "~/redis";
import { differenceInDays, isBefore, parseISO } from "date-fns";
import { getContestants, getContests, getCurrentArenas, unfix } from "~/solved";
const { UPDATE_EXPECTANCY } = process.env;

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function PATCH(
  request: Request,
  { params }: { params: { contest: string } }
) {
  if (request.headers.get("Authorization") !== `Bearer ${UPDATE_EXPECTANCY}`) {
    return new Response("Forbidden", {
      status: 403,
    });
  }
  const arenas = await getCurrentArenas();
  const arena = arenas.find(
    (arena) => arena.arenaBojContestId === +params.contest
  );
  if (arena === undefined) {
    return new Response("Not Found", {
      status: 404,
    });
  }
  const C = parseISO(arena.startTime);
  const handles = await getContestants(arena.arenaId);
  const readable = new ReadableStream({
    async pull(controller) {
      controller.enqueue(`${handles.length}\n`);
      let done = 0;
      try {
        const E = await Promise.all(
          handles.map(async (handle) => {
            let numer = 0;
            let denom = 0;
            let i = 1;
            for (const {
              performance,
              startTime,
              ratedRangeEnd,
            } of await getContests(handle)) {
              const Ti = parseISO(startTime);
              if (!isBefore(Ti, C)) continue;
              const pi = unfix(performance, ratedRangeEnd);
              const Wi = Math.min(
                Math.pow(0.8, i),
                Math.pow(0.25, Math.floor(differenceInDays(C, Ti) / 365))
              );
              numer += pi * Wi;
              denom += Wi;
              i++;
            }
            let P;
            if (denom === 0) {
              const { rating } = await fetch(
                `https://solved.ac/api/v3/user/show?handle=${handle}`
              ).then((r) => r.json());
              P = 800 + Math.floor(rating / 2.4);
            } else {
              P = numer / denom;
            }
            done += 1;
            controller.enqueue(`${done}\n`);
            return P;
          })
        );
        redis.set(`E.${params.contest}`, E);
      } catch {
        controller.enqueue("error\n");
      }
      controller.close();
    },
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: { contest: string } }
) {
  let E = await redis.get<number[]>(`E.${params.contest}`);
  if (E === null) {
    return new Response("Service Unavailable", {
      status: 503,
    });
  }
  return Response.json(E);
}
