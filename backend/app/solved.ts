import { redis } from "./redis";

export type Arena = {
  arenaBojContestId: number;
  arenaId: number;
  startTime: string;
  ratedRangeEnd: number;
};

export async function getCurrentArenas(): Promise<Arena[]> {
  let arenas = await redis.get<Arena[]>("arenas");
  if (arenas === null) {
    const remote = await fetch(`https://solved.ac/api/v3/arena/contests`);
    const { ongoing, ended } = await remote.json();
    arenas = [ongoing, ended]
      .flat()
      .map(({ arenaBojContestId, arenaId, startTime, ratedRangeEnd }) => ({
        arenaBojContestId,
        arenaId,
        startTime,
        ratedRangeEnd,
      }));
    await redis.set("arenas", arenas, {
      ex: 60 * 60 * 24,
    });
  }
  return arenas;
}

export async function getContestants(id: number): Promise<string[]> {
  let count = 0;
  let page = 1;
  const contestants = [];
  do {
    const url = new URL("https://solved.ac/api/v3/arena/contestants");
    url.searchParams.set("arenaId", id.toString());
    url.searchParams.set("page", page.toString());
    const remote = await fetch(url);
    const { items, ...res } = await remote.json();
    count = res.count;
    // @ts-ignore
    contestants.push(...items.map(({ handle }) => handle));
    page += 1;
  } while (contestants.length < count);
  return contestants;
}

const B = [
  0,
  1800,
  1800,
  1800,
  1800,
  2200,
  2200,
  2600,
  2600,
  3000,
  3000,
  3400,
  3400,
  "Infinity",
];

export function unfix(p: number, bi: number): number {
  const b = +B[bi];
  return p < b ? p : 2 * (p - b) + b;
}

export type Contest = {
  performance: number;
  ratingBefore: number;
  ratingAfter: number;
  startTime: string;
  endTime: string;
  ratedRangeStart: number;
  ratedRangeEnd: number;
};

export async function getContests(handle: string): Promise<Contest[]> {
  let contests = await redis.get<Contest[]>(`contests.${handle}`);
  if (contests === null) {
    let count = 0;
    let page = 1;
    contests = [];
    do {
      const url = new URL("https://solved.ac/api/v3/user/contests");
      url.searchParams.set("handle", handle);
      url.searchParams.set("page", page.toString());
      console.log(url.toString());
      const remote = await fetch(url);
      const { items, ...res } = await remote.json();
      count = +res.count;
      contests.push(
        ...items.map(
          ({
            // @ts-ignore
            performance,
            // @ts-ignore
            ratingBefore,
            // @ts-ignore
            ratingAfter,
            // @ts-ignore
            arena: { startTime, endTime, ratedRangeStart, ratedRangeEnd },
          }) => ({
            performance,
            ratingBefore,
            ratingAfter,
            startTime,
            endTime,
            ratedRangeStart,
            ratedRangeEnd,
          }),
        ),
      );
      page += 1;
    } while (contests.length < count);
    await redis.set(`contests.${handle}`, contests, {
      ex: 60 * 60 * 24,
    });
  }
  return contests;
}
