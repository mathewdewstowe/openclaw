import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { DiagnosticScores } from '@/lib/diagnostic/scoring';

export async function POST(req: NextRequest) {
  try {
    const { scores, verdict }: { scores: DiagnosticScores; verdict: Record<string, string> } =
      await req.json();

    const diagnostic = await prisma.diagnostic.create({
      data: {
        productScore: scores.product,
        peopleScore: scores.people,
        processScore: scores.process,
        answers: scores.answers as object[],
        verdict: verdict as object,
      },
    });

    return NextResponse.json({ diagnosticId: diagnostic.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[diagnostic/save]', msg);
    return NextResponse.json({ error: 'Save failed', detail: msg }, { status: 500 });
  }
}
