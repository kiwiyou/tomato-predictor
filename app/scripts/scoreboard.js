const ext = global.browser || global.chrome;

init();

async function init() {
  const contestId = +new URL(location.href).searchParams.get('contestId');
  if (contestId === undefined) return;
  const arenaInfo = await sendMessage({ query: 'getArenaInfo', contestId });
  console.log(arenaInfo);
  if (arenaInfo === null) return;
  const E = await sendMessage({ query: 'getExpectancy', arenaInfo });
  console.log(E);
  if (E === null) return;
  const anchors = document.querySelectorAll(
    'a[href^="https://solved.ac/profile/"]',
  );

  const updateRating = (rankSpan, anchor) => {
    const rankDiv = rankSpan.parentElement;
    rankDiv.style.flexDirection = 'column';
    const rank = +rankSpan.textContent.replace('#', '');
    const P = computeP(E, rank, arenaInfo.B);

    let perfSpan = rankDiv.getElementsByClassName('tomato-perf')[0];
    if (!perfSpan) {
      perfSpan = document.createElement('div');
      perfSpan.classList.add('tomato-perf');
      rankDiv.append(perfSpan);
    }
    let ratingSpan = rankDiv.getElementsByClassName('tomato-rating')[0];
    if (!ratingSpan) {
      ratingSpan = document.createElement('div');
      ratingSpan.classList.add('tomato-rating');
      rankDiv.append(ratingSpan);
    }

    sendMessage({
      query: 'getRating',
      performance: {
        handle: anchor.textContent,
        Pi: P,
        ...arenaInfo,
      },
    }).then((ratingInfo) => {
      if (!ratingInfo) return;
      const { rating, delta } = ratingInfo;
      perfSpan.replaceChildren(`P ${P}`);
      const sup = document.createElement('sup');
      sup.append(delta > 0 ? `+${delta}` : `${delta}`);
      if (delta < 0) sup.classList.add('tomato-neg');
      ratingSpan.replaceChildren(`R ${rating}`, sup);
    });
  };

  const observeRankChange = (mutations) => {
    for (const mutation of mutations) {
      let rankSpan = mutation.target;
      while (rankSpan.tagName !== 'SPAN') rankSpan = rankSpan.parentElement;
      const anchor =
        rankSpan.parentElement.nextElementSibling.firstElementChild;
      updateRating(rankSpan, anchor);
    }
  };

  const observeTree = (mutations) => {
    for (const mutation of mutations) {
      for (const rowDiv of mutation.addedNodes) {
        if (rowDiv.nodeType !== document.ELEMENT_NODE) continue;
        const anchor = rowDiv.querySelector(
          'a[href^="https://solved.ac/profile/"]',
        );
        if (!anchor) continue;
        const rankSpan =
          anchor.parentElement.previousElementSibling.firstElementChild;
        updateRating(rankSpan, anchor);
        new MutationObserver(observeRankChange).observe(rankSpan, {
          subtree: true,
          childList: true,
          characterData: true,
        });
      }
    }
  };

  anchors.forEach((anchor) => {
    const rankSpan =
      anchor.parentElement.previousElementSibling.firstElementChild;
    updateRating(rankSpan, anchor);
  });

  const root = document.getElementById('root');

  new MutationObserver(observeTree).observe(root, {
    subtree: true,
    childList: true,
  });
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
