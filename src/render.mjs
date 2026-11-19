// Page templates for woodmetalbd.com, shared by the static build (build.mjs)
// and the Pages Functions that render catalogue pages from D1 (functions/_middleware.js).
// No Node APIs in here: it must also run on Cloudflare Workers.
import { CATEGORIES, POLISH, WOOD, T } from './strings.mjs';

export { CATEGORIES };

// Links to other sites (WhatsApp, Facebook, maps...) open in a new tab/window.
const waTargets = (html) => html.replace(/<a ([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>/g, (m, pre, href, post) => {
  if (/target=/.test(pre + post) || href.startsWith('https://www.woodmetalbd.com')) return m;
  const clean = (x) => x.replace(/\s*rel="[^"]*"/g, '');
  return `<a ${clean(pre)}target="_blank" rel="noopener" href="${href}"${clean(post)}>`;
});

export function createSite({ cfg, products, slides, assetV }) {
  const SLIDES = slides;
  const ASSET_V = assetV;
  const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
  const catBySlug = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));
// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bnNum = (s) => String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
const num = (lang, s) => (lang === 'bn' ? bnNum(s) : String(s));
const money = (lang, n) => {
  const s = Number(n).toLocaleString('en-IN');
  return lang === 'bn' ? `৳ ${bnNum(s)}` : `Tk ${s}`;
};
const prefix = (lang) => (lang === 'bn' ? '' : '/en');
const url = (lang, p) => prefix(lang) + p;
const wa = (text) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`;
const pName = (lang, p) => `${catBySlug[p.cat].one[lang]} ${num(lang, p.model)}`;
const productsIn = (cat) => products.filter((p) => p.cat === cat);

const ICON = {
  wa: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.7-4.6A8.5 8.5 0 1 1 8 19.6L3 21z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-.9.9a3.6 3.6 0 0 1-2.3-2.3l.9-.9-1-2L9 9.5z"/></svg>',
  phone: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  chisel: '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l9-9"/><path d="M14 4l6 6-3 3-6-6z"/></svg>',
  pin: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  chat: '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="3"/></svg>',
  search: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  swirl: '<svg aria-hidden="true" class="swirl" width="220" height="16" viewBox="0 0 220 16"><path d="M2 10 C 40 2, 80 14, 120 7 S 190 4, 218 9" fill="none" stroke="#C38820" stroke-width="3" stroke-linecap="round"/></svg>',
};


// ---------- layout ----------
function layout(opts) { return waTargets(layoutRaw(opts)); }
function layoutRaw({ lang, pathname, altPath, title, description, body, image, jsonld, noindex }) {
  const t = T[lang];
  const canonical = cfg.siteUrl + url(lang, pathname);
  const other = t.other;
  const otherHref = url(other, altPath ?? pathname);
  const fullTitle = title ? `${title} | Wood Metal` : (lang === 'bn' ? 'উড মেটাল | হাতে গড়া ক্রিয়েটিভ ফার্নিচার' : 'Wood Metal | Handmade creative furniture');
  const ogImg = cfg.siteUrl + (image || bySlug[cfg.heroProduct].images[0].src);
  const navItem = (href, label) => `<a href="${url(lang, href)}"${pathname.startsWith(href) && href !== '/' ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || t.desc)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="bn" href="${cfg.siteUrl + url('bn', lang === 'bn' ? pathname : altPath ?? pathname)}">
<link rel="alternate" hreflang="en" href="${cfg.siteUrl + url('en', lang === 'en' ? pathname : altPath ?? pathname)}">
<link rel="alternate" hreflang="x-default" href="${cfg.siteUrl + url('bn', lang === 'bn' ? pathname : altPath ?? pathname)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Wood Metal">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description || t.desc)}">
<meta property="og:image" content="${ogImg}">
<meta property="og:url" content="${canonical}">
<meta name="theme-color" content="#111111">
<link rel="icon" href="/favicon-48.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/css/site.css?v=${ASSET_V}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body class="lang-${lang}">
<a class="skip" href="#main">${t.skip}</a>
<div class="topstrip dark">
  <div class="wrap row-between">
    <span>${t.since}</span>
    <span class="topstrip-r"><a href="tel:${cfg.phones[0].tel}">${num(lang, cfg.phones[0].label)}</a><span class="hide-sm">${t.showroomShort}</span></span>
  </div>
