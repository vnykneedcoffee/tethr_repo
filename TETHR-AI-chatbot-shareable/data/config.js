export const TETHR_CONFIG = {
  audio: {
    paths: {
      soundscape: "./audio/soundScape.mpeg",
    },
    master: 0.62,
    levelVolumes: {
      0: { soundscape: 1.0 },
      1: { soundscape: 1.0 },
      2: { soundscape: 1.0 },
      3: { soundscape: 1.0 },
    },
    fadeMs: 1800,
  },
  breathing: {
    inhale: 4.5,
    hold: 1.0,
    exhale: 6.0,
    rest: 1.0,
    guidanceCycles: 3,
  },
  timings: {
    level0CheckInMs: 120000,
    level1TalkOfferMs: 18000,
    level2GroundingStepMs: 6200,
    level3GroundingStepMs: 6000,
  },
  privacy: {
    keepThoughtsLocal: true,
    chatHistoryLocalOnly: true,
  },
};
