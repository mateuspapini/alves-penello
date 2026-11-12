/* Alves Penello · comportamento comum a todas as páginas */
(function () {
  "use strict";
  var C = window.AP || {};
  var doc = document;
  var body = doc.body;

  /* ---------- medição (só depois do consentimento) ---------- */
  var CHAVE = "ap_consent";
  function ler() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function gravar(v) { try { localStorage.setItem(CHAVE, v); } catch (e) {} }
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function carregarMedicao() {
    if (C.ga4) {
      var s = doc.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + C.ga4;
      doc.head.appendChild(s);
      gtag("js", new Date());
      gtag("config", C.ga4);
    }
    if (C.clarity) {
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      var c = doc.createElement("script");
      c.async = true;
      c.src = "https://www.clarity.ms/tag/" + C.clarity;
      doc.head.appendChild(c);
    }
  }
  window.apEvento = function (nome, dados) {
    try {
      if (C.ga4 && ler() === "sim") gtag("event", nome, dados || {});
    } catch (e) {}
  };

  var aviso = doc.querySelector(".consent");
  var temMedicao = !!(C.ga4 || C.clarity);
  if (temMedicao && ler() === "sim") carregarMedicao();
  if (aviso && temMedicao && !ler()) aviso.hidden = false;
  if (aviso) {
    aviso.querySelector("[data-aceitar]").addEventListener("click", function () { gravar("sim"); aviso.hidden = true; carregarMedicao(); });
    aviso.querySelector("[data-recusar]").addEventListener("click", function () { gravar("nao"); aviso.hidden = true; });
  }
  doc.querySelectorAll("[data-cookies]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (!temMedicao || !aviso) return; // sem medição configurada, o link só leva à política
      e.preventDefault();
      aviso.hidden = false;
      aviso.querySelector("button").focus();
    });
  });

  /* ---------- WhatsApp ---------- */
  window.apWhatsApp = function (msg) {
    return "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(msg);
  };
  doc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-wa]");
    if (a) window.apEvento("whatsapp_click", { local: a.getAttribute("data-wa") });
  });

  /* ---------- menu no celular ---------- */
  var burger = doc.querySelector(".burger");
  var menu = doc.getElementById("menu");
  function fechar(devolverFoco) {
    body.classList.remove("menu-aberto");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Abrir menu");
    if (devolverFoco) burger.focus();
  }
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var abrir = !body.classList.contains("menu-aberto");
      if (!abrir) return fechar(false);
      body.classList.add("menu-aberto");
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Fechar menu");
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) fechar(false); });
    doc.addEventListener("keydown", function (e) {
      if (!body.classList.contains("menu-aberto")) return;
      if (e.key === "Escape") return fechar(true);
      if (e.key !== "Tab") return;
      // mantém o foco entre o botão e os links do menu enquanto ele está aberto
      var itens = [burger].concat([].slice.call(menu.querySelectorAll("a")));
      var i = itens.indexOf(doc.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); itens[itens.length - 1].focus(); }
      else if (!e.shiftKey && i === itens.length - 1) { e.preventDefault(); itens[0].focus(); }
    });
    window.matchMedia("(min-width: 1100px)").addEventListener("change", function (m) { if (m.matches) fechar(false); });
  }

  /* ---------- filete do cabeçalho ao rolar ---------- */
  var topo = doc.getElementById("topo");
  var marcado = false;
  function aoRolar() {
    var r = window.scrollY > 8;
    if (r !== marcado) { marcado = r; topo.classList.toggle("rolou", r); }
  }
  if (topo) { window.addEventListener("scroll", aoRolar, { passive: true }); aoRolar(); }

  /* ---------- entrada suave dos blocos ---------- */
  var alvos = doc.querySelectorAll(".rv");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    alvos.forEach(function (el) { io.observe(el); });
    window.apObservar = function (el) { io.observe(el); };
  } else {
    alvos.forEach(function (el) { el.classList.add("visto"); });
    window.apObservar = function (el) { el.classList.add("visto"); };
  }

  /* ---------- formulário de contato: monta a mensagem e abre o WhatsApp ---------- */
  var form = doc.getElementById("form-contato");
  if (form) {
    var campos = {
      nome: { el: form.querySelector("#f-nome"), msg: "Informe o seu nome." },
      mensagem: { el: form.querySelector("#f-msg"), msg: "Conte em poucas palavras o que está acontecendo." },
      aceite: { el: form.querySelector("#f-aceite"), msg: "Marque a caixa para concordar com a política de privacidade." }
    };
    function erro(c, texto) {
      var alvo = doc.getElementById(c.el.id + "-erro");
      c.el.setAttribute("aria-invalid", texto ? "true" : "false");
      alvo.textContent = texto || "";
      alvo.hidden = !texto;
    }
    function valido(c) { return c.el.type === "checkbox" ? c.el.checked : c.el.value.trim().length > 1; }
    Object.keys(campos).forEach(function (k) {
      var c = campos[k];
      c.el.addEventListener("blur", function () { erro(c, valido(c) ? "" : c.msg); });
      c.el.addEventListener("change", function () { if (valido(c)) erro(c, ""); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.querySelector("[name=site]").value) return; // campo-isca para robôs
      var primeiro = null;
      Object.keys(campos).forEach(function (k) {
        var c = campos[k], ok = valido(c);
        erro(c, ok ? "" : c.msg);
        if (!ok && !primeiro) primeiro = c.el;
      });
      if (primeiro) return primeiro.focus();
      var tel = form.querySelector("#f-tel").value.trim();
      var texto = "Olá! Meu nome é " + campos.nome.el.value.trim() + "." +
        "\nAssunto: " + form.querySelector("#f-assunto").value +
        (tel ? "\nTelefone: " + tel : "") +
        "\n\n" + campos.mensagem.el.value.trim();
      window.apEvento("contato_enviado", {});
      window.open(window.apWhatsApp(texto), "_blank", "noopener");
      doc.getElementById("form-ok").hidden = false;
    });
  }
})();
