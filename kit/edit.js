/* Authoring. A page is editable without an agent, without a build step and
   without a mode you have to learn: press Edit, type, press Done.

   What gets saved is the document itself, minus the chrome this file and
   shell.js inject. That is why every injected node carries data-sb-chrome:
   the save is a clone of the page with those nodes removed, so what is on
   screen and what is on disk cannot drift apart.

   This file is yours. `sbk update` merges new versions around your edits. */
(function () {
  var root = document.documentElement;
  var article = document.querySelector('.article');
  if (!article) return;
  /* A page that says it is an app runs its own thing. Turning it into
     editable prose would break the very controls someone came here for. */
  if (document.querySelector('meta[name="scrapbook:app"][content="true"]')) return;

  var dirty = false;
  var saveTimer = null;
  var stateEl = null;

  function chrome(el) { el.setAttribute('data-sb-chrome', ''); return el; }

  function button(cls, label, title, onClick) {
    var b = chrome(document.createElement('button'));
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', onClick);
    return b;
  }

  /* ---- saving ---------------------------------------------------------- */

  function serialize() {
    var copy = document.documentElement.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll('[data-sb-chrome]'), function (n) {
      n.parentNode.removeChild(n);
    });
    Array.prototype.forEach.call(copy.querySelectorAll('[contenteditable]'), function (n) {
      n.removeAttribute('contenteditable');
      n.removeAttribute('spellcheck');
    });
    copy.className = copy.className.replace(/\bsb-editing\b/g, '').trim();
    if (!copy.className) copy.removeAttribute('class');
    return '<!doctype html>\n' + copy.outerHTML + '\n';
  }

  function say(text) { if (stateEl) stateEl.textContent = text; }

  function save() {
    clearTimeout(saveTimer);
    if (!dirty) return Promise.resolve();
    var body = serialize();
    dirty = false;
    say('Saving');
    return fetch(location.pathname, { method: 'PUT', body: body })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        say('Saved');
      })
      .catch(function () {
        /* Put the flag back up. Nothing is lost from the page, and the next
           keystroke or the Done button will try again. */
        dirty = true;
        say('Not saved');
      });
  }

  function touch() {
    dirty = true;
    say('Editing');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 900);
  }

  /* ---- formatting ------------------------------------------------------ */

  /* document.execCommand is deprecated and still the only thing every browser
     implements for rich text in a contenteditable. The replacement is writing
     a selection model, which is a project of its own.
     ponytail: revisit if a browser actually drops it. */
  function cmd(name, value) {
    return function () {
      document.execCommand(name, false, value || null);
      article.focus();
      touch();
      syncTools();
    };
  }

  function block(tag) {
    return function () {
      var current = document.queryCommandValue('formatBlock');
      document.execCommand('formatBlock', false, String(current).toLowerCase() === tag ? 'p' : tag);
      article.focus();
      touch();
      syncTools();
    };
  }

  function addLink() {
    var url = window.prompt('Link to where?', 'https://');
    if (url) cmd('createLink', url)();
  }

  /* A text box is positioned, so it adds nothing to the article's height, and
     the article shrink-wraps its text. Drop a box below the last paragraph and
     it lands outside the page's own box, where the scroll container clips it.
     Grow the article to cover the lowest box instead. The min-height is saved
     with the page, so it still lays out correctly opened on its own. */
  function fitBoxes() {
    var boxes = article.querySelectorAll('.sb-textbox');
    if (!boxes.length) { article.style.minHeight = ''; return; }
    var lowest = 0;
    Array.prototype.forEach.call(boxes, function (b) {
      lowest = Math.max(lowest, b.offsetTop + b.offsetHeight);
    });
    article.style.minHeight = (lowest + 24) + 'px';
  }

  function addTextBox() {
    var box = document.createElement('div');
    box.className = 'sb-textbox';
    box.style.left = '24px';
    box.style.top = '24px';
    box.textContent = 'Text box';
    article.appendChild(box);
    fitBoxes();
    touch();
  }

  var TOOLS = [
    ['B', 'Bold', cmd('bold'), 'bold'],
    ['I', 'Italic', cmd('italic'), 'italic'],
    [null],
    ['H2', 'Heading', block('h2'), null],
    ['H3', 'Smaller heading', block('h3'), null],
    ['Quote', 'Quote', block('blockquote'), null],
    [null],
    ['List', 'Bulleted list', cmd('insertUnorderedList'), 'insertUnorderedList'],
    ['1. List', 'Numbered list', cmd('insertOrderedList'), 'insertOrderedList'],
    [null],
    ['Link', 'Add a link', addLink, null],
    ['Text box', 'Add a text box you can move', addTextBox, null],
  ];

  var toolButtons = [];

  function syncTools() {
    toolButtons.forEach(function (entry) {
      if (!entry.query) return;
      var on = false;
      try { on = document.queryCommandState(entry.query); } catch (e) {}
      entry.el.classList.toggle('sb-tool--on', on);
    });
  }

  function buildToolbar() {
    var bar = chrome(document.createElement('div'));
    bar.className = 'sb-toolbar';
    TOOLS.forEach(function (t) {
      if (t[0] === null) {
        var sep = chrome(document.createElement('span'));
        sep.className = 'sb-tool-sep';
        bar.appendChild(sep);
        return;
      }
      var b = button('sb-tool', t[0], t[1], t[2]);
      bar.appendChild(b);
      toolButtons.push({ el: b, query: t[3] });
    });
    stateEl = chrome(document.createElement('span'));
    stateEl.className = 'sb-tool-state';
    bar.appendChild(stateEl);
    return bar;
  }

  /* ---- dragging a text box --------------------------------------------- */

  function wireDragging() {
    var dragging = null;
    article.addEventListener('mousedown', function (e) {
      if (!root.classList.contains('sb-editing')) return;
      var box = e.target.closest ? e.target.closest('.sb-textbox') : null;
      /* Only the edge drags. Clicking into the middle is how you type in it. */
      if (!box || e.target !== box) return;
      var rect = box.getBoundingClientRect();
      var host = article.getBoundingClientRect();
      dragging = { box: box, dx: e.clientX - rect.left, dy: e.clientY - rect.top, host: host };
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var box = dragging.box;
      // Never past the right edge, or the page scrolls sideways to reach it.
      var maxLeft = Math.max(0, article.clientWidth - box.offsetWidth);
      var left = Math.min(maxLeft, Math.max(0, e.clientX - dragging.host.left - dragging.dx));
      box.style.left = left + 'px';
      box.style.top = Math.max(0, e.clientY - dragging.host.top - dragging.dy) + 'px';
    });
    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = null;
      fitBoxes();
      touch();
    });
  }

  /* ---- mode ------------------------------------------------------------ */

  var toolbar = null;

  function setEditing(on) {
    root.classList.toggle('sb-editing', on);
    editBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    editBtn.textContent = on ? 'Done' : 'Edit';

    if (on) {
      article.setAttribute('contenteditable', 'true');
      article.setAttribute('spellcheck', 'true');
      if (!toolbar) toolbar = buildToolbar();
      document.body.appendChild(toolbar);
      article.focus();
      say('');
    } else {
      article.removeAttribute('contenteditable');
      article.removeAttribute('spellcheck');
      save().then(function () {
        if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
      });
    }
  }

  var editBtn = button('sb-edit-btn', 'Edit', 'Edit this page', function () {
    setEditing(!root.classList.contains('sb-editing'));
  });
  editBtn.setAttribute('aria-pressed', 'false');
  document.body.appendChild(editBtn);

  /* A page whose boxes were placed by an agent, or by an older version of
     this file, has no min-height of its own. Fit it on load so the boxes are
     visible before anyone presses Edit. */
  fitBoxes();

  article.addEventListener('input', touch);
  document.addEventListener('selectionchange', function () {
    if (root.classList.contains('sb-editing')) syncTools();
  });
  wireDragging();

  /* Leaving with unsaved keystrokes is the one way this loses work. */
  window.addEventListener('beforeunload', function (e) {
    if (!dirty) return;
    save();
    e.preventDefault();
    e.returnValue = '';
  });
})();
