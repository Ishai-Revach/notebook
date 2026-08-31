/* Scrapbook shell. A page links this once, before </body>, and gets the
   sidebar, the menu and the collapse behaviour. The menu is read from the
   workspace at /_nav.json, so writing a new html file is all it takes to
   appear in it. Nothing is registered and nothing is built.

   This file is yours. It is vendored into your workspace as ordinary source,
   so change it. `sbk update` merges new versions around your edits. */
(function () {
  var root = document.documentElement;
  var COLLAPSE_KEY = 'sb_side_collapsed';
  var GROUPS_KEY = 'sb_nav_groups';

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* A page carries no sidebar markup of its own. Anything it would have to
     remember to include is something it can get wrong, so the shell builds
     the whole thing. */
  function ensureChrome() {
    var side = document.querySelector('.sb-side');
    if (!side) {
      side = document.createElement('aside');
      side.className = 'sb-side';
      side.id = 'sbSide';
      side.innerHTML = '<div class="sb-side-header"></div><nav aria-label="Pages" data-sb-nav></nav>';
      document.body.insertBefore(side, document.body.firstChild);
    }
    if (!document.querySelector('.sb-scrim')) {
      var scrim = document.createElement('div');
      scrim.className = 'sb-scrim';
      document.body.appendChild(scrim);
    }
    if (!document.querySelector('.sb-side-toggle')) {
      var toggle = document.createElement('button');
      toggle.className = 'sb-side-toggle';
      toggle.id = 'sbSideToggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-label', 'Toggle the menu');
      toggle.innerHTML =
        '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">' +
        '<path d="M2 4h12M2 8h12M2 12h12"/></svg>';
      document.body.insertBefore(toggle, document.body.firstChild);
    }
    return side;
  }

  function currentHref() {
    var path = location.pathname.replace(/^\//, '');
    return path === '' ? 'index.html' : decodeURIComponent(path);
  }

  function link(page, here) {
    var a = document.createElement('a');
    a.className = 'sb-nav-link';
    a.href = '/' + page.href;
    if (page.href === here) {
      a.classList.add('is-current');
      a.setAttribute('aria-current', 'page');
    }
    var label = document.createElement('span');
    label.className = 'sb-nav-label';
    label.textContent = page.label;
    a.appendChild(label);
    return a;
  }

  function group(g, here, open) {
    var wrap = document.createElement('div');
    wrap.className = 'sb-nav-group';

    var row = document.createElement('div');
    row.className = 'sb-nav-group-btn' + (open ? '' : ' sb-nav-group-btn--closed');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-expanded', open ? 'true' : 'false');
    row.innerHTML =
      '<svg class="sb-nav-caret" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">' +
      '<path d="M4 2l4 4-4 4z"/></svg>';

    var label = document.createElement('span');
    label.className = 'sb-nav-label';
    label.textContent = g.label;
    row.appendChild(label);

    var kids = document.createElement('div');
    kids.className = 'sb-nav-children';
    kids.hidden = !open;
    g.items.forEach(function (p) { kids.appendChild(link(p, here)); });

    function toggle() {
      var nowOpen = kids.hidden;
      kids.hidden = !nowOpen;
      row.classList.toggle('sb-nav-group-btn--closed', !nowOpen);
      row.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
      var state = readJSON(GROUPS_KEY, {});
      state[g.label] = nowOpen;
      writeJSON(GROUPS_KEY, state);
    }
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    wrap.appendChild(row);
    wrap.appendChild(kids);
    return wrap;
  }

  function renderHeader(nav) {
    var header = document.querySelector('.sb-side-header');
    if (!header || header.children.length || !nav.workspace) return;
    var name = document.createElement('span');
    name.className = 'sb-logo-text';
    name.textContent = nav.workspace;
    header.appendChild(name);
  }

  function render(host, nav) {
    var here = currentHref();
    var openState = readJSON(GROUPS_KEY, {});
    host.innerHTML = '';
    nav.pages.forEach(function (p) { host.appendChild(link(p, here)); });
    nav.groups.forEach(function (g) {
      /* A group holding the page you are on opens regardless of what you
         last collapsed, so the menu never hides where you actually are. */
      var holdsCurrent = g.items.some(function (p) { return p.href === here; });
      host.appendChild(group(g, here, holdsCurrent || openState[g.label] !== false));
    });
    if (!nav.pages.length && !nav.groups.length) {
      var empty = document.createElement('div');
      empty.className = 'sb-nav-empty';
      empty.textContent = 'No pages yet.';
      host.appendChild(empty);
    }
  }

  function wireCollapse() {
    var toggle = document.getElementById('sbSideToggle');
    var scrim = document.querySelector('.sb-scrim');
    function isCollapsed() { return root.classList.contains('sb-collapsed'); }
    function setCollapsed(collapsed) {
      root.classList.toggle('sb-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (e) {}
    }
    toggle.addEventListener('click', function () { setCollapsed(!isCollapsed()); });
    if (scrim) scrim.addEventListener('click', function () { setCollapsed(true); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !isCollapsed() && window.matchMedia('(max-width: 760px)').matches) {
        setCollapsed(true);
      }
    });
    setCollapsed(isCollapsed());
  }

  function boot() {
    var side = ensureChrome();
    wireCollapse();
    var host = side.querySelector('[data-sb-nav]');
    fetch('/_nav.json')
      .then(function (r) { return r.json(); })
      .then(function (nav) { renderHeader(nav); render(host, nav); })
      .catch(function () {
        /* Opened straight off disk, with no server to ask. The page itself
           still reads fine, so say so quietly rather than breaking. */
        host.innerHTML = '<div class="sb-nav-empty">Menu needs the workspace running.</div>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
