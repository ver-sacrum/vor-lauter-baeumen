/* ─────────────────────────────────────────────────────────────────────────────
   Vor lauter Bäumen — shared experience script
   Edit this file to change animation and audio behaviour across all pendants.
   Each pendant page sets SEED_STRING before loading this script.
───────────────────────────────────────────────────────────────────────────── */

// ── Colour palette ────────────────────────────────────────────────────────────
// Loaded from palette.json — edit that file to change colours across all pendants.
// Each seed deterministically picks one colour via hash modulo.

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

let PALETTE = [];
let SC_R = 200, SC_G = 200, SC_B = 180; // fallback neutral while loading

fetch('../../shared/palette.json')
  .then(r => r.json())
  .then(list => {
    PALETTE = list;
    const SEED_HASH  = hashString(SEED_STRING);
    const SEED_COLOR = PALETTE[SEED_HASH % PALETTE.length];
    [SC_R, SC_G, SC_B] = SEED_COLOR;
  })
  .catch(() => { console.warn('Could not load palette.json'); });

// ── Canvas ────────────────────────────────────────────────────────────────────

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

let W, H, cx, cy, mouse = { x: -9999, y: -9999, active: false };
let bodies = [];
let time = 0;
let glowX, glowY;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  cx = W / 2; cy = H / 2;
  if (!glowX) { glowX = cx; glowY = cy; }
}

// ── Particle ──────────────────────────────────────────────────────────────────

class Body {
  constructor() {
    const angle  = Math.random() * Math.PI * 2;
    const radius = 30 + Math.random() * 150;
    // Start particles further from their orbit origin so settling is visible on load
    const scatterFactor = 2.5;
    this.ox = cx + Math.cos(angle) * radius;
    this.oy = cy + Math.sin(angle) * radius;
    this.x  = cx + Math.cos(angle) * radius * scatterFactor;
    this.y  = cy + Math.sin(angle) * radius * scatterFactor;
    this.vx = 0;
    this.vy = 0;
    this.r  = Math.random() * 1.4 + 0.4;
    this.alpha = Math.random() * 0.6 + 0.25;
    this.orbitSpeed = (Math.random() - 0.5) * 0.0012;
    this.orbitAngle = angle;
    this.orbitR     = radius;
    this.phase      = Math.random() * Math.PI * 2;
    this.breatheAmp = Math.random() * 4 + 1;
    this.breatheSpd = Math.random() * 0.008 + 0.004;
    // Varied spring strength — 20% livelier, 80% very slow
    this.kSpring = Math.random() < 0.2 ? Math.random() * 0.004 + 0.003
                                        : Math.random() * 0.001 + 0.0003;
    // Mass — lighter particles get thrown further by cursor
    this.mass = Math.random() * 3 + 0.5;
  }

  update() {
    this.orbitAngle += this.orbitSpeed;
    const breathe = Math.sin(time * this.breatheSpd + this.phase) * this.breatheAmp;
    this.ox = cx + Math.cos(this.orbitAngle) * (this.orbitR + breathe);
    this.oy = cy + Math.sin(this.orbitAngle) * (this.orbitR + breathe);

    const dx = this.ox - this.x;
    const dy = this.oy - this.y;
    this.vx += dx * this.kSpring;
    this.vy += dy * this.kSpring;

    if (mouse.active) {
      const mx = mouse.x - this.x;
      const my = mouse.y - this.y;
      const dist = Math.sqrt(mx * mx + my * my);
      const repelRadius = 80;
      if (dist < repelRadius && dist > 0) {
        const force = (1 - dist / repelRadius) * 1.8 / this.mass;
        this.vx -= (mx / dist) * force;
        this.vy -= (my / dist) * force;
      }
    }

    this.vx *= 0.96;
    this.vy *= 0.96;
    this.x += this.vx;
    this.y += this.vy;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${SC_R}, ${SC_G}, ${SC_B}, ${this.alpha})`;
    ctx.fill();
  }
}

// ── Glow ──────────────────────────────────────────────────────────────────────

function drawCore() {
  const pulse = Math.sin(time * 0.012) * 0.06 + 0.22;
  const grad  = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 200);
  grad.addColorStop(0,   `rgba(${SC_R}, ${SC_G}, ${SC_B}, ${pulse})`);
  grad.addColorStop(0.4, `rgba(${Math.round(SC_R*0.65)}, ${Math.round(SC_G*0.65)}, ${Math.round(SC_B*0.65)}, ${pulse * 0.5})`);
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(glowX, glowY, 200, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

// ── Connection lines ──────────────────────────────────────────────────────────

function drawConnections() {
  const threshold = 80;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < threshold) {
        const alpha = (1 - d / threshold) * 0.04;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${SC_R},${SC_G},${SC_B},${alpha})`;
        ctx.lineWidth   = 0.3;
        ctx.stroke();
      }
    }
  }
}

