import { TETHR_CONFIG as C } from "../data/config.js";
import {
  LEVELS,
  LEVEL2_GROUNDING,
  LEVEL3_SEQUENCE,
  LEVEL3_ENVIRONMENT
} from "../data/content.js";
import { AudioEngine } from "./audio.js";
import { Mudrix } from "./mudrix.js";
import { BreathingGuide } from "./breathing.js";
import { Sequence } from "./grounding.js";
import { Companion } from "./companion.js";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const app = {
  level: null,
  timer: null,
  breathing: null,
  sequence: null,
  companion: null,
  audio: new AudioEngine(),
  mudrix: null
};

const root = document.documentElement;
const welcome = $("#welcome");
const world = $("#world");
const picker = $("#picker");
const experience = $("#experience");
const experienceInner = $("#experienceInner");
const modal = $("#modal");
const toast = $("#toast");

function ensureMudrixUI() {
  if (document.getElementById("mudrixFeedback")) return;

  const hud = document.createElement("div");

  hud.id = "mudrixFeedback";
  hud.className = "mudrix-feedback";

  hud.innerHTML = `
    <div class="mudrix-orb"></div>

    <div class="mudrix-feedback-copy">
      <span class="mudrix-feedback-kicker">MUDRIX</span>
      <span class="mudrix-feedback-main">
        Hand interaction ready
      </span>
      <span class="mudrix-feedback-sub">
        Move your right hand to shape the sound
      </span>
    </div>
  `;

  document.body.appendChild(hud);
}

function showMudrixFeedback(title, subtitle = "") {
  ensureMudrixUI();

  const hud = $("#mudrixFeedback");
  const main = $(".mudrix-feedback-main", hud);
  const sub = $(".mudrix-feedback-sub", hud);

  if (main) main.textContent = title;
  if (sub) sub.textContent = subtitle;

  hud.classList.add("is-visible", "pulse");

  clearTimeout(hud._hideTimer);

  hud._hideTimer = setTimeout(() => {
    hud.classList.remove("pulse");
  }, 900);
}

function updateMudrixVolume(value) {
  ensureMudrixUI();

  const hud = $("#mudrixFeedback");
  const main = $(".mudrix-feedback-main", hud);
  const sub = $(".mudrix-feedback-sub", hud);

  if (main) {
    main.textContent =
      `Volume ${Math.round(value * 100)}%`;
  }

  if (sub) {
    sub.textContent =
      "Pinch distance is shaping the sound";
  }

  hud.classList.add(
    "is-visible",
    "volume-mode"
  );

  clearTimeout(hud._hideTimer);

  hud._hideTimer = setTimeout(() => {
    hud.classList.remove("volume-mode");
  }, 700);
}

function icon(name) {
  const icons = {
    leaf:
      "M18 4C9 5 4 10 4 18c7 1 12-2 15-8 1-2 1-4-1-6ZM5 18c4-4 7-7 12-12",

    breath:
      "M3 9c5-4 9-4 14 0s9 4 14 0M3 17c5-4 9-4 14 0s9 4 14 0",

    spiral:
      "M27 6c-8-4-19 1-19 10 0 10 14 13 20 6 5-6-1-15-8-12-6 2-4 10 2 10 4 0 6-4 4-7",

    anchor:
      "M18 6v20M12 11h12M6 20c3 6 21 6 24 0M18 2a4 4 0 1 1 0 8a4 4 0 0 1 0-8Z"
  };

  return `
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <path d="${icons[name]}" />
    </svg>
  `;
}

function renderPicker() {
  $("#levelGrid").innerHTML = LEVELS.map(l => `
    <button
      class="level-card"
      data-level="${l.id}"
      type="button"
    >
      <span class="level-icon">
        ${icon(l.icon)}
      </span>

      <span class="level-number">
        LEVEL ${l.id}
      </span>

      <span class="level-title">
        ${l.name}
      </span>

      <span class="level-sub">
        ${l.short}
      </span>

      <span class="level-enter">
        Enter <span>↗</span>
      </span>
    </button>
  `).join("");

  $$(".level-card").forEach(card => {
    card.onclick = () =>
      enterLevel(
        Number(card.dataset.level)
      );
  });
}

