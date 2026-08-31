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
  /* Anything the shell injects is marked, so edit.js can strip it back out
     before saving. What is on screen and what is on disk stay the same page. */
  function chrome(el) { el.setAttribute('data-sb-chrome', ''); return el; }

  function ensureChrome() {
    var side = document.querySelector('.sb-side');
    if (!side) {
      side = chrome(document.createElement('aside'));
      side.className = 'sb-side';
      side.id = 'sbSide';
      side.innerHTML = '<div class="sb-side-header"></div><nav aria-label="Pages" data-sb-nav></nav>';
      document.body.insertBefore(side, document.body.firstChild);
    }
    if (!document.querySelector('.sb-scrim')) {
      var scrim = chrome(document.createElement('div'));
      scrim.className = 'sb-scrim';
      document.body.appendChild(scrim);
    }
    if (!document.querySelector('.sb-side-toggle')) {
      var toggle = chrome(document.createElement('button'));
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

  function link(page, here, list, index) {
    var row = document.createElement('div');
    row.className = 'sb-nav-row';
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
    row.appendChild(a);
    if (list) row.appendChild(rowMenu(page, list, index));
    return row;
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
    g.items.forEach(function (p, i) { kids.appendChild(link(p, here, g.items, i)); });

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
    /* The way out of a workspace is a plain link to a kernel route, so it
       still works when everything else on the page is broken. */
    var name = document.createElement('a');
    name.className = 'sb-logo-text';
    name.href = '/_hub';
    name.title = 'Switch workspace';
    name.textContent = nav.workspace;
    header.appendChild(name);
  }

  /* Changing where a page sits in the menu means changing the page, because
     the menu is read from the pages. Fetch it, set the meta tag, put it back.
     Nothing else knows the order, so nothing else can disagree about it. */
  function patchPage(href, changes) {
    return fetch('/' + href)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        Object.keys(changes).forEach(function (key) {
          var value = changes[key];
          var el = doc.querySelector('meta[name="scrapbook:' + key + '"]');
          if (value === null || value === '') {
            if (el && el.parentNode) el.parentNode.removeChild(el);
            return;
          }
          if (!el) {
            el = doc.createElement('meta');
            el.setAttribute('name', 'scrapbook:' + key);
            doc.head.appendChild(el);
          }
          el.setAttribute('content', String(value));
        });
        return fetch('/' + href, {
          method: 'PUT',
          body: '<!doctype html>\n' + doc.documentElement.outerHTML + '\n'
        });
      });
  }

  /* Moving one page renumbers the whole list it lives in. Only some pages
     carry an order, so shuffling a single number leaves gaps and ties that
     read as random. Writing all of them is a few more saves and no ambiguity. */
  function move(list, index, delta) {
    var next = index + delta;
    if (next < 0 || next >= list.length) return;
    var reordered = list.slice();
    var moved = reordered.splice(index, 1)[0];
    reordered.splice(next, 0, moved);
    Promise.all(reordered.map(function (p, i) {
      return patchPage(p.href, { order: i + 1 });
    })).then(refresh);
  }

  function moveToGroup(page) {
    var group = window.prompt('Which folder? Leave empty for none.', page.group || '');
    if (group === null) return;
    patchPage(page.href, { group: group.trim() || null }).then(refresh);
  }

  function renamePage(page) {
    var label = window.prompt('Call it what?', page.label);
    if (label === null || !label.trim()) return;
    patchPage(page.href, { label: label.trim() }).then(refresh);
  }

  function rowMenu(page, list, index) {
    var wrap = document.createElement('div');
    wrap.className = 'sb-nav-menu';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sb-nav-menu-btn';
    btn.title = 'More';
    btn.innerHTML = '<svg viewBox="0 0 14 4" fill="currentColor" aria-hidden="true">' +
      '<circle cx="2" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="12" cy="2" r="1.3"/></svg>';

    var menu = document.createElement('div');
    menu.className = 'sb-nav-menu-list';
    menu.hidden = true;
    [
      ['Move up', function () { move(list, index, -1); }],
      ['Move down', function () { move(list, index, 1); }],
      ['Move to folder', function () { moveToGroup(page); }],
      ['Rename', function () { renamePage(page); }]
    ].forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = item[0];
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        menu.hidden = true;
        item[1]();
      });
      menu.appendChild(b);
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var opening = menu.hidden;
      closeMenus();
      menu.hidden = !opening;
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    return wrap;
  }

  function closeMenus() {
    Array.prototype.forEach.call(document.querySelectorAll('.sb-nav-menu-list'), function (m) {
      m.hidden = true;
    });
  }

  function newPage() {
    var title = window.prompt('What is the page called?');
    if (title === null) return;
    fetch('/_new', {
      method: 'POST',
      body: JSON.stringify({ title: title.trim() || 'Untitled' })
    })
      .then(function (r) { return r.json(); })
      .then(function (made) { location.href = '/' + made.href; })
      .catch(function () { window.alert('Could not create that page.'); });
  }

  function addButton() {
    var wrap = document.createElement('div');
    wrap.className = 'sb-nav-add';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sb-nav-add-btn';
    btn.textContent = '+  New page';
    btn.addEventListener('click', newPage);
    wrap.appendChild(btn);
    return wrap;
  }

  function render(host, nav) {
    var here = currentHref();
    var openState = readJSON(GROUPS_KEY, {});
    host.innerHTML = '';
    nav.pages.forEach(function (p, i) { host.appendChild(link(p, here, nav.pages, i)); });
    nav.groups.forEach(function (g) {
      /* A group holding the page you are on opens regardless of what you
         last collapsed, so the menu never hides where you actually are. */
      var holdsCurrent = g.items.some(function (p) { return p.href === here; });
      host.appendChild(group(g, here, holdsCurrent || openState[g.label] !== false));
    });
    host.appendChild(addButton());
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

  var navHost = null;

  function refresh() {
    if (!navHost) return;
    fetch('/_nav.json')
      .then(function (r) { return r.json(); })
      .then(function (nav) { render(navHost, nav); });
  }

  function boot() {
    var side = ensureChrome();
    wireCollapse();
    var host = side.querySelector('[data-sb-nav]');
    navHost = host;
    document.addEventListener('click', closeMenus);
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
