/* ==========================================================
   ticket.js — Comprobante de reserva, QR y PDF
   Librerías (cargadas en index.html desde cdnjs):
   - qrcodejs  -> window.QRCode
   - jsPDF     -> window.jspdf.jsPDF
   ========================================================== */
window.CineApp = window.CineApp || {};

(function (C) {
  'use strict';

  /* ----------------------------------------------------------
     Configuración del QR
     mode: 'text' -> el QR contiene los datos de la reserva
     mode: 'url'  -> MEJORA FUTURA: el QR apunta a una URL que
                     devuelve el archivo con la reserva real,
                     por ejemplo https://tu-app.vercel.app/api/reserva/CA-7F3K9Q
     ---------------------------------------------------------- */
  C.QR_CONFIG = {
    mode: 'text',
    urlBase: '/api/reserva/'
  };

  function plain(s) {
    // qrcodejs maneja mejor texto sin tildes
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  C.qrPayload = function (b) {
    if (C.QR_CONFIG.mode === 'url') {
      return location.origin + C.QR_CONFIG.urlBase + encodeURIComponent(b.code);
    }
    return plain([
      'CINEAPP RESERVA ' + b.code,
      b.movie,
      b.cinema + ' - ' + b.sala,
      b.format + ' ' + b.lang,
      b.dateLabel + ' ' + b.time,
      'Butacas: ' + b.seats.join(', '),
      'Entradas: ' + b.qty + ' - Total: ' + C.money(b.total),
      'Titular: ' + b.email,
      'Retirar en boleteria con este codigo'
    ].join('\n'));
  };

  /** Dibuja el QR dentro de `el` y devuelve una promesa con el dataURL PNG */
  C.drawQR = function (el, booking) {
    el.innerHTML = '';
    if (typeof window.QRCode !== 'function') {
      el.innerHTML = '<p class="qr-missing">No se pudo cargar el generador de QR. Revisá tu conexión.</p>';
      return Promise.resolve(null);
    }
    /* global QRCode */
    new QRCode(el, {
      text: C.qrPayload(booking),
      width: 400,
      height: 400,
      colorDark: '#0A0A0C',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.M
    });
    return new Promise(resolve => {
      setTimeout(() => {
        const canvas = el.querySelector('canvas');
        resolve(canvas ? canvas.toDataURL('image/png') : null);
      }, 60);
    });
  };

  /** Genera y descarga el comprobante en PDF */
  C.downloadTicketPDF = function (booking, qrDataUrl) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      return { ok: false, error: 'No se pudo cargar el generador de PDF. Revisá tu conexión y probá de nuevo.' };
    }
    const { jsPDF } = window.jspdf;
    const W = 100, H = 190;
    const doc = new jsPDF({ unit: 'mm', format: [W, H] });
    const red = [224, 22, 43];

    // Encabezado negro
    doc.setFillColor(10, 10, 12);
    doc.rect(0, 0, W, 30, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text('CINE', 10, 15);
    doc.setTextColor(...red);
    doc.text('APP', 10 + doc.getTextWidth('CINE'), 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 190, 198);
    doc.text('Comprobante de reserva', 10, 22);
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(booking.code, W - 10, 22, { align: 'right' });

    // Título
    let y = 42;
    doc.setTextColor(10, 10, 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const titleLines = doc.splitTextToSize(booking.movie, W - 20);
    doc.text(titleLines, 10, y);
    y += titleLines.length * 6 + 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 100);
    doc.text(booking.format + ' · ' + booking.lang, 10, y);
    y += 8;

    // Datos en dos columnas
    const rows = [
      ['Cine', booking.cinema],
      ['Sala', booking.sala],
      ['Fecha', booking.dateLabel],
      ['Horario', booking.time + ' h'],
      ['Butacas', booking.seats.join(', ')],
      ['Entradas', booking.qty + ' × ' + C.money(booking.unitPrice)],
      ['Titular', booking.email]
    ];
    rows.forEach(([k, v]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 130);
      doc.text(k.toUpperCase(), 10, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(10, 10, 12);
      const lines = doc.splitTextToSize(String(v), W - 42);
      doc.text(lines, 34, y);
      y += Math.max(6, lines.length * 4.6 + 1.5);
    });

    // Total
    y += 1;
    doc.setDrawColor(210, 210, 216);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(10, y, W - 10, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL', 10, y);
    doc.setFontSize(14);
    doc.setTextColor(...red);
    doc.text(C.money(booking.total), W - 10, y, { align: 'right' });
    y += 6;
    doc.line(10, y, W - 10, y);
    doc.setLineDashPattern([], 0);

    // QR
    const qrSize = 46;
    y += 6;
    if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', (W - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 100);
    doc.text('Presentá este QR en boletería para retirar tus entradas.', W / 2, y, { align: 'center' });
    y += 4;
    doc.text('Emitido el ' + new Date(booking.createdAt).toLocaleString('es-AR'), W / 2, y, { align: 'center' });

    // Pie
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 158);
    doc.text('Proyecto educativo ilustrativo. No válido como entrada real.', W / 2, H - 6, { align: 'center' });

    doc.save('comprobante-' + booking.code + '.pdf');
    return { ok: true };
  };
})(window.CineApp);
