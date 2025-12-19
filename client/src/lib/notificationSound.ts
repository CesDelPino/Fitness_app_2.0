let audioContext: AudioContext | null = null;
let soundEnabled = true;

export function setNotificationSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn("[audio] Failed to create AudioContext:", e);
      return null;
    }
  }
  return audioContext;
}

export function playNotificationSound() {
  if (!soundEnabled) return;
  
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    oscillator.type = "sine";
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.warn("[audio] Failed to play notification sound:", e);
  }
}

export function playMessageSentSound() {
  if (!soundEnabled) return;
  
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
    oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.type = "sine";
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.warn("[audio] Failed to play message sent sound:", e);
  }
}
