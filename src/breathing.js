import { TETHR_CONFIG as C } from "../data/config.js";

export class BreathingGuide {
  constructor(mount, onPhase) {
    this.mount = mount;
    this.onPhase = onPhase;
    this.running = false;
    this.timer = null;
    this.cycle = 0;
    this.phaseIndex = 0;
    this.phases = [
      ["inhale", "Breathe in with the spectrum.", C.breathing.inhale],
      ["hold", "Stay for a moment.", C.breathing.hold],
      ["exhale", "And slowly let go.", C.breathing.exhale],
      ["rest", "Just be here.", C.breathing.rest],
    ];
  }

  render() {
    this.mount.innerHTML = `
      <div class="breath-stage" aria-label="Breathing guidance">
        <div class="spectrum" data-phase="rest">
          <span class="spectrum-ring r1"></span>
          <span class="spectrum-ring r2"></span>
          <span class="spectrum-ring r3"></span>
          <span class="spectrum-core"></span>
        </div>
        <div class="breath-copy">
          <div class="breath-label" id="breathLabel">Just follow the rhythm.</div>
          <div class="breath-phase" id="breathPhase">—</div>
        </div>
      </div>
    `;
  }

  start() {
    this.stop();
    this.render();
    this.running = true;
    this.cycle = 0;
    this.phaseIndex = 0;
    this._next();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }

  _next() {
    if (!this.running) return;
    const [phase, text, seconds] = this.phases[this.phaseIndex];
    const spectrum = this.mount.querySelector(".spectrum");
    const label = this.mount.querySelector("#breathLabel");
    const phaseEl = this.mount.querySelector("#breathPhase");
    if (!spectrum) return;

    spectrum.dataset.phase = phase;
    label.textContent = this.cycle < C.breathing.guidanceCycles ? text : "Just follow the rhythm.";
    phaseEl.textContent = this.cycle < C.breathing.guidanceCycles ? phase : "·";

    this.onPhase?.(phase);
    this.timer = setTimeout(() => {
      this.phaseIndex++;
      if (this.phaseIndex >= this.phases.length) {
        this.phaseIndex = 0;
        this.cycle++;
      }
      this._next();
    }, seconds * 1000);
  }
}
