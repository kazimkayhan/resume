# Kazim Kayhan — Resume

Single-page, ATS-friendly résumé built with [Astro](https://astro.build). All content lives in `src/data/resume.ts`.

## Commands

```bash
pnpm install
pnpm exec playwright install chromium   # first time, and after upgrading Playwright
pnpm dev       # live preview at http://localhost:4321
pnpm pdf       # builds and writes Kazim-Kayhan-Resume.pdf (US Letter)
```

`pnpm pdf` refuses to export if the Archivo font fails to load, and warns if the content no longer fits on one page.

You can also open the dev page and use the browser's Print → Save as PDF (margins: Default, background graphics: on), but the script output is the canonical file.

## ATS notes

- Real, selectable text (no outlined glyphs or images), single column, standard section headings (Professional Summary, Skills, Professional Experience, Education). Education stays last so its right-aligned date can't be grouped into another section by layout-based parsers.
- Job title, then company and location on their own line, then dates right-aligned; dates use `Mon YYYY – Mon YYYY`.
- Semantic HTML: `h1` name, `h2` sections, `h3` roles, lists for bullets. The PDF is tagged, so parsers get an explicit reading order.
- Ligatures are disabled so words like "profile" extract as plain letters.
- PDF Title, Author, Subject, Keywords and language are set from the page.
