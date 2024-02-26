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
      .catch(() => sendResponse(null));
    return true;
  } else if (request.query === "getExpectancy") {
    getExpectancy(request.contestId)
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  } else if (request.query === "getRating") {
    getRating(request.performance)
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }
  return false;
});

async function getArenaInfo(contestId) {
  const remote = await fetch(
    `https://tomato.kiwiyou.dev/api/arena/${contestId}`,
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
    `https://tomato.kiwiyou.dev/api/expectancy/${contestId}`,
    {
      cache: "force-cache",
    },
  );
  if (!remote.ok) return null;
  return await remote.json();
}

async function getRating({ handle, Pi, startTime }) {
  const C = parseISO(startTime);
  const c = (P) => Math.pow(2, P / 800);
  let numer = c(Pi) * 0.8;
  let denom = 0.8;
  let i = 2;
  for (const { performance, startTime } of await getContests(handle)) {
    const Ti = parseISO(startTime);
    if (!isBefore(Ti, C)) continue;
    const Wi = Math.min(
      Math.pow(0.8, i),
      Math.pow(0.25, differenceInDays(Ti, C) / 365),
    );
    numer += c(performance) * Wi;
    denom += Wi;
    i++;
  }
  const N = i - 1;
  const r =
    Math.log2(numer / denom) * 800 +
    600 -
    (Math.sqrt(1 - Math.pow(0.64, N)) / (3 * (1 - Math.pow(0.8, N)))) * 1800;
  const R = Math.floor(
    r < 400
      ? Math.max(1, 400 / Math.exp((400 - r) / 400))
      : r >= 2400
        ? 800 * Math.log((r - 1600) / 800) + 2400
        : r,
  );
  const remote = await fetch(
    `https://solved.ac/api/v3/user/show?handle=${handle}`,
  );
  const { arenaRating } = await remote.json();
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
    );
    const { items, ...res } = await remote.json();
    count = res.count;
    contests.push(
      ...items.map(({ performance, arena: { startTime } }) => ({
        performance,
        startTime,
      })),
    );
    page += 1;
  } while (contests.length < count);
  return contests;
}

function unfix(p, bi) {
  const b = B[bi];
  return p < b ? p : 2 * (p - b) + b;
}
