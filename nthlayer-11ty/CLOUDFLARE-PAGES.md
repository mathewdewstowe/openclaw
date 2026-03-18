# Cloudflare Pages deploy

## Repo settings
- **Repository:** `mathewdewstowe/openclaw`
- **Root directory:** `nthlayer-11ty`
- **Build command:** `npm run build`
- **Build output directory:** `_site`

## Steps
1. Open Cloudflare Dashboard
2. Go to **Workers & Pages**
3. Click **Create** → **Pages** → **Connect to Git**
4. Select `mathewdewstowe/openclaw`
5. Set the root directory to `nthlayer-11ty`
6. Build command: `npm run build`
7. Output directory: `_site`
8. Deploy
9. Add a custom domain, ideally `new.nthlayer.co.uk` first, then switch `nthlayer.co.uk` when happy

## Notes
- Site is static and built by Eleventy
- Form submissions go to Formspree: `https://formspree.io/f/xnjglozg`
- Preview tunnel is only for temporary review; Pages should be the permanent hosting path
