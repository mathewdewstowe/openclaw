---
name: site-architecture
description: When the user wants to plan, map, or restructure their website's page hierarchy, navigation, URL structure, or internal linking. Also use when the user mentions "sitemap," "site map," "visual sitemap," "site structure," "page hierarchy," "information architecture," "IA," "navigation design," "URL structure," "breadcrumbs," "internal linking strategy," "website planning," "what pages do I need," "how should I organize my site," or "site navigation." Use this whenever someone is planning what pages a website should have and how they connect. NOT for XML sitemaps (that's technical SEO — see seo-audit). For SEO audits, see seo-audit. For structured data, see schema-markup.
---

# Site Architecture

Design a structure that is easy to navigate, easy to scale, and easy for search engines to understand.

## First moves

1. Check for `.agents/product-marketing-context.md` or `.claude/product-marketing-context.md`.
2. Clarify:
   - new site vs restructure
   - site type
   - primary audiences
   - business goals
   - URLs that must be preserved

## Core rules

- keep important pages within roughly 3 clicks of the homepage
- go as flat as possible without making navigation messy
- organize by user intent, not internal org charts
- use consistent URL patterns
- design internal links intentionally, not as an afterthought

## Workflow

### 1. Define the page hierarchy
Map:
- homepage
- primary sections
- subsection pages
- utility/support/legal pages

Use simple ASCII trees unless the user explicitly wants a visual diagram.

### 2. Define navigation zones
Specify:
- header nav
- footer nav
- sidebar nav where relevant
- breadcrumbs
- contextual internal links

### 3. Define URL conventions
Choose patterns that are:
- human-readable
- stable
- category-consistent
- scalable for future content

### 4. Define linking logic
Explain:
- parent → child links
- sibling links where useful
- related-content links
- conversion-path links

### 5. Stress-test the structure
Check whether:
- top tasks are obvious
- important pages are buried
- sections overlap confusingly
- the structure still works if content doubles

## Output options

Provide one or more of:
- ASCII sitemap
- recommended nav structure
- URL pattern rules
- internal linking guidance
- migration / redirect notes for restructures

## Reference files

Use when needed:
- `references/site-type-templates.md`
- `references/navigation-patterns.md`
- `references/mermaid-templates.md`
