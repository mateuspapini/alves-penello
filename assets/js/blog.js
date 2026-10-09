(function(){
  var C = window.AP_CONFIG || {};
  var API = "https://public-api.wordpress.com/rest/v1.1/sites/" + encodeURIComponent(C.wordpressSite) + "/posts/";
  var FIELDS = "ID,slug,title,excerpt,date,featured_image,author";
  var MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  var FALLBACK = ["/assets/img/blog-800.webp","/assets/img/reuniao-800.webp","/assets/img/calculadoras-800.webp"];

  function strip(html){ var d = document.createElement("div"); d.innerHTML = html || ""; return (d.textContent || "").trim(); }
  function data(iso){ var d = new Date(iso); return d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear(); }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function minutos(html){ return Math.max(2, Math.round(strip(html).split(/\s+/).length / 200)); }

  function card(p, i){
    var img = p.featured_image || FALLBACK[i % FALLBACK.length];
    var resumo = strip(p.excerpt); if (resumo.length > 150) resumo = resumo.slice(0, 147).replace(/\s\S*$/, "") + "…";
    return '<a class="post reveal in" href="/blog/artigo/?p=' + encodeURIComponent(p.slug) + '">' +
      '<figure><img src="' + esc(img) + '" alt="" loading="lazy"></figure>' +
      '<span class="meta">' + data(p.date) + '</span>' +
      '<h3>' + strip(p.title) + '</h3><p>' + esc(resumo) + '</p></a>';
  }
  function skeleton(n){ var h = ""; for (var i=0;i<n;i++) h += '<div class="post"><figure class="skeleton"></figure><span class="meta skeleton" style="height:14px;width:40%"></span><h3 class="skeleton" style="height:56px"></h3></div>'; return h; }

  function fetchPosts(params){
    var q = new URLSearchParams(Object.assign({fields: FIELDS}, params));
    return fetch(API + "?" + q.toString()).then(function(r){ if(!r.ok) throw r; return r.json(); });
  }

  /* lista (home e /blog) */
  document.querySelectorAll("[data-posts]").forEach(function(box){
    var n = parseInt(box.getAttribute("data-posts"), 10) || C.postsPorPagina || 9;
    var paged = box.hasAttribute("data-paged");
    var page = 1, termo = "";
    var pager = document.getElementById("pager");
    var busca = document.getElementById("busca");

    function load(){
      box.innerHTML = skeleton(Math.min(n, 6));
      var params = {number: n, page: page};
      if (termo) params.search = termo;
      fetchPosts(params).then(function(d){
        if (!d.posts || !d.posts.length){ box.innerHTML = '<p class="empty">' + (termo ? "Nenhum artigo encontrado para “" + esc(termo) + "”." : "Em breve, novos artigos por aqui.") + '</p>'; if (pager) pager.innerHTML = ""; return; }
        box.innerHTML = d.posts.map(card).join("");
        if (paged && pager){
          var total = Math.ceil(d.found / n), h = "";
          if (page > 1) h += '<button class="btn line" data-p="' + (page-1) + '">← Anteriores</button>';
          if (page < total) h += '<button class="btn line" data-p="' + (page+1) + '">Mais artigos →</button>';
          pager.innerHTML = h;
          pager.querySelectorAll("button").forEach(function(b){ b.onclick = function(){ page = +b.dataset.p; load(); window.scrollTo({top: box.offsetTop - 140, behavior: "smooth"}); }; });
        }
      }).catch(function(){
        box.innerHTML = '<p class="empty">Não foi possível carregar os artigos agora. Tente novamente em instantes.</p>';
      });
    }
    if (busca){ var t; busca.addEventListener("input", function(){ clearTimeout(t); t = setTimeout(function(){ termo = busca.value.trim(); page = 1; load(); }, 400); }); }
    load();
  });

  /* artigo */
  var art = document.getElementById("artigo");
  if (art){
    var slug = new URLSearchParams(location.search).get("p");
    if (!slug){ location.replace("/blog/"); return; }
    fetch(API + "slug:" + encodeURIComponent(slug) + "?fields=title,content,date,featured_image,author,excerpt,URL")
      .then(function(r){ if(!r.ok) throw r; return r.json(); })
      .then(function(p){
        var titulo = strip(p.title);
        document.title = titulo + " · Alves Penello Advocacia";
        var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute("content", strip(p.excerpt).slice(0, 158));
        var can = document.querySelector('link[rel="canonical"]'); if (can) can.setAttribute("href", "https://alvespenello.com/blog/artigo/?p=" + encodeURIComponent(slug));
        art.querySelector("[data-title]").textContent = titulo;
        art.querySelector("[data-crumb]").textContent = titulo;
        art.querySelector("[data-meta]").textContent = data(p.date) + "  ·  " + minutos(p.content) + " min de leitura";
        var cover = art.querySelector("[data-cover]");
        if (p.featured_image) cover.innerHTML = '<img src="' + esc(p.featured_image) + '" alt="">'; else cover.remove();
        var body = art.querySelector("[data-body]");
        body.innerHTML = p.content;
        body.querySelectorAll("script,iframe:not([src*='youtube']),style").forEach(function(el){ el.remove(); });
        body.querySelectorAll("a").forEach(function(a){ if (a.hostname && a.hostname !== location.hostname){ a.target = "_blank"; a.rel = "noopener"; } });
        body.querySelectorAll("img").forEach(function(i){ i.loading = "lazy"; i.removeAttribute("width"); i.removeAttribute("height"); });
        var ld = {"@context":"https://schema.org","@type":"BlogPosting","headline":titulo,"datePublished":p.date,"image":p.featured_image||undefined,"author":{"@type":"Person","name":(p.author&&p.author.name)||"Alves Penello Advocacia"},"publisher":{"@type":"LegalService","name":"Alves Penello Advocacia e Consultoria"}};
        var s = document.createElement("script"); s.type = "application/ld+json"; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
        if (window.track) window.track("artigo_lido", {slug: slug});
      })
      .catch(function(){
        art.querySelector("[data-title]").textContent = "Artigo não encontrado";
        art.querySelector("[data-body]").innerHTML = '<p>Este artigo pode ter mudado de endereço. <a href="/blog/">Veja todos os artigos</a>.</p>';
        art.querySelector("[data-cover]").remove();
      });
  }
})();
