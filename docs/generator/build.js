/**
 * Builds the CareBridge handover documentation package.
 *
 *   node docs/generator/build.js
 *
 * Each document under ./documents is rendered to docs/output as a PDF.
 * pdfkit is resolved from the backend's node_modules (see resolvePdfkit below),
 * so this script needs no install of its own.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOCS_DIR = path.join(__dirname, 'documents');
const OUT_DIR = path.join(ROOT, 'docs', 'output');

// pdfkit lives in backend/node_modules; make it resolvable from here.
require('module').Module._initPaths();
process.env.NODE_PATH = [
  path.join(ROOT, 'backend', 'node_modules'),
  process.env.NODE_PATH || '',
].filter(Boolean).join(path.delimiter);
require('module').Module._initPaths();

const { render } = require('./pdfkit-engine');

/** Turn a document title into a stable output filename. */
function fileNameFor(def, sourceFile) {
  const order = sourceFile.slice(0, 2);
  const slug = def.meta.title
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${order}_CareBridge_${slug}.pdf`;
}

async function main() {
  const sources = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.js')).sort();
  if (!sources.length) {
    console.error('No documents found in', DOCS_DIR);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const built = [];
  for (const file of sources) {
    const def = require(path.join(DOCS_DIR, file));
    const outPath = path.join(OUT_DIR, fileNameFor(def, file));
    try {
      await render(def, outPath);
      const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
      built.push({ ref: def.meta.ref, title: def.meta.title, file: path.basename(outPath), kb });
      console.log(`  ok   ${def.meta.ref}  ${path.basename(outPath)}  (${kb} KB)`);
    } catch (err) {
      console.error(`  FAIL ${file}:`, err.message);
      process.exitCode = 1;
    }
  }

  console.log(`\n${built.length} of ${sources.length} documents written to ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
