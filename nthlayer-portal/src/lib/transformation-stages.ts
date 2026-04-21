// ─── Types ────────────────────────────────────────────────────────────────────
// These mirror the types in strategy-flow-v2.tsx (which are not exported).

export type QuestionType =
  | "single-select"
  | "multi-select"
  | "rank"
  | "free-text"
  | "structured-repeater"
  | "percentage-split";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  question: string;
  hint?: string;
  type: QuestionType;
  options?: QuestionOption[];
  placeholder?: string;
  maxSelections?: number;
  required?: boolean;
}

export interface Stage {
  id: string;
  name: string;
  purpose: string;
  output: string;
  questions: Question[];
  runButtonLabel: string;
  hidden?: boolean;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Shorthand: builds an option where value === label */
const opt = (text: string): QuestionOption => ({ value: text, label: text });

// ─── Stage 1 — Why Now ───────────────────────────────────────────────────────

const WHY_NOW: Stage = {
  id: "why_now",
  name: "Why Now",
  purpose:
    "Understand why AI transformation is urgent now — what pressures, triggers, and costs of inaction are driving the need to act",
  output:
    "Urgency signals, competitive triggers, cost of inaction, people pressure, sector benchmarks",
  runButtonLabel: "Run Why Now Analysis",
  questions: [
    {
      id: "role",
      type: "single-select",
      required: true,
      question: "What is your role?",
      options: [
        opt("CEO / Founder"),
        opt("CTO / CIO"),
        opt("CPO / Product Director"),
        opt("PE Investor / Portfolio Director"),
        opt("VP Engineering / Engineering Director"),
        opt("COO / Operations Director"),
        opt("Board Member / NED"),
        opt("Consultant / Advisor"),
        opt("Other"),
      ],
    },
    {
      id: "org_type",
      type: "single-select",
      required: true,
      question:
        "Are you filling this in for your own organisation, or on behalf of a client?",
      options: [
        opt("My own organisation — I work here"),
        opt("On behalf of a client — I'm a consultant or advisor"),
        opt("For a portfolio company — I'm an investor or board member"),
      ],
    },
    {
      id: "urgency_trigger",
      type: "multi-select",
      required: true,
      question:
        "What has changed in the last 6–12 months that makes AI transformation more urgent?",
      options: [
        opt("A competitor shipped AI features we don't have"),
        opt("The board or investors are asking hard questions"),
        opt("Our team is falling behind on delivery speed"),
        opt("A key customer asked for AI capability"),
        opt("An AI-native startup entered our market"),
        opt("We're losing deals to AI-native alternatives"),
        opt("An AI tool dramatically changed how I personally work"),
        opt("Hiring pressure — candidates asking about AI tooling"),
        opt("Internal team frustration about tooling gaps"),
        opt("Regulatory or compliance pressure is emerging"),
        opt("We've spent budget on AI tools with little to show for it"),
      ],
    },
    {
      id: "leadership_agenda",
      type: "single-select",
      required: true,
      question:
        "How high is AI transformation on your leadership agenda right now?",
      options: [
        opt("Top of agenda — leadership personally driving it"),
        opt("High — on the roadmap and resourced"),
        opt("Medium — discussed regularly but not resourced"),
        opt("Low — mentioned occasionally nothing moving"),
        opt("Not yet on the agenda"),
      ],
    },
    {
      id: "blockers",
      type: "multi-select",
      required: false,
      question:
        "What is blocking AI transformation from moving faster?",
      options: [
        opt("No clear owner or accountable person"),
        opt("Budget not approved"),
        opt("Leadership team not aligned"),
        opt("Team capacity consumed by delivery commitments"),
        opt("No clear ROI or business case"),
        opt("Uncertainty about which tools or approaches to use"),
        opt("Fear of disrupting existing workflows"),
        opt("Data infrastructure not ready"),
        opt("Skills gap — team not ready to use AI effectively"),
        opt("Previous AI initiative failed and we lost confidence"),
      ],
    },
    {
      id: "cost_of_waiting",
      type: "multi-select",
      required: false,
      question: "What gets worse if you wait another 12 months?",
      options: [
        opt("Competitors pull further ahead — gap becomes structural"),
        opt("Talent attraction and retention gets harder"),
        opt("Customer expectations move beyond what we offer"),
        opt("Engineering velocity gap vs AI-native teams widens"),
        opt("Churn risk increases as AI-native alternatives mature"),
        opt("We miss the compounding benefits of early adoption"),
        opt("Our cost base looks high as AI makes teams leaner everywhere else"),
        opt("Board or investor confidence erodes without a clear AI story"),
        opt("Nothing urgent — we have time"),
      ],
    },
    {
      id: "talent_pressure",
      type: "multi-select",
      required: false,
      question:
        "Is your ability to attract or retain AI-capable people becoming a problem?",
      options: [
        opt("Candidates asking about AI tooling in interviews"),
        opt("Engineers leaving for AI-native companies"),
        opt("Senior technical hiring is getting harder"),
        opt("Compensation expectations rising"),
        opt("Internal team frustration about tooling gaps"),
        opt("Skills gap emerging between team and market"),
        opt("Not yet — no strong signals on this"),
      ],
    },
    {
      id: "competitor_lean",
      type: "single-select",
      required: false,
      question:
        "Are competitors using AI to run leaner teams while matching your delivery speed?",
      options: [
        opt("Yes clearly — evidence in the market and in hiring"),
        opt("Probably — seeing signals but not definitive"),
        opt("Unsure — aware of the risk but limited visibility"),
        opt("Not yet — no strong signals in our market"),
        opt("No — our sector isn't AI-affected in this way yet"),
      ],
    },
    {
      id: "leadership_engagement",
      type: "single-select",
      required: false,
      question:
        "How personally engaged is your leadership team with AI — in how they actually work, not just as a talking point?",
      options: [
        opt("Most of leadership are personally using AI tools in daily work"),
        opt("A few leaders are genuinely engaged — most are watching"),
        opt("Leadership talks about AI but few have changed how they work"),
        opt("Interested but not personally engaged"),
        opt("No real personal engagement across the leadership team"),
      ],
    },
    {
      id: "delivery_speed",
      type: "single-select",
      required: true,
      question:
        "How does your current delivery speed compare to where it needs to be?",
      options: [
        opt("Way too slow — competitors are shipping circles around us"),
        opt("Behind but improving — we're closing the gap"),
        opt("Broadly OK — keeps pace with our market for now"),
        opt("Faster than most — speed is a current advantage"),
        opt("Not sure — no good benchmark to compare against"),
      ],
    },
    {
      id: "process_bottlenecks",
      type: "multi-select",
      required: false,
      question:
        "Which process bottlenecks are making the urgency to change most acute right now?",
      options: [
        opt("Slow code review and approval cycles"),
        opt("Manual testing slowing down releases"),
        opt("Poor tooling reducing team productivity"),
        opt("Knowledge silos — too much held in people's heads"),
        opt("Slow onboarding — new hires take too long to contribute"),
        opt("No reliable CI/CD — deploys are risky and manual"),
        opt("Accumulated tech debt slowing every change"),
        opt("Too much coordination overhead — meetings eating delivery time"),
        opt("No acute process pain — processes are working reasonably well"),
      ],
    },
    {
      id: "competitor_ai",
      type: "multi-select",
      required: false,
      question:
        "What are your closest competitors doing with AI that you aren't?",
      options: [
        opt("Shipping AI-powered product features we don't have"),
        opt("Running leaner teams at equivalent output"),
        opt("Faster product iteration cycles"),
        opt("AI-native customer experience and support"),
        opt("Using AI in sales and marketing at scale"),
        opt("Better data analytics and insights for customers"),
        opt("Building AI-native product capabilities from the ground up"),
        opt("Ahead on AI talent and hiring"),
        opt("Not sure — limited visibility on competitors"),
        opt("Not much — we're broadly comparable"),
      ],
    },
    {
      id: "customer_expectations",
      type: "multi-select",
      required: false,
      question:
        "Are your customers starting to expect AI-native features or service from you?",
      options: [
        opt("Asking about AI features in sales calls"),
        opt("Comparing us to AI-native competitors"),
        opt("Support volume rising — customers expect automation we don't have"),
        opt("Enterprise buyers asking about AI roadmap"),
        opt("Requesting API or integration access"),
        opt("At-risk accounts citing lack of AI features"),
        opt("Not yet — customers haven't raised this"),
      ],
    },
    {
      id: "replaceability",
      type: "multi-select",
      required: false,
      question:
        "Which parts of your current product could an AI-native startup replicate or replace in 18 months?",
      options: [
        opt("Rules-based or conditional logic (AI can generalise it)"),
        opt("Manual data entry or extraction"),
        opt("Report generation and data analysis"),
        opt("Document processing and classification"),
        opt("Customer-facing search or discovery"),
        opt("Content generation or personalisation"),
        opt("First-line support and triage"),
        opt("Workflow orchestration and approval processes"),
        opt("Onboarding and configuration flows"),
        opt("Not sure — hard to assess"),
        opt("Low risk — our product is defensible"),
      ],
    },
  ],
};

// ─── Stage 2 — Current State ─────────────────────────────────────────────────

const CURRENT_STATE: Stage = {
  id: "current_state",
  name: "Current State",
  purpose:
    "Establish an honest baseline of process maturity, AI tooling depth, product management function, stack readiness, and exposure",
  output:
    "Process maturity assessment, AI tooling depth, PM function analysis, stack readiness, exposure map",
  runButtonLabel: "Run Current State Analysis",
  questions: [
    {
      id: "business_stage",
      type: "single-select",
      required: true,
      question: "What stage is the business at right now?",
      options: [
        opt("Early stage — still finding product-market fit"),
        opt("Growth — scaling a proven model"),
        opt("Scale — optimising and expanding an established business"),
        opt("Mature / enterprise — large complex established"),
        opt("Turnaround — restructuring or repositioning"),
      ],
    },
    {
      id: "annual_revenue",
      type: "single-select",
      required: true,
      question: "What is the business's approximate annual revenue?",
      options: [
        opt("Pre-revenue"),
        opt("Under £1m"),
        opt("£1m – £5m"),
        opt("£5m – £10m"),
        opt("£10m – £25m"),
        opt("£25m – £50m"),
        opt("£50m – £100m"),
        opt("Over £100m"),
        opt("Prefer not to say"),
      ],
    },
    {
      id: "ai_spend",
      type: "single-select",
      required: false,
      question:
        "How much is the organisation spending on AI tools per month?",
      options: [
        opt("Nothing — no current AI spend"),
        opt("Under £500/month"),
        opt("£500 – £2,000/month"),
        opt("£2,000 – £5,000/month"),
        opt("£5,000 – £15,000/month"),
        opt("Over £15,000/month"),
        opt("Not sure — no clear view of total AI spend"),
      ],
    },
    {
      id: "prior_assessment",
      type: "single-select",
      required: false,
      question:
        "Have you done a formal AI readiness or transformation assessment before?",
      options: [
        opt("No — this is the first time"),
        opt("Yes — internal self-assessment"),
        opt("Yes — external consultant or advisory firm"),
        opt("Yes — another tool or platform"),
        opt("Partial — some elements but not a full assessment"),
      ],
    },
    {
      id: "ai_maturity",
      type: "single-select",
      required: false,
      question:
        "How would you describe your organisation's overall AI maturity today?",
      options: [
        opt("Exploring — awareness but no consistent use yet"),
        opt("Experimenting — pilots running nothing embedded"),
        opt("Embedding — AI in some workflows patchy adoption"),
        opt("Operating — AI embedded in core workflows measurable impact"),
        opt("Leading — AI is a genuine competitive differentiator"),
      ],
    },
    {
      id: "dev_process",
      type: "multi-select",
      required: true,
      question:
        "What best describes how you go from idea to production?",
      options: [
        opt("Work is formally spec'd before engineering starts"),
        opt("Work tracked in Jira or Linear with tickets and sprints"),
        opt("Specs and documentation live in Notion or Confluence"),
        opt("Code goes through PR review before merging"),
        opt("CI/CD pipeline runs automated checks on every commit"),
        opt("Feature flags used to control rollout"),
        opt("Trunk-based development — short-lived branches"),
        opt("Dedicated QA or testing function before release"),
        opt("Post-release review or retrospectives are standard"),
        opt("Largely ad hoc — no consistent process"),
      ],
    },
    {
      id: "cycle_time",
      type: "single-select",
      required: false,
      question:
        "What's your typical cycle time from scoped work to shipped?",
      options: [
        opt("Days — we ship very fast"),
        opt("1–2 weeks"),
        opt("2–4 weeks"),
        opt("4+ weeks"),
        opt("Highly variable — no consistent rhythm"),
      ],
    },
    {
      id: "deploy_frequency",
      type: "single-select",
      required: false,
      question: "How frequently do you deploy to production?",
      options: [
        opt("Multiple times a day"),
        opt("Daily"),
        opt("Weekly"),
        opt("Fortnightly"),
        opt("Monthly or less"),
      ],
    },
    {
      id: "code_review",
      type: "multi-select",
      required: false,
      question: "What best describes your code review process?",
      options: [
        opt("Reviews typically take 1+ day to complete"),
        opt("Only senior engineers do meaningful reviews"),
        opt("Automated checks (lint tests) run on every PR"),
        opt("Reviews are substantive — logic not just style"),
        opt("Mostly style comments limited logic review"),
        opt("PRs frequently sit unreviewed for extended periods"),
        opt("AI tools assist with review (Copilot CodeRabbit etc.)"),
        opt("Mandatory approval before merge is enforced"),
      ],
    },
    {
      id: "onboarding_time",
      type: "single-select",
      required: false,
      question:
        "How long until a new engineer is making meaningful contributions?",
      options: [
        opt("Under 1 week to first PR"),
        opt("1–2 weeks to first PR 1 month to meaningful features"),
        opt("2–4 weeks to first PR 2+ months to meaningful features"),
        opt("A month or more before contributing meaningfully"),
        opt("No structured onboarding — entirely ad hoc"),
      ],
    },
    {
      id: "tools",
      type: "multi-select",
      required: true,
      question: "Which tools does your team use?",
      options: [
        opt("GitHub"),
        opt("GitLab"),
        opt("Linear"),
        opt("Jira"),
        opt("Notion"),
        opt("Confluence"),
        opt("Slack"),
        opt("Figma"),
        opt("Vercel"),
        opt("AWS"),
        opt("GCP"),
        opt("Azure"),
        opt("Datadog"),
        opt("Sentry"),
        opt("Mixpanel"),
        opt("Amplitude"),
        opt("HubSpot"),
        opt("Salesforce"),
        opt("Zendesk"),
        opt("Intercom"),
        opt("Segment"),
        opt("Stripe"),
        opt("Miro"),
        opt("ProductBoard"),
        opt("GitHub Actions"),
        opt("Cursor"),
        opt("Windsurf"),
        opt("GitHub Copilot"),
        opt("Claude (Anthropic)"),
        opt("ChatGPT / OpenAI"),
        opt("Perplexity"),
        opt("v0 (Vercel)"),
        opt("Lovable"),
        opt("Replit"),
        opt("Bolt"),
      ],
    },
    {
      id: "ai_usage_functions",
      type: "multi-select",
      required: true,
      question:
        "Which functions have team members actively using AI tools in their day-to-day work?",
      options: [
        opt("Engineering — code completion (Copilot Cursor etc.)"),
        opt("Engineering — AI-assisted code review or debugging"),
        opt("Engineering — AI-assisted test writing"),
        opt("Product — spec writing and requirements drafting"),
        opt("Product — customer research synthesis"),
        opt("Design — image generation or prototyping"),
        opt("Support — response drafting or ticket triage"),
        opt("Sales — outreach proposals or call preparation"),
        opt("Operations — data analysis and reporting"),
        opt("Leadership — meeting summaries and research"),
        opt("None — AI tools aren't in active use in practice"),
      ],
    },
    {
      id: "ai_integration",
      type: "single-select",
      required: false,
      question:
        "Are your AI tools integrated into existing workflows — or separate tabs?",
      options: [
        opt("Fully integrated — AI is inside our existing tools"),
        opt("Partially — some integrations but lots of manual context-switching"),
        opt("Mostly separate tabs people use alongside their work"),
        opt("Honestly not sure — it varies by person"),
      ],
    },
    {
      id: "failed_experiments",
      type: "multi-select",
      required: false,
      question:
        "Which of these describe AI experiments that haven't stuck?",
      options: [
        opt("Deployed a tool but the team didn't use it"),
        opt("AI output quality wasn't good enough to trust"),
        opt("No clear workflow to integrate AI into"),
        opt("Champion left or moved on and it died"),
        opt("Hard to measure the benefit"),
        opt("Data access or privacy issues blocked it"),
        opt("Leadership didn't actively use or support it"),
        opt("Too much manual effort to get value"),
        opt("Hackathon built something — nothing shipped"),
        opt("We haven't really tried yet"),
      ],
    },
    {
      id: "repetitive_tasks",
      type: "multi-select",
      required: false,
      question:
        "What repetitive tasks does your team do every week that they actively dislike?",
      options: [
        opt("Writing release notes"),
        opt("Generating status reports"),
        opt("Tagging and triaging support tickets"),
        opt("Manually updating roadmap decks"),
        opt("Chasing PRs and review sign-off"),
        opt("Writing meeting summaries and follow-ups"),
        opt("Writing test cases and test descriptions"),
        opt("Manual data entry or reporting"),
        opt("Creating onboarding and documentation"),
        opt("Sprint planning admin and backlog grooming"),
      ],
    },
    {
      id: "ai_policy",
      type: "single-select",
      required: false,
      question: "Do you have a published AI acceptable use policy?",
      options: [
        opt("Yes — published policy with a named owner"),
        opt("Yes — something exists but no clear owner"),
        opt("In progress — being drafted now"),
        opt("No — but it's on the roadmap"),
        opt("No — not yet considered"),
      ],
    },
    {
      id: "ai_compliance",
      type: "single-select",
      required: false,
      question:
        "Has any AI vendor or tool been reviewed for GDPR or EU AI Act compliance in the last 12 months?",
      options: [
        opt("Yes — all AI tools go through a formal review"),
        opt("Yes — some reviews done not systematic"),
        opt("No — aware we should but haven't started"),
        opt("No — and haven't considered it"),
        opt("Not applicable to our context"),
      ],
    },
    {
      id: "ai_accountability",
      type: "single-select",
      required: false,
      question:
        "Who is accountable at executive or board level for AI compliance incidents?",
      options: [
        opt("CEO"),
        opt("CTO"),
        opt("COO"),
        opt("General Counsel"),
        opt("CISO"),
        opt("Board subcommittee"),
        opt("No named role"),
      ],
    },
    {
      id: "data_infrastructure",
      type: "single-select",
      required: false,
      question: "Where does your core operational data live?",
      options: [
        opt("Modern cloud platform — centralised accessible clean"),
        opt("Mix of cloud and on-prem — mostly accessible via API"),
        opt("Siloed by team or system — extraction is manual in places"),
        opt("Mostly locked in legacy systems — hard to get to"),
        opt("Not sure — no clear data architecture picture"),
      ],
    },
    {
      id: "api_access",
      type: "single-select",
      required: false,
      question:
        "Can your core systems send and receive data via API?",
      options: [
        opt("API-first — everything is accessible programmatically"),
        opt("Mostly — main systems have APIs some gaps remain"),
        opt("Partial — some APIs a lot still manual or CSV export"),
        opt("Mostly manual — APIs are the exception"),
        opt("No meaningful API access to core data"),
      ],
    },
    {
      id: "data_governance",
      type: "single-select",
      required: false,
      question:
        "What best describes your data quality and governance maturity?",
      options: [
        opt("Mature — data dictionary regular audits named ownership"),
        opt("Improving — initiative underway some governance in place"),
        opt("Aware but not started — known problem not resourced"),
        opt("Not on the radar"),
        opt("Not applicable"),
      ],
    },
    {
      id: "autonomous_workflows",
      type: "multi-select",
      required: false,
      question:
        "Which workflow types could realistically run autonomously with AI?",
      options: [
        opt("Nightly data quality checks and alerts"),
        opt("Customer onboarding sequences"),
        opt("Monitoring and incident alerting"),
        opt("Invoice or financial reconciliation"),
        opt("Support ticket classification and routing"),
        opt("Lead scoring and nurture sequences"),
        opt("Report generation and distribution"),
        opt("Compliance or regulatory reporting"),
        opt("Inventory or resource forecasting"),
        opt("None obvious yet — workflows require too much human judgment"),
      ],
    },
    {
      id: "human_checkpoints",
      type: "single-select",
      required: false,
      question:
        "Where AI is involved in decisions today, are there human approval checkpoints?",
      options: [
        opt("Yes — human review gates are defined and consistently applied"),
        opt("Informally — it happens but isn't documented"),
        opt("Varies by team"),
        opt("No — AI output is acted on without a formal review step"),
        opt("Not applicable — AI isn't involved in decisions yet"),
      ],
    },
    {
      id: "ai_fix_speed",
      type: "single-select",
      required: false,
      question:
        "If an AI system produced consistently wrong output, how quickly could you fix and redeploy?",
      options: [
        opt("Hours — strong observability fast pipeline"),
        opt("1–3 days"),
        opt("Days to a week"),
        opt("Weeks — no monitoring slow change control"),
        opt("Not sure — no AI systems running yet"),
      ],
    },
    {
      id: "pm_function",
      type: "single-select",
      required: true,
      question:
        "What does your PM function spend most of its time on?",
      options: [
        opt("Customer research and discovery"),
        opt("Writing specs and managing backlogs"),
        opt("Managing stakeholders and alignment"),
        opt("Reviewing delivery and chasing engineering"),
        opt("A roughly equal mix of all four"),
        opt("We don't have a dedicated PM function"),
      ],
    },
    {
      id: "discovery_process",
      type: "multi-select",
      required: false,
      question:
        "What does your discovery process actually include?",
      options: [
        opt("Regular customer interviews (monthly or more)"),
        opt("AI synthesis of customer research or call recordings"),
        opt("Competitor feature tracking"),
        opt("Usage analytics analysis"),
        opt("Sales call recordings and transcription review"),
        opt("NPS or CSAT follow-up interviews"),
        opt("Product analytics (heatmaps session recordings)"),
        opt("External user testing panel"),
        opt("None — mostly reactive to sales and exec requests"),
      ],
    },
    {
      id: "roadmap_prioritisation",
      type: "single-select",
      required: false,
      question: "How is your roadmap prioritised?",
      options: [
        opt("Data-driven — usage metrics and customer evidence"),
        opt("Customer evidence — mostly qualitative research"),
        opt("Executive opinion and strategic calls"),
        opt("Gut feel and team intuition"),
        opt("Sales-driven — biggest customer asks"),
      ],
    },
    {
      id: "ai_product_opportunity",
      type: "multi-select",
      required: false,
      question:
        "What is your biggest AI product opportunity with customers right now?",
      options: [
        opt("Automating manual data entry or extraction customers do today"),
        opt("AI-powered search or discovery within the product"),
        opt("Personalisation at scale for customer experience"),
        opt("Automated report or insight generation"),
        opt("AI-assisted workflow or approval routing"),
        opt("Intelligent triage or prioritisation"),
        opt("Natural language interaction with existing features"),
        opt("AI-powered onboarding or configuration"),
        opt("Predictive analytics or forecasting for customers"),
        opt("Not clear yet — haven't identified the opportunity"),
      ],
    },
    {
      id: "stack_modernity",
      type: "single-select",
      required: false,
      question: "How technically modern is your core stack?",
      options: [
        opt("Modern cloud-native — could embed AI without major changes"),
        opt("Service-based — possible but would need new APIs and infra"),
        opt("Mixed — some modern parts some legacy needing refactoring"),
        opt("Legacy monolith — embedding AI would require major rework"),
      ],
    },
    {
      id: "metrics_tracked",
      type: "multi-select",
      required: true,
      question:
        "Which of these metrics does your leadership team actively track?",
      options: [
        opt("MRR / ARR"),
        opt("Churn rate"),
        opt("NRR"),
        opt("DAU/MAU"),
        opt("Feature adoption"),
        opt("Activation rate"),
        opt("NPS/CSAT"),
        opt("Support volume"),
        opt("Engineering velocity"),
        opt("None — no consistent metrics dashboard"),
      ],
    },
    {
      id: "feature_measurement",
      type: "multi-select",
      required: false,
      question:
        "How do you measure whether a feature worked after shipping?",
      options: [
        opt("Product analytics"),
        opt("Feature adoption tracking"),
        opt("Customer interviews"),
        opt("NPS change"),
        opt("Support ticket themes"),
        opt("A/B testing"),
        opt("Sales win/loss"),
        opt("Manual PM review"),
        opt("We don't have a consistent process"),
      ],
    },
    {
      id: "outcome_gaps",
      type: "multi-select",
      required: false,
      question:
        "Which of these outcome gaps best describes where you are?",
      options: [
        opt("Customers still do manually what we've tried to automate"),
        opt("Features ship but adoption remains low"),
        opt("We can measure output but not customer outcomes"),
        opt("Support volume hasn't fallen despite self-serve investments"),
        opt("Retention isn't improving despite product investment"),
        opt("Time-to-value for new customers remains long"),
        opt("Not sure — we don't measure outcomes consistently"),
      ],
    },
    {
      id: "performance_measurement",
      type: "single-select",
      required: false,
      question:
        "How is individual and team performance measured?",
      options: [
        opt("Outcome-driven — team measured on metrics moved"),
        opt("Mixed — OKRs exist but delivery output is what's celebrated"),
        opt("Output-driven — velocity story points features shipped"),
        opt("Ambiguous — no consistent approach"),
        opt("Not really defined"),
      ],
    },
    {
      id: "ai_change_makers",
      type: "multi-select",
      required: true,
      question:
        "Which functions have people who've genuinely changed how they work because of AI?",
      options: [
        opt("Engineering"),
        opt("Product"),
        opt("Design"),
        opt("Support"),
        opt("Sales"),
        opt("Operations"),
        opt("Leadership"),
        opt("Nobody has genuinely changed how they work yet"),
      ],
    },
    {
      id: "ai_adoption_spread",
      type: "single-select",
      required: false,
      question:
        "Is AI tool adoption consistent across your engineering team, or concentrated in a few people?",
      options: [
        opt("Consistent — most of the team uses AI tools regularly"),
        opt("Majority — more than half"),
        opt("Concentrated — a few champions most not using"),
        opt("One or two people only"),
        opt("Not used at all in practice"),
      ],
    },
    {
      id: "ai_proposal_reaction",
      type: "single-select",
      required: false,
      question:
        "When someone proposes using AI for a new task, what's the typical reaction?",
      options: [
        opt("Enthusiasm — people lean in and want to try it"),
        opt("Pragmatic — interest if it solves a real problem"),
        opt("Indifference — polite interest nothing happens"),
        opt("Scepticism — pushback on quality trust or relevance"),
        opt("Depends entirely on who's proposing it"),
      ],
    },
    {
      id: "leadership_ai_usage",
      type: "multi-select",
      required: false,
      question:
        "Which leadership roles are actively using AI in their own work this week?",
      options: [
        opt("CEO"),
        opt("CTO"),
        opt("CPO"),
        opt("COO"),
        opt("CFO"),
        opt("VP Engineering"),
        opt("Head of Product"),
        opt("Head of Design"),
        opt("Head of Sales"),
        opt("None — leadership talk about AI but aren't personal users"),
      ],
    },
  ],
};

// ─── Stage 3 — Future Moves ──────────────────────────────────────────────────

const FUTURE_MOVES: Stage = {
  id: "future_moves",
  name: "Future Moves",
  purpose:
    "Identify the highest-value AI transformation opportunities across process, product, and people — and prioritise with STOPs, DOs, and IGNOREs",
  output:
    "Workflow automation opportunities, product capability unlocks, build/buy/partner options, prioritised move portfolio",
  runButtonLabel: "Run Future Moves Analysis",
  questions: [
    {
      id: "success_outcomes",
      type: "multi-select",
      required: true,
      question:
        "Which business outcomes would define AI transformation as a genuine success?",
      options: [
        opt("Engineering cycle time significantly reduced (30%+ faster)"),
        opt("PM team running significantly more validated experiments per quarter"),
        opt("Customer time-to-value measurably shorter"),
        opt("Churn reduced through AI-powered customer success"),
        opt("Revenue per employee improved through AI-augmented teams"),
        opt("AI product features shipped and measuring customer impact"),
        opt("Team able to serve more customers without proportional headcount growth"),
        opt("Competitive parity or leadership on AI-powered product features"),
        opt("Board-ready evidence of a measurable transformation story"),
      ],
    },
    {
      id: "build_buy_partner",
      type: "single-select",
      required: false,
      question:
        "What's your instinct on build vs buy vs partner for AI capability?",
      options: [
        opt("Prefer to build — strong engineering team and want control"),
        opt("Prefer to buy — move fast with vendor solutions"),
        opt("Open to partnership — capability gaps we'd rather bring in"),
        opt("Depends on the specific problem"),
        opt("No strong view yet"),
      ],
    },
    {
      id: "time_saving_workflows",
      type: "multi-select",
      required: true,
      question:
        "Which workflows, if AI-automated, would give your team back the most time?",
      options: [
        opt("Writing and maintaining tests"),
        opt("Code review and PR descriptions"),
        opt("Sprint reporting and planning admin"),
        opt("Ticket triage and prioritisation"),
        opt("First-line customer support responses"),
        opt("Writing and updating documentation"),
        opt("Employee and customer onboarding"),
        opt("Data analysis and reporting"),
        opt("Content and copy creation"),
        opt("Sales collateral and proposal writing"),
      ],
    },
    {
      id: "product_unlocks",
      type: "multi-select",
      required: false,
      question:
        "Which product capabilities would an AI-equipped team unlock that you can't deliver today?",
      options: [
        opt("Faster prototyping — more experiments per quarter"),
        opt("Better discovery — AI synthesis of customer evidence"),
        opt("More confident deploys — automated quality checks"),
        opt("Personalisation at scale for product experience"),
        opt("Real-time analytics and insight generation"),
        opt("AI-powered customer support (deflection and resolution)"),
        opt("Faster onboarding for new team members"),
        opt("Ship faster without quality drop"),
      ],
    },
    {
      id: "team_capability",
      type: "multi-select",
      required: false,
      question:
        "What team capability change matters most in the next 12 months?",
      options: [
        opt("Every engineer using AI tools in daily workflow"),
        opt("PMs using AI for discovery and synthesis"),
        opt("Leadership with a genuine personal AI practice"),
        opt("Design using AI for rapid prototyping"),
        opt("Ops function running AI-automated reporting"),
        opt("Sales team using AI for outreach and proposals"),
        opt("A dedicated AI/ML function built or hired"),
        opt("AI champion programme across the organisation"),
      ],
    },
    {
      id: "augmented_team",
      type: "multi-select",
      required: false,
      question:
        "What could an AI-augmented team achieve that your current team can't?",
      options: [
        opt("3x more experiments per quarter — faster product-market fit"),
        opt("Support 2x more customers without doubling support headcount"),
        opt("Run continuous user research without a dedicated researcher"),
        opt("Ship AI product features that would otherwise need a specialist team"),
        opt("Generate board-quality reporting automatically from existing data"),
        opt("Onboard new team members in half the time"),
        opt("Catch and fix production issues before customers notice"),
        opt("Personalise the product experience at a scale we can't afford manually"),
      ],
    },
  ],
};

// ─── Stage 4 — Mobilise ─────────────────────────────────────────────────────

const MOBILISE: Stage = {
  id: "mobilise",
  name: "Mobilise",
  purpose:
    "Assess leadership alignment, sponsor conviction, resistance patterns, and 90-day stall risk to ensure the transformation can actually move",
  output:
    "Leadership alignment scores, sponsor conviction assessment, resistance map, 90-day stall risk analysis",
  runButtonLabel: "Run Mobilise Analysis",
  questions: [
    {
      id: "stall_risk",
      type: "multi-select",
      required: false,
      question:
        "What would make this stall in the first 90 days?",
      options: [
        opt("Sponsor loses focus when next quarterly delivery push hits"),
        opt("No dedicated capacity — team already full"),
        opt("Budget never formally released"),
        opt("Technical leadership blocks tooling changes"),
        opt("Team too sceptical — adoption doesn't materialise"),
        opt("No quick wins in the first 30 days"),
        opt("Competing transformation programmes running simultaneously"),
        opt("Leadership misalignment surfaces once real decisions are required"),
      ],
    },
    {
      id: "budget_unlock",
      type: "multi-select",
      required: true,
      question:
        "What would unlock meaningful budget commitment in the next 90 days?",
      options: [
        opt("A clear ROI model showing payback period"),
        opt("A competitor making a visible AI move"),
        opt("A board mandate or investor expectation"),
        opt("A pilot proving meaningful productivity gains"),
        opt("External benchmark showing we're behind market"),
        opt("A key customer asking for AI capability"),
        opt("A specific business risk being named and quantified"),
        opt("Executive sponsor personally committing to the investment"),
      ],
    },
    {
      id: "change_track_record",
      type: "single-select",
      required: false,
      question:
        "What best describes your track record with significant change initiatives?",
      options: [
        opt("Strong — we've successfully landed multiple significant changes"),
        opt("Mixed — some succeeded some stalled at implementation"),
        opt("Weak — most change initiatives have lost momentum"),
        opt("No track record — we haven't attempted change at this scale"),
        opt("Not sure — leadership team is relatively new"),
      ],
    },
    {
      id: "change_stall_causes",
      type: "multi-select",
      required: false,
      question:
        "When change has stalled before, what caused it?",
      options: [
        opt("Sponsor lost interest when quarterly pressure hit"),
        opt("No dedicated capacity — team too busy with delivery"),
        opt("Budget cut or never formally approved"),
        opt("Leadership misalignment surfaced once real decisions were required"),
        opt("Team wasn't bought in — adoption didn't materialise"),
        opt("No quick wins in the first 30 days"),
        opt("No prior change initiatives to compare"),
      ],
    },
    {
      id: "product_roadmap_ai",
      type: "single-select",
      required: true,
      question:
        "What is the current state of AI on your product roadmap?",
      options: [
        opt("Not on the roadmap"),
        opt("Vague aspiration — mentioned in strategy but not scoped"),
        opt("Exploring — discovery underway nothing committed"),
        opt("Committed — on the roadmap but not yet started"),
        opt("In progress — AI features actively being built"),
        opt("Already shipped — AI features live with customers"),
      ],
    },
    {
      id: "product_ai_capability",
      type: "multi-select",
      required: false,
      question:
        "Does your product team have the capability to lead AI product decisions?",
      options: [
        opt("PMs understand AI capabilities and limitations"),
        opt("Product team has shipped AI features before"),
        opt("Design team has AI/UX experience"),
        opt("Engineering team can build and integrate AI features"),
        opt("Needs training — product team lacks AI knowledge"),
        opt("Needs hiring — capability gaps that can't be upskilled"),
        opt("Would benefit from external AI product expertise"),
        opt("Not sure — haven't assessed this yet"),
      ],
    },
    {
      id: "leadership_engaged",
      type: "multi-select",
      required: true,
      question:
        "Which C-suite and leadership functions are genuinely engaged with AI — personal usage, not just expressed interest?",
      options: [
        opt("CEO"),
        opt("CTO"),
        opt("CPO"),
        opt("COO"),
        opt("CFO"),
        opt("VP Engineering"),
        opt("Head of Product"),
        opt("Head of Sales"),
        opt("Board members"),
        opt("None — no leadership function is genuinely engaged"),
      ],
    },
    {
      id: "sponsor",
      type: "single-select",
      required: false,
      question:
        "Who would be the primary sponsor for this transformation?",
      options: [
        opt("CEO"),
        opt("CTO"),
        opt("CPO"),
        opt("COO"),
        opt("VP Engineering"),
        opt("Head of Product"),
        opt("External board member"),
        opt("Unclear — no named sponsor yet"),
      ],
    },
    {
      id: "sponsor_conviction",
      type: "single-select",
      required: false,
      question:
        "How would you characterise the sponsor's conviction?",
      options: [
        opt("Genuine — they believe it and are personally driving it"),
        opt("Genuine but stretched — competing priorities may slow them"),
        opt("Primarily board-facing — responding to external pressure"),
        opt("Uncertain — hard to tell how deep the conviction runs"),
        opt("No sponsor yet — this hasn't been named"),
      ],
    },
    {
      id: "resistance_source",
      type: "multi-select",
      required: false,
      question:
        "Where is resistance most likely to come from?",
      options: [
        opt("CTO / Engineering leadership — protective of current culture"),
        opt("Product leadership — concerns about team relevance"),
        opt("Finance — ROI scepticism budget pressure"),
        opt("Operations — risk aversion and process disruption"),
        opt("Sales — fear of changing what works"),
        opt("Engineering team — concerns about job security"),
        opt("Legal / Compliance — risk and liability concerns"),
        opt("Board — competing priorities short-term focus"),
        opt("No significant resistance expected"),
      ],
    },
    {
      id: "engineering_culture",
      type: "single-select",
      required: false,
      question:
        "How does your engineering culture typically respond to significant change?",
      options: [
        opt("Embraces change — quick to adopt new tools and practices"),
        opt("Cautious but open — needs proof before committing"),
        opt("Change-resistant — prefers established ways of working"),
        opt("Fragmented — depends heavily on team or tech lead"),
        opt("Reactive — follows what leadership mandates no organic change"),
      ],
    },
    {
      id: "decision_making",
      type: "single-select",
      required: false,
      question:
        "How does the leadership team make hard calls under uncertainty?",
      options: [
        opt("Data-driven — waits for evidence before committing"),
        opt("Consensus-driven — aligns the full leadership team before moving"),
        opt("Individual authority — one or two people call it"),
        opt("Political — whoever has the most influence wins"),
        opt("Inconsistent — varies by situation and stakes"),
      ],
    },
    {
      id: "org_size",
      type: "single-select",
      required: false,
      question: "How many people are in the organisation?",
      options: [
        opt("1–10"),
        opt("11–25"),
        opt("26–50"),
        opt("51–100"),
        opt("101–250"),
        opt("251–500"),
        opt("500+"),
      ],
    },
  ],
};

// ─── Stage 5 — Embed ────────────────────────────────────────────────────────

const EMBED: Stage = {
  id: "embed",
  name: "Embed",
  purpose:
    "Define success criteria, measurement frameworks, baseline evidence inventory, and board proof points to ensure the transformation sticks",
  output:
    "Success criteria, measurement framework, baseline evidence inventory, board proof points",
  runButtonLabel: "Run Embed Analysis",
  questions: [
    {
      id: "success_criteria",
      type: "multi-select",
      required: true,
      question:
        "Which 12-month outcomes would define AI transformation as genuinely successful?",
      options: [
        opt("Engineering cycle time measurably reduced (30%+ faster)"),
        opt("PM team running significantly more validated experiments"),
        opt("AI tooling adoption consistent across the engineering team"),
        opt("AI-powered product features shipped with measured customer impact"),
        opt("Support deflection improved by AI self-serve"),
        opt("Team able to serve more customers without proportional headcount growth"),
        opt("Leadership has a documented working AI practice"),
        opt("Board deck shows a measurable transformation story"),
      ],
    },
    {
      id: "baseline_data",
      type: "multi-select",
      required: false,
      question:
        "What baseline data do you have today to measure against?",
      options: [
        opt("Current cycle time from Jira or Linear"),
        opt("Current deploy frequency from GitHub or CI/CD"),
        opt("Current NPS or CSAT score"),
        opt("Current support ticket volume and resolution time"),
        opt("Current churn rate"),
        opt("Current DAU/MAU or activation metrics"),
        opt("Current engineering headcount and cost"),
        opt("AI tool usage baseline (or confirmed zero)"),
        opt("None — no current baselines we can measure against"),
      ],
    },
    {
      id: "board_evidence",
      type: "multi-select",
      required: false,
      question:
        "What would a sceptical board member point to as evidence this actually worked?",
      options: [
        opt("Engineering cycle time with a before/after number"),
        opt("Revenue from AI-enabled product features"),
        opt("Team size vs customer count ratio (productivity per person)"),
        opt("NPS or retention improvement linked to AI capability"),
        opt("Specific AI features launched with measured adoption"),
        opt("Cost reduction from AI-automated workflows"),
        opt("Team survey showing AI tool adoption and satisfaction"),
        opt("Benchmark showing we're ahead of industry peers"),
      ],
    },
    {
      id: "velocity_measurement",
      type: "multi-select",
      required: false,
      question:
        "How will you measure improvement in engineering velocity and delivery quality?",
      options: [
        opt("DORA metrics (deploy frequency lead time change failure rate MTTR)"),
        opt("Cycle time from ticket creation to production"),
        opt("PR review time reduction"),
        opt("Bug escape rate (defects reaching production)"),
        opt("Automated test coverage over time"),
        opt("Engineer-reported time savings from AI tooling"),
        opt("Onboarding time for new engineers"),
        opt("No plan yet — need to define these"),
      ],
    },
    {
      id: "product_measurement",
      type: "multi-select",
      required: false,
      question:
        "How will you measure product capability change or customer outcome improvement?",
      options: [
        opt("Feature adoption rates post-launch"),
        opt("Customer time-to-value (activation metric)"),
        opt("NPS or CSAT improvement"),
        opt("Support ticket deflection rate"),
        opt("Revenue from AI-enabled features"),
        opt("Churn rate change"),
        opt("Customer-reported efficiency gains"),
        opt("Sales win rate change (if AI capability is a factor)"),
        opt("No plan yet — need to define these"),
      ],
    },
    {
      id: "gut_feel_gaps",
      type: "multi-select",
      required: false,
      question:
        "Where are you currently making decisions on gut feel that you wish you had data for?",
      options: [
        opt("Which features customers actually use day-to-day"),
        opt("Whether a deploy caused a support or churn spike"),
        opt("Engineering time allocation by initiative or team"),
        opt("Customer health scores and early churn signals"),
        opt("Real-time operational performance vs targets"),
        opt("Marketing and sales funnel conversion at each stage"),
        opt("Team AI tool adoption and usage patterns"),
        opt("Time-to-value for new customers or feature releases"),
        opt("No major gaps — we have good data coverage"),
      ],
    },
    {
      id: "behaviour_change",
      type: "single-select",
      required: false,
      question:
        "How significant is the behaviour change you are asking from the team?",
      options: [
        opt("Tooling change only — same workflows different tools"),
        opt("Meaningful workflow change — how work gets done is different"),
        opt("Role change — some roles will look significantly different"),
        opt("Team restructure — headcount or team composition will change"),
        opt("Not yet defined — we haven't mapped what changes for people"),
      ],
    },
    {
      id: "internal_champions",
      type: "multi-select",
      required: false,
      question:
        "Do you have internal people who could lead the embedding of AI into day-to-day practice?",
      options: [
        opt("Engineering champion — already driving AI adoption in the team"),
        opt("Product champion — using AI in discovery and synthesis"),
        opt("Operations champion — automating workflows"),
        opt("Leadership champion — visibly using AI personally"),
        opt("Would need to hire or bring in someone"),
        opt("No obvious champions yet"),
      ],
    },
    {
      id: "capability_tracking",
      type: "multi-select",
      required: false,
      question:
        "How will you track your team's AI capability growth over time?",
      options: [
        opt("Self-reported AI tool usage surveys (monthly or quarterly)"),
        opt("Proportion of PRs with AI-assisted code"),
        opt("PM discovery cycles using AI synthesis"),
        opt("Engineer attendance at internal AI learning sessions"),
        opt("Number of internal AI champions or advocates"),
        opt("Adoption tracking via tool vendor dashboards"),
        opt("Team lead qualitative assessments"),
        opt("No plan yet — need to define how to track this"),
      ],
    },
  ],
};

const SYNTHESIS: Stage = {
  id: "synthesis",
  name: "Final Synthesis",
  purpose: "Cross-stage contradiction analysis, board-ready transformation report, and live readiness dashboard.",
  output: "Contradictions report, full transformation plan, readiness radar, move portfolio, knowledge cards",
  runButtonLabel: "",
  questions: [],
};

// ─── Exports ─────────────────────────────────────────────────────────────────

export const TRANSFORMATION_STAGES: Stage[] = [
  WHY_NOW,
  CURRENT_STATE,
  FUTURE_MOVES,
  MOBILISE,
  EMBED,
];

export const SYNTHESIS_STAGE: Stage = SYNTHESIS;

export const TRANSFORMATION_STAGE_HERO: Record<
  string,
  { tagline: string; description: string; goal: string; deliverables: string[] }
> = {
  why_now: {
    tagline: "Why Now",
    description:
      "Understand why AI transformation is urgent now — what pressures, triggers, and costs of inaction are driving the need to act.",
    goal: "Establish urgency and triggers",
    deliverables: [
      "Urgency Signals",
      "Competitive Triggers",
      "Cost of Inaction",
      "People Pressure",
      "Sector Benchmarks",
    ],
  },
  current_state: {
    tagline: "Current State",
    description:
      "Build an honest baseline of where the organisation actually stands — process maturity, AI tooling depth, product management function, and exposure.",
    goal: "Establish what is true today",
    deliverables: [
      "Process Maturity",
      "AI Tooling Depth",
      "PM Function",
      "Stack Readiness",
      "Exposure Map",
    ],
  },
  future_moves: {
    tagline: "Future Moves",
    description:
      "Identify the highest-value AI transformation opportunities and prioritise them into a clear portfolio of STOPs, DOs, and IGNOREs.",
    goal: "Define what to do and what to stop",
    deliverables: [
      "Workflow Automation",
      "Product Capability Unlocks",
      "Build/Buy/Partner",
      "Move Portfolio",
    ],
  },
  mobilise: {
    tagline: "Mobilise",
    description:
      "Assess whether the organisation can actually execute — leadership alignment, sponsor conviction, resistance patterns, and 90-day stall risk.",
    goal: "Ensure the transformation can move",
    deliverables: [
      "Leadership Alignment",
      "Sponsor Conviction",
      "Resistance Map",
      "90-Day Stall Risk",
    ],
  },
  embed: {
    tagline: "Embed",
    description:
      "Define how you'll know it worked — success criteria, measurement frameworks, baseline evidence, and board proof points.",
    goal: "Define how to prove it worked",
    deliverables: [
      "Success Criteria",
      "Measurement Framework",
      "Baseline Evidence",
      "Board Proof Points",
    ],
  },
  synthesis: {
    tagline: "Final Synthesis",
    description:
      "Synthesise all five stages into a board-ready transformation report with cross-stage contradiction analysis and readiness dashboard.",
    goal: "Synthesise all five stages into a board-ready transformation report",
    deliverables: [
      "Cross-Stage Contradictions",
      "Board Report",
      "Readiness Dashboard",
      "Knowledge Cards",
    ],
  },
};
