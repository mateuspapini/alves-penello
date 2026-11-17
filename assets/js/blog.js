/* Alves Penello · blog
   As páginas já saem do build com os artigos prontos (bom para o Google e para
   quem está sem JavaScript). Este arquivo só faz três coisas:
   1. busca na lista de artigos;
   2. mostra artigos publicados no WordPress depois do último build;
   3. abre esses artigos novos em /blog/artigo/?p=slug até o próximo build. */
(function () {
  "use strict";
  var C = window.AP || {};
  var API = "https://public-api.wordpress.com/rest/v1.1/sites/" + encodeURIComponent(C.wp_site) + "/posts/";
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var SETA = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>';
  var ignorar = C.blog_ignorar || [];
  var BASE = C.base || "/"; /* caminho até a raiz do site, a partir desta página */

  function texto(html) { var d = document.createElement("div"); d.innerHTML = html || ""; return (d.textContent || "").replace(/\s+/g, " ").trim(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function dataBr(iso, curta) {
    var p = iso.slice(0, 10).split("-"), m = MESES[+p[1] - 1];
    return curta ? (+p[2]) + " " + m.slice(0, 3) + ". " + p[0] : (+p[2]) + " de " + m + " de " + p[0];
  }
  function resumo(p) {
    var t = texto(p.excerpt).replace("[…]", "").replace("[...]", "").trim().replace(/^Introdução:?\s+/, "");
    return t.length > 170 ? t.slice(0, 170).replace(/\s\S*$/, "").replace(/[,.;:]$/, "") + "…" : t;
  }

  /* ---------- 1 e 2: listas ---------- */
  document.querySelectorAll("[data-posts]").forEach(function (lista) {
    var prontos = [];
    try { prontos = JSON.parse(lista.getAttribute("data-slugs") || "[]"); } catch (e) {}
    var tag = lista.getAttribute("data-tag") || "h2";
    var limite = parseInt(lista.getAttribute("data-posts"), 10) || 0;

    fetch(API + "?number=10&fields=ID,slug,title,excerpt,date")
      .then(function (r) { if (!r.ok) throw r; return r.json(); })
      .then(function (d) {
        var novos = (d.posts || []).filter(function (p) { return prontos.indexOf(p.slug) < 0 && ignorar.indexOf(p.slug) < 0; });
        if (!novos.length) return;
        var html = novos.map(function (p) {
          return '<li class="post rv visto"><a href="' + BASE + 'blog/artigo/?p=' + encodeURIComponent(p.slug) + '">' +
            '<time datetime="' + p.date.slice(0, 10) + '">' + dataBr(p.date, true) + "</time>" +
            "<" + tag + ">" + esc(texto(p.title)) + "</" + tag + ">" +
            "<p>" + esc(resumo(p)) + "</p>" +
            '<span class="seta">Ler artigo' + SETA + "</span></a></li>";
        }).join("");
        var vazio = lista.querySelector(".post--vazio");
        if (vazio) vazio.remove();
        lista.insertAdjacentHTML("afterbegin", html);
        if (limite) [].slice.call(lista.children, limite).forEach(function (li) { li.remove(); });
      })
      .catch(function () { /* sem rede ou API fora do ar: fica a lista do build */ });
  });

  var busca = document.getElementById("busca");
  if (busca) {
    var semResultado = document.getElementById("busca-vazia");
    var normal = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
    var t;
    busca.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var q = normal(busca.value.trim()), achou = 0;
        document.querySelectorAll(".posts .post").forEach(function (li) {
          var ok = !q || normal(li.textContent).indexOf(q) >= 0;
          li.hidden = !ok;
          if (ok) { achou++; li.classList.add("visto"); }
        });
        semResultado.hidden = achou > 0;
      }, 180);
    });
  }

  /* ---------- 3: artigo ainda não gerado pelo build ---------- */
  var art = document.getElementById("artigo-vivo");
  if (art) {
    var slug = new URLSearchParams(location.search).get("p");
    if (!slug || !/^[\w%-]+$/.test(slug)) { location.replace(BASE + "blog/"); return; }
    var titulo = art.querySelector("[data-titulo]"), corpo = art.querySelector("[data-corpo]"), meta = art.querySelector("[data-meta]");
    fetch(API + "slug:" + encodeURIComponent(slug) + "?fields=title,content,date,excerpt")
      .then(function (r) { if (!r.ok) throw r; return r.json(); })
      .then(function (p) {
        var t = texto(p.title);
        document.title = t + " | Alves Penello";
        titulo.textContent = t;
        var minutos = Math.max(2, Math.round(texto(p.content).split(" ").length / 200));
        meta.textContent = dataBr(p.date) + " · " + minutos + " min de leitura";
        /* conteúdo vem do WordPress do próprio escritório; ainda assim, só a estrutura entra na página */
        var caixa = document.createElement("div");
        caixa.innerHTML = p.content;
        caixa.querySelectorAll("script,style,iframe,form,object,embed,link").forEach(function (el) { el.remove(); });
        caixa.querySelectorAll("*").forEach(function (el) {
          [].slice.call(el.attributes).forEach(function (a) {
            var n = a.name.toLowerCase();
            var urlOk = (n === "href" || n === "src") && /^(https?:|\/|#|mailto:)/i.test(a.value);
            if (!(urlOk || n === "alt" || n === "colspan" || n === "rowspan")) el.removeAttribute(a.name);
          });
          if (el.tagName === "A" && el.hostname !== location.hostname) { el.target = "_blank"; el.rel = "noopener"; }
          if (el.tagName === "IMG") el.loading = "lazy";
        });
        caixa.querySelectorAll("table").forEach(function (tb) { var w = document.createElement("div"); w.className = "tabela"; tb.parentNode.insertBefore(w, tb); w.appendChild(tb); });
        corpo.innerHTML = "";
        while (caixa.firstChild) corpo.appendChild(caixa.firstChild);
      })
      .catch(function () {
        titulo.textContent = "Artigo não encontrado";
        corpo.innerHTML = '<p>O endereço pode ter mudado. <a href="' + BASE + 'blog/">Veja todos os artigos</a>.</p>';
      });
  }
})();
