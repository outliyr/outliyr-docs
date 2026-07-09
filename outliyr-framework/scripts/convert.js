const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function autoStackDetails(md) {
  // find <details> ... </details> blocks
  const re = /<details\b[\s\S]*?<\/details>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(md)) !== null) {
    blocks.push({ start: m.index, end: re.lastIndex, text: m[0] });
  }
  if (blocks.length === 0) return md;

  let out = '';
  let cursor = 0;

  for (let i = 0; i < blocks.length; i++) {
    const cur = blocks[i];

    // write text before this block
    if (cursor < cur.start) out += md.slice(cursor, cur.start);

    // collect a run of consecutive details separated only by whitespace
    let j = i;
    const run = [blocks[j].text];
    while (j + 1 < blocks.length) {
      const between = md.slice(blocks[j].end, blocks[j + 1].start);
      if (/^[\s\r\n]*$/.test(between)) { // only whitespace between -> same group
        j++;
        run.push(blocks[j].text);
      } else break;
    }

    if (run.length === 1) {
      out += run[0]; // single: leave as-is
    } else {
      out += `<div class="gb-stack">\n${run.join('\n')}\n</div>`;
    }

    cursor = blocks[j].end;
    i = j;
  }

  // trailing text after the last block
  if (cursor < md.length) out += md.slice(cursor);
  return out;
}


function transformMarkdown(input) {
  let out = input
    // Remove GitBook YAML front matter (top block only)
    .replace(/^\s*---[\s\S]*?---\s*\n/, '')

    // Tabs
    .replace(/{% tabs %}/g, '<!-- tabs:start -->')
    .replace(/{% endtabs %}/g, '<!-- tabs:end -->')
    .replace(/{% tab title="(.*?)" %}/g, (_m, title) => `#### **${title}**`)
    .replace(/{% endtab %}/g, '')

    // Hints -> callouts (Docsify flexible-alerts expects upper-case tokens)
    .replace(/{% hint style="(.*?)" %}([\s\S]*?){% endhint %}/g, (_m, style, content) => {
      const token = String(style || '').toUpperCase(); // NOTE/TIP/WARNING/ATTENTION
      const cleaned = content.trim().replace(/\n/g, '\n> ');
      return `> [!${token}]\n> ${cleaned}`;
    })

    // Add class to native <details> that don't already have one
    .replace(/<details(?![^>]*\bclass=)[^>]*>/gi, m =>
        /\s>$/.test(m) ? m.replace(/\s>$/, ' class="gb-toggle">') : m.replace(/>$/, ' class="gb-toggle">')
    )

    // Convert <figure><img ...><figcaption>...</figcaption></figure> -> <img ... title="...">
    .replace(
      /<figure>\s*<img\s+src="(?:\.\.\/)*\.gitbook\/assets\/([^"]+)"([^>]*)>\s*<figcaption>(.*?)<\/figcaption>\s*<\/figure>/gsi,
      (_m, src, attrs = '', caption) =>
        `<img src=".gitbook/assets/${src}"${attrs} title="${caption.trim().replace(/<[^>]+>/g, '')}">`
    )

    // Convert <figure><img ...></figure> (no caption)
    .replace(
      /<figure>\s*<img\s+src="(?:\.\.\/)*\.gitbook\/assets\/([^"]+)"([^>]*)>\s*<\/figure>/gsi,
      (_m, src, attrs = '') => `<img src=".gitbook/assets/${src}"${attrs}>`
    )

    // GitBook video file embeds (with optional caption + endfile tag)
    .replace(
      /{%\s*file\s+src="(?:\.\.\/)*\.gitbook\/assets\/([^"]+\.mp4)"\s*%}[\s\S]*?{%\s*endfile\s*%}/g,
      (_m, filename) =>
        `<div style="text-align: center;">\n  <video controls style="max-width: 100%; height: auto;">\n    <source src=".gitbook/assets/${filename}" type="video/mp4">\n    Your browser does not support the video tag.\n  </video>\n</div>`
    )

    // Unescape GitBook underscores
    .replace(/\\_/g, '_')

    // Stepper blocks → HTML comment markers (processed by Docsify plugin)
    .replace(/{% stepper %}/g,  '<!-- gb-stepper:start -->')
    .replace(/{% endstepper %}/g, '<!-- gb-stepper:end -->')
    .replace(/{% step %}/g,    '<!-- gb-step:start -->')
    .replace(/{% endstep %}/g, '<!-- gb-step:end -->')

    // Titled code blocks → title div + normal code block
    .replace(/{%\s*code\s+title="([^"]*?)"\s*%}/g, '<div class="gb-code-title">$1</div>\n')
    .replace(/{%\s*endcode\s*%}/g, '')

  // auto-wrap consecutive <details> blocks
  out = autoStackDetails(out);

  // Ensure trailing newline
  if (!/\n$/.test(out)) out += '\n';
  return out;
}

