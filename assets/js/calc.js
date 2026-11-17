/* Alves Penello · calculadoras
   Tudo é calculado no navegador. Nada é enviado, a não ser que a pessoa
   toque no botão do WhatsApp do resultado. */
(function () {
  "use strict";

  /* ======================================================================
     REGRAS DE CÁLCULO (PROVISÓRIAS)
     São as mesmas regras gerais que o site já usava. O escritório vai enviar
     os percentuais e prazos validados de cada regime: quando chegarem, troque
     os números abaixo e aumente a VERSAO (ela aparece em cada simulação).
     ====================================================================== */
  var VERSAO = "1.0";
  var REGRAS = {
    distrato: {                         // incorporação, contrato a partir de 28/12/2018 (art. 67-A da Lei 4.591/1964)
      semAfetacao: { retMin: 0.10, retMax: 0.25, prazo: "até 180 dias após o distrato" },
      comAfetacao: { retMin: 0.10, retMax: 0.50, prazo: "até 30 dias após o habite-se" }
    },
    distratoAntes: { retMin: 0.10, retMax: 0.25, prazo: "de uma só vez (Súmula 543 do STJ)" },   // contratos anteriores a 28/12/2018
    distratoLote: { retContratoMax: 0.10, prazo: "em até 12 parcelas mensais" },               // art. 32-A da Lei 6.766/1979
    atraso: { tolerancia: 180, multaMes: 0.01, lucrosMin: 0.005, lucrosMax: 0.01, prazoRescisao: "até 60 dias após a rescisão" }
  };
  var AVISO_DISTRATO = "Estimativa informativa, baseada em regras gerais e sem análise do contrato. Não inclui correção monetária, juros nem cláusulas específicas. Critérios de retenção estão em discussão no STJ e podem mudar.";
  var AVISO_GERAL = "Estimativa informativa, baseada em regras gerais e sem análise do contrato. Não inclui correção monetária, juros nem cláusulas específicas.";

  /* ---------- utilitários ---------- */
  var BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var DT = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
  var DIA = 86400000;

  function reais(v) { return BRL.format(Math.max(0, Math.round(v * 100) / 100)); }
  function lerReais(s) { var d = String(s || "").replace(/\D/g, ""); return d ? parseInt(d, 10) / 100 : 0; }
  function lerData(s) { if (!s) return null; var p = s.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function hoje() { var n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
  function somaDias(d, n) { return new Date(d.getTime() + n * DIA); }
  function dias(a, b) { return Math.round((b - a) / DIA); }
  function somaMeses(d, m) {
    var r = new Date(d.getTime()), dia = r.getUTCDate();
    r.setUTCDate(1); r.setUTCMonth(r.getUTCMonth() + m);
    var ultimo = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
    r.setUTCDate(Math.min(dia, ultimo));
    return r;
  }
  function mesesDias(m, d) {
    var t = [];
    if (m) t.push(m + (m === 1 ? " mês" : " meses"));
    if (d || !m) t.push(d + (d === 1 ? " dia" : " dias"));
    return t.join(" e ");
  }
  function entre(a, b) { var m = 0; while (somaMeses(a, m + 1) <= b) m++; return mesesDias(m, dias(somaMeses(a, m), b)); }
  function duracao(nDias) { return entre(new Date(0), new Date(nDias * DIA)); }
  function pct(x) { return (x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function reduz() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function evento(nome, dados) { if (window.apEvento) window.apEvento(nome, dados); }
  function faixa(min, max) {
    if (max == null) return "A partir de " + reais(min);
    if (Math.round(min) === Math.round(max)) return reais(min);
    return "Entre " + reais(min) + " e " + reais(max);
  }

  /* máscara de moeda: a pessoa digita só números */
  document.querySelectorAll("[data-dinheiro]").forEach(function (i) {
    i.addEventListener("input", function () { var v = lerReais(i.value); i.value = v ? BRL.format(v) : ""; });
  });

  /* ---------- erros por campo ---------- */
  function marcar(campo, texto) {
    var alvo = document.getElementById(campo.id + "-erro");
    campo.setAttribute("aria-invalid", texto ? "true" : "false");
    if (alvo) { alvo.textContent = texto || ""; alvo.hidden = !texto; }
  }
  function limpar(form) {
    form.querySelectorAll("[aria-invalid]").forEach(function (c) { marcar(c, ""); });
  }
  /* recebe [[campo, mensagem], ...]; marca todos e leva o foco ao primeiro */
  function reprovar(lista) {
    lista.forEach(function (e) { marcar(e[0], e[1]); });
    if (lista.length) lista[0][0].focus();
    return lista.length > 0;
  }
  function limparAoDigitar(form) {
    form.addEventListener("input", function (e) {
      if (e.target.getAttribute && e.target.getAttribute("aria-invalid") === "true") marcar(e.target, "");
    });
    form.addEventListener("change", function (e) {
      if (e.target.type === "checkbox" && e.target.checked) marcar(e.target, "");
    });
  }

  /* ---------- painel de resultado ---------- */
  var ZAP = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 20.5l1.4-4.7A8.5 8.5 0 1 1 8.1 19.2z"/><path d="M9.2 8.3c-.6 1 .1 2.9 1.7 4.6s3.6 2.5 4.7 1.9l.5-1.3-2-1.1-.9.8c-.9-.4-1.7-1.2-2.1-2.1l.8-.9-1.1-2z"/></svg>';

  function botaoZap(local, msg, rotulo) {
    return '<a class="btn" target="_blank" rel="noopener" data-wa="' + esc(local) + '" href="' + esc(window.apWhatsApp(msg)) + '">' + ZAP + esc(rotulo) + "</a>";
  }
  function rolarAte(caixa) {
    if (window.innerWidth < 1000) caixa.scrollIntoView({ behavior: reduz() ? "auto" : "smooth", block: "start" });
  }

  /* Monta o resultado. O aviso e a data ficam logo abaixo do valor, para aparecerem em qualquer print. */
  function mostrar(caixa, o) {
    var linhas = (o.linhas || []).map(function (l) { return "<div><dt>" + esc(l[0]) + "</dt><dd>" + esc(l[1]) + "</dd></div>"; }).join("");
    var barra = "";
    if (o.barra) {
      var p = Math.max(0, Math.min(100, o.barra.feito * 100));
      barra = '<div class="barra" role="img" aria-label="' + esc(o.barra.rotuloFeito + ": " + o.barra.feitoTxt + ". " + o.barra.rotuloResto + ": " + o.barra.restoTxt) + '">' +
        '<div class="barra__trilho"><div class="barra__feito" style="width:' + p.toFixed(1) + '%"></div></div>' +
        '<div class="barra__leg"><span>' + esc(o.barra.rotuloFeito) + " · " + esc(o.barra.feitoTxt) + "</span><span>" + esc(o.barra.rotuloResto) + " · " + esc(o.barra.restoTxt) + "</span></div></div>";
    }
    var premissas = o.premissas && o.premissas.length
      ? '<div class="res__premissas"><p>Calculado considerando:</p><ul>' + o.premissas.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div>"
      : "";
    caixa.innerHTML =
      '<p class="res__tag">' + esc(o.tag) + "</p>" +
      '<p class="res__rot">' + esc(o.rotulo) + "</p>" +
      '<p class="res__valor' + (o.faixa ? " res__valor--faixa" : "") + '">' + esc(o.valor) + "</p>" +
      (o.sub ? '<p class="res__sub">' + esc(o.sub) + "</p>" : "") + barra + premissas +
      '<p class="res__aviso">' + esc(o.aviso) + "</p>" +
      '<p class="res__versao">Simulação gerada em ' + DT.format(hoje()) + " · versão " + VERSAO + "</p>" +
      (linhas ? '<dl class="res__linhas">' + linhas + "</dl>" : "") +
      (o.nota ? '<p class="res__nota">' + esc(o.nota) + "</p>" : "") +
      botaoZap("resultado-" + o.calc, o.msg, "Enviar simulação pelo WhatsApp") +
      (o.refazer ? '<button class="res__refazer" type="button">Fazer outra simulação</button>' : "");
    evento("calc_concluida", { calculadora: o.calc });
    rolarAte(caixa);
  }
  function vazio(caixa, texto) {
    caixa.innerHTML = '<div class="res__vazio"><strong>O resultado aparece aqui.</strong><p>' + esc(texto) + "</p></div>";
  }

  /* ============ 1. Rescisão de aluguel ============ */
  var al = document.getElementById("calc-aluguel");
  if (al) {
    var f1 = al.querySelector("form"), r1 = al.querySelector(".res");
    var cValor = f1.querySelector("#al-valor"), cIni = f1.querySelector("#al-inicio"), cPrazo = f1.querySelector("#al-prazo"),
      cSaida = f1.querySelector("#al-saida"), cMulta = f1.querySelector("#al-multa");
    if (!cSaida.value) cSaida.value = hoje().toISOString().slice(0, 10);
    limparAoDigitar(f1);

    f1.addEventListener("submit", function (e) {
      e.preventDefault();
      limpar(f1);
      var V = lerReais(cValor.value), ini = lerData(cIni.value), P = parseInt(cPrazo.value, 10),
        sai = lerData(cSaida.value), M = parseFloat(String(cMulta.value).replace(",", ".")),
        transf = f1.querySelector("[name=al-transf]:checked").value === "sim";
      var erros = [];
      if (!V) erros.push([cValor, "Informe o valor mensal do aluguel."]);
      if (!ini) erros.push([cIni, "Informe a data de início do contrato."]);
      if (!(P > 0)) erros.push([cPrazo, "Informe o prazo em meses. Exemplo: 30."]);
      if (!sai) erros.push([cSaida, "Informe a data em que pretende sair."]);
      else if (ini && sai < ini) erros.push([cSaida, "A saída não pode ser anterior ao início do contrato."]);
      if (isNaN(M) || M < 0) erros.push([cMulta, "Informe a multa em número de aluguéis. Exemplo: 3."]);
      if (reprovar(erros)) return;

      var fim = somaMeses(ini, P), total = dias(ini, fim), resta = dias(sai, fim);
      var mTxt = String(M).replace(".", ",") + (M === 1 ? " aluguel" : " aluguéis");
      var prazoTxt = P + (P === 1 ? " mês" : " meses");
      var premissas = ["contrato de " + prazoTxt + " iniciado em " + DT.format(ini), "multa de " + mTxt + " prevista no contrato",
        "saída em " + DT.format(sai), transf ? "saída por transferência de trabalho determinada pelo empregador" : "saída sem transferência de trabalho pelo empregador"];
      var curtas = "contrato de " + prazoTxt + ", multa de " + mTxt + ", saída em " + DT.format(sai);
      var base = [["Aluguel mensal", reais(V)], ["Prazo do contrato", prazoTxt], ["Fim do contrato", DT.format(fim)], ["Saída prevista", DT.format(sai)]];
      function msg(est) { return "Olá! Fiz uma simulação de rescisão de aluguel no site (" + est + "; " + curtas + "). Gostaria de uma análise do meu contrato."; }

      if (resta <= 0) {
        return mostrar(r1, {
          calc: "rescisao-aluguel", tag: "Contrato por prazo indeterminado", rotulo: "Multa por quebra de prazo", valor: reais(0),
          sub: "Na data de saída, o prazo do contrato já terminou.", premissas: premissas, aviso: AVISO_GERAL,
          linhas: base.concat([["Aviso prévio", "30 dias, por escrito"]]), msg: msg("estimativa sem multa, contrato já vencido"),
          nota: "Com o contrato vencido e prorrogado por prazo indeterminado, o inquilino pode sair sem multa, desde que avise o locador por escrito com 30 dias de antecedência. Sem o aviso, o locador pode cobrar o valor de um aluguel (art. 6º da Lei 8.245/1991)."
        });
      }
      var barra = { feito: 1 - resta / total, rotuloFeito: "Cumprido", feitoTxt: entre(ini, sai), rotuloResto: "Restante", restoTxt: entre(sai, fim) };
      if (transf) {
        return mostrar(r1, {
          calc: "rescisao-aluguel", tag: "Hipótese de dispensa", rotulo: "Multa estimada", valor: reais(0),
          sub: "Transferência de trabalho determinada pelo empregador.", barra: barra, premissas: premissas, aviso: AVISO_GERAL,
          linhas: base.concat([["Aviso prévio", "30 dias, por escrito"]]), msg: msg("estimativa sem multa, por transferência de trabalho"),
          nota: "O parágrafo único do art. 4º da Lei 8.245/1991 dispensa a multa quando o inquilino é transferido pelo empregador para trabalhar em outra localidade, desde que avise o locador por escrito com pelo menos 30 dias de antecedência."
        });
      }
      var prop = resta / total, integral = M * V, multa = integral * prop;
      mostrar(r1, {
        calc: "rescisao-aluguel", tag: "Art. 4º da Lei 8.245/1991", rotulo: "Multa estimada", valor: reais(multa),
        sub: "Proporcional ao tempo que falta para o fim do contrato.", barra: barra, premissas: premissas, aviso: AVISO_GERAL,
        linhas: base.concat([["Multa integral (" + mTxt + ")", reais(integral)], ["Proporção aplicada", pct(prop)]]),
        msg: msg("estimativa de multa de " + reais(multa)),
        nota: "O cálculo é proporcional aos dias que restam do contrato. Além da multa, podem ser devidos aluguéis e encargos até a entrega das chaves e eventuais reparos no imóvel."
      });
    });
  }

  /* ============ 2. Imóvel na planta: triagem em etapas + estimativa ============ */
  var pl = document.getElementById("calc-planta");
  if (pl) {
    var f2 = pl.querySelector("form"), r2 = pl.querySelector(".res");
    var ORDEM = ["vendedor", "tipo", "data", "pagamento", "posse", "afetacao", "benfeitorias", "situacao", "escolha", "processo", "dados"];
    /* respostas que levam à "Análise individual": casos em que uma estimativa geral seria enganosa */
    var EXCLUI = {
      vendedor: { particular: "imóvel comprado de pessoa física ou particular" },
      tipo: { pronto: "imóvel pronto" },
      pagamento: { financiamento: "financiamento bancário já contratado", fiduciaria: "contrato com alienação fiduciária", ns: "forma de pagamento não confirmada" },
      benfeitorias: { sim: "lote com construção ou benfeitorias" },
      situacao: { outro: "outro descumprimento da vendedora" },
      processo: { sim: "processo judicial ou distrato já assinado" }
    };
    var etapaAtual = "vendedor", iniciou = false;
    var conta = f2.querySelector(".etapas__conta"), barraProg = f2.querySelector(".etapas__barra span"),
      erroEtapa = f2.querySelector(".etapas__erro"),
      bVoltar = f2.querySelector("[data-voltar]"), bAvancar = f2.querySelector("[data-avancar]"), bCalcular = f2.querySelector("[data-calcular]"),
      campoPosse = f2.querySelector(".campo--posse"), cPosse = f2.querySelector("#pl-posse-data"),
      cPago = f2.querySelector("#pl-pago"), cContrato = f2.querySelector("#pl-contrato"), cPrev = f2.querySelector("#pl-prevista"),
      cImovel = f2.querySelector("#pl-imovel"), cCorr = f2.querySelector("#pl-corretagem"), cAceite = f2.querySelector("#pl-aceite");
    var VAZIO = "Responda às perguntas e toque em calcular.";
    limparAoDigitar(f2);

    function resp(n) { var el = f2.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : ""; }
    function aplica(n) {
      if (n === "afetacao") return resp("tipo") === "unidade";
      if (n === "benfeitorias") return resp("tipo") === "lote";
      if (n === "escolha") return resp("situacao") === "atraso";
      return true;
    }
    function caminho() { return ORDEM.filter(aplica); }
    function cenario() {
      if (resp("situacao") === "desistir") return resp("data") === "antes" ? "distrato-antes" : (resp("tipo") === "lote" ? "distrato-lote" : "distrato-unidade");
      return resp("escolha") === "desfazer" ? "atraso-desfazer" : "atraso-ficar";
    }
    function avisoEtapa(t) { erroEtapa.textContent = t || ""; erroEtapa.hidden = !t; }
    function temResultado() { return !r2.querySelector(".res__vazio"); }

    function mostrarEtapa(n, focar) {
      etapaAtual = n;
      f2.querySelectorAll(".etapa").forEach(function (e) { e.classList.toggle("etapa--ativa", e.getAttribute("data-etapa") === n); });
      var cam = caminho(), pos = cam.indexOf(n) + 1, total = cam.length + (resp("tipo") ? 0 : 1);
      conta.textContent = "Etapa " + pos + " de " + total;
      barraProg.style.width = Math.round(pos / total * 100) + "%";
      bVoltar.hidden = n === "vendedor";
      bAvancar.hidden = n === "dados";
      bCalcular.hidden = n !== "dados";
      if (n === "dados") prepararDados();
      if (focar) {
        f2.querySelector('[data-etapa="' + n + '"] .etapa__pergunta').focus({ preventScroll: true });
        var topo = f2.getBoundingClientRect().top;
        if (topo < 0 || topo > window.innerHeight * 0.5) f2.scrollIntoView({ behavior: reduz() ? "auto" : "smooth", block: "start" });
      }
    }

    /* campos e rótulos da última etapa mudam conforme o tipo de imóvel e a situação */
    function prepararDados() {
      var c = cenario(), lote = resp("tipo") === "lote";
      f2.querySelectorAll("[data-campo]").forEach(function (el) {
        var lista = el.getAttribute("data-campo").split(" ");
        el.hidden = lista.indexOf("todos") < 0 && lista.indexOf(c) < 0;
      });
      var rotPago = f2.querySelector('label[for="pl-pago"]');
      rotPago.textContent = rotPago.getAttribute(lote ? "data-rotulo-lote" : "data-rotulo-unidade");
      f2.querySelector('label[for="pl-imovel"]').textContent =
        resp("data") === "antes" ? "Valor do imóvel no contrato" : "Valor do imóvel no contrato (opcional)";
    }

    function analiseIndividual(motivo) {
      var msg = "Olá! Fiz a triagem da calculadora de imóvel na planta no site. Meu caso precisa de análise individual (motivo: " + motivo + "). Gostaria de uma análise do meu contrato.";
      r2.innerHTML = '<p class="res__tag">Análise individual</p>' +
        '<p class="res__titulo">Seu caso envolve particularidades que não permitem uma estimativa segura. Recomendamos a análise do seu contrato.</p>' +
        '<p class="res__sub">Motivo: ' + esc(motivo) + ".</p>" +
        botaoZap("analise-imovel-na-planta", msg, "Pedir análise pelo WhatsApp") +
        '<p class="res__nota">Se a resposta não corresponde ao seu caso, você pode alterá-la e continuar.</p>';
      evento("calc_analise_individual", { motivo: motivo });
      rolarAte(r2);
    }

    bAvancar.addEventListener("click", function () {
      var n = etapaAtual, v = resp(n);
      if (!v) { avisoEtapa("Escolha uma opção para continuar."); return; }
      if (n === "posse" && v === "sim") {
        var d = lerData(cPosse.value);
        if (!d) { marcar(cPosse, "Informe a data em que recebeu as chaves ou a posse."); cPosse.focus(); return; }
        if (d > hoje()) { marcar(cPosse, "A data não pode estar no futuro."); cPosse.focus(); return; }
      }
      var motivo = (EXCLUI[n] || {})[v];
      // provisório, a confirmar com o escritório: atraso em loteamento segue regras próprias
      if (!motivo && n === "situacao" && v === "atraso" && resp("tipo") === "lote") motivo = "atraso na entrega de loteamento";
      if (motivo) { analiseIndividual(motivo); return; }
      if (temResultado()) vazio(r2, VAZIO);
      var cam = caminho();
      mostrarEtapa(cam[cam.indexOf(n) + 1], true);
    });

    bVoltar.addEventListener("click", function () {
      var cam = caminho(), ant = cam[cam.indexOf(etapaAtual) - 1];
      if (ant) mostrarEtapa(ant, true);
    });

    f2.addEventListener("change", function (e) {
      if (e.target.type !== "radio") return;
      avisoEtapa("");
      if (!iniciou) { iniciou = true; evento("calc_inicio", { calculadora: "imovel-na-planta" }); }
      if (e.target.name === "posse") {
        campoPosse.hidden = e.target.value !== "sim";
        if (e.target.value !== "sim") marcar(cPosse, "");
      }
      if (temResultado()) vazio(r2, VAZIO);   // mudou uma resposta: o resultado anterior deixa de valer
      mostrarEtapa(etapaAtual, false);        // o total de etapas pode mudar conforme a resposta
    });

    /* premissas: versão completa para a tela e versão curta para a mensagem do WhatsApp */
    function premissas(c, v) {
      var longas = [], curtas = [];
      if (resp("data") === "antes") { longas.push("contrato assinado antes de 28/12/2018, sem as regras da Lei do Distrato"); curtas.push("contrato anterior a 2018"); }
      else { longas.push("contrato assinado a partir de 28/12/2018, com as regras da Lei do Distrato"); curtas.push("contrato a partir de 2018"); }
      if (resp("tipo") === "lote") { longas.push("lote vago em loteamento"); curtas.push("lote vago"); }
      else {
        var af = resp("afetacao");
        if (af === "sim") { longas.push("incorporação com patrimônio de afetação"); curtas.push("com afetação"); }
        else if (af === "nao") { longas.push("incorporação sem patrimônio de afetação"); curtas.push("sem afetação"); }
        else {
          longas.push(c === "distrato-unidade" ? "patrimônio de afetação não informado, por isso a estimativa mostra os dois cenários" : "patrimônio de afetação não informado");
          curtas.push("afetação não informada");
        }
      }
      if (resp("posse") === "sim") {
        var dp = DT.format(lerData(cPosse.value));
        longas.push("com posse desde " + dp + (c.indexOf("distrato") === 0 ? ". O desconto pelo uso do imóvel (taxa de fruição) não entra nesta estimativa" : ""));
        curtas.push("com posse desde " + dp);
      } else { longas.push("sem posse do imóvel"); curtas.push("sem posse"); }
      longas.push("pagamento feito diretamente à vendedora, sem processo judicial nem distrato assinado");
      if (c.indexOf("distrato") === 0) {
        if (v.corr) { longas.push("corretagem de " + reais(v.corr) + " descontada"); curtas.push("corretagem de " + reais(v.corr)); }
      } else {
        longas.push("tolerância de 180 dias prevista no contrato");
        curtas.push("tolerância de 180 dias");
      }
      return { longas: longas, curtas: curtas };
    }

    function resultado(o) {
      var min = o.min != null ? Math.max(0, o.min) : null, max = o.max != null ? Math.max(0, o.max) : null;
      var est = o.status ? "estimativa: " + o.status.toLowerCase()
        : max == null ? "estimativa a partir de " + reais(min) : "estimativa entre " + reais(min) + " e " + reais(max);
      mostrar(r2, {
        calc: "imovel-na-planta", tag: o.tag, rotulo: o.rotulo, valor: o.status || faixa(min, max), faixa: true,
        sub: o.sub, premissas: o.P.longas, linhas: o.linhas, nota: o.nota, aviso: o.aviso, refazer: true,
        msg: "Olá! Fiz uma simulação no site (" + est + "; " + o.P.curtas.join(", ") + "). Gostaria de uma análise do meu contrato."
      });
    }

    function calcular(c, v) {
      var P = premissas(c, v), corrTxt = v.corr ? "− " + reais(v.corr) : "não informada";

      if (c === "distrato-antes") {
        var ra = REGRAS.distratoAntes;
        return resultado({
          P: P, tag: "Distrato · contrato anterior à Lei do Distrato", rotulo: "Devolução estimada",
          min: v.pago * (1 - ra.retMax) - v.corr, max: v.pago * (1 - ra.retMin) - v.corr,
          linhas: [["Total pago", reais(v.pago)], ["Retenção considerada", pct(ra.retMin) + " a " + pct(ra.retMax) + " do valor pago"], ["Corretagem", corrTxt], ["Prazo de devolução", ra.prazo]],
          nota: "Contratos assinados antes de 28/12/2018 não seguem a Lei do Distrato. Nesses casos, os tribunais costumam admitir retenção entre 10% e 25% dos valores pagos, com devolução de uma só vez (Súmula 543 do STJ).",
          aviso: AVISO_DISTRATO
        });
      }

      if (c === "distrato-unidade") {
        var sem = REGRAS.distrato.semAfetacao, com = REGRAS.distrato.comAfetacao, af = resp("afetacao");
        var f = function (r) { return [v.pago * (1 - r.retMax) - v.corr, v.pago * (1 - r.retMin) - v.corr]; };
        if (af === "ns") {
          var a = f(sem), b = f(com);
          return resultado({
            P: P, tag: "Distrato em incorporação", rotulo: "Devolução estimada", min: Math.min(a[0], b[0]), max: Math.max(a[1], b[1]),
            sub: "O valor depende de haver ou não patrimônio de afetação.",
            linhas: [["Total pago", reais(v.pago)], ["Sem afetação (retenção de " + pct(sem.retMin) + " a " + pct(sem.retMax) + ")", faixa(Math.max(0, a[0]), Math.max(0, a[1]))],
              ["Com afetação (retenção de " + pct(com.retMin) + " a " + pct(com.retMax) + ")", faixa(Math.max(0, b[0]), Math.max(0, b[1]))], ["Corretagem", corrTxt]],
            nota: "A lei permite multa de até 25% dos valores pagos, ou até 50% quando há patrimônio de afetação. Os percentuais podem ser revistos pela Justiça.",
            aviso: AVISO_DISTRATO
          });
        }
        var r = af === "sim" ? com : sem, x = f(r);
        return resultado({
          P: P, rotulo: "Devolução estimada", min: x[0], max: x[1],
          tag: af === "sim" ? "Distrato com patrimônio de afetação · art. 67-A da Lei 4.591/1964" : "Distrato · art. 67-A da Lei 4.591/1964",
          linhas: [["Total pago", reais(v.pago)], ["Retenção considerada", pct(r.retMin) + " a " + pct(r.retMax) + " do valor pago"], ["Corretagem", corrTxt], ["Prazo de devolução", r.prazo]],
          nota: af === "sim"
            ? "Com patrimônio de afetação, a lei admite multa de até 50% dos valores pagos (art. 67-A, § 5º, da Lei 4.591/1964). Percentuais abusivos podem ser revistos pela Justiça."
            : "A lei admite multa de até 25% dos valores pagos, além da corretagem e de eventuais encargos pelo uso do imóvel. Os percentuais podem ser revistos pela Justiça.",
          aviso: AVISO_DISTRATO
        });
      }

      if (c === "distrato-lote") {
        var rl = REGRAS.distratoLote, ret = rl.retContratoMax * v.contrato;
        return resultado({
          P: P, tag: "Distrato de lote · art. 32-A da Lei 6.766/1979", rotulo: "Devolução estimada",
          min: v.pago - ret - v.corr, max: v.pago - v.corr,
          sub: "Depende da multa prevista no contrato, que a lei limita a 10% do valor do contrato.",
          linhas: [["Total pago", reais(v.pago)], ["Valor do contrato", reais(v.contrato)], ["Multa do contrato", "de " + reais(0) + " a " + reais(ret)], ["Corretagem", corrTxt], ["Prazo de devolução", rl.prazo]],
          nota: "Em loteamentos, a lei limita a retenção a 10% do valor atualizado do contrato, além de despesas como corretagem e encargos pelo uso do lote, quando houver.",
          aviso: AVISO_DISTRATO
        });
      }

      /* atraso na entrega */
      var rt = REGRAS.atraso, comPosse = resp("posse") === "sim", antes = resp("data") === "antes";
      var ate = comPosse ? lerData(cPosse.value) : hoje(), tol = somaDias(v.prev, rt.tolerancia);
      var atraso = dias(tol, ate), atrasoTotal = dias(v.prev, ate);
      var datas = [["Entrega prevista", DT.format(v.prev)], ["Fim da tolerância (180 dias)", DT.format(tol)], [comPosse ? "Entrega das chaves" : "Calculado até", DT.format(ate)]];

      if (atraso <= 0) {
        return resultado({
          P: P, tag: "Dentro do prazo de tolerância", rotulo: c === "atraso-ficar" ? "Indenização por atraso" : "Rescisão por atraso",
          status: c === "atraso-ficar" ? "Ainda sem indenização" : "Ainda não cabe a rescisão por atraso",
          sub: atrasoTotal > 0 ? "O atraso de " + duracao(atrasoTotal) + " ainda está dentro dos 180 dias de tolerância." : "A data prevista de entrega ainda não passou.",
          linhas: datas.concat([["Total pago", reais(v.pago)]]),
          nota: "A tolerância de até 180 dias vale quando está prevista no contrato de forma clara. Se o seu contrato não prevê tolerância, o atraso pode ser contado desde a data de entrega.",
          aviso: AVISO_GERAL
        });
      }

      var meses = atraso / 30;
      if (c === "atraso-ficar") {
        var multa = antes ? null : v.pago * rt.multaMes * meses;
        var lcMin = v.imovel ? v.imovel * rt.lucrosMin * meses : null, lcMax = v.imovel ? v.imovel * rt.lucrosMax * meses : null;
        var valores = [multa, lcMin, lcMax].filter(function (n) { return n != null; });
        var linhas = datas.concat([["Atraso após a tolerância", duracao(atraso)], ["Total pago", reais(v.pago)]]);
        if (multa != null) linhas.push(["Multa legal (" + pct(rt.multaMes) + " do valor pago ao mês)", reais(multa)]);
        linhas.push(["Lucros cessantes (" + pct(rt.lucrosMin) + " a " + pct(rt.lucrosMax) + " do imóvel ao mês)", v.imovel ? faixa(lcMin, lcMax) : "informe o valor do imóvel"]);
        return resultado({
          P: P, rotulo: "Indenização estimada", min: Math.min.apply(null, valores), max: lcMax == null ? null : Math.max.apply(null, valores),
          tag: antes ? "Atraso na entrega · contrato anterior à Lei do Distrato" : "Atraso na entrega · art. 43-A da Lei 4.591/1964",
          sub: "Indenização pelos " + duracao(atraso) + " de atraso depois da tolerância.",
          linhas: linhas,
          nota: antes
            ? "Em contratos anteriores a 28/12/2018, os tribunais costumam reconhecer lucros cessantes próximos ao aluguel do imóvel, entre 0,5% e 1% do valor ao mês (Tema 996 do STJ)."
            : "A lei prevê indenização de 1% do valor pago por mês de atraso. Os tribunais também reconhecem lucros cessantes, em geral entre 0,5% e 1% do valor do imóvel ao mês, que não se somam à multa (Temas 970 e 996 do STJ).",
          aviso: AVISO_GERAL
        });
      }

      return resultado({
        P: P, rotulo: "Devolução estimada", min: v.pago, max: null,
        tag: antes ? "Rescisão por atraso · Súmula 543 do STJ" : "Rescisão por atraso · art. 43-A, § 1º, da Lei 4.591/1964",
        sub: "Devolução integral dos valores pagos, de uma só vez e com correção, mais a multa prevista no contrato.",
        linhas: datas.concat([["Atraso após a tolerância", duracao(atraso)], ["Total pago", reais(v.pago)], ["Multa do contrato", "a apurar no contrato"], ["Prazo de devolução", antes ? "de uma só vez" : rt.prazoRescisao]]),
        nota: "Quando a construtora descumpre o prazo de entrega além da tolerância, o comprador pode desfazer o contrato e receber todos os valores pagos, de uma vez e corrigidos, além da multa prevista no contrato (Súmula 543 do STJ). A corretagem também pode ser discutida.",
        aviso: AVISO_GERAL
      });
    }

    f2.addEventListener("submit", function (e) {
      e.preventDefault();
      if (etapaAtual !== "dados") { bAvancar.click(); return; }   // Enter numa etapa intermediária só avança
      limpar(f2);
      var c = cenario(), erros = [];
      var v = { pago: lerReais(cPago.value), contrato: lerReais(cContrato.value), imovel: lerReais(cImovel.value), corr: lerReais(cCorr.value), prev: lerData(cPrev.value) };
      if (!v.pago) erros.push([cPago, "Informe o total já pago."]);
      if (c === "distrato-lote" && !v.contrato) erros.push([cContrato, "Informe o valor total do contrato do lote."]);
      if (c.indexOf("distrato") === 0 && v.corr && v.pago && v.corr >= v.pago) erros.push([cCorr, "A corretagem não pode ser igual ou maior que o total pago."]);
      if (c.indexOf("atraso") === 0 && !v.prev) erros.push([cPrev, "Informe a data de entrega que consta no contrato."]);
      if (c === "atraso-ficar" && resp("data") === "antes" && !v.imovel) erros.push([cImovel, "Informe o valor do imóvel. Em contratos anteriores a 2018, a estimativa usa os lucros cessantes."]);
      if (!cAceite.checked) erros.push([cAceite, "Marque a caixa para ver a estimativa."]);
      if (reprovar(erros)) return;
      calcular(c, v);
    });

    r2.addEventListener("click", function (e) {
      if (!e.target.closest(".res__refazer")) return;
      f2.reset();
      limpar(f2);
      campoPosse.hidden = true;
      vazio(r2, VAZIO);
      mostrarEtapa("vendedor", true);
    });

    mostrarEtapa("vendedor", false);
  }
})();