function ensureTransitionVeil() {
  let veil =
    document.getElementById(
      "levelTransition"
    );

  if (!veil) {
    veil = document.createElement("div");

    veil.id = "levelTransition";
    veil.className =
      "level-transition";

    veil.innerHTML = `
      <div class="level-transition-glow"></div>

      <div class="level-transition-copy">
        <span class="level-transition-kicker">
          TETHR
        </span>

        <span class="level-transition-title"></span>
      </div>
    `;

    document.body.appendChild(veil);
  }

  return veil;
}

function transitionIn(level = null) {
  const veil =
    ensureTransitionVeil();

  const levelData =
    LEVELS.find(
      item => item.id === level
    );

  const title =
    $(".level-transition-title", veil);

  if (title) {
    title.textContent =
      levelData?.name ||
      "A quieter moment";
  }

  root.dataset.level =
    String(level ?? "");

  world.classList.remove(
    "is-settled"
  );

  world.classList.add(
    "is-changing"
  );

  veil.classList.remove(
    "is-leaving"
  );

  veil.classList.add(
    "is-visible"
  );

  picker.classList.add(
    "is-hidden"
  );

  experience.classList.remove(
    "is-hidden"
  );

  requestAnimationFrame(() => {
    experience.classList.add(
      "is-visible"
    );
  });

  clearTimeout(veil._timer);

  veil._timer = setTimeout(() => {

    veil.classList.add(
      "is-leaving"
    );

    world.classList.remove(
      "is-changing"
    );

    setTimeout(() => {
      veil.classList.remove(
        "is-visible",
        "is-leaving"
      );
    }, 850);

  }, 650);
}

function transitionOut() {
  const veil =
    ensureTransitionVeil();

  veil.classList.add(
    "is-visible"
  );

  experience.classList.remove(
    "is-visible"
  );

  world.classList.remove(
    "is-settled"
  );

  setTimeout(() => {

    experience.classList.add(
      "is-hidden"
    );

    picker.classList.remove(
      "is-hidden"
    );

    veil.classList.add(
      "is-leaving"
    );

    setTimeout(() => {
      veil.classList.remove(
        "is-visible",
        "is-leaving"
      );
    }, 700);

  }, 500);
}

async function enter() {

  $("#enterButton").disabled =
    true;

  try {
    if (!document.fullscreenElement) {
      await document
        .documentElement
        .requestFullscreen?.();
    }
  } catch {}

  await app.audio
    .init()
    .catch(() => {});

  app.mudrix =
    new Mudrix(app.audio);

  app.mudrix
    .start()
    .catch(error => {
      console.warn(
        "Mudrix could not start:",
        error
      );
    });

  app.audio.playForLevel(0);

  welcome.classList.add(
    "is-leaving"
  );

  setTimeout(() => {

    welcome.classList.add(
      "is-hidden"
    );

    world.classList.remove(
      "is-hidden"
    );

    requestAnimationFrame(() => {
      world.classList.add(
        "is-visible"
      );
    });

  }, 900);
}

function enterLevel(level) {

  clearTimeout(
    app.timer
  );

  app.breathing?.stop();
  app.sequence?.stop();

  app.level =
    level;

  app.audio.playForLevel(
    level
  );

  transitionIn(level);

  if (level === 0) level0();
  if (level === 1) level1();
  if (level === 2) level2();
  if (level === 3) level3();
}

function baseExit() {

  clearTimeout(
    app.timer
  );

  app.breathing?.stop();
  app.sequence?.stop();

  app.companion =
    null;
}

function level0() {

  experienceInner.innerHTML = `
    <div class="experience-copy passive">

      <div class="experience-kicker">
        LEVEL 0 · SOME PEACE
      </div>

      <h2>
        You don't have to do anything.
      </h2>

      <p>
        Let the place hold the next few minutes.
      </p>

      <button
        class="quiet-link"
        id="stayQuiet"
      >
        Stay here
      </button>

    </div>
  `;

  $("#stayQuiet").onclick = () =>
    toastMessage(
      "There's nowhere else you need to be."
    );

  app.timer = setTimeout(
    checkIn,
    C.timings.level0CheckInMs
  );
}