</div>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="${url(lang, '/')}">
      <img class="brand-logo" src="/img/logo-stack.svg" alt="Wood Metal, handmade furniture" width="290" height="346">
    </a>
    <nav class="main-nav" aria-label="${lang === 'bn' ? 'প্রধান মেনু' : 'Main'}">
      ${navItem('/furniture/', t.nav.shop)}
      ${navItem('/custom-order/', t.nav.custom)}
      ${navItem('/about/', t.nav.story)}
      ${navItem('/contact/', t.nav.contact)}
    </nav>
    <div class="lang-toggle" role="group" aria-label="Language">
      ${lang === 'bn'
        ? `<span class="on" aria-current="true">বাংলা</span><a href="${otherHref}" hreflang="en" lang="en">English</a>`
        : `<a href="${otherHref}" hreflang="bn" lang="bn">বাংলা</a><span class="on" aria-current="true">English</span>`}
    </div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer dark">
  <div class="wrap footer-grid">
    <div>
      <img class="footer-logo" src="/img/logo-white.png" alt="Wood Metal" width="503" height="600" loading="lazy">
      <p>${t.footerLine}</p>
      <p class="footer-addr">${t.address}</p>
    </div>
    <div>
      <div class="footer-h">${t.nav.shop}</div>
      <ul class="footer-links">${CATEGORIES.slice(0, 7).map((c) => `<li><a href="${url(lang, `/furniture/${c.slug}/`)}">${c[lang]}</a></li>`).join('')}</ul>
    </div>
    <div>
      <div class="footer-h">${t.nav.contact}</div>
      <ul class="footer-links">
        ${cfg.phones.map((p) => `<li><a href="tel:${p.tel}">${num(lang, p.label)}</a></li>`).join('')}
        <li><a href="${wa(t.waGeneral)}">WhatsApp</a></li>
        <li><a href="mailto:${cfg.email}">${cfg.email}</a></li>
      </ul>
      <div class="social">
        <a href="${cfg.social.facebook}" rel="noopener">Facebook</a>
        <a href="${cfg.social.instagram}" rel="noopener">Instagram</a>
        <a href="${cfg.social.youtube}" rel="noopener">YouTube</a>
      </div>
    </div>
  </div>
  <div class="wrap footer-bottom">© ${num(lang, new Date().getFullYear())} Wood Metal</div>
</footer>
${chatBox(lang)}
<script type="application/json" id="form-msgs">${JSON.stringify({ errPhone: t.errPhone, errGeneric: t.errGeneric, errMany: t.errMany })}</script>
<script src="/js/site.js?v=${ASSET_V}" defer></script>
</body>
</html>
`;
}

// ---------- components ----------
function productCard(lang, p) {
  const t = T[lang];
  const name = pName(lang, p);
  const img = p.images[0];
  const link = url(lang, `/p/${p.slug}/`);
  const pageUrl = cfg.siteUrl + link;
  return `<article class="card" data-cat="${p.cat}" data-q="${esc([pName('en', p), pName('bn', p), p.code, p.model].join(' ').toLowerCase())}">
  <a class="card-img" href="${link}" tabindex="-1" aria-hidden="true"><img src="${img.sm}" alt="" loading="lazy" decoding="async" width="480" height="${Math.round(480 * img.h / img.w)}"></a>
  <div class="card-body">
    <span class="eyebrow">${catBySlug[p.cat].one[lang]}</span>
    <h3 class="card-title"><a href="${link}">${esc(name)}</a></h3>
    ${p.size ? `<span class="card-spec">${esc(p.size)} · ${WOOD[p.wood]?.[lang] ?? p.wood}</span>` : ''}
    <span class="card-price">${money(lang, p.price)}</span>
    <div class="card-actions">
      <a class="btn btn-wa btn-sm" href="${wa(t.waProduct(name, p.code, pageUrl))}">${ICON.wa}<span>${t.askPrice}</span></a>
      <a class="btn btn-outline btn-sm" href="${link}">${t.details}</a>
    </div>
  </div>
