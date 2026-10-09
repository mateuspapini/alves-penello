(function(){
  var BRL = new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"});
  var DT = new Intl.DateTimeFormat("pt-BR", {timeZone:"UTC"});
  var DAY = 86400000;
  function money(v){ return BRL.format(Math.max(0, Math.round(v * 100) / 100)); }
  function parseMoney(s){ if (!s) return 0; var d = String(s).replace(/\D/g, ""); return d ? parseInt(d, 10) / 100 : 0; }
  function date(s){ if (!s) return null; var p = s.split("-"); return new Date(Date.UTC(+p[0], +p[1]-1, +p[2])); }
  function addMonths(d, m){ var r = new Date(d.getTime()); var day = r.getUTCDate(); r.setUTCDate(1); r.setUTCMonth(r.getUTCMonth() + m); var last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth()+1, 0)).getUTCDate(); r.setUTCDate(Math.min(day, last)); return r; }
  function addDays(d, n){ return new Date(d.getTime() + n * DAY); }
  function days(a, b){ return Math.round((b - a) / DAY); }
  function today(){ var n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
  function fmtMD(m, d){ var t = []; if (m) t.push(m + (m === 1 ? " mês" : " meses")); if (d || !m) t.push(d + (d === 1 ? " dia" : " dias")); return t.join(" e "); }
  function entre(a, b){ var m = 0; while (addMonths(a, m + 1) <= b) m++; return fmtMD(m, days(addMonths(a, m), b)); }
  function mesesTxt(dias){ return entre(new Date(0), new Date(dias * DAY)); }
  function pct(x){ return (x * 100).toLocaleString("pt-BR", {maximumFractionDigits: 1}) + "%"; }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  /* máscara de dinheiro */
  document.querySelectorAll("[data-money]").forEach(function(i){
    i.addEventListener("input", function(){ var v = parseMoney(i.value); i.value = v ? BRL.format(v) : ""; });
  });

  function render(box, o){
    var lines = o.lines.map(function(l){ return "<div><span>" + l[0] + "</span><b>" + l[1] + "</b></div>"; }).join("");
    var nomes = {"rescisao-aluguel":"rescisão de aluguel","imovel-na-planta":"imóvel na planta"};
    var msg = "Olá! Fiz uma simulação no site (" + (nomes[o.calc] || o.calc) + ") e gostaria de uma análise.\n\n" +
      o.lines.map(function(l){ return "• " + l[0] + ": " + String(l[1]).replace(/<[^>]+>/g, ""); }).join("\n") +
      "\n\n" + o.label + ": " + o.big;
    box.innerHTML = '<span class="res-tag">' + o.tag + '</span>' +
      '<h3 style="margin-top:12px;font-size:22px;font-family:var(--sans);font-weight:400;color:#c9c3b8">' + o.label + '</h3>' +
      '<div class="res-big">' + o.big + '</div>' + (o.sub ? '<p style="font-size:15px">' + o.sub + '</p>' : "") +
      '<div class="res-lines">' + lines + '</div>' +
      (o.note ? '<p class="res-note">' + o.note + '</p>' : "") +
      '<a class="btn wa" target="_blank" rel="noopener" href="' + window.apWhatsApp(msg) + '" data-local="' + o.calc + '">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>Enviar resultado e falar com um advogado</a>';
    box.querySelector(".btn").addEventListener("click", function(){ if (window.track) window.track("whatsapp_click", {local: "resultado-" + o.calc}); });
    if (window.track) window.track("calc_complete", {calculadora: o.calc});
    if (window.innerWidth < 960) box.scrollIntoView({behavior: "smooth", block: "start"});
  }
  function error(box, msg){
    box.innerHTML = '<div class="res-empty"><span class="big">Confira os dados.</span>' + esc(msg) + '</div>';
  }
  function startTracking(form, name){
    var started = false;
    form.addEventListener("input", function(){ if (!started){ started = true; if (window.track) window.track("calc_start", {calculadora: name}); } });
  }

  /* ============ 1. RESCISÃO DE ALUGUEL ============ */
  var al = document.getElementById("calc-aluguel");
  if (al){
    var f1 = al.querySelector("form"), r1 = al.querySelector(".calc-result");
    var saida = f1.querySelector("#al-saida"); if (!saida.value) saida.value = today().toISOString().slice(0, 10);
    startTracking(f1, "rescisao-aluguel");
    f1.addEventListener("submit", function(e){
      e.preventDefault();
      var V = parseMoney(f1.querySelector("#al-valor").value);
      var ini = date(f1.querySelector("#al-inicio").value);
      var P = parseInt(f1.querySelector("#al-prazo").value, 10);
      var sai = date(saida.value);
      var M = parseFloat(f1.querySelector("#al-multa").value);
      var transf = f1.querySelector("[name=al-transf]:checked").value === "sim";
      if (!V) return error(r1, "Informe o valor mensal do aluguel.");
      if (!ini || !sai) return error(r1, "Informe a data de início do contrato e a data prevista de saída.");
      if (!(P > 0)) return error(r1, "Informe o prazo do contrato em meses.");
      if (isNaN(M) || M < 0) return error(r1, "Informe a multa prevista no contrato, em número de aluguéis.");
      if (sai < ini) return error(r1, "A data de saída não pode ser anterior ao início do contrato.");

      var fim = addMonths(ini, P), total = days(ini, fim), cumprido = days(ini, sai), resta = days(sai, fim);
      var base = [["Aluguel mensal", money(V)], ["Prazo do contrato", P + " meses"], ["Fim do contrato", DT.format(fim)], ["Saída prevista", DT.format(sai)]];

      if (resta <= 0){
        return render(r1, {calc:"rescisao-aluguel", tag:"Contrato por prazo indeterminado", label:"Multa por quebra de prazo", big: money(0),
          sub:"O prazo do contrato já terminou na data de saída.",
          lines: base.concat([["Aviso prévio", "30 dias, por escrito"]]),
          note:"Com o contrato vencido e prorrogado por prazo indeterminado, o inquilino pode sair sem multa, desde que avise o locador por escrito com 30 dias de antecedência. Sem o aviso, o locador pode cobrar o valor de um aluguel (art. 6º da Lei 8.245/1991)."});
      }
      if (transf){
        return render(r1, {calc:"rescisao-aluguel", tag:"Hipótese de dispensa", label:"Multa estimada", big: money(0),
          sub:"Transferência de trabalho determinada pelo empregador.",
          lines: base.concat([["Tempo restante", entre(sai, fim)], ["Aviso prévio", "30 dias, por escrito"]]),
          note:"O parágrafo único do art. 4º da Lei 8.245/1991 dispensa a multa quando o inquilino é transferido pelo empregador para prestar serviço em outra localidade, desde que notifique o locador por escrito com pelo menos 30 dias de antecedência."});
      }
      var prop = resta / total, multaIntegral = M * V, multa = multaIntegral * prop;
      render(r1, {calc:"rescisao-aluguel", tag:"Multa proporcional · art. 4º da Lei 8.245/1991", label:"Multa estimada", big: money(multa),
        sub:"Proporcional aos " + entre(sai, fim) + " que faltam para o fim do contrato.",
        lines: base.concat([["Tempo cumprido", entre(ini, sai)], ["Tempo restante", entre(sai, fim)], ["Multa integral (" + String(M).replace(".", ",") + " aluguéis)", money(multaIntegral)], ["Proporção aplicada", pct(prop)]]),
        note:"Cálculo proporcional aos dias restantes do contrato. Além da multa, podem ser devidos aluguéis e encargos até a entrega das chaves e eventuais reparos no imóvel."});
    });
  }

  /* ============ 2. IMÓVEL NA PLANTA ============ */
  var pl = document.getElementById("calc-planta");
  if (pl){
    var f2 = pl.querySelector("form"), r2 = pl.querySelector(".calc-result"), cen = "distrato";
    startTracking(f2, "imovel-na-planta");
    function sync(){
      f2.querySelectorAll("[data-show]").forEach(function(el){ el.hidden = el.getAttribute("data-show").split(" ").indexOf(cen) < 0; });
      var tipo = f2.querySelector("[name=pl-tipo]:checked").value;
      f2.querySelectorAll("[data-tipo]").forEach(function(el){ el.hidden = cen !== "distrato" || el.getAttribute("data-tipo") !== tipo; });
    }
    f2.querySelectorAll("[data-cen]").forEach(function(b){
      b.addEventListener("click", function(){
        cen = b.getAttribute("data-cen");
        f2.querySelectorAll("[data-cen]").forEach(function(x){ x.setAttribute("aria-pressed", x === b); });
        sync();
        r2.innerHTML = '<div class="res-empty"><span class="big">Seu resultado aparece aqui.</span>Preencha os dados e toque em calcular.</div>';
      });
    });
    f2.querySelectorAll("[name=pl-tipo]").forEach(function(r){ r.addEventListener("change", sync); });
    sync();

    f2.addEventListener("submit", function(e){
      e.preventDefault();
      var pago = parseMoney(f2.querySelector("#pl-pago").value);
      var imovel = parseMoney(f2.querySelector("#pl-imovel").value);
      if (!pago) return error(r2, "Informe o total já pago à construtora.");

      if (cen === "distrato"){
        var tipo = f2.querySelector("[name=pl-tipo]:checked").value;
        var corr = parseMoney(f2.querySelector("#pl-corretagem").value);
        if (corr >= pago) return error(r2, "A corretagem informada não pode ser maior que o total pago.");
        if (tipo === "lote"){
          var contrato = parseMoney(f2.querySelector("#pl-contrato").value) || imovel;
          if (!contrato) return error(r2, "Informe o valor total do contrato do lote.");
          var ret = 0.10 * contrato, dev = Math.max(0, pago - ret - corr);
          return render(r2, {calc:"imovel-na-planta", tag:"Distrato de lote · art. 32-A da Lei 6.766/1979", label:"Devolução mínima estimada", big: money(dev),
            sub:"Considerando a retenção máxima permitida pela lei.",
            lines:[["Total pago", money(pago)], ["Valor do contrato", money(contrato)], ["Retenção máxima (10% do contrato)", "− " + money(ret)], ["Corretagem", corr ? "− " + money(corr) : "não informada"], ["Prazo de devolução", "em até 12 parcelas mensais"]],
            note:"Em loteamentos, a lei limita a retenção a 10% do valor atualizado do contrato, além de despesas como corretagem e encargos de fruição do lote, quando houver. Contratos e cobranças fora desses limites podem ser questionados."});
        }
        var af = f2.querySelector("[name=pl-afet]:checked").value;
        var p25 = pago - 0.25 * pago - corr, p50 = pago - 0.50 * pago - corr, p10 = pago - 0.10 * pago - corr;
        var linhas = [["Total pago", money(pago)], ["Corretagem", corr ? "− " + money(corr) : "não informada"]];
        if (af === "sim"){
          return render(r2, {calc:"imovel-na-planta", tag:"Distrato com patrimônio de afetação", label:"Devolução mínima estimada", big: money(p50),
            sub:"Com retenção máxima de 50% dos valores pagos.",
            lines: linhas.concat([["Multa máxima (50%)", "− " + money(0.5 * pago)], ["Prazo de devolução", "até 30 dias após o habite-se"], ["Referência com retenção de 10%", money(p10)]]),
            note:"Com patrimônio de afetação, a lei admite multa de até 50% dos valores pagos (art. 67-A, §5º, da Lei 4.591/1964). Percentuais considerados abusivos podem ser revistos, e contratos anteriores a dezembro de 2018 seguem regras próprias, em que a retenção costuma ficar entre 10% e 25%."});
        }
        if (af === "ns"){
          return render(r2, {calc:"imovel-na-planta", tag:"Distrato em incorporação", label:"Devolução mínima estimada", big: money(p50) + " a " + money(p25),
            sub:"Depende da existência de patrimônio de afetação.",
            lines: linhas.concat([["Sem afetação (retenção de 25%)", money(p25)], ["Com afetação (retenção de 50%)", money(p50)], ["Referência com retenção de 10%", money(p10)]]),
            note:"A lei permite multa de até 25% dos valores pagos, ou até 50% quando há patrimônio de afetação. Percentuais podem ser revistos pela Justiça, e contratos anteriores a dezembro de 2018 seguem regras próprias."});
        }
        return render(r2, {calc:"imovel-na-planta", tag:"Distrato · art. 67-A da Lei 4.591/1964", label:"Devolução mínima estimada", big: money(p25),
          sub:"Com retenção máxima de 25% dos valores pagos.",
          lines: linhas.concat([["Multa máxima (25%)", "− " + money(0.25 * pago)], ["Prazo de devolução", "até 180 dias após o distrato"], ["Referência com retenção de 10%", money(p10)]]),
          note:"A lei admite multa de até 25% dos valores pagos, além da corretagem e de eventuais encargos de fruição do imóvel. Percentuais podem ser revistos pela Justiça, e contratos anteriores a dezembro de 2018 seguem regras próprias, em que a retenção costuma ficar entre 10% e 25%."});
      }

      var prev = date(f2.querySelector("#pl-prevista").value);
      if (!prev) return error(r2, "Informe a data prevista de entrega que consta no contrato.");
      var ent = date(f2.querySelector("#pl-entrega").value), ate = ent || today();
      var tol = addDays(prev, 180), atraso = days(tol, ate), atrasoTotal = days(prev, ate);
      var baseL = [["Entrega prevista", DT.format(prev)], ["Fim da tolerância (180 dias)", DT.format(tol)], [ent ? "Entrega das chaves" : "Calculado até", DT.format(ate)]];

      if (cen === "atraso"){
        if (atraso <= 0){
          return render(r2, {calc:"imovel-na-planta", tag:"Dentro do prazo de tolerância", label:"Indenização por atraso", big: money(0),
            sub: atrasoTotal > 0 ? "O atraso de " + mesesTxt(atrasoTotal) + " ainda está dentro dos 180 dias de tolerância." : "A data prevista ainda não foi ultrapassada.",
            lines: baseL.concat([["Total pago", money(pago)]]),
            note:"A tolerância de até 180 dias vale quando está prevista no contrato de forma clara. Se o seu contrato não prevê tolerância, o atraso pode ser contado desde a data prevista. Vale uma análise."});
        }
        var ind = pago * 0.01 * atraso / 30;
        var lc = imovel ? imovel * 0.005 * atraso / 30 : 0;
        return render(r2, {calc:"imovel-na-planta", tag:"Atraso na entrega · art. 43-A da Lei 4.591/1964", label:"Indenização estimada", big: money(ind),
          sub:"1% do valor pago por mês de atraso após a tolerância, proporcional aos dias.",
          lines: baseL.concat([["Atraso após a tolerância", mesesTxt(atraso)], ["Total pago", money(pago)], ["Referência de lucros cessantes (0,5% do imóvel ao mês)", imovel ? money(lc) : "informe o valor do imóvel"]]),
          note:"A lei prevê indenização de 1% do valor pago por mês de atraso. Os tribunais também reconhecem lucros cessantes, em geral próximos ao aluguel do imóvel (entre 0,5% e 1% do valor ao mês), que não se somam à multa contratual (Temas 970 e 996 do STJ). Valores sem correção monetária."});
      }

      /* devolução por culpa da construtora */
      var tag = atraso > 0 ? "Rescisão por atraso · art. 43-A, §1º, da Lei 4.591/1964" : "Atenção ao prazo de tolerância";
      return render(r2, {calc:"imovel-na-planta", tag: tag, label:"Devolução estimada", big: money(pago),
        sub:"Devolução integral dos valores pagos, de uma só vez, com correção.",
        lines: baseL.concat([["Atraso após a tolerância", atraso > 0 ? mesesTxt(atraso) : "ainda não há"], ["Total pago", money(pago)], ["Multa contratual", "a apurar no contrato"], ["Prazo para devolução", "até 60 dias após a rescisão"]]),
        note: atraso > 0
          ? "Quando a construtora descumpre o prazo de entrega além da tolerância, o comprador pode desfazer o contrato e receber todos os valores pagos, de uma vez, corrigidos, além da multa prevista no contrato (Súmula 543 do STJ). A corretagem também pode ser discutida."
          : "Pelas datas informadas, a tolerância de 180 dias ainda não terminou. A rescisão por culpa da construtora costuma depender do atraso além desse prazo ou de outro descumprimento relevante do contrato. Vale uma análise do seu caso."});
    });
  }
})();
