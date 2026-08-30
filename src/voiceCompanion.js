const MODEL = "gemini-3.1-flash-live-preview";

const SYSTEM_INSTRUCTION = `
You are Tethr, a quiet grounding companion inside an immersive calm environment.

Your primary role is to listen, acknowledge, and help the person stay with the present moment. You are not a therapist, doctor, crisis counselor, or diagnostic system.

Be warm, steady, respectful, and human-sounding without pretending to be human.

Keep responses short and natural. Do not give lectures or long explanations.

The person is sitting on a grassy hill in first-person perspective. There is a large tree nearby, a peaceful landscape, a distant castle, an ocean, open sky, wind, and occasional birds.

When the person seems overwhelmed, reduce cognitive load. Offer one small next step rather than several choices. Use the immediate environment when grounding is helpful.

Listen more than you speak. Acknowledge what the person says before offering direction.

Never diagnose or claim to treat a condition.
Never create emotional dependency.
Never say everything will be okay or make promises about outcomes.

If the person expresses immediate intent or a plan to harm themselves or someone else, or indicates immediate danger, encourage them to contact local emergency services, a crisis service appropriate to their location, or a trusted person who can stay with them. Keep this brief and direct.
`;

export class VoiceCompanion {
  constructor(options = {}) {
    this.onStateChange = options.onStateChange || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onError = options.onError || (() => {});
    this.onAudioStart = options.onAudioStart || (() => {});
    this.onAudioEnd = options.onAudioEnd || (() => {});

    this.socket = null;

    // ONE AudioContext handles both mic processing and Gemini audio.
    this.audioContext = null;

    this.mediaStream = null;
    this.processor = null;
    this.source = null;
    this.silentGain = null;

    this.connected = false;
    this.ready = false;
    this.closing = false;

    this.isPlaying = false;
    this.nextPlayTime = 0;

    this.activeSources = new Set();
  }

  setState(state) {
    try {
      this.onStateChange(state);
    } catch {
      // Ignore UI callback errors.
    }
  }

  /*
   * Tell AudioEngine to pause/resume the background soundscape.
   */
  setVoiceAudioMode(active) {
    try {
      window.dispatchEvent(
        new CustomEvent("tethr:voice-audio", {
          detail: {
            active: Boolean(active),
          },
        })
      );
    } catch {
      // Ignore event errors.
    }
  }

  /*
   * IMPORTANT:
   *
   * If Tethr is opened through VS Code Live Server
   * (usually localhost:5500), the API still lives
   * on localhost:4173.
   *
   * If Tethr is opened directly from our Node server
   * (localhost:4173), use the same-origin endpoint.
   *
   * This also works when deployed because production
   * uses the same origin.
   */
  getApiBase() {
    const hostname = window.location.hostname;
    const port = window.location.port;

    if (
      hostname === "localhost" &&
      port &&
      port !== "4173"
    ) {
      return "http://localhost:4173";
    }

    if (
      hostname === "127.0.0.1" &&
      port &&
      port !== "4173"
    ) {
      return "http://127.0.0.1:4173";
    }

    return "";
  }

  async getEphemeralToken() {
    const apiBase = this.getApiBase();

    const url = `${apiBase}/api/live-token`;

    console.log("Requesting Gemini Live token from:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      let message = `Unable to obtain voice token (${response.status}).`;

      try {
        const data = await response.json();

        if (data?.error) {
          message = data.error;
        }
      } catch {
        // Ignore invalid JSON.
      }

      throw new Error(message);
    }

    const data = await response.json();

    if (!data?.token) {
      throw new Error(
        "Voice token was not returned by the server."
      );
    }

    return data.token;
  }

  async start() {
    if (this.connected || this.socket) {
      return;
    }

    this.closing = false;
    this.ready = false;

    this.setState("starting");

    /*
     * Stop background soundscape immediately.
     */
    this.setVoiceAudioMode(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Microphone access is not supported by this browser."
        );
      }

      /*
       * Create AudioContext immediately while still inside
       * the user's button click. This avoids autoplay problems.
       */
      this.audioContext = new AudioContext();

      await this.audioContext.resume();

      /*
       * Get our short-lived Gemini token.
       */
      const token = await this.getEphemeralToken();

      /*
       * Connect to Gemini Live.
       * This waits for setupComplete before continuing.
       */
      await this.connectWebSocket(token);

      /*
       * Start microphone only after Gemini is ready.
       */
      await this.startMicrophone();

      this.connected = true;
      this.ready = true;

      this.setState("connected");

