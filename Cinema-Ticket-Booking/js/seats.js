/* ==========================================================
   seats.js — Mapa de la sala
   Dibuja la pantalla, las filas (A, B, C...) y cada butaca
   numerada con forma de butaca (SVG). Estados:
   disponible · seleccionada · ocupada · movilidad reducida
   ========================================================== */
window.CineApp = window.CineApp || {};

(function (C) {
  'use strict';

  const SEAT_SVG =
    '<svg class="seat-shape" viewBox="0 0 32 30" aria-hidden="true">' +
      '<rect class="s-back" x="6" y="1" width="20" height="17" rx="5"/>' +
      '<rect class="s-arm" x="1.5" y="10" width="5.5" height="16" rx="2.75"/>' +
      '<rect class="s-arm" x="25" y="10" width="5.5" height="16" rx="2.75"/>' +
      '<rect class="s-cushion" x="6" y="17" width="20" height="9" rx="3.5"/>' +
      '<path class="s-x" d="M11 5.5l10 9M21 5.5l-10 9"/>' +
    '</svg>';

  C.seatIcon = function (state) {
    return '<span class="seat seat--' + state + ' seat--legend" aria-hidden="true">' + SEAT_SVG + '</span>';
  };

  /**
   * Devuelve el HTML de la sala.
   * @param {object} room      resultado de C.buildRoom()
   * @param {Set}    occupied  butacas ocupadas ("F7")
   * @param {Array}  selected  butacas elegidas por el usuario
   */
  C.renderRoom = function (room, occupied, selected) {
    const sel = new Set(selected);
    let rows = '';

    room.letters.forEach(L => {
      let n = 0;
      let blocks = '';
      room.blocks.forEach(size => {
        let seats = '';
        for (let i = 0; i < size; i++) {
          n++;
          const id = L + n;
          const taken = occupied.has(id);
          const isSel = sel.has(id);
          const acc = C.isAccessible(room, L, n);
          const state = taken ? 'taken' : isSel ? 'selected' : acc ? 'accessible' : 'free';
          const label = 'Fila ' + L + ', butaca ' + n +
            (taken ? ', ocupada' : isSel ? ', seleccionada' : acc ? ', movilidad reducida, disponible' : ', disponible');
          seats +=
            '<button type="button" class="seat seat--' + state + '" data-seat="' + id + '"' +
            (taken ? ' disabled' : '') +
            ' aria-pressed="' + isSel + '" aria-label="' + label + '" title="Fila ' + L + ' · Butaca ' + n + '">' +
              SEAT_SVG + '<span class="seat-num">' + n + '</span>' +
            '</button>';
        }
        blocks += '<div class="seat-block">' + seats + '</div>';
      });
      rows +=
        '<div class="seat-row" role="group" aria-label="Fila ' + L + '">' +
          '<span class="row-label">' + L + '</span>' + blocks + '<span class="row-label">' + L + '</span>' +
        '</div>';
    });

    return (
      '<div class="room">' +
        '<div class="screen" aria-hidden="true">' +
          '<svg viewBox="0 0 600 60" preserveAspectRatio="none"><defs><linearGradient id="scr" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="var(--screen)" stop-opacity=".9"/><stop offset="1" stop-color="var(--screen)" stop-opacity="0"/></linearGradient></defs>' +
          '<path d="M10 40 Q300 0 590 40" fill="none" stroke="var(--screen)" stroke-width="5" stroke-linecap="round"/>' +
          '<path d="M10 40 Q300 0 590 40 L560 60 Q300 26 40 60 Z" fill="url(#scr)" opacity=".25"/></svg>' +
          '<span>PANTALLA</span>' +
        '</div>' +
        '<div class="seat-rows">' + rows + '</div>' +
        '<div class="room-exit" aria-hidden="true"><span>Entrada / Salida</span></div>' +
      '</div>'
    );
  };
})(window.CineApp);