function copyAndTransform(srcDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });

  for (const entry of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    const outPath = path.join(outDir, entry);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyAndTransform(srcPath, outPath);
    } else if (entry.endsWith('.md')) {
      const raw = fs.readFileSync(srcPath, 'utf8');
      const transformed = transformMarkdown(raw);
      fs.writeFileSync(outPath, transformed, 'utf8');
    } else {
      fs.copyFileSync(srcPath, outPath);
    }
  }
}

// ===========================================================================
// Multi-version build
// ---------------------------------------------------------------------------
// The site is versioned by git tags. Each release is a tag (e.g. v1.2); the
// docs for that tag are rebuilt into their own folder so users on an older
// release read docs that match their build. Only *content* is frozen per tag —
// the theme/plugins/converter and the version switcher come from current main,
// so every archived version gets the same modern shell.
//
//   root  '/'         -> newest tag        (the default, indexed)
//   '/next/'          -> current main      (unreleased preview, noindex)
//   '/<tag>/'         -> that tag          (older release, noindex)
//
// Fallback: with no tags yet, root is built from the live working tree (today's
// behaviour) and the switcher stays hidden.
// ===========================================================================

const OUT_ROOT = './docsify';
const DOCS_DIR = './docs';                       // live working-tree docs (main)
const REPO_DOCS_PATH = 'outliyr-framework/docs';  // docs path within the repo (for git)
const TAG_PATTERN = 'v*';                          // release tags look like v1.2
const OVERRIDE_FILE = './versions.json';           // optional manual version list

// Base URL of the published site. Update this if a custom domain is adopted
// (e.g. 'https://docs.outliyr.com'); everything below derives from it.
const SITE_BASE = 'https://outliyr.github.io/outliyr-docs';

// Files/dirs that make up the hand-maintained docsify "shell" (see .gitignore).
// The root already has these committed; every non-root version folder gets a
// fresh copy so it renders with the same theme + version switcher.
const SHELL_FILES = ['index.html', '_navbar.md'];
const SHELL_DIRS = ['assets'];

// --- git helpers -----------------------------------------------------------

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

// Release tags, newest first (version sort). Empty array if git/tags absent.
function listTags() {
  try {
    return git(['tag', '--sort=-v:refname', '--list', TAG_PATTERN])
      .split('\n').map(s => s.trim()).filter(Boolean);
  } catch (e) {
    console.warn(`⚠️  Could not list git tags (${e.message}); building latest only.`);
    return [];
  }
}

// Check out a tag into a throwaway git worktree and return its docs dir plus a
// cleanup fn. Using a worktree (not `git archive` piped through Node) avoids
// buffering large image/video assets in memory.
function checkoutTagDocs(tag) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'outliyr-docs-'));
  const wt = path.join(base, 'wt');
  git(['worktree', 'add', '--detach', '--quiet', wt, tag]);
  return {
    docs: path.join(wt, REPO_DOCS_PATH),
    cleanup() {
      try { git(['worktree', 'remove', '--force', wt]); } catch { /* best effort */ }
      try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ }
    },
  };
}

// --- version resolution ----------------------------------------------------

