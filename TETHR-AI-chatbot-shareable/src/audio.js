import { TETHR_CONFIG as C } from "../data/config.js";

const names = ["soundscape"];

export class AudioEngine {
  constructor() {
    this.master = C.audio.master;
    this.layers = {};
    this.enabled = true;
    this.initialized = false;
    this._target = {};
  }

  async init() {
    if (this.initialized) {
      // The user has already interacted with the page, so resuming playback is allowed.
      for (const name of names) {
        const media = this.layers[name];
        if (media && media.paused && this._target[name] > 0 && this.enabled) {
          await media.play().catch(() => {});
        }
      }
      return;
    }

    for (const name of names) {
      const path = C.audio.paths[name];
      const audio = new Audio(path);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
      this.layers[name] = audio;
    }

    this.initialized = true;
  }

  setMaster(value) {
    this.master = Math.max(0, Math.min(1, Number(value)));
    for (const name of names) {
      this._setLayerVolume(name, this._target[name] || 0);
    }
  }

  toggle() {
    this.enabled = !this.enabled;

    for (const name of names) {
      this._setLayerVolume(name, this._target[name] || 0);
    }

    return this.enabled;
  }

  playForLevel(level) {
    if (!this.initialized) return;

    const targets = C.audio.levelVolumes[level] || C.audio.levelVolumes[0];
    this._target = targets;

    for (const name of names) {
      this._setLayerVolume(name, targets[name] || 0);

      const media = this.layers[name];
      if (!media) continue;

      media.play().catch(() => {
        // Playback can still be blocked if the browser considers the
        // current action unrelated to the original user gesture.
      });
    }
  }

  stopAll() {
    for (const name of names) {
      const media = this.layers[name];
      if (media) {
        media.pause();
        media.currentTime = 0;
        media.volume = 0;
      }
    }
  }

  _setLayerVolume(name, value) {
    const media = this.layers[name];
    if (!media) return;

    const target = this.enabled ? value * this.master : 0;
    media.volume = Math.max(0, Math.min(1, target));
  }
}
