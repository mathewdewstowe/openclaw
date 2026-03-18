---
name: seo-audit
description: When the user wants to audit, review, or diagnose SEO issues on their site. Also use when the user mentions "SEO audit," "technical SEO," "why am I not ranking," "SEO issues," "on-page SEO," "meta tags review," "SEO health check," "my traffic dropped," "lost rankings," "not showing up in Google," "site isn't ranking," "Google update hit me," "page speed," "core web vitals," "crawl errors," or "indexing issues." Use this even if the user just says something vague like "my SEO is bad" or "help with SEO" — start with an audit. For building pages at scale to target keywords, see programmatic-seo. For adding structured data, see schema-markup. For AI search optimization, see ai-seo.
---

# SEO Audit

Find the ranking blockers, explain impact, and prioritize fixes.

## First moves

1. Check for `.agents/product-marketing-context.md` or `.claude/product-marketing-context.md`.
2. Clarify the scope:
   - full site vs specific pages
   - technical vs on-page vs both
   - any known traffic drop, migration, or redesign
3. Identify business priorities and target keywords.

## Important limitation

`web_fetch` and raw HTML checks do **not** reliably prove whether schema exists, because many sites inject JSON-LD via JavaScript.

To verify schema accurately, prefer:
- browser inspection for `script[type="application/ld+json"]`
- Google Rich Results Test
- rendered crawler exports such as Screaming Frog

Do not claim “no schema found” from static fetches alone.

## Audit order

### 1. Crawlability and indexation
Check:
- robots.txt
- XML sitemap presence and quality
- canonicals
- noindex misuse
- redirects / loops / soft 404s
- whether important pages are indexable

### 2. Technical foundations
Check:
- page speed / Core Web Vitals
- mobile usability
- HTTPS and mixed-content issues
- broken internal links
- crawl traps or parameter mess

### 3. On-page signals
Check:
- title tags
- meta descriptions
- H1/H2 structure
- thin/duplicated pages
- search intent match
- internal linking
- image alt text where relevant

### 4. Content quality
Check whether pages are:
- actually useful
- materially better than competitors
- up to date
- clear about topic, audience, and next step

### 5. SERP competitiveness
Check:
- what currently ranks
- whether the page type matches the SERP
- whether authority or content depth is the real gap

## Output standard

Always provide:
- issue
- why it matters
- severity
- recommended fix
- quick win vs longer-term fix

Prefer a prioritized list over a giant dump.

## Reference files

Use when needed:
- `references/ai-writing-detection.md`

If the user needs structured data implementation, switch to `schema-markup`.