// Returns the ordered list of versions to build. Each entry:
//   { id, label, tag|null, isLatest, isNext, isRoot, outDir, basePath, url }
function resolveVersions() {
  const tags = listTags();

  // No tags: single root built from the live working tree (fallback / bootstrap).
  if (tags.length === 0) {
    return [{
      id: 'root', label: 'latest', tag: null,
      isLatest: true, isNext: false, isRoot: true,
      outDir: OUT_ROOT, basePath: '/', url: `${SITE_BASE}/`,
    }];
  }

  // Optional manual override: versions.json = [{ id, label?, tag, hidden? }, ...]
  // ordered newest-first. Lets you curate/rename/hide releases later without a
  // code change. Falls back to auto-from-tags when the file is absent.
  let ordered = tags.map(tag => ({ id: tag, tag }));
  if (fs.existsSync(OVERRIDE_FILE)) {
    try {
      const override = JSON.parse(fs.readFileSync(OVERRIDE_FILE, 'utf8'));
      ordered = override
        .filter(v => v && v.tag && !v.hidden)
        .map(v => ({ id: v.id || v.tag, tag: v.tag, label: v.label }));
      console.log(`✅ Using version override from ${OVERRIDE_FILE} (${ordered.length} versions)`);
    } catch (e) {
      console.warn(`⚠️  Ignoring invalid ${OVERRIDE_FILE}: ${e.message}`);
    }
  }

  const versions = ordered.map((v, i) => {
    const isLatest = i === 0;
    return {
      id: v.id,
      label: v.label || (isLatest ? `${v.id} (latest)` : v.id),
      tag: v.tag,
      isLatest, isNext: false, isRoot: isLatest,
      outDir: isLatest ? OUT_ROOT : path.join(OUT_ROOT, v.id),
      basePath: isLatest ? '/' : `/${v.id}/`,
      url: isLatest ? `${SITE_BASE}/` : `${SITE_BASE}/${v.id}/`,
    };
  });

  // Always publish current main as the "Unreleased" preview at /next/.
  versions.push({
    id: 'next', label: 'Unreleased', tag: null,
    isLatest: false, isNext: true, isRoot: false,
    outDir: path.join(OUT_ROOT, 'next'), basePath: '/next/', url: `${SITE_BASE}/next/`,
  });

  return versions;
}

// --- per-version build -----------------------------------------------------

// Transform a docs/ tree into a docsify output folder: convert markdown, rewrite
// SUMMARY links to absolute paths, and copy .gitbook assets. (Reuses the shared
// transform helpers so every version renders identically.)
function buildContent(srcDocs, outDir) {
  copyAndTransform(srcDocs, outDir);

  const summaryPath = path.join(outDir, 'SUMMARY.md');
  if (fs.existsSync(summaryPath)) {
    let summary = fs.readFileSync(summaryPath, 'utf8');
    summary = summary.replace(/\]\((?!\/)([^)]+)\)/g, (_m, link) => `](/${link})`);
    fs.writeFileSync(summaryPath, summary, 'utf8');
  }

  const gbSrc = path.join(srcDocs, '.gitbook');
  if (fs.existsSync(gbSrc)) {
    fs.cpSync(gbSrc, path.join(outDir, '.gitbook'), { recursive: true });
  }
}

// Compact list handed to the client switcher (index.html reads these globals).
function switcherList(versions) {
  return versions
    .filter(v => !v.isRoot || versions.length > 1) // keep latest so it shows as an option
    .map(v => ({ id: v.id, label: v.label, url: v.url, isLatest: v.isLatest }));
}

// Write the per-folder version data consumed by the switcher plugin. Generated
// (not committed) so committed shell files are never mutated by the build.
function writeVersionsData(outDir, currentId, list) {
  const js =
    `/* generated by scripts/convert.js — do not edit */\n` +
    `window.__DOC_VERSION__=${JSON.stringify(currentId)};\n` +
    `window.__DOC_VERSIONS__=${JSON.stringify(list)};\n`;
  fs.writeFileSync(path.join(outDir, 'versions-data.js'), js, 'utf8');
}

// Mark a non-root version's index.html as noindex + canonical->root so search
// engines only surface the latest docs. Operates on the copied shell file.
function markNoindex(indexPath) {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.includes('name="robots"')) return; // idempotent
  const tags =
    `\n    <meta name="robots" content="noindex, nofollow">` +
    `\n    <link rel="canonical" href="${SITE_BASE}/">`;
  html = html.replace(/<meta charset="[^"]*">/i, m => m + tags);
  fs.writeFileSync(indexPath, html, 'utf8');
}

