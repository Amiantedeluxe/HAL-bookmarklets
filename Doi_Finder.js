javascript:(function(){
  'use strict';

  // ---------- Config ----------
  var HAL_API = 'https://api.archives-ouvertes.fr/search/';
  var CROSSREF_API = 'https://api.crossref.org/works';

  // ---------- UI helpers ----------
  function removeExisting() {
    var old = document.getElementById('hal-doi-finder-box');
    if (old) old.remove();
  }

  function showBox(html) {
    removeExisting();
    var box = document.createElement('div');
    box.id = 'hal-doi-finder-box';
    box.style.cssText = [
      'position:fixed', 'top:20px', 'right:20px', 'z-index:999999',
      'width:380px', 'max-height:80vh', 'overflow:auto',
      'background:#fff', 'color:#1a1a1a', 'border:1px solid #ccc',
      'border-radius:8px', 'box-shadow:0 4px 18px rgba(0,0,0,.25)',
      'font-family:Arial,sans-serif', 'font-size:13px', 'padding:14px 16px'
    ].join(';');
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<strong style="font-size:14px;">🔎 HAL DOI Finder</strong>' +
        '<span id="hal-doi-finder-close" style="cursor:pointer;font-size:16px;line-height:1;">✕</span>' +
      '</div>' + html;
    document.body.appendChild(box);
    document.getElementById('hal-doi-finder-close').onclick = removeExisting;
  }

  function showLoading(msg) {
    showBox('<div>' + msg + '…</div>');
  }

  function showError(msg) {
    showBox('<div style="color:#b00020;">⚠️ ' + msg + '</div>');
  }

  // ---------- String similarity (normalized token overlap, simple & dependency-free) ----------
  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function titleSimilarity(a, b) {
    var ta = normalize(a).split(' ').filter(function(w){ return w.length > 2; });
    var tb = normalize(b).split(' ').filter(function(w){ return w.length > 2; });
    if (!ta.length || !tb.length) return 0;
    var setB = new Set(tb);
    var common = ta.filter(function(w){ return setB.has(w); }).length;
    return (2 * common) / (ta.length + tb.length); // dice coefficient
  }

  function authorOverlap(halAuthors, crossrefAuthors) {
    if (!halAuthors || !halAuthors.length || !crossrefAuthors || !crossrefAuthors.length) return 0;
    var halLastNames = halAuthors.map(function(a){
      var parts = normalize(a).split(' ');
      return parts[parts.length - 1];
    });
    var crLastNames = crossrefAuthors.map(function(a){
      return normalize(a.family || '');
    });
    var matches = halLastNames.filter(function(n){ return n && crLastNames.indexOf(n) !== -1; });
    return matches.length / halLastNames.length;
  }

  // ---------- Step 1: get HAL id from URL ----------
  function extractHalId() {
    // handles hal-XXXXXX, halshs-XXXXXX, tel-XXXXXX, etc., with or without version
    var m = window.location.href.match(/\/([a-z]*-\d{6,10})(v\d+)?/i);
    return m ? m[1] : null;
  }

  // ---------- Step 2: fetch notice metadata from HAL API ----------
  function fetchHalNotice(halId) {
    var fields = 'title_s,authFullName_s,journalTitle_s,doiId_s,issn_s';
    var url = HAL_API + '?q=halId_s:' + encodeURIComponent(halId) +
              '&fl=' + fields + '&wt=json';
    return fetch(url).then(function(r) {
      if (!r.ok) throw new Error('Requête HAL échouée (' + r.status + ')');
      return r.json();
    }).then(function(data) {
      var docs = data.response && data.response.docs;
      if (!docs || !docs.length) throw new Error('Notice HAL introuvable pour ' + halId);
      return docs[0];
    });
  }

  // ---------- Step 3: query Crossref ----------
  function queryCrossref(title) {
    var url = CROSSREF_API + '?query.bibliographic=' + encodeURIComponent(title) + '&rows=5';
    return fetch(url).then(function(r) {
      if (!r.ok) throw new Error('Requête Crossref échouée (' + r.status + ')');
      return r.json();
    }).then(function(data) {
      return (data.message && data.message.items) || [];
    });
  }

  // ---------- Step 4: score candidates ----------
  function scoreCandidates(notice, items) {
    var halTitle = (notice.title_s && notice.title_s[0]) || '';
    var halAuthors = notice.authFullName_s || [];

    return items.map(function(item) {
      var crTitle = (item.title && item.title[0]) || '';
      var tScore = titleSimilarity(halTitle, crTitle);
      var aScore = authorOverlap(halAuthors, item.author);
      var score = 0.7 * tScore + 0.3 * aScore;
      return {
        doi: item.DOI,
        title: crTitle,
        authors: (item.author || []).map(function(a){ return (a.given || '') + ' ' + (a.family || ''); }).join(', '),
        container: (item['container-title'] && item['container-title'][0]) || '',
        score: score
      };
    }).sort(function(a, b){ return b.score - a.score; });
  }

  function renderResults(notice, results) {
    var halTitle = (notice.title_s && notice.title_s[0]) || '(titre non trouvé)';
    var journal = notice.journalTitle_s || '(revue non renseignée)';

    var html = '<div style="margin-bottom:10px;font-size:12px;color:#555;">' +
      '<strong>Notice :</strong> ' + halTitle + '<br>' +
      '<strong>Revue :</strong> ' + journal +
      (notice.doiId_s ? '<br><strong>⚠️ DOI déjà présent :</strong> ' + notice.doiId_s : '') +
      '</div><hr style="border:none;border-top:1px solid #eee;margin:8px 0;">';

    if (!results.length) {
      html += '<div>Aucun résultat Crossref pour ce titre.</div>';
    } else {
      results.slice(0, 3).forEach(function(r) {
        var pct = Math.round(r.score * 100);
        var color = pct >= 70 ? '#1a7f37' : (pct >= 40 ? '#b08800' : '#b00020');
        html +=
          '<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f0f0f0;">' +
            '<div style="font-weight:bold;color:' + color + ';">Confiance : ' + pct + '%</div>' +
            '<div style="margin:4px 0;">' + r.title + '</div>' +
            '<div style="color:#666;font-size:12px;">' + r.authors + '</div>' +
            '<div style="color:#666;font-size:12px;font-style:italic;">' + r.container + '</div>' +
            '<div style="margin-top:4px;">' +
              '<a href="https://doi.org/' + r.doi + '" target="_blank" style="margin-right:10px;">doi.org/' + r.doi + '</a>' +
              '<a href="#" class="hal-doi-copy" data-doi="' + r.doi + '">📋 copier</a>' +
            '</div>' +
          '</div>';
      });
      html += '<div style="font-size:11px;color:#888;">Vérifie manuellement avant de compléter la notice — le score est indicatif.</div>';
    }

    showBox(html);

    document.querySelectorAll('.hal-doi-copy').forEach(function(el) {
      el.onclick = function(e) {
        e.preventDefault();
        navigator.clipboard.writeText(el.getAttribute('data-doi'));
        el.textContent = '✅ copié';
      };
    });
  }

  // ---------- Main ----------
  var halId = extractHalId();
  if (!halId) {
    showError('Impossible de détecter un identifiant HAL dans l\'URL. Es-tu bien sur une page de notice ?');
    return;
  }

  showLoading('Récupération de la notice HAL (' + halId + ')');

  fetchHalNotice(halId).then(function(notice) {
    if (notice.doiId_s) {
      // Un DOI existe déjà : on le signale mais on continue quand même la recherche,
      // au cas où ce serait pertinent de vérifier sa validité (optionnel, ici on s'arrête).
      showBox('<div>✅ Cette notice a déjà un DOI : <strong>' + notice.doiId_s + '</strong></div>');
      return null;
    }
    var title = notice.title_s && notice.title_s[0];
    if (!title) throw new Error('Titre absent de la notice HAL.');
    showLoading('Recherche du DOI sur Crossref');
    return queryCrossref(title).then(function(items) {
      var results = scoreCandidates(notice, items);
      renderResults(notice, results);
    });
  }).catch(function(err) {
    showError(err.message || 'Erreur inconnue');
  });

})();
