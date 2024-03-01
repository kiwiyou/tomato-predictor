import { parseISO, differenceInDays, isBefore } from "date-fns";

const ext = global.browser || global.chrome;

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

ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.query === "getArenaInfo") {
    getArenaInfo(request.contestId)
      .then(sendResponse)
      .catch((e) => {
        console.error(e);
        sendResponse(null);
      });
    return true;
  }
  if (request.query === "getExpectancy") {
    getExpectancy(request.contestId)
      .then(sendResponse)
      .catch((e) => {
        console.error(e);
        sendResponse(null);
      });
    return true;
  }
  if (request.query === "getRating") {
    getRating(request.performance)
      .then(sendResponse)
      .catch((e) => {
        console.error(e);
        sendResponse(null);
      });
    return true;
  }
  return false;
});

async function getArenaInfo(contestId) {
  const remote = await fetch(
    `https://tomato-predictor.vercel.app/arena/${contestId}`
  );
  if (!remote.ok) return null;
  const { arenaId, startTime, ratedRangeEnd } = await remote.json();
  return {
    arenaId,
    startTime,
    B: B[ratedRangeEnd],
  };
}

async function getExpectancy(contestId) {
  const remote = await fetch(
    `https://tomato-predictor.vercel.app/expectancy/${contestId}`
  );
  if (!remote.ok) return null;
  return await remote.json();
}

async function getRating({ handle, arenaId, Pi, startTime }) {
  const C = parseISO(startTime);
  const c = (P) => 2 ** (P / 800);
  let numer = c(Pi) * 0.8;
  let denom = 0.8;
  let i = 2;
  const contests = await getContests(handle);
  for (const { performance, startTime } of contests) {
    const Ti = parseISO(startTime);
    if (!isBefore(Ti, C)) continue;
    const Wi = Math.min(0.8 ** i, 0.25 ** (differenceInDays(Ti, C) / 365));
    numer += c(performance) * Wi;
    denom += Wi;
    i++;
  }
  const N = i - 1;
  const r =
    Math.log2(numer / denom) * 800 +
    600 -
    (Math.sqrt(1 - 0.64 ** N) / (3 * (1 - 0.8 ** N))) * 1800;
  const R = Math.floor(
    r < 400
      ? Math.max(1, 400 / Math.exp((400 - r) / 400))
      : r >= 2400
        ? 800 * Math.log((r - 1600) / 800) + 2400
        : r
  );
  const thatArena = contests.find((arena) => arena.arenaId === arenaId);
  let arenaRating = 0;
  if (!thatArena) {
    const remote = await fetch(
      `https://solved.ac/api/v3/user/show?handle=${handle}`,
      {
        cache: "force-cache",
      }
    );
    const res = await remote.json();
    arenaRating = res.arenaRating;
  } else {
    arenaRating = thatArena.ratingBefore;
  }
  return {
    rating: R,
    delta: R - arenaRating,
  };
}

async function getContests(handle) {
  let count = 0;
  let page = 1;
  const contests = [];
  do {
    const remote = await fetch(
      `https://solved.ac/api/v3/user/contests?handle=${handle}&page=${page}`,
      { cache: "force-cache" }
    );
    const { items, ...res } = await remote.json();
    if (res.count === 0) break;
    count = res.count;
    contests.push(
      ...items.map(
        ({ arenaId, performance, ratingBefore, arena: { startTime } }) => ({
          arenaId,
          performance,
          startTime,
          ratingBefore,
        })
      )
    );
    page += 1;
  } while (contests.length < count);
  return contests;
}