</article>`;
}

// Floating chat: visitors write here, the message is saved as a lead (kind "chat")
// and they can carry on in WhatsApp.
function chatBox(lang) {
const t = T[lang];
const bn = lang === 'bn';
return `<div class="chat" id="chat">
  <button class="chat-toggle" type="button" aria-expanded="false" aria-controls="chat-panel" aria-label="${bn ? 'চ্যাট খুলুন' : 'Open chat'}">${ICON.chat}<span class="chat-toggle-x" aria-hidden="true">×</span></button>
  <div class="chat-panel" id="chat-panel" role="dialog" aria-label="${bn ? 'উড মেটালের সাথে চ্যাট' : 'Chat with Wood Metal'}" hidden>
    <div class="chat-head"><img src="/img/mark-white.png" alt="" width="34" height="34"><span><strong>Wood Metal</strong><small>${bn ? 'লিখুন, আমরা উত্তর দেব' : 'Write to us and we will reply'}</small></span><button class="chat-close" type="button" aria-label="${bn ? 'বন্ধ করুন' : 'Close'}">×</button></div>
    <div class="chat-body">
      <p class="chat-bubble">${bn ? 'আসসালামু আলাইকুম! কোন ফার্নিচার খুঁজছেন? নিচে লিখে পাঠান, আমরা ফোন বা WhatsApp-এ উত্তর দেব।' : 'Hello! What furniture are you looking for? Write to us below and we will reply by phone or WhatsApp.'}</p>
      <form class="lead-form chat-form" data-kind="chat" novalidate>
        <input type="hidden" name="kind" value="chat">
        <input type="hidden" name="lang" value="${lang}">
        <div class="hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
        <label class="sr" for="chat-msg">${t.fMsg}</label>
        <textarea class="field" id="chat-msg" name="message" rows="3" maxlength="2000" required placeholder="${bn ? 'আপনার মেসেজ লিখুন...' : 'Type your message...'}"></textarea>
        <div class="chat-row">
          <label><span class="sr">${t.fName}</span><input class="field" type="text" name="name" required autocomplete="name" maxlength="80" placeholder="${t.fName}"></label>
          <label><span class="sr">${t.fPhone}</span><input class="field" type="tel" name="phone" required autocomplete="tel" inputmode="tel" maxlength="20" placeholder="01XXXXXXXXX"></label>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <button type="submit" class="btn btn-dark btn-block" data-sending="${t.sending}">${bn ? 'মেসেজ পাঠান' : 'Send message'}</button>
        <div class="form-done" hidden><p class="chat-bubble chat-bubble-ok">${bn ? 'ধন্যবাদ! মেসেজ পেয়েছি, শীঘ্রই আপনাকে ফোন বা WhatsApp করব।' : 'Thank you! We got your message and will call or WhatsApp you soon.'}</p></div>
      </form>
      <a class="btn btn-wa btn-block chat-wa" href="${wa(t.waGeneral)}">${ICON.wa}<span>${bn ? 'সরাসরি WhatsApp-এ চ্যাট করুন' : 'Chat on WhatsApp instead'}</span></a>
    </div>
  </div>
</div>`;
}

function leadForm(lang, kind, product) {
  const t = T[lang];
  const isCustom = kind === 'custom';
  const polishOpts = Object.entries(POLISH).map(([k, v]) => `<option value="${k}">${v[lang]}</option>`).join('');
  return `<form class="lead-form" data-kind="${kind}" novalidate>
  <input type="hidden" name="kind" value="${kind}">
  <input type="hidden" name="lang" value="${lang}">
  ${product ? `<input type="hidden" name="product_slug" value="${product.slug}"><input type="hidden" name="product_name" value="${esc(pName('en', product))} (${esc(product.code)})">` : ''}
  <div class="hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
  <div class="form-grid">
    <label>${t.fName}<input class="field" type="text" name="name" required autocomplete="name" maxlength="80"></label>
    <label>${t.fPhone}<input class="field" type="tel" name="phone" required autocomplete="tel" inputmode="tel" placeholder="01XXXXXXXXX" maxlength="20"></label>
    <label>${t.fArea}<input class="field" type="text" name="area" maxlength="80"></label>
    ${isCustom ? `<label>${t.fItem}<input class="field" type="text" name="item" placeholder="${t.fItemPh}" maxlength="120"></label>` : ''}
    <label>${t.fSize}<input class="field" type="text" name="size" placeholder="${t.fSizePh}" maxlength="120"${product?.size ? ` value="${esc(product.size)}"` : ''}></label>
    <label>${t.fPolish}<select class="field" name="polish"><option value="">${t.fPolishAny}</option>${polishOpts}</select></label>
    <label class="span2">${t.fMsg}<textarea class="field" name="message" rows="4" maxlength="2000"></textarea></label>
    <label class="span2">${t.fPhoto}<input class="field file" type="file" name="photos" accept="image/*" multiple><span class="hint">${t.fPhotoHint}</span></label>
  </div>
  <p class="form-error" role="alert" hidden></p>
  <button type="submit" class="btn btn-dark btn-lg" data-sending="${t.sending}">${t.send}</button>
  <div class="form-done" hidden>
    <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C38820" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3 3 7-7"/></svg>
    <h3>${t.thanks}</h3>
    <p>${t.thanksText}</p>
    <a class="btn btn-wa" href="${wa(product ? t.waProduct(pName(lang, product), product.code, cfg.siteUrl + url(lang, `/p/${product.slug}/`)) : (isCustom ? t.waCustom : t.waGeneral))}">${ICON.wa}<span>WhatsApp</span></a>
  </div>