function buildVersion(v, list) {
  let src = DOCS_DIR;         // live working tree for root-fallback and /next/
  let cleanup = null;
  if (v.tag) {
    const co = checkoutTagDocs(v.tag);
    src = co.docs;
    cleanup = co.cleanup;
  }
  try {
    if (!fs.existsSync(path.join(src, 'SUMMARY.md'))) {
      throw new Error(`no SUMMARY.md in ${src}`);
    }
    fs.mkdirSync(v.outDir, { recursive: true });
    buildContent(src, v.outDir);

    // Non-root folders need a fresh copy of the shell (theme + switcher).
    if (!v.isRoot) {
      for (const f of SHELL_FILES) {
        fs.copyFileSync(path.join(OUT_ROOT, f), path.join(v.outDir, f));
      }
      for (const d of SHELL_DIRS) {
        fs.cpSync(path.join(OUT_ROOT, d), path.join(v.outDir, d), { recursive: true });
      }
      markNoindex(path.join(v.outDir, 'index.html'));
    }

    writeVersionsData(v.outDir, v.id, list);
    console.log(`✅ Built ${v.id} → ${v.outDir}${v.tag ? ` (tag ${v.tag})` : ''}`);
    return true;
  } catch (e) {
    console.warn(`⚠️  Skipping version ${v.id}: ${e.message}`);
    return false;
  } finally {
    if (cleanup) cleanup();
  }
}

// --- root SEO (latest only) ------------------------------------------------

// Map a SUMMARY.md link like '/dir/page.md' or '/dir/README.md' to a canonical
// clean URL (no '.md', folder indexes collapse to a trailing slash).
function summaryLinkToUrl(link) {
  const route = link
    .replace(/^\//, '')               // drop leading slash
    .replace(/\.md$/i, '')            // drop .md extension
    .replace(/(^|\/)README$/i, '$1'); // README segment -> folder index ('' or 'dir/')
  return route ? `${SITE_BASE}/${route}` : `${SITE_BASE}/`;
}

// Generate sitemap.xml + robots.txt at the root from the latest version's
// SUMMARY. Only the latest (root) is indexed; older versions and /next/ are
// noindex, so they are intentionally excluded from the sitemap.
function writeRootSeo() {
  const summaryPath = path.join(OUT_ROOT, 'SUMMARY.md');
  if (fs.existsSync(summaryPath)) {
    const summaryRaw = fs.readFileSync(summaryPath, 'utf8');
    const urls = [];
    const seen = new Set();
    const linkRe = /\]\((\/[^)]+\.md)\)/gi;
    let lm;
    while ((lm = linkRe.exec(summaryRaw)) !== null) {
      const url = summaryLinkToUrl(lm[1]);
      if (!seen.has(url)) { seen.add(url); urls.push(url); }
    }
    const home = `${SITE_BASE}/`;
    const ordered = [home, ...urls.filter(u => u !== home)];
    const body = ordered.map(u => `  <url>\n    <loc>${u}</loc>\n  </url>`).join('\n');
    const sitemap =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      body + '\n' +
      '</urlset>\n';
    fs.writeFileSync(path.join(OUT_ROOT, 'sitemap.xml'), sitemap, 'utf8');
    console.log(`✅ Generated sitemap.xml (${ordered.length} URLs)`);
  }

  const robots =
    'User-agent: *\n' +
    'Allow: /\n' +
    `Sitemap: ${SITE_BASE}/sitemap.xml\n`;
  fs.writeFileSync(path.join(OUT_ROOT, 'robots.txt'), robots, 'utf8');
  console.log('✅ Generated robots.txt');
}

// --- orchestrate -----------------------------------------------------------

const versions = resolveVersions();
const list = switcherList(versions);
console.log(`ℹ️  Building ${versions.length} version(s): ${versions.map(v => v.id).join(', ')}`);

for (const v of versions) {
  buildVersion(v, list);
}

writeRootSeo();

console.log('✅ Docs transformed to ./docsify');
