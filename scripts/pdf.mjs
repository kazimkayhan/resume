import { writeFile } from 'node:fs/promises';
import { preview } from 'astro';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';
import config from '../astro.config.mjs';

const base = `${(config.base ?? '').replace(/\/$/, '')}/`;
const server = await preview({ root: '.', server: { port: 4329 }, logLevel: 'error' });
const browser = await chromium.launch();

try {
  const url = `http://localhost:${server.port}${base}`;
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  // Fail rather than silently export with a fallback font.
  const fontsOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return ['400', '600', '700'].every((w) => document.fonts.check(`${w} 10pt Archivo`, 'A'));
  });
  if (!fontsOk) throw new Error('Archivo did not load; refusing to export with a fallback font.');

  const meta = await page.evaluate(() => ({
    title: document.title,
    author: document.querySelector('meta[name="author"]')?.getAttribute('content') ?? '',
    subject: document.querySelector('.headline')?.textContent ?? '',
    keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') ?? '',
    file: document.querySelector('a[download]')?.getAttribute('download') ?? '',
  }));
  if (!meta.file) throw new Error('No a[download] link on the page to name the PDF after.');

  // Tagged PDF gives parsers an explicit reading order and heading structure.
  const raw = await page.pdf({ format: 'Letter', preferCSSPageSize: true, printBackground: true, tagged: true });

  // Chromium only writes Title; set the rest so ATS and PDF viewers show the right document info.
  const doc = await PDFDocument.load(raw, { updateMetadata: false });
  const pages = doc.getPageCount();
  if (pages > 1) throw new Error(`Résumé runs to ${pages} pages; trim content until it fits on one. Nothing was written.`);

  const now = new Date();
  doc.setTitle(meta.title, { showInWindowTitleBar: true });
  doc.setAuthor(meta.author);
  doc.setSubject(meta.subject);
  doc.setKeywords([meta.keywords]); // pdf-lib joins array items with spaces; keep the commas
  doc.setCreator(meta.author);
  doc.setProducer('Chromium (Skia/PDF)');
  doc.setLanguage('en-US');
  doc.setCreationDate(now);
  doc.setModificationDate(now);

  // public/ is copied into the site as-is, so the deployed download is exactly this file.
  const out = `public/${meta.file}`;
  await writeFile(out, await doc.save({ useObjectStreams: false }));
  console.log(`Saved ${out} (1 page)`);

  // README preview: the same sheet as a 2x image, since GitHub can't render the page itself.
  // A separate page keeps the device scale factor away from the PDF render.
  const shot = await browser.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 2 });
  await shot.goto(url, { waitUntil: 'networkidle' });
  await shot.evaluate(() => document.fonts.ready);
  // Pin the sheet to (0,0) so the capture is exactly 8.5in x 11in with no fractional edge rows, and draw a
  // hairline edge so the white sheet stays visible on GitHub's light theme (inset, so layout is untouched).
  await shot.addStyleTag({
    content: '.toolbar { display: none; } .page { margin: 0; box-shadow: inset 0 0 0 1px #d0d7de; }',
  });
  await shot.locator('.page').screenshot({ path: '.github/resume.png' });
  console.log('Saved .github/resume.png');
} finally {
  await browser.close();
  await server.stop();
}
