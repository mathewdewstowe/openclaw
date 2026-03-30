# Nth Layer Signal Portal — Page-by-Page UX Spec

## Design System
- **Framework**: Tailwind CSS + shadcn/ui
- **Theme**: Dark slate/zinc base, emerald accent, sharp typography
- **Typography**: Inter (body), JetBrains Mono (data/metrics)
- **Tone**: Premium, institutional, no-nonsense

---

## Page Map

### 1. `/login`
**Purpose**: Authentication entry point

- Email + password form
- "Nth Layer" logo + tagline: *Structured Operator Judgement*
- No social login (enterprise feel)
- Link to register (admin-controlled in v1)

---

### 2. `/register`
**Purpose**: Account creation (invite-only in v1)

- Name, email, password
- Invite code field (optional gate)

---

### 3. `/dashboard`
**Purpose**: Home base — scan overview + quick actions

**Layout**:
- Top bar: user name, role badge, logout
- 3 action cards (equal weight):
  - **Inflection Scan** — "Scan your company" → `/scan/inflection/new`
  - **Competitor Teardown** — "Tear down a competitor" → `/scan/competitor/new`
  - **Deal / DD Scan** — "Assess a target" → `/scan/deal/new`
- **Recent Scans** table:
  - Columns: Type | Company | Status | Date | Actions
  - Status badges: Pending (yellow), Running (blue pulse), Complete (green), Failed (red)
  - Action: View Report / Retry

---

### 4. `/scan/inflection/new`
**Purpose**: Inflection Scan input form

**Fields** (all validated with Zod):
1. **Company URL** — text input, required, URL validation
2. **Company Name** — text input, auto-populated if possible
3. **Top 3 Strategic Priorities** — 3 separate text inputs, 15-word max each, required
4. **Key Workflow** — text input for name + up to 5 step inputs (add/remove), required
5. **3 Competitors** — 3 URL inputs, required
6. **Uploads** — drag-and-drop zone, max 2 files, PDF/DOCX only, max 10MB each

**Constraints shown inline**: word counters, step counters, file limits

**Submit**: "Run Inflection Scan" → creates scan → redirects to `/scan/[id]`

---

### 5. `/scan/competitor/new`
**Purpose**: Competitor Teardown input form

**Fields**:
1. **Competitor URL** — text input, required, URL validation

That's it. One field. Clean and bold.

**Messaging below form**:
> "This analysis uses public signals only. No uploads or confidential data required."

**Submit**: "Run Teardown" → creates scan → redirects to `/scan/[id]`

---

### 6. `/scan/deal/new`
**Purpose**: Deal / DD Scan input form

**Fields**:
1. **Target Company URL** — text input, required, URL validation
2. **Investment Thesis** — textarea, optional, 200-word max
3. **Uploads** — drag-and-drop zone, max 2 files (optional)

**Submit**: "Run DD Scan" → creates scan → redirects to `/scan/[id]`

---

### 7. `/scan/[id]` (Scan Status & Report)
**Purpose**: Live status tracking → report display

**While running**:
- Progress bar (0-100%)
- Step-by-step status list with checkmarks/spinners
- Current step highlighted
- Estimated time remaining (rough)
- "This typically takes 2-3 minutes"

**On completion**:
- Full rendered report (HTML)
- Sticky header with:
  - Download PDF button
  - "How this was produced" toggle
- Report sections rendered as cards/sections with anchored nav

**On failure**:
- Error message
- "Retry" button
- Admin contact link

---

### 8. `/scan/[id]/transparency`
**Purpose**: "How This Was Produced" panel (can also be a slide-out on the report page)

**Shows**:
- **Inputs Used**: company URL, priorities, workflow, competitors
- **Sources Consulted**: list of URLs scraped/researched
- **Modules Run**: list of analysis modules with status + confidence score
- **Mode**: Public Signal Analysis / Internal Evidence Analysis
- **Timing**: total duration, per-module duration

---

### 9. `/settings`
**Purpose**: User settings

- Change password
- **Connect Internal Systems** (Coming Soon section):
  - Cards for: CRM, Analytics, Data Warehouse, Support, Billing
  - Each has "I'm interested" button → captures email + integration type
  - Badge: "Coming Soon"

---

### 10. `/admin` (Admin only)
**Purpose**: Admin dashboard

**Tabs**:

#### All Scans
- Table: ID | User | Type | Status | Created | Duration | Actions
- Filter by: type, status, user, date range
- Actions: View, Inspect, Rerun

#### Inspect Scan (`/admin/scan/[id]`)
- Full input display
- Per-module output viewer (JSON with syntax highlighting)
- Module confidence scores
- Token usage per module
- Rerun individual modules or full scan
- Regenerate report

#### Metrics
- Scans started (by type, over time)
- Scans completed vs failed
- Reports opened
- PDFs downloaded
- Avg completion time
- Active users

---

## Shared Components

| Component | Description |
|-----------|-------------|
| `ScanCard` | Action card for dashboard (icon, title, description, CTA) |
| `ScanStatusBadge` | Color-coded status pill |
| `ProgressTracker` | Step list with live status |
| `ReportRenderer` | HTML report display with section nav |
| `TransparencyPanel` | Inputs/sources/modules/confidence display |
| `FileUpload` | Drag-and-drop with validation |
| `WordCounter` | Inline constraint indicator |
| `ConfidenceBadge` | 0-100% confidence with color coding |
| `AdminTable` | Sortable, filterable data table |
| `MetricCard` | Single metric display with trend |

---

## Navigation Structure

```
Sidebar (desktop) / Bottom nav (mobile):
├── Dashboard
├── New Scan ▸
│   ├── Inflection Scan
│   ├── Competitor Teardown
│   └── Deal / DD Scan
├── My Scans
├── Settings
└── Admin (admin only)
```

---

## Mobile Considerations
- Forms stack vertically
- Report sections collapse to accordion
- Progress tracker simplifies to single bar + current step
- Admin panel: responsive tables with horizontal scroll
