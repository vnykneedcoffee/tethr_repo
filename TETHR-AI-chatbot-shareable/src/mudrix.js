import {
  FilesetResolver,
  HandLandmarker
} from "../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";

export class Mudrix {

  constructor(audio) {

    this.audio =
      audio;

    this.handLandmarker =
      null;

    this.video =
      null;

    this.stream =
      null;

    this.lastVideoTime =
      -1;


    // ========================================================
    // RIGHT HAND — VOLUME
    // ========================================================

    this.previousGap =
      null;

    this.GAP_SENSITIVITY =
      0.25;

    this.MIN_GAP_CHANGE =
      0.012;

    this.GAP_SMOOTHING =
      0.12;

    this.VOLUME_SMOOTHING =
      0.08;

    this.smoothedGap =
      null;

    this.targetVolume =
      audio.master;

    this.smoothedVolume =
      audio.master;


    // ========================================================
    // LEFT HAND — THUMBS
    // ========================================================

    this.lastThumbGesture =
      null;

    this.lastThumbGestureTime =
      0;

    this.THUMB_COOLDOWN =
      1200;


    // ========================================================
    // VISUAL FEEDBACK
    // ========================================================

    this.rightHandActive =
      false;

    this.leftHandActive =
      false;

    this.lastFeedbackVolume =
      0;

    this.volumeFeedbackInterval =
      80;
  }


  // ==========================================================
  // START
  // ==========================================================

  async start() {

    this.video =
      document.getElementById(
        "mudrixCamera"
      );

    if (!this.video) {

      throw new Error(
        "Mudrix camera element not found."
      );
    }


    // ========================================================
    // CAMERA
    // ========================================================

    this.stream =
      await navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: "user",
            width: {
              ideal: 640
            },
            height: {
              ideal: 480
            }
          },

