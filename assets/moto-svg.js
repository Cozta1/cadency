/* Ilustrações originais das motos fictícias da Cadency (SVG gerado a partir do tipo e da cor). */
(function () {
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function wheel(cx, cy, r, knobby, rimColor) {
    var s = '<g>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#16181C"/>';
    if (knobby) {
      for (var i = 0; i < 28; i++) {
        var a = (i / 28) * Math.PI * 2;
        var x = cx + Math.cos(a) * (r - 1), y = cy + Math.sin(a) * (r - 1);
        s += '<rect x="' + (x - 3) + '" y="' + (y - 3) + '" width="6" height="6" rx="1.5" fill="#16181C" transform="rotate(' + (a * 57.3) + ' ' + x + ' ' + y + ')"/>';
      }
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.72) + '" fill="#2B2F36"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.64) + '" fill="none" stroke="' + rimColor + '" stroke-width="4"/>';
    for (var k = 0; k < 5; k++) {
      var b = (k / 5) * Math.PI * 2 + 0.3;
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(b) * r * 0.62) + '" y2="' + (cy + Math.sin(b) * r * 0.62) + '" stroke="' + rimColor + '" stroke-width="5" stroke-linecap="round"/>';
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.16) + '" fill="#9AA0A8"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.07) + '" fill="#2B2F36"/>';
    return s + '</g>';
  }

  function moto(tipo, cor) {
    var c = cor, c2 = shade(cor, -38), c3 = shade(cor, 46);
    var dark = "#23262C", metal = "#9AA0A8", seat = "#1A1C20";
    var pro = tipo === "bigtrail-pro", aventura = tipo === "adventure" || tipo === "bigtrail" || pro, big = tipo === "bigtrail" || pro;
    var trail = tipo === "trail" || aventura, scooter = tipo === "scooter";
    var esportiva = tipo === "sport" || tipo === "superbike" || tipo === "especial";
    var eletrica = tipo === "eletrica" || tipo === "eletrica-cargo";
    var cargo = tipo === "cargo" || tipo === "eletrica-cargo";
    var r = trail ? 66 : scooter ? 50 : 58;
    var wy = 300, fx = 150, rx = 470;
    var s = '';
    // sombra no chão
    s += '<ellipse cx="310" cy="' + (wy + r + 6) + '" rx="250" ry="12" fill="#000" opacity="0.18"/>';
    if (scooter) {
      s += wheel(fx + 20, wy + 8, r, false, metal) + wheel(rx - 20, wy + 8, r, false, metal);
      s += '<path d="M190 300 C200 230 240 190 270 170 L292 160 L300 175 L268 210 C250 240 250 290 300 300 L430 300 C452 300 468 280 476 255 L486 222 C470 205 430 205 400 210 L360 214 L352 196 L440 186 C480 182 512 200 516 236 L512 280 C506 312 480 330 446 330 L290 330 C240 330 200 326 190 300 Z" fill="' + c + '"/>';
      s += '<path d="M352 196 L440 186 C470 183 496 192 506 212 L360 214 Z" fill="' + seat + '"/>';
      s += '<path d="M270 170 L300 120 L312 122 L292 172 Z" fill="' + dark + '"/>';
      s += '<rect x="282" y="104" width="62" height="12" rx="6" fill="' + dark + '"/>';
      s += '<path d="M262 160 C262 140 276 128 292 128 L298 150 Z" fill="' + c3 + '"/>';
      s += '<circle cx="256" cy="168" r="10" fill="#F4E9B0" stroke="' + c2 + '" stroke-width="3"/>';
      s += '<path d="M300 300 L430 300 L424 316 L306 316 Z" fill="' + c2 + '"/>';
      s += '<rect x="430" y="300" width="72" height="12" rx="6" fill="' + metal + '"/>';
      return s;
    }
    if (esportiva) return s + esportivaSVG(tipo, c, c2, c3, dark, metal, seat, fx, rx, wy, r);
    var aro = pro ? "#C9A227" : metal;
    s += wheel(fx, wy, r, trail, aro) + wheel(rx, wy, r, trail, aro);
    var top = trail ? 150 : 170;
    // garfo dianteiro
    s += '<line x1="' + fx + '" y1="' + wy + '" x2="' + (fx + 56) + '" y2="' + (top - 22) + '" stroke="' + metal + '" stroke-width="12" stroke-linecap="round"/>';
    if (trail) s += '<path d="M' + (fx - 50) + ' ' + (wy - r - 12) + ' Q' + fx + ' ' + (wy - r - 34) + ' ' + (fx + 52) + ' ' + (wy - r - 10) + '" stroke="' + c + '" stroke-width="12" fill="none" stroke-linecap="round"/>';
    else s += '<path d="M' + (fx - 44) + ' ' + (wy - r - 4) + ' Q' + fx + ' ' + (wy - r - 22) + ' ' + (fx + 46) + ' ' + (wy - r - 2) + '" stroke="' + c2 + '" stroke-width="9" fill="none" stroke-linecap="round"/>';
    // balança traseira
    s += '<path d="M330 290 L' + rx + ' ' + wy + '" stroke="' + dark + '" stroke-width="14" stroke-linecap="round"/>';
    s += '<line x1="400" y1="' + (top + 52) + '" x2="440" y2="276" stroke="' + c3 + '" stroke-width="9" stroke-linecap="round"/>';
    // quadro
    s += '<path d="M' + (fx + 56) + ' ' + (top - 10) + ' L330 292 L400 ' + (top + 56) + '" stroke="' + dark + '" stroke-width="12" fill="none" stroke-linejoin="round"/>';
    // motor ou bateria
    if (eletrica) {
      s += '<rect x="262" y="218" width="112" height="70" rx="12" fill="' + dark + '"/>';
      s += '<rect x="274" y="230" width="88" height="46" rx="8" fill="' + c2 + '"/>';
      s += '<path d="M318 236 L304 256 L316 256 L310 272 L330 248 L318 248 L324 236 Z" fill="#F2C94C"/>';
      s += '<circle cx="410" cy="292" r="22" fill="' + dark + '" stroke="' + metal + '" stroke-width="5"/>';
    } else {
      s += '<path d="M262 222 L352 222 L366 268 L340 300 L282 300 L256 266 Z" fill="#3A3E45"/>';
      for (var i = 0; i < 4; i++) s += '<line x1="' + (272 + i * 18) + '" y1="232" x2="' + (268 + i * 18) + '" y2="262" stroke="' + metal + '" stroke-width="4"/>';
      s += '<circle cx="316" cy="278" r="14" fill="' + metal + '"/>';
      // escapamento
      s += '<path d="M340 296 C380 308 420 300 470 ' + (trail ? 236 : 266) + '" stroke="' + metal + '" stroke-width="10" fill="none" stroke-linecap="round"/>';
      s += '<rect x="' + (trail ? 452 : 446) + '" y="' + (trail ? 222 : 252) + '" width="56" height="18" rx="9" fill="' + metal + '" transform="rotate(' + (trail ? -24 : -14) + ' 470 ' + (trail ? 230 : 260) + ')"/>';
    }
    // tanque
    var ty = top + 4;
    s += '<path d="M' + (fx + 70) + ' ' + (ty + 4) + ' C' + (fx + 90) + ' ' + (ty - 30) + ' ' + (fx + 170) + ' ' + (ty - 34) + ' 340 ' + (ty - 14) + ' L352 ' + (ty + 36) + ' C320 ' + (ty + 52) + ' 260 ' + (ty + 54) + ' ' + (fx + 82) + ' ' + (ty + 40) + ' Z" fill="' + c + '"/>';
    s += '<path d="M' + (fx + 92) + ' ' + (ty - 6) + ' C' + (fx + 120) + ' ' + (ty - 24) + ' ' + (fx + 170) + ' ' + (ty - 26) + ' 320 ' + (ty - 14) + '" stroke="' + c3 + '" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.8"/>';
    s += '<path d="M' + (fx + 96) + ' ' + (ty + 30) + ' L330 ' + (ty + 30) + '" stroke="' + c2 + '" stroke-width="5" opacity="0.7"/>';
    // banco e rabeta
    s += '<path d="M338 ' + (ty - 12) + ' C380 ' + (ty - 22) + ' 440 ' + (ty - 16) + ' 470 ' + (ty - 4) + ' L466 ' + (ty + 10) + ' C430 ' + (ty + 6) + ' 380 ' + (ty + 10) + ' 350 ' + (ty + 20) + ' Z" fill="' + seat + '"/>';
    s += '<path d="M456 ' + (ty + 2) + ' L520 ' + (ty - 12) + ' L522 ' + (ty + 4) + ' L470 ' + (ty + 28) + ' L420 ' + (ty + 34) + ' Z" fill="' + c2 + '"/>';
    s += '<rect x="512" y="' + (ty - 8) + '" width="16" height="10" rx="3" fill="#D8423A"/>';
    // farol, painel e guidão
    s += '<path d="M' + (fx + 36) + ' ' + (top - 36) + ' C' + (fx + 20) + ' ' + (top - 20) + ' ' + (fx + 24) + ' ' + (top + 6) + ' ' + (fx + 44) + ' ' + (top + 10) + ' L' + (fx + 66) + ' ' + (top - 26) + ' Z" fill="' + c2 + '"/>';
    s += '<ellipse cx="' + (fx + 34) + '" cy="' + (top - 10) + '" rx="9" ry="15" fill="#F4E9B0" stroke="' + dark + '" stroke-width="3"/>';
    s += '<line x1="' + (fx + 56) + '" y1="' + (top - 30) + '" x2="' + (fx + 90) + '" y2="' + (top - 48) + '" stroke="' + dark + '" stroke-width="7" stroke-linecap="round"/>';
    s += '<rect x="' + (fx + 50) + '" y="' + (top - 46) + '" width="22" height="14" rx="3" fill="#2E8BC0" opacity="0.85"/>';
    if (trail) s += '<path d="M' + (fx + 70) + ' ' + (ty + 2) + ' L' + (fx + 40) + ' ' + (ty + 50) + ' L' + (fx + 92) + ' ' + (ty + 48) + ' Z" fill="' + c3 + '"/>';
    if (aventura) {
      s += '<path d="M196 134 L212 ' + (big ? 52 : 70) + ' L234 ' + (big ? 56 : 74) + ' L224 138 Z" fill="#9EC3D8" opacity="0.65" stroke="' + dark + '" stroke-width="2"/>';
      s += '<path d="M146 214 L202 182 L210 198 L160 224 Z" fill="' + c + '"/>';
      s += '<path d="M' + (fx + 70) + ' ' + (ty + 6) + ' L' + (fx + 46) + ' ' + (ty + 54) + ' L' + (fx + 100) + ' ' + (ty + 52) + ' Z" fill="' + c2 + '"/>';
    }
    if (pro) {
      s += '<path d="M244 292 L356 292 L366 312 L250 312 Z" fill="#8C9198"/>';
      s += '<path d="M150 236 L210 202" stroke="#E3A825" stroke-width="6" stroke-linecap="round"/>';
      s += '<rect x="138" y="170" width="34" height="28" rx="4" fill="#F4F1EA" stroke="' + dark + '" stroke-width="2"/><text x="155" y="190" text-anchor="middle" font-family="Arial" font-weight="700" font-size="16" fill="#15171C">P</text>';
    }
    if (big) {
      s += '<path d="M248 214 C236 240 240 284 270 300 M360 216 C376 236 372 280 346 300" stroke="' + metal + '" stroke-width="7" fill="none" stroke-linecap="round"/>';
      s += '<rect x="446" y="156" width="88" height="78" rx="8" fill="#B8BCC2" stroke="#7E848C" stroke-width="3"/><line x1="452" y1="176" x2="528" y2="176" stroke="#7E848C" stroke-width="3"/>';
      s += '<circle cx="186" cy="238" r="8" fill="#F4E9B0" stroke="' + dark + '" stroke-width="3"/>';
    }
    // baú de carga
    if (cargo) {
      s += '<rect x="440" y="' + (ty - 96) + '" width="104" height="86" rx="10" fill="#2B2F36"/>';
      s += '<rect x="448" y="' + (ty - 88) + '" width="88" height="70" rx="7" fill="' + c + '"/>';
      s += '<rect x="448" y="' + (ty - 60) + '" width="88" height="8" fill="' + c2 + '"/>';
      s += '<rect x="436" y="' + (ty - 10) + '" width="112" height="8" rx="3" fill="' + metal + '"/>';
    }
    return s;
  }

  function esportivaSVG(tipo, c, c2, c3, dark, metal, seat, fx, rx, wy, r) {
    var esp = tipo === "especial", sb = tipo !== "sport";
    var n = parseInt(c.slice(1), 16), luz = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
    var aro = esp ? "#C9A227" : metal;
    var s = wheel(fx, wy, r, false, aro) + wheel(rx, wy, r, false, aro);
    s += '<line x1="' + fx + '" y1="' + wy + '" x2="212" y2="150" stroke="' + (esp ? "#C9A227" : metal) + '" stroke-width="12" stroke-linecap="round"/>';
    s += '<path d="M330 286 L' + rx + ' ' + wy + '" stroke="' + dark + '" stroke-width="15" stroke-linecap="round"/>';
    s += '<line x1="366" y1="176" x2="414" y2="284" stroke="' + c3 + '" stroke-width="9" stroke-linecap="round"/>';
    s += '<path d="M244 226 L350 226 L362 284 L268 292 Z" fill="#3A3E45"/>';
    if (sb) s += '<path d="M318 284 L404 294 L408 310 L322 304 Z" fill="' + (esp ? "#8C9198" : metal) + '"/>';
    else s += '<path d="M350 288 C392 288 414 266 432 248" stroke="' + metal + '" stroke-width="9" fill="none"/><rect x="420" y="232" width="70" height="20" rx="10" fill="' + metal + '" transform="rotate(-18 455 242)"/>';
    s += '<path d="M160 202 L176 172 L214 142 L252 128 L282 150 L330 166 L354 190 L350 236 L326 260 L262 274 L214 260 L184 236 Z" fill="' + c + '"/>';
    s += '<path d="M184 236 L214 260 L262 274 L326 260 L334 270 L264 288 L208 274 Z" fill="' + c2 + '"/>';
    s += sb ? '<path d="M214 142 L238 110 L262 114 L252 128 Z" fill="#2E3A48" opacity="0.9"/>' : '<path d="M214 142 C222 128 232 122 246 120 L252 128 Z" fill="#2E3A48" opacity="0.9"/>';
    s += '<path d="M164 198 L188 178 L198 186 L172 206 Z" fill="#F4E9B0"/>';
    s += '<path d="M252 128 C282 112 324 114 346 130 L354 162 L330 166 L282 150 Z" fill="' + c + '"/>';
    s += '<path d="M262 128 C288 118 318 118 338 128" stroke="' + c3 + '" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.8"/>';
    s += '<path d="M344 140 L394 132 L400 144 L350 152 Z" fill="' + seat + '"/>';
    s += '<path d="M350 152 L400 140 L500 122 L506 132 L468 150 L388 176 Z" fill="' + c + '"/>';
    s += '<path d="M388 176 L468 150 L470 158 L394 184 Z" fill="' + c2 + '"/>';
    s += '<rect x="492" y="121" width="14" height="8" rx="3" fill="#D8423A"/>';
    s += '<line x1="232" y1="134" x2="266" y2="126" stroke="' + dark + '" stroke-width="7" stroke-linecap="round"/>';
    s += '<path d="M200 214 L234 222" stroke="' + c2 + '" stroke-width="5" stroke-linecap="round"/>';
    if (sb) s += '<path d="M206 228 L234 218 L238 232 L210 240 Z" fill="' + dark + '"/><path d="M262 214 L340 228 L338 236 L260 222 Z" fill="' + c3 + '" opacity="0.9"/>';
    if (esp) {
      var f1 = luz > 150 ? "#C8372D" : "#C9A227", f2 = luz > 150 ? "#2350A8" : "#8A6E12";
      s += '<path d="M176 214 L344 242 L342 254 L178 226 Z" fill="' + f1 + '"/><path d="M186 232 L338 258 L334 266 L190 242 Z" fill="' + f2 + '"/>';
      s += '<path d="M396 160 L494 132 L496 139 L400 167 Z" fill="' + f1 + '"/>';
      s += '<circle cx="300" cy="196" r="17" fill="#F4F1EA" stroke="' + f1 + '" stroke-width="3"/><text x="300" y="203" text-anchor="middle" font-family="Arial" font-weight="700" font-size="19" fill="#15171C">1</text>';
    }
    return s;
  }

  window.motoSVG = function (tipo, cor, variante) {
    var bg, extra = "";
    if (variante === "noite") {
      bg = '<rect width="640" height="440" fill="#14181F"/><rect y="352" width="640" height="88" fill="#1C222B"/>' +
        '<circle cx="520" cy="80" r="140" fill="' + cor + '" opacity="0.18"/>' +
        '<line x1="0" y1="352" x2="640" y2="352" stroke="#2E3642" stroke-width="2"/>';
    } else {
      bg = '';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="Ilustração da moto">' +
      bg + '<g transform="translate(20,20)">' + moto(tipo, cor) + '</g>' + extra + '</svg>';
  };
})();
