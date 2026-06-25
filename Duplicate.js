(function() {
  function c(m) {
    let d = document.createElement('div');
    d.style.position = 'fixed';
    d.style.top = '20px';
    d.style.right = '20px';
    d.style.backgroundColor = 'white';
    d.style.border = '2px solid #444';
    d.style.padding = '10px';
    d.style.zIndex = 9999;
    d.style.maxHeight = '70%';
    d.style.overflowY = 'auto';
    d.style.width = '400px';
    d.innerHTML = m;
    let b = document.createElement('button');
    b.textContent = 'Fermer';
    b.onclick = () => d.remove();
    d.appendChild(b);
    document.body.appendChild(d);
  }

  function getHalIdFromMeta() {
  let metas = document.querySelectorAll('meta[name="DC.identifier"]');
  for (let meta of metas) {
    let content = meta.getAttribute('content');
    if (content && content.match(/^hal[a-z]*-\d+/)) {
      return content;
    }
  }
  return null;
}


  let p = window.location.pathname.split('/');
  let h, docid, u;

  // Détection du type d'URL
  if (p.includes('moderate') && p.includes('docid')) {
    // URL de modération
    let idx = p.indexOf('docid');
    if (idx !== -1 && p[idx + 1]) {
      docid = p[idx + 1];
      u = `https://api.archives-ouvertes.fr/crac/hal/?q=docid:${docid}&fl=halId_s,title_s,doiId_s&wt=json`;
    }
  } else {
    // URL classique - accepte tous les types d'identifiants HAL
    h = p[p.length - 1];
    if (h) {
      u = `https://api.archives-ouvertes.fr/search/?q=halId_s:"${h}"&fl=halId_s,title_s,doiId_s&wt=json`;
    }
  }

  if (!u) {
    c("<b>URL non reconnue</b>");
    return;
  }

  let h_base = h ? h.replace(/v\d+$/, '') : '';

  fetch(u)
    .then(r => r.json())
    .then(d => {
      function tryDoc(doc) {
        if (!doc) {
          c("<b>Aucune notice HAL trouvée. </b>");
          return;
        }

        let halId = doc.halId_s || '';
        if (!h_base) h_base = halId.replace(/v\d+$/, '');

        let titles = Array.isArray(doc.title_s) ? doc.title_s : [doc.title_s || ""];
        let doi = Array.isArray(doc.doiId_s) ? doc.doiId_s[0] : doc.doiId_s || "";

        let qParts = [];
        if (doi) qParts.push(`doiId_s:"${doi}"`);

        // Ajouter une partie de requête pour CHAQUE titre
        titles.forEach(t => {
          if (t) {
            let mots = t.replace(/[()":!?,;'-]/g, "").split(/\s+/).slice(0, 12).join(" ");
            if (mots) qParts.push(`title_t:(${mots})`);
          }
        });
        let q = qParts.join(" OR ");
        
        let s = `https://api.archives-ouvertes.fr/search/?q=${encodeURIComponent(q)}&fl=halId_s,title_s,doiId_s&wt=json&rows=50`;

        fetch(s)
          .then(r2 => r2.json())
          .then(r => {
            if (!r.response || !r.response.docs) {
              c("<b>Erreur lors de la recherche de doublons. </b>");
              return;
            }

            let res = r.response.docs.filter(x => {
              let xid = (x.halId_s || "").replace(/v\d+$/, '');
              let xdoi = Array.isArray(x.doiId_s) ? x.doiId_s[0] : x.doiId_s || "";
              if (xid === h_base) return false;
              if (doi && xdoi) return xdoi === doi;
              return true;
            });

            if (res.length === 0) {
              c("<b>Pas de doublon détecté</b>");
              return;
            }

            let content = "<b>Doublons potentiels :</b><ul>";
            res.forEach(x => {
              let id = x.halId_s;
              let title = Array.isArray(x.title_s) ? x.title_s[0] : x.title_s || "";
              let xd = Array.isArray(x.doiId_s) ? x.doiId_s[0] : x.doiId_s || "";
              let url = "https://hal.science/" + id;
              content += `<li><a href="${url}" target="_blank">${id}</a> | ${title} | ${xd ? 'DOI: ' + xd : ''}</li>`;
            });
            content += "</ul>";
            c(content);
          })
          .catch(e => c("Erreur recherche doublons : " + e));
      }

// Traitement de la réponse
      if (d && d.response && d.response.docs && d.response.docs.length) {
        tryDoc(d.response.docs[0]);
      } else if (h_base !== h) {
        // Fallback seulement si h avait une version (v1, v2, etc.)
        let u2 = `https://api.archives-ouvertes.fr/search/?q=halId_s:"${h_base}"&fl=halId_s,title_s,doiId_s&wt=json`;
        fetch(u2)
          .then(r3 => r3.json())
          .then(d2 => {
            if (d2 && d2.response && d2.response.docs && d2.response.docs.length) {
              tryDoc(d2.response.docs[0]);
            } else {
              // Si toujours rien, essayer avec meta tags
              let metaHalId = getHalIdFromMeta();
              if (metaHalId && metaHalId !== h && metaHalId !== h_base) {
                let u3 = `https://api.archives-ouvertes.fr/search/?q=halId_s:"${metaHalId}"&fl=halId_s,title_s,doiId_s&wt=json`;
                h_base = metaHalId.replace(/v\d+$/, '');
                fetch(u3)
                  .then(r4 => r4.json())
                  .then(d3 => {
                    if (d3 && d3.response && d3.response.docs && d3.response.docs.length) {
                      tryDoc(d3.response.docs[0]);
                    } else {
                      c("<b>Aucune notice HAL trouvée.</b>");
                    }
                  })
                  .catch(e => c("Erreur notice HAL (meta fallback) : " + e));
              } else {
                c("<b>Aucune notice HAL trouvée.</b>");
              }
            }
          })
          .catch(e => c("Erreur notice HAL (fallback) : " + e));
      } else {
        // Essayer avec meta tags (cas fusion/redirection)
        let metaHalId = getHalIdFromMeta();
        if (metaHalId && metaHalId !== h) {
          let u3 = `https://api.archives-ouvertes.fr/search/?q=halId_s:"${metaHalId}"&fl=halId_s,title_s,doiId_s&wt=json`;
          h_base = metaHalId.replace(/v\d+$/, '');
          fetch(u3)
            .then(r4 => r4.json())
            .then(d3 => {
              if (d3 && d3.response && d3.response.docs && d3.response.docs.length) {
                tryDoc(d3.response.docs[0]);
              } else {
                c("<b>Aucune notice HAL trouvée.</b>");
              }
            })
            .catch(e => c("Erreur notice HAL (meta fallback) : " + e));
        } else {
          c("<b>Aucune notice HAL trouvée </b>");
        }
      }
    })
    .catch(e => c("Erreur notice HAL : " + e));
})();
