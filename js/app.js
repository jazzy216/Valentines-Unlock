/* Valentine Unlock Game
   - Click/tap hearts to score points.
   - Reach GOAL_SCORE to unlock LOVE_MESSAGE.
*/

const LOVE_MESSAGE = "I LOVE YOU";
const DEFAULT_GOAL = 25;

const stage = document.getElementById("stage");
const ctx = stage.getContext("2d");

const scoreEl = document.getElementById("score");
const goalEl = document.getElementById("goal");
const streakEl = document.getElementById("streak");
const barFill = document.getElementById("barFill");
const progressText = document.getElementById("progressText");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const unlockBtn = document.getElementById("unlockBtn");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const overlayStart = document.getElementById("overlayStart");
const overlayHow = document.getElementById("overlayHow");
const howList = document.getElementById("howList");

const difficultySelect = document.getElementById("difficulty");
const soundToggle = document.getElementById("soundToggle");

const revealCard = document.getElementById("revealCard");
const loveMessageEl = document.getElementById("loveMessage");
const confettiBtn = document.getElementById("confettiBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

let running = false;
let paused = false;
let rafId = null;

let score = 0;
let goal = DEFAULT_GOAL;
let streak = 0;

let hearts = [];
let particles = [];

let lastTs = 0;
let spawnTimer = 0;

const settings = {
  easy:   { spawnPerSec: 1.4, speed: 70,  ttl: 2.8, radius: [16, 26] },
  normal: { spawnPerSec: 2.0, speed: 95,  ttl: 2.4, radius: [14, 24] },
  hard:   { spawnPerSec: 2.8, speed: 120, ttl: 2.0, radius: [12, 22] },
};
let mode = "easy";

// --- Sound (tiny WebAudio beeps; no assets needed)
let audioCtx = null;
function beep(freq = 660, duration = 0.06, gain = 0.05) {
  if (!soundToggle.checked) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + duration);
  } catch {}
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function rand(a,b){ return a + Math.random()*(b-a); }

function resizeCanvasToCSS() {
  // Keep crisp canvas by matching device pixels.
  const rect = stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (stage.width !== w || stage.height !== h) {
    stage.width = w;
    stage.height = h;
  }
}
window.addEventListener("resize", resizeCanvasToCSS);

// --- Game objects
function spawnHeart() {
  const cfg = settings[mode];
  const r = rand(cfg.radius[0], cfg.radius[1]);
  hearts.push({
    x: rand(r, stage.width - r),
    y: stage.height + r,
    r,
    vy: -rand(cfg.speed * 0.8, cfg.speed * 1.25),
    ttl: cfg.ttl,
    t: 0,
    wobble: rand(0.8, 1.6),
    phase: rand(0, Math.PI * 2),
    value: 1,
    hit: false,
  });
}

function heartPath(cx, cy, size) {
  // simple heart using curves
  const s = size;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.25);
  ctx.bezierCurveTo(cx + s, cy - s * 0.4, cx + s * 0.9, cy + s * 0.9, cx, cy + s);
  ctx.bezierCurveTo(cx - s * 0.9, cy + s * 0.9, cx - s, cy - s * 0.4, cx, cy + s * 0.25);
  ctx.closePath();
}

function popParticles(x,y, count=18) {
  for (let i=0;i<count;i++){
    const a = rand(0, Math.PI*2);
    const sp = rand(60, 220);
    particles.push({
      x, y,
      vx: Math.cos(a)*sp,
      vy: Math.sin(a)*sp,
      life: rand(0.25, 0.55),
      t: 0,
      size: rand(2, 5),
    });
  }
}

