/* ─────────────────────────────────────────────────────────────────────────────
   Vor lauter Bäumen — shared experience script
   Edit this file to change animation and audio behaviour across all pendants.
   Each pendant page sets SEED_STRING before loading this script.
───────────────────────────────────────────────────────────────────────────── */

// ── Colour palette ────────────────────────────────────────────────────────────
// 48 colours across wide hue range — some muted, some vivid.
// Each seed deterministically picks one via hash modulo.

const PALETTE = [
  [187,74,74],  [190,163,119],[187,228,51], [124,173,116],[127,179,151],[97,193,202],
  [92,134,232], [100,60,188], [205,22,218], [189,111,146],[244,81,49],  [236,198,58],
  [181,244,87], [48,187,50],  [87,152,128], [102,146,161],[74,91,198],  [169,147,193],
  [196,53,182], [229,45,97],  [242,116,53], [219,213,102],[130,161,106],[148,192,156],
  [70,236,203], [70,154,213], [121,119,176],[176,139,196],[214,133,192],[173,62,75],
  [192,161,130],[179,192,83], [138,243,100],[83,231,135], [61,200,195], [86,131,194],
  [132,109,223],[150,86,164], [246,19,147], [194,60,53],  [242,187,79], [157,188,79],
  [139,201,132],[22,214,121], [7,202,232],  [115,137,204],[119,55,230], [209,121,211],
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

const SEED_HASH  = hashString(SEED_STRING);
const SEED_COLOR = PALETTE[SEED_HASH % PALETTE.length];
const [SC_R, SC_G, SC_B] = SEED_COLOR;

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
    this.ox = cx + Math.cos(angle) * radius;
    this.oy = cy + Math.sin(angle) * radius;
    this.x  = this.ox;
    this.y  = this.oy;
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
  setTimeout(() => {
    document.getElementById('loading').classList.add('hidden');
  }, 600);
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
// sounds.json lives two levels up in /sounds/
// Add new sound files there without touching this script.

let SOUNDS = [];
fetch('../../sounds/sounds.json')
  .then(r => r.json())
  .then(list => { SOUNDS = list; })
  .catch(() => { console.warn('Could not load sounds.json'); });

let audioCtx = null;
let currentSource = null;
let isPlaying = false;

const btn   = document.getElementById('soundBtn');
const ring  = document.getElementById('soundRing');
const label = document.getElementById('soundLabel');

async function playRandomSound() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  if (isPlaying && currentSource) {
    currentSource.stop();
    isPlaying = false;
    ring.classList.remove('playing');
    label.textContent = 'Touch to hear';
    return;
  }

  if (SOUNDS.length === 0) { label.textContent = 'Touch to hear'; return; }

  label.textContent = '…';
  const file = SOUNDS[Math.floor(Math.random() * SOUNDS.length)];
  const url  = `../../sounds/${file}`;

  try {
    const res     = await fetch(url);
    const buffer  = await res.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(buffer);

    currentSource        = audioCtx.createBufferSource();
    currentSource.buffer = decoded;
    currentSource.loop   = true;
    currentSource.connect(audioCtx.destination);
    currentSource.start();
    isPlaying = true;
    ring.classList.add('playing');
    label.textContent = 'Playing';

    currentSource.onended = () => {
      isPlaying = false;
      ring.classList.remove('playing');
      label.textContent = 'Touch to hear';
    };
  } catch(e) {
    console.warn('Sound not available:', e);
    label.textContent = 'Touch to hear';
  }
}

btn.addEventListener('click', playRandomSound);

init();
