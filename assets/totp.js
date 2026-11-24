/* TOTP (RFC 6238) em JavaScript puro, com HMAC-SHA1 via WebCrypto. Usado no 2FA do painel do lojista. */
(function () {
  var ALFA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  function base32(seg) {
    var bits = "", out = [];
    seg = seg.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
    for (var i = 0; i < seg.length; i++) {
      var v = ALFA.indexOf(seg[i]);
      if (v < 0) throw new Error("base32 inválido");
      bits += ("00000" + v.toString(2)).slice(-5);
    }
    for (var j = 0; j + 8 <= bits.length; j += 8) out.push(parseInt(bits.substr(j, 8), 2));
    return new Uint8Array(out);
  }
  async function hotp(segredo, contador) {
    var chave = await crypto.subtle.importKey("raw", base32(segredo), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    var buf = new ArrayBuffer(8), dv = new DataView(buf);
    dv.setUint32(0, Math.floor(contador / 4294967296));
    dv.setUint32(4, contador >>> 0);
    var h = new Uint8Array(await crypto.subtle.sign("HMAC", chave, buf));
    var o = h[h.length - 1] & 15;
    var n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return ("000000" + (n % 1000000)).slice(-6);
  }
  window.TOTP = {
    // segredo de demonstração, documentado no relatório (não é credencial real)
    segredo: "JBSWY3DPEHPK3PXPCADENCIA",
    gerar: function (segredo, t) {
      return hotp(segredo, Math.floor((t || Date.now()) / 1000 / 30));
    },
    // aceita o passo atual e um passo de tolerância para cada lado
    verificar: async function (segredo, codigo) {
      var passo = Math.floor(Date.now() / 1000 / 30);
      for (var d = -1; d <= 1; d++) if ((await hotp(segredo, passo + d)) === codigo) return true;
      return false;
    },
    uri: function (segredo) {
      return "otpauth://totp/Cadency:lojista@cadency.example?secret=" + segredo + "&issuer=Cadency&digits=6&period=30";
    },
  };
})();
