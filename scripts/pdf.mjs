import { writeFile } from 'node:fs/promises';
import { preview } from 'astro';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';

const server = await preview({ root: '.', server: { port: 4329 }, logLevel: 'error' });
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'networkidle' });

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
  }));

  // Tagged PDF gives parsers an explicit reading order and heading structure.
  const raw = await page.pdf({ format: 'Letter', preferCSSPageSize: true, printBackground: true, tagged: true });

  // Chromium only writes Title; set the rest so ATS and PDF viewers show the right document info.
  const doc = await PDFDocument.load(raw, { updateMetadata: false });
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

  const out = `${meta.author.replace(/\s+/g, '-')}-Resume.pdf`;
  await writeFile(out, await doc.save({ useObjectStreams: false }));

  const pages = doc.getPageCount();
  console.log(`Saved ${out} (${pages} page${pages === 1 ? '' : 's'})`);
  if (pages > 1) console.warn('Warning: résumé spills onto more than one page.');
} finally {
  await browser.close();
  await server.stop();
}
