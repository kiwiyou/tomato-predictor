import { redis } from "~/redis";
import { differenceInDays, isBefore, parseISO } from "date-fns";
import { getContestants, getContests, getCurrentArenas, unfix } from "~/solved";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: { contest: string } }
) {
  let E = await redis.get<number[]>(`E.${params.contest}`);
  if (E === null) {
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
    let first = true;
    const iterator = getExpectancy(C, handles);
    const E: number[] = [];
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue("[");
      },
      async pull(controller) {
        if (!first) {
          controller.enqueue(",");
        }
        first = false;
        const next = await iterator.next();
        if (next.done) {
          controller.enqueue("]");
          controller.close();
          await redis.set(`E.${params.contest}`, E);
        } else {
          controller.enqueue(next.value.toString());
          E.push(next.value);
        }
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

async function* getExpectancy(C: Date, handles: string[]) {
  for (const handle of handles) {
    let numer = 0;
    let denom = 0;
    let i = 1;
    for (const { performance, startTime, ratedRangeEnd } of await getContests(
      handle
    )) {
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
    yield P;
  }
}
