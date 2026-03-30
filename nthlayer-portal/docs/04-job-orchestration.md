# Nth Layer Signal Portal — Job Orchestration Plan

## Runtime: Trigger.dev v3

All heavy analysis runs as background jobs via Trigger.dev. API routes only create scans and enqueue jobs.

---

## Architecture Overview

```
[Browser] → [Next.js API Route] → [DB: create scan] → [Trigger.dev: enqueue job]
                                                              ↓
                                                     [Job runs modules sequentially]
                                                     [Each module → DB: save result]
                                                     [Progress updated per step]
                                                              ↓
                                                     [Render HTML report]
                                                     [Generate PDF]
                                                     [Save report to DB + storage]
                                                     [Mark scan complete]
                                                              ↓
[Browser polls /api/scan/[id]/status] ←──────────── [Returns status + progress]
```

---

## Job Definitions

### 1. `runInflectionScan`

**Trigger**: Called from `POST /api/scan/inflection`
**Input**: `{ scanId: string }`
**Timeout**: 10 minutes
**Retry**: 2 attempts on full failure

```
Steps (sequential with per-step retry):
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: loadScan           │ Load scan + inputs from DB         │
│ Step 2: extractWebsite     │ Scrape company URL                 │
│ Step 3: extractCompetitors │ Scrape 3 competitor URLs           │
│ Step 4: parseUploads       │ Extract text from uploaded files   │
│ Step 5: normaliseInputs    │ Validate + structure all inputs    │
│ Step 6: companyResearch    │ AI: analyse company (public data)  │
│ Step 7: competitorResearch │ AI: analyse competitors            │
│ Step 8: positioning        │ AI: positioning analysis           │
│ Step 9: competitive        │ AI: competitive analysis           │
│ Step 10: workflow          │ AI: workflow analysis              │
│ Step 11: aiOperatingModel  │ AI: AI/operating model analysis    │
│ Step 12: valueCreation     │ AI: value creation levers          │
│ Step 13: strategicBets     │ AI: strategic bets                 │
│ Step 14: ceoActions        │ AI: CEO 90-day actions             │
│ Step 15: doNothing         │ AI: do-nothing scenario            │
│ Step 16: boardNarrative    │ AI: executive summary              │
│ Step 17: editorialPass     │ AI: consistency + tone review      │
│ Step 18: renderReport      │ Generate HTML report               │
│ Step 19: generatePdf       │ Convert HTML → PDF                 │
│ Step 20: saveReport        │ Save to DB + storage               │
│ Step 21: markComplete      │ Update scan status                 │
└─────────────────────────────────────────────────────────────────┘

Progress: each step = ~5% (21 steps ≈ 100%)
```

### 2. `runCompetitorTeardown`

**Trigger**: Called from `POST /api/scan/competitor`
**Input**: `{ scanId: string }`
**Timeout**: 5 minutes
**Retry**: 2 attempts

```
Steps:
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: loadScan           │ Load scan from DB                  │
│ Step 2: extractWebsite     │ Scrape competitor URL              │
│ Step 3: competitorSnapshot │ AI: build company snapshot         │
│ Step 4: positioning        │ AI: analyse positioning            │
│ Step 5: productShape       │ AI: analyse product                │
│ Step 6: aiNarrative        │ AI: assess AI claims vs reality    │
│ Step 7: gtmSignals         │ AI: extract GTM signals            │
│ Step 8: strengths          │ AI: identify strengths             │
│ Step 9: vulnerabilities    │ AI: identify vulnerabilities       │
│ Step 10: nextMoves         │ AI: predict next moves             │
│ Step 11: responseStrategy  │ AI: "if I were competing" strategy │
│ Step 12: renderReport      │ Generate HTML report               │
│ Step 13: generatePdf       │ Convert HTML → PDF                 │
│ Step 14: saveReport        │ Save to DB + storage               │
│ Step 15: markComplete      │ Update scan status                 │
└─────────────────────────────────────────────────────────────────┘

Progress: each step = ~7% (15 steps ≈ 100%)
```

### 3. `runDealDDScan`

**Trigger**: Called from `POST /api/scan/deal`
**Input**: `{ scanId: string }`
**Timeout**: 8 minutes
**Retry**: 2 attempts

