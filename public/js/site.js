// Wood Metal site behaviour: gallery, polish picker, search filter, lead forms.
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Product gallery
  var main = $('#main-img');
  $$('.thumb').forEach(function (b) {
    b.addEventListener('click', function () {
      main.src = b.dataset.src;
      $$('.thumb').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });

  // Polish picker: updates label, WhatsApp message and the form's polish field
  var waBtn = $('#wa-btn');
  $$('.swatch').forEach(function (s) {
    s.addEventListener('click', function () {
      $$('.swatch').forEach(function (x) { x.classList.toggle('on', x === s); x.setAttribute('aria-pressed', x === s); });
      var name = $('#polish-name'); if (name) name.textContent = s.dataset.label;
      if (waBtn) {
        var text = waBtn.dataset.base + '\n' + waBtn.dataset.polishWord + ': ' + s.dataset.label;
        waBtn.href = waBtn.href.split('?')[0] + '?text=' + encodeURIComponent(text);
      }
      var sel = $('.lead-form select[name="polish"]'); if (sel) sel.value = s.dataset.polish;
    });
  });

  // Listing search (filters cards already on the page)
  var q = $('#q');
  if (q) {
    var cards = $$('#grid .card');
    var none = $('#none');
    var norm = function (s) {
      return s.toLowerCase().replace(/[০-৯]/g, function (d) { return String('০১২৩৪৫৬৭৮৯'.indexOf(d)); }).trim();
    };
    q.addEventListener('input', function () {
      var v = norm(q.value), shown = 0;
      cards.forEach(function (c) {
        var ok = !v || norm(c.dataset.q).indexOf(v) !== -1;
        c.hidden = !ok; if (ok) shown++;
      });
      none.hidden = shown !== 0;
    });
  }

  // Home slide banner: fades every 6s, pauses on hover/focus, swipe on phones
  var slider = $('.slider');
  if (slider) {
    var slides = $$('.slide', slider), dots = $$('.slide-dots button', slider), cur = 0, timer = null;
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var go = function (n) {
      cur = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        var on = i === cur;
        s.classList.toggle('on', on);
        if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
        $$('a', s).forEach(function (a) { if (on) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1'); });
      });
      dots.forEach(function (d, i) { if (i === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    };
    var stop = function () { clearInterval(timer); timer = null; };
    var start = function () { if (still || slides.length < 2) return; stop(); timer = setInterval(function () { go(cur + 1); }, 6000); };
    $('.slide-nav.prev', slider).addEventListener('click', function () { go(cur - 1); start(); });
    $('.slide-nav.next', slider).addEventListener('click', function () { go(cur + 1); start(); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); start(); }); });
    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', start);
    slider.addEventListener('focusin', stop);
    slider.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    var x0 = null;
    slider.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    slider.addEventListener('touchend', function (e) {
      if (x0 !== null) {
        var dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
      }
      x0 = null; start();
    });
    start();
  }

  // Chat box
  var chat = $('#chat');
  if (chat) {
    var panel = $('.chat-panel', chat), tog = $('.chat-toggle', chat);
    var setOpen = function (open) {
      panel.hidden = !open; chat.classList.toggle('open', open); tog.setAttribute('aria-expanded', open);
      if (open) { var ta = $('textarea', panel); if (ta && !$('.chat-form', panel).classList.contains('done')) ta.focus(); }
    };
    tog.addEventListener('click', function () { setOpen(panel.hidden); });
    $('.chat-close', chat).addEventListener('click', function () { setOpen(false); tog.focus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); tog.focus(); } });
  }

  // Lead forms
  var msgsEl = $('#form-msgs');
  var MSG = msgsEl ? JSON.parse(msgsEl.textContent) : {};

  function normalisePhone(v) {
    var d = String(v || '').replace(/[০-৯]/g, function (c) { return String('০১২৩৪৫৬৭৮৯'.indexOf(c)); }).replace(/[^0-9+]/g, '');
    if (d.indexOf('+880') === 0) d = '0' + d.slice(4);
    else if (d.indexOf('880') === 0) d = '0' + d.slice(3);
    return /^01[3-9][0-9]{8}$/.test(d) ? d : null;
  }

  // Shrink photos in the browser so uploads are quick on mobile data.
  function shrink(file) {
    return new Promise(function (resolve) {
      if (!file.type || file.type.indexOf('image/') !== 0) return resolve(null);
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.8).split(',')[1] });
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  $$('.lead-form').forEach(function (form) {
    var err = $('.form-error', form);
    var btn = $('button[type="submit"]', form);
    var label = btn.textContent;
    function fail(m) { err.textContent = m; err.hidden = false; btn.disabled = false; btn.textContent = label; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var fd = new FormData(form);
      var phone = normalisePhone(fd.get('phone'));
      if (form.dataset.kind === 'chat' && !String(fd.get('message') || '').trim()) { form.elements.message.focus(); return; }
      if (!String(fd.get('name') || '').trim()) { form.elements.name.focus(); return; }
      if (!phone) { fail(MSG.errPhone); form.elements.phone.focus(); return; }
      btn.disabled = true; btn.textContent = btn.dataset.sending;

      var data = {};
      ['kind', 'lang', 'name', 'area', 'item', 'size', 'polish', 'message', 'product_slug', 'product_name', 'website'].forEach(function (k) {
        if (fd.get(k) != null) data[k] = String(fd.get(k)).trim();
      });
      data.phone = phone;
      data.page = location.pathname;
      var files = Array.prototype.slice.call(form.elements.photos ? form.elements.photos.files : [], 0, 3);
      Promise.all(files.map(shrink)).then(function (photos) {
        data.photos = photos.filter(Boolean);
        return fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      }).then(function (r) {
        if (r.status === 429) throw new Error('many');
        if (!r.ok) throw new Error('bad');
        form.classList.add('done');
        $('.form-done', form).hidden = false;
        if (form.dataset.kind !== 'chat') $('.form-done', form).scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(function (x) {
        fail(x && x.message === 'many' ? MSG.errMany : MSG.errGeneric);
      });
    });
  });
})();
