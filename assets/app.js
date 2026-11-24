/* Cadency: loja virtual acadêmica (SPA estática, sem backend). */
(function () {
  "use strict";
  var L = window.LOJA, P = window.PRODUTOS, F = window.FRETE, R = window.REGRAS;
  var app = document.getElementById("app");

  /* ---------- utilidades ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function brl(n) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function so(s) { return String(s || "").replace(/\D/g, ""); }
  function ler(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function agora() { return Date.now(); }
  function dataBR(t) { return new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
  function diaBR(t) { return new Date(t).toLocaleDateString("pt-BR"); }
  function addDias(t, d) { return t + d * 86400000; }
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("on"); }, 2800); }
  function produto(id) { for (var i = 0; i < P.length; i++) if (P[i].id === id) return P[i]; return null; }
  function corPorSku(sku) { for (var i = 0; i < P.length; i++) for (var j = 0; j < P[i].cores.length; j++) if (P[i].cores[j].sku === sku) return { p: P[i], c: P[i].cores[j] }; return null; }
  function img(p, hex, v) { return window.motoSVG(p.tipo, hex || p.cores[0].hex, v); }

  /* ---------- consentimento (LGPD) ---------- */
  function consent() { return ler("cad_consent", null); }
  function pode(tipo) { var c = consent(); return !!(c && c[tipo]); }

  /* ---------- estoque, carrinho, frete, pagamento ---------- */
  function estoque(sku) { var v = ler("cad_vendidos", {}); var x = corPorSku(sku); return x ? Math.max(0, x.c.estoque - (v[sku] || 0)) : 0; }
  function carrinho() { return ler("cad_cart", []); }
  function salvarCarrinho(c) { gravar("cad_cart", c); atualizaBadge(); }
  function qtdMotos(c) { return (c || carrinho()).reduce(function (s, i) { return s + i.qtd; }, 0); }
  function subtotal(c) { return (c || carrinho()).reduce(function (s, i) { var x = corPorSku(i.sku); return s + (x ? x.p.preco * i.qtd : 0); }, 0); }
  function addCarrinho(sku, qtd) {
    var c = carrinho(), it = c.filter(function (i) { return i.sku === sku; })[0];
    var total = qtdMotos(c) + qtd;
    if (total > R.limitePorCpf) { toast("Limite de " + R.limitePorCpf + " motos por pedido (regra antifraude)."); return false; }
    var atual = it ? it.qtd : 0;
    if (atual + qtd > estoque(sku)) { toast("Quantidade acima do estoque disponível."); return false; }
    if (it) it.qtd += qtd; else c.push({ sku: sku, qtd: qtd });
    salvarCarrinho(c); evento("carrinho");
    return true;
  }
  function freteCEP(cep) {
    cep = so(cep); if (cep.length !== 8) return null;
    var pre = parseInt(cep.slice(0, 5), 10);
    for (var i = 0; i < F.length; i++) if (pre >= F[i].de && pre <= F[i].ate) return F[i];
    return null;
  }
  function freteTotal(cep, c) { var f = freteCEP(cep); if (!f) return null; return { regiao: f.regiao, valor: f.valor * qtdMotos(c), prazo: f.prazo, unit: f.valor }; }
  function parcelas(total) {
    var out = [];
    for (var n = 1; n <= R.maxParcelas; n++) {
      if (n <= R.semJurosAte) out.push({ n: n, valor: total / n, total: total, juros: false });
      else { var i = R.jurosMes, pmt = total * i / (1 - Math.pow(1 + i, -n)); out.push({ n: n, valor: pmt, total: pmt * n, juros: true }); }
    }
    return out;
  }
  function cpfValido(c) {
    c = so(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (var t = 9; t < 11; t++) { var s = 0; for (var i = 0; i < t; i++) s += +c[i] * (t + 1 - i); var d = (s * 10) % 11 % 10; if (+c[t] !== d) return false; }
    return true;
  }
  function luhn(n) { n = so(n); if (n.length < 13) return false; var s = 0, alt = false; for (var i = n.length - 1; i >= 0; i--) { var d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; }
  function bandeira(n) { n = so(n); return /^4/.test(n) ? "Visa" : /^5[1-5]/.test(n) ? "Mastercard" : /^3[47]/.test(n) ? "Amex" : "Cartão"; }

  /* ---------- métricas (só com consentimento de cookies analíticos) ---------- */
  function evento(tipo) {
    if (!pode("analiticos")) return;
    var a = ler("cad_analytics", { visitas: 0, produto: 0, carrinho: 0, checkout: 0, pedido: 0 });
    a[tipo] = (a[tipo] || 0) + 1; gravar("cad_analytics", a);
  }

  /* ---------- IA aplicada: recomendação por conteúdo ---------- */
  function atributos(p) {
    var s = ["cat:" + p.categoria, "tipo:" + p.tipo, "faixa:" + Math.floor(p.preco / 4000), p.tipo.indexOf("eletrica") >= 0 ? "energia:eletrica" : "energia:flex"];
    return s.concat(p.tags.map(norm));
  }
  function similaridade(a, b) {
    var A = atributos(a), B = atributos(b), inter = 0;
    A.forEach(function (x) { if (B.indexOf(x) >= 0) inter++; });
    var uni = A.length + B.length - inter; return uni ? inter / uni : 0;
  }
  function registraVisita(id) {
    if (!pode("personalizacao")) return;
    var h = ler("cad_hist", []).filter(function (x) { return x.id !== id; });
    h.unshift({ id: id, t: agora() }); gravar("cad_hist", h.slice(0, 12));
  }
  function recomendar(atualId, n) {
    var excluir = carrinho().map(function (i) { return corPorSku(i.sku).p.id; }).concat([atualId]);
    var base = [], personalizado = pode("personalizacao");
    if (personalizado) ler("cad_hist", []).forEach(function (h, i) { var p = produto(h.id); if (p) base.push({ p: p, w: Math.pow(0.8, i) }); });
    var atual = produto(atualId); if (atual) base.unshift({ p: atual, w: 1.2 });
    if (!base.length) base = [{ p: P[0], w: 1 }];
    var notas = P.filter(function (p) { return excluir.indexOf(p.id) < 0; }).map(function (p) {
      var s = 0; base.forEach(function (b) { if (b.p.id !== p.id) s += b.w * similaridade(p, b.p); });
      return { p: p, s: s };
    }).sort(function (a, b) { return b.s - a.s; });
    return { itens: notas.slice(0, n || 4).map(function (x) { return x.p; }), personalizado: personalizado && ler("cad_hist", []).length > 1 };
  }

  /* ---------- e-mails de teste ---------- */
  function enviarEmail(para, assunto, corpo, tipo) {
    var e = ler("cad_emails", []);
    e.unshift({ id: "m" + agora() + Math.floor(Math.random() * 999), para: para, assunto: assunto, corpo: corpo, tipo: tipo, t: agora(), lido: false });
    gravar("cad_emails", e); atualizaBadge();
  }
  function emailBase(titulo, html) {
    return '<div class="email-corpo"><p style="font:800 20px var(--h)">Cad<b style="color:var(--amber)">ency</b></p><h3>' + titulo + "</h3>" + html +
      '<p class="small mute" style="margin-top:20px;border-top:1px solid var(--line);padding-top:12px">' + esc(L.razao) + " · CNPJ " + esc(L.cnpj) + "<br>" + esc(L.endereco) + "<br>E-mail de teste gerado pela loja acadêmica. Para não receber lembretes, responda SAIR ou acesse <a href='#/meus-dados'>Meus dados</a>.</p></div>";
  }
  function tabelaItens(o) {
    return "<table>" + o.itens.map(function (i) { return "<tr><td>" + esc(i.nome) + " · " + esc(i.cor) + "<br><span class='small mute'>SKU " + esc(i.sku) + " · " + i.qtd + " un.</span></td><td style='text-align:right'>" + brl(i.preco * i.qtd) + "</td></tr>"; }).join("") +
      "<tr><td>Frete (" + esc(o.regiao) + ", " + o.prazo + " dias úteis)</td><td style='text-align:right'>" + (o.frete ? brl(o.frete) : "Grátis") + "</td></tr>" +
      (o.desconto ? "<tr><td>Desconto Pix (3%)</td><td style='text-align:right'>−" + brl(o.desconto) + "</td></tr>" : "") +
      (o.juros ? "<tr><td>Juros do parcelamento</td><td style='text-align:right'>" + brl(o.juros) + "</td></tr>" : "") +
      "<tr><th>Total</th><th style='text-align:right'>" + brl(o.total) + "</th></tr></table>";
  }

  /* ---------- pedidos ---------- */
  function pedidos() { return ler("cad_pedidos", []); }
  function salvarPedido(o) { var ps = pedidos().filter(function (x) { return x.id !== o.id; }); ps.unshift(o); gravar("cad_pedidos", ps); }
  function pedido(id) { return pedidos().filter(function (x) { return x.id === id; })[0]; }
  function baixaEstoque(o) { var v = ler("cad_vendidos", {}); o.itens.forEach(function (i) { v[i.sku] = (v[i.sku] || 0) + i.qtd; }); gravar("cad_vendidos", v); }
  function devolveEstoque(o) { var v = ler("cad_vendidos", {}); o.itens.forEach(function (i) { v[i.sku] = Math.max(0, (v[i.sku] || 0) - i.qtd); }); gravar("cad_vendidos", v); }
  function novoId() { var d = new Date(); return "CDY-" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + "-" + Math.floor(1000 + Math.random() * 9000); }
  function rastreio() { return "CD" + Math.floor(100000000 + Math.random() * 899999999) + "BR"; }
  function registrar(o, tipo, txt) { o.eventos = o.eventos || []; o.eventos.push({ t: agora(), tipo: tipo, txt: txt }); }

  function aprovar(o) {
    o.status = "pago"; registrar(o, "pago", "Pagamento aprovado");
    salvarPedido(o);
    enviarEmail(o.cliente.email, "Pagamento aprovado: pedido " + o.id, emailBase("Pagamento aprovado, sua moto já está sendo preparada",
      "<p>Olá, " + esc(o.cliente.nome.split(" ")[0]) + ". Confirmamos o pagamento por " + (o.pagamento.metodo === "pix" ? "Pix" : o.pagamento.bandeira + " final " + o.pagamento.final4 + " em " + o.pagamento.parcelas + "x de " + brl(o.pagamento.valorParcela)) + ".</p>" +
      "<p>A moto sai do nosso estoque em Juiz de Fora e chega até <b>" + diaBR(addDias(agora(), o.prazo + 1)) + "</b>. Nota fiscal de teste nº " + o.id.slice(-4) + ".</p>" + tabelaItens(o) +
      "<p style='margin-top:14px'><a class='btn sm' href='#/pedido/" + o.id + "'>Acompanhar pedido</a></p>"), "aprovado");
  }

  /* ---------- antifraude ---------- */
  function antifraude(dados) {
    var motivos = [], status = "aprovado";
    if (!cpfValido(dados.cpf)) return { status: "bloqueado", motivos: ["CPF inválido"] };
    var cpf = so(dados.cpf);
    var mesmoCpf = pedidos().filter(function (o) { return so(o.cliente.cpf) === cpf && o.status !== "cancelado" && agora() - o.data < 30 * 86400000; })
      .reduce(function (s, o) { return s + o.itens.reduce(function (a, i) { return a + i.qtd; }, 0); }, 0);
    if (mesmoCpf + dados.qtd > R.limitePorCpf) return { status: "bloqueado", motivos: ["Mais de " + R.limitePorCpf + " motos para o mesmo CPF em 30 dias"] };
    var rec = ler("cad_recusas", []).filter(function (r) { return r.cpf === cpf && agora() - r.t < 10 * 60000; });
    if (rec.length >= 3) return { status: "bloqueado", motivos: ["3 recusas de cartão em 10 minutos: tente o Pix ou aguarde"] };
    if (dados.metodo === "cartao") {
      var a = norm(dados.nomeCartao).split(/\s+/), b = norm(dados.nome).split(/\s+/);
      if (a[0] !== b[0] || a[a.length - 1] !== b[b.length - 1]) { status = "revisao"; motivos.push("Nome no cartão diferente do comprador"); }
      if (dados.total > R.limiteCartao) { status = "revisao"; motivos.push("Compra no cartão acima de " + brl(R.limiteCartao)); }
    }
    return { status: status, motivos: motivos };
  }

  /* ---------- carrinho abandonado ---------- */
  function checaAbandono(forcar) {
    var d = ler("cad_checkout", null), c = carrinho();
    if (!d || !d.email || !c.length || d.lembrete) return false;
    if (!forcar && agora() - (d.ts || 0) < 30 * 60000) return false;
    var linhas = c.map(function (i) { var x = corPorSku(i.sku); return "<li>" + esc(x.p.nome) + " · " + esc(x.c.nome) + " (" + brl(x.p.preco) + ")</li>"; }).join("");
    var x0 = corPorSku(c[0].sku);
    enviarEmail(d.email, "Sua " + x0.p.nome + " ainda está separada para você", emailBase("Você deixou uma moto no carrinho",
      "<p>Guardamos seu carrinho por 48 horas. O estoque é real, então a reserva não é garantida depois disso.</p><ul>" + linhas + "</ul>" +
      "<p>No Pix o desconto é de 3%, e no cartão dá para fazer em até 10x sem juros.</p><p><a class='btn sm' href='#/carrinho?recuperar=1'>Voltar ao carrinho</a></p>"), "abandono");
    d.lembrete = agora(); gravar("cad_checkout", d);
    return true;
  }

  /* ---------- layout ---------- */
  function atualizaBadge() {
    var b = $("#badge"); if (b) { var q = qtdMotos(); b.textContent = q; b.style.display = q ? "" : "none"; }
    var e = $("#badge-mail"); if (e) { var n = ler("cad_emails", []).filter(function (m) { return !m.lido; }).length; e.textContent = n; e.style.display = n ? "" : "none"; }
  }
  function cabecalho() {
    $("#topo").innerHTML = '<div class="wrap topo-in">' +
      '<a class="logo" href="#/" aria-label="Cadency, início"><svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#262A32"/><path d="M18 42a8 8 0 1 0 .1 0M46 42a8 8 0 1 0 .1 0M18 42l10-14h12l6 14M28 28l-4-6h-6" stroke="#F2A541" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Cad<b>ency</b></span></a>' +
      '<form class="busca" id="form-busca" role="search"><input id="q" type="search" placeholder="Buscar moto, tipo ou uso (ex.: elétrica, entrega)" aria-label="Buscar produtos"><button>Buscar</button></form>' +
      '<nav class="nav"><a class="so-desk" href="#/catalogo">Motos</a><a class="so-desk" href="#/frete">Frete</a><a class="so-desk" href="#/emails" title="Caixa de e-mails de teste">E-mails <span class="badge" id="badge-mail" style="position:static;display:none"></span></a>' +
      '<a class="carrinho-link" href="#/carrinho">Carrinho<span class="badge" id="badge" style="display:none"></span></a></nav></div>';
    $("#form-busca").addEventListener("submit", function (e) { e.preventDefault(); location.hash = "#/catalogo?q=" + encodeURIComponent($("#q").value); });
    atualizaBadge();
  }
  function rodape() {
    $("#rodape").innerHTML = '<div class="wrap rod-in"><div><h4>Cadency</h4><p>Motos de entrada, média e alta cilindrada e elétricas, com estoque real, preço final na tela e prazo de entrega antes do pagamento.</p>' +
      '<div class="selos"><span>Pix</span><span>Visa</span><span>Mastercard</span><span>Conexão HTTPS</span><span>LGPD</span></div></div>' +
      '<div><h4>Compra</h4><a href="#/catalogo">Todas as motos</a><a href="#/frete">Frete e prazos</a><a href="#/trocas">Trocas e devoluções</a><a href="#/carrinho">Carrinho</a></div>' +
      '<div><h4>Institucional</h4><a href="#/sobre">Sobre nós</a><a href="#/contato">Contato</a><a href="#/privacidade">Privacidade e LGPD</a><a href="#/cookies">Política de cookies</a><a href="#" id="abrir-cookies">Preferências de cookies</a></div>' +
      '<div><h4>Atendimento</h4><a href="mailto:' + L.email + '">' + L.email + '</a><a href="#/contato">' + L.telefone + '</a><a href="#/meus-dados">Meus dados (LGPD)</a><a href="#/emails">E-mails de teste</a><a href="#/lojista">Painel do lojista</a></div></div>' +
      '<div class="wrap rod-legal">' + esc(L.razao) + ' · CNPJ ' + esc(L.cnpj) + ' · ' + esc(L.endereco) + ' · ' + esc(L.email) + ' · ' + esc(L.telefone) +
      '<br>Preços com impostos inclusos. O frete aparece antes do pagamento. Direito de arrependimento em até 7 dias do recebimento (art. 49 do CDC). Loja criada para o Trabalho Final de Comércio Eletrônico, UniAcademia, 2026.</div>';
    $("#abrir-cookies").addEventListener("click", function (e) { e.preventDefault(); modalCookies(); });
  }

  /* ---------- banner e modal de cookies ---------- */
  function bannerCookies() {
    var box = $("#cookies");
    if (consent()) { box.innerHTML = ""; return; }
    box.innerHTML = '<div class="cookie-bar" role="dialog" aria-label="Aviso de cookies"><b>Cookies e dados de navegação</b>' +
      '<p class="small" style="margin:6px 0 0">Usamos armazenamento local necessário para o carrinho e o checkout funcionarem. Com sua permissão, também usamos cookies analíticos (contar visitas) e de personalização (recomendações por IA com base nas motos que você viu). Veja a <a href="#/cookies">política de cookies</a>.</p>' +
      '<div class="acoes"><button class="btn sm" id="ck-aceitar">Aceitar todos</button><button class="btn sm ghost" id="ck-recusar">Recusar opcionais</button><button class="btn sm ghost" id="ck-pers">Personalizar</button></div></div>';
    $("#ck-aceitar").onclick = function () { salvaConsent(true, true); };
    $("#ck-recusar").onclick = function () { salvaConsent(false, false); };
    $("#ck-pers").onclick = modalCookies;
  }
  function contaVisita() {
    try { if (pode("analiticos") && !sessionStorage.getItem("cad_visita")) { sessionStorage.setItem("cad_visita", "1"); evento("visitas"); } } catch (e) {}
  }
  function salvaConsent(an, pe) {
    gravar("cad_consent", { necessarios: true, analiticos: an, personalizacao: pe, t: agora(), versao: "1.0" });
    if (!pe) { try { localStorage.removeItem("cad_hist"); } catch (e) {} }
    if (!an) { try { localStorage.removeItem("cad_analytics"); } catch (e) {} } else contaVisita();
    bannerCookies(); var m = $(".modal-fundo"); if (m) m.remove();
    toast("Preferências de cookies salvas."); rota(true);
  }
  function modalCookies() {
    var c = consent() || {};
    var d = document.createElement("div"); d.className = "modal-fundo";
    d.innerHTML = '<div class="modal" role="dialog" aria-label="Preferências de cookies"><h3>Preferências de cookies</h3>' +
      '<div class="opcao"><div><b>Necessários</b><br><span class="small mute">Carrinho, checkout e esta escolha. Base legal: execução de contrato.</span></div><label class="switch"><input type="checkbox" checked disabled><span></span></label></div>' +
      '<div class="opcao"><div><b>Analíticos</b><br><span class="small mute">Contagem de visitas e etapas do funil, sem identificar você. Base legal: consentimento.</span></div><label class="switch"><input type="checkbox" id="ck-an" ' + (c.analiticos ? "checked" : "") + '><span></span></label></div>' +
      '<div class="opcao"><div><b>Personalização (IA)</b><br><span class="small mute">Guarda as últimas motos vistas para recomendar modelos parecidos. Base legal: consentimento.</span></div><label class="switch"><input type="checkbox" id="ck-pe" ' + (c.personalizacao ? "checked" : "") + '><span></span></label></div>' +
      '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><button class="btn" id="ck-salvar">Salvar escolhas</button><button class="btn ghost" id="ck-fechar">Cancelar</button></div></div>';
    document.body.appendChild(d);
    $("#ck-salvar").onclick = function () { salvaConsent($("#ck-an").checked, $("#ck-pe").checked); };
    $("#ck-fechar").onclick = function () { d.remove(); };
  }

  /* ---------- componentes ---------- */
  function cardProduto(p) {
    var est = p.cores.reduce(function (s, c) { return s + estoque(c.sku); }, 0);
    return '<a class="card" href="#/produto/' + p.id + '"><div class="img">' + img(p) + '</div><div class="info">' +
      '<span><span class="tag ' + (p.tipo.indexOf("eletrica") >= 0 ? "" : "gray") + '">' + esc(p.categoria) + "</span></span>" +
      "<h3>" + esc(p.nome) + '</h3><span class="mute small">' + esc(p.motor) + "</span>" +
      '<div class="swatches">' + p.cores.map(function (c) { return '<span class="swatch" title="' + esc(c.nome) + '" style="background:' + c.hex + '"></span>'; }).join("") + "</div>" +
      '<div class="preco">' + brl(p.preco) + '</div><span class="parc">ou 10x de ' + brl(p.preco / 10) + ' sem juros</span>' +
      '<span class="pix">' + brl(p.preco * (1 - R.pixDesconto)) + " no Pix</span>" +
      (est ? (est <= 5 ? '<span class="small" style="color:#8A5A10">Últimas ' + est + " unidades</span>" : "") : '<span class="small" style="color:var(--red)">Esgotada</span>') + "</div></a>";
  }
  function blocoRecomendacao(atualId, titulo) {
    var r = recomendar(atualId, 4);
    return '<section class="secao ia"><div class="ia-head"><h2 style="margin:0">' + (titulo || (r.personalizado ? "Recomendadas para você" : "Quem viu esta moto também olhou")) + '</h2>' +
      '<span class="small">' + (r.personalizado ? '<span class="tag">IA · personalizada</span> com base nas motos que você viu, com seu consentimento.' : '<span class="tag gray">IA · por semelhança</span> sem usar dados pessoais. <a href="#" class="js-pers">Ativar personalização</a>') + "</span></div>" +
      '<div class="produtos" style="margin-top:16px">' + r.itens.map(cardProduto).join("") + "</div></section>";
  }
  function ligaPers() { $$(".js-pers").forEach(function (a) { a.onclick = function (e) { e.preventDefault(); modalCookies(); }; }); }

  /* ---------- páginas ---------- */
  function home() {
    var destaque = produto("andes-900");
    var d = ler("cad_checkout", null), c = carrinho();
    var volta = d && d.email && c.length ? '<div class="alerta warn" style="margin-top:20px">Você deixou ' + qtdMotos(c) + ' moto(s) no carrinho. <a href="#/carrinho">Continuar a compra</a></div>' : "";
    app.innerHTML = '<section class="hero"><div class="wrap hero-in"><div><span class="tag amber">Estoque real · prazo antes de pagar</span>' +
      '<h1 style="margin-top:14px">Da primeira moto à superesportiva, <em>sem pagar para esperar.</em></h1>' +
      "<p>Só vendemos o que já está no nosso galpão. Você vê o preço final, o frete e a data de entrega antes de pagar, e parcela em até 10x sem juros.</p>" +
      '<div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn amber" href="#/catalogo">Ver todas as motos</a><a class="btn ghost" style="color:#fff" href="#/sobre">Como trabalhamos</a></div></div>' +
      '<div class="arte">' + img(destaque, "#C2A878", "noite") + "</div></div></section>" +
      '<div class="wrap">' + volta + '<div class="provas"><div><b>Estoque real</b><span>Pedido só com moto no galpão</span></div><div><b>Frete e prazo antes</b><span>Calcule pelo CEP em qualquer página</span></div><div><b>10x sem juros ou 3% no Pix</b><span>Cartão e Pix em ambiente seguro</span></div><div><b>7 dias para desistir</b><span>Devolução integral (art. 49 do CDC)</span></div></div>' +
      '<section class="secao"><div class="secao-tit"><h2 style="margin:0">Escolha pela linha</h2><a href="#/catalogo">Ver todas</a></div>' +
      '<div class="cats">' + (window.LINHAS || []).map(function (c) { return '<a href="#/catalogo?cat=' + encodeURIComponent(c.nome) + '">' + c.nome + "</a>"; }).join("") + "</div></section>" +
      (window.LINHAS || []).map(function (l) { var ps = P.filter(function (p) { return p.categoria === l.nome; }); return '<section class="secao"><div class="secao-tit"><div><h2 style="margin:0">' + esc(l.nome) + '</h2><span class="mute">' + esc(l.desc) + '</span></div><a href="#/catalogo?cat=' + encodeURIComponent(l.nome) + '">Ver linha</a></div><div class="produtos">' + ps.map(cardProduto).join("") + "</div></section>"; }).join("") +
      blocoRecomendacao(null, pode("personalizacao") && ler("cad_hist", []).length ? "Continue de onde parou" : "Mais procuradas por quem trabalha com moto") + "</div>";
    ligaPers();
  }

  function catalogo(qs) {
    var q = qs.q || "", cat = qs.cat || "", ord = qs.ord || "relevancia";
    var termos = norm(q).split(/\s+/).filter(Boolean);
    var lista = P.map(function (p) {
      var alvo = norm([p.nome, p.categoria, p.tipo, p.motor, p.resumo, p.tags.join(" "), p.cores.map(function (c) { return c.nome + " " + c.sku; }).join(" ")].join(" "));
      var s = 0, ok = true;
      termos.forEach(function (t) { var t2 = t.replace(/s$/, ""); if (alvo.indexOf(t) >= 0 || alvo.indexOf(t2) >= 0) s += norm(p.nome).indexOf(t2) >= 0 ? 3 : 1; else ok = false; });
      return { p: p, s: s, ok: ok };
    }).filter(function (x) { return x.ok && (!cat || x.p.categoria === cat); });
    if (ord === "menor") lista.sort(function (a, b) { return a.p.preco - b.p.preco; });
    else if (ord === "maior") lista.sort(function (a, b) { return b.p.preco - a.p.preco; });
    else lista.sort(function (a, b) { return b.s - a.s; });
    function link(o) { var x = { q: q, cat: cat, ord: ord }; for (var k in o) x[k] = o[k]; return "#/catalogo?" + Object.keys(x).filter(function (k) { return x[k]; }).map(function (k) { return k + "=" + encodeURIComponent(x[k]); }).join("&"); }
    app.innerHTML = '<div class="wrap"><p class="migalha"><a href="#/">Início</a> / Motos</p>' +
      "<h1>" + (q ? "Resultados para “" + esc(q) + "”" : cat ? esc(cat) : "Todas as motos") + "</h1>" +
      '<p class="mute">' + lista.length + " " + (lista.length === 1 ? "modelo encontrado" : "modelos encontrados") + "</p>" +
      '<div class="cats"><a href="' + link({ cat: "" }) + '" class="' + (!cat ? "on" : "") + '">Todas</a>' + (window.LINHAS || []).map(function (l) { var c = l.nome; return '<a class="' + (cat === c ? "on" : "") + '" href="' + link({ cat: c }) + '">' + c + "</a>"; }).join("") +
      '<select id="ord" style="width:auto;margin-left:auto" aria-label="Ordenar"><option value="relevancia">Mais relevantes</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select></div>' +
      (lista.length ? '<div class="produtos">' + lista.map(function (x) { return cardProduto(x.p); }).join("") + "</div>" :
        '<div class="caixa"><h3>Nenhuma moto encontrada para “' + esc(q) + '”.</h3><p>Tente buscar pelo uso: <a href="#/catalogo?q=entrega">entrega</a>, <a href="#/catalogo?q=eletrica">elétrica</a>, <a href="#/catalogo?q=economica">econômica</a> ou <a href="#/catalogo?q=scooter">scooter</a>.</p></div>' + blocoRecomendacao(null, "Talvez você goste")) + "</div>";
    $("#ord").value = ord; $("#ord").onchange = function () { location.hash = link({ ord: this.value }); };
    if ($("#q")) $("#q").value = q;
    ligaPers();
  }

  function paginaProduto(id) {
    var p = produto(id); if (!p) return naoEncontrado();
    registraVisita(id); evento("produto");
    var corSel = p.cores.filter(function (c) { return estoque(c.sku) > 0; })[0] || p.cores[0], vista = "claro", qtd = 1;
    var cepSalvo = ler("cad_cep", "");
    app.innerHTML = '<div class="wrap"><p class="migalha"><a href="#/">Início</a> / <a href="#/catalogo?cat=' + encodeURIComponent(p.categoria) + '">' + esc(p.categoria) + "</a> / " + esc(p.nome) + "</p>" +
      '<div class="prod"><div class="galeria"><div class="principal" id="foto"></div><div class="thumbs" id="thumbs"></div><p class="small mute" style="margin-top:8px">Ilustrações originais de produto fictício.</p></div>' +
      '<div><span class="tag gray">' + esc(p.categoria) + "</span><h1 style=\"margin-top:10px\">" + esc(p.nome) + '</h1><p class="mute">' + esc(p.resumo) + "</p>" +
      '<div class="preco-grande">' + brl(p.preco) + '</div><p>ou <b>10x de ' + brl(p.preco / 10) + '</b> sem juros · <b style="color:var(--green2)">' + brl(p.preco * (1 - R.pixDesconto)) + "</b> no Pix (3% off)</p>" +
      '<label>Cor: <span id="cor-nome"></span></label><div class="cores" id="cores"></div>' +
      '<div class="sku">SKU <b id="sku"></b> · <span id="est"></span></div>' +
      '<div class="linha-compra"><div class="qtd"><button id="menos" aria-label="Diminuir">−</button><span id="qtd">1</span><button id="mais" aria-label="Aumentar">+</button></div>' +
      '<button class="btn amber" id="comprar" style="flex:1">Adicionar ao carrinho</button></div>' +
      '<div class="caixa" style="padding:16px 18px"><label for="cep">Frete e prazo de entrega</label><div class="frete-calc"><input id="cep" inputmode="numeric" placeholder="00000-000" maxlength="9" value="' + esc(cepSalvo) + '"><button class="btn sm dark" id="calc">Calcular</button></div><div class="frete-res" id="frete-res"></div>' +
      '<p class="small mute" style="margin:8px 0 0"><a href="https://buscacepinter.correios.com.br/" target="_blank" rel="noopener">Não sei meu CEP</a> · <a href="#/frete">Tabela de frete</a></p></div>' +
      '<details><summary>Parcelamento no cartão</summary><table id="tab-parc"></table><p class="small mute" style="margin-top:8px">Até 10x sem juros. Em 11x e 12x há juros de 1,99% a.m. (taxa da operadora repassada).</p></details>' +
      "<details open><summary>Descrição</summary><p style=\"margin-top:10px\">" + esc(p.descricao) + "</p></details>" +
      '<details><summary>Ficha técnica</summary><table class="ficha">' + Object.keys(p.ficha).map(function (k) { return "<tr><td>" + esc(k) + "</td><td>" + esc(p.ficha[k]) + "</td></tr>"; }).join("") + "</table></details>" +
      '<details><summary>Entrega, garantia e devolução</summary><p style="margin-top:10px">A moto sai de Juiz de Fora/MG com nota fiscal, manual e chave reserva. Garantia de fábrica de ' + esc(p.ficha.Garantia || "3 anos") + ' e revisões na rede de oficinas parceiras. Você pode desistir em até 7 dias do recebimento com devolução integral. <a href="#/trocas">Ver política</a>.</p></details>' +
      "</div></div>" + blocoRecomendacao(id) + "</div>";
    function desenha() {
      $("#foto").innerHTML = img(p, corSel.hex, vista === "claro" ? "" : "noite");
      $("#thumbs").innerHTML = ["claro", "noite"].map(function (v) { return '<button class="' + (v === vista ? "on" : "") + '" data-v="' + v + '" aria-label="Foto ' + (v === "claro" ? "estúdio" : "noturna") + '">' + img(p, corSel.hex, v === "claro" ? "" : "noite") + "</button>"; }).join("");
      $$("#thumbs button").forEach(function (b) { b.onclick = function () { vista = b.dataset.v; desenha(); }; });
      $("#cores").innerHTML = p.cores.map(function (c, i) { var e = estoque(c.sku); return '<button class="cor ' + (c.sku === corSel.sku ? "on" : "") + '" data-i="' + i + '"' + (e ? "" : ' style="opacity:.5"') + '><i style="background:' + c.hex + '"></i>' + esc(c.nome) + (e ? "" : " (esgotada)") + "</button>"; }).join("");
      $$("#cores .cor").forEach(function (b) { b.onclick = function () { corSel = p.cores[+b.dataset.i]; qtd = 1; desenha(); }; });
      var e = estoque(corSel.sku);
      $("#cor-nome").textContent = corSel.nome; $("#sku").textContent = corSel.sku;
      $("#est").innerHTML = e ? (e <= 5 ? '<b style="color:#8A5A10">' + e + " em estoque</b>" : e + " em estoque") : '<b style="color:var(--red)">Esgotada nesta cor</b>';
      $("#qtd").textContent = qtd; $("#comprar").disabled = !e;
      $("#tab-parc").innerHTML = "<tr><th>Parcelas</th><th>Valor</th><th>Total</th></tr>" + parcelas(p.preco).map(function (x) { return "<tr><td>" + x.n + "x " + (x.juros ? "com juros" : "sem juros") + "</td><td>" + brl(x.valor) + "</td><td>" + brl(x.total) + "</td></tr>"; }).join("");
    }
    desenha();
    $("#menos").onclick = function () { if (qtd > 1) { qtd--; $("#qtd").textContent = qtd; } };
    $("#mais").onclick = function () { if (qtd < Math.min(R.limitePorCpf, estoque(corSel.sku))) { qtd++; $("#qtd").textContent = qtd; } else toast("Máximo de " + R.limitePorCpf + " motos por pedido."); };
    $("#comprar").onclick = function () { if (addCarrinho(corSel.sku, qtd)) { toast(p.nome + " adicionada ao carrinho."); location.hash = "#/carrinho"; } };
    function calc() {
      var cep = $("#cep").value, f = freteCEP(cep), r = $("#frete-res");
      if (!f) { r.innerHTML = '<span style="color:var(--red)">CEP inválido. Digite os 8 números.</span>'; return; }
      gravar("cad_cep", cep);
      r.innerHTML = "<b>" + esc(f.regiao) + ":</b> " + (f.valor ? brl(f.valor) : "frete grátis") + " · entrega em até <b>" + f.prazo + " dias úteis</b> (até " + diaBR(addDias(agora(), f.prazo + 1)) + ")" + (f.obs ? '<br><span class="small mute">' + esc(f.obs) + "</span>" : "");
    }
    $("#calc").onclick = calc; $("#cep").addEventListener("input", mascaraCEP); $("#cep").addEventListener("keydown", function (e) { if (e.key === "Enter") calc(); });
    if (cepSalvo) calc();
    ligaPers();
  }
  function mascaraCEP(e) { var v = so(e.target.value).slice(0, 8); e.target.value = v.length > 5 ? v.slice(0, 5) + "-" + v.slice(5) : v; }

  function paginaCarrinho(qs) {
    if (qs.recuperar) { var d = ler("cad_checkout", null); if (d) { d.recuperado = agora(); gravar("cad_checkout", d); } toast("Carrinho recuperado. Seus dados de entrega continuam salvos."); }
    var c = carrinho(), cep = ler("cad_cep", "");
    if (!c.length) { app.innerHTML = '<div class="wrap texto"><h1>Seu carrinho está vazio</h1><p>Escolha uma moto e calcule o frete pelo CEP antes de comprar.</p><a class="btn" href="#/catalogo">Ver motos</a></div>'; return; }
    var f = freteTotal(cep, c), sub = subtotal(c);
    app.innerHTML = '<div class="wrap"><div class="duas"><div><h1>Carrinho</h1>' + c.map(function (i, k) {
      var x = corPorSku(i.sku);
      return '<div class="item"><a class="mini" href="#/produto/' + x.p.id + '">' + img(x.p, x.c.hex) + '</a><div><b>' + esc(x.p.nome) + '</b><br><span class="small mute">' + esc(x.c.nome) + " · SKU " + esc(i.sku) + " · " + estoque(i.sku) + ' em estoque</span><div style="margin-top:8px;display:flex;gap:10px;align-items:center"><div class="qtd"><button data-k="' + k + '" data-d="-1">−</button><span>' + i.qtd + '</span><button data-k="' + k + '" data-d="1">+</button></div><button class="btn sm ghost" data-rm="' + k + '">Remover</button></div></div><b>' + brl(x.p.preco * i.qtd) + "</b></div>";
    }).join("") + '<p class="small mute" style="margin-top:12px">Limite de ' + R.limitePorCpf + ' motos por pedido. <a href="#/catalogo">Continuar comprando</a></p></div>' +
      '<aside class="caixa resumo"><h3>Resumo</h3><label for="cep">CEP de entrega</label><div class="frete-calc" style="margin-bottom:12px"><input id="cep" inputmode="numeric" placeholder="00000-000" maxlength="9" value="' + esc(cep) + '"><button class="btn sm dark" id="calc">OK</button></div>' +
      '<div class="lin"><span>Subtotal</span><span>' + brl(sub) + "</span></div>" +
      '<div class="lin"><span>Frete' + (f ? " (" + esc(f.regiao) + ")" : "") + "</span><span>" + (f ? (f.valor ? brl(f.valor) : "Grátis") : "Informe o CEP") + "</span></div>" +
      (f ? '<div class="lin small mute"><span>Prazo</span><span>até ' + f.prazo + " dias úteis (" + diaBR(addDias(agora(), f.prazo + 1)) + ")</span></div>" : "") +
      '<div class="lin total"><span>Total</span><span>' + brl(sub + (f ? f.valor : 0)) + "</span></div>" +
      '<p class="small" style="margin:6px 0 14px">ou ' + brl(sub * (1 - R.pixDesconto) + (f ? f.valor : 0)) + " no Pix · até 10x de " + brl((sub + (f ? f.valor : 0)) / 10) + " sem juros</p>" +
      '<button class="btn amber block" id="fechar" ' + (f ? "" : "disabled") + ">Finalizar compra</button>" + (f ? "" : '<p class="small mute" style="margin-top:8px">Informe o CEP para ver frete e prazo antes de continuar.</p>') +
      '<p class="small mute" style="margin-top:12px">Compra sem cadastro: pedimos só o necessário para emitir a nota e entregar.</p></aside></div></div>';
    $$("[data-d]").forEach(function (b) { b.onclick = function () {
      var c2 = carrinho(), it = c2[+b.dataset.k], d = +b.dataset.d;
      if (d > 0 && (qtdMotos(c2) + 1 > R.limitePorCpf || it.qtd + 1 > estoque(it.sku))) { toast("Limite de " + R.limitePorCpf + " motos por pedido ou estoque insuficiente."); return; }
      it.qtd += d; if (it.qtd < 1) c2.splice(+b.dataset.k, 1); salvarCarrinho(c2); rota();
    }; });
    $$("[data-rm]").forEach(function (b) { b.onclick = function () { var c2 = carrinho(); c2.splice(+b.dataset.rm, 1); salvarCarrinho(c2); rota(); }; });
    $("#cep").addEventListener("input", mascaraCEP);
    $("#calc").onclick = function () { if (!freteCEP($("#cep").value)) { toast("CEP inválido."); return; } gravar("cad_cep", $("#cep").value); rota(); };
    $("#fechar").onclick = function () { evento("checkout"); location.hash = "#/checkout"; };
  }

  function mascaraCPF(e) { var v = so(e.target.value).slice(0, 11); e.target.value = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); }
  function mascaraTel(e) { var v = so(e.target.value).slice(0, 11); e.target.value = v.length > 10 ? "(" + v.slice(0, 2) + ") " + v.slice(2, 7) + "-" + v.slice(7) : v.length > 6 ? "(" + v.slice(0, 2) + ") " + v.slice(2, 6) + "-" + v.slice(6) : v; }
  function campo(id, rot, val, extra, erro) { return '<div class="campo" id="c-' + id + '"><label for="' + id + '">' + rot + '</label><input id="' + id + '" value="' + esc(val || "") + '" ' + (extra || "") + '><div class="erro">' + (erro || "Campo obrigatório") + "</div></div>"; }
  function marca(id, ok) { $("#c-" + id).classList.toggle("invalido", !ok); return ok; }

  function resumoLateral(d, metodo, parc) {
    var c = carrinho(), sub = subtotal(c), f = freteTotal(d.cep || ler("cad_cep", ""), c);
    var fr = f ? f.valor : 0, desc = metodo === "pix" ? Math.round(sub * R.pixDesconto * 100) / 100 : 0;
    var p = metodo === "cartao" && parc ? parcelas(sub + fr)[parc - 1] : null, juros = p ? p.total - (sub + fr) : 0;
    var total = sub + fr - desc + juros;
    return { html: '<aside class="caixa resumo"><h3>Seu pedido</h3>' + c.map(function (i) { var x = corPorSku(i.sku); return '<div class="lin small"><span>' + i.qtd + "× " + esc(x.p.nome) + " · " + esc(x.c.nome) + "</span><span>" + brl(x.p.preco * i.qtd) + "</span></div>"; }).join("") +
      '<div class="lin"><span>Subtotal</span><span>' + brl(sub) + "</span></div>" +
      '<div class="lin"><span>Frete' + (f ? " (" + esc(f.regiao) + ")" : "") + "</span><span>" + (f ? (fr ? brl(fr) : "Grátis") : "—") + "</span></div>" +
      (f ? '<div class="lin small mute"><span>Entrega</span><span>até ' + f.prazo + " dias úteis</span></div>" : "") +
      (desc ? '<div class="lin" style="color:var(--green2)"><span>Desconto Pix (3%)</span><span>−' + brl(desc) + "</span></div>" : "") +
      (juros > 0.005 ? '<div class="lin"><span>Juros (' + parc + "x)</span><span>" + brl(juros) + "</span></div>" : "") +
      '<div class="lin total"><span>Total</span><span>' + brl(total) + "</span></div>" +
      (p ? '<p class="small">' + p.n + "x de " + brl(p.valor) + (p.juros ? " com juros" : " sem juros") + "</p>" : "") +
      '<p class="small mute">Total já com frete e impostos. Você pode desistir em até 7 dias do recebimento.</p></aside>', sub: sub, frete: f, desc: desc, juros: juros, total: total, parc: p };
  }

  function checkout() {
    var c = carrinho(); if (!c.length) { location.hash = "#/carrinho"; return; }
    var d = ler("cad_checkout", {}) || {}; if (!d.cep) d.cep = ler("cad_cep", "");
    var passo = d.passo || 1; if (passo > 3) passo = 1;
    var metodo = d.metodo || "pix", parc = d.parc || 1;
    function nomesPassos() { return '<div class="passos">' + ["1. Identificação", "2. Entrega", "3. Pagamento"].map(function (t, i) { return '<span class="' + (i + 1 === passo ? "on" : i + 1 < passo ? "ok" : "") + '">' + t + "</span>"; }).join("") + "</div>"; }
    function salva() { d.passo = passo; d.metodo = metodo; d.parc = parc; d.ts = agora(); gravar("cad_checkout", d); }
    function render() {
      var r = resumoLateral(d, passo === 3 ? metodo : null, parc), corpo = "";
      if (passo === 1) {
        corpo = "<h2>Identificação</h2><p class=\"mute\">Compra sem cadastro e sem senha. Usamos estes dados para emitir a nota fiscal, falar sobre a entrega e prevenir fraudes.</p>" +
          campo("email", "E-mail", d.email, 'type="email" autocomplete="email"', "Informe um e-mail válido") +
          campo("nome", "Nome completo", d.nome, 'autocomplete="name"', "Informe nome e sobrenome") +
          '<div class="grid2">' + campo("cpf", "CPF (para a nota fiscal)", d.cpf, 'inputmode="numeric" maxlength="14"', "CPF inválido") + campo("tel", "Celular", d.tel, 'inputmode="tel" autocomplete="tel"', "Informe DDD e número") + "</div>" +
          '<label class="check"><input type="checkbox" id="optin" ' + (d.optin ? "checked" : "") + '> Quero receber ofertas e novidades por e-mail (opcional, posso cancelar quando quiser).</label>' +
          '<p class="small mute" style="margin-top:12px">Ao continuar, você declara ciência do <a href="#/privacidade">aviso de privacidade</a>. Se a compra não for concluída, podemos enviar um único lembrete do carrinho (legítimo interesse, com opção de sair).</p>' +
          '<button class="btn block" id="seguir">Continuar para entrega</button>';
      } else if (passo === 2) {
        corpo = "<h2>Entrega</h2>" + '<div class="grid3">' + campo("cep", "CEP", d.cep, 'inputmode="numeric" maxlength="9"', "CEP inválido") + "<div></div><div></div></div>" +
          '<div id="frete-box"></div>' + campo("rua", "Rua", d.rua, 'autocomplete="address-line1"') +
          '<div class="grid3">' + campo("bairro", "Bairro", d.bairro) + campo("num", "Número", d.num, 'inputmode="numeric"') + '<div class="campo"><label for="compl">Complemento</label><input id="compl" value="' + esc(d.compl || "") + '"></div></div>' +
          '<div class="grid2">' + campo("cidade", "Cidade", d.cidade) + campo("uf", "UF", d.uf, 'maxlength="2"', "UF com 2 letras") + "</div>" +
          '<div style="display:flex;gap:10px"><button class="btn ghost" id="voltar">Voltar</button><button class="btn" style="flex:1" id="seguir">Continuar para pagamento</button></div>';
      } else {
        var tot = r.sub + (r.frete ? r.frete.valor : 0);
        corpo = "<h2>Pagamento</h2>" + '<div class="alerta warn">Ambiente de teste: nenhum valor é cobrado. Use os dados de teste abaixo.</div>' +
          '<div class="abas"><button data-m="pix" class="' + (metodo === "pix" ? "on" : "") + '">Pix · 3% off</button><button data-m="cartao" class="' + (metodo === "cartao" ? "on" : "") + '">Cartão de crédito</button></div>';
        if (metodo === "pix") corpo += "<p>O QR Code vale " + R.pixValidadeMin + " minutos. A confirmação é automática e o pedido é separado assim que o pagamento cai.</p><p class=\"small mute\">Desconto de 3% sobre os produtos: é a diferença entre a taxa do cartão (4%) e a do Pix (1%), então a margem da loja não muda.</p>" +
          '<button class="btn amber block" id="pagar">Gerar Pix de ' + brl(r.total) + "</button>";
        else corpo += '<div class="teste"><b>Cartões de teste</b> (clique para preencher): <code data-c="4242424242424242">4242 4242 4242 4242</code> aprovado · <code data-c="5555555555554444">5555 5555 5555 4444</code> aprovado · <code data-c="4000000000000002">4000 0000 0000 0002</code> recusado. Validade futura e qualquer CVV.</div>' +
          campo("cartao", "Número do cartão", d.cartao, 'inputmode="numeric" autocomplete="cc-number" maxlength="19"', "Número inválido") +
          campo("nomecartao", "Nome impresso no cartão", d.nomecartao || (d.nome || "").toUpperCase(), 'autocomplete="cc-name"') +
          '<div class="grid2">' + campo("validade", "Validade (MM/AA)", d.validade, 'inputmode="numeric" maxlength="5" autocomplete="cc-exp"', "Validade inválida ou vencida") + campo("cvv", "CVV", "", 'inputmode="numeric" maxlength="4" autocomplete="cc-csc"', "CVV inválido") + "</div>" +
          '<div class="campo"><label for="parc">Parcelas</label><select id="parc">' + parcelas(tot).map(function (x) { return '<option value="' + x.n + '"' + (x.n === parc ? " selected" : "") + ">" + x.n + "x de " + brl(x.valor) + (x.juros ? " (total " + brl(x.total) + ", 1,99% a.m.)" : " sem juros") + "</option>"; }).join("") + "</select></div>" +
          '<p class="small mute">Não guardamos o número do cartão: o gateway devolve um token e só os 4 últimos dígitos ficam no pedido. Compras acima de ' + brl(R.limiteCartao) + " no cartão passam por análise antifraude.</p>" +
          '<button class="btn amber block" id="pagar">Pagar ' + brl(r.total) + "</button>";
        corpo += '<div id="pag-msg" style="margin-top:14px"></div><button class="btn ghost sm" id="voltar" style="margin-top:6px">Voltar para entrega</button>';
      }
      app.innerHTML = '<div class="wrap"><div class="duas"><div class="caixa">' + nomesPassos() + corpo + "</div>" + r.html + "</div></div>";
      ligar();
    }
    function ligar() {
      if ($("#voltar")) $("#voltar").onclick = function () { passo--; salva(); render(); };
      if (passo === 1) {
        $("#cpf").addEventListener("input", mascaraCPF); $("#tel").addEventListener("input", mascaraTel);
        // captura do e-mail logo no primeiro campo: base do carrinho abandonado
        $("#email").addEventListener("change", function () { if (/^\S+@\S+\.\S+$/.test(this.value)) { d.email = this.value.trim(); salva(); } });
        $("#seguir").onclick = function () {
          var ok = marca("email", /^\S+@\S+\.\S+$/.test($("#email").value)) & marca("nome", $("#nome").value.trim().split(/\s+/).length >= 2) & marca("cpf", cpfValido($("#cpf").value)) & marca("tel", so($("#tel").value).length >= 10);
          if (!ok) return;
          d.email = $("#email").value.trim(); d.nome = $("#nome").value.trim(); d.cpf = $("#cpf").value; d.tel = $("#tel").value; d.optin = $("#optin").checked;
          passo = 2; salva(); render();
        };
      } else if (passo === 2) {
        function atualizaFrete() {
          var f = freteTotal($("#cep").value, carrinho()), box = $("#frete-box");
          box.innerHTML = f ? '<div class="alerta ok"><b>' + esc(f.regiao) + ":</b> " + (f.valor ? brl(f.valor) : "frete grátis") + " · entrega em até " + f.prazo + " dias úteis, até " + diaBR(addDias(agora(), f.prazo + 1)) + "</div>" : "";
          if (f) { d.cep = $("#cep").value; gravar("cad_cep", d.cep); var rr = resumoLateral(d); $(".resumo").outerHTML = rr.html; }
        }
        $("#cep").addEventListener("input", function (e) { mascaraCEP(e); if (so(e.target.value).length === 8) atualizaFrete(); });
        $("#uf").addEventListener("input", function (e) { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ""); });
        atualizaFrete();
        $("#seguir").onclick = function () {
          var ok = marca("cep", !!freteCEP($("#cep").value)) & marca("rua", $("#rua").value.trim().length > 2) & marca("bairro", $("#bairro").value.trim().length > 1) & marca("num", $("#num").value.trim().length > 0) & marca("cidade", $("#cidade").value.trim().length > 1) & marca("uf", /^[A-Z]{2}$/.test($("#uf").value));
          if (!ok) return;
          ["cep", "rua", "bairro", "num", "compl", "cidade", "uf"].forEach(function (k) { d[k] = $("#" + k).value.trim(); });
          passo = 3; salva(); render();
        };
      } else {
        $$(".abas button").forEach(function (b) { b.onclick = function () { metodo = b.dataset.m; salva(); render(); }; });
        if (metodo === "cartao") {
          $$(".teste code").forEach(function (cd) { cd.onclick = function () { $("#cartao").value = cd.dataset.c.replace(/(\d{4})(?=\d)/g, "$1 "); $("#validade").value = "12/" + String(new Date().getFullYear() + 2).slice(-2); $("#cvv").value = "123"; }; });
          $("#cartao").addEventListener("input", function (e) { e.target.value = so(e.target.value).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "); });
          $("#validade").addEventListener("input", function (e) { var v = so(e.target.value).slice(0, 4); e.target.value = v.length > 2 ? v.slice(0, 2) + "/" + v.slice(2) : v; });
          $("#parc").onchange = function () { parc = +this.value; salva(); var rr = resumoLateral(d, metodo, parc); $(".resumo").outerHTML = rr.html; $("#pagar").textContent = "Pagar " + brl(rr.total); };
        }
        $("#pagar").onclick = pagar;
      }
    }
    function pagar() {
      var msg = $("#pag-msg"), r = resumoLateral(d, metodo, parc), c2 = carrinho();
      for (var i = 0; i < c2.length; i++) if (c2[i].qtd > estoque(c2[i].sku)) { msg.innerHTML = '<div class="alerta erro">Uma das motos acabou de esgotar. Revise o carrinho.</div>'; return; }
      var dadosCartao = null;
      if (metodo === "cartao") {
        var mm = so($("#validade").value), mes = +mm.slice(0, 2), ano = 2000 + +mm.slice(2, 4), hoje = new Date();
        var okVal = mm.length === 4 && mes >= 1 && mes <= 12 && (ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes >= hoje.getMonth() + 1));
        var ok = marca("cartao", luhn($("#cartao").value)) & marca("nomecartao", $("#nomecartao").value.trim().length > 3) & marca("validade", okVal) & marca("cvv", /^\d{3,4}$/.test($("#cvv").value));
        if (!ok) return;
        dadosCartao = { numero: so($("#cartao").value), nome: $("#nomecartao").value.trim() };
        d.nomecartao = dadosCartao.nome; d.validade = $("#validade").value; salva();
      }
      var af = antifraude({ cpf: d.cpf, nome: d.nome, nomeCartao: dadosCartao && dadosCartao.nome, metodo: metodo, total: r.total, qtd: qtdMotos(c2) });
      if (af.status === "bloqueado") { msg.innerHTML = '<div class="alerta erro"><b>Pagamento não autorizado pela análise de segurança.</b><br>' + af.motivos.map(esc).join("<br>") + "</div>"; return; }
      if (metodo === "cartao" && dadosCartao.numero === "4000000000000002") {
        var rec = ler("cad_recusas", []); rec.push({ cpf: so(d.cpf), t: agora() }); gravar("cad_recusas", rec);
        msg.innerHTML = '<div class="alerta erro"><b>Cartão recusado pelo emissor</b> (cartão de teste de recusa). Tente outro cartão ou pague com Pix.</div>'; return;
      }
      var o = {
        id: novoId(), data: agora(),
        cliente: { nome: d.nome, email: d.email, cpf: d.cpf, tel: d.tel, optin: !!d.optin },
        endereco: { cep: d.cep, rua: d.rua, num: d.num, compl: d.compl, bairro: d.bairro, cidade: d.cidade, uf: d.uf },
        itens: c2.map(function (i) { var x = corPorSku(i.sku); return { id: x.p.id, sku: i.sku, nome: x.p.nome, cor: x.c.nome, preco: x.p.preco, qtd: i.qtd }; }),
        subtotal: r.sub, frete: r.frete.valor, regiao: r.frete.regiao, prazo: r.frete.prazo, desconto: r.desc, juros: Math.round(r.juros * 100) / 100, total: Math.round(r.total * 100) / 100,
        pagamento: metodo === "pix" ? { metodo: "pix", expira: agora() + R.pixValidadeMin * 60000 } : { metodo: "cartao", bandeira: bandeira(dadosCartao.numero), final4: dadosCartao.numero.slice(-4), parcelas: parc, valorParcela: r.parc.valor, token: "tok_test_" + Math.random().toString(36).slice(2, 12) },
        antifraude: af, eventos: [],
      };
      o.status = metodo === "pix" ? "aguardando_pix" : af.status === "revisao" ? "em_analise" : "pago";
      registrar(o, "criado", "Pedido recebido");
      baixaEstoque(o); salvarPedido(o); salvarCarrinho([]);
      d.convertido = o.id; d.passo = 1; d.lembrete = null; d.cartao = ""; d.nomecartao = ""; d.validade = ""; gravar("cad_checkout", d); evento("pedido"); try { if (!sessionStorage.getItem("cad_conv")) { sessionStorage.setItem("cad_conv", "1"); evento("sessoes_conv"); } } catch (e) {}
      enviarEmail(o.cliente.email, "Recebemos seu pedido " + o.id, emailBase("Pedido recebido",
        "<p>Olá, " + esc(o.cliente.nome.split(" ")[0]) + ". Recebemos seu pedido <b>" + o.id + "</b>." + (o.status === "aguardando_pix" ? " Assim que o Pix for pago, separamos a moto." : "") + "</p>" + tabelaItens(o) +
        "<p style='margin-top:12px'>Entrega em " + esc(o.endereco.rua) + ", " + esc(o.endereco.num) + " · " + esc(o.endereco.cidade) + "/" + esc(o.endereco.uf) + ".</p><p><a class='btn sm' href='#/pedido/" + o.id + "'>Ver pedido</a></p>"), "recebido");
      if (o.status === "pago") aprovar(o);
      if (o.status === "em_analise") enviarEmail(o.cliente.email, "Pedido " + o.id + " em análise de segurança", emailBase("Seu pedido está em análise",
        "<p>Para proteger você, algumas compras passam por uma conferência extra (até 24 horas úteis). Motivo: " + af.motivos.map(esc).join("; ") + ".</p><p>Nenhum valor foi cobrado ainda. Se preferir, pague com Pix e o pedido é liberado na hora.</p>"), "analise");
      location.hash = "#/pedido/" + o.id;
    }
    render();
  }

  function paginaPedido(id) {
    var o = pedido(id); if (!o) return naoEncontrado();
    var etapas = [["criado", "Pedido recebido"], ["pago", "Pagamento aprovado"], ["enviado", "Enviado"], ["entregue", "Entregue"], ["avaliacao", "Avaliação"]];
    var feitos = o.eventos.map(function (e) { return e.tipo; });
    var status = { aguardando_pix: ["amber", "Aguardando Pix"], em_analise: ["amber", "Em análise antifraude"], pago: ["", "Pago"], enviado: ["", "Enviado"], entregue: ["", "Entregue"], cancelado: ["red", "Cancelado"] }[o.status];
    var podeDesistir = o.status === "entregue" && agora() - (o.entregueEm || 0) <= 7 * 86400000 || o.status === "pago" || o.status === "enviado" || o.status === "em_analise";
    var html = '<div class="wrap"><div class="duas"><div class="caixa"><span class="tag ' + status[0] + '">' + status[1] + "</span><h1 style=\"margin-top:10px;font-size:34px\">Pedido " + o.id + "</h1>" +
      '<p class="mute">Feito em ' + dataBR(o.data) + " · " + (o.pagamento.metodo === "pix" ? "Pix" : o.pagamento.bandeira + " final " + o.pagamento.final4 + " · " + o.pagamento.parcelas + "x de " + brl(o.pagamento.valorParcela)) + "</p>";
    if (o.status === "aguardando_pix") {
      var copia = "00020126580014BR.GOV.BCB.PIX0136" + "teste-cadency-" + o.id.toLowerCase() + "5204000053039865406" + o.total.toFixed(2) + "5802BR5913CADENCY TESTE6013JUIZ DE FORA62070503***6304TEST";
      html += '<div class="alerta warn">Pix de teste: nenhum valor real será cobrado.</div><div class="pix-box"><div class="pix-qr" id="qr"></div><div><p style="font:800 26px var(--h);margin:0">' + brl(o.total) + '</p><p>Expira em <b id="cont"></b></p><div class="copia" id="copia">' + esc(copia) + '</div><div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap"><button class="btn sm ghost" id="copiar">Copiar código</button><button class="btn sm" id="simpix">Simular pagamento recebido</button></div></div></div>';
    }
    html += '<h3 style="margin-top:24px">Acompanhamento</h3><ul class="timeline">' + etapas.map(function (e) {
      var ev = o.eventos.filter(function (x) { return x.tipo === e[0]; })[0];
      return '<li class="' + (ev ? "ok" : "") + '"><b>' + e[1] + "</b>" + (ev ? '<br><span class="small mute">' + dataBR(ev.t) + (e[0] === "enviado" && o.rastreio ? " · rastreio " + o.rastreio : "") + "</span>" : "") + "</li>";
    }).join("") + (o.status === "cancelado" ? '<li class="atual"><b>Cancelado e reembolsado</b><br><span class="small mute">' + esc(o.motivoCancelamento || "") + "</span></li>" : "") + "</ul>";
    if (o.status === "entregue" && !o.avaliacao) html += '<div id="avaliar" class="caixa" style="background:#FAF9F6;margin-top:10px"><h3>Avalie sua moto</h3><div class="estrelas" id="estrelas">' + [1, 2, 3, 4, 5].map(function (n) { return '<button data-n="' + n + '" aria-label="' + n + ' estrelas">★</button>'; }).join("") + '</div><textarea id="coment" rows="3" placeholder="Conte como está sendo rodar com ela"></textarea><label class="check" style="margin-top:8px"><input type="checkbox" id="publicar"> Autorizo publicar minha avaliação com o primeiro nome (consentimento).</label><button class="btn sm" id="enviar-av" style="margin-top:10px">Enviar avaliação</button></div>';
    if (o.avaliacao) html += '<div class="alerta ok">Avaliação enviada: ' + "★".repeat(o.avaliacao.nota) + " " + esc(o.avaliacao.texto) + "</div>";
    html += '<div class="caixa" style="background:#FAF9F6;margin-top:18px;box-shadow:none;border:1.5px dashed var(--line)"><b>Simulador de pós-venda (modo teste)</b><p class="small mute">Avança o pedido para gerar os e-mails da sequência: confirmação, rastreio, entrega, avaliação (D+7) e recompra/revisão (D+30).</p><div style="display:flex;gap:8px;flex-wrap:wrap" id="sim"></div></div>' +
      (podeDesistir && o.status !== "cancelado" ? '<p style="margin-top:16px"><button class="btn sm ghost" id="desistir">Desistir da compra (art. 49 do CDC)</button></p>' : "") +
      '<p class="small mute" style="margin-top:10px">Os e-mails ficam na <a href="#/emails">caixa de e-mails de teste</a>.</p></div>';
    html += '<aside class="caixa resumo"><h3>Resumo</h3>' + tabelaItens(o) + '<p class="small mute" style="margin-top:12px">Entrega: ' + esc(o.endereco.rua) + ", " + esc(o.endereco.num) + (o.endereco.compl ? " " + esc(o.endereco.compl) : "") + " · " + esc(o.endereco.bairro) + " · " + esc(o.endereco.cidade) + "/" + esc(o.endereco.uf) + " · CEP " + esc(o.endereco.cep) + "</p></aside></div>" + blocoRecomendacao(o.itens[0].id, "Acessórios e motos para a próxima compra") + "</div>";
    app.innerHTML = html;
    ligaPers();

    if (o.status === "aguardando_pix") {
      if (window.QRCode) new QRCode($("#qr"), { text: $("#copia").textContent, width: 180, height: 180 }); else $("#qr").textContent = "QR Code de teste";
      (function tick() { var s = Math.max(0, Math.floor((o.pagamento.expira - agora()) / 1000)); var c = $("#cont"); if (!c) return; c.textContent = Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); if (s > 0) setTimeout(tick, 1000); else { c.textContent = "expirado"; } })();
      $("#copiar").onclick = function () { try { navigator.clipboard.writeText($("#copia").textContent); } catch (e) {} toast("Código Pix copiado."); };
      $("#simpix").onclick = function () { if (agora() > o.pagamento.expira) { toast("Pix expirado. Gere um novo pedido."); return; } aprovar(o); toast("Pagamento Pix confirmado (teste)."); rota(); };
    }
    var sim = $("#sim"), botoes = [];
    if (o.status === "em_analise") botoes.push(["Aprovar análise (lojista)", function () { aprovar(o); }]);
    if (o.status === "pago") botoes.push(["Despachar com rastreio", function () {
      o.status = "enviado"; o.rastreio = rastreio(); registrar(o, "enviado", "Enviado"); salvarPedido(o);
      enviarEmail(o.cliente.email, "Sua moto saiu para entrega: " + o.rastreio, emailBase("Sua moto está a caminho", "<p>O pedido " + o.id + " foi despachado pela transportadora parceira. Código de rastreio (teste): <b>" + o.rastreio + "</b>.</p><p>Previsão de entrega: até " + diaBR(addDias(agora(), o.prazo)) + ". Alguém maior de idade precisa receber, com documento.</p><p><a class='btn sm' href='#/pedido/" + o.id + "'>Acompanhar</a></p>"), "enviado");
    }]);
    if (o.status === "enviado") botoes.push(["Confirmar entrega", function () {
      o.status = "entregue"; o.entregueEm = agora(); registrar(o, "entregue", "Entregue"); salvarPedido(o);
      enviarEmail(o.cliente.email, "Entregue: aproveite sua " + o.itens[0].nome, emailBase("Sua moto chegou", "<p>Confira a nota fiscal, o manual e a chave reserva. Para emplacar, leve a nota fiscal ao Detran do seu estado.</p><p>Você tem <b>7 dias</b> a partir de hoje para desistir da compra com devolução integral, incluindo o frete (art. 49 do CDC). A garantia de fábrica começa hoje.</p><p>Primeira revisão gratuita aos 1.000 km na oficina parceira mais próxima.</p>"), "entregue");
    }]);
    if (o.status === "entregue" && feitos.indexOf("d7") < 0) botoes.push(["Avançar 7 dias (avaliação)", function () {
      registrar(o, "d7", "Pedido de avaliação"); salvarPedido(o);
      enviarEmail(o.cliente.email, "Como está a sua " + o.itens[0].nome + "?", emailBase("Conta pra gente como está sendo", "<p>Sua avaliação ajuda quem está escolhendo a primeira moto. Leva 1 minuto.</p><p><a class='btn sm' href='#/pedido/" + o.id + "'>Avaliar agora</a></p>"), "avaliacao");
    }]);
    if (o.status === "entregue" && feitos.indexOf("d7") >= 0 && feitos.indexOf("d30") < 0) botoes.push(["Avançar 30 dias (recompra)", function () {
      registrar(o, "d30", "Lembrete de revisão e recompra"); salvarPedido(o);
      var rec = recomendar(o.itens[0].id, 2).itens;
      enviarEmail(o.cliente.email, o.cliente.optin ? "Revisão dos 1.000 km e uma oferta para você" : "Está chegando a revisão dos 1.000 km", emailBase("Hora da primeira revisão",
        "<p>Pelo uso médio, sua moto deve estar perto dos 1.000 km. A primeira revisão é gratuita e mantém a garantia.</p>" +
        (o.cliente.optin ? "<p>Como você aceitou receber ofertas: indique um amigo e ele ganha frete grátis. Modelos que combinam com a sua:</p><ul>" + rec.map(function (p) { return "<li><a href='#/produto/" + p.id + "'>" + esc(p.nome) + "</a> · " + brl(p.preco) + "</li>"; }).join("") + "</ul>" : "<p class='small mute'>Você não optou por receber ofertas, então este e-mail traz só o aviso de revisão (garantia do produto).</p>")), "recompra");
    }]);
    botoes.forEach(function (b) { var el = document.createElement("button"); el.className = "btn sm dark"; el.textContent = b[0]; el.onclick = function () { b[1](); toast("Etapa simulada. Novo e-mail na caixa de teste."); rota(); }; sim.appendChild(el); });
    if (!botoes.length) sim.innerHTML = '<span class="small mute">' + (o.status === "aguardando_pix" ? "Pague o Pix de teste para continuar." : "Sequência concluída.") + "</span>";

    if ($("#estrelas")) {
      var nota = 0;
      $$("#estrelas button").forEach(function (b) { b.onclick = function () { nota = +b.dataset.n; $$("#estrelas button").forEach(function (x) { x.classList.toggle("on", +x.dataset.n <= nota); }); }; });
      $("#enviar-av").onclick = function () { if (!nota) { toast("Escolha de 1 a 5 estrelas."); return; } o.avaliacao = { nota: nota, texto: $("#coment").value.trim(), publicar: $("#publicar").checked, t: agora() }; registrar(o, "avaliacao", "Avaliação enviada"); salvarPedido(o); toast("Obrigado pela avaliação!"); rota(); };
    }
    if ($("#desistir")) $("#desistir").onclick = function () {
      o.status = "cancelado"; o.motivoCancelamento = "Direito de arrependimento (art. 49 do CDC): reembolso integral de " + brl(o.total) + " incluindo frete."; registrar(o, "cancelado", "Cancelado"); devolveEstoque(o); salvarPedido(o);
      enviarEmail(o.cliente.email, "Desistência confirmada: pedido " + o.id, emailBase("Recebemos sua desistência", "<p>Vamos buscar a moto no endereço de entrega sem custo, em até 5 dias úteis. O reembolso integral de <b>" + brl(o.total) + "</b>, incluindo o frete, é feito no mesmo meio de pagamento" + (o.pagamento.metodo === "pix" ? " (Pix para a conta de origem)" : " (estorno no cartão, que aparece em até 2 faturas)") + ".</p>"), "reembolso");
      toast("Desistência registrada."); rota();
    };
  }

  function caixaEmails() {
    var es = ler("cad_emails", []), sel = es[0] && es[0].id;
    function render() {
      var m = es.filter(function (x) { return x.id === sel; })[0];
      if (m && !m.lido) { m.lido = true; gravar("cad_emails", es); atualizaBadge(); }
      app.innerHTML = '<div class="wrap"><div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;margin:28px 0 16px"><div><h1 style="margin:0">E-mails de teste</h1><p class="mute" style="margin:6px 0 0">Tudo o que a loja enviaria por e-mail aparece aqui. Nenhuma mensagem sai deste navegador.</p></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm ghost" id="sim-ab">Simular carrinho abandonado (1 h depois)</button><button class="btn sm ghost" id="limpar">Limpar caixa</button></div></div>' +
        (es.length ? '<div class="inbox"><div class="lista">' + es.map(function (x) { return '<div class="msg ' + (x.id === sel ? "on" : "") + '" data-id="' + x.id + '"><b>' + (x.lido ? "" : "● ") + esc(x.assunto) + '</b><span class="small mute">Para ' + esc(x.para) + " · " + dataBR(x.t) + "</span></div>"; }).join("") + '</div><div class="ver">' + (m ? '<p class="small mute">De: ' + L.email + " · Para: " + esc(m.para) + " · " + dataBR(m.t) + "</p><h2>" + esc(m.assunto) + "</h2>" + m.corpo : "") + "</div></div>" :
          '<div class="caixa"><h3>Nenhum e-mail ainda</h3><p>Faça um pedido de teste ou comece um checkout e abandone o carrinho para ver a sequência de mensagens.</p></div>') + "</div>";
      $$(".msg").forEach(function (el) { el.onclick = function () { sel = el.dataset.id; render(); }; });
      $("#limpar").onclick = function () { es = []; gravar("cad_emails", es); atualizaBadge(); render(); };
      $("#sim-ab").onclick = function () {
        if (checaAbandono(true)) { es = ler("cad_emails", []); sel = es[0].id; render(); toast("Lembrete de carrinho abandonado enviado."); }
        else toast("Para simular: coloque uma moto no carrinho, informe o e-mail no checkout e saia sem pagar.");
      };
    }
    render();
  }

  /* ---------- institucionais ---------- */
  function texto(html) { app.innerHTML = '<div class="wrap"><div class="texto">' + html + "</div></div>"; }
  function sobre() {
    texto('<span class="tag">Sobre nós</span><h1 style="margin-top:12px">Uma loja de motos desenhada a partir de dois casos reais</h1>' +
      "<p>A Cadency é uma empresa fictícia criada para o Trabalho Final de Comércio Eletrônico. O modelo nasceu do estudo de duas histórias do mesmo setor: a Voltz Motors, que vendia motos elétricas 100% online com pagamento antecipado e entrou em recuperação judicial em 2023, e a Honda, que lidera o mercado brasileiro há décadas.</p>" +
      "<h2>O que aprendemos com os erros da Voltz</h2><ul><li><b>Não cobrar por moto que não existe.</b> Só vendemos o que está no estoque, com a quantidade visível na página.</li><li><b>Prazo antes de pagar.</b> Frete e data de entrega aparecem no produto, no carrinho e no checkout.</li><li><b>Pós-venda presencial.</b> Revisões em oficinas parceiras, não só atendimento por chat.</li></ul>" +
      "<h2>O que copiamos dos acertos da Honda</h2><ul><li><b>Facilitar o pagamento.</b> Até 10x sem juros no cartão, ou 3% de desconto no Pix.</li><li><b>Linha completa.</b> Da moto de entrada à superesportiva de 1000 cc, como as marcas líderes, com uma linha elétrica para cidade e trabalho ao lado, e não no lugar, da combustão.</li><li><b>Crescer com caixa.</b> Começamos pelo canal próprio, com menos comissão, e só depois testamos marketplace.</li></ul>" +
      "<h2>Quem somos</h2><p>" + esc(L.razao) + "<br>CNPJ " + esc(L.cnpj) + "<br>" + esc(L.endereco) + "<br>" + esc(L.email) + " · " + esc(L.telefone) + "</p>" +
      "<p class=\"small mute\">Grupo 11: João Victor da Costa, Gabriel Monteiro, Rafael Lima Henriques e Gabriel Nascimento Krepker · Prof. Marcos Miguel · UniAcademia.</p>");
  }
  function contato() {
    texto('<span class="tag">Contato</span><h1 style="margin-top:12px">Fale com a Cadency</h1>' +
      "<p>Atendimento de segunda a sexta, das 9h às 18h, e sábado das 9h às 13h. Respondemos e-mails em até 1 dia útil.</p>" +
      "<table><tr><th>Canal</th><th>Contato</th></tr><tr><td>E-mail</td><td><a href=\"mailto:" + L.email + "\">" + L.email + "</a></td></tr><tr><td>Telefone e WhatsApp</td><td>" + L.telefone + "</td></tr><tr><td>Loja e retirada</td><td>" + esc(L.endereco) + "</td></tr><tr><td>Privacidade (encarregado)</td><td><a href=\"mailto:" + L.dpo + "\">" + L.dpo + "</a></td></tr></table>" +
      '<h2>Envie uma mensagem</h2><form id="f-contato" class="caixa"><div class="grid2">' + campo("cn", "Nome", "") + campo("ce", "E-mail", "", 'type="email"', "E-mail inválido") + '</div><div class="campo"><label for="cassunto">Assunto</label><select id="cassunto"><option>Dúvida sobre uma moto</option><option>Meu pedido</option><option>Troca ou devolução</option><option>Outro</option></select></div><div class="campo" id="c-cm"><label for="cm">Mensagem</label><textarea id="cm" rows="4"></textarea><div class="erro">Escreva sua mensagem</div></div><button class="btn">Enviar</button><div id="c-res" style="margin-top:12px"></div></form>' +
      '<p class="small mute">Usamos seus dados só para responder esta mensagem (base legal: legítimo interesse e execução de contrato). <a href="#/privacidade">Aviso de privacidade</a>.</p>');
    $("#f-contato").onsubmit = function (e) {
      e.preventDefault();
      var ok = marca("cn", $("#cn").value.trim().length > 1) & marca("ce", /^\S+@\S+\.\S+$/.test($("#ce").value)) & marca("cm", $("#cm").value.trim().length > 3);
      if (!ok) return;
      var prot = "ATD-" + Math.floor(100000 + Math.random() * 899999);
      enviarEmail($("#ce").value, "Recebemos sua mensagem · protocolo " + prot, emailBase("Mensagem recebida", "<p>Assunto: " + esc($("#cassunto").value) + ". Protocolo <b>" + prot + "</b>. Respondemos em até 1 dia útil.</p>"), "contato");
      $("#c-res").innerHTML = '<div class="alerta ok">Mensagem enviada. Protocolo <b>' + prot + "</b>.</div>"; this.reset();
    };
  }
  function trocas() {
    texto('<span class="tag">Política</span><h1 style="margin-top:12px">Trocas, devoluções e garantia</h1><p class="mute">Versão 1.0 · vigente desde 19/11/2026</p>' +
      "<h2>Direito de arrependimento (7 dias)</h2><p>Em compras pela internet, você pode desistir em até <b>7 dias corridos a partir do recebimento</b>, sem precisar explicar o motivo (art. 49 do Código de Defesa do Consumidor). Devolvemos <b>todo o valor pago, incluindo o frete</b>, no mesmo meio de pagamento.</p>" +
      "<ul><li>Peça pelo botão “Desistir da compra” na página do pedido, por e-mail ou telefone.</li><li>Buscamos a moto no endereço de entrega sem custo, em até 5 dias úteis.</li><li>Pix: reembolso na conta de origem em até 2 dias úteis após a coleta. Cartão: estorno pedido à operadora em até 2 dias úteis, que aparece em até 2 faturas.</li><li>Recomendamos não emplacar a moto antes de decidir, para a devolução ser mais rápida.</li></ul>" +
      "<h2>Troca de cor ou modelo</h2><p>Dentro dos mesmos 7 dias, trocamos por outra cor ou modelo em estoque. Se o novo modelo for mais caro, você paga a diferença; se for mais barato, devolvemos a diferença.</p>" +
      "<h2>Defeito (vício do produto)</h2><p>A garantia legal é de 90 dias para produtos duráveis (art. 26, II, do CDC), somada à garantia de fábrica de 3 anos (bateria das elétricas: 2 anos). Em caso de defeito, a oficina parceira tem até 30 dias para resolver; se não resolver, você escolhe entre troca, devolução do valor ou abatimento do preço (art. 18, § 1º, do CDC).</p>" +
      "<h2>Avaria no transporte</h2><p>Confira a moto na entrega. Se houver dano, registre no canhoto e fale com a gente em até 7 dias: trocamos a moto ou a peça sem custo.</p>" +
      "<h2>Contato</h2><p>" + L.email + " · " + L.telefone + " · " + esc(L.endereco) + "</p>");
  }
  function privacidade() {
    var linhas = [
      ["Nome, CPF, e-mail, celular e endereço", "Emitir a nota fiscal, entregar a moto e falar sobre o pedido", "Execução de contrato (art. 7º, V) e obrigação legal fiscal (art. 7º, II)", "5 anos após a compra (prazo fiscal)"],
      ["Últimos 4 dígitos e token do cartão", "Processar pagamento e estornos (o número completo fica só no gateway)", "Execução de contrato (art. 7º, V)", "5 anos"],
      ["CPF, valor do pedido e histórico de recusas", "Antifraude: limite por CPF, recusas repetidas, nome do cartão", "Legítimo interesse e proteção do crédito (art. 7º, IX e X)", "Recusas: 30 dias · pedidos: 5 anos"],
      ["E-mail informado no checkout não concluído", "Enviar um lembrete do carrinho abandonado", "Legítimo interesse (art. 7º, IX), com opção de sair", "48 horas"],
      ["Motos visitadas neste navegador", "Recomendações por IA (personalização)", "Consentimento (art. 7º, I), pelo banner de cookies", "Até você revogar · máximo 12 itens"],
      ["Contagem de visitas e etapas do funil", "Medir conversão da loja, sem identificar a pessoa", "Consentimento (art. 7º, I)", "12 meses"],
      ["E-mail para ofertas", "Enviar novidades e ofertas", "Consentimento (art. 7º, I), caixa opcional no checkout", "Até você cancelar"],
      ["Avaliação e primeiro nome", "Publicar a opinião sobre a moto", "Consentimento (art. 7º, I)", "Enquanto o produto estiver à venda"],
    ];
    texto('<span class="tag">LGPD</span><h1 style="margin-top:12px">Aviso de privacidade</h1><p class="mute">Versão 1.0 · vigente desde 19/11/2026 · Lei nº 13.709/2018 (LGPD)</p>' +
      "<p>Controlador: " + esc(L.razao) + ", CNPJ " + esc(L.cnpj) + ", " + esc(L.endereco) + ". Encarregado de dados (DPO): <a href=\"mailto:" + L.dpo + "\">" + L.dpo + "</a>.</p>" +
      "<h2>Quais dados usamos, para quê e com qual base legal</h2><div style=\"overflow:auto\"><table><tr><th>Dado</th><th>Finalidade</th><th>Base legal</th><th>Retenção</th></tr>" + linhas.map(function (l) { return "<tr><td>" + l.join("</td><td>") + "</td></tr>"; }).join("") + "</table></div>" +
      "<h2>Com quem compartilhamos</h2><ul><li>Gateway de pagamento (processa cartão e Pix).</li><li>Transportadora (nome, telefone e endereço para a entrega).</li><li>Contabilidade e Receita (nota fiscal).</li></ul><p>Não vendemos dados pessoais.</p>" +
      "<h2>Inteligência artificial</h2><p>As recomendações “Quem viu esta moto também olhou” comparam atributos dos produtos (categoria, tipo de motor, faixa de preço e uso) e não usam dados pessoais. Só quando você aceita cookies de personalização, o histórico das últimas motos vistas, guardado no seu navegador, entra no cálculo. Nenhuma decisão de crédito ou preço é tomada por IA.</p>" +
      "<h2>Seus direitos (art. 18)</h2><p>Você pode pedir confirmação e acesso aos dados, correção, anonimização ou exclusão, portabilidade, informação sobre compartilhamento e revogação do consentimento. Use o canal <a href=\"#/meus-dados\">Meus dados</a> ou escreva para " + L.dpo + ". Respondemos em até 15 dias. Você também pode reclamar à ANPD.</p>" +
      "<h2>Segurança</h2><p>Site com HTTPS (TLS), painel do lojista e gateway com autenticação em dois fatores e número de cartão nunca armazenado pela loja.</p>");
  }
  function cookiesPag() {
    texto('<span class="tag">LGPD</span><h1 style="margin-top:12px">Política de cookies</h1><p>Esta loja usa armazenamento local do navegador (localStorage), que funciona como cookies. Você pode mudar sua escolha a qualquer momento.</p>' +
      "<table><tr><th>Item</th><th>Categoria</th><th>Para que serve</th></tr>" +
      "<tr><td>cad_cart, cad_checkout, cad_cep</td><td>Necessário</td><td>Carrinho, dados do checkout e CEP de entrega</td></tr>" +
      "<tr><td>cad_consent</td><td>Necessário</td><td>Guardar sua escolha sobre cookies</td></tr>" +
      "<tr><td>cad_pedidos, cad_emails</td><td>Necessário</td><td>Pedidos e e-mails de teste desta demonstração</td></tr>" +
      "<tr><td>cad_analytics</td><td>Analítico (opcional)</td><td>Contar visitas e etapas do funil, sem identificar você</td></tr>" +
      "<tr><td>cad_hist</td><td>Personalização (opcional)</td><td>Últimas motos vistas, para recomendações por IA</td></tr></table>" +
      '<p style="margin-top:18px">Situação atual: ' + (consent() ? "analíticos " + (pode("analiticos") ? "ativados" : "desativados") + ", personalização " + (pode("personalizacao") ? "ativada" : "desativada") : "você ainda não escolheu") + '.</p><button class="btn" id="mudar">Alterar preferências</button>');
    $("#mudar").onclick = modalCookies;
  }
  function frete() {
    texto('<span class="tag">Entrega</span><h1 style="margin-top:12px">Frete e prazos</h1><p>Enviamos de Juiz de Fora/MG por transportadora especializada em motos. O frete é por moto e aparece no produto, no carrinho e antes do pagamento.</p>' +
      "<table><tr><th>Região (faixa de CEP)</th><th>Frete por moto</th><th>Prazo</th></tr>" + F.map(function (f) { return "<tr><td>" + esc(f.regiao) + " (" + String(f.de).padStart(5, "0") + "-000 a " + f.ate + "-999)</td><td>" + (f.valor ? brl(f.valor) : "Grátis") + "</td><td>até " + f.prazo + " dias úteis</td></tr>"; }).join("") + "</table>" +
      "<h2>Como funciona</h2><ul><li>O prazo conta a partir da aprovação do pagamento.</li><li>Em Juiz de Fora e região, entrega grátis ou retirada na loja.</li><li>A moto chega com nota fiscal, manual e chave reserva. Alguém maior de idade precisa receber com documento.</li><li>Se o prazo atrasar, você pode cancelar com reembolso integral.</li></ul>");
  }
  function meusDados() {
    texto('<span class="tag">LGPD</span><h1 style="margin-top:12px">Meus dados</h1><p>Canal para exercer os direitos do art. 18 da LGPD. Respondemos em até 15 dias pelo e-mail informado.</p>' +
      '<form id="f-lgpd" class="caixa"><div class="grid2">' + campo("ln", "Nome", "") + campo("le", "E-mail usado na compra", "", 'type="email"', "E-mail inválido") + '</div><div class="campo"><label for="lt">Pedido</label><select id="lt"><option>Confirmar se vocês têm meus dados e acessar</option><option>Corrigir dados</option><option>Excluir ou anonimizar dados</option><option>Portabilidade</option><option>Saber com quem meus dados foram compartilhados</option><option>Revogar consentimento (ofertas, personalização)</option><option>Parar de receber lembretes de carrinho</option></select></div>' +
      '<div class="campo"><label for="ld">Detalhes (opcional)</label><textarea id="ld" rows="3"></textarea></div><button class="btn">Enviar pedido</button><div id="l-res" style="margin-top:12px"></div></form>' +
      '<h2>Ações imediatas neste navegador</h2><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ghost" id="baixar">Baixar meus dados (JSON)</button><button class="btn ghost" id="apagar">Apagar meus dados deste navegador</button></div>');
    $("#f-lgpd").onsubmit = function (e) {
      e.preventDefault();
      var ok = marca("ln", $("#ln").value.trim().length > 1) & marca("le", /^\S+@\S+\.\S+$/.test($("#le").value)); if (!ok) return;
      var prot = "LGPD-" + Math.floor(100000 + Math.random() * 899999), reqs = ler("cad_lgpd", []);
      reqs.unshift({ prot: prot, nome: $("#ln").value, email: $("#le").value, tipo: $("#lt").value, det: $("#ld").value, t: agora(), status: "aberto" }); gravar("cad_lgpd", reqs);
      enviarEmail($("#le").value, "Pedido LGPD recebido · " + prot, emailBase("Recebemos seu pedido sobre dados pessoais", "<p>Pedido: " + esc($("#lt").value) + ". Protocolo <b>" + prot + "</b>. Prazo de resposta: até 15 dias. Encarregado: " + L.dpo + ".</p>"), "lgpd");
      $("#l-res").innerHTML = '<div class="alerta ok">Pedido registrado. Protocolo <b>' + prot + "</b>.</div>"; this.reset();
    };
    $("#baixar").onclick = function () {
      var dados = {}; ["cad_cart", "cad_checkout", "cad_cep", "cad_consent", "cad_hist", "cad_pedidos"].forEach(function (k) { dados[k] = ler(k, null); });
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" })); a.download = "meus-dados-cadency.json"; a.click();
    };
    $("#apagar").onclick = function () {
      ["cad_cart", "cad_checkout", "cad_cep", "cad_consent", "cad_hist", "cad_analytics"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      atualizaBadge(); bannerCookies(); toast("Dados de navegação apagados deste navegador.");
    };
  }
  function naoEncontrado() { texto('<h1>Página não encontrada</h1><p>Volte para o <a href="#/">início</a> ou <a href="#/catalogo">veja as motos</a>.</p>'); }

  /* ---------- painel do lojista com 2FA ---------- */
  function sessaoAdmin() { try { var s = JSON.parse(sessionStorage.getItem("cad_admin") || "null"); return s && s.exp > agora(); } catch (e) { return false; } }
  function lojista() {
    if (sessaoAdmin()) return painel();
    var etapa = 1;
    function render() {
      app.innerHTML = '<div class="wrap" style="max-width:480px;margin:40px auto"><div class="caixa"><span class="tag gray">Área restrita</span><h1 style="font-size:30px;margin-top:12px">Painel do lojista</h1>' +
        (etapa === 1 ? '<p class="mute">Etapa 1 de 2: e-mail e senha.</p>' + campo("ae", "E-mail", "lojista@cadency.example", 'type="email" autocomplete="username"') + campo("as", "Senha", "", 'type="password" autocomplete="current-password"', "Senha incorreta") +
          '<button class="btn block" id="entrar">Continuar</button><p class="small mute" style="margin-top:12px">Acesso de demonstração para a banca: senha <code>cadency2026</code>.</p>' :
          '<p class="mute">Etapa 2 de 2: código de 6 dígitos do aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou similar).</p>' + campo("ac", "Código 2FA", "", 'inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="codigo-2fa"', "Código inválido ou expirado") +
          '<button class="btn block" id="validar">Entrar</button><details style="margin-top:16px"><summary>Configurar o autenticador (banca)</summary><p class="small" style="margin-top:8px">Escaneie o QR Code ou digite a chave <code>' + TOTP.segredo + '</code>. O código muda a cada 30 segundos (TOTP, RFC 6238).</p><div id="qr2fa" style="background:#fff;padding:10px;width:max-content"></div></details>') +
        "</div></div>";
      if (etapa === 1) {
        $("#entrar").onclick = function () { if (!marca("as", $("#as").value === "cadency2026")) return; etapa = 2; render(); };
      } else {
        if (window.QRCode) new QRCode($("#qr2fa"), { text: TOTP.uri(TOTP.segredo), width: 170, height: 170 });
        $("#ac").focus();
        $("#validar").onclick = async function () {
          var ok = false; try { ok = await TOTP.verificar(TOTP.segredo, so($("#ac").value)); } catch (e) {}
          if (!marca("ac", ok)) return;
          sessionStorage.setItem("cad_admin", JSON.stringify({ exp: agora() + 30 * 60000 })); painel();
        };
      }
    }
    render();
  }
  function painel() {
    var ps = pedidos(), pagos = ps.filter(function (o) { return ["pago", "enviado", "entregue"].indexOf(o.status) >= 0; });
    var receita = pagos.reduce(function (s, o) { return s + o.total; }, 0), an = ler("cad_analytics", null), lg = ler("cad_lgpd", []);
    var stLabel = { aguardando_pix: "Aguardando Pix", em_analise: "Em análise", pago: "Pago", enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado" };
    app.innerHTML = '<div class="wrap"><div style="display:flex;justify-content:space-between;align-items:center;margin:28px 0 18px;gap:12px;flex-wrap:wrap"><div><span class="tag">2FA ativo</span><h1 style="margin:8px 0 0">Painel do lojista</h1></div><div style="display:flex;gap:8px"><button class="btn sm ghost" id="zerar">Zerar dados de teste</button><button class="btn sm dark" id="sair">Sair</button></div></div>' +
      '<div class="kpis"><div><span class="mute small">Pedidos pagos</span><b>' + pagos.length + '</b></div><div><span class="mute small">Receita aprovada</span><b>' + brl(receita) + '</b></div><div><span class="mute small">Ticket médio</span><b>' + (pagos.length ? brl(receita / pagos.length) : "—") + '</b></div><div><span class="mute small">Conversão (sessões com pedido)</span><b>' + (an && an.visitas ? ((an.sessoes_conv || 0) / an.visitas * 100).toFixed(1) + "%" : "—") + "</b></div></div>" +
      '<div class="caixa" style="margin-bottom:18px"><h3>Pedidos</h3><div style="overflow:auto"><table><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Total</th><th>Antifraude</th><th>Status</th></tr>' +
      (ps.length ? ps.map(function (o) { return '<tr><td><a href="#/pedido/' + o.id + '">' + o.id + "</a><br><span class=\"small mute\">" + dataBR(o.data) + "</span></td><td>" + esc(o.cliente.nome) + "<br><span class=\"small mute\">" + esc(o.endereco.cidade) + "/" + esc(o.endereco.uf) + "</span></td><td>" + o.itens.map(function (i) { return i.qtd + "× " + esc(i.sku); }).join("<br>") + "</td><td>" + (o.pagamento.metodo === "pix" ? "Pix" : o.pagamento.bandeira + " " + o.pagamento.parcelas + "x") + "</td><td>" + brl(o.total) + "</td><td>" + (o.antifraude.status === "aprovado" ? '<span class="tag">ok</span>' : '<span class="tag amber">revisão</span><br><span class="small">' + o.antifraude.motivos.map(esc).join("; ") + "</span>") + "</td><td>" + stLabel[o.status] + "</td></tr>"; }).join("") : '<tr><td colspan="7" class="mute">Nenhum pedido ainda.</td></tr>') + "</table></div></div>" +
      '<div class="duas" style="grid-template-columns:1fr 1fr;margin-top:0"><div class="caixa"><h3>Estoque por SKU</h3><table><tr><th>SKU</th><th>Modelo · cor</th><th>Estoque</th></tr>' + P.map(function (p) { return p.cores.map(function (c) { var e = estoque(c.sku); return "<tr><td>" + c.sku + "</td><td>" + esc(p.nome) + " · " + esc(c.nome) + '</td><td style="' + (e <= 5 ? "color:#8A5A10;font-weight:700" : "") + '">' + e + "</td></tr>"; }).join(""); }).join("") + "</table></div>" +
      '<div><div class="caixa" style="margin-bottom:18px"><h3>Funil (cookies analíticos)</h3>' + (an ? "<table>" + [["Visitas", an.visitas], ["Visualizações de produto", an.produto], ["Adições ao carrinho", an.carrinho], ["Checkouts iniciados", an.checkout], ["Pedidos", an.pedido]].map(function (x) { return "<tr><td>" + x[0] + "</td><td>" + (x[1] || 0) + "</td></tr>"; }).join("") + "</table>" : '<p class="mute small">Sem dados: o visitante não consentiu com cookies analíticos.</p>') + "</div>" +
      '<div class="caixa"><h3>Pedidos LGPD</h3>' + (lg.length ? "<table><tr><th>Protocolo</th><th>Pedido</th><th>Data</th></tr>" + lg.map(function (r) { return "<tr><td>" + r.prot + "</td><td>" + esc(r.tipo) + "<br><span class='small mute'>" + esc(r.email) + "</span></td><td>" + diaBR(r.t) + "</td></tr>"; }).join("") + "</table>" : '<p class="mute small">Nenhum pedido aberto.</p>') + "</div></div></div></div>";
    $("#sair").onclick = function () { sessionStorage.removeItem("cad_admin"); location.hash = "#/"; };
    $("#zerar").onclick = function () { ["cad_pedidos", "cad_emails", "cad_vendidos", "cad_recusas", "cad_lgpd", "cad_analytics", "cad_checkout", "cad_cart"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); atualizaBadge(); toast("Dados de teste zerados."); painel(); };
  }

  /* ---------- roteador ---------- */
  function rota(manterScroll) {
    var y0 = manterScroll === true ? window.scrollY : 0;
    var h = location.hash.replace(/^#/, "") || "/", partes = h.split("?"), caminho = partes[0], qs = {};
    (partes[1] || "").split("&").forEach(function (kv) { if (!kv) return; var p = kv.split("="); qs[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || "").replace(/\+/g, " ")); });
    var seg = caminho.split("/").filter(Boolean);
    if (seg[0] !== "catalogo" && $("#q")) $("#q").value = "";
    checaAbandono(false);
    var mapa = { "": home, catalogo: function () { catalogo(qs); }, produto: function () { paginaProduto(seg[1]); }, carrinho: function () { paginaCarrinho(qs); }, checkout: checkout, pedido: function () { paginaPedido(seg[1]); }, emails: caixaEmails, sobre: sobre, contato: contato, trocas: trocas, privacidade: privacidade, cookies: cookiesPag, frete: frete, "meus-dados": meusDados, lojista: lojista };
    (mapa[seg[0] || ""] || naoEncontrado)();
    var titulos = { "": "Cadency", catalogo: "Motos", produto: (produto(seg[1]) || {}).nome, carrinho: "Carrinho", checkout: "Checkout", pedido: "Pedido", emails: "E-mails de teste", sobre: "Sobre", contato: "Contato", trocas: "Trocas e devoluções", privacidade: "Privacidade", cookies: "Cookies", frete: "Frete e prazos", "meus-dados": "Meus dados", lojista: "Painel do lojista" };
    document.title = (seg[0] ? (titulos[seg[0]] || "Cadency") + " · " : "") + "Cadency";
    window.scrollTo(0, y0); atualizaBadge();
  }

  cabecalho(); rodape(); bannerCookies();
  contaVisita();
  window.addEventListener("hashchange", rota);
  rota();
})();
