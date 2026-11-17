// Canvas adaptation of React Bits' ParticleText for this static HTML site.
(() => {
  const container = document.querySelector('#studio-title');
  const canvas = container?.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!container || !canvas || !ctx) return;

  const text = 'Void Studios';
  const density = 4;
  const particleSize = 1.7;
  const gatherDuration = 1900;
  const stagger = 760;
  const scatter = 120;
  const repelRadius = 110;
  const pointerRepel = 34;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  let width = 0, height = 0, dpr = 1, particles = [];
  let raf = 0, introStart = 0, introActive = true, pointerActive = false;
  let pointerX = 0, pointerY = 0, burstActive = false;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const colorToRgb = value => {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
  };
  const mix = (a, b, t) => `rgb(${Math.round(a.r + (b.r-a.r)*t)}, ${Math.round(a.g + (b.g-a.g)*t)}, ${Math.round(a.b + (b.b-a.b)*t)})`;
  const baseColor = colorToRgb(getComputedStyle(container).color || '#fff');
  const highlightColor = colorToRgb('#4f8dff');

  function resize() {
    const box = container.getBoundingClientRect();
    width = Math.floor(box.width);
    height = Math.floor(box.height);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    sampleText();
  }

  function sampleText() {
    if (!width || !height) return;
    const offscreen = document.createElement('canvas');
    const sampleCtx = offscreen.getContext('2d', { willReadFrequently: true });
    let fontSize = Math.min(200, width * 0.18);
    const family = getComputedStyle(container).fontFamily || 'sans-serif';
    sampleCtx.font = `800 ${fontSize}px ${family}`;
    const maxWidth = width * 0.92;
    if (sampleCtx.measureText(text).width > maxWidth) {
      fontSize *= maxWidth / sampleCtx.measureText(text).width;
      sampleCtx.font = `800 ${fontSize}px ${family}`;
    }
    const metrics = sampleCtx.measureText(text);
    const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
    const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontSize * 0.78);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || fontSize * 0.22);
    const pad = Math.max(12, Math.ceil(fontSize * 0.08));
    offscreen.width = left + right + pad * 2;
    offscreen.height = ascent + descent + pad * 2;
    sampleCtx.font = `800 ${fontSize}px ${family}`;
    sampleCtx.textBaseline = 'alphabetic';
    sampleCtx.fillStyle = '#fff';
    sampleCtx.fillText(text, pad - left, pad + ascent);
    const data = sampleCtx.getImageData(0, 0, offscreen.width, offscreen.height).data;
    const targets = [];
    for (let y = 0; y < offscreen.height; y += density) {
      for (let x = 0; x < offscreen.width; x += density) {
        const alpha = data[(y * offscreen.width + x) * 4 + 3];
        if (alpha > 40) targets.push({ x: width / 2 - offscreen.width / 2 + x, y: height / 2 - offscreen.height / 2 + y });
      }
    }
    const stride = Math.max(1, Math.ceil(targets.length / 4200));
    particles = targets.filter((_, i) => i % stride === 0).map((target, i) => {
      const seed = ((i * 9301 + 49297) % 233280) / 233280;
      const angle = seed * Math.PI * 2;
      const distance = scatter * (0.35 + seed * 0.75);
      const x = target.x + Math.cos(angle) * distance;
      const y = target.y + Math.sin(angle) * distance;
      return { ...target, tx: target.x, ty: target.y, x: reduceMotion.matches ? target.x : x, y: reduceMotion.matches ? target.y : y, sx: x, sy: y, seed, vx: 0, vy: 0, ox: 0, oy: 0 };
    });
    introActive = !reduceMotion.matches;
    introStart = performance.now();
    wake();
  }

  function wake() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, 1 / 60);
    const t = (now - introStart) / gatherDuration;
    const scanX = -24 + (width + 48) * clamp(t / 0.8, 0, 1);
    let moving = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const p of particles) {
      let tx = p.tx, ty = p.ty;
      if (introActive) {
        const local = (now - introStart - p.seed * stagger * 0.15 - (p.tx / Math.max(1, width)) * gatherDuration * 0.8) / (gatherDuration * 0.4);
        const progress = clamp(local, 0, 1);
        if (local < 0) continue;
        const ease = easeOut(progress);
        tx = p.sx + (p.tx - p.sx) * ease;
        ty = p.sy + (p.ty - p.sy) * ease;
        if (progress < 1) moving = true;
      }
      if (pointerActive && !reduceMotion.matches) {
        const dx = tx - pointerX, dy = ty - pointerY, dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < repelRadius) {
          const force = Math.pow(1 - dist / repelRadius, 2) * pointerRepel;
          tx += dx / dist * force;
          ty += dy / dist * force;
        }
        moving = true;
      }
      if (burstActive) {
        p.vx += (-18 * p.ox - 7.5 * p.vx) * dt;
        p.vy += (-18 * p.oy - 7.5 * p.vy) * dt;
        p.ox += p.vx * dt; p.oy += p.vy * dt;
        tx += p.ox; ty += p.oy;
        if (Math.abs(p.ox) + Math.abs(p.oy) > 0.5 || Math.abs(p.vx) + Math.abs(p.vy) > 3) moving = true;
      }
      const dx = tx - p.x, dy = ty - p.y;
      p.x += dx * 0.22; p.y += dy * 0.22;
      if (Math.abs(dx) + Math.abs(dy) > 0.2) moving = true;
      const color = mix(baseColor, highlightColor, clamp(p.tx / Math.max(1, width), 0, 1));
      const angle = Math.hypot(dx, dy) > 0.3 ? Math.atan2(dy, dx) : -Math.PI / 4;
      const length = Math.max(2, particleSize * 0.8 + density * 0.7);
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(angle) * length / 2, p.y - Math.sin(angle) * length / 2);
      ctx.lineTo(p.x + Math.cos(angle) * length / 2, p.y + Math.sin(angle) * length / 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, particleSize * 0.65);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    if (introActive && !reduceMotion.matches && t >= 1.3) introActive = false;
    if (introActive && !reduceMotion.matches && t >= 0 && t <= 1.3) {
      ctx.globalAlpha = Math.min(1, t / 0.08) * Math.min(1, (1.3 - t) / 0.3) * 0.85;
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(79,141,255,0)');
      gradient.addColorStop(0.5, 'rgba(79,141,255,1)');
      gradient.addColorStop(1, 'rgba(79,141,255,0)');
      ctx.fillStyle = gradient;
      ctx.shadowColor = '#4f8dff'; ctx.shadowBlur = 8;
      ctx.fillRect(scanX - 0.75, 0, 1.5, height);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
    if (!moving) burstActive = false;
    if (introActive || moving || pointerActive || burstActive) wake();
  }

  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
  }
  canvas.addEventListener('pointerenter', event => { locate(event); pointerActive = true; wake(); introActive = true; introStart = performance.now(); });
  canvas.addEventListener('pointermove', event => { locate(event); pointerActive = true; wake(); });
  canvas.addEventListener('pointerleave', () => { pointerActive = false; wake(); });
  canvas.addEventListener('pointerdown', event => {
    if (reduceMotion.matches) return;
    locate(event);
    for (const p of particles) {
      const dx = p.x - pointerX, dy = p.y - pointerY, distance = Math.hypot(dx, dy);
      const radius = 90 + 70 * Math.sqrt(0.7) + repelRadius * 0.25;
      if (distance < radius) {
        const power = 950 * 0.7 * (0.2 + 0.8 * Math.pow(1 - distance / radius, 2));
        const angle = Math.atan2(dy, dx) + (p.seed - 0.5) * 0.9;
        p.vx += Math.cos(angle) * power;
        p.vy += Math.sin(angle) * power;
      }
    }
    burstActive = true; wake();
  });
  reduceMotion.addEventListener('change', event => { if (event.matches) { introActive = false; burstActive = false; particles.forEach(p => { p.x = p.tx; p.y = p.ty; p.ox = p.oy = p.vx = p.vy = 0; }); } wake(); });
  new ResizeObserver(resize).observe(container);
  resize();
  if (document.fonts?.ready) document.fonts.ready.then(resize);
})();
