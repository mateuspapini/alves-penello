(function(){
  var C = window.AP_CONFIG || {};
  var doc = document;

  /* ---------- WhatsApp ---------- */
  window.apWhatsApp = function(msg){
    return "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(msg || "Olá! Vim pelo site e gostaria de falar com um advogado.");
  };
  doc.querySelectorAll("[data-wa]").forEach(function(a){
    var msg = a.getAttribute("data-msg");
    a.href = apWhatsApp(msg);
    a.target = "_blank"; a.rel = "noopener";
    a.addEventListener("click", function(){ track("whatsapp_click", {local: a.getAttribute("data-wa")}); });
  });

  /* ---------- menu ---------- */
  var burger = doc.querySelector(".burger");
  if (burger) burger.addEventListener("click", function(){
    var open = doc.body.classList.toggle("nav-open");
    burger.setAttribute("aria-expanded", open);
  });
  doc.querySelectorAll(".menu a").forEach(function(a){ a.addEventListener("click", function(){ doc.body.classList.remove("nav-open"); }); });
  var top = doc.querySelector(".site-top");
  var onScroll = function(){ if (top) top.classList.toggle("scrolled", window.scrollY > 10); };
  window.addEventListener("scroll", onScroll, {passive:true}); onScroll();

  /* ---------- animação de entrada ---------- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }); }, {rootMargin:"0px 0px -8% 0px"});
    doc.querySelectorAll(".reveal").forEach(function(el){ io.observe(el); });
  } else doc.querySelectorAll(".reveal").forEach(function(el){ el.classList.add("in"); });

  /* ---------- medição (GA4 + Clarity) com consentimento ---------- */
  var KEY = "ap_consent";
  function getConsent(){ try { return localStorage.getItem(KEY); } catch(e){ return null; } }
  function setConsent(v){ try { localStorage.setItem(KEY, v); } catch(e){} }
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag("consent", "default", {ad_storage:"denied", ad_user_data:"denied", ad_personalization:"denied", analytics_storage:"denied"});

  function loadAnalytics(){
    if (C.ga4) {
      var s = doc.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + C.ga4; doc.head.appendChild(s);
      gtag("js", new Date()); gtag("consent", "update", {analytics_storage:"granted"}); gtag("config", C.ga4);
    }
    if (C.clarity) {
      (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,doc,"clarity","script",C.clarity);
      window.clarity("consent");
    }
  }
  window.track = function(name, params){
    try { if (C.ga4) gtag("event", name, params || {}); if (window.clarity) window.clarity("event", name); } catch(e){}
  };
  function track(n,p){ window.track(n,p); }

  var banner = doc.querySelector(".consent");
  var choice = getConsent();
  if (choice === "yes") loadAnalytics();
  else if (!choice && banner && (C.ga4 || C.clarity)) banner.classList.add("show");
  if (banner) {
    banner.querySelector("[data-accept]").addEventListener("click", function(){ setConsent("yes"); banner.classList.remove("show"); loadAnalytics(); });
    banner.querySelector("[data-reject]").addEventListener("click", function(){ setConsent("no"); banner.classList.remove("show"); });
  }
  doc.querySelectorAll("[data-cookies]").forEach(function(a){ a.addEventListener("click", function(e){ e.preventDefault(); if (banner) banner.classList.add("show"); }); });

  /* ---------- formulário de contato → WhatsApp ---------- */
  var form = doc.getElementById("contato-form");
  if (form) form.addEventListener("submit", function(e){
    e.preventDefault();
    if (form.querySelector("[name=website]").value) return; // anti-spam
    var f = new FormData(form);
    var msg = "Olá! Vim pelo site.\n\n" +
      "Nome: " + f.get("nome") + "\n" +
      (f.get("telefone") ? "Telefone: " + f.get("telefone") + "\n" : "") +
      "Assunto: " + f.get("assunto") + "\n\n" + f.get("mensagem");
    track("form_submit", {assunto: f.get("assunto")});
    window.open(apWhatsApp(msg), "_blank", "noopener");
  });

  /* ---------- ano no rodapé ---------- */
  doc.querySelectorAll("[data-year]").forEach(function(el){ el.textContent = new Date().getFullYear(); });
})();