function drawBackground() {
  // subtle stars / dots
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.05)";
  for (let i=0;i<70;i++){
    const x = (i*97) % stage.width;
    const y = (i*53) % stage.height;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0,0,stage.width, stage.height);

  // gradient fog
  const g = ctx.createLinearGradient(0,0, stage.width, stage.height);
  g.addColorStop(0, "rgba(255,77,125,.12)");
  g.addColorStop(1, "rgba(124,77,255,.10)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,stage.width, stage.height);

  drawBackground();

  // hearts
  for (const h of hearts) {
    const alpha = clamp(1 - (h.t / h.ttl) * 0.9, 0, 1);
    const wob = Math.sin(h.t * h.wobble * 3 + h.phase) * 10;

    ctx.save();
    ctx.globalAlpha = alpha;

    // glow
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(255,77,125,.45)";
    ctx.fillStyle = "rgba(255,77,125,.85)";
    heartPath(h.x + wob, h.y, h.r);
    ctx.fill();

    // inner highlight
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = "rgba(255,255,255,.85)";
    heartPath(h.x + wob - h.r*0.22, h.y - h.r*0.18, h.r*0.75);
    ctx.fill();

    ctx.restore();
  }

  // particles
  ctx.save();
  for (const p of particles) {
    const a = clamp(1 - p.t / p.life, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.restore();

  // top hint
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.font = `${Math.round(stage.height*0.035)}px ui-sans-serif, system-ui`;
  ctx.fillText("Click / tap hearts to score", Math.round(stage.width*0.03), Math.round(stage.height*0.09));
  ctx.restore();
}

function update(dt) {
  if (paused) return;

  const cfg = settings[mode];

  // spawn
  spawnTimer += dt;
  const interval = 1 / cfg.spawnPerSec;
  while (spawnTimer >= interval) {
    spawnTimer -= interval;
    spawnHeart();
  }

  // hearts
  for (const h of hearts) {
    h.t += dt;
    h.y += h.vy * dt;
  }
  // remove expired / offscreen
  const before = hearts.length;
  hearts = hearts.filter(h => h.t < h.ttl && h.y > -h.r - 30 && !h.hit);
  const removed = before - hearts.length;
  if (removed > 0) {
    // missed hearts break streak
    streak = 0;
    streakEl.textContent = String(streak);
  }

  // particles
  for (const p of particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= (1 - dt*1.6);
    p.vy *= (1 - dt*1.6);
  }
  particles = particles.filter(p => p.t < p.life);

  // UI progress
  updateProgressUI();
}

function updateProgressUI() {
  scoreEl.textContent = String(score);
  goalEl.textContent = String(goal);
  streakEl.textContent = String(streak);

  const pct = clamp((score / goal) * 100, 0, 100);
  barFill.style.width = `${pct}%`;
  progressText.textContent = `${Math.round(pct)}%`;

  const unlocked = score >= goal;
  unlockBtn.disabled = !unlocked;
  if (unlocked) {
    overlayTitle.textContent = "Goal reached!";
    overlayText.textContent = "You can unlock the message now.";
  }
}

function loop(ts) {
  if (!running) return;
  if (!lastTs) lastTs = ts;
  const dt = clamp((ts - lastTs) / 1000, 0, 0.033);
  lastTs = ts;

  update(dt);
  draw();

  rafId = requestAnimationFrame(loop);
}

// --- Interaction (click/tap)
function getPointerPos(evt) {
  const rect = stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

  const x = (clientX - rect.left) * dpr;
  const y = (clientY - rect.top) * dpr;
  return { x, y };
}

function tryHit(x,y) {
  // find closest heart hit
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    const dx = x - h.x;
    const dy = y - h.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= h.r * 1.05) {
      h.hit = true;

      // scoring with streak bonus
      streak += 1;
      const bonus = streak >= 5 ? 1 : 0;
      score += (1 + bonus);

      popParticles(h.x, h.y, 22);
      beep(740 + streak * 10, 0.05, 0.045);

      if (score >= goal) {
        // small reward
        beep(880, 0.08, 0.06);
        showOverlay("Unlocked!", "Press “Unlock Message”.");
      }

      updateProgressUI();
      return;
    }
  }

  // miss: reduce streak slightly
  if (streak > 0) streak = Math.max(0, streak - 2);
  streakEl.textContent = String(streak);
}

stage.addEventListener("click", (e) => {
  if (!running || paused) return;
  const { x, y } = getPointerPos(e);
  tryHit(x,y);
});

stage.addEventListener("touchstart", (e) => {
  if (!running || paused) return;
  e.preventDefault();
  const { x, y } = getPointerPos(e);
  tryHit(x,y);
}, { passive:false });

// --- Overlay and buttons
function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.style.display = "grid";
}
function hideOverlay() {
  overlay.style.display = "none";
  howList.hidden = true;
  overlayHow.textContent = "How it works";
}

function startGame() {
  resizeCanvasToCSS();
  mode = difficultySelect.value;
  running = true;
  paused = false;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pauseBtn.textContent = "Pause";
  hideOverlay();
  lastTs = 0;
  rafId = requestAnimationFrame(loop);
}

function pauseGame() {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  if (paused) showOverlay("Paused", "Press Resume to continue.");
  else hideOverlay();
}

function resetGame() {
  running = false;
  paused = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  score = 0;
  streak = 0;
  goal = DEFAULT_GOAL;

  hearts = [];
  particles = [];
  spawnTimer = 0;
  lastTs = 0;

  startBtn.disabled = false;
  pauseBtn.disabled = true;

  unlockBtn.disabled = true;
  revealCard.hidden = true;

  showOverlay("Ready?", "Press Start. Click/tap hearts to score points.");
  updateProgressUI();
  draw();
}

function unlockMessage() {
  if (score < goal) return;
  loveMessageEl.textContent = LOVE_MESSAGE;
  revealCard.hidden = false;
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  confettiBurst();
}

// confetti (canvas particles overlay)
function confettiBurst() {
  // spawn particles across top
  const n = 220;
  for (let i=0;i<n;i++){
    const x = rand(0, stage.width);
    const y = rand(-40, 20);
    const sp = rand(120, 520);
    const a = rand(Math.PI*0.15, Math.PI*0.85);
    particles.push({
      x, y,
      vx: Math.cos(a)*sp,
      vy: Math.sin(a)*sp,
      life: rand(0.6, 1.1),
      t: 0,
      size: rand(2, 6),
    });
  }
  beep(520, 0.08, 0.05);
  beep(660, 0.08, 0.05);
  beep(820, 0.10, 0.05);
}

startBtn.addEventListener("click", startGame);
overlayStart.addEventListener("click", startGame);

pauseBtn.addEventListener("click", pauseGame);

resetBtn.addEventListener("click", resetGame);

unlockBtn.addEventListener("click", () => {
  hideOverlay();
  unlockMessage();
});

overlayHow.addEventListener("click", () => {
  const isHidden = howList.hidden;
  howList.hidden = !isHidden;
  overlayHow.textContent = isHidden ? "Hide help" : "How it works";
});

difficultySelect.addEventListener("change", () => {
  mode = difficultySelect.value;
  // keep it simple: apply to next start/reset
});

confettiBtn.addEventListener("click", () => {
  confettiBurst();
});

playAgainBtn.addEventListener("click", () => {
  resetGame();
});

// init
resetGame();
