import { Router, error, withParams } from "itty-router";
import { Redis } from "@upstash/redis/cloudflare";
import { getContestants, getContests, getCurrentArenas, unfix } from "./solved";
import { differenceInDays, isBefore, parseISO } from "date-fns";

export interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

const router = Router();

router
  .all("*", withParams)
  .get(
    "/arena/:contest",
    async ({ contest }: { contest: string }, env: Env) => {
      const redis = Redis.fromEnv(env);
      const arenas = await getCurrentArenas(redis);
      const arena = arenas.find(
        (arena) => arena.arenaBojContestId === +contest
      );
      if (arena === undefined) {
        return error(404);
      }
      return Response.json(arena);
    }
  )
  .get(
    "/expectancy/:contest",
    async ({ contest }: { contest: string }, env: Env) => {
      const redis = Redis.fromEnv(env);
      let E = await redis.get<number[]>(`E.${contest}`);
      if (E === null) {
        const arenas = await getCurrentArenas(redis);
        const arena = arenas.find(
          (arena) => arena.arenaBojContestId === +contest
        );
        if (arena === undefined) {
          return error(404);
        }
        const C = parseISO(arena.startTime);
        const handles = await getContestants(arena.arenaId);
        E = await Promise.all(
          handles.map(async (handle) => {
            let numer = 0;
            let denom = 0;
            let i = 1;
            for (const {
              performance,
              startTime,
              ratedRangeEnd,
            } of await getContests(redis, handle)) {
              const Ti = parseISO(startTime);
              if (!isBefore(Ti, C)) continue;
              const pi = unfix(performance, ratedRangeEnd);
              const Wi = Math.min(
                0.8 ** i,
                0.25 ** (differenceInDays(C, Ti) / 365)
              );
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
            return P;
          })
        );
        await redis.set(`E.${contest}`, E);
      }
      return Response.json(E);
    }
  )
  .all("*", () => error(404));

export default {
  fetch: router.fetch,
};