function level1() {

  experienceInner.innerHTML = `
    <div class="experience-copy breath-copy-shell">

      <div id="breathingMount"></div>

      <div class="level1-footer">
        <button
          class="quiet-link"
          id="talkOffer"
        >
          Would you like to talk?
        </button>
      </div>

    </div>
  `;

  app.breathing =
    new BreathingGuide(
      $("#breathingMount")
    );

  app.breathing.start();

  app.timer = setTimeout(() => {

    const b =
      $("#talkOffer");

    if (b) {
      b.classList.add(
        "is-revealed"
      );
    }

  }, C.timings.level1TalkOfferMs);

  $("#talkOffer").onclick = () =>
    toastMessage(
      "The conversation is available in Level 3."
    );
}

function level2() {

  experienceInner.innerHTML = `
    <div class="experience-copy thought-copy">

      <div class="experience-kicker">
        LEVEL 2 · MAKE SOME SPACE
      </div>

      <h2>
        Is there something taking up too much space?
      </h2>

      <p>
        Write it down. You don't have to explain it.
      </p>

      <div class="thought-box">

        <textarea
          id="thought"
          maxlength="500"
          placeholder="Let it be here for a moment…"
          aria-label="Something taking up too much space"
        ></textarea>

        <div class="thought-meta">
          <span>
            Nothing is saved.
          </span>

          <span id="thoughtCount">
            0 / 500
          </span>
        </div>

      </div>

      <button
        class="primary-button"
        id="leaveThought"
      >
        Leave it here
      </button>

    </div>
  `;

  const textarea =
    $("#thought");

  textarea.oninput = () => {

    $("#thoughtCount")
      .textContent =
      `${textarea.value.length} / 500`;

  };

  $("#leaveThought").onclick =
    leaveThought;

  textarea.focus({
    preventScroll: true
  });
}

function leaveThought() {

  const value =
    $("#thought")
      .value
      .trim();

  if (!value) {

    toastMessage(
      "You can leave it blank. There's nothing you have to explain."
    );

    return;
  }

  const note =
    document.createElement(
      "div"
    );

  note.className =
    "thought-particle";

  note.textContent =
    value;

  document.body.appendChild(
    note
  );

  setTimeout(
    () => note.remove(),
    5400
  );

  experienceInner.innerHTML = `
    <div class="experience-copy completion">

      <div class="completion-mark">
        ${icon("leaf")}
      </div>

      <h2>
        You don't have to carry that
        for the next few minutes.
      </h2>

      <p>
        Take a breath. Let yourself be here.
      </p>

      <button
        class="primary-button"
        id="groundMe"
      >
        Ground me
      </button>

    </div>
  `;

  $("#groundMe").onclick =
    () => runSequence(
      LEVEL2_GROUNDING,
      C.timings.level2GroundingStepMs,
      () => {

        showChoice(
          "What would feel most helpful for the next 60 seconds?",
          [
            [
              "Breathe",
              () => enterLevel(1)
            ],

            [
              "Ground me",
              () =>
                runSequence(
                  LEVEL2_GROUNDING,
                  C.timings.level2GroundingStepMs
                )
            ],

            [
              "Give me a moment",
              () => showMoment()
            ]
          ]
        );

      }
    );
}

function level3() {

  experienceInner.innerHTML = `
    <div class="experience-copy overwhelm">
      <div id="level3Sequence"></div>
    </div>
  `;

  runSequence(
    LEVEL3_SEQUENCE,
    C.timings.level3GroundingStepMs,
    () => {

      runSequence(
        LEVEL3_ENVIRONMENT,
        C.timings.level3GroundingStepMs,
        () => {

          world.classList.add(
            "is-settled"
          );

          experienceInner.innerHTML = `
            <div class="experience-copy completion settled-completion">

              <div class="completion-mark">
                ${icon("leaf")}
              </div>

              <div class="experience-kicker">
                JUST FOR THIS MOMENT
              </div>

              <h2>
                You're here.
              </h2>

              <p>
                Nothing else needs to be solved
                in the next few seconds.
              </p>

              <div class="settled-breath">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div class="minimal-actions">

                <button
                  class="primary-button"
                  id="companion"
                >
                  If you want to tell me what's happening
                </button>

                <button
                  class="quiet-link"
                  id="stay"
                >
                  Stay with the place
                </button>

              </div>

            </div>
          `;

          if (app.audio.enabled) {

            const settledVolume =
              app.audio.master;

            app.audio.setMaster(
              Math.max(
                0.12,
                settledVolume * 0.72
              )
            );

            clearTimeout(
              app._restoreAmbientTimer
            );

            app._restoreAmbientTimer =
              setTimeout(() => {

                if (app.audio.enabled) {
                  app.audio.setMaster(
                    settledVolume
                  );
                }

              }, 7000);
          }

          $("#companion").onclick =
            openCompanion;

          $("#stay").onclick = () => {

            world.classList.remove(
              "is-settled"
            );

            toastMessage(
              "Stay as long as you need."
            );
          };

        }
      );

    }
  );
}