</form>`;
}

function showroomCards(lang) {
  const t = T[lang];
  return `<div class="showrooms">
  <div class="showroom">
    <span class="tag">${t.newShowroom}</span>
    <h3>${lang === 'bn' ? 'চায়না সিটি, বারিধারা' : 'China City, Baridhara'}</h3>
    <p>${t.address}</p>
    <div class="btn-row">
      ${cfg.phones.map((p) => `<a class="btn btn-dark" href="tel:${p.tel}">${ICON.phone}<span>${num(lang, p.label)}</span></a>`).join('')}
      <a class="btn btn-outline" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('China City Dhaka, Pragati Sarani, Baridhara, Dhaka 1229')}" rel="noopener">${ICON.pin}<span>${t.directions}</span></a>
    </div>
  </div>
  <div class="showroom showroom-old">
    <img class="showroom-photo" src="/img/showroom/hatirpool-front-sm.webp" alt="${lang === 'bn' ? 'হাতিরপুলের শোরুম' : 'Hatirpool showroom'}" width="640" height="480" loading="lazy">
    <span class="tag tag-muted">${t.oldShowroom}</span>
    <h3>${lang === 'bn' ? 'হাতিরপুল, ধানমন্ডি' : 'Hatirpool, Dhanmondi'}</h3>
    <p>${t.oldAddress}</p>
    <div class="btn-row">
      <a class="btn btn-outline" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('76 Central Road, Hatirpool, Dhanmondi, Dhaka 1205')}" rel="noopener">${ICON.pin}<span>${t.directions}</span></a>
    </div>
  </div>
</div>`;
}

function storySection(lang) {
  const t = T[lang];
  return `<section id="story" class="story">
  <div class="wrap story-grid">
    <div class="story-art">
      <div class="story-card">
        <img class="deco deco-shavings" src="/img/story/shavings.webp" alt="" width="358" height="292" loading="lazy">
        <img class="deco deco-saw" src="/img/story/saw.webp" alt="" width="376" height="174" loading="lazy">
        <img class="deco deco-hammer" src="/img/story/hammer.webp" alt="" width="270" height="224" loading="lazy">
        <img class="deco deco-plane" src="/img/story/plane.webp" alt="" width="268" height="226" loading="lazy">
        <img class="deco deco-chisels" src="/img/story/chisels.webp" alt="" width="288" height="236" loading="lazy">
        <div class="story-in">
        <h2>${t.storyTitleArt}</h2>
        <p>${t.storyText}</p>
        <img class="story-owner" src="/img/owner.webp" alt="${t.owner}" width="120" height="120" loading="lazy">
        <img class="story-sign" src="/img/story/sign.webp" alt="" width="152" height="64" loading="lazy">
        <span class="story-name">${t.owner}<small>${t.ownerRole}</small></span>
        </div>
      </div>
    </div>
    <div class="craft">
      <h3>${t.craftTitle}</h3>
      ${t.craft.map((c) => `<div class="craft-item">${ICON.chisel}<span><strong>${c.h}</strong><span>${c.p}</span></span></div>`).join('')}
    </div>
  </div>
</section>`;
}

const breadcrumbs = (lang, items) => `<nav class="crumbs wrap" aria-label="breadcrumb">${items.map(([href, label], i) => (i === items.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : `<a href="${url(lang, href)}">${esc(label)}</a>`)).join(' <span aria-hidden="true">/</span> ')}</nav>`;

// ---------- pages ----------
function homePage(lang) {
  const t = T[lang];
  const hero = bySlug[cfg.heroProduct];
  const featured = cfg.featured.map((s) => bySlug[s]).filter(Boolean);
  const body = `
