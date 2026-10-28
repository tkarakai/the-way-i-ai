// Rare tricks for the large home page wordmark: one at a time, in random order,
// only after the reader has been idle, and never while the logo is out of view.
(() => {
  'use strict';
  const logo = document.querySelector<HTMLElement>('.hero-wordmark .wordmark');
  const stem = logo?.querySelector<HTMLElement>('.logo-stem');
  const initial = logo?.querySelector<HTMLElement>('.title-initial.logo-part');
  const rest = logo?.querySelector<HTMLElement>('.logo-rest');
  if (!logo || !stem || !initial || !rest) return;
  const parts = [...logo.querySelectorAll<HTMLElement>('.logo-part')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = 'cubic-bezier(.2, .8, .2, 1)';
  const idleBefore = 20_000, gap = [60_000, 120_000];

  // Rotation needs a box. A box drops the trailing letter-spacing an inline part has,
  // so measure and compensate it, keeping every other letter exactly where it was.
  const lift = (part: HTMLElement, origin: string) => {
    const before = part.getBoundingClientRect().right;
    part.style.display = 'inline-block';
    part.style.marginRight = `${before - part.getBoundingClientRect().right}px`;
    part.style.transformOrigin = origin;
    return () => { part.style.display = ''; part.style.marginRight = ''; part.style.transformOrigin = ''; };
  };
  const after = (animation: Animation, done: () => void) => { animation.onfinish = animation.oncancel = done; return animation; };

  // Font metrics for a part: where its baseline is, and how far its ink rises above it.
  const metrics = document.createElement('canvas').getContext('2d')!;
  const glyphs = (part: HTMLElement) => {
    const style = getComputedStyle(part);
    metrics.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = metrics.measureText(part.textContent ?? '');
    const box = part.getBoundingClientRect();
    return { box, baseline: box.top + text.fontBoundingBoxAscent, ascent: text.actualBoundingBoxAscent };
  };
  // Turns keyframe times in milliseconds into offsets.
  const timeline = (total: number, frames: (Keyframe & { at: number })[]) => frames.map(({ at, ...frame }) => ({ ...frame, offset: at / total }));

  // Shared trick tools. Everything a trick adds carries .logo-temp and is removed when it ends.
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const sizeOf = () => parseFloat(getComputedStyle(logo).fontSize);
  const temp = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, html = '') => {
    const element = document.createElement(tag);
    element.className = `logo-temp ${className}`;
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = html;
    return element;
  };
  // A trick's master clock: finishing or cancelling it ends the trick, clears its timers and cleans up.
  const clock = (total: number, done: () => void = () => undefined, steps: [number, () => void][] = []) => {
    const tick = temp('span', 'logo-clock');
    tick.hidden = true;
    logo.prepend(tick);
    const timers = steps.map(([at, step]) => setTimeout(step, at));
    return after(tick.animate([{ opacity: 0 }, { opacity: 0 }], { duration: total }), () => { timers.forEach(clearTimeout); tick.remove(); done(); });
  };
  const dark = () => document.documentElement.dataset.theme === 'dark';
  const point = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;

  const tricks: Record<string, () => Animation> = {
    // Alien energy: a glow charges letter by letter in irregular pulses, the letters tremble at the
    // peak, flash, and the power drains away.
    glow: () => {
      const off = '0 0 0 rgba(150, 255, 120, 0), 0 0 0 rgba(77, 255, 58, 0), 0 0 0 rgba(57, 255, 20, 0)';
      const charge = (level: number) => `0 0 ${.05 * level}em rgba(225, 255, 215, ${Math.min(1, level)}), 0 0 ${.16 * level}em rgba(77, 255, 58, ${Math.min(1, .9 * level)}), 0 0 ${.42 * level}em rgba(57, 255, 20, ${Math.min(.8, .6 * level)})`;
      const total = 2600;
      const animations = parts.map((part, index) => {
        const ink = getComputedStyle(part).color, lit = '#f2fff0';
        const jitter = () => `${(Math.random() - .5) * .016}em`;
        return part.animate(timeline(total, [
          { at: 0, textShadow: off, color: ink },
          { at: 260, textShadow: charge(.35), color: ink },
          { at: 380, textShadow: charge(.1), color: ink },
          { at: 620, textShadow: charge(.7), color: ink },
          { at: 760, textShadow: charge(.4), color: ink },
          { at: 1100, textShadow: charge(1.1), color: lit, left: '0', top: '0' },
          { at: 1180, textShadow: charge(1.2), color: lit, left: jitter(), top: jitter() },
          { at: 1260, textShadow: charge(1.15), color: lit, left: jitter(), top: jitter() },
          { at: 1340, textShadow: charge(1.3), color: lit, left: jitter(), top: jitter() },
          { at: 1420, textShadow: charge(1.6), color: '#ffffff', left: '0', top: '0' },
          { at: 1700, textShadow: charge(.9), color: lit },
          { at: 2200, textShadow: charge(.25), color: ink },
          { at: total, textShadow: off, color: ink }
        ]), { duration: total, delay: index * 70, easing: 'ease-in-out' });
      });
      logo.querySelector('.title-art')?.animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 .05em rgba(77, 255, 58, .9)) saturate(2) hue-rotate(-40deg)', offset: .5 }, { filter: 'none' }], { duration: total, easing: 'ease-in-out' });
      return animations[animations.length - 1];
    },
    // A butterfly flutters in on a wobbly path, lands on top of a letter, rests with a few slow
    // wingbeats, and flies off the other way.
    butterfly: () => {
      const perch = [stem, initial, rest][Math.floor(Math.random() * 3)];
      const { box: letter, baseline, ascent } = glyphs(perch);
      const box = logo.getBoundingClientRect(), size = parseFloat(getComputedStyle(logo).fontSize);
      const x = letter.left + letter.width / 2 - box.left, y = baseline - ascent - box.top;
      const butterfly = document.createElement('span');
      butterfly.className = 'logo-butterfly';
      butterfly.setAttribute('aria-hidden', 'true');
      butterfly.style.width = `${size * .24}px`;
      butterfly.innerHTML = `<svg viewBox="0 0 60 46"><g class="wing left"><path d="M29 20 C 20 2, 4 -2, 2 8 C 0 18, 14 22, 29 22Z" fill="#e0782a" stroke="#2b1a10" stroke-width="2.2"/><path d="M29 23 C 16 24, 6 34, 12 41 C 18 47, 27 36, 29 26Z" fill="#c9601c" stroke="#2b1a10" stroke-width="2.2"/><circle cx="7" cy="9" r="1.6" fill="#fff6e8"/><circle cx="12" cy="5" r="1.2" fill="#fff6e8"/></g><g class="wing right"><path d="M31 20 C 40 2, 56 -2, 58 8 C 60 18, 46 22, 31 22Z" fill="#e0782a" stroke="#2b1a10" stroke-width="2.2"/><path d="M31 23 C 44 24, 54 34, 48 41 C 42 47, 33 36, 31 26Z" fill="#c9601c" stroke="#2b1a10" stroke-width="2.2"/><circle cx="53" cy="9" r="1.6" fill="#fff6e8"/><circle cx="48" cy="5" r="1.2" fill="#fff6e8"/></g><ellipse cx="30" cy="25" rx="2.2" ry="12" fill="#2b1a10"/><path d="M29 14 Q 26 6 23 4 M31 14 Q 34 6 37 4" fill="none" stroke="#2b1a10" stroke-width="1.2" stroke-linecap="round"/></svg>`;
      logo.prepend(butterfly);
      const point = (px: number, py: number) => `${(px).toFixed(1)} ${(py).toFixed(1)}`;
      const from = [box.width + size * .9, -size * .9], away = [-size * .9, -size * 1.4];
      const arrive = `M ${point(from[0], from[1])} C ${point(x + size * 1.4, -size * .2)}, ${point(x + size * .9, -size * 1.1)}, ${point(x + size * .4, y - size * .55)} S ${point(x - size * .05, y - size * .25)}, ${point(x, y)}`;
      const leave = ` C ${point(x - size * .1, y - size * .5)}, ${point(x - size * .7, y - size * .2)}, ${point(x - size * 1.1, y - size * .9)} S ${point(away[0] + size * .6, away[1] + size * .4)}, ${point(away[0], away[1])}`;
      butterfly.style.offsetPath = `path('${arrive}${leave}')`;
      const flyIn = 1500, perched = 1500, flyOut = 1300, total = flyIn + perched + flyOut;
      // Where along the whole path the landing point is, so the butterfly can stay there.
      const length = (d: string) => { const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path'); probe.setAttribute('d', d); return probe.getTotalLength(); };
      const landed = length(arrive) / length(arrive + leave) * 100;
      const flight = butterfly.animate(timeline(total, [
        { at: 0, offsetDistance: '0%', opacity: 0, easing: 'ease-out' }, { at: 200, opacity: 1 },
        { at: flyIn, offsetDistance: `${landed}%`, easing: 'linear' }, { at: flyIn + perched, offsetDistance: `${landed}%`, easing: 'ease-in' },
        { at: total - 200, opacity: 1 }, { at: total, offsetDistance: '100%', opacity: 0 }
      ]), { duration: total });
      butterfly.animate(timeline(total, [
        { at: 0, rotate: '-14deg' }, { at: 500, rotate: '10deg' }, { at: 1000, rotate: '-8deg' }, { at: flyIn, rotate: '0deg' },
        { at: flyIn + perched, rotate: '0deg' }, { at: flyIn + perched + 500, rotate: '-16deg' }, { at: total, rotate: '8deg' }
      ]), { duration: total, easing: 'ease-in-out' });
      // Wings: quick beats in flight, a few slow open-and-close beats at rest.
      butterfly.querySelectorAll('.wing').forEach(wing => {
        const beats: Keyframe[] = [];
        const add = (start: number, end: number, beat: number) => { for (let t = start; t < end; t += beat) beats.push({ offset: t / total, scale: '1 1' }, { offset: (t + beat / 2) / total, scale: '.18 1' }); };
        add(0, flyIn - 150, 110);
        beats.push({ offset: flyIn / total, scale: '.55 1' });
        add(flyIn + 250, flyIn + perched - 250, 420);
        add(flyIn + perched, total, 100);
        beats.push({ offset: 1, scale: '1 1' });
        wing.animate(beats, { duration: total, easing: 'ease-in-out' });
      });
      return after(flight, () => butterfly.remove());
    },
    // "way I" topples forward over its baseline like a board on a hinge, slams upside down onto
    // "AI", bounces, rests, then is heaved back up with effort: a failed try, a slow strained
    // climb past the heavy point, and a quick settle once it is over the top.
    topple: () => {
      const fallers = parts.filter(part => part.classList.contains('logo-word') && !part.classList.contains('title-prefix')).concat(stem);
      // Hinge where a 180° flip maps the shared I exactly onto the last line's I: the lines overlap
      // (the stems join), so it lies between the two baselines rather than on the first one.
      const { baseline, ascent } = glyphs(stem), { baseline: lower } = glyphs(rest);
      const hinge = (baseline + lower - ascent) / 2;
      const restores = fallers.map(part => {
        const restore = lift(part, '50% 50%');
        part.style.transformOrigin = `50% ${hinge - part.getBoundingClientRect().top}px`;
        part.style.zIndex = '1';
        return () => { restore(); part.style.zIndex = ''; };
      });
      const total = 4200;
      const angle = (degrees: number) => `perspective(1400px) rotateX(${degrees}deg)`;
      const strain = (at: number, degrees: number) => [{ at, transform: angle(degrees - 1.5), easing: 'linear' }, { at: at + 45, transform: angle(degrees + 1.5), easing: 'linear' }, { at: at + 90, transform: angle(degrees - 1), easing: 'linear' }];
      const fall = timeline(total, [
        { at: 0, transform: angle(0), easing: 'cubic-bezier(.32, 0, .67, 0)' },
        { at: 120, transform: angle(-4), easing: 'cubic-bezier(.55, 0, 1, .45)' },
        { at: 620, transform: angle(-180), easing: 'cubic-bezier(.3, .7, .5, 1)' },
        { at: 720, transform: angle(-166), easing: 'cubic-bezier(.5, 0, .7, .4)' },
        { at: 820, transform: angle(-180), easing: 'ease-out' },
        { at: 880, transform: angle(-175), easing: 'ease-in' },
        { at: 940, transform: angle(-180), easing: 'linear' },
        { at: 1700, transform: angle(-180), easing: 'cubic-bezier(.4, 0, .6, 1)' },
        // A first heave fails.
        { at: 2050, transform: angle(-163), easing: 'cubic-bezier(.5, 0, 1, .5)' },
        { at: 2200, transform: angle(-180), easing: 'ease-out' },
        { at: 2260, transform: angle(-177), easing: 'ease-in' },
        { at: 2320, transform: angle(-180), easing: 'cubic-bezier(.4, 0, .7, 1)' },
        // A slow, trembling climb past the heavy point.
        ...strain(2600, -158), ...strain(2900, -135), ...strain(3200, -112),
        { at: 3500, transform: angle(-92), easing: 'cubic-bezier(.3, 0, .2, 1)' },
        // Over the top it swings home, overshoots slightly and settles.
        { at: 3900, transform: angle(4), easing: 'ease-in-out' },
        { at: 4050, transform: angle(-1.5), easing: 'ease-out' },
        { at: total, transform: angle(0) }
      ]);
      const animations = fallers.map(part => part.animate(fall, { duration: total }));
      // Impact: "AI" is jolted down and squashed for an instant, twice.
      [initial, rest].forEach(part => part.animate(timeline(total, [
        { at: 0, top: '0' }, { at: 610, top: '0' }, { at: 660, top: '.05em', easing: 'ease-out' }, { at: 760, top: '0' },
        { at: 815, top: '.02em' }, { at: 880, top: '0' }, { at: total, top: '0' }
      ]), { duration: total }));
      return after(animations[animations.length - 1], () => restores.forEach(restore => restore()));
    },
    // The shared I crouches, flips once and lands back on its stem.
    backflip: () => after(stem.animate([
      { transform: 'none' },
      { transform: 'translateY(.03em) scaleY(.88)', offset: .18, easing: 'cubic-bezier(.2, .7, .3, 1)' },
      { transform: 'translateY(-.62em) rotate(-190deg)', offset: .55, easing: 'cubic-bezier(.5, 0, .8, .5)' },
      { transform: 'translateY(.02em) rotate(-360deg) scaleY(.9)', offset: .84, easing: 'ease-out' },
      { transform: 'rotate(-360deg)' }
    ], { duration: 900 }), lift(stem, '50% 60%')),
    // A small hop runs part by part through the wordmark.
    ripple: () => {
      const hops = parts.map((part, index) => part.animate([{ top: '0' }, { top: '-.14em', offset: .4, easing: 'ease-in' }, { top: '0' }], { duration: 380, delay: index * 60, easing: 'ease-out' }));
      return hops[hops.length - 1];
    },
    // The last line swaps its letters, gets a spell-check squiggle, and swaps back.
    swap: () => {
      const a = initial.getBoundingClientRect(), b = rest.getBoundingClientRect(), box = logo.getBoundingClientRect();
      const size = parseFloat(getComputedStyle(logo).fontSize);
      const toRight = b.right - a.right, toLeft = a.left - b.left;
      const timing = { duration: 1800 };
      const path = (x: number, arc: string) => [
        { offset: 0, easing: ease }, { offset: .12, x: x / 2, y: arc, easing: ease }, { offset: .24, x }, { offset: .72, x, easing: ease },
        { offset: .84, x: x / 2, y: arc === '-.22em' ? '.18em' : '-.22em', easing: ease }, { offset: 1 }
      ];
      initial.animate(path(toRight, '-.22em').map(({ x = 0, y = '0', ...frame }) => ({ ...frame, translate: `${x}px ${y}` })), timing);
      const squiggle = document.createElement('span');
      squiggle.className = 'logo-squiggle';
      squiggle.setAttribute('aria-hidden', 'true');
      squiggle.innerHTML = `<svg viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 6.25 0 12.5 5 T 25 5 T 37.5 5 T 50 5 T 62.5 5 T 75 5 T 87.5 5 T 100 5" fill="none" stroke="currentColor" stroke-width="${Math.max(2.5, size * .024).toFixed(1)}" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
      // Sit just under the baseline, like a spell-check underline (the line box adds descent space below).
      const style = getComputedStyle(rest), metrics = document.createElement('canvas').getContext('2d')!;
      metrics.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const baseline = b.top + metrics.measureText(rest.textContent ?? '').fontBoundingBoxAscent;
      Object.assign(squiggle.style, { left: `${Math.min(a.left, b.left) - box.left}px`, width: `${Math.max(a.right, b.right) - Math.min(a.left, b.left)}px`, top: `${baseline - box.top + size * .025}px`, height: `${size * .07}px` });
      logo.prepend(squiggle); // First, so the last title line keeps its :last-child styling.
      squiggle.animate([
        { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 0, clipPath: 'inset(0 100% 0 0)', offset: .26 }, { opacity: 1, clipPath: 'inset(0 0 0 0)', offset: .4 },
        { opacity: 1, offset: .66 }, { opacity: 0, offset: .74 }, { opacity: 0 }
      ], timing);
      return after(rest.animate(path(toLeft, '.18em').map(({ x = 0, y = '0', ...frame }) => ({ ...frame, left: `${x}px`, top: y })), timing), () => squiggle.remove());
    },
    // A failing light, as in films: stutters, a moment of steady light, a near-blackout with a
    // stuttering recovery, then a last twitch. Changes are instant (step easing), and timing and
    // levels vary slightly each time. The shared I also flickers on its own, like one bad tube.
    flicker: () => {
      const vary = (value: number, amount: number) => value * (1 - amount + Math.random() * amount * 2);
      const frames = (segments: [number, number][]) => {
        const total = segments.reduce((sum, [duration]) => sum + duration, 0);
        let at = 0;
        const keyframes: Keyframe[] = segments.map(([duration, level]) => {
          const frame = { offset: at / total, opacity: Math.min(1, Math.max(0, level)), filter: level > .99 ? 'none' : `brightness(${.6 + level * .4})`, easing: 'steps(1, end)' };
          at += duration;
          return frame;
        });
        keyframes.push({ offset: 1, opacity: 1, filter: 'none' });
        return { keyframes, total };
      };
      const light = frames(([
        [40, .2], [30, 1], [60, .35], [25, .95], [35, .08], [90, 1],
        [300, 1],
        [30, .05], [50, .7], [25, .04], [220, .03], [40, .85], [30, .25], [70, 1],
        [200, 1], [25, .5], [40, 1]
      ] as [number, number][]).map(([duration, level]) => [vary(duration, .3), level >= 1 ? 1 : vary(level, .25)]));
      const tube = frames([[vary(190, .2), 1], [35, .15], [45, 1], [vary(280, .2), 1], [60, .1], [30, .6], [vary(600, .1), 1]]);
      stem.animate(tube.keyframes, { duration: tube.total });
      return logo.animate(light.keyframes, { duration: light.total });
    },
    // Time travel, film style. The logo leans back like a car on a road receding from the reader,
    // its rear lights up and arcs crackle, then it shoots away along a curve, turning and banking like
    // a jet and shrinking to a point. Two fire trails follow its curved path to that point and burn out
    // by themselves. Then it drops back in from above like a fast helicopter. Logo and fire share one
    // projection, matching CSS perspective(depth) rotateX(tilt) translate(curve) rotate(yaw) rotateY(roll).
    timeTravel: () => {
      const box = logo.getBoundingClientRect(), size = parseFloat(getComputedStyle(logo).fontSize);
      const w = box.width, h = box.height, unit = size / 100;
      const tilt = 65 * Math.PI / 180;
      // Perspective depth that puts the vanishing horizon a quarter of the logo's height above it.
      const depth = h * 1.25 * Math.tan(tilt);
      const lean = 450, launch = 950, gone = 1700, land = 3450, total = 4350;
      const reach = depth * 60, lamp = w * .27;

      // Curve towards open space: never over the introduction, never off the page.
      const intro = [...document.querySelectorAll<HTMLElement>('.collection-intro')].map(element => element.getBoundingClientRect()).find(other => other.top < box.bottom && other.bottom > box.top);
      const right = (intro && intro.left >= box.right ? intro.left : innerWidth) - box.right - size * .3;
      const left = box.left - size * .3;
      const side = right > left ? 1 : left > right ? -1 : Math.random() < .5 ? -1 : 1;
      const sweep = side * Math.min(w * .6, Math.max(0, (side > 0 ? right : left) + w * .35));
      // Lateral offset grows like k²/(k + k0), so the heading turns smoothly and the far end converges.
      const bend = sweep * Math.sin(tilt) / depth, k0 = depth * 1.5;
      const curve = (k: number) => ({ x: bend * k * k / (k + k0), yaw: Math.atan(bend * (k * k + 2 * k * k0) / (k + k0) ** 2) });

      const host = logo.parentElement!, origin = host.getBoundingClientRect();
      const pad = { left: size * .5 + Math.max(0, -sweep), right: size * .5 + Math.max(0, sweep), top: h * 1.25 + size * .45, bottom: size * .5 };
      const width = w + pad.left + pad.right, height = h + pad.top + pad.bottom, ratio = Math.min(2, devicePixelRatio || 1);
      const canvas = document.createElement('canvas');
      canvas.className = 'logo-temp logo-effects';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      Object.assign(canvas.style, { left: `${box.left - origin.left - pad.left}px`, top: `${box.top - origin.top - pad.top}px`, width: `${width}px`, height: `${height}px` });
      host.append(canvas);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(ratio, ratio);
      // The transform origin (bottom centre of the logo) in canvas coordinates.
      const ox = pad.left + w / 2, oy = pad.top + h;

      const smooth = (value: number) => value * value * (3 - 2 * value);
      const angleAt = (time: number) => tilt * smooth(clamp(time / lean));
      const travelAt = (time: number) => reach * clamp((time - launch) / (gone - launch)) ** 3;
      const rollAt = (yaw: number) => Math.max(-.6, Math.min(.6, -yaw * 1.1));
      // Project a point of the logo (x right, y up is negative) after the logo has travelled k along the curve.
      const project = (x: number, y: number, angle: number, k: number, roll = 0) => {
        const { x: shift, yaw } = curve(k);
        const x1 = x * Math.cos(roll), z1 = -x * Math.sin(roll);
        const x2 = x1 * Math.cos(yaw) - y * Math.sin(yaw), y2 = x1 * Math.sin(yaw) + y * Math.cos(yaw);
        const x3 = x2 + shift, y3 = y2 - k;
        const y4 = y3 * Math.cos(angle) - z1 * Math.sin(angle), z4 = y3 * Math.sin(angle) + z1 * Math.cos(angle);
        const scale = depth / (depth - z4);
        return { x: ox + x3 * scale, y: oy + y4 * scale, scale };
      };

      logo.style.transformOrigin = '50% 100%';
      type Particle = { lane: number; k: number; rise: number; drift: number; vy: number; born: number; life: number; size: number; smoke: boolean };
      const particles: Particle[] = [];
      let arcs: { x: number; y: number }[][] = [], arcsAt = -1, previous = 0, frame = 0;
      const begin = performance.now();
      const glowAt = (x: number, y: number, radius: number, colour: string, alpha: number) => {
        const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
        light.addColorStop(0, `rgba(${colour}, ${alpha})`); light.addColorStop(1, `rgba(${colour}, 0)`);
        ctx.fillStyle = light; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      };
      // Distance along the road for an even spread on screen (the far end would otherwise crowd).
      const distanceFor = (scale: number) => (depth / scale - depth) / Math.sin(tilt);
      const scaleFor = (k: number) => depth / (depth + k * Math.sin(tilt));
      const draw = (now: number) => {
        const t = now - begin, step = Math.min(50, t - previous) / 1000;
        previous = t;
        ctx.clearRect(0, 0, width, height);
        const angle = angleAt(t), travel = travelAt(t), { x: shift, yaw } = curve(travel), roll = rollAt(yaw);

        // The logo: lean, glow and shoot away along the curve; hidden while gone; then the helicopter drop.
        if (t < gone) {
          const energy = clamp((t - 250) / 600);
          logo.style.transform = `perspective(${depth}px) rotateX(${angle}rad) translate(${shift}px, ${-travel}px) rotate(${yaw}rad) rotateY(${roll}rad)`;
          logo.style.opacity = String(1 - clamp((t - (gone - 130)) / 130));
          logo.style.filter = energy ? `drop-shadow(0 0 ${.05 * energy}em rgba(130, 185, 255, ${.9 * energy})) brightness(${1 + .15 * energy})` : '';
        } else if (t < land) {
          logo.style.opacity = '0';
        } else if (t < total) {
          // Fast descent, a flare just above the ground, a touch-down dip and a small bob.
          const p = clamp((t - land) / 520), drop = 1 - (1 - p) ** 3, settle = clamp((t - land - 520) / 380);
          const y = -1.3 * (1 - drop) + (settle ? .035 * Math.sin(Math.PI * settle) * (1 - settle) - .012 * Math.sin(2 * Math.PI * settle) : 0);
          logo.style.transform = `translateY(${y}em) rotate(${-3.5 * side * (1 - drop)}deg)`;
          logo.style.transformOrigin = '50% 50%';
          logo.style.opacity = String(clamp((t - land) / 90));
          logo.style.filter = '';
        }

        if (t < gone) {
          const corners = [[-w / 2, 0], [w / 2, 0], [w / 2, -h], [-w / 2, -h]].map(([x, y]) => project(x, y, angle, travel, roll));
          // The rear (the bottom edge, nearest the reader) lights up: two lamps and a blue bar.
          const energy = clamp((t - 300) / 500);
          if (energy) {
            [-lamp, lamp].forEach(x => { const light = project(x, 0, angle, travel, roll); glowAt(light.x, light.y, size * .22 * light.scale, '255, 120, 60', .85 * energy); });
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(140, 195, 255, ${.8 * energy})`; ctx.lineWidth = size * .04 * corners[0].scale; ctx.shadowColor = 'rgba(110, 170, 255, 1)'; ctx.shadowBlur = 14 * unit;
            ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y); ctx.lineTo(corners[1].x, corners[1].y); ctx.stroke();
            ctx.restore();
          }
          // Lightning crackles around the logo's outline.
          if (t > 350) {
            if (t - arcsAt > 55) {
              arcsAt = t;
              arcs = Array.from({ length: 2 + Math.round(3 * energy) }, () => {
                const edge = Math.floor(Math.random() * 4), [a, b] = [corners[edge], corners[(edge + 1) % 4]];
                const from = Math.random() * .6, span = .25 + Math.random() * .4, steps = 9;
                return Array.from({ length: steps + 1 }, (_, index) => {
                  const along = from + span * index / steps, jag = index && index < steps ? (Math.random() - .5) * size * .16 * a.scale : 0;
                  return { x: a.x + (b.x - a.x) * along + jag, y: a.y + (b.y - a.y) * along + jag * .6 };
                });
              });
            }
            ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(110, 170, 255, 1)'; ctx.shadowBlur = 10 * unit;
            arcs.forEach(points => [[3 * unit, 'rgba(120, 175, 255, .55)'], [1.2 * unit, 'rgba(235, 245, 255, .95)']].forEach(([lineWidth, colour]) => {
              ctx.lineWidth = lineWidth as number; ctx.strokeStyle = colour as string;
              ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
            }));
            ctx.restore();
          }
        }

        // Fire along the two lamp paths, from where the logo stood to where it is now; it burns out by itself.
        const burning = t < launch ? 0 : t < 2200 ? 1 : clamp(1 - (t - 2200) / 1000);
        if (burning) {
          const near = scaleFor(Math.min(travel, reach));
          const count = Math.round(burning * 13 * step * 60);
          for (let index = 0; index < count; index++) {
            const lane = (index % 2 ? 1 : -1) * lamp + (Math.random() - .5) * size * .05, k = distanceFor(near + Math.random() * (1 - near));
            particles.push({ lane, k, rise: 0, drift: (Math.random() - .5) * 10 * unit, vy: (30 + Math.random() * 60) * unit, born: t, life: 220 + Math.random() * 420, size: (1.8 + Math.random() * 3.2) * unit, smoke: false });
            if (Math.random() < (t > 1900 ? .14 : .04)) particles.push({ lane, k, rise: 0, drift: (Math.random() - .3) * 12 * unit, vy: (14 + Math.random() * 18) * unit, born: t, life: 1100 + Math.random() * 900, size: (8 + Math.random() * 9) * unit, smoke: true });
          }
          // Embers along both paths, fading with the fire.
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          [-lamp, lamp].forEach(lane => { for (let index = 0; index <= 44; index++) {
            const point = project(lane, 0, tilt, distanceFor(1 - (1 - near) * index / 44));
            glowAt(point.x, point.y, size * .07 * point.scale, '255, 160, 60', .35 * burning * (.75 + Math.random() * .25));
          } });
          ctx.restore();
        }
        for (let index = particles.length - 1; index >= 0; index--) {
          const particle = particles[index], age = (t - particle.born) / particle.life;
          if (age >= 1) { particles.splice(index, 1); continue; }
          const base = project(particle.lane, 0, tilt, particle.k);
          particle.rise += particle.vy * step; particle.lane += particle.drift * step / base.scale;
          const x = base.x, y = base.y - particle.rise * base.scale, radius = particle.size * base.scale;
          if (particle.smoke) {
            ctx.globalCompositeOperation = 'source-over';
            const puff = radius * (1 + age * 2.2), alpha = .07 * (1 - age) * Math.min(1, age * 5);
            const haze = ctx.createRadialGradient(x, y, 0, x, y, puff);
            haze.addColorStop(0, `rgba(115, 112, 106, ${alpha})`); haze.addColorStop(1, 'rgba(115, 112, 106, 0)');
            ctx.fillStyle = haze; ctx.fillRect(x - puff, y - puff, puff * 2, puff * 2);
          } else {
            ctx.globalCompositeOperation = 'lighter';
            const [r, g, b] = age < .2 ? [255, 244, 190] : age < .5 ? [255, 176, 52] : age < .78 ? [236, 88, 26] : [130, 38, 18];
            ctx.save(); ctx.translate(x, y); ctx.scale(.55, 1.6 - age * .5);
            const tongue = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            tongue.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${.95 * (1 - age)})`); tongue.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.fillStyle = tongue; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        // A small flash where it vanishes into the distance.
        if (t > gone - 120 && t < gone + 220) {
          const point = project(0, 0, tilt, reach), p = clamp((t - gone + 120) / 340);
          glowAt(point.x, point.y, size * (.12 + .35 * p), '210, 230, 255', 1 - p);
        }
        if (t < total) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
      return clock(total, () => {
        cancelAnimationFrame(frame);
        canvas.remove();
        ['transform', 'transform-origin', 'opacity', 'filter'].forEach(property => logo.style.removeProperty(property));
      });
    },
    // Magnet: a magnet slides in at the side, the A strains towards it and drags the other letters
    // along as if on strings; the magnet leaves and everything springs back.
    magnet: () => {
      const total = 2600, size = sizeOf(), pull = initial.getBoundingClientRect().left - logo.getBoundingClientRect().left + size * .25;
      const magnet = temp('span', 'logo-magnet', `<svg viewBox="0 0 44 48"><path d="M4 4 H16 V26 A6 6 0 0 0 28 26 V4 H40 V26 A18 18 0 0 1 4 26Z" fill="#c8322a" stroke="#7a1a14" stroke-width="1.5"/><rect x="4" y="4" width="12" height="7" fill="#d9d9d4"/><rect x="28" y="4" width="12" height="7" fill="#d9d9d4"/></svg>`);
      magnet.style.rotate = '90deg';
      Object.assign(magnet.style, { left: `${-size * .55}px`, top: `${logo.getBoundingClientRect().height * .45}px`, width: `${size * .35}px` });
      logo.prepend(magnet);
      magnet.animate(timeline(total, [{ at: 0, opacity: 0, translate: '-60% 0' }, { at: 300, opacity: 1, translate: '0 0' }, { at: 1500, opacity: 1, translate: '0 0' }, { at: 1800, opacity: 0, translate: '-60% 0' }, { at: total, opacity: 0 }]), { duration: total, easing: 'ease-out' });
      const tremble = (base: number) => [{ at: 900, base }, { at: 1000, base: base * 1.04 }, { at: 1100, base: base * .97 }, { at: 1200, base: base * 1.03 }, { at: 1350, base }];
      const shift = (part: HTMLElement, strength: number) => {
        const dx = -pull * strength;
        const at = (x: number) => part === initial ? { translate: `${x}px 0` } : { left: `${x}px` };
        part.animate(timeline(total, [
          { at: 0, ...at(0) }, { at: 300, ...at(0), easing: 'cubic-bezier(.6, 0, .4, 1)' },
          { at: 750 + (1 - strength) * 150, ...at(dx) }, ...tremble(dx).map(({ at: time, base }) => ({ at: time, ...at(base) })),
          { at: 1550, ...at(dx), easing: 'cubic-bezier(.3, 1.6, .5, 1)' }, { at: 1850 + (1 - strength) * 120, ...at(0) }, { at: total, ...at(0) }
        ]), { duration: total });
      };
      shift(initial, 1); shift(rest, .75); shift(stem, .45); shift(parts[1], .25); shift(parts[0], .12);
      return clock(total, () => magnet.remove());
    },
    // Glitch broadcast: the colour channels split, the picture tears into bands, a "NO SIGNAL"
    // frame flashes up, and the picture comes back clean.
    glitch: () => {
      const total = 2700, off = 850, on = 2050, box = logo.getBoundingClientRect(), size = sizeOf();
      const lines = [...logo.querySelectorAll('.title-line')].map(line => line.outerHTML).join('');
      const channels = ['#ff2b4f', '#00d9ff'].map(colour => {
        const copy = temp('span', 'logo-clone', lines);
        Object.assign(copy.style, { left: '0', top: '0', color: colour, mixBlendMode: dark() ? 'screen' : 'multiply', opacity: '0' });
        copy.querySelectorAll<HTMLElement>('.title-line').forEach(line => { line.style.color = colour; });
        logo.prepend(copy);
        return copy;
      });
      const jump = () => `${(Math.random() - .5) * .08}em`;
      const band = () => { const top = Math.random() * 80; return `inset(${top}% 0 ${Math.max(0, 100 - top - 8 - Math.random() * 18)}% 0)`; };
      // Split channels while the picture breaks up, nothing while the screen is dark, a last twitch as it returns.
      const torn = (index: number, from: number, to: number, count: number) => Array.from({ length: count }, (_, step) => ({
        at: from + (to - from) * step / count, opacity: .85, left: step % 3 ? jump() : `${index ? .02 : -.02}em`, clipPath: step % 2 ? band() : 'inset(0 0 0 0)', easing: 'steps(1, end)'
      }));
      channels.forEach((copy, index) => copy.animate(timeline(total, [
        ...torn(index, 0, 400, 4), { at: 400, opacity: 0, easing: 'steps(1, end)' }, ...torn(index, 520, off, 3), { at: off, opacity: 0, easing: 'steps(1, end)' },
        ...torn(index, on, on + 280, 3), { at: on + 280, opacity: 0 }, { at: total, opacity: 0 }
      ]), { duration: total }));
      logo.animate(timeline(total, [
        { at: 0, transform: 'none', opacity: 1, easing: 'steps(1, end)' }, { at: 180, transform: `translateX(${jump()}) skewX(-6deg)` }, { at: 260, transform: 'none' },
        { at: 520, transform: `translateX(${jump()})` }, { at: 600, transform: 'none', opacity: 1, easing: 'steps(1, end)' }, { at: off, transform: 'none', opacity: 0, easing: 'steps(1, end)' }, { at: on, opacity: 1, transform: `translateX(${jump()})` }, { at: on + 110, transform: 'none' }, { at: total, transform: 'none', opacity: 1 }
      ]), { duration: total });
      const screen = temp('span', 'logo-nosignal', '<span>NO SIGNAL</span>');
      const host = logo.parentElement!.getBoundingClientRect();
      Object.assign(screen.style, { left: `${box.left - host.left}px`, top: `${box.top - host.top}px`, width: `${box.width}px`, height: `${box.height}px`, fontSize: `${size * .14}px` });
      logo.parentElement!.append(screen);
      // The dark frame holds for a while, with the odd flutter of a weak signal.
      screen.animate(timeline(total, [
        { at: 0, opacity: 0, easing: 'steps(1, end)' }, { at: off, opacity: 1, easing: 'steps(1, end)' }, { at: off + 520, opacity: .82, easing: 'steps(1, end)' }, { at: off + 580, opacity: 1, easing: 'steps(1, end)' },
        { at: on - 260, opacity: .88, easing: 'steps(1, end)' }, { at: on - 220, opacity: 1, easing: 'steps(1, end)' }, { at: on, opacity: 0 }, { at: total, opacity: 0 }
      ]), { duration: total });
      return clock(total, () => { channels.forEach(copy => copy.remove()); screen.remove(); });
    },
    // Origami: the logo folds itself flat into a paper plane, which loops once around, glides back in,
    // slows to a stop and opens out into the logo again.
    origami: () => {
      const total = 3900, land = 2650, size = sizeOf(), box = logo.getBoundingClientRect(), w = box.width, h = box.height;
      const folded = 'perspective(900px) rotateX(-88deg) scaleX(.25)';
      logo.animate(timeline(total, [
        { at: 0, transform: 'none', opacity: 1, easing: 'ease-in' }, { at: 250, transform: 'perspective(900px) rotateX(-75deg)', easing: 'ease-in' },
        { at: 480, transform: folded, opacity: 1, easing: 'steps(1, end)' }, { at: 481, transform: folded, opacity: 0 },
        // Unfolding mirrors the fold: it opens from edge-on while the plane fades into it, then settles.
        { at: land - 60, transform: folded, opacity: 0, easing: 'ease-out' }, { at: land + 120, transform: 'perspective(900px) rotateX(-80deg) scaleX(.4)', opacity: 1, easing: 'cubic-bezier(.3, 0, .3, 1)' },
        { at: land + 620, transform: 'perspective(900px) rotateX(7deg) scaleX(1.01)', opacity: 1, easing: 'ease-in-out' }, { at: land + 900, transform: 'perspective(900px) rotateX(-2deg)', easing: 'ease-in-out' },
        { at: land + 1100, transform: 'none', opacity: 1 }, { at: total, transform: 'none', opacity: 1 }
      ]), { duration: total });
      const plane = temp('span', 'logo-plane', `<svg viewBox="0 0 60 30"><path d="M2 15 L58 3 L22 18Z" fill="#fbf8f1" stroke="#2a2a26" stroke-width="1.2" stroke-linejoin="round"/><path d="M22 18 L58 3 L28 27Z" fill="#e8e3d8" stroke="#2a2a26" stroke-width="1.2" stroke-linejoin="round"/><path d="M22 18 L24 24 L28 27" fill="none" stroke="#2a2a26" stroke-width="1"/></svg>`);
      plane.style.width = `${size * .5}px`;
      const host = logo.parentElement!, origin = host.getBoundingClientRect(), cx = box.left - origin.left + w / 2, cy = box.top - origin.top + h / 2;
      host.append(plane);
      // Out to the right, up and round over the top, down the left, and a level glide back into the middle.
      const route = `M ${point(cx, cy)} C ${point(cx + w * .6, cy - h * .1)}, ${point(cx + w * .8, cy - h * 1.2)}, ${point(cx, cy - h * 1.05)} S ${point(cx - w * .9, cy + h * .1)}, ${point(cx - w * .55, cy + h * .4)} S ${point(cx - w * .3, cy)}, ${point(cx, cy)}`;
      plane.style.offsetPath = `path('${route}')`;
      const flight = plane.animate(timeline(total, [
        { at: 0, offsetDistance: '0%', opacity: 0, scale: '.4' }, { at: 450, offsetDistance: '0%', opacity: 0, scale: '.4', easing: 'ease-out' }, { at: 600, offsetDistance: '1%', opacity: 1, scale: '1', easing: 'cubic-bezier(.4, 0, .2, 1)' },
        { at: land, offsetDistance: '100%', opacity: 1, scale: '1', easing: 'ease-in' }, { at: land + 420, offsetDistance: '100%', opacity: 0, scale: '1' }, { at: total, offsetDistance: '100%', opacity: 0, scale: '1' }
      ]), { duration: total });
      // Once it glides to a stop, its wings spread wide and thin as the letters take its place.
      plane.firstElementChild!.animate(timeline(total, [
        { at: 0, transform: 'none' }, { at: land, transform: 'none', easing: 'ease-in-out' }, { at: land + 220, transform: 'scale(1.8, .5)', easing: 'ease-out' },
        { at: land + 420, transform: 'scale(3.2, .15)' }, { at: total, transform: 'scale(3.2, .15)' }
      ]), { duration: total });
      return after(flight, () => plane.remove());
    },
    // The shared I waves hello.
    wave: () => after(stem.animate([
      { transform: 'none' }, { transform: 'rotate(9deg)', offset: .18 }, { transform: 'rotate(-7deg)', offset: .38 },
      { transform: 'rotate(6deg)', offset: .56 }, { transform: 'rotate(-3deg)', offset: .74 }, { transform: 'none' }
    ], { duration: 1100, easing: 'ease-in-out' }), lift(stem, '50% 92%')),
  };

  const labels: Record<string, string> = {
    backflip: 'Backflip', ripple: 'Ripple', swap: 'Swap and correct', wave: 'Wave', flicker: 'Failing light', glow: 'Alien glow',
    butterfly: 'Butterfly', topple: 'Topple', timeTravel: 'Time travel', magnet: 'Magnet', glitch: 'Glitch broadcast', origami: 'Origami'
  };
  let bag: string[] = [], last = '', playing: Animation | undefined;
  const nextTrick = () => {
    // Shuffled rounds, never the same trick twice in a row.
    if (!bag.length) bag = Object.keys(tricks).sort(() => Math.random() - .5);
    if (bag[0] === last && bag.length > 1) bag.push(bag.shift()!);
    return (last = bag.shift()!);
  };
  // Plays a trick. Asked for by name, it interrupts whatever is playing (finishing it cleanly first).
  const play = (name = nextTrick(), interrupt = false) => {
    if (!tricks[name]) return;
    if (playing) {
      if (!interrupt) return;
      const current = playing;
      logo.parentElement!.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity).forEach(animation => animation.finish());
      current.finished.catch(() => undefined).finally(() => setTimeout(() => play(name), 30));
      return;
    }
    logo.dataset.trick = name;
    playing = tricks[name]();
    playing.finished.catch(() => undefined).finally(() => { playing = undefined; delete logo.dataset.trick; });
  };
  document.addEventListener('logo-trick', event => play((event as CustomEvent<string>).detail, true));

  let lastActivity = performance.now(), notBefore = performance.now() + idleBefore;
  const active = () => { lastActivity = performance.now(); };
  // Secrets. Triple-click the logo to play the next trick. Type “ai” outside a text field to open a
  // small menu of every trick by name and play exactly the one you choose. Both restart the idle wait.
  const force = (name?: string) => {
    const box = logo.getBoundingClientRect(), visible = box.bottom > 0 && box.top < innerHeight;
    if (!visible) logo.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    setTimeout(() => play(name || nextTrick(), true), visible ? 0 : 450);
    notBefore = performance.now() + gap[0];
  };
  logo.addEventListener('click', event => { if (event.detail === 3) { getSelection()?.removeAllRanges(); force(); } });
  let picker: HTMLElement | undefined, returnFocus: HTMLElement | null = null;
  const closePicker = () => { picker?.remove(); picker = undefined; returnFocus?.focus?.({ preventScroll: true }); };
  const openPicker = () => {
    if (picker) { picker.querySelector('button')?.focus(); return; }
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    picker = document.createElement('div');
    picker.className = 'logo-picker';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', 'Logo tricks');
    picker.innerHTML = `<div class="logo-picker-head"><strong>Logo tricks</strong><button type="button" class="logo-picker-close" aria-label="Close">×</button></div><button type="button" class="logo-picker-surprise" data-pick="">Surprise me</button><ol>${Object.keys(tricks).map(name => `<li><button type="button" data-pick="${name}">${labels[name] ?? name}</button></li>`).join('')}</ol>`;
    document.body.append(picker);
    const buttons = [...picker.querySelectorAll<HTMLButtonElement>('[data-pick]')];
    buttons[0].focus();
    picker.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
      if (!button) return;
      if (button.matches('.logo-picker-close')) { closePicker(); return; }
      const name = button.dataset.pick ?? '';
      closePicker();
      force(name);
    });
    picker.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closePicker(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length].focus();
      }
    });
  };
  document.addEventListener('pointerdown', event => { if (picker && event.target instanceof Node && !picker.contains(event.target)) closePicker(); });
  let typed = '', typedAt = 0;
  addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable], dialog, .logo-picker'))) return;
    const now = performance.now();
    typed = (now - typedAt < 800 ? typed : '') + event.key.toLowerCase();
    typedAt = now;
    if (typed.endsWith('ai')) { typed = ''; openPicker(); }
  });
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(type => addEventListener(type, active, { passive: true }));
  addEventListener('scroll', active, { passive: true });
  setInterval(() => {
    const now = performance.now(), box = logo.getBoundingClientRect();
    if (document.hidden || reducedMotion.matches || playing || now - lastActivity < idleBefore || now < notBefore) return;
    if (box.bottom < 0 || box.top > innerHeight) return;
    // Wait for the arrival animation (or a replay after switching designs) to finish.
    if (logo.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')) return;
    play();
    notBefore = now + gap[0] + Math.random() * (gap[1] - gap[0]);
  }, 1000);
})();
