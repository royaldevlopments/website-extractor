import express from 'express';
import helmet from 'helmet';
import archiver from 'archiver';
import { join } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extract, cleanup } from './lib/extractor.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));

// GET /extract - processes extraction and returns HTML result page
app.get('/extract', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || !/^https?:\/\/.+/.test(url)) {
      return res.redirect('/?error=Please+enter+a+valid+URL+starting+with+http://+or+https://');
    }
    const result = await extract(url);
    const totalSize = result.files.reduce((s, f) => s + f.size, 0);
    const sizeKB = (totalSize / 1024).toFixed(1);
    const fileRows = result.files.map(f => `<div>📄 ${f.relPath}</div>`).join('\n');
    
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Extracted — ${result.title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh;display:flex;flex-direction:column}
header{background:linear-gradient(135deg,#667eea,#764ba2);padding:40px 20px;text-align:center}
header h1{color:#fff;font-size:1.8rem}
header p{color:rgba(255,255,255,.8);margin-top:8px}
main{flex:1;max-width:720px;margin:0 auto;padding:40px 20px;width:100%}
.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:28px}
.card h2{color:#fff;margin-bottom:6px}
.card .sub{color:#8b949e;font-size:.9rem;margin-bottom:20px}
.summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
.stat{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;text-align:center}
.stat .num{font-size:1.5rem;font-weight:700;color:#fff}
.stat .label{font-size:.85rem;color:#8b949e;margin-top:4px}
.files{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px 16px;max-height:200px;overflow-y:auto;margin-bottom:20px;font-size:.85rem;font-family:monospace}
.files div{color:#8b949e;padding:2px 0}
.btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:1rem}
.btn:hover{opacity:.9}
.btn-sec{background:#21262d;color:#c9d1d9;border:1px solid #30363d;margin-left:10px}
footer{text-align:center;padding:24px;color:#484f58;font-size:.85rem}
footer a{color:#58a6ff;text-decoration:none}
@media(max-width:520px){.summary{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
<h1>✅ Extracted Successfully</h1>
<p>${result.title}</p>
</header>
<main>
<div class="card">
<h2>${result.title}</h2>
<p class="sub">${url}</p>
<div class="summary">
<div class="stat"><div class="num">${result.files.length}</div><div class="label">Files</div></div>
<div class="stat"><div class="num">${sizeKB}KB</div><div class="label">Total Size</div></div>
</div>
<div class="files">${fileRows}</div>
<a class="btn" href="/api/download/${result.jobId}?url=${encodeURIComponent(url)}">⬇ Download ZIP</a>
<a class="btn btn-sec" href="/">Extract Another</a>
</div>
</main>
<footer>Built by <a href="https://github.com/royaldevlopments">Royal Devlopments</a></footer>
</body>
</html>`);
  } catch (e) {
    res.status(400).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Error</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0d1117;color:#c9d1d9;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:40px;text-align:center;max-width:500px}
h2{color:#f85149;margin-bottom:12px}
p{color:#8b949e;margin-bottom:24px}
.btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:1rem}
</style></head>
<body>
<div class="card">
<h2>❌ Error</h2>
<p>${e.message}</p>
<a class="btn" href="/">Try Again</a>
</div>
</body>
</html>`);
  }
});

// POST /api/extract - JSON API (kept for compatibility)
app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !/^https?:\/\/.+/.test(url)) {
      return res.status(400).json({ error: 'Valid URL required (http:// or https://)' });
    }
    const result = await extract(url);
    const totalSize = result.files.reduce((s, f) => s + f.size, 0);
    const fileList = result.files.map(f => f.relPath);
    res.json({
      title: result.title,
      url: result.url,
      jobId: result.jobId,
      files: fileList,
      totalFiles: result.files.length,
      totalSize
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/download/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    const { extract } = await import('./lib/extractor.js');
    const JOBS_DIR = join((await import('node:os')).tmpdir(), 'we-jobs');
    const outDir = join(JOBS_DIR, jobId);

    await stat(outDir);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="website-${jobId.slice(0, 8)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    async function addFiles(dir, basePath = '') {
      const { readdir, stat } = await import('node:fs/promises');
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = basePath ? join(basePath, entry.name) : entry.name;
        if (entry.isDirectory()) {
          if (entry.name !== '..' && entry.name !== '.') {
            await addFiles(fullPath, relPath);
          }
        } else {
          archive.file(fullPath, { name: relPath });
        }
      }
    }

    const hostname = new URL(req.query.url || 'https://unknown').hostname;
    const hostDir = join(outDir, hostname);
    try {
      await stat(hostDir);
      await addFiles(hostDir);
    } catch {
      await addFiles(outDir);
    }

    archive.append(`Website extracted from: ${req.query.url || 'Unknown'}\r\nGenerated by Website Extractor\r\n`, { name: 'README.txt' });

    await archive.finalize();
    cleanup(jobId);
  } catch (e) {
    res.status(404).json({ error: 'Job not found or expired' });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Website Extractor running on http://${HOST}:${PORT}`);
});