          audio: false
        });


    this.video.srcObject =
      this.stream;

    await this.video.play();


    // ========================================================
    // MEDIAPIPE
    // ========================================================

    const vision =
      await FilesetResolver
        .forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
        );


    this.handLandmarker =
      await HandLandmarker
        .createFromOptions(
          vision,
          {
            baseOptions: {

              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
            },

            runningMode:
              "VIDEO",

            numHands:
              2,

            minHandDetectionConfidence:
              0.7,

            minHandPresenceConfidence:
              0.7,

            minTrackingConfidence:
              0.7
          }
        );


    this.detectHands();
  }


  // ==========================================================
  // DETECTION LOOP
  // ==========================================================

  detectHands() {

    if (
      !this.handLandmarker ||
      !this.video
    ) {
      return;
    }


    if (
      this.video.readyState >= 2 &&
      this.video.currentTime !==
        this.lastVideoTime
    ) {

      this.lastVideoTime =
        this.video.currentTime;


      const results =
        this.handLandmarker
          .detectForVideo(
            this.video,
            performance.now()
          );


      if (
        results.landmarks &&
        results.handedness
      ) {

        let rightHandFound =
          false;

        let leftHandFound =
          false;


        for (
          let i = 0;
          i < results.landmarks.length;
          i++
        ) {

          const handedness =
            results.handedness[i][0]
              .categoryName;


          if (
            handedness ===
            "Right"
          ) {

            rightHandFound =
              true;
          }


          if (
            handedness ===
            "Left"
          ) {

            leftHandFound =
              true;
          }


          this.processHand(
            results.landmarks[i],
            handedness
          );
        }


        // ====================================================
        // RIGHT HAND LOST
        // ====================================================

        if (!rightHandFound) {

          this.resetVolumeTracking();

          if (
            this.rightHandActive
          ) {

            this.rightHandActive =
              false;

            document.body
              .classList.remove(
                "mudrix-right-active"
              );

            this.emitVolume(
              this.smoothedVolume,
              false
            );
          }
        }


        // ====================================================
        // LEFT HAND LOST
        // ====================================================

        if (!leftHandFound) {

          this.lastThumbGesture =
            null;

          if (
            this.leftHandActive
          ) {

            this.leftHandActive =
              false;

            document.body
              .classList.remove(
                "mudrix-left-active"
              );
          }
        }

      } else {

        this.resetVolumeTracking();

        this.lastThumbGesture =
          null;

        this.rightHandActive =
          false;

        this.leftHandActive =
          false;

        document.body
          .classList.remove(
            "mudrix-right-active",
            "mudrix-left-active"
          );
      }
    }


    requestAnimationFrame(
      () =>
        this.detectHands()
    );
  }


  // ==========================================================
  // PROCESS HAND
  // ==========================================================

  processHand(
    landmarks,
    handedness
  ) {

    if (
      handedness ===
      "Right"
    ) {

      this.processRightHand(
        landmarks
      );
    }


    if (
      handedness ===
      "Left"
    ) {

      this.processLeftHand(
        landmarks
      );
    }
  }


  // ==========================================================
  // RIGHT HAND — VOLUME
  // ==========================================================

  processRightHand(
    landmarks
  ) {

    const wrist =
      landmarks[0];

    const thumbTip =
      landmarks[4];

    const indexTip =
      landmarks[8];

    const middleMcp =
      landmarks[9];


    const palmSize =
      Math.hypot(
        wrist.x -
          middleMcp.x,

        wrist.y -
          middleMcp.y
      );


    if (
      palmSize <= 0
    ) {
      return;
    }


    const rawGap =
      Math.hypot(
        thumbTip.x -
          indexTip.x,

        thumbTip.y -
          indexTip.y
      );


    const normalizedGap =
      rawGap /
      palmSize;


    if (
      this.smoothedGap === null
    ) {

      this.smoothedGap =
        normalizedGap;

    } else {

      this.smoothedGap +=
        (
          normalizedGap -
          this.smoothedGap
        ) *
        this.GAP_SMOOTHING;
    }


    if (
      this.previousGap === null
    ) {

      this.previousGap =
        this.smoothedGap;

      this.activateRightHand();

      return;
    }


    this.activateRightHand();


    const gapDelta =
      this.smoothedGap -
      this.previousGap;


    this.previousGap =
      this.smoothedGap;


    if (
      Math.abs(gapDelta) <
      this.MIN_GAP_CHANGE
    ) {

      this.emitVolume(
        this.smoothedVolume,
        true
      );

      return;
    }


    this.targetVolume +=
      gapDelta *
      this.GAP_SENSITIVITY;


    this.targetVolume =
      Math.max(
        0,
        Math.min(
          1,
          this.targetVolume
        )
      );


    this.smoothedVolume +=
      (
        this.targetVolume -
        this.smoothedVolume
      ) *
      this.VOLUME_SMOOTHING;


    this.smoothedVolume =
      Math.max(
        0,
        Math.min(
          1,
          this.smoothedVolume
        )
      );


    this.audio.setMaster(
      this.smoothedVolume
    );


    this.emitVolume(
      this.smoothedVolume,
      true
    );
  }


  // ==========================================================
  // RIGHT HAND ACTIVE
  // ==========================================================

  activateRightHand() {

    if (
      this.rightHandActive
    ) {
      return;
    }


    this.rightHandActive =
      true;


    document.body.classList.add(
      "mudrix-right-active"
    );


    window.dispatchEvent(
      new CustomEvent(
        "mudrix-hand",
        {
          detail: {
            hand: "right",
            active: true
          }
        }
      )
    );
  }


  // ==========================================================
  // LEFT HAND — THUMBS
  // ==========================================================

  processLeftHand(
    landmarks
  ) {

    this.activateLeftHand();


    const wrist =
      landmarks[0];

    const thumbTip =
      landmarks[4];

    const thumbIp =
      landmarks[3];


    const indexMcp =
      landmarks[5];

    const indexPip =
      landmarks[6];

    const indexTip =
      landmarks[8];


    const middleTip =
      landmarks[12];

    const ringTip =
      landmarks[16];

    const pinkyTip =
      landmarks[20];


    const thumbVectorY =
      thumbTip.y -
      thumbIp.y;


    const indexFolded =
      this.isFingerFolded(
        wrist,
        indexMcp,
        indexPip,
        indexTip
      );


    const middleFolded =
      this.isFingerFolded(
        wrist,
        landmarks[9],
        landmarks[10],
        middleTip
      );


    const ringFolded =
      this.isFingerFolded(
        wrist,
        landmarks[13],
        landmarks[14],
        ringTip
      );


    const pinkyFolded =
      this.isFingerFolded(
        wrist,
        landmarks[17],
        landmarks[18],
        pinkyTip
      );


    const fingersFolded =
      indexFolded &&
      middleFolded &&
      ringFolded &&
      pinkyFolded;


    if (
      !fingersFolded
    ) {

      this.lastThumbGesture =
        null;

      return;
    }


    document.body.classList.add(
      "mudrix-left-active"
    );


    let gesture =
      null;


    // ========================================================
    // THUMBS UP
    // ========================================================

    if (
      thumbTip.y <
        wrist.y - 0.08 &&
      thumbVectorY <
        -0.03
    ) {

      gesture =
        "THUMBS_UP";
    }


    // ========================================================
    // THUMBS DOWN
    // ========================================================

    if (
      thumbTip.y >
        wrist.y + 0.08 &&
      thumbVectorY >
        0.03
    ) {

      gesture =
        "THUMBS_DOWN";
    }


    if (!gesture) {
      return;
    }


    const now =
      performance.now();


    if (
      gesture ===
        this.lastThumbGesture &&
      now -
        this.lastThumbGestureTime <
        this.THUMB_COOLDOWN
    ) {

      return;
    }


    this.lastThumbGesture =
      gesture;

    this.lastThumbGestureTime =
      now;


    console.log(
      `Mudrix Gesture: ${gesture}`
    );


    // ========================================================
    // VISUAL STATE
    // ========================================================

    document.body.classList.remove(
      "mudrix-gesture-up",
      "mudrix-gesture-down"
    );


    if (
      gesture ===
      "THUMBS_UP"
    ) {

      document.body.classList.add(
        "mudrix-gesture-up"
      );
    }


    if (
      gesture ===
      "THUMBS_DOWN"
    ) {

      document.body.classList.add(
        "mudrix-gesture-down"
      );
    }


    // ========================================================
    // SEND TO APP
    // ========================================================

    this.emitGesture(
      gesture
    );
  }


  // ==========================================================
  // LEFT HAND ACTIVE
  // ==========================================================

  activateLeftHand() {

    if (
      this.leftHandActive
    ) {
      return;
    }


    this.leftHandActive =
      true;


    document.body.classList.add(
      "mudrix-left-active"
    );


    window.dispatchEvent(
      new CustomEvent(
        "mudrix-hand",
        {
          detail: {
            hand: "left",
            active: true
          }
        }
      )
    );
  }


  // ==========================================================
  // FINGER FOLDED
  // ==========================================================

  isFingerFolded(
    wrist,
    mcp,
    pip,
    tip
  ) {

    const pipDistance =
      Math.hypot(
        pip.x -
          wrist.x,

        pip.y -
          wrist.y
      );


    const tipDistance =
      Math.hypot(
        tip.x -
          wrist.x,

        tip.y -
          wrist.y
      );


    return (
      tipDistance <
      pipDistance * 1.15
    );
  }


  // ==========================================================
  // EMIT GESTURE
  // ==========================================================

  emitGesture(
    gesture
  ) {

    window.dispatchEvent(
      new CustomEvent(
        "mudrix-gesture",
        {
          detail: {
            gesture
          }
        }
      )
    );
  }


  // ==========================================================
  // EMIT VOLUME
  // ==========================================================

  emitVolume(
    volume,
    active
  ) {

    const now =
      performance.now();


    if (
      active &&
      now -
        this.lastFeedbackVolume <
        this.volumeFeedbackInterval
    ) {

      return;
    }


    this.lastFeedbackVolume =
      now;


    window.dispatchEvent(
      new CustomEvent(
        "mudrix-volume",
        {
          detail: {
            volume,
            active
          }
        }
      )
    );
  }


  // ==========================================================
  // RESET VOLUME
  // ==========================================================

  resetVolumeTracking() {

    this.previousGap =
      null;

    this.smoothedGap =
      null;
  }


  // ==========================================================
  // STOP
  // ==========================================================

  stop() {

    if (this.stream) {

      this.stream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

      this.stream =
        null;
    }


    if (this.video) {

      this.video.srcObject =
        null;
    }


    this.resetVolumeTracking();

    this.lastThumbGesture =
      null;

    this.rightHandActive =
      false;

    this.leftHandActive =
      false;


    document.body.classList.remove(
      "mudrix-right-active",
      "mudrix-left-active",
      "mudrix-gesture-up",
      "mudrix-gesture-down"
    );
  }
}