function runSequence(
  steps,
  interval,
  done
) {

  app.sequence?.stop();

  const mount =
    $("#level3Sequence") ||
    experienceInner;

  app.sequence =
    new Sequence(
      mount,
      steps,
      {
        interval,
        onDone: done
      }
    );

  app.sequence.start();
}

function showMoment() {

  experienceInner.innerHTML = `
    <div class="experience-copy passive">

      <div class="experience-kicker">
        A MOMENT
      </div>

      <h2>
        Nothing to do.
      </h2>

      <p>
        Let your eyes rest on the horizon.
      </p>

      <button
        class="quiet-link"
        id="backToSpace"
      >
        I'm ready for a little guidance
      </button>

    </div>
  `;

  $("#backToSpace").onclick =
    () => enterLevel(2);
}

function checkIn() {

  experienceInner.innerHTML = `
    <div class="experience-copy checkin">

      <div class="experience-kicker">
        A LITTLE CHECK-IN
      </div>

      <h2>
        Are you feeling better?
      </h2>

      <div class="choice-row">

        <button
          class="primary-button"
          id="yes"
        >
          Yes
        </button>

        <button
          class="secondary-button"
          id="notYet"
        >
          Not yet
        </button>

      </div>

    </div>
  `;

  $("#yes").onclick = () => {

    experienceInner.innerHTML = `
      <div class="experience-copy completion">

        <div class="completion-mark">
          ${icon("leaf")}
        </div>

        <h2>
          Glad you're feeling better.
        </h2>

        <p>
          You can stay here as long as you want.
        </p>

        <button
          class="quiet-link"
          id="returnQuiet"
        >
          Return to the quiet
        </button>

      </div>
    `;

    $("#returnQuiet").onclick =
      () =>
        toastMessage(
          "You can simply stay."
        );
  };

  $("#notYet").onclick =
    () => returnToPicker();
}

function openCompanion() {

  baseExit();

  experienceInner.innerHTML =
    `<div class="companion-mount" id="companionMount"></div>`;

  app.companion =
    new Companion(
      $("#companionMount"),
      {
        onSafety: safety
      }
    );

  app.companion.mountUI();

  $("#companionMount")
    .addEventListener(
      "closecompanion",
      () => level1()
    );
}

function safety() {

  experienceInner.innerHTML = `
    <div class="experience-copy safety">

      <div class="experience-kicker">
        PLEASE PAUSE HERE
      </div>

      <h2>
        You deserve human support right now.
      </h2>

      <p>
        If you may be in immediate danger or might act
        on thoughts of harming yourself, please contact
        local emergency services or a crisis service in
        your area, or reach a trusted person who can stay
        with you.
      </p>

      <div class="minimal-actions">

        <button
          class="primary-button"
          id="stayGrounded"
        >
          Stay here for a moment
        </button>

        <button
          class="secondary-button"
          id="goBack"
        >
          Return to Tethr
        </button>

      </div>

    </div>
  `;

  $("#stayGrounded").onclick =
    () => {

      experienceInner.innerHTML = `
        <div class="experience-copy passive">

          <h2>
            You're here.
          </h2>

          <p>
            Put both feet on the ground.
            Feel the surface beneath you.
          </p>

        </div>
      `;

    };

  $("#goBack").onclick =
    () => returnToPicker();
}

