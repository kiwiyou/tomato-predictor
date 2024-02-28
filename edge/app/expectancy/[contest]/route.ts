import {
  getContestants,
  getContests,
  getCurrentArenas,
  unfix,
} from "@/lib/solved";
import { Redis } from "@upstash/redis";
import { differenceInDays, isBefore, parseISO } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: { contest: string } }
) {
  const redis = Redis.fromEnv();
  const E = await redis.get<number[]>(`E.${params.contest}`);
  if (E === null) {
    const arenas = await getCurrentArenas(redis);
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
    const expectancy = getExpectancy(redis, C, handles);
    const E: number[] = [];
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue("[");
      },
      async pull(controller) {
        const { value, done } = await expectancy.next();
        if (done) {
          controller.enqueue("]");
          controller.close();
          await redis.set(`E.${params.contest}`, E);
        } else {
          E.push(value);
          if (!first) {
            controller.enqueue(",");
          }
          first = false;
          controller.enqueue(value.toString());
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  return Response.json(E);
}

async function* getExpectancy(redis: Redis, C: Date, handles: string[]) {
  for (const handle of handles) {
    let numer = 0;
    let denom = 0;
    let i = 1;
    for (const { performance, startTime, ratedRangeEnd } of await getContests(
      redis,
      handle
    )) {
      const Ti = parseISO(startTime);
      if (!isBefore(Ti, C)) continue;
      const pi = unfix(performance, ratedRangeEnd);
      const Wi = Math.min(0.8 ** i, 0.25 ** (differenceInDays(C, Ti) / 365));
      numer += pi * Wi;
      denom += Wi;
      i++;
    }
    let P: number;
    if (denom === 0) {
      const { rating }: { rating: number } = await fetch(
        `https://solved.ac/api/v3/user/show?handle=${handle}`
      ).then((r) => r.json());
      P = 800 + Math.floor(rating / 2.4);
    } else {
      P = numer / denom;
    }
    yield P;
  }
}
