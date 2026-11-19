(() => {
  const checklist = document.getElementById("ve-checklist");
  if (!checklist) return;

  const groups = [...checklist.querySelectorAll("details.ve-group")];
  const mast = document.querySelector(".ve-mast");
  const transferKey = "verifier-article:language";
  const markers = [...document.querySelectorAll("[data-position]")].filter(
    node => !node.querySelector("[data-position]")
  );
  const byId = id => id ? document.getElementById(id) : null;
  const current = () => history.state?.veArticle || {};
  const openGroups = () => groups.filter(group => group.open).map(group => group.id);
  const readingLine = () => Math.max(0, mast.getBoundingClientRect().bottom) + 8;
  const caseLink = link => /^#v\d{2}$/.test(link.getAttribute("href"));

  // Give every citation a bilingual, shareable return address.
  const counts = new Map();
  for (const link of document.querySelectorAll('a[href^="#v"]')) {
    const marker = link.closest("[data-position]");
    if (!caseLink(link) || !marker || link.id || link.closest(".ve-item")?.id === link.hash.slice(1)) continue;
    const key = marker.dataset.position + "-" + link.hash.slice(1);
    const count = counts.get(key) || 0;
    counts.set(key, count + 1);
    link.id = "ve-ref-" + key + "-" + count;
  }

  function readingPoint() {
    const line = readingLine();
    for (const marker of markers) {
      if (marker.closest("details:not([open])") && !marker.matches("summary")) continue;
      const rect = marker.getBoundingClientRect();
      if (rect.height && rect.bottom > line) {
        return {
          key: marker.dataset.position,
          gap: Math.max(0, rect.top - line),
          fraction: Math.max(0, (line - rect.top) / rect.height),
          item: marker.closest(".ve-item")?.id
        };
      }
    }
    return null;
  }

  function snapshot(focusId) {
    return {...current(), groups: openGroups(), point: readingPoint(), focusId};
  }

  function replace(state, url = location.href) {
    history.replaceState({...history.state, veArticle: state}, "", url);
  }

  function applyGroups(expanded) {
    if (expanded) groups.forEach(group => { group.open = expanded.includes(group.id); });
  }

  function restore(state) {
    const target = byId(location.hash.slice(1));
    applyGroups(state.groups);
    const item = target?.closest(".ve-item");
    if (item) item.closest("details").open = true;

    document.querySelector(".ve-origin-link")?.remove();
    if (item && state.origin) {
      const back = document.createElement("a");
      back.className = "ve-back ve-origin-link";
      back.href = "#" + state.origin.id;
      back.textContent = document.documentElement.lang.startsWith("zh")
        ? "← 返回刚才读到的位置" : "← Back to where you were reading";
      item.prepend(back);
    }

    requestAnimationFrame(() => restorePosition(state, target));
  }

  function restorePosition(state, target) {
    const point = state.point;
    const marker = point && markers.find(node => node.dataset.position === point.key);
    if (marker) {
      const rect = marker.getBoundingClientRect();
      window.scrollBy(0, rect.top + rect.height * point.fraction - point.gap - readingLine());
    } else if (target) {
      target.scrollIntoView({block: "start"});
    }
    // Transfer focus only for explicit jumps. Reading-position restoration never
    // makes ordinary prose focusable when switching language or reloading.
    const focusTarget = byId(state.focusId);
    if (focusTarget) {
      const control = focusTarget.matches("a, summary") ? focusTarget : focusTarget.querySelector("h4 a");
      control?.focus({preventScroll: true});
    }
  }

  function navigate(hash, state, source) {
    if (location.hash !== hash) {
      replace(snapshot(source?.id));
      history.pushState({veArticle: state}, "", hash);
    } else {
      replace(state);
    }
    restore(state);
  }

  function translate(link) {
    const url = new URL(link.href);
    const state = snapshot();
    if (state.point?.item) url.hash = state.point.item;
    const transfer = {to: url.href, from: location.pathname, state: {...state, steps: 0}};
    try {
      sessionStorage.setItem(transferKey, JSON.stringify(transfer));
    } catch { /* Ordinary navigation still works when storage is disabled. */ }
    replace(state);
    location.assign(url);
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button || event.ctrlKey ||
        event.metaKey || event.shiftKey || event.altKey || link.target === "_blank") return;
    if (link.matches(".ve-language")) {
      event.preventDefault();
      translate(link);
      return;
    }

    const state = current();
    if (link.matches(".ve-origin-link") && state.origin) {
      event.preventDefault();
      if (state.steps) history.go(-state.steps);
      else navigate(link.hash, {groups: state.origin.groups, focusId: state.origin.id});
    } else if (link.matches(".ve-group-back, .ve-index-link")) {
      event.preventDefault();
      navigate(link.hash, {groups: [], focusId: groups[0].querySelector("summary").id}, link);
    } else if (caseLink(link) && byId(link.hash.slice(1))) {
      event.preventDefault();
      const id = link.hash.slice(1);
      const self = location.hash === link.hash;
      let origin = state.origin;
      let steps = state.steps || 0;
      if (!self && link.id && (!origin || !link.closest(".ve-item"))) {
        origin = {id: link.id, groups: openGroups()};
        steps = 1;
      } else if (!self && steps) {
        steps++;
      }
      const group = byId(id).closest("details");
      const expanded = openGroups();
      if (!expanded.includes(group.id)) expanded.push(group.id);
      navigate(link.hash, {groups: expanded, origin, steps, focusId: id}, link);
    }
  });

  // Native summary controls keep their keyboard behaviour and their history entry.
  for (const group of groups) group.addEventListener("toggle", () => {
    const state = current();
    const expanded = openGroups();
    if (state.groups?.join() === expanded.join()) return;
    const closedTarget = !group.open && group.contains(byId(location.hash.slice(1)));
    const url = closedTarget ? "#" + group.querySelector("summary").id : location.href;
    replace({...state, groups: expanded, point: null, focusId: null}, url);
  });

  try {
    const transfer = JSON.parse(sessionStorage.getItem(transferKey));
    sessionStorage.removeItem(transferKey);
    if (transfer?.to === location.href && document.referrer &&
        new URL(document.referrer).pathname === transfer.from) replace(transfer.state);
  } catch { /* Storage is optional. */ }

  window.addEventListener("pagehide", () => replace(snapshot()));
  // Apply saved groups before the browser reports a native fragment reveal.
  // Otherwise an early toggle event can overwrite the other expanded groups.
  applyGroups(current().groups);
  const restoreEntry = () => restore(current());
  window.addEventListener("pageshow", event => { if (!event.persisted) restoreEntry(); });
  window.addEventListener("popstate", restoreEntry);
})();