function returnToPicker() {

  world.classList.remove(
    "is-settled",
    "is-changing"
  );

  baseExit();

  app.audio.playForLevel(0);

  transitionOut();
}

function toastMessage(message) {

  toast.textContent =
    message;

  toast.classList.add(
    "is-visible"
  );

  clearTimeout(
    toast._timer
  );

  toast._timer =
    setTimeout(() => {

      toast.classList.remove(
        "is-visible"
      );

    }, 3200);
}

function showChoice(
  title,
  choices
) {

  experienceInner.innerHTML = `
    <div class="experience-copy small-choice">

      <div class="experience-kicker">
        ONE THING
      </div>

      <h2>
        ${title}
      </h2>

      <div
        class="choice-row"
        id="dynamicChoices"
      ></div>

    </div>
  `;

  choices.forEach(
    ([label, fn], i) => {

      const b =
        document.createElement(
          "button"
        );

      b.className =
        i === 0
          ? "primary-button"
          : "secondary-button";

      b.textContent =
        label;

      b.onclick =
        fn;

      $("#dynamicChoices")
        .appendChild(b);

    }
  );
}

function showModal(kind) {

  const content =
    kind === "about"

      ? `
        <div class="modal-kicker">
          ABOUT TETHR
        </div>

        <h2>
          The world is loud.<br>
          You don't have to be.
        </h2>

        <p>
          Tethr is a calm digital space designed to help
          someone become more grounded when the outside
          world feels like too much.
        </p>

        <p>
          It does not diagnose, cure anxiety, replace therapy,
          or replace friends, family, or professional support.
          It is simply a place to pause and get your footing back.
        </p>

        <p class="modal-note">
          Nothing you write in the thought space is sent anywhere.
          The built-in companion is scripted unless a separate
          server-side AI provider is connected.
        </p>
      `

      : `
        <div class="modal-kicker">
          QUIET SETTINGS
        </div>

        <h2>
          Less is more.
        </h2>

        <div class="settings-row">
          <span>
            Soundscape
          </span>

          <button
            class="setting-toggle"
            id="modalSound"
          >
            ${app.audio.enabled ? "On" : "Off"}
          </button>
        </div>

        <label class="setting-row">

          <span>
            Volume
          </span>

          <input
            id="modalVolume"
            type="range"
            min="0"
            max="1"
            step=".01"
            value="${app.audio.master}"
          >

        </label>

        <div class="settings-row">

          <span>
            Fullscreen
          </span>

          <button
            class="setting-toggle"
            id="modalFullscreen"
          >
            ${
              document.fullscreenElement
                ? "On"
                : "Enter"
            }
          </button>

        </div>

        <p class="modal-note">
          Audio paths, breathing cadence, level copy,
          timing, and intervention steps are configured
          outside the UI so they can change without
          rewriting the experience.
        </p>

        <button
          class="secondary-button full"
          id="resetExperience"
        >
          Reset experience
        </button>
      `;

  modal.innerHTML = `
    <div class="modal-card">

      <button
        class="modal-close"
        aria-label="Close"
      >
        ×
      </button>

      ${content}

    </div>
  `;

  modal.classList.add(
    "is-visible"
  );

  $(".modal-close", modal)
    .onclick =
    closeModal;

  if (kind === "settings") {

    $("#modalSound").onclick =
      () => {

        const on =
          app.audio.toggle();

        $("#modalSound")
          .textContent =
          on
            ? "On"
            : "Off";

        updateSoundButton();
      };

    $("#modalVolume").oninput =
      e =>
        app.audio.setMaster(
          e.target.value
        );

    $("#modalFullscreen").onclick =
      async () => {

        try {

          if (
            !document.fullscreenElement
          ) {

            await document
              .documentElement
              .requestFullscreen();

          } else {

            await document
              .exitFullscreen();

          }

        } catch {}

        $("#modalFullscreen")
          .textContent =
          document.fullscreenElement
            ? "On"
            : "Enter";
      };

    $("#resetExperience").onclick =
      () =>
        location.reload();
  }
}

function closeModal() {

  modal.classList.remove(
    "is-visible"
  );

  setTimeout(() => {

    modal.innerHTML =
      "";

  }, 250);
}

