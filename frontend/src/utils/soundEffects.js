export class SoundEffects {
  constructor() {
    this.audioCtx = null;
    this.resumePromise = null;
    this.reportedActivationFailures = new Set();
  }

  reportActivationFailure(error) {
    // Browser audio failures need no request/device details. Deduplicate a
    // persistent failure until audio recovers, while keeping new error types visible.
    const knownNames = ['NotAllowedError', 'NotSupportedError', 'InvalidStateError',
      'SecurityError', 'AbortError', 'TypeError', 'OperationError'];
    const reason = knownNames.includes(error?.name) ? error.name : 'AudioError';
    if (this.reportedActivationFailures.has(reason)) return;
    this.reportedActivationFailures.add(reason);
    console.warn(`Không thể bật âm thanh sau tương tác (${reason}).`);
  }

  // Only a trusted user gesture may create/resume audio. Message delivery and
  // async send callbacks must never attempt to unlock browser autoplay.
  listenForUserActivation(target = globalThis.window) {
    if (!target?.addEventListener) return () => {};

    const activate = (event) => {
      if (!event.isTrusted || target.navigator?.userActivation?.isActive === false) return;
      if (event.type === 'keydown' && (event.repeat ||
        ['Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return;

      try {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          const AudioContextClass = target.AudioContext || target.webkitAudioContext;
          if (!AudioContextClass) return;
          this.audioCtx = new AudioContextClass();
        }

        if (['suspended', 'interrupted'].includes(this.audioCtx.state) && !this.resumePromise) {
          this.resumePromise = Promise.resolve(this.audioCtx.resume())
            .then(() => {
              if (this.audioCtx?.state === 'running') this.reportedActivationFailures.clear();
            })
            .catch((error) => {
              this.reportActivationFailure(error);
            })
            .finally(() => {
              this.resumePromise = null;
            });
        } else if (this.audioCtx.state === 'running') {
          this.reportedActivationFailures.clear();
        }
      } catch (error) {
        this.reportActivationFailure(error);
      }
    };

    const events = ['pointerup', 'touchend', 'click', 'keydown'];
    for (const event of events) target.addEventListener(event, activate, { capture: true, passive: true });
    return () => {
      for (const event of events) target.removeEventListener(event, activate, true);
    };
  }

  getAudioContext() {
    // Drop sounds while locked/suspended; do not queue old notifications to
    // play in a burst after the user eventually interacts with the page.
    return this.audioCtx?.state === 'running' ? this.audioCtx : null;
  }

  // 1. ÂM THANH NHẬN TIN NHẮN (Chuông Marimba Chime 2 âm tầng nhẹ êm như Messenger/Telegram)
  playIncomingMessageSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Bộ lọc làm ấm âm thanh (Lowpass Filter loại bỏ dải tần gắt)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.connect(ctx.destination);

      // Node thứ nhất (Note E5 - 659.25Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(filter);
      osc1.start(now);
      osc1.stop(now + 0.36);

      // Node thứ hai (Note B5 - 987.77Hz, gõ trễ 0.09s tạo tiếng chuông kép Ting-Ting)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.09);

      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.setValueAtTime(0.001, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.28, now + 0.105);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      osc2.connect(gain2);
      gain2.connect(filter);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.56);

      // Hòa âm phụ nhẹ tạo độ dày chuông
      const oscSub = ctx.createOscillator();
      const gainSub = ctx.createGain();
      oscSub.type = 'sine';
      oscSub.frequency.setValueAtTime(1318.51, now + 0.09); // E6

      gainSub.gain.setValueAtTime(0.0001, now);
      gainSub.gain.setValueAtTime(0.001, now + 0.09);
      gainSub.gain.exponentialRampToValueAtTime(0.06, now + 0.105);
      gainSub.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      oscSub.connect(gainSub);
      gainSub.connect(filter);
      oscSub.start(now + 0.09);
      oscSub.stop(now + 0.32);

    } catch (e) {
      console.warn("Không thể phát âm thanh nhận tin:", e);
    }
  }

  // 2. ÂM THANH GỬI TIN NHẮN (Tiếng bục bong bóng Pop / Water Bubble chuẩn Messenger)
  playOutgoingMessageSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Bộ lọc cộng hưởng Bubble
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(2.5, now);
      filter.connect(ctx.destination);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Trượt nhanh tần số từ 950Hz xuống 280Hz trong 45ms tạo tiếng bục nảy nước
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.045);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(gain);
      gain.connect(filter);

      osc.start(now);
      osc.stop(now + 0.065);
    } catch (e) {
      console.warn("Không thể phát âm thanh gửi tin:", e);
    }
  }

  // 3. ÂM THANH REACTION (Tiếng Pop cao lướt nhẹ)
  playReactionSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1150, now + 0.04);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.085);
    } catch (e) {
      console.warn("Không thể phát âm thanh reaction:", e);
    }
  }
}

export const soundManager = new SoundEffects();
