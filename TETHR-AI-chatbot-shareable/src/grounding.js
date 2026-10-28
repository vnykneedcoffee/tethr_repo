import { TETHR_CONFIG as C } from "../data/config.js";

export class Sequence {
  constructor(mount, steps, options = {}) {
    this.mount = mount;
    this.steps = steps;
    this.interval = options.interval || C.timings.level2GroundingStepMs;
    this.onDone = options.onDone;
    this.running = false;
    this.index = 0;
    this.timer = null;
    this.typingTimer = null;
  }

  start() {
    this.stop();
    this.running = true;
    this.index = 0;
    this.render();
    this.show(0);
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    clearTimeout(this.typingTimer);
  }

  render() {
    this.mount.innerHTML = `
      <div class="sequence">
        <div class="sequence-kicker">ONE THING AT A TIME</div>

        <div class="sequence-progress">
          <span></span>
        </div>

        <div
          class="sequence-text"
          aria-live="polite"
          aria-label="Grounding instruction"
        ></div>

        <button class="quiet-link sequence-skip" type="button">
          Skip
        </button>
      </div>
    `;

    this.mount.querySelector(".sequence-skip").onclick = () =>
      this.next(true);
  }

  show(index) {
    if (!this.running) return;

    this.index = index;

    const text = this.mount.querySelector(".sequence-text");
    const bar = this.mount.querySelector(".sequence-progress span");

    if (!text) return;

    clearTimeout(this.typingTimer);

    /* Fade the previous sentence away */
    text.classList.remove("visible");
    text.classList.remove("typing");

    setTimeout(() => {
      if (!this.running) return;

      const sentence = this.steps[index];

      /* Start empty */
      text.textContent = "";
      text.classList.add("visible");
      text.classList.add("typing");

      /*
       * Type the sentence gently, one character at a time.
       * Spaces are slightly faster so the animation feels natural.
       */
      let characterIndex = 0;

      const typeNextCharacter = () => {
        if (!this.running) return;

        if (characterIndex >= sentence.length) {
          text.classList.remove("typing");
          return;
        }

        text.textContent += sentence[characterIndex];
        characterIndex++;

        const character = sentence[characterIndex - 1];

        const delay =
          character === " "
            ? 18
            : character === ","
              ? 120
              : character === "."
                ? 180
                : 38;

        this.typingTimer = setTimeout(
          typeNextCharacter,
          delay
        );
      };

      typeNextCharacter();

      /* Progress bar */
      bar.style.width =
        `${((index + 1) / this.steps.length) * 100}%`;

    }, 180);

    /*
     * Give the sentence time to finish typing,
     * then move to the next instruction.
     */
    this.timer = setTimeout(() => {
      this.next();
    }, this.interval);
  }

  next(skipped = false) {
    clearTimeout(this.timer);
    clearTimeout(this.typingTimer);

    if (!this.running) return;

    if (this.index >= this.steps.length - 1) {
      this.running = false;
      this.onDone?.({ skipped });
      return;
    }

    this.show(this.index + 1);
  }
}