<section class="slider" aria-roledescription="carousel" aria-label="${lang === 'bn' ? 'আমাদের কাজ' : 'Our work'}">
  <div class="slides">
    ${SLIDES.map((sl, i) => { const c = sl[lang]; const H = i === 0 ? 'h1' : 'h2'; return `<div class="slide${i === 0 ? ' on' : ''}" role="group" aria-roledescription="slide" aria-label="${num(lang, i + 1)} / ${num(lang, SLIDES.length)}"${i === 0 ? '' : ' aria-hidden="true"'}>
      <img src="${sl.img}" srcset="${sl.sm} 640w, ${sl.img} ${sl.w}w" sizes="100vw" alt="${esc(c.alt)}" width="${sl.w}" height="${sl.h}"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}>
      <div class="slide-cap wrap">
        <${H}>${esc(c.title)}</${H}>
        <p>${esc(c.text)}</p>
        <div class="btn-row">
          <a class="btn btn-wa btn-lg" href="${url(lang, sl.href)}"${i === 0 ? '' : ' tabindex="-1"'}>${esc(c.cta)}</a>
          <a class="btn btn-light btn-lg" href="${wa(t.waGeneral)}"${i === 0 ? '' : ' tabindex="-1"'}>${ICON.wa}<span>WhatsApp</span></a>
        </div>
      </div>
    </div>`; }).join('\n    ')}
  </div>
  <button class="slide-nav prev" type="button" aria-label="${lang === 'bn' ? 'আগের ছবি' : 'Previous slide'}"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
  <button class="slide-nav next" type="button" aria-label="${lang === 'bn' ? 'পরের ছবি' : 'Next slide'}"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
  <div class="slide-dots">${SLIDES.map((_, i) => `<button type="button" aria-label="${num(lang, i + 1)}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}</div>
</section>
<section class="trust">
  <div class="wrap trust-grid">
    ${t.trust.map((x) => `<div class="trust-item"><strong>${x.h}</strong><span>${x.p}</span></div>`).join('')}
  </div>
</section>
<section id="cats" class="wrap section">
  <div class="section-head"><h2>${t.catsTitle}</h2><span>${t.catsSub(num(lang, products.length), num(lang, CATEGORIES.length))}</span></div>
  <div class="cat-grid">
    ${CATEGORIES.filter((c) => productsIn(c.slug).length).map((c) => {
      const first = productsIn(c.slug)[0];
      return `<a class="cat-card" href="${url(lang, `/furniture/${c.slug}/`)}"><span class="cat-img"><img src="${first.images[0].sm}" alt="" loading="lazy" width="480" height="${Math.round(480 * first.images[0].h / first.images[0].w)}"></span><span class="cat-name">${c[lang]}<small>${num(lang, productsIn(c.slug).length)}${t.designs}</small></span></a>`;
    }).join('')}
    <a class="cat-card cat-custom" href="${url(lang, '/custom-order/')}"><span class="cat-custom-in">${ICON.chisel}<strong>${t.customTitle}</strong><small>${t.nav.custom} →</small></span></a>
  </div>
</section>
<section id="featured" class="wrap section">
  <div class="section-head"><h2>${t.featTitle}</h2><a href="${url(lang, '/furniture/')}">${t.ctaBrowse} →</a></div>
  <p class="muted">${t.priceNote}</p>
  <div class="product-grid">${featured.map((p) => productCard(lang, p)).join('')}</div>
</section>
${storySection(lang)}
<section id="custom" class="wrap section">
  <h2>${t.customTitle}</h2>
  <p class="lead narrow">${t.customSub}</p>
  <div class="steps">${t.steps.map((s, i) => `<div class="step"><span class="step-n">${num(lang, i + 1)}</span><strong>${s.h}</strong><span>${s.p}</span></div>`).join('')}</div>
  <div class="btn-row">
    <a class="btn btn-dark btn-lg" href="${url(lang, '/custom-order/')}">${t.ctaQuote}</a>
    <a class="btn btn-wa btn-lg" href="${wa(t.waCustom)}">${ICON.wa}<span>${t.ctaWaPhoto}</span></a>
  </div>
</section>
<section id="visit" class="visit">
  <div class="wrap">
    <h2 class="visit-title">${t.visitTitle}</h2>
    ${showroomCards(lang)}
  </div>
</section>`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'FurnitureStore', name: 'Wood Metal', url: cfg.siteUrl,
    image: cfg.siteUrl + hero.images[0].src, telephone: cfg.phones.map((p) => p.tel), email: cfg.email, foundingDate: '2000',
    founder: { '@type': 'Person', name: 'Rokonuzzaman Babu' },
    address: { '@type': 'PostalAddress', streetAddress: 'China City Dhaka, Shop C/10, Plot 330, Pragati Sarani Road, Block J, Baridhara', addressLocality: 'Dhaka', postalCode: '1229', addressCountry: 'BD' },
    sameAs: Object.values(cfg.social),
  };
  return layout({ lang, pathname: '/', body, jsonld });
}

