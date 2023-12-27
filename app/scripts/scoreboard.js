const ext = global.browser || global.chrome;

init();

async function init() {
  const contestId = +new URL(location.href).searchParams.get('contestId');
  if (contestId === undefined) return;
  const arenaInfo = await sendMessage({ query: 'getArenaInfo', contestId });
  if (arenaInfo === null) return;
  const E = await sendMessage({ query: 'getExpectancy', arenaInfo });
  const anchors = document.querySelectorAll(
    'a[href^="https://solved.ac/profile/"]',
  );
  for (const anchor of anchors) {
    const rankDiv = anchor.parentElement.previousElementSibling;
    const rank = +rankDiv.textContent.replace('#', '');
    const P = computeP(E, rank, arenaInfo.B);
    sendMessage({
      query: 'getRating',
      performance: {
        handle: anchor.textContent,
        Pi: P,
        ...arenaInfo,
      },
    }).then((ratingInfo) => {
      if (ratingInfo === null) return;
      const { rating, delta } = ratingInfo;
      const perfSpan = document.createElement('div');
      perfSpan.classList.add('tomato-perf');
      perfSpan.append(`P ${P}`);
      const ratingSpan = document.createElement('div');
      ratingSpan.classList.add('tomato-rating');
      ratingSpan.append(`R ${rating}`);
      const sup = document.createElement('sup');
      sup.append(delta > 0 ? `+${delta}` : `${delta}`);
      if (delta < 0) sup.classList.add('tomato-neg');
      ratingSpan.append(sup);
      rankDiv.append(perfSpan, ratingSpan);
      rankDiv.style.flexDirection = 'column';
    });
  }
}

function sendMessage(args) {
  return new Promise((resolve) => ext.runtime.sendMessage(args, resolve));
}

function computeP(E, k, B) {
  let l = 0,
    r = 4000;
  while (r - l > 1e-2) {
    const X = (l + r) / 2;
    let s = 0;
    for (const Ei of E) {
      s += 1 / (1 + Math.pow(10, (X - Ei) / 400));
    }
    if (s > k - 0.5) {
      l = X;
    } else {
      r = X;
    }
  }
  const pi = (l + r) / 2;
  return Math.floor(pi < B ? pi : (pi - B) / 2 + B);
}
