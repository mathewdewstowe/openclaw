export type DiagnosticQuestion = {
  id: string;
  dimension: 'product' | 'people' | 'process';
  number: number;
  label: string;
  question: string;
  type: 'single' | 'multi';
  options: {
    id: string;
    text: string;
    weight: number;
  }[];
};

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: 'q1_product_ai',
    dimension: 'product',
    number: 1,
    label: 'PRODUCT',
    question: 'How is AI showing up in your product today?',
    type: 'single',
    options: [
      { id: 'shipped', text: 'Shipped features with real AI capability', weight: 9 },
      { id: 'pilots', text: 'Experiments or pilots in progress', weight: 6 },
      { id: 'roadmap', text: 'On the roadmap but not started', weight: 3 },
      { id: 'not_planned', text: 'Not on the roadmap', weight: 0 },
    ],
  },
  {
    id: 'q2_competitors',
    dimension: 'product',
    number: 2,
    label: 'PRODUCT',
    question: "What are competitors doing that you aren't?",
    type: 'single',
    options: [
      { id: 'ahead', text: "We're ahead of them", weight: 9 },
      { id: 'marketing', text: "They're marketing AI heavily — unclear if it's real", weight: 5 },
      { id: 'behind', text: "They've shipped AI features we haven't matched", weight: 2 },
      { id: 'dont_know', text: "Honestly, we don't know", weight: 0 },
    ],
  },
  {
    id: 'q3_owner',
    dimension: 'people',
    number: 3,
    label: 'PEOPLE',
    question: 'Who owns AI transformation in your business?',
    type: 'single',
    options: [
      { id: 'named_budget', text: 'A named exec with budget and time', weight: 10 },
      { id: 'named_diluted', text: "A named exec, but it's one of many priorities", weight: 5 },
      { id: 'shared', text: 'Shared across the leadership team', weight: 3 },
      { id: 'nobody', text: 'Nobody owns it yet', weight: 0 },
    ],
  },
  {
    id: 'q4_team_adoption',
    dimension: 'people',
    number: 4,
    label: 'PEOPLE',
    question: "What's the team's relationship with AI tools right now?",
    type: 'single',
    options: [
      { id: 'adopted', text: 'Adopted widely, measurable gains', weight: 10 },
      { id: 'patchy', text: 'Some teams using, patchy results', weight: 5 },
      { id: 'enthusiasts', text: 'A few enthusiasts, no coordination', weight: 3 },
      { id: 'blocked', text: 'Blocked, resistant, or untrained', weight: 0 },
    ],
  },
  {
    id: 'q5_manual_workflows',
    dimension: 'process',
    number: 5,
    label: 'PROCESS',
    question: 'Which of these workflows are still mostly manual?',
    type: 'multi',
    options: [
      { id: 'sales', text: 'Sales and lead generation', weight: 0 },
      { id: 'support', text: 'Customer support and success', weight: 0 },
      { id: 'engineering', text: 'Engineering and delivery', weight: 0 },
      { id: 'onboarding', text: 'Onboarding and implementation', weight: 0 },
      { id: 'marketing', text: 'Marketing and content', weight: 0 },
      { id: 'finance', text: 'Finance and operations', weight: 0 },
    ],
  },
  {
    id: 'q6_blockers',
    dimension: 'process',
    number: 6,
    label: 'PROCESS',
    question: "What's blocking you right now?",
    type: 'multi',
    options: [
      { id: 'no_strategy', text: 'No clear strategy or priorities', weight: 0 },
      { id: 'no_budget', text: 'Budget not approved', weight: 0 },
      { id: 'alignment', text: 'Leadership alignment', weight: 0 },
      { id: 'data', text: 'Data quality or access', weight: 0 },
      { id: 'capability', text: 'Team capability or capacity', weight: 0 },
      { id: 'nothing', text: "Nothing — we just need to move faster", weight: 10 },
    ],
  },
];
