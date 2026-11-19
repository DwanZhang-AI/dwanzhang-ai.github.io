(() => {
  const checklist = document.getElementById("ve-checklist");
  if (!checklist) return;

  const summary = document.getElementById("ve-list-toggle");
  const masthead = document.querySelector(".ve-mast");
  const languageLink = document.querySelector("a.ve-language");
  const transferKey = "verifier-article:language";
  const markers = [...document.querySelectorAll("[data-position]")].filter(
    element => !element.querySelector("[data-position]")
  );
  const current = () => history.state?.veArticle || {};
  const caseId = hash => /^#v\d{2}$/.test(hash) ? hash.slice(1) : null;
  const readingLine = () => Math.max(0, masthead?.getBoundingClientRect().bottom || 0) + 8;

  // A return link can point to a specific mention, even when a case is cited twice.
  const occurrences = new Map();
  for (const link of document.querySelectorAll('a[href^="#v"]')) {
    const target = caseId(link.hash);
    const marker = link.closest("[data-position]");
    if (!target || !marker || checklist.contains(link) || link.id) continue;
    const key = marker.dataset.position + "-" + target;
    const count = occurrences.get(key) || 0;
    occurrences.set(key, count + 1);
    link.id = "ve-ref-" + key + "-" + count;
  }

  function position() {
    const line = readingLine();
    for (const marker of markers) {
      if (!checklist.open && checklist.contains(marker) && marker !== summary) continue;
      const rect = marker.getBoundingClientRect();
      if (!rect.height || rect.bottom < line) continue;
      // Keep the gap before a paragraph, or the fraction already read inside it.
      return {
        key: marker.dataset.position,
        gap: Math.max(0, rect.top - line),
        fraction: Math.max(0, (line - rect.top) / rect.height)
      };
    }
    return null;
  }

  function focus(element) {
    if (!element) return;
    if (!element.matches("a[href], summary, [tabindex]")) element.tabIndex = -1;
    element.focus({preventScroll: true});
  }

  function replace(state, url = location.href) {
    history.replaceState({...history.state, veArticle: state}, "", url);
  }

  function snapshot(focusId) {
    return {...current(), open: checklist.open, point: position(), focusId};
  }

  function renderReturn(state) {
    document.querySelector(".ve-origin-link")?.remove();
    const item = document.getElementById(caseId(location.hash));
    if (!item || !state.origin) return;
    const back = document.createElement("a");
    back.className = "ve-back ve-origin-link";
    back.href = "#" + state.origin.id;
    back.textContent = document.documentElement.lang.startsWith("zh")
      ? "← 返回刚才读到的位置" : "← Back to where you were reading";
    item.prepend(back);
  }

  function restore(state) {
    const item = document.getElementById(caseId(location.hash));
    checklist.open = state.open ?? Boolean(item);
    renderReturn(state);
    const marker = state.point && markers.find(node => node.dataset.position === state.point.key);
    const destination = document.getElementById(state.focusId || location.hash.slice(1));
    if (marker) {
      const rect = marker.getBoundingClientRect();
      window.scrollBy(0, rect.top + rect.height * state.point.fraction - state.point.gap - readingLine());
      if (state.focusId) focus(destination);
    } else if (destination) {
      destination.scrollIntoView({block: "start"});
      focus(destination);
    }
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
        event.metaKey || event.shiftKey || event.altKey || link.target === "_blank") return;

    if (link === languageLink) {
      const url = new URL(link.href);
      if (url.origin !== location.origin) return;
      if (caseId(location.hash) && checklist.open) url.hash = location.hash;
      const state = snapshot();
      try {
        sessionStorage.setItem(transferKey, JSON.stringify({
          url: url.href, from: location.pathname, state: {...state, steps: 0}
        }));
      } catch { /* Storage may be unavailable; the ordinary translation link still works. */ }
      replace(state);
      event.preventDefault();
      location.assign(url);
      return;
    }

    const hash = link.getAttribute("href");
    if (link.classList.contains("ve-back")) {
      event.preventDefault();
      const state = current();
      const origin = link.classList.contains("ve-origin-link") && state.origin;
      if (origin && state.steps > 0) {
        history.go(-state.steps);
        return;
      }
      replace(snapshot());
      const id = origin ? origin.id : summary.id;
      const next = {open: Boolean(origin && origin.open), focusId: id};
      history.pushState({veArticle: next}, "", "#" + id);
      restore(next);
      return;
    }

    const id = caseId(hash);
    if (!id || !document.getElementById(id)) return;
    event.preventDefault();
    if (location.hash === hash && checklist.contains(link)) {
      restore({...current(), open: true, point: null, focusId: id});
      return;
    }
    const state = current();
    const fromBody = !checklist.contains(link) && Boolean(link.id);
    const origin = fromBody ? {id: link.id, open: checklist.open} : state.origin;
    replace(snapshot(link.id));
    const next = {open: true, origin, steps: fromBody ? 1 : state.steps > 0 ? state.steps + 1 : 0};
    history.pushState({veArticle: next}, "", hash);
    restore(next);
  });

  // Consume the transfer on the destination page. Opening a new tab or visiting
  // the homepage later must not inherit the previous reader's language or place.
  try {
    const transfer = JSON.parse(sessionStorage.getItem(transferKey));
    sessionStorage.removeItem(transferKey);
    if (transfer?.url === location.href && document.referrer &&
        new URL(document.referrer).pathname === transfer.from) replace(transfer.state);
  } catch { /* Private browsing can disable session storage. */ }

  // Run after the browser's native scroll/fragment restoration on each traversal.
  const restoreEntry = () => requestAnimationFrame(() => restore(current()));
  window.addEventListener("popstate", restoreEntry);
  window.addEventListener("pageshow", restoreEntry);
})();
