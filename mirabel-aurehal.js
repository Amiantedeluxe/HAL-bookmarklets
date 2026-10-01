/*
 * Bookmarklet AuréHAL → Mir@bel (référentiel « Revue »)
 * Interroge l'API Mir@bel (GET /titres), propose les candidats dans un pop-up
 * et remplit le formulaire en un clic.
 * Données Mir@bel : Licence ouverte (Etalab) — mention de l'origine obligatoire.
 */
(async function () {
  'use strict';

  /* ================= CONFIGURATION ================= */
  var API = 'https://reseau-mirabel.info/api';
  var MAX_CANDIDATES = 10;
  var OVERWRITE = false; // false : ne remplit que les champs vides
  // Sélecteurs du formulaire AuréHAL « Revue » (ids réels). Si un sélecteur ne
  // trouve rien, la détection par nom/id/libellé prend le relais.
  var SELECTORS = { titre: '#JNAME', issn: '#ISSN', eissn: '#EISSN', editeur: '#PUBLISHER', url: '#URL' };
  var LABELS = { titre: 'Titre', issn: 'ISSN', eissn: 'e-ISSN', editeur: 'Éditeur', url: 'URL' };
  var RX = {
    eissn: /e-?issn|issn-?e\b|[eé]lectroniq/i,
    issn: /issn/i,
    editeur: /[eé]diteur|publisher/i,
    url: /\burl\b|site\s*web|lien|adresse\s*web/i,
    titre: /titre|title|intitul|nom de la revue|jname/i
  };

  /* ================= OUTILS ================= */
  var HOST_ID = 'mirabel-bookmarklet-host';
  var old = document.getElementById(HOST_ID);
  if (old) { old.remove(); return; } // second clic = fermeture

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function bigrams(s) {
    var m = {}, n = 0;
    for (var i = 0; i < s.length - 1; i++) { var g = s.substr(i, 2); m[g] = (m[g] || 0) + 1; n++; }
    return { m: m, n: n };
  }
  function dice(a, b) { // coefficient de Dice sur les bigrammes
    a = norm(a); b = norm(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    var A = bigrams(a), B = bigrams(b), inter = 0;
    for (var g in A.m) if (B.m[g]) inter += Math.min(A.m[g], B.m[g]);
    return (A.n + B.n) ? (2 * inter) / (A.n + B.n) : 0;
  }
  function fullTitle(t) {
    var p = t.prefixe || '';
    if (p && !/['’\s]$/.test(p)) p += ' ';
    return p + (t.titre || '');
  }
  function normIssn(s) {
    var m = String(s || '').match(/(\d{4})-?(\d{3}[\dXx])/);
    return m ? (m[1] + '-' + m[2]).toUpperCase() : '';
  }

  /* ================= DÉTECTION DES CHAMPS ================= */
  function visibleInputs() {
    return Array.prototype.slice.call(document.querySelectorAll('input, textarea')).filter(function (el) {
      var type = (el.type || 'text').toLowerCase();
      if (['hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'password', 'image', 'reset'].indexOf(type) >= 0) return false;
      if (el.disabled || el.readOnly) return false;
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });
  }
  function haystack(el) {
    var parts = [el.name, el.id, el.placeholder, el.getAttribute('aria-label')];
    Array.prototype.forEach.call(el.labels || [], function (l) { parts.push(l.textContent); });
    var lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\s+/).forEach(function (id) { var n = document.getElementById(id); if (n) parts.push(n.textContent); });
    var box = el.closest('.form-group, .control-group, .row, tr, li, fieldset, div');
    if (box && box.querySelectorAll('input, textarea').length <= 3) {
      var l = box.querySelector('label');
      if (l) parts.push(l.textContent);
    }
    return parts.filter(Boolean).join(' ');
  }
  function locateFields() {
    var inputs = visibleInputs(), used = [], out = {};
    ['eissn', 'issn', 'editeur', 'url', 'titre'].forEach(function (key) {
      var el = null;
      if (SELECTORS[key]) el = document.querySelector(SELECTORS[key]);
      if (!el) el = inputs.filter(function (i) {
        if (used.indexOf(i) >= 0) return false;
        var h = haystack(i);
        if (key === 'issn' && RX.eissn.test(h)) return false;
        return RX[key].test(h);
      })[0] || null;
      if (el) { used.push(el); out[key] = el; }
    });
    return out;
  }
  function setValue(el, v) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    ['input', 'change'].forEach(function (t) { el.dispatchEvent(new Event(t, { bubbles: true })); });
    var prev = el.style.outline;
    el.style.outline = '2px solid #2e7d32';
    setTimeout(function () { el.style.outline = prev; }, 6000);
  }

  /* ================= API MIR@BEL ================= */
  async function apiTitres(params) {
    var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    var r = await fetch(API + '/titres?' + qs, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      var msg = '';
      try { msg = (await r.json()).message; } catch (e) { /* ignore */ }
      throw new Error('HTTP ' + r.status + (msg ? ' – ' + msg : ''));
    }
    return r.json();
  }
  async function search(q, issn) {
    var seen = {}, out = [];
    function add(list) { (list || []).forEach(function (t) { if (!seen[t.id]) { seen[t.id] = 1; out.push(t); } }); }
    if (issn) add(await apiTitres({ issn: issn }));
    if (q && q.length >= 3) {
      add(await apiTitres({ titre: q }));                 // exact (+ sigle)
      add(await apiTitres({ titre: '%' + q + '%' }));      // contient
      var plain = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!out.length && plain !== q) add(await apiTitres({ titre: '%' + plain + '%' })); // sans accents
    }
    out.forEach(function (t) {
      var s = Math.max(dice(q, fullTitle(t)), t.sigle ? dice(q, t.sigle) : 0);
      var hasIssn = issn && (t.issns || []).some(function (i) { return i.issn === issn || i.issnl === issn; });
      t._score = hasIssn ? 1 : s;
    });
    out.sort(function (a, b) { return b._score - a._score; });
    return out.slice(0, MAX_CANDIDATES);
  }
  function mapping(t) {
    var print = '', elec = '', list = (t.issns || []).filter(function (i) { return i.issn; });
    list.forEach(function (i) {
      if (i.support === 'electronique' && !elec) elec = i.issn;
      else if (i.support === 'papier' && !print) print = i.issn;
    });
    list.forEach(function (i) {
      if (i.issn !== print && i.issn !== elec) { if (!print) print = i.issn; else if (!elec) elec = i.issn; }
    });
    return { titre: fullTitle(t), issn: print, eissn: elec, editeur: (t.editeurs || [])[0] || '', url: t.url || '' };
  }

  /* ================= INTERFACE (Shadow DOM) ================= */
  var host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>' +
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,sans-serif}' +
    '.ov{position:absolute;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding:5vh 12px}' +
    '.box{background:#fff;color:#222;width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.4)}' +
    '.hd{display:flex;gap:8px;align-items:center;padding:12px 14px;border-bottom:1px solid #ddd}' +
    '.hd b{flex:0 0 auto}.hd input{flex:1;padding:6px 8px;border:1px solid #bbb;border-radius:5px;font-size:14px}' +
    'button{cursor:pointer;border:1px solid #888;background:#f4f4f4;border-radius:5px;padding:5px 10px;font-size:13px}' +
    'button.ok{background:#1b5e20;color:#fff;border-color:#1b5e20}' +
    '.st{padding:8px 14px;font-size:13px;color:#555;border-bottom:1px solid #eee}' +
    '.ls{overflow:auto;padding:6px 14px;flex:1}' +
    '.it{display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #eee}' +
    '.it.chosen{background:#f1f8e9}' +
    '.sc{flex:0 0 46px;text-align:center;color:#fff;border-radius:4px;padding:3px 0;font-size:12px;font-weight:700}' +
    '.mid{flex:1;min-width:0}.t{font-weight:600}.m{font-size:12px;color:#555;margin-top:2px}' +
    'a{color:#0b57d0;font-size:12px}' +
    '.ft{padding:8px 14px;font-size:11px;color:#777;border-top:1px solid #ddd}' +
    '.opt{padding:6px 14px;font-size:12px;border-bottom:1px solid #eee}.opt input{margin-right:6px}' +
    '.err{color:#b71c1c}' +
    '</style>' +
    '<div class="ov"><div class="box">' +
    '<div class="hd"><b>Mir@bel</b><input type="text" id="q" placeholder="Titre de la revue ou ISSN"><button id="go" class="ok">Chercher</button><button id="x">✕</button></div>' +
    '<div class="st" id="st"></div><div class="opt"><label><input type="checkbox" id="ow">Écraser les champs déjà remplis</label></div><div class="ls" id="ls"></div>' +
    '<div class="ft">Données Mir@bel (reseau-mirabel.info) — Licence ouverte Etalab. Échap pour fermer.</div>' +
    '</div></div>';
  document.body.appendChild(host);

  var $ = function (id) { return root.getElementById(id); };
  function close() { host.remove(); document.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey, true);
  $('x').onclick = close;
  root.querySelector('.ov').addEventListener('mousedown', function (e) { if (e.target.classList.contains('ov')) close(); });

  function status(msg, isErr) { var s = $('st'); s.textContent = msg; s.className = 'st' + (isErr ? ' err' : ''); }
  function color(s) { return s >= 0.85 ? '#2e7d32' : s >= 0.6 ? '#ef6c00' : '#c62828'; }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  function fill(t, row) {
    var f = locateFields(), map = mapping(t), done = [], kept = [], same = [], missing = [], over = OVERWRITE || $('ow').checked;
    Object.keys(map).forEach(function (k) {
      if (!map[k]) return;
      if (!f[k]) { missing.push(LABELS[k]); return; }
      if (f[k].value.trim() === map[k]) { same.push(LABELS[k]); return; }
      if (!over && f[k].value.trim()) { kept.push(LABELS[k]); return; }
      setValue(f[k], map[k]); done.push(LABELS[k]);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.it'), function (n) { n.classList.remove('chosen'); });
    row.classList.add('chosen');
    var parts = ['Rempli : ' + (done.join(', ') || 'rien')];
    if (same.length) parts.push('déjà identique : ' + same.join(', '));
    if (kept.length) parts.push('différent mais non modifié (cocher « Écraser ») : ' + kept.join(', '));
    if (missing.length) parts.push('champ introuvable dans la page : ' + missing.join(', '));
    status(parts.join(' — '), missing.length > 0 && !done.length);
  }

  function render(list) {
    var ls = $('ls'); ls.textContent = '';
    if (!list.length) { status('Aucun titre trouvé dans Mir@bel.'); return; }
    status(list.length + ' candidat(s), triés par similarité.');
    list.forEach(function (t) {
      var row = el('div', 'it');
      var sc = el('div', 'sc', Math.round(t._score * 100) + '%'); sc.style.background = color(t._score);
      var mid = el('div', 'mid');
      mid.appendChild(el('div', 't', fullTitle(t) + (t.sigle ? ' (' + t.sigle + ')' : '')));
      var m = mapping(t), bits = [];
      if (m.issn) bits.push('ISSN ' + m.issn);
      if (m.eissn) bits.push('e-ISSN ' + m.eissn);
      if ((t.editeurs || []).length) bits.push(t.editeurs.join(' ; '));
      var yrs = (t.datedebut ? String(t.datedebut).slice(0, 4) : '?') + '–' + (t.datefin ? String(t.datefin).slice(0, 4) : '');
      bits.push(yrs + (t.datefin || t.obsoletepar ? ' (ancien titre)' : ''));
      mid.appendChild(el('div', 'm', bits.join(' · ')));
      if (/^https:\/\//.test(t.url_revue_mirabel || '')) {
        var a = el('a', '', 'Voir sur Mir@bel'); a.href = t.url_revue_mirabel; a.target = '_blank'; a.rel = 'noopener';
        mid.appendChild(a);
      }
      var btn = el('button', 'ok', 'Remplir'); btn.onclick = function () { fill(t, row); };
      row.appendChild(sc); row.appendChild(mid); row.appendChild(btn);
      ls.appendChild(row);
    });
  }

  async function run() {
    var raw = $('q').value.trim(), issn = normIssn(raw), q = issn && raw.replace(/[\d-]/g, '') === '' ? '' : raw;
    var fields = locateFields();
    if (!issn && fields.issn && raw === initial) issn = normIssn(fields.issn.value); // ISSN du formulaire, tant que la requête n'a pas été modifiée
    if (!q && !issn) { status('Saisir au moins 3 caractères ou un ISSN.', true); return; }
    status('Interrogation de Mir@bel…'); $('ls').textContent = '';
    try { render(await search(q, issn)); }
    catch (e) {
      status('Erreur : ' + e.message + (e instanceof TypeError ? ' (requête bloquée : probablement CORS ou réseau)' : ''), true);
    }
  }
  $('go').onclick = run;
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });

  var f0 = locateFields(), initial;
  $('q').value = initial = (f0.titre && f0.titre.value.trim()) || String(window.getSelection() || '').trim();
  if (!f0.titre) status('Champ « titre » non détecté : saisir le titre ci-dessus (ou renseigner SELECTORS).', true);
  if ($('q').value || (f0.issn && f0.issn.value.trim())) run(); else $('q').focus();
})();