// ── Animation loop ────────────────────────────────────────────────────────────

function loop() {
  time++;
  const targetX = mouse.active ? mouse.x : cx;
  const targetY = mouse.active ? mouse.y : cy;
  glowX += (targetX - glowX) * 0.03;
  glowY += (targetY - glowY) * 0.03;

  ctx.clearRect(0, 0, W, H);
  drawCore();
  drawConnections();
  bodies.forEach(b => { b.update(); b.draw(); });
  requestAnimationFrame(loop);
}

function init() {
  resize();
  bodies = Array.from({ length: 90 }, () => new Body());
  loop();
  // Wait for palette to load, then reveal — visitor sees particles still settling
  setTimeout(() => {
    document.getElementById('loading').classList.add('hidden');
  }, 2200);
  // Set seed ID label
  document.getElementById('seedId').textContent = SEED_STRING;
  document.title = SEED_STRING;
}

window.addEventListener('resize', () => {
  resize();
  bodies.forEach(b => {
    const angle = Math.random() * Math.PI * 2;
    b.orbitAngle = angle;
    b.ox = cx + Math.cos(angle) * b.orbitR;
    b.oy = cy + Math.sin(angle) * b.orbitR;
  });
});

// ── Input ─────────────────────────────────────────────────────────────────────

canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
});
canvas.addEventListener('mouseleave', () => { mouse.active = false; });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  mouse.x = e.touches[0].clientX;
  mouse.y = e.touches[0].clientY;
  mouse.active = true;
}, { passive: false });
canvas.addEventListener('touchend', () => { mouse.active = false; });

// ── Audio ─────────────────────────────────────────────────────────────────────
//
// How this works:
//   · sounds.json lists every file. Families are derived from the filenames:
//     "owlets_calling_loop_3.mp3" -> family "owlets_calling", loops = true.
//   · Each pendant draws a fixed subset of families (see config.json).
//     Families beginning with "rec_" are real field recordings; each pendant is
//     guaranteed at least one.
//   · The opening clip is the same for everyone tapping the same pendant in the
//     same time window. After that each visit follows its own path.
//   · Clips play for at least minPlaySeconds (looping if they are loops), then
//     crossfade into the next one.
//
// To change any of this, edit shared/config.json — not this file.

const CFG = {
  rotationMinutes:      20,
  familiesPerPendant:    7,
  recFamiliesPerPendant: 1,
  subsetRotationDays:    0,
  minPlaySeconds:       90,
  crossfadeSeconds:      3,
};

let SOUNDS   = [];   // every filename
let FAMILIES = [];   // { stem, loops, files[] }
let SUBSET   = [];   // this pendant's families
let JOURNEY  = [];   // order of families for this visit
let journeyPos = 0;
let audioReady = false;

// ── Seeded random, so subsets are stable per pendant ──────────────────────────

