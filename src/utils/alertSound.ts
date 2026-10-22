export type AdminAlertSound = 'classic' | 'ascending' | 'descending' | 'triple';

interface Tone {
  frequency: number;
  startOffset: number;
  duration: number;
}

function playToneSequence(tones: Tone[]) {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') void audioContext.resume();
    tones.forEach((tone, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const start = audioContext.currentTime + tone.startOffset;
      const end = start + tone.duration;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = tone.frequency;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.001, start);
      gainNode.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, end);
      if (index === tones.length - 1) oscillator.onended = () => { void audioContext.close(); };
      oscillator.start(start);
      oscillator.stop(end);
    });
  } catch {
    // Audio may be unavailable or blocked by the browser; the visual alert remains usable.
  }
}

// Conserva el pitido actual para las alertas automáticas del mercado.
export function playAlertSound(direction: 'up' | 'down') {
  playToneSequence([{ frequency: direction === 'up' ? 800 : 400, startOffset: 0, duration: 0.5 }]);
}

// Los patrones seleccionables solo se utilizan desde el panel de administración.
export function playAdminAlertSound(direction: 'up' | 'down', sound: AdminAlertSound) {
  if (sound === 'classic') {
    playAlertSound(direction);
  } else if (sound === 'ascending') {
    playToneSequence([
      { frequency: 560, startOffset: 0, duration: 0.18 },
      { frequency: 840, startOffset: 0.23, duration: 0.22 },
    ]);
  } else if (sound === 'descending') {
    playToneSequence([
      { frequency: 840, startOffset: 0, duration: 0.18 },
      { frequency: 560, startOffset: 0.23, duration: 0.22 },
    ]);
  } else {
    const frequency = direction === 'up' ? 800 : 400;
    playToneSequence([0, 0.2, 0.4].map((startOffset) => ({ frequency, startOffset, duration: 0.12 })));
  }
}
