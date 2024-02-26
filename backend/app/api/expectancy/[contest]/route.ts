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
    E = [];
    for (const handle of await getContestants(arena.arenaId)) {
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
      if (denom === 0) {
        const { rating } = await fetch(
          `https://solved.ac/api/v3/user/show?handle=${handle}`
        ).then((r) => r.json());
        E.push(800 + Math.floor(rating / 2.4));
      } else {
        E.push(numer / denom);
      }
    }
    redis.set(`E.${params.contest}`, E);
  }
  return Response.json(E);
}