function updateSoundButton() {

  $("#soundButton")
    .classList.toggle(
      "is-muted",
      !app.audio.enabled
    );

  $("#soundButton .sound-label")
    .textContent =
    app.audio.enabled
      ? "Soundscape"
      : "Muted";
}

renderPicker();

$("#enterButton").onclick =
  enter;

$("#soundButton").onclick =
  () => {

    app.audio.toggle();

    updateSoundButton();
  };

$("#volume").oninput =
  e =>
    app.audio.setMaster(
      e.target.value
    );

$("#aboutButton").onclick =
  () =>
    showModal("about");

$("#settingsButton").onclick =
  () =>
    showModal("settings");

$("#breakButton").onclick =
  () =>
    returnToPicker();

document.addEventListener(
  "keydown",
  e => {

    if (
      e.key === "Escape" &&
      modal.classList.contains(
        "is-visible"
      )
    ) {
      closeModal();
    }

  }
);

window.addEventListener(
  "mousemove",
  e => {

    const x =
      (e.clientX / innerWidth - .5) * 2;

    const y =
      (e.clientY / innerHeight - .5) * 2;

    root.style.setProperty(
      "--px",
      `${x * 7}px`
    );

    root.style.setProperty(
      "--py",
      `${y * 5}px`
    );

  }
);

window.addEventListener(
  "resize",
  () => {

    root.style.setProperty(
      "--vh",
      `${innerHeight * .01}px`
    );

  }
);

root.style.setProperty(
  "--vh",
  `${innerHeight * .01}px`
);


/* ============================================================
   MUDRIX GESTURE CONTROLS
   ============================================================

   👍 THUMBS UP
      → HOME SCREEN

   👎 THUMBS DOWN
      → NEXT LEVEL

   👎 ON LEVEL 3
      → NOTHING

   ============================================================ */

let mudrixNavigationLocked = false;

window.addEventListener(
  "mudrix-gesture",
  event => {

    const gesture =
      event.detail?.gesture;

    if (!gesture) {
      return;
    }

    /*
     * Prevent the same physical gesture from
     * causing multiple navigation events.
     */
    if (mudrixNavigationLocked) {
      return;
    }

    // ========================================================
    // 👍 THUMBS UP → HOME
    // ========================================================

    if (
      gesture === "THUMBS_UP"
    ) {

      mudrixNavigationLocked =
        true;

      showMudrixFeedback(
        "Thumbs up",
        "Returning to the quiet space"
      );

      document.body.classList.add(
        "mudrix-gesture-up"
      );

      setTimeout(() => {

        returnToPicker();

      }, 650);

      setTimeout(() => {

        mudrixNavigationLocked =
          false;

        document.body.classList.remove(
          "mudrix-gesture-up"
        );

      }, 1300);

      return;
    }

    // ========================================================
    // 👎 THUMBS DOWN → NEXT LEVEL
    // ========================================================

    if (
      gesture === "THUMBS_DOWN"
    ) {

      /*
       * LEVEL 3 IS THE END.
       * Do NOT navigate anywhere.
       */

      if (
        app.level >= 3
      ) {

        showMudrixFeedback(
          "You're here",
          "There's nowhere else to go"
        );

        document.body.classList.add(
          "mudrix-gesture-down"
        );

        setTimeout(() => {

          document.body.classList.remove(
            "mudrix-gesture-down"
          );

        }, 900);

        return;
      }

      mudrixNavigationLocked =
        true;

      const nextLevel =
        Math.min(
          3,
          Number(app.level) + 1
        );

      showMudrixFeedback(
        "Keep going",
        `Moving to Level ${nextLevel}`
      );

      document.body.classList.add(
        "mudrix-gesture-down"
      );

      setTimeout(() => {

        enterLevel(
          nextLevel
        );

      }, 650);

      setTimeout(() => {

        mudrixNavigationLocked =
          false;

        document.body.classList.remove(
          "mudrix-gesture-down"
        );

      }, 1400);
    }

  }
);


/* ============================================================
   MUDRIX VOLUME
   ============================================================ */

window.addEventListener(
  "mudrix-volume",
  event => {

    updateMudrixVolume(
      Number(
        event.detail?.volume ?? 0
      )
    );

  }
);