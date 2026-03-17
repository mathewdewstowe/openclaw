# TOOLS.md - Local Notes

## API Keys

### EnrichLayer (LinkedIn enrichment)
- Key: `oYC90qJpPVXV2rn3TyPfwQ`
- Endpoint: `GET https://enrichlayer.com/api/v2/profile?profile_url=<linkedin_url>`
- Header: `Authorization: Bearer oYC90qJpPVXV2rn3TyPfwQ`
- Use for: enriching ICP profiles, LinkedIn lead data, company lookups
- Also supports: `/api/v2/company` for company profiles

### Apollo
- Key: `V5ZsfKQ0dsCMCBum2wKEdA`

### Readwise
- Key: `mbQiKrmFxjmrymFwir29u050WFYF2EMhsvsJaFq1rjtRAFLmwl`


Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
