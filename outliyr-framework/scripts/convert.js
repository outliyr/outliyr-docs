import fs from 'fs';
import path from 'path';

function transformMarkdown(input) {
    return input
        // Tabs
        .replace(/{% tabs %}/g, '<!-- tabs:start -->')
        .replace(/{% endtabs %}/g, '<!-- tabs:end -->')
        .replace(/{% tab title="(.*?)" %}/g, (_match, title) => `#### **${title}**`)
        .replace(/{% endtab %}/g, '')

        // Hints to callouts
        .replace(/{% hint style="(.*?)" %}([\s\S]*?){% endhint %}/g, (_match, style, content) => {
            const cleaned = content.trim().replace(/\n/g, '\n> ');
            return `> [!${style.toLowerCase()}]\n> ${cleaned}`;
        })

        // <details><summary>Title</summary>
        .replace(/<details>\s*<summary>(.*?)<\/summary>/g, (_m, title) => `<div class="collapse">\n<p class="collapse-title">${title}</p>\n<div class="collapse-content">`)
        .replace(/<\/details>/g, '</div>\n</div>')

        // Convert <figure><img ...><figcaption>...</figcaption></figure> to <img ... title="...">
        .replace(/<figure>\s*<img\s+src="(?:\.\.\/)*\.gitbook\/assets\/([^"]+)"([^>]*)>\s*<figcaption>\s*<p>(.*?)<\/p>\s*<\/figcaption>\s*<\/figure>/g,
            (_m, src, attrs = '', caption) =>
                `<img src="/.gitbook/assets/${src}"${attrs} title="${caption.trim()}">`)

        // Convert <figure><img ...></figure> (no caption)
        .replace(/<figure>\s*<img\s+src="(?:\.\.\/)*\.gitbook\/assets\/([^"]+)"([^>]*)>\s*<\/figure>/g,
            (_m, src, attrs = '') =>
                `<img src="/.gitbook/assets/${src}"${attrs}>`)

        // Unescape GitBook underscores
        .replace(/\\_/g, '_');
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