function listingPage(lang, cat) {
  const t = T[lang];
  const c = cat ? catBySlug[cat] : null;
  const list = cat ? productsIn(cat) : CATEGORIES.flatMap((x) => productsIn(x.slug));
  const pathname = cat ? `/furniture/${cat}/` : '/furniture/';
  const title = c ? c[lang] : t.allTitle;
  const body = `
${breadcrumbs(lang, c ? [['/', t.home], ['/furniture/', t.allTitle], [pathname, title]] : [['/', t.home], [pathname, title]])}
<section class="wrap section-tight">
  <div class="section-head"><h1>${title}</h1><span>${num(lang, list.length)}${t.designs}</span></div>
  ${c ? `<p class="lead narrow">${c.blurb[lang]}</p>` : ''}
  <div class="chips" role="list">
    <a role="listitem" class="chip${!cat ? ' on' : ''}" href="${url(lang, '/furniture/')}"${!cat ? ' aria-current="page"' : ''}>${t.all}</a>
    ${CATEGORIES.map((x) => `<a role="listitem" class="chip${x.slug === cat ? ' on' : ''}" href="${url(lang, `/furniture/${x.slug}/`)}"${x.slug === cat ? ' aria-current="page"' : ''}>${x[lang]}</a>`).join('')}
  </div>
  <label class="search">${ICON.search}<span class="sr">${t.search}</span><input type="search" id="q" placeholder="${t.search}" autocomplete="off"></label>
  <p class="muted">${t.priceNote}</p>
  <div class="product-grid" id="grid">${list.map((p) => productCard(lang, p)).join('')}</div>
  <p class="no-results" id="none" hidden>${t.noResults} <a href="${wa(t.waGeneral)}">WhatsApp</a></p>
</section>`;
  return layout({ lang, pathname, title, description: c ? c.blurb[lang] : t.desc, body });
}

