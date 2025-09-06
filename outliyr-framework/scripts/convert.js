const fs = require('fs');
const path = require('path');

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

    // GitBook video file embeds
    .replace(
      /{%\s*file\s+src="(?:\.\.\/)*\.gitbook\/assets\/([^"]+\.mp4)"\s*%}/g,
      (_m, filename) =>
        `<div style="text-align: center;">\n  <video controls style="max-width: 100%; height: auto;">\n    <source src=".gitbook/assets/${filename}" type="video/mp4">\n    Your browser does not support the video tag.\n  </video>\n</div>`
    )

    // Unescape GitBook underscores
    .replace(/\\_/g, '_')

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

copyAndTransform('./docs', './docsify');

const summaryPath = './docsify/SUMMARY.md';
if (fs.existsSync(summaryPath)) {
  let summary = fs.readFileSync(summaryPath, 'utf8');
  summary = summary.replace(/\]\((?!\/)([^)]+)\)/g, (_m, link) => `](/${link})`);
  fs.writeFileSync(summaryPath, summary, 'utf8');
  console.log('✅ Converted SUMMARY.md links to absolute paths');
}

const gitbookAssetsSrc = './docs/.gitbook';
const gitbookAssetsDst = './docsify/.gitbook';
if (fs.existsSync(gitbookAssetsSrc)) {
  fs.cpSync(gitbookAssetsSrc, gitbookAssetsDst, { recursive: true });
  console.log('✅ Copied image assets');
}

console.log('✅ Docs transformed to ./docsify');
