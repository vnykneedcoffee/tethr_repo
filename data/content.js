export const LEVELS = [
  {
    id: 0,
    name: "I Need Some Peace",
    short: "Somewhere quieter.",
    icon: "leaf",
    mode: "rest",
  },
  {
    id: 1,
    name: "I'm A Little Unsettled",
    short: "A little room to settle.",
    icon: "breath",
    mode: "breathe",
  },
  {
    id: 2,
    name: "My Thoughts Are Getting Loud",
    short: "Make some space.",
    icon: "spiral",
    mode: "release",
  },
  {
    id: 3,
    name: "I'm Overwhelmed",
    short: "Just follow me.",
    icon: "anchor",
    mode: "guide",
  },
];

export const LEVEL2_GROUNDING = [
  "Look around you.",
  "Notice something you can see.",
  "Notice one sound.",
  "Feel where you're sitting.",
  "Stay here for a moment.",
];

export const LEVEL3_SEQUENCE = [
  "Put both feet on the ground.",
  "Press them gently into the floor.",
  "Notice the surface beneath you.",
  "Rub your hands together slowly.",
  "Notice the warmth in your hands.",
  "Take one slow breath with me.",
];

export const LEVEL3_ENVIRONMENT = [
  "Look toward the tree.",
  "Notice the leaves moving.",
  "Listen for the birds.",
  "Look toward the ocean.",
  "Feel where you're sitting.",
];

export const SCRIPTED_COMPANION = [
  { test: /.*/, reply: "That sounds like a lot to carry right now." },
  { test: /exam|test|fail|school|college/i, reply: "You don't have to solve tomorrow just yet." },
  { test: /work|job|boss|deadline/i, reply: "You don't have to solve everything at once." },
  { test: /alone|lonely|nobody/i, reply: "You don't have to carry this moment entirely by yourself." },
  { test: /panic|terrified|scared|afraid/i, reply: "Let's stay with this moment. You are here, right now." },
];

export const SAFETY_PATTERNS = [
  /\bkill myself\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend my life\b/i,
  /\bhurt myself\b/i,
  /\bself[- ]?harm\b/i,
  /\bwant to die\b/i,
  /\bgoing to die\b/i,
];