function productPage(lang, p) {
  const t = T[lang];
  const c = catBySlug[p.cat];
  const name = pName(lang, p);
  const pathname = `/p/${p.slug}/`;
  const pageUrl = cfg.siteUrl + url(lang, pathname);
  const related = productsIn(p.cat).filter((x) => x.slug !== p.slug).slice(0, 4);
  const specs = [
    [t.code, p.code],
    [t.category, c.one[lang]],
    [t.size, p.size ? `${p.size}<br><small>${t.sizeCustom}</small>` : t.sizeCustom],
    [t.wood, WOOD[p.wood]?.[lang] ?? p.wood],
    [t.polish, p.polishes.map((k) => POLISH[k]?.[lang] ?? k).join(', ')],
  ];
  const body = `
${breadcrumbs(lang, [['/', t.home], [`/furniture/${c.slug}/`, c[lang]], [pathname, name]])}
<section class="wrap product">
  <div class="gallery">
    <div class="gallery-main"><img id="main-img" src="${p.images[0].src}" alt="${esc(name)}" width="${p.images[0].w}" height="${p.images[0].h}" fetchpriority="high"></div>
    ${p.images.length > 1 ? `<div class="thumbs">${p.images.map((im, i) => `<button type="button" class="thumb${i === 0 ? ' on' : ''}" data-src="${im.src}" aria-label="${esc(name)} ${num(lang, i + 1)}"><img src="${im.sm}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
  </div>
  <div class="product-info">
    <span class="eyebrow">${t.handmade}</span>
    <h1>${esc(name)}</h1>
    <p class="lead">${c.blurb[lang]}</p>
    <div class="price-box">
      <span class="price">${money(lang, p.price)}</span>
      ${p.regular_price ? `<s>${money(lang, p.regular_price)}</s>` : ''}
      <span class="muted">${t.priceNote}</span>
    </div>
    <div class="polish-pick">
      <span>${t.polishPick}: <strong id="polish-name">${POLISH[p.polishes[0]]?.[lang] ?? ''}</strong></span>
      <div class="swatches">${p.polishes.map((k, i) => `<button type="button" class="swatch${i === 0 ? ' on' : ''}" aria-pressed="${i === 0}" data-polish="${k}" data-label="${POLISH[k]?.[lang] ?? k}"><span style="background:${POLISH[k]?.color ?? '#666666'}"></span>${POLISH[k]?.[lang] ?? k}</button>`).join('')}</div>
    </div>
    <div class="buy">
      <a class="btn btn-wa btn-lg btn-block" id="wa-btn" data-base="${esc(t.waProduct(name, p.code, pageUrl))}" data-polish-word="${t.polish}" href="${wa(t.waProduct(name, p.code, pageUrl))}">${ICON.wa}<span>${t.waBtn}</span></a>
      <div class="btn-row">
        <a class="btn btn-dark" href="tel:${cfg.phones[0].tel}">${ICON.phone}<span>${t.callBtn}</span></a>
        <a class="btn btn-outline" href="#quote">${t.quoteBtn}</a>
      </div>
    </div>
    <dl class="specs">${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  </div>
</section>
<section class="terms">
  <div class="wrap trust-grid">${t.terms.map((x) => `<div class="trust-item"><strong>${x.h}</strong><span>${x.p}</span></div>`).join('')}</div>
</section>
<section id="quote" class="wrap section form-section">
  <div class="form-intro">
    <h2>${t.formQuoteTitle}</h2>
    <p class="lead">${t.formQuoteSub}</p>
  </div>
  <div class="form-card">${leadForm(lang, 'quote', p)}</div>
</section>
${related.length ? `<section class="wrap section"><div class="section-head"><h2>${t.related}</h2><a href="${url(lang, `/furniture/${c.slug}/`)}">${c[lang]} →</a></div><div class="product-grid">${related.map((x) => productCard(lang, x)).join('')}</div></section>` : ''}`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Product', name: pName('en', p), sku: p.sku, mpn: p.code,
    image: p.images.map((i) => cfg.siteUrl + i.src), description: c.blurb.en, brand: { '@type': 'Brand', name: 'Wood Metal' },
    material: p.wood, size: p.size || undefined,
    offers: { '@type': 'Offer', priceCurrency: 'BDT', price: p.price, availability: 'https://schema.org/MadeToOrder', url: pageUrl },
  };
  return layout({ lang, pathname, title: `${name} (${p.code})`, description: `${name}: ${c.blurb[lang]} ${p.size ? t.size + ': ' + p.size + '.' : ''}`, body, image: p.images[0].src, jsonld });
}

function customPage(lang) {
  const t = T[lang];
  const body = `
${breadcrumbs(lang, [['/', t.home], ['/custom-order/', t.nav.custom]])}
<section class="wrap section-tight">
  <h1>${t.customTitle}</h1>
  <p class="lead narrow">${t.customSub}</p>
  <div class="steps">${t.steps.map((s, i) => `<div class="step"><span class="step-n">${num(lang, i + 1)}</span><strong>${s.h}</strong><span>${s.p}</span></div>`).join('')}</div>
</section>
<section id="form" class="wrap section form-section">
  <div class="form-intro">
    <h2>${t.formCustomTitle}</h2>
    <p class="lead">${t.formCustomSub}</p>
    <a class="btn btn-wa" href="${wa(t.waCustom)}">${ICON.wa}<span>${t.ctaWaPhoto}</span></a>
  </div>
  <div class="form-card">${leadForm(lang, 'custom')}</div>
</section>`;
  return layout({ lang, pathname: '/custom-order/', title: t.nav.custom, description: t.customSub, body });
}

function aboutPage(lang) {
  const t = T[lang];
  const body = `
${breadcrumbs(lang, [['/', t.home], ['/about/', t.aboutTitle]])}
${storySection(lang)}
<section class="wrap section">
  <h2>${lang === 'bn' ? 'আমাদের শোরুম আর কাজ' : 'Our showroom and work'}</h2>
  <div class="photo-grid">
    ${[['sofa-showroom', 1400, 927], ['showroom-2', 1400, 1050], ['bed-showroom', 1400, 927], ['showroom-1', 1400, 1867], ['hatirpool-front', 1040, 780], ['hatirpool-sign', 1040, 780]].map(([n, w, h]) => `<a href="/img/showroom/${n}.webp"><img src="/img/showroom/${n}-sm.webp" alt="" width="640" height="${Math.round(640 * h / w)}" loading="lazy"></a>`).join('')}
  </div>
  <div class="steps">${t.trust.map((s) => `<div class="step"><strong>${s.h}</strong><span>${s.p}</span></div>`).join('')}</div>
  <div class="btn-row"><a class="btn btn-dark btn-lg" href="${url(lang, '/furniture/')}">${t.ctaBrowse}</a><a class="btn btn-outline btn-lg" href="${url(lang, '/contact/')}">${t.nav.contact}</a></div>
</section>`;
  return layout({ lang, pathname: '/about/', title: t.aboutTitle, description: t.storyText.slice(0, 155), body });
}

function contactPage(lang) {
  const t = T[lang];
  const body = `
${breadcrumbs(lang, [['/', t.home], ['/contact/', t.contactTitle]])}
<section class="wrap section-tight">
  <h1>${t.contactTitle}</h1>
  <p class="lead">${t.contactSub}</p>
  <div class="btn-row">
    <a class="btn btn-wa btn-lg" href="${wa(t.waGeneral)}">${ICON.wa}<span>${t.ctaWa}</span></a>
    <a class="btn btn-dark btn-lg" href="tel:${cfg.phones[0].tel}">${ICON.phone}<span>${num(lang, cfg.phones[0].label)}</span></a>
  </div>
</section>
<section class="visit">
  <div class="wrap">
    ${showroomCards(lang)}
    <div class="map"><iframe title="${lang === 'bn' ? 'শোরুমের ম্যাপ' : 'Showroom map'}" src="https://www.google.com/maps?q=${encodeURIComponent('China City Dhaka, Pragati Sarani, Baridhara, Dhaka 1229')}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
  </div>
</section>
<section id="form" class="wrap section form-section">
  <div class="form-intro"><h2>${t.formQuoteTitle}</h2><p class="lead">${t.formQuoteSub}</p></div>
  <div class="form-card">${leadForm(lang, 'contact')}</div>
</section>`;
  return layout({ lang, pathname: '/contact/', title: t.contactTitle, description: `${t.contactSub} ${T.en.address.replace(/<br>/g, ', ')}`, body });
}

function notFoundPage(lang) {
  const t = T[lang];
  const body = `<section class="wrap section center"><h1>${t.notFound}</h1><p class="lead">${t.notFoundText}</p><div class="btn-row center"><a class="btn btn-dark btn-lg" href="${url(lang, '/furniture/')}">${t.ctaBrowse}</a><a class="btn btn-wa btn-lg" href="${wa(t.waGeneral)}">${ICON.wa}<span>WhatsApp</span></a></div></section>`;
  return layout({ lang, pathname: '/404', title: t.notFound, body, noindex: true });
}

  // Every page path, in both languages.
  function allPaths() {
    const out = [];
    for (const lang of ['bn', 'en']) {
      out.push(url(lang, '/'), url(lang, '/furniture/'));
      for (const c of CATEGORIES) out.push(url(lang, `/furniture/${c.slug}/`));
      for (const p of products) out.push(url(lang, `/p/${p.slug}/`));
      out.push(url(lang, '/custom-order/'), url(lang, '/about/'), url(lang, '/contact/'));
    }
    return out;
  }
  const sitemap = (day) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allPaths().map((p) => `<url><loc>${cfg.siteUrl}${p}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`;

  // Render one path ("/en/p/sofa-580/") or return null if it is not a page we make.
  function render(pathname) {
    let lang = 'bn', p = pathname;
    if (p === '/en' || p.startsWith('/en/')) { lang = 'en'; p = p.slice(3) || '/'; }
    if (!p.endsWith('/')) return null;
    if (p === '/') return homePage(lang);
    if (p === '/furniture/') return listingPage(lang, null);
    let m = p.match(/^\/furniture\/([a-z0-9-]+)\/$/);
    if (m) return catBySlug[m[1]] ? listingPage(lang, m[1]) : null;
    m = p.match(/^\/p\/([a-z0-9-]+)\/$/);
    if (m) return bySlug[m[1]] ? productPage(lang, bySlug[m[1]]) : null;
    if (p === '/custom-order/') return customPage(lang);
    if (p === '/about/') return aboutPage(lang);
    if (p === '/contact/') return contactPage(lang);
    return null;
  }

  return { render, allPaths, sitemap, notFoundPage, products };
}