      console.log("Tethr voice companion ready.");

    } catch (error) {
      console.error(
        "VoiceCompanion start failed:",
        error
      );

      await this.cleanup();

      this.setVoiceAudioMode(false);

      this.setState("error");

      try {
        this.onError(error);
      } catch {
        // Ignore callback errors.
      }

      throw error;
    }
  }

  /*
   * Connect to Gemini Live using the ephemeral token.
   */
  connectWebSocket(token) {
    return new Promise((resolve, reject) => {
      const encodedToken = encodeURIComponent(token);

      const url =
        "wss://generativelanguage.googleapis.com/ws/" +
        "google.ai.generativelanguage.v1beta." +
        "GenerativeService.BidiGenerateContentConstrained" +
        `?access_token=${encodedToken}`;

      console.log("Connecting to Gemini Live...");

      const socket = new WebSocket(url);

      this.socket = socket;

      let settled = false;

      socket.onopen = () => {
        console.log(
          "Tethr voice WebSocket connected."
        );

        /*
         * IMPORTANT:
         *
         * responseModalities belongs inside generationConfig.
         */
        const setupMessage = {
          setup: {
            model: `models/${MODEL}`,

            generationConfig: {
              responseModalities: ["AUDIO"],
            },

            systemInstruction: {
              parts: [
                {
                  text: SYSTEM_INSTRUCTION,
                },
              ],
            },

            inputAudioTranscription: {},

            outputAudioTranscription: {},

            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
              },
            },
          },
        };

        console.log(
          "Sending Gemini Live setup..."
        );

        socket.send(
          JSON.stringify(setupMessage)
        );
      };

      socket.onmessage = async event => {
        try {
          let message;

          if (typeof event.data === "string") {
            message = JSON.parse(event.data);
          } else if (event.data instanceof Blob) {
            message = JSON.parse(
              await event.data.text()
            );
          } else {
            return;
          }

          /*
           * Gemini confirms setup is complete.
           */
          if (message.setupComplete) {
            console.log(
              "Tethr voice session ready."
            );

            this.ready = true;
            this.setState("ready");

            if (!settled) {
              settled = true;
              resolve();
            }

            return;
          }

          /*
           * Gemini returned an error.
           */
          if (message.error) {
            console.error(
              "Gemini Live error:",
              message.error
            );

            const error = new Error(
              message.error.message ||
                "Gemini Live returned an error."
            );

            if (!settled) {
              settled = true;
              reject(error);
            }

            try {
              this.onError(error);
            } catch {
              // Ignore callback errors.
            }

            return;
          }

          await this.handleMessage(message);

        } catch (error) {
          console.error(
            "Voice message handling error:",
            error
          );
        }
      };

      socket.onerror = event => {
        console.error(
          "Tethr voice WebSocket error:",
          event
        );

        const error = new Error(
          "The voice connection encountered an error."
        );

        if (!settled) {
          settled = true;
          reject(error);
        }

        try {
          this.onError(error);
        } catch {
          // Ignore callback errors.
        }
      };

      socket.onclose = event => {
        console.log(
          "Tethr voice WebSocket closed:",
          event.code,
          event.reason
        );

        this.socket = null;
        this.connected = false;
        this.ready = false;

        if (!settled) {
          settled = true;

          reject(
            new Error(
              event.reason ||
                "Voice connection closed before starting."
            )
          );
        }

        if (!this.closing) {
          this.setState("disconnected");
        }
      };
    });
  }

  async handleMessage(message) {
    /*
     * Ignore setup confirmation.
     */
    if (message.setupComplete) {
      return;
    }

    /*
     * Handle server errors.
     */
    if (message.error) {
      console.error(
        "Gemini Live server error:",
        message.error
      );

      try {
        this.onError(
          new Error(
            message.error.message ||
              "Gemini Live error."
          )
        );
      } catch {
        // Ignore callback errors.
      }

      return;
    }

    const serverContent =
      message.serverContent;

    if (!serverContent) {
      return;
    }

    /*
     * USER TRANSCRIPTION
     */
    if (
      serverContent.inputTranscription?.text
    ) {
      try {
        this.onTranscript({
          role: "user",
          text:
            serverContent
              .inputTranscription.text,
        });
      } catch {
        // Ignore callback errors.
      }
    }

    /*
     * MODEL TRANSCRIPTION
     */
    if (
      serverContent.outputTranscription?.text
    ) {
      try {
        this.onTranscript({
          role: "model",
          text:
            serverContent
              .outputTranscription.text,
        });
      } catch {
        // Ignore callback errors.
      }
    }

    /*
     * MODEL RESPONSE
     */
    const modelTurn =
      serverContent.modelTurn;

    if (modelTurn?.parts) {
      for (const part of modelTurn.parts) {

        /*
         * AUDIO RESPONSE
         */
        const inlineData =
          part?.inlineData;

        if (
          inlineData?.data &&
          typeof inlineData.data ===
            "string"
        ) {
          const mimeType =
            inlineData.mimeType || "";

          if (
            mimeType.startsWith("audio/")
          ) {
            await this.playAudio(
              inlineData.data,
              mimeType
            );
          }
        }

        /*
         * TEXT RESPONSE
         */
        if (part?.text) {
          try {
            this.onTranscript({
              role: "model",
              text: part.text,
            });
          } catch {
            // Ignore callback errors.
          }
        }
      }
    }

    /*
     * User interrupted Gemini.
     */
    if (serverContent.interrupted) {
      this.stopAudioImmediately();
    }

    /*
     * Gemini finished speaking.
     */
    if (serverContent.turnComplete) {
      try {
        this.onAudioEnd();
      } catch {
        // Ignore callback errors.
      }
    }
  }

  async startMicrophone() {
    if (!this.audioContext) {
      this.audioContext =
        new AudioContext();
    }

    await this.audioContext.resume();

    this.mediaStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

    this.source =
      this.audioContext.createMediaStreamSource(
        this.mediaStream
      );

    /*
     * ScriptProcessor works without requiring
     * an additional AudioWorklet file.
     */
    this.processor =
      this.audioContext.createScriptProcessor(
        4096,
        1,
        1
      );

    this.processor.onaudioprocess =
      event => {
        if (!this.socket) {
          return;
        }

        if (
          this.socket.readyState !==
          WebSocket.OPEN
        ) {
          return;
        }

        /*
         * Never send microphone data until
         * Gemini has completed setup.
         */
        if (!this.ready) {
          return;
        }

        const input =
          event.inputBuffer
            .getChannelData(0);

        /*
         * Browser microphone is usually 48 kHz.
         * Gemini Live expects 16 kHz PCM.
         */
        const pcm16 =
          this.downsampleTo16k(input);

        const base64 =
          this.arrayBufferToBase64(
            pcm16.buffer
          );

        try {
          this.socket.send(
            JSON.stringify({
              realtimeInput: {
                audio: {
                  data: base64,
                  mimeType:
                    "audio/pcm;rate=16000",
                },
              },
            })
          );
        } catch (error) {
          console.error(
            "Failed to send microphone audio:",
            error
          );
        }
      };

    this.source.connect(
      this.processor
    );

    /*
     * Keep microphone completely silent locally.
     */
    this.silentGain =
      this.audioContext.createGain();

    this.silentGain.gain.value = 0;

    this.processor.connect(
      this.silentGain
    );

    this.silentGain.connect(
      this.audioContext.destination
    );

    console.log(
      "Microphone started at",
      this.audioContext.sampleRate,
      "Hz; sending 16 kHz PCM."
    );
  }

  /*
   * Convert microphone audio to 16 kHz.
   */
  downsampleTo16k(float32Array) {
    const inputSampleRate =
      this.audioContext?.sampleRate ||
      48000;

    const targetSampleRate = 16000;

    if (
      inputSampleRate ===
      targetSampleRate
    ) {
      return this.floatTo16BitPCM(
        float32Array
      );
    }

    const ratio =
      inputSampleRate /
      targetSampleRate;

    const newLength =
      Math.round(
        float32Array.length /
          ratio
      );

    const result =
      new Int16Array(
        newLength
      );

    let offsetResult = 0;
    let offsetBuffer = 0;

    while (
      offsetResult <
      result.length
    ) {
      const nextOffset =
        Math.round(
          (offsetResult + 1) *
            ratio
        );

      let accum = 0;
      let count = 0;

      for (
        let i =
          offsetBuffer;
        i <
          nextOffset &&
        i <
          float32Array.length;
        i++
      ) {
        accum +=
          float32Array[i];

        count++;
      }

      const sample =
        count > 0
          ? accum / count
          : 0;

      const clamped =
        Math.max(
          -1,
          Math.min(
            1,
            sample
          )
        );

      result[offsetResult] =
        clamped < 0
          ? clamped * 0x8000
          : clamped * 0x7fff;

      offsetResult++;
      offsetBuffer =
        nextOffset;
    }

    return result;
  }

  /*
   * Float32 -> signed 16-bit PCM.
   */
  floatTo16BitPCM(float32Array) {
    const buffer =
      new ArrayBuffer(
        float32Array.length * 2
      );

    const view =
      new DataView(buffer);

    for (
      let i = 0;
      i < float32Array.length;
      i++
    ) {
      let sample =
        Math.max(
          -1,
          Math.min(
            1,
            float32Array[i]
          )
        );

      sample =
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff;

      view.setInt16(
        i * 2,
        sample,
        true
      );
    }

    return new Int16Array(buffer);
  }

  /*
   * ArrayBuffer -> Base64.
   */
  arrayBufferToBase64(buffer) {
    const bytes =
      new Uint8Array(buffer);

    let binary = "";

    const chunkSize = 0x8000;

    for (
      let i = 0;
      i < bytes.length;
      i += chunkSize
    ) {
      binary += String.fromCharCode(
        ...bytes.subarray(
          i,
          Math.min(
            i + chunkSize,
            bytes.length
          )
        )
      );
    }

    return btoa(binary);
  }

  /*
   * Play Gemini's PCM voice response.
   *
   * Gemini Live audio is normally 24 kHz PCM.
   */
  async playAudio(
    base64,
    mimeType = "audio/pcm;rate=24000"
  ) {
    if (!this.audioContext) {
      return;
    }

    if (
      this.audioContext.state ===
      "suspended"
    ) {
      try {
        await this.audioContext.resume();
      } catch {
        return;
      }
    }

    try {
      const binary =
        atob(base64);

      const bytes =
        new Uint8Array(
          binary.length
        );

      for (
        let i = 0;
        i < binary.length;
        i++
      ) {
        bytes[i] =
          binary.charCodeAt(i);
      }

      /*
       * PCM is little-endian signed 16-bit.
       */
      const pcm =
        new Int16Array(
          bytes.buffer
        );

      if (!pcm.length) {
        return;
      }

      const sampleRate =
        this.getSampleRate(
          mimeType
        );

      const audioBuffer =
        this.audioContext.createBuffer(
          1,
          pcm.length,
          sampleRate
        );

      const channel =
        audioBuffer.getChannelData(0);

      for (
        let i = 0;
        i < pcm.length;
        i++
      ) {
        channel[i] =
          pcm[i] / 32768;
      }

      const source =
        this.audioContext
          .createBufferSource();

      source.buffer =
        audioBuffer;

      source.connect(
        this.audioContext.destination
      );

      this.activeSources.add(
        source
      );

      const now =
        this.audioContext.currentTime;

      if (
        this.nextPlayTime <
        now
      ) {
        this.nextPlayTime = now;
      }

      source.start(
        this.nextPlayTime
      );

      this.nextPlayTime +=
        audioBuffer.duration;

      this.isPlaying = true;

      try {
        this.onAudioStart();
      } catch {
        // Ignore callback errors.
      }

      source.onended = () => {
        this.activeSources.delete(
          source
        );

        try {
          source.disconnect();
        } catch {
          // Ignore.
        }

        if (
          this.audioContext &&
          this.audioContext.currentTime >=
            this.nextPlayTime - 0.03
        ) {
          this.isPlaying = false;
        }
      };

    } catch (error) {
      console.error(
        "Gemini audio playback error:",
        error
      );
    }
  }

  getSampleRate(mimeType) {
    if (!mimeType) {
      return 24000;
    }

    const match =
      mimeType.match(
        /rate=(\d+)/i
      );

    if (!match) {
      return 24000;
    }

    return (
      Number(match[1]) ||
      24000
    );
  }

  /*
   * Immediately stop all Gemini audio.
   */
  stopAudioImmediately() {
    this.nextPlayTime = 0;

    for (
      const source of
      this.activeSources
    ) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }

      try {
        source.disconnect();
      } catch {
        // Ignore.
      }
    }

    this.activeSources.clear();

    this.isPlaying = false;
  }

  /*
   * Optional text input into the same Live session.
   */
  sendText(text) {
    if (
      !text ||
      !this.socket
    ) {
      return false;
    }

    if (
      this.socket.readyState !==
      WebSocket.OPEN
    ) {
      return false;
    }

    if (!this.ready) {
      return false;
    }

    try {
      this.socket.send(
        JSON.stringify({
          realtimeInput: {
            text: String(text),
          },
        })
      );

      return true;

    } catch (error) {
      console.error(
        "Failed to send text:",
        error
      );

      return false;
    }
  }

  async stop() {
    this.closing = true;

    this.stopAudioImmediately();

    await this.cleanup();

    /*
     * Resume background soundscape.
     */
    this.setVoiceAudioMode(false);

    this.setState("stopped");
  }

  async cleanup() {
    this.connected = false;
    this.ready = false;

    this.stopAudioImmediately();

    /*
     * Stop microphone processor.
     */
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        // Ignore.
      }

      this.processor.onaudioprocess =
        null;

      this.processor = null;
    }

    /*
     * Disconnect microphone source.
     */
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // Ignore.
      }

      this.source = null;
    }

    /*
     * Disconnect silent gain.
     */
    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch {
        // Ignore.
      }

      this.silentGain = null;
    }

    /*
     * Stop microphone tracks.
     */
    if (this.mediaStream) {
      for (
        const track of
        this.mediaStream.getTracks()
      ) {
        track.stop();
      }

      this.mediaStream = null;
    }

    /*
     * Close WebSocket.
     */
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore.
      }

      this.socket = null;
    }

    /*
     * Close AudioContext.
     */
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        // Ignore.
      }

      this.audioContext = null;
    }

    this.nextPlayTime = 0;
    this.isPlaying = false;

    this.activeSources.clear();
  }
}

export default VoiceCompanion;