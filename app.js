(function () {
  'use strict';

  var PREVIEW_TARGET = 640;
  var DOWNLOAD_TARGET = 1080;

  var TYPES = {
    url: {
      label: 'Enlace (URL)',
      placeholder: 'https://ejemplo.com',
      inputMode: 'url',
      autocapitalize: 'off',
      hint: 'Escribe o pega el enlace que quieres compartir.',
      file: 'enlace',
      normalize: function (value) {
        var text = value.trim();
        var candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : 'https://' + text;
        var parsed;
        try {
          parsed = new URL(candidate);
        } catch (err) {
          throw new Error('El enlace no es válido. Ejemplo: https://ejemplo.com');
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('Usa un enlace que empiece por http:// o https://');
        }
        return parsed.href;
      }
    },
    phone: {
      label: 'Número de teléfono',
      placeholder: '+58 412 123 4567',
      inputMode: 'tel',
      autocapitalize: 'off',
      hint: 'Al escanear, el teléfono propondrá llamar a ese número.',
      file: 'telefono',
      normalize: function (value) {
        var text = value.trim();
        var digits = text.replace(/\D/g, '');
        if (digits.length < 6) {
          throw new Error('Introduce un número válido (mínimo 6 dígitos).');
        }
        return 'tel:' + (text.charAt(0) === '+' ? '+' : '') + digits;
      }
    },
    email: {
      label: 'Correo electrónico',
      placeholder: 'nombre@dominio.com',
      inputMode: 'email',
      autocapitalize: 'off',
      hint: 'Al escanear, se abrirá el correo con ese destinatario.',
      file: 'correo',
      normalize: function (value) {
        var text = value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
          throw new Error('Introduce un correo válido. Ejemplo: nombre@dominio.com');
        }
        return 'mailto:' + text;
      }
    },
    address: {
      label: 'Dirección o lugar',
      placeholder: 'Av. Bolívar, Caracas, Venezuela',
      inputMode: 'text',
      autocapitalize: 'sentences',
      hint: 'Al escanear, se abrirá la ubicación en Google Maps.',
      file: 'direccion',
      normalize: function (value) {
        var text = value.trim().replace(/\s+/g, ' ');
        if (!text) {
          throw new Error('Escribe una dirección o lugar.');
        }
        return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(text);
      }
    }
  };

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var input = document.getElementById('contentInput');
  var fieldLabel = document.getElementById('fieldLabel');
  var hint = document.getElementById('hint');
  var qrFrame = document.getElementById('qrFrame');
  var qrCanvas = document.getElementById('qrCanvas');
  var qrEmpty = document.getElementById('qrEmpty');
  var qrEmptyText = document.getElementById('qrEmptyText');
  var encodedText = document.getElementById('encodedText');
  var downloadBtn = document.getElementById('downloadBtn');

  var stored = { url: '', phone: '', email: '', address: '' };
  var currentType = 'url';
  var lastEncoded = '';
  var debounceTimer = null;

  function drawQR(canvas, text, targetPx) {
    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();

    var count = qr.getModuleCount();
    var margin = 4;
    var total = count + margin * 2;
    var scale = Math.max(2, Math.round(targetPx / total));
    var size = total * scale;

    canvas.width = size;
    canvas.height = size;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
        }
      }
    }
  }

  function setHint(text, isError) {
    hint.textContent = text;
    hint.classList.toggle('is-error', Boolean(isError));
  }

  function clearQR(message) {
    lastEncoded = '';
    qrCanvas.hidden = true;
    qrEmpty.hidden = false;
    qrEmptyText.textContent = message || 'Tu código QR aparecerá aquí';
    encodedText.hidden = true;
    downloadBtn.disabled = true;
    qrFrame.classList.remove('has-code');
  }

  function showQR(encoded) {
    lastEncoded = encoded;
    qrCanvas.hidden = false;
    qrEmpty.hidden = true;
    qrCanvas.setAttribute('aria-label', 'Código QR generado');
    encodedText.textContent = encoded;
    encodedText.title = encoded;
    encodedText.hidden = false;
    downloadBtn.disabled = false;
    qrFrame.classList.add('has-code');
  }

  function update() {
    var value = input.value;
    stored[currentType] = value;

    if (!value.trim()) {
      clearQR();
      setHint(TYPES[currentType].hint, false);
      return;
    }

    var encoded;
    try {
      encoded = TYPES[currentType].normalize(value);
    } catch (err) {
      clearQR();
      setHint(err.message, true);
      return;
    }

    try {
      drawQR(qrCanvas, encoded, PREVIEW_TARGET);
      showQR(encoded);
    } catch (err) {
      clearQR('El contenido es demasiado largo para un código QR.');
      setHint('Acorta el texto e inténtalo de nuevo.', true);
      return;
    }

    setHint(TYPES[currentType].hint, false);
  }

  function selectType(type, focusInput) {
    if (type === currentType) return;

    stored[currentType] = input.value;
    currentType = type;
    var cfg = TYPES[type];

    tabs.forEach(function (tab) {
      var active = tab.dataset.type === type;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });

    fieldLabel.textContent = cfg.label;
    input.placeholder = cfg.placeholder;
    input.inputMode = cfg.inputMode;
    input.setAttribute('autocapitalize', cfg.autocapitalize);
    input.value = stored[type];

    if (focusInput) input.focus();
    update();
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () {
      selectType(tab.dataset.type, false);
    });

    tab.addEventListener('keydown', function (event) {
      var direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      var next = tabs[(index + direction + tabs.length) % tabs.length];
      selectType(next.dataset.type, true);
    });
  });

  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(update, 140);
  });

  downloadBtn.addEventListener('click', function () {
    if (!lastEncoded) return;

    var canvas = document.createElement('canvas');
    try {
      drawQR(canvas, lastEncoded, DOWNLOAD_TARGET);
    } catch (err) {
      return;
    }

    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'codigo-qr-' + TYPES[currentType].file + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 4000);
    }, 'image/png');
  });

  update();
})();
