import { writeFile } from 'node:fs/promises';
import { preview } from 'astro';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';
import config from '../astro.config.mjs';

const base = `${(config.base ?? '').replace(/\/$/, '')}/`;
const server = await preview({ root: '.', server: { port: 4329 }, logLevel: 'error' });
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.port}${base}`, { waitUntil: 'networkidle' });

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
} finally {
  await browser.close();
  await server.stop();
}
