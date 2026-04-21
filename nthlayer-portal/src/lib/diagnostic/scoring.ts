import { DIAGNOSTIC_QUESTIONS } from './questions';

export type DiagnosticAnswer = {
  questionId: string;
  selectedOptionIds: string[];
};

export type DiagnosticScores = {
  product: number;
  people: number;
  process: number;
  answers: DiagnosticAnswer[];
};

export function computeScores(answers: DiagnosticAnswer[]): DiagnosticScores {
  const scoresByDimension: Record<string, number[]> = {
    product: [],
    people: [],
    process: [],
  };

  for (const answer of answers) {
    const question = DIAGNOSTIC_QUESTIONS.find(q => q.id === answer.questionId);
    if (!question) continue;

    let questionScore = 0;

    if (question.type === 'single') {
      const option = question.options.find(o => o.id === answer.selectedOptionIds[0]);
      questionScore = option?.weight ?? 0;
    } else {
      if (question.id === 'q6_blockers' && answer.selectedOptionIds.includes('nothing')) {
        questionScore = 10;
      } else {
        const count = answer.selectedOptionIds.length;
        const penalty = question.id === 'q5_manual_workflows' ? 1.5 : 2;
        questionScore = Math.max(0, 10 - count * penalty);
      }
    }

    scoresByDimension[question.dimension].push(questionScore);
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  return {
    product: avg(scoresByDimension.product),
    people: avg(scoresByDimension.people),
    process: avg(scoresByDimension.process),
    answers,
  };
}