// Scatters a seed hash against a counter. Needed because the plain string hash
// is too linear — without it, some pendants would stay locked together.
function mixHash(seedHash, counter) {
  let h = (seedHash ^ Math.imul(counter, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Build families from filenames ─────────────────────────────────────────────

function buildFamilies(names) {
  const map = new Map();
  for (const name of names) {
    let stem = name.replace(/\.mp3$/i, '');
    stem = stem.replace(/_(\d+)$/, '');          // strip variant number
    const loops = /_loop$/.test(stem);
    stem = stem.replace(/_loop$/, '');
    const key = stem + (loops ? '|loop' : '');
    if (!map.has(key)) map.set(key, { stem, loops, files: [] });
    map.get(key).files.push(name);
  }
  return [...map.values()].sort((a, b) => a.stem.localeCompare(b.stem));
}

// ── Choose this pendant's subset ──────────────────────────────────────────────

function chooseSubset() {
  const seedHash = hashString(SEED_STRING);
  const epoch = CFG.subsetRotationDays > 0
    ? Math.floor(Date.now() / (CFG.subsetRotationDays * 86400000))
    : 0;
  const rand = mulberry32(mixHash(seedHash, epoch));

  const recs  = FAMILIES.filter(f => /^rec_/.test(f.stem));
  const rest  = FAMILIES.filter(f => !/^rec_/.test(f.stem));

  const wantRec = Math.min(CFG.recFamiliesPerPendant, recs.length);
  const picked  = shuffled(recs, rand).slice(0, wantRec);
  const wantRest = Math.max(0, CFG.familiesPerPendant - picked.length);
  picked.push(...shuffled(rest, rand).slice(0, wantRest));

  return picked;
}

// ── Opening clip: shared by everyone in the same time window ──────────────────

function openingFamily() {
  const windowMs = CFG.rotationMinutes * 60 * 1000;
  const windowIx = Math.floor(Date.now() / windowMs);
  const h = mixHash(hashString(SEED_STRING + '#open'), windowIx);
  return SUBSET[h % SUBSET.length];
}

function fileFrom(family) {
  return family.files[Math.floor(Math.random() * family.files.length)];
}

// ── Load config and sounds, then prepare ──────────────────────────────────────

Promise.all([
  fetch('../../shared/config.json').then(r => r.json()).catch(() => ({})),
  fetch('../../sounds/sounds.json').then(r => r.json()).catch(() => []),
]).then(([cfg, list]) => {
  for (const k of Object.keys(CFG)) {
    if (typeof cfg[k] === 'number' && cfg[k] >= 0) CFG[k] = cfg[k];
  }
  SOUNDS   = Array.isArray(list) ? list : [];
  if (!SOUNDS.length) return;

  FAMILIES = buildFamilies(SOUNDS);
  SUBSET   = chooseSubset();

  // This visit's path: the shared opening first, then the rest in a random
  // order that differs for every visitor.
  const opening = openingFamily();
  const others  = SUBSET.filter(f => f !== opening);
  JOURNEY = [opening, ...shuffled(others, Math.random)];
  journeyPos = 0;
  audioReady = true;
});

// ── Playback ──────────────────────────────────────────────────────────────────

let audioCtx   = null;
let activeNode = null;   // { source, gain }
let isPlaying  = false;
let nextTimer  = null;

const btn   = document.getElementById('soundBtn');
const ring  = document.getElementById('soundRing');
const label = document.getElementById('soundLabel');

const bufferCache = new Map();

async function loadBuffer(file) {
  if (bufferCache.has(file)) return bufferCache.get(file);
  const res = await fetch(`../../sounds/${file}`);
  const arr = await res.arrayBuffer();
  const buf = await audioCtx.decodeAudioData(arr);
  bufferCache.set(file, buf);
  return buf;
}

function nextFamily() {
  const f = JOURNEY[journeyPos % JOURNEY.length];
  journeyPos++;
  return f;
}

// Play one clip, then schedule the next with a crossfade.
async function playNext(isFirst) {
  const family = nextFamily();
  const file   = fileFrom(family);

  let buf;
  try { buf = await loadBuffer(file); }
  catch (e) { console.warn('Could not load', file, e); return stopAll(); }

  const fade = Math.min(CFG.crossfadeSeconds, buf.duration / 2);
  // Loops repeat until minPlaySeconds; one-shots play once.
  const passes = family.loops
    ? Math.max(1, Math.ceil(CFG.minPlaySeconds / buf.duration))
    : 1;
  const playFor = passes * buf.duration;

  const now  = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(isFirst ? 1 : 0, now);
  if (!isFirst) gain.gain.linearRampToValueAtTime(1, now + fade);

  const source = audioCtx.createBufferSource();
  source.buffer = buf;
  source.loop   = family.loops;
  source.connect(gain);
  source.start(now);
  source.stop(now + playFor + fade);

  // Fade the outgoing clip down as this one comes up.
  if (activeNode) {
    const g = activeNode.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
  }

  activeNode = { source, gain };

  // Schedule the handover slightly before this clip ends.
  clearTimeout(nextTimer);
  nextTimer = setTimeout(() => {
    if (isPlaying) playNext(false);
  }, Math.max(500, (playFor - fade) * 1000));
}

function stopAll() {
  clearTimeout(nextTimer);
  if (activeNode) {
    try { activeNode.source.stop(); } catch (e) {}
    activeNode = null;
  }
  isPlaying = false;
  ring.classList.remove('playing');
  label.textContent = 'Touch to hear';
}

async function toggleSound() {
  if (isPlaying) return stopAll();
  if (!audioReady) return;

  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  isPlaying = true;
  ring.classList.add('playing');
  label.textContent = '…';
  journeyPos = 0;
  await playNext(true);
  if (isPlaying) label.textContent = 'Playing';
}

btn.addEventListener('click', toggleSound);

init();
