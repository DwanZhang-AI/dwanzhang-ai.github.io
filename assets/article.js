(() => {
  const article = document.getElementById("verifier-essay");
  if (!article) return;

  const mast = article.querySelector(".ve-mast");
  const markers = [...article.querySelectorAll("[data-position]")].filter(
    node => !node.querySelector("[data-position]")
  );
  const state = () => history.state?.veArticle || {};
  const byId = id => id ? document.getElementById(id) : null;
  const readingLine = () => Math.max(0, mast.getBoundingClientRect().bottom) + 8;
  const transferKey = "verifier-article:language";

  // A case can be cited more than once in the same translated paragraph.
  const counts = new Map();
  for (const link of article.querySelectorAll('a[href^="#v"]')) {
    const paragraph = link.closest("[data-position]");
    if (!/^#v\d{2}$/.test(link.hash) || !paragraph || link.matches(".ve-permalink")) continue;
    const key = paragraph.dataset.position + "-" + link.hash.slice(1);
    const count = counts.get(key) || 0;
    counts.set(key, count + 1);
    if (!link.id) link.id = "ve-ref-" + key + "-" + count;
  }

  function readingPoint() {
    const line = readingLine();
    const linkedRow = byId(location.hash.slice(1));
    // A linked table row can leave a sliver of the previous row below the mast.
    const atLinkedRow = linkedRow?.matches(".ve-item") &&
      Math.abs(linkedRow.getBoundingClientRect().top - parseFloat(getComputedStyle(linkedRow).scrollMarginTop)) < 2;
    const marker = atLinkedRow ? linkedRow : markers.find(node => {
      const rect = node.getBoundingClientRect();
      return rect.height && rect.bottom > line;
    });
    if (!marker) return null;
    const rect = marker.getBoundingClientRect();
    return {
      key: marker.dataset.position,
      gap: Math.max(0, rect.top - line),
      fraction: Math.max(0, (line - rect.top) / rect.height),
      item: marker.closest(".ve-item")?.id
    };
  }

  function replace(entry) {
    history.replaceState({...history.state, veArticle: entry}, "");
  }

  function remember(focusId) {
    const entry = {...state(), point: readingPoint(), focusId};
    replace(entry);
    return entry;
  }

  function restore() {
    const entry = state();
    const target = byId(location.hash.slice(1));
    const source = byId(entry.sourceId);
    article.querySelector(".ve-origin-link")?.remove();
    if (source && target?.matches(".ve-item")) {
      const back = document.createElement("a");
      back.className = "ve-back ve-origin-link";
      back.href = "#" + source.id;
      back.textContent = document.documentElement.lang.startsWith("zh")
        ? "← 返回刚才读到的位置" : "← Back to where you were reading";
      target.querySelector('[data-position="' + target.id + '-title"]').prepend(back);
    }

    requestAnimationFrame(() => {
      const point = entry.point;
      const marker = point && (markers.find(node => node.dataset.position === point.key) || byId(point.key));
      if (marker) {
        const rect = marker.getBoundingClientRect();
        window.scrollBy(0, rect.top + rect.height * point.fraction - point.gap - readingLine());
      } else if (source && target?.matches(".ve-item")) {
        target.scrollIntoView({block: "start"});
        target.querySelector(".ve-permalink")?.focus({preventScroll: true});
      }
      byId(entry.focusId)?.focus({preventScroll: true});
    });
  }

  article.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button || event.ctrlKey ||
        event.metaKey || event.shiftKey || event.altKey || link.target === "_blank") return;

    if (link.matches(".ve-language")) {
      event.preventDefault();
      const entry = remember();
      const url = new URL(link.href);
      if (entry.point?.item) url.hash = entry.point.item;
      try {
        sessionStorage.setItem(transferKey, JSON.stringify({
          to: url.href, from: location.pathname, entry: {...entry, localReturn: false}
        }));
      } catch { /* The translation link still works without session storage. */ }
      location.assign(url);
    } else if (link.matches(".ve-origin-link") && state().localReturn) {
      event.preventDefault();
      history.back();
    } else if (link.getAttribute("href").startsWith("#")) {
      remember(link.id);
      if (!link.id || !/^#v\d{2}$/.test(link.hash) || link.matches(".ve-permalink")) return;
      event.preventDefault();
      history.pushState({veArticle: {sourceId: link.id, localReturn: true}}, "", link.hash);
      restore();
    }
  });

  // Pass the reading position only to the translation requested in this tab.
  try {
    const transfer = JSON.parse(sessionStorage.getItem(transferKey));
    sessionStorage.removeItem(transferKey);
    if (transfer?.to === location.href && document.referrer &&
        new URL(document.referrer).pathname === transfer.from) replace(transfer.entry);
  } catch { /* Storage is optional. */ }

  window.addEventListener("pagehide", () => remember());
  window.addEventListener("pageshow", event => { if (!event.persisted) restore(); });
  window.addEventListener("popstate", restore);
})();
