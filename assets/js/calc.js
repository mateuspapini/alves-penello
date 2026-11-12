/* Alves Penello · calculadoras
   Tudo é calculado no navegador. Nada é enviado, a não ser que a pessoa
   toque em "Enviar resultado pelo WhatsApp". */
(function () {
  "use strict";
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
  }

  /* ---------- painel de resultado ---------- */
  var NOMES = { "rescisao-aluguel": "rescisão de aluguel", "imovel-na-planta": "imóvel na planta" };
  var ZAP = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 20.5l1.4-4.7A8.5 8.5 0 1 1 8.1 19.2z"/><path d="M9.2 8.3c-.6 1 .1 2.9 1.7 4.6s3.6 2.5 4.7 1.9l.5-1.3-2-1.1-.9.8c-.9-.4-1.7-1.2-2.1-2.1l.8-.9-1.1-2z"/></svg>';

  function mostrar(caixa, o) {
    var linhas = o.linhas.map(function (l) { return "<div><dt>" + esc(l[0]) + "</dt><dd>" + esc(l[1]) + "</dd></div>"; }).join("");
    var msg = "Olá! Fiz uma simulação no site (" + NOMES[o.calc] + ") e gostaria de uma análise.\n\n" +
      o.linhas.map(function (l) { return "• " + l[0] + ": " + l[1]; }).join("\n") +
      "\n\n" + o.rotulo + ": " + o.valor;
    var barra = "";
    if (o.barra) {
      var p = Math.max(0, Math.min(100, o.barra.feito * 100));
      barra = '<div class="barra" role="img" aria-label="' + esc(o.barra.rotuloFeito + ": " + o.barra.feitoTxt + ". " + o.barra.rotuloResto + ": " + o.barra.restoTxt) + '">' +
        '<div class="barra__trilho"><div class="barra__feito" style="width:' + p.toFixed(1) + '%"></div></div>' +
        '<div class="barra__leg"><span>' + esc(o.barra.rotuloFeito) + " · " + esc(o.barra.feitoTxt) + "</span><span>" + esc(o.barra.rotuloResto) + " · " + esc(o.barra.restoTxt) + "</span></div></div>";
    }
    caixa.innerHTML =
      '<p class="res__tag">' + esc(o.tag) + "</p>" +
      '<p class="res__rot">' + esc(o.rotulo) + "</p>" +
      '<p class="res__valor' + (o.faixa ? " res__valor--faixa" : "") + '">' + esc(o.valor) + "</p>" +
      (o.sub ? '<p class="res__sub">' + esc(o.sub) + "</p>" : "") + barra +
      '<dl class="res__linhas">' + linhas + "</dl>" +
      (o.nota ? '<p class="res__nota">' + esc(o.nota) + "</p>" : "") +
      '<a class="btn" target="_blank" rel="noopener" data-wa="resultado-' + o.calc + '" href="' + esc(window.apWhatsApp(msg)) + '">' + ZAP + "Enviar resultado pelo WhatsApp</a>";
    if (window.apEvento) window.apEvento("calc_concluida", { calculadora: o.calc });
    if (window.innerWidth < 1000) {
      var reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      caixa.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
    }
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
      var base = [["Aluguel mensal", reais(V)], ["Prazo do contrato", P + (P === 1 ? " mês" : " meses")], ["Fim do contrato", DT.format(fim)], ["Saída prevista", DT.format(sai)]];

      if (resta <= 0) {
        return mostrar(r1, {
          calc: "rescisao-aluguel", tag: "Contrato por prazo indeterminado", rotulo: "Multa por quebra de prazo", valor: reais(0),
          sub: "Na data de saída, o prazo do contrato já terminou.",
          linhas: base.concat([["Aviso prévio", "30 dias, por escrito"]]),
          nota: "Com o contrato vencido e prorrogado por prazo indeterminado, o inquilino pode sair sem multa, desde que avise o locador por escrito com 30 dias de antecedência. Sem o aviso, o locador pode cobrar o valor de um aluguel (art. 6º da Lei 8.245/1991)."
        });
      }
      var barra = { feito: 1 - resta / total, rotuloFeito: "Cumprido", feitoTxt: entre(ini, sai), rotuloResto: "Restante", restoTxt: entre(sai, fim) };
      if (transf) {
        return mostrar(r1, {
          calc: "rescisao-aluguel", tag: "Hipótese de dispensa", rotulo: "Multa estimada", valor: reais(0),
          sub: "Transferência de trabalho determinada pelo empregador.", barra: barra,
          linhas: base.concat([["Aviso prévio", "30 dias, por escrito"]]),
          nota: "O parágrafo único do art. 4º da Lei 8.245/1991 dispensa a multa quando o inquilino é transferido pelo empregador para trabalhar em outra localidade, desde que avise o locador por escrito com pelo menos 30 dias de antecedência."
        });
      }
      var prop = resta / total, integral = M * V;
      mostrar(r1, {
        calc: "rescisao-aluguel", tag: "Art. 4º da Lei 8.245/1991", rotulo: "Multa estimada", valor: reais(integral * prop),
        sub: "Proporcional ao tempo que falta para o fim do contrato.", barra: barra,
        linhas: base.concat([["Multa integral (" + String(M).replace(".", ",") + (M === 1 ? " aluguel)" : " aluguéis)"), reais(integral)], ["Proporção aplicada", pct(prop)]]),
        nota: "O cálculo é proporcional aos dias que restam do contrato. Além da multa, podem ser devidos aluguéis e encargos até a entrega das chaves e eventuais reparos no imóvel."
      });
    });
  }

  /* ============ 2. Imóvel na planta ============ */
  var pl = document.getElementById("calc-planta");
  if (pl) {
    var f2 = pl.querySelector("form"), r2 = pl.querySelector(".res"), cen = "distrato";
    var cPago = f2.querySelector("#pl-pago"), cImovel = f2.querySelector("#pl-imovel"), cCorr = f2.querySelector("#pl-corretagem"),
      cContrato = f2.querySelector("#pl-contrato"), cPrev = f2.querySelector("#pl-prevista"), cEnt = f2.querySelector("#pl-entrega");
    limparAoDigitar(f2);

    function sincronizar() {
      var tipo = f2.querySelector("[name=pl-tipo]:checked").value;
      f2.querySelectorAll("[data-mostra]").forEach(function (el) {
        var ok = el.getAttribute("data-mostra").split(" ").indexOf(cen) >= 0;
        if (ok && el.hasAttribute("data-tipo")) ok = el.getAttribute("data-tipo") === tipo;
        el.hidden = !ok;
      });
    }
    f2.querySelectorAll("[data-cen]").forEach(function (b) {
      b.addEventListener("click", function () {
        cen = b.getAttribute("data-cen");
        f2.querySelectorAll("[data-cen]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        limpar(f2);
        sincronizar();
        vazio(r2, "Preencha os dados e toque em calcular.");
      });
    });
    f2.querySelectorAll("[name=pl-tipo]").forEach(function (r) { r.addEventListener("change", sincronizar); });
    sincronizar();

    f2.addEventListener("submit", function (e) {
      e.preventDefault();
      limpar(f2);
      var pago = lerReais(cPago.value), imovel = lerReais(cImovel.value);
      var erros = [];

      if (cen === "distrato") {
        var tipo = f2.querySelector("[name=pl-tipo]:checked").value;
        var corr = lerReais(cCorr.value), contrato = lerReais(cContrato.value);
        if (tipo === "lote" && !contrato) erros.push([cContrato, "Informe o valor total do contrato do lote."]);
        if (!pago) erros.push([cPago, "Informe o total já pago à construtora."]);
        else if (corr >= pago) erros.push([cCorr, "A corretagem não pode ser igual ou maior que o total pago."]);
        if (reprovar(erros)) return;

        var lCorr = ["Corretagem", corr ? "− " + reais(corr) : "não informada"];
        if (tipo === "lote") {
          var ret = 0.10 * contrato;
          return mostrar(r2, {
            calc: "imovel-na-planta", tag: "Distrato de lote · art. 32-A da Lei 6.766/1979", rotulo: "Devolução mínima estimada", valor: reais(pago - ret - corr),
            sub: "Considerando a retenção máxima que a lei permite.",
            linhas: [["Total pago", reais(pago)], ["Valor do contrato", reais(contrato)], ["Retenção máxima (10% do contrato)", "− " + reais(ret)], lCorr, ["Prazo de devolução", "até 12 parcelas mensais"]],
            nota: "Em loteamentos, a lei limita a retenção a 10% do valor atualizado do contrato, além de despesas como corretagem e encargos pelo uso do lote, quando houver. Contratos e cobranças fora desses limites podem ser questionados."
          });
        }
        var af = f2.querySelector("[name=pl-afet]:checked").value;
        var d25 = pago * 0.75 - corr, d50 = pago * 0.50 - corr, d10 = pago * 0.90 - corr;
        var ini2 = [["Total pago", reais(pago)], lCorr];
        if (af === "sim") {
          return mostrar(r2, {
            calc: "imovel-na-planta", tag: "Distrato com patrimônio de afetação", rotulo: "Devolução mínima estimada", valor: reais(d50),
            sub: "Com a retenção máxima de 50% dos valores pagos.",
            linhas: ini2.concat([["Retenção máxima (50%)", "− " + reais(0.5 * pago)], ["Prazo de devolução", "até 30 dias após o habite-se"], ["Se a retenção for de 10%", reais(d10)]]),
            nota: "Com patrimônio de afetação, a lei admite multa de até 50% dos valores pagos (art. 67-A, § 5º, da Lei 4.591/1964). Percentuais abusivos podem ser revistos pela Justiça. Contratos anteriores a dezembro de 2018 seguem regras próprias, em que a retenção costuma ficar entre 10% e 25%."
          });
        }
        if (af === "ns") {
          return mostrar(r2, {
            calc: "imovel-na-planta", tag: "Distrato em incorporação", rotulo: "Devolução mínima estimada", valor: reais(d50) + " a " + reais(d25), faixa: true,
            sub: "O valor depende de haver ou não patrimônio de afetação.",
            linhas: ini2.concat([["Sem afetação (retenção de 25%)", reais(d25)], ["Com afetação (retenção de 50%)", reais(d50)], ["Se a retenção for de 10%", reais(d10)]]),
            nota: "A lei permite multa de até 25% dos valores pagos, ou até 50% quando há patrimônio de afetação. Os percentuais podem ser revistos pela Justiça, e contratos anteriores a dezembro de 2018 seguem regras próprias."
          });
        }
        return mostrar(r2, {
          calc: "imovel-na-planta", tag: "Distrato · art. 67-A da Lei 4.591/1964", rotulo: "Devolução mínima estimada", valor: reais(d25),
          sub: "Com a retenção máxima de 25% dos valores pagos.",
          linhas: ini2.concat([["Retenção máxima (25%)", "− " + reais(0.25 * pago)], ["Prazo de devolução", "até 180 dias após o distrato"], ["Se a retenção for de 10%", reais(d10)]]),
          nota: "A lei admite multa de até 25% dos valores pagos, além da corretagem e de eventuais encargos pelo uso do imóvel. Os percentuais podem ser revistos pela Justiça. Contratos anteriores a dezembro de 2018 seguem regras próprias, em que a retenção costuma ficar entre 10% e 25%."
        });
      }

      /* atraso e devolução usam as datas */
      var prev = lerData(cPrev.value), ent = lerData(cEnt.value);
      if (!prev) erros.push([cPrev, "Informe a data de entrega que consta no contrato."]);
      if (!pago) erros.push([cPago, "Informe o total já pago à construtora."]);
      if (reprovar(erros)) return;

      var ate = ent || hoje(), tol = somaDias(prev, 180), atraso = dias(tol, ate), atrasoTotal = dias(prev, ate);
      var datas = [["Entrega prevista", DT.format(prev)], ["Fim da tolerância (180 dias)", DT.format(tol)], [ent ? "Entrega das chaves" : "Calculado até", DT.format(ate)]];

      if (cen === "atraso") {
        if (atraso <= 0) {
          return mostrar(r2, {
            calc: "imovel-na-planta", tag: "Dentro do prazo de tolerância", rotulo: "Indenização por atraso", valor: reais(0),
            sub: atrasoTotal > 0 ? "O atraso de " + duracao(atrasoTotal) + " ainda está dentro dos 180 dias de tolerância." : "A data prevista de entrega ainda não passou.",
            linhas: datas.concat([["Total pago", reais(pago)]]),
            nota: "A tolerância de até 180 dias vale quando está prevista no contrato de forma clara. Se o seu contrato não prevê tolerância, o atraso pode ser contado desde a data de entrega."
          });
        }
        var ind = pago * 0.01 * atraso / 30;
        return mostrar(r2, {
          calc: "imovel-na-planta", tag: "Atraso na entrega · art. 43-A da Lei 4.591/1964", rotulo: "Indenização estimada", valor: reais(ind),
          sub: "1% do valor pago por mês de atraso depois da tolerância, proporcional aos dias.",
          linhas: datas.concat([["Atraso após a tolerância", duracao(atraso)], ["Total pago", reais(pago)], ["Lucros cessantes (0,5% do imóvel ao mês)", imovel ? reais(imovel * 0.005 * atraso / 30) : "informe o valor do imóvel"]]),
          nota: "A lei prevê indenização de 1% do valor pago por mês de atraso. Os tribunais também reconhecem lucros cessantes, em geral próximos ao aluguel do imóvel (entre 0,5% e 1% do valor ao mês), que não se somam à multa contratual (Temas 970 e 996 do STJ). Valores sem correção monetária."
        });
      }

      mostrar(r2, {
        calc: "imovel-na-planta",
        tag: atraso > 0 ? "Rescisão por atraso · art. 43-A, § 1º, da Lei 4.591/1964" : "Atenção ao prazo de tolerância",
        rotulo: "Devolução estimada", valor: reais(pago),
        sub: "Devolução integral dos valores pagos, de uma só vez e com correção.",
        linhas: datas.concat([["Atraso após a tolerância", atraso > 0 ? duracao(atraso) : "ainda não há"], ["Total pago", reais(pago)], ["Multa contratual", "a apurar no contrato"], ["Prazo de devolução", "até 60 dias após a rescisão"]]),
        nota: atraso > 0
          ? "Quando a construtora descumpre o prazo de entrega além da tolerância, o comprador pode desfazer o contrato e receber todos os valores pagos, de uma vez e corrigidos, além da multa prevista no contrato (Súmula 543 do STJ). A corretagem também pode ser discutida."
          : "Pelas datas informadas, a tolerância de 180 dias ainda não terminou. A rescisão por culpa da construtora costuma depender do atraso além desse prazo ou de outro descumprimento relevante do contrato."
      });
    });
  }
})();