```
Steps:
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: loadScan           │ Load scan from DB                  │
│ Step 2: extractWebsite     │ Scrape target company URL          │
│ Step 3: parseUploads       │ Extract text from uploads          │
│ Step 4: companyResearch    │ AI: analyse target company         │
│ Step 5: productShape       │ AI: analyse product                │
│ Step 6: gtmSignals         │ AI: extract GTM signals            │
│ Step 7: aiNarrative        │ AI: assess AI claims               │
│ Step 8: productRisk        │ AI: product risk assessment        │
│ Step 9: gtmRisk            │ AI: GTM risk assessment            │
│ Step 10: aiRealism         │ AI: AI realism score               │
│ Step 11: executionRisk     │ AI: execution risk assessment      │
│ Step 12: valueCreation     │ AI: value creation levers          │
│ Step 13: boardNarrative    │ AI: DD executive summary           │
│ Step 14: renderReport      │ Generate HTML report               │
│ Step 15: generatePdf       │ Convert HTML → PDF                 │
│ Step 16: saveReport        │ Save to DB + storage               │
│ Step 17: markComplete      │ Update scan status                 │
└─────────────────────────────────────────────────────────────────┘

Progress: each step = ~6% (17 steps ≈ 100%)
```

---

## Step Execution Pattern

Every step follows this pattern:

```ts
async function executeStep<T>(
  scanId: string,
  stepName: string,
  stepNumber: number,
  totalSteps: number,
  fn: () => Promise<T>,
  options?: { retries?: number; critical?: boolean }
): Promise<T> {
  const retries = options?.retries ?? 1;
  const critical = options?.critical ?? true;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const start = Date.now();
      const result = await fn();
      const durationMs = Date.now() - start;

      // Update progress
      await db.scan.update({
        where: { id: scanId },
        data: { progress: Math.round((stepNumber / totalSteps) * 100) }
      });

      // Log event
      await db.scanEvent.create({
        data: { scanId, event: `step_${stepName}_complete`, metadata: { durationMs, attempt } }
      });

      return result;
    } catch (error) {
      if (attempt === retries) {
        if (critical) throw error;
        // Non-critical: log warning and continue
        await db.scanEvent.create({
          data: { scanId, event: `step_${stepName}_failed`, metadata: { error: error.message } }
        });
        return null as T;
      }
      // Wait before retry
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("Unreachable");
}
```

---

## Module Runner

Each AI module follows this pattern:

```ts
async function runModule(
  scanId: string,
  module: AnalysisModule,
  systemPrompt: string,
  userPrompt: string,
  inputData: any
): Promise<any> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: VOICE_DIRECTIVE + "\n\n" + systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const output = parseJSON(response.content[0].text);

  await db.analysisResult.create({
    data: {
      scanId,
      module,
      output,
      confidence: output.confidence ?? 0.7,
      sources: output.sources ?? [],
      durationMs: response.usage.input_tokens, // tracked separately
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    }
  });

  return output;
}
```

---

## Progress Polling

Frontend polls `GET /api/scan/[id]/status` every 3 seconds while status is PENDING or RUNNING.

```ts
// Response shape
{
  id: string
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL"
  progress: number // 0-100
  currentStep?: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  report?: { id: string } // included when COMPLETED
}
```

---

## Admin Operations

### Rerun Full Scan
1. Reset scan status to PENDING
2. Delete existing AnalysisResults
3. Delete existing Report
4. Re-enqueue job

### Rerun Single Module
1. Delete specific AnalysisResult
2. Call module runner directly with existing inputs
3. If downstream modules exist, flag them as potentially stale

### Regenerate Report
1. Load all existing AnalysisResults
2. Re-run renderReport + generatePdf
3. Create new Report with incremented version

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Website scrape fails | Continue with limited data, flag low confidence |
| AI module fails after retries | Mark step failed, continue if non-critical |
| Critical module fails | Mark scan as FAILED with error message |
| PDF generation fails | Mark scan PARTIAL, report viewable as HTML |
| Full job timeout | Mark scan FAILED, log last completed step |

### Critical modules (scan fails if these fail):
- `companyResearch` (inflection, deal)
- `competitorSnapshot` (teardown)
- `renderReport` (all)

### Non-critical modules (scan continues with warning):
- Upload parsing
- Individual competitor scraping
- Editorial pass
- PDF generation

---

## Concurrency

- Max 5 concurrent scans per environment
- AI module calls: sequential within a scan (dependencies)
- Website scraping: can parallelise (e.g., 3 competitors scraped concurrently)
- PDF generation: sequential (resource-intensive)

---

## Storage

| Artifact | Storage |
|----------|---------|
| Uploaded files | Supabase Storage / S3 |
| Scraped HTML | Postgres (ResearchArtifact.rawHtml) |
| Module outputs | Postgres (AnalysisResult.output as JSON) |
| HTML reports | Postgres (Report.htmlContent) |
| PDF reports | Supabase Storage / S3 |
