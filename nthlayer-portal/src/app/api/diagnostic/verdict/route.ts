import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { DiagnosticScores } from '@/lib/diagnostic/scoring';
import { DIAGNOSTIC_QUESTIONS } from '@/lib/diagnostic/questions';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Inflexion, a diagnostic for PE-backed SaaS CEOs on AI transformation readiness.

You have been given three scores (Product, People, Process, each 0-10) and the CEO's raw answers.

Your job: return a JSON response with:
1. A one-line verdict per dimension (max 12 words each) — sharp, specific, and grounded in what they actually answered
2. A headline verdict (max 20 words) that names the single biggest tension in their answers
3. A CTA hook line (max 15 words) that creates urgency without being salesy

Voice rules:
- Direct, first-person plural ("you're stalled on ownership")
- No hedging. No "it seems" or "appears to be"
- Name the uncomfortable thing. If no one owns it, say so
- No jargon ("synergies", "leverage", "holistic")
- No em-dashes in output (use commas or full stops)
- British English

Output JSON only, no prose, no markdown fences:
{
  "headline": "...",
  "product_line": "...",
  "people_line": "...",
  "process_line": "...",
  "cta_hook": "..."
}`;

export async function POST(req: NextRequest) {
  try {
    const { scores }: { scores: DiagnosticScores } = await req.json();

    const answerSummary = scores.answers
      .map(a => {
        const q = DIAGNOSTIC_QUESTIONS.find(x => x.id === a.questionId);
        const selectedText = a.selectedOptionIds
          .map(id => q?.options.find(o => o.id === id)?.text)
          .filter(Boolean)
          .join(' | ');
        return `${q?.question}\n→ ${selectedText}`;
      })
      .join('\n\n');

    const userMessage = `Scores:
- Product: ${scores.product}/10
- People: ${scores.people}/10
- Process: ${scores.process}/10

Their answers:
${answerSummary}

Return the verdict JSON.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No verdict generated' }, { status: 500 });
    }

    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    const verdict = JSON.parse(cleaned);

    return NextResponse.json({ verdict });
  } catch (err) {
    console.error('[diagnostic/verdict]', err);
    return NextResponse.json({ error: 'Verdict generation failed' }, { status: 500 });
  }
}
