export type Placement = "top" | "bottom" | "left" | "right";

export interface WalkthroughStep {
  target: string; // data-tour attribute value
  title: string;
  body: string;
  placement: Placement;
}

export const DESKTOP_STEPS: WalkthroughStep[] = [
  // ── Dashboard orientation ──
  {
    target: "ask-me",
    title: "Ask Me Anything",
    body: "Your AI strategy assistant lives here. Ask questions about your strategy, get explanations of any report, or explore alternative scenarios — at any point in the process.",
    placement: "right",
  },
  {
    target: "knowledge-cards",
    title: "Actions, Risks, Assumptions & Metrics",
    body: "As you complete strategy stages, these cards tally every action, risk, assumption, and metric generated across all reports. Click any card to review and accept or reject each item — your feedback trains the system.",
    placement: "bottom",
  },
  {
    target: "profile-completion",
    title: "Complete Your Profile",
    body: "A richer company profile produces sharper, more relevant strategy outputs. Fill in your sector, ideal customers, and competitors to get the most out of every stage.",
    placement: "bottom",
  },

  // ── Stage-by-stage walkthrough ──
  {
    target: "stage-frame",
    title: "Stage 1: Frame",
    body: "Define what\u2019s changed, what winning looks like, and where the boundaries sit. This is your starting point \u2014 everything flows from here.",
    placement: "bottom",
  },
  {
    target: "stage-diagnose",
    title: "Stage 2: Diagnose",
    body: "Build a structured fact base across product-market fit, competitive position, and capability. Honest diagnosis prevents wasted effort later.",
    placement: "bottom",
  },
  {
    target: "stage-decide",
    title: "Stage 3: Decide",
    body: "Surface your real options \u2014 including inaction \u2014 and pressure-test each one. You\u2019ll define kill criteria and what must be true to succeed.",
    placement: "bottom",
  },
  {
    target: "stage-position",
    title: "Stage 4: Position",
    body: "Translate your direction into a precise market stance \u2014 who you serve, what you do better, and the structural advantages you\u2019re building.",
    placement: "bottom",
  },
  {
    target: "stage-commit",
    title: "Stage 5: Commit",
    body: "Turn strategy into execution: OKRs, a 100-day plan, ownership, and a governance rhythm that keeps it live.",
    placement: "bottom",
  },

  // ── The big reveal ──
  {
    target: "strategy-deck",
    title: "Product Strategy Document",
    body: "Complete all five stages and unlock a single authored strategy document — 13 sections synthesised from every report. Not five stitched reports. One coherent document, ready to share with your board or team.",
    placement: "bottom",
  },

  // ── Wrap up ──
  {
    target: "settings-avatar",
    title: "Account & Settings",
    body: "Manage your company profile, account settings, and subscription plan here. You can also replay this tour anytime from this menu.",
    placement: "top",
  },
];

export const MOBILE_STEPS: WalkthroughStep[] = [
  {
    target: "dashboard-overview",
    title: "Your Dashboard",
    body: "Your command centre \u2014 profile completion, recent jobs, outputs, and strategy progress at a glance.",
    placement: "bottom",
  },
  {
    target: "profile-completion",
    title: "Complete Your Profile",
    body: "A richer company profile produces sharper strategy outputs. Fill in sector, ideal customers, and competitors.",
    placement: "bottom",
  },
  {
    target: "stage-frame",
    title: "Five Strategy Stages",
    body: "Work through Frame, Diagnose, Decide, Position, and Commit to build a complete strategy. Complete all five to unlock your Strategy Deck.",
    placement: "bottom",
  },
  {
    target: "mobile-tabs",
    title: "Navigate",
    body: "Switch between Overview, Strategy, Ask Me, Actions, and Risks using these tabs.",
    placement: "top",
  },
];
