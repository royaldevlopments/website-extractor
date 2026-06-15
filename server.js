import express from 'express';
import helmet from 'helmet';
import archiver from 'archiver';
import { join } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startExtraction, getJobStatus, getJobDir, cleanup } from './lib/extractor.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const app = express();
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
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

// GET /extract - start extraction, show processing page
app.get('/extract', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || !/^https?:\/\/.+/.test(url)) {
      return res.redirect('/?error=Please+enter+a+valid+URL');
    }
    const jobId = await startExtraction(url);

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Extracting — ${url}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh;display:flex;flex-direction:column}
header{background:linear-gradient(135deg,#667eea,#764ba2);padding:40px 20px;text-align:center}
header h1{color:#fff;font-size:1.8rem}
header p{color:rgba(255,255,255,.8);margin-top:8px}
main{flex:1;max-width:720px;margin:0 auto;padding:40px 20px;width:100%;text-align:center}
.progress-wrap{margin-top:24px;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;text-align:left}
.progress-bar-wrap{background:#0d1117;border-radius:8px;height:24px;overflow:hidden;border:1px solid #30363d}
.progress-bar{height:100%;width:0%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:8px;transition:width .5s}
.progress-text{color:#8b949e;font-size:.85rem;margin-top:8px;text-align:center}
.log-wrap{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px 16px;margin-top:16px;max-height:300px;overflow-y:auto;font-family:monospace;font-size:.75rem;line-height:1.5;text-align:left}
.log-wrap div{color:#8b949e;white-space:pre-wrap;word-break:break-all}
.log-wrap .downloading{color:#58a6ff}
.log-wrap .saving{color:#7ee787}
.log-wrap .error{color:#f85149}
.log-wrap .complete{color:#3fb950}
footer{text-align:center;padding:24px;color:#484f58;font-size:.85rem}
footer a{color:#58a6ff;text-decoration:none}
@media(max-width:520px){header h1{font-size:1.4rem}}
</style>
</head>
<body>
<header>
<h1>⏳ Extracting Website</h1>
<p>${url}</p>
</header>
<main>
<div class="progress-wrap">
<div class="progress-bar-wrap">
<div class="progress-bar" id="progressBar"></div>
</div>
<p class="progress-text" id="progressText">Starting...</p>
<div class="log-wrap" id="logContainer">
<div style="color:#484f58">Waiting for output...</div>
</div>
</div>
</main>
<footer>Built by <a href="https://github.com/royaldevlopments">Royal Devlopments</a></footer>
<script>
const jobId = '${jobId}';
const logContainer = document.getElementById('logContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
let lastLogLen = 0;
let errorShown = false;

function updateLog(lines) {
  logContainer.innerHTML = '';
  if (lines.length === 0) {
    logContainer.innerHTML = '<div style="color:#484f58">Processing...</div>';
    return;
  }
  for (const line of lines) {
    const div = document.createElement('div');
    let text = line;
    if (text.includes('%') && text.includes('[') && text.includes(']')) {
      div.className = 'downloading';
      const pct = text.match(/(\\d+)%/);
      if (pct) progressBar.style.width = pct[1] + '%';
      var fn = text.match(/'([^']+)'/);
      if (fn) progressText.textContent = '⬇ ' + fn[1].split('/').pop();
    } else if (text.includes('saved')) {
      div.className = 'saving';
      progressText.textContent = '✅ Saved';
    } else if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
      div.className = 'error';
    } else if (text.includes('--') && text.includes('--')) {
      div.className = 'downloading';
      var match = text.match(/https?:\\/\\/[^\\s]+/);
      if (match) progressText.textContent = '⬇ ' + match[0].split('/').pop();
    }
    div.textContent = text;
    logContainer.appendChild(div);
  }
  logContainer.scrollTop = logContainer.scrollHeight;
}

async function check() {
  try {
    const r = await fetch('/api/status/' + jobId);
    const s = await r.json();
    
    if (s.log && s.log.length > 0) {
      updateLog(s.log);
      if (!errorShown) {
        var last = s.log[s.log.length - 1];
        if (last.includes('%') && last.includes('[')) {
          var p = last.match(/(\\d+)%/);
          if (p) { progressBar.style.width = p[1] + '%'; progressText.textContent = p[1] + '%'; }
        }
      }
    }

    if (s.status === 'complete') {
      progressBar.style.width = '100%';
      progressText.textContent = '✅ Complete! Redirecting...';
      setTimeout(() => { window.location.href = '/api/result/' + jobId + '?url=' + encodeURIComponent('${url}'); }, 1000);
    } else if (s.status === 'error') {
      if (!errorShown) {
        errorShown = true;
        progressBar.style.background = '#f85149';
        progressText.textContent = '❌ Error: ' + s.error;
        logContainer.innerHTML += '<div class="error" style="margin-top:8px;font-weight:600;color:#f85149">❌ ' + s.error + '</div><div style="margin-top:12px"><a href="/" style="color:#58a6ff">Try Again</a></div>';
      }
      setTimeout(check, 2000);
    } else {
      setTimeout(check, 1000);
    }
  } catch(e) {
    setTimeout(check, 1000);
  }
}
setTimeout(check, 1000);
</script>
</body>
</html>`);
  } catch (e) {
    res.status(400).send(`Error: ${e.message}`);
  }
});

// GET /api/start - start extraction async, return jobId
app.get('/api/start', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || !/^https?:\/\/.+/.test(url)) {
      return res.status(400).json({ error: 'Valid URL required' });
    }
    const jobId = await startExtraction(url);
    res.json({ jobId, url, status: 'running' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/status/:jobId - check extraction status
app.get('/api/status/:jobId', (req, res) => {
  const status = getJobStatus(req.params.jobId);
  if (!status) return res.status(404).json({ error: 'Job not found' });
  res.json(status);
});

// GET /api/result/:jobId - show result page
app.get('/api/result/:jobId', async (req, res) => {
  const status = getJobStatus(req.params.jobId);
  if (!status) return res.redirect('/?error=Job+expired');
  if (status.status !== 'complete') return res.redirect('/extract?url=' + encodeURIComponent(req.query.url || status.url));

  const url = req.query.url || status.url;
  const sizeKB = (status.totalSize / 1024).toFixed(1);
  const fileRows = status.files.map(f => `<div>📄 ${f}</div>`).join('\n');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Extracted — ${status.title}</title>
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
.btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:1rem;border:none;cursor:pointer}
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
<p>${status.title}</p>
</header>
<main>
<div class="card">
<h2>${status.title}</h2>
<p class="sub">${url}</p>
<div class="summary">
<div class="stat"><div class="num">${status.files.length}</div><div class="label">Files</div></div>
<div class="stat"><div class="num">${sizeKB}KB</div><div class="label">Total Size</div></div>
</div>
<div class="files">${fileRows}</div>
<a class="btn" href="/api/download/${status.jobId}?url=${encodeURIComponent(url)}">⬇ Download ZIP</a>
<a class="btn btn-sec" href="/">Extract Another</a>
</div>
</main>
<footer>Built by <a href="https://github.com/royaldevlopments">Royal Devlopments</a></footer>
</body>
</html>`);
});

// POST /api/extract - JSON API (kept for compatibility)
app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !/^https?:\/\/.+/.test(url)) {
      return res.status(400).json({ error: 'Valid URL required' });
    }
    const jobId = await startExtraction(url);
    // Wait for completion (poll)
    const result = await new Promise((resolve, reject) => {
      const check = setInterval(() => {
        const s = getJobStatus(jobId);
        if (s.status === 'complete') {
          clearInterval(check);
          resolve(s);
        } else if (s.status === 'error') {
          clearInterval(check);
          reject(new Error(s.error));
        }
      }, 500);
    });
    res.json({
      title: result.title,
      url: result.url,
      jobId: result.jobId,
      files: result.files,
      totalFiles: result.totalFiles,
      totalSize: result.totalSize
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/download/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    const outDir = getJobDir(jobId);
    if (!outDir) return res.status(404).json({ error: 'Job not found' });

    const JOBS_DIR = join((await import('node:os')).tmpdir(), 'we-jobs');
    const fullDir = join(JOBS_DIR, jobId);

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

    const status = getJobStatus(jobId);
    const hostname = status ? status.hostname : (req.query.url ? new URL(req.query.url).hostname : 'unknown');
    const hostDir = join(fullDir, hostname);
    try {
      await stat(hostDir);
      await addFiles(hostDir);
    } catch {
      await addFiles(fullDir);
    }

    archive.append(`Website extracted from: ${req.query.url || status?.url || 'Unknown'}\r\nGenerated by Website Extractor\r\n`, { name: 'README.txt' });
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
