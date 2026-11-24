// ── AudioContext singleton ────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    const Ctor =
      window.AudioContext ??
      (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  } catch { /* unsupported */ }
  return audioCtx;
}

// Unlock on first user interaction (browsers block audio until a gesture).
// Four event types cover desktop clicks, keyboard, mobile tap, and pointer devices.
(['click', 'keydown', 'touchstart', 'pointerdown'] as const).forEach((ev) => {
  document.addEventListener(ev, () => getCtx(), { once: true, passive: true });
});

// ── Sound synthesis ───────────────────────────────────────────────────────────

function ding(ctx: AudioContext) {
  const t = ctx.currentTime;

  const note = (freq: number, start: number, dur: number) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const s = t + start;
    gain.gain.setValueAtTime(0, s);
    gain.gain.linearRampToValueAtTime(0.25, s + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, s + dur);
    osc.start(s);
    osc.stop(s + dur);
  };

  // Two-tone C6 → A5 ding-dong
  note(1046, 0,    0.18);
  note(880,  0.16, 0.28);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Play the notification sound directly (import and call this anywhere). */
export function playNotificationSound() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => ding(ctx)).catch(() => {});
  } else {
    ding(ctx);
  }
}

// ── Global event bus ──────────────────────────────────────────────────────────
// Any module can trigger sound without importing this file:
//   window.dispatchEvent(new Event('workplace:notification'))

window.addEventListener('workplace:notification', () => playNotificationSound());
