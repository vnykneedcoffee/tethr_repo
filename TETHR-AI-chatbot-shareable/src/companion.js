import { SAFETY_PATTERNS, SCRIPTED_COMPANION } from "../data/content.js";

export class Companion {
  constructor(mount, { onSafety } = {}) {
    this.mount = mount;
    this.onSafety = onSafety;
    this.history = [];
    this.busy = false;
    this.controller = null;
  }

  mountUI() {
    this.mount.innerHTML = `
      <div class="companion">
        <div class="companion-head">
          <div>
            <div class="companion-kicker">A quiet conversation</div>
            <div class="companion-title">You can tell me what's happening.</div>
          </div>
          <button class="quiet-icon" type="button" aria-label="Close conversation">×</button>
        </div>
        <div class="chat-log" aria-live="polite"></div>
        <form class="chat-form">
          <input name="message" autocomplete="off" placeholder="Write whatever is here…" aria-label="Message Tethr" maxlength="500" />
          <button type="submit">Send</button>
        </form>
        <div class="companion-note">Tethr is not a therapist. Your conversation is not saved by this page.</div>
      </div>
    `;
    this.mount.querySelector(".quiet-icon").onclick = () => this.close();
    this.mount.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const input = e.currentTarget.elements.message;
      const text = input.value.trim();
      if (!text || this.busy) return;
      input.value = "";
      this.send(text);
    };
    this.say("I'm here. You can take this one thing at a time.");
  }

  close() {
    this.controller?.abort();
    this.mount.dispatchEvent(new CustomEvent("closecompanion"));
  }

  say(text) {
    const log = this.mount.querySelector(".chat-log");
    if (!log) return;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble tethr";
    bubble.textContent = text;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  user(text) {
    const log = this.mount.querySelector(".chat-log");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble user";
    bubble.textContent = text;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  setBusy(value) {
    this.busy = value;
    const form = this.mount.querySelector(".chat-form");
    const input = form?.elements.message;
    const button = form?.querySelector("button[type=submit]");
    if (input) input.disabled = value;
    if (button) {
      button.disabled = value;
      button.textContent = value ? "…" : "Send";
    }
  }

  scriptedReply(text) {
    const match = SCRIPTED_COMPANION.find(x => x.test.test(text));
    return match?.reply || "Let's stay with this moment.";
  }

  async send(text) {
    this.user(text);

    if (SAFETY_PATTERNS.some((rx) => rx.test(text))) {
      this.onSafety?.();
      return;
    }

    this.history.push({ role: "user", text });
    this.setBusy(true);
    this.controller = new AbortController();

    try {
      const response = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: 3, messages: this.history }),
        signal: this.controller.signal,
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload?.safety) {
          this.onSafety?.();
          return;
        }
        if (payload?.text) {
          this.history.push({ role: "model", text: payload.text });
          this.say(payload.text);
          return;
        }
      }

      // No configured provider or a provider error: keep Tethr usable.
      await new Promise(r => setTimeout(r, 450));
      const fallback = this.scriptedReply(text);
      this.history.push({ role: "model", text: fallback });
      this.say(fallback);
    } catch (error) {
      if (error?.name === "AbortError") return;
      await new Promise(r => setTimeout(r, 450));
      const fallback = this.scriptedReply(text);
      this.history.push({ role: "model", text: fallback });
      this.say(fallback);
    } finally {
      this.controller = null;
      this.setBusy(false);
    }
  }
}
