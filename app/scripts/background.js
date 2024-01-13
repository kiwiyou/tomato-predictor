import { parseISO, differenceInDays, isBefore } from 'date-fns';

const ext = global.browser || global.chrome;

ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.query === 'getArenaInfo') {
    getArenaInfo(request.contestId)
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  } else if (request.query === 'getExpectancy') {
    getExpectancy(request.arenaInfo)
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  } else if (request.query === 'getRating') {
    getRating(request.performance)
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }
  return false;
});

async function getArenaInfo(contestId) {
  const contests = await fetch(`https://solved.ac/api/v3/arena/contests`).then(
    (r) => r.json(),
  );
  for (const contest of [...contests.ongoing, ...contests.ended]) {
    if (contest.arenaBojContestId === contestId) {
      return {
        arenaId: contest.arenaId,
        startTime: contest.startTime,
        B: B[contest.ratedRangeEnd],
      };
    }
  }
  return null;
}

async function getExpectancy({ arenaId, startTime }) {
  const C = parseISO(startTime);
  const E = [];
  for (let page = 1; page <= 8; ++page) {
    const { items: contestants } = await fetch(
      `https://solved.ac/api/v3/arena/contestants?arenaId=${arenaId}&page=${page}&sort=rating&direction=desc`,
      {
        cache: 'force-cache',
      },
    ).then((r) => r.json());
    for (const { handle } of contestants) {
      const { items: contests } = await fetch(
        `https://solved.ac/api/v3/user/contests?handle=${handle}&page=1&sort=id&direction=desc`,
        {
          cache: 'force-cache',
        },
      ).then((r) => r.json());
      let numer = 0;
      let denom = 0;
      let i = 1;
      for (const {
        performance,
        arena: { startTime, ratedRangeEnd },
      } of contests) {
        const Ti = parseISO(startTime);
        if (!isBefore(Ti, C)) continue;
        const pi = unfix(performance, ratedRangeEnd);
        const Wi = Math.min(
          Math.pow(0.8, i),
          Math.pow(0.25, Math.floor(differenceInDays(C, Ti) / 365)),
        );
        numer += pi * Wi;
        denom += Wi;
        i++;
      }
      if (denom === 0) {
        const { rating } = await fetch(
          `https://solved.ac/api/v3/user/show?handle=${handle}`,
          {
            cache: 'force-cache',
          },
        ).then((r) => r.json());
        E.push(800 + Math.floor(rating / 2.4));
      } else {
        E.push(numer / denom);
      }
    }
  }
  return E;
}

async function getRating({ handle, Pi, startTime }) {
  const C = parseISO(startTime);
  const { items: contests } = await fetch(
    `https://solved.ac/api/v3/user/contests?handle=${handle}&page=1&sort=id&direction=desc`,
    {
      cache: 'force-cache',
    },
  ).then((r) => r.json());
  const c = (P) => Math.pow(2, P / 800);
  let numer = c(Pi) * 0.8;
  let denom = 0.8;
  let i = 2;
  for (const {
    performance,
    arena: { startTime },
  } of contests) {
    const Ti = parseISO(startTime);
    if (!isBefore(Ti, C)) continue;
    const Wi = Math.min(
      Math.pow(0.8, i),
      Math.pow(0.25, Math.floor(differenceInDays(Ti, C) / 365)),
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
  const { arenaRating } = await fetch(
    `https://solved.ac/api/v3/user/show?handle=${handle}`,
    {
      cache: 'force-cache',
    },
  ).then((r) => r.json());
  return {
    rating: R,
    delta: R - arenaRating,
  };
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
  Infinity,
];
function unfix(p, bi) {
  const b = B[bi];
  return p < b ? p : 2 * (p - b) + b;
}
