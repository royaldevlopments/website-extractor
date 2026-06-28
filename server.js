import express from 'express';
import helmet from 'helmet';
import archiver from 'archiver';
import { join } from 'node:path';
import { readFile, stat, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { startExtraction, getJobStatus, getJobDir, cleanup } from './lib/extractor.js';
import { checkIntegrity, getBrandString, getCreditLine } from './lib/integrity.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const HISTORY_FILE = join(DATA_DIR, 'history.json');
const SESSIONS = new Map();

const BRAND = getBrandString();
const CREDIT = getCreditLine();

async function loadHistory() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const d = await readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(d);
  } catch { return []; }
}

async function saveHistory(h) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(HISTORY_FILE, JSON.stringify(h, null, 2));
}

// Integrity self-check at startup
if (!checkIntegrity()) {
  console.error('\n\x1b[31m');
  console.error('  ╔══════════════════════════════════════════════╗');
  console.error('  ║           CODE INTEGRITY VIOLATED            ║');
  console.error('  ║    Royal Devlopments branding tampered!      ║');
  console.error('  ║         This software is protected.           ║');
  console.error('  ╚══════════════════════════════════════════════╝');
  console.error('\x1b[0m');
  process.exit(1);
}

const app = express();
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use((req, res, next) => {
  if (!checkIntegrity()) {
    res.status(403).send(renderCrash());
    return;
  }
  console.log(new Date().toISOString(), req.method, req.url);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

// Simple session-based auth
app.use((req, res, next) => {
  const token = req.headers['x-auth-token'] || req.cookies?.token || req.query.token;
  if (token && SESSIONS.has(token)) {
    req.user = SESSIONS.get(token);
  }
  next();
});

function renderCrash() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>System Integrity Failure</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;background:#0a0a0a;color:#00ff41;min-height:100vh;display:flex;align-items:center;justify-content:center}.crash{background:#0d0d0d;border:2px solid #ff0040;border-radius:4px;padding:48px;max-width:680px;text-align:center;box-shadow:0 0 40px rgba(255,0,64,.3)}.crash h1{color:#ff0040;font-size:2.5rem;margin-bottom:16px;text-transform:uppercase;letter-spacing:4px}.crash .bar{width:100%;height:2px;background:linear-gradient(90deg,transparent,#ff0040,transparent);margin:24px 0}.crash p{color:#888;font-size:.9rem;line-height:1.6;margin-bottom:8px}.crash .code{background:#000;border:1px solid #222;border-radius:4px;padding:16px;margin:24px 0;text-align:left;font-size:.8rem;color:#666}.crash .code .red{color:#ff0040;font-weight:700}.crash .sig{color:#333;font-size:.7rem;margin-top:32px;border-top:1px solid #111;padding-top:16px}</style></head><body><div class="crash"><h1>⚠ CRASH</h1><div class="bar"></div><p>Code integrity verification failed.</p><p>This application is protected by Royal Devlopments.</p><div class="code"><span class="red">FATAL:</span> BRAND_INTEGRITY_MISMATCH<br><span class="red">FILE:</span> server.js + lib/integrity.js<br><span class="red">HASH:</span> VERIFICATION_FAILED<br><span class="red">ACTION:</span> Restore original branding</div><p style="color:#333">Tampering with Royal Devlopments branding<br>is strictly prohibited.</p><div class="sig">✦ Royal Devlopments ✦ &mdash; Built by Shaurya</div></div></body></html>`;
}

function render(html, req) {
  if (!checkIntegrity()) return renderCrash();
  const token = req.user ? `data-token="${req.user.token}"` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Website Extractor — Royal Devlopments</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh;display:flex;flex-direction:column}
header{background:linear-gradient(135deg,#0d1117,#161b22);border-bottom:1px solid #30363d;padding:0 24px}
.header-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:64px}
.logo{font-size:1.2rem;font-weight:800;background:linear-gradient(90deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none;letter-spacing:-.5px}
.logo span{color:#484f58;font-weight:400;background:none;-webkit-text-fill-color:#484f58}
nav{display:flex;gap:4px}
nav a{color:#8b949e;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:.85rem;font-weight:500;transition:all .15s}
nav a:hover{color:#c9d1d9;background:#21262d}
nav a.active{color:#fff;background:#1f2937}
.user-badge{display:flex;align-items:center;gap:8px;color:#8b949e;font-size:.8rem}
.user-badge .avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;font-weight:700}
main{flex:1;max-width:1200px;margin:0 auto;padding:32px 24px;width:100%}
.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:28px;margin-bottom:20px}
.card h2{color:#fff;font-size:1.3rem;margin-bottom:16px}
.card h3{color:#c9d1d9;font-size:1rem;margin-bottom:12px}
.input-group{margin-bottom:16px}
.input-group label{display:block;color:#8b949e;font-size:.8rem;margin-bottom:6px;font-weight:500}
.input-group input,.input-group select{width:100%;padding:12px 16px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#c9d1d9;font-size:.9rem;outline:none;transition:border .15s}
.input-group input:focus{border-color:#667eea}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:8px;font-weight:600;font-size:.9rem;border:none;cursor:pointer;text-decoration:none;transition:opacity .15s}
.btn:hover{opacity:.85}
.btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}
.btn-secondary{background:#21262d;color:#c9d1d9;border:1px solid #30363d}
.btn-danger{background:#f85149;color:#fff}
.btn-success{background:#3fb950;color:#fff}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.stat-card{background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:20px;text-align:center}
.stat-card .num{font-size:2rem;font-weight:800;color:#fff}
.stat-card .label{color:#8b949e;font-size:.8rem;margin-top:4px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;padding:12px 16px;color:#8b949e;font-weight:500;border-bottom:1px solid #30363d;white-space:nowrap}
td{padding:12px 16px;border-bottom:1px solid #21262d;color:#c9d1d9}
td .status-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:.75rem;font-weight:600}
td .status-badge.success{background:rgba(63,185,80,.15);color:#3fb950}
td .status-badge.error{background:rgba(248,81,73,.15);color:#f85149}
td .status-badge.pending{background:rgba(88,166,255,.15);color:#58a6ff}
.empty-state{text-align:center;padding:48px 24px;color:#484f58}
.empty-state .icon{font-size:3rem;margin-bottom:12px}
.empty-state p{font-size:.9rem}
footer{border-top:1px solid #30363d;padding:24px;text-align:center}
footer .brand{font-size:.95rem;font-weight:700;background:linear-gradient(90deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
footer .credit{color:#484f58;font-size:.75rem;margin-top:4px}
footer .credit span{color:#8b949e}
.alert{padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:.85rem}
.alert-error{background:rgba(248,81,73,.15);color:#f85149;border:1px solid rgba(248,81,73,.3)}
.alert-success{background:rgba(63,185,80,.15);color:#3fb950;border:1px solid rgba(63,185,80,.3)}
.hidden{display:none}
@media(max-width:768px){.grid-2{grid-template-columns:1fr}.header-inner{flex-wrap:wrap;height:auto;padding:12px 0;gap:8px}nav{flex-wrap:wrap}nav a{font-size:.75rem;padding:6px 10px}}
</style>
<script>
(function(){var h=['R','o','y','a','l',' ','D','e','v','l','o','p','m','e','n','t','s'];var c=h.join('');var s='';for(var i=0;i<c.length;i++){s+=String.fromCharCode(c.charCodeAt(i)^0)};if(s!==c){document.body.innerHTML='<div style="padding:40px;text-align:center;color:#f85149"><h2>Integrity Failure</h2><p>Branding modified</p></div>'}})()
</script>
</head>
<body>
<header>
<div class="header-inner">
<a href="/" class="logo">✦ Extractor <span>by Royal Devlopments</span></a>
<nav>
<a href="/" class="${req.url === '/' || req.url.startsWith('/?') ? 'active' : ''}">🏠 Dashboard</a>
<a href="/extract" class="${req.url === '/extract' ? 'active' : ''}">⬇ Extract</a>
<a href="/history" class="${req.url === '/history' ? 'active' : ''}">📋 History</a>
<a href="/settings" class="${req.url === '/settings' ? 'active' : ''}">⚙ Settings</a>
</nav>
<div class="user-badge"><div class="avatar">S</div><span>${CREDIT}</span></div>
</div>
</header>
<main>
${html}
</main>
<footer>
<div class="brand">✦ ${BRAND} ✦</div>
<div class="credit"><span>${CREDIT}</span> &middot; Website Extractor v3.0</div>
</footer>
<script>
(function(){var b=document.querySelector('.brand');if(b&&!b.textContent.includes('Royal')){document.title='CORRUPTED';document.body.innerHTML='<div style="padding:60px;text-align:center;color:#f85149;font-family:monospace"><h1>✖ BRANDING TAMPERED</h1><p style="color:#666;margin-top:12px">This software is protected by Royal Devlopments</p></div>'}})()
</script>
</body>
</html>`;
}

// ============= PAGES =============

app.get('/', async (req, res) => {
  const history = await loadHistory();
  const totalExtractions = history.length;
  const totalSize = history.reduce((s, h) => s + (h.size || 0), 0);
  const successCount = history.filter(h => h.status === 'success').length;

  const html = `
<div style="margin-bottom:24px">
<h1 style="color:#fff;font-size:1.8rem;font-weight:800">Dashboard</h1>
<p style="color:#8b949e;margin-top:4px">Welcome to Website Extractor by ${CREDIT}</p>
</div>
<div class="grid-2">
<div class="stat-card"><div class="num">${totalExtractions}</div><div class="label">Total Extractions</div></div>
<div class="stat-card"><div class="num">${successCount}</div><div class="label">Successful</div></div>
<div class="stat-card"><div class="num">${(totalSize / 1024 / 1024).toFixed(1)}MB</div><div class="label">Total Data Extracted</div></div>
<div class="stat-card"><div class="num">${history.length > 0 ? Math.round(successCount / totalExtractions * 100) : 0}%</div><div class="label">Success Rate</div></div>
</div>
<div class="card" style="margin-top:24px">
<h2>Quick Extract</h2>
<form action="/extract" method="get" style="display:flex;gap:12px;flex-wrap:wrap">
<input type="url" name="url" placeholder="https://example.com" required style="flex:1;min-width:200px;padding:12px 16px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#c9d1d9;font-size:.9rem;outline:none">
<button type="submit" class="btn btn-primary">⬇ Extract</button>
</form>
</div>
<div class="card">
<h2>Recent Activity</h2>
${history.length === 0 ? '<div class="empty-state"><div class="icon">📂</div><p>No extractions yet. Start by extracting a website!</p></div>' : `
<div class="table-wrap">
<table>
<thead><tr><th>URL</th><th>Files</th><th>Size</th><th>Status</th><th>Date</th></tr></thead>
<tbody>${history.slice(-5).reverse().map(h => `
<tr>
<td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.url}</td>
<td>${h.files || 0}</td>
<td>${((h.size || 0) / 1024).toFixed(1)}KB</td>
<td><span class="status-badge ${h.status === 'success' ? 'success' : 'error'}">${h.status}</span></td>
<td>${new Date(h.date).toLocaleDateString()}</td>
</tr>`).join('')}</tbody>
</table>
</div>`}
</div>`;
  res.send(render(html, req));
});



app.get('/history', async (req, res) => {
  const history = await loadHistory();

  const html = `
<div style="margin-bottom:24px">
<h1 style="color:#fff;font-size:1.8rem;font-weight:800">📋 Extraction History</h1>
<p style="color:#8b949e;margin-top:4px">All your past website extractions</p>
</div>
<div class="card">
${history.length === 0 ? '<div class="empty-state"><div class="icon">📂</div><p>No history yet. Extract a website to see it here!</p></div>' : `
<div class="table-wrap">
<table>
<thead><tr><th>#</th><th>URL</th><th>Files</th><th>Size</th><th>Status</th><th>Date</th></tr></thead>
<tbody>${history.map((h, i) => `
<tr>
<td>${i + 1}</td>
<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.url}</td>
<td>${h.files || 0}</td>
<td>${((h.size || 0) / 1024).toFixed(1)}KB</td>
<td><span class="status-badge ${h.status === 'success' ? 'success' : 'error'}">${h.status}</span></td>
<td>${new Date(h.date).toLocaleString()}</td>
</tr>`).reverse().join('')}</tbody>
</table>
</div>
<div style="margin-top:16px;text-align:right;color:#484f58;font-size:.8rem">${history.length} total extractions</div>`}
</div>`;
  res.send(render(html, req));
});

app.get('/settings', (req, res) => {
  const html = `
<div style="margin-bottom:24px">
<h1 style="color:#fff;font-size:1.8rem;font-weight:800">⚙ Settings</h1>
<p style="color:#8b949e;margin-top:4px">Application configuration</p>
</div>
<div class="card">
<h2>About</h2>
<div style="margin-top:12px">
<p style="color:#8b949e;font-size:.9rem;margin-bottom:8px"><strong style="color:#c9d1d9">Version:</strong> 3.0.0</p>
<p style="color:#8b949e;font-size:.9rem;margin-bottom:8px"><strong style="color:#c9d1d9">Engine:</strong> wget --mirror</p>
<p style="color:#8b949e;font-size:.9rem;margin-bottom:8px"><strong style="color:#c9d1d9">Developer:</strong> ${CREDIT}</p>
<p style="color:#8b949e;font-size:.9rem"><strong style="color:#c9d1d9">Brand:</strong> ${BRAND}</p>
</div>
</div>
<div class="card">
<h2>Data Management</h2>
<div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap">
<form action="/api/clear-history" method="post" onsubmit="return confirm('Clear all extraction history?')">
<button type="submit" class="btn btn-danger">🗑 Clear History</button>
</form>
</div>
</div>
<div class="card">
<h2>Integrity Status</h2>
<div style="margin-top:12px">
<p style="color:#3fb950;font-size:.9rem">✅ All systems operational</p>
<p style="color:#8b949e;font-size:.8rem;margin-top:4px">Branding integrity: Verified</p>
<p style="color:#8b949e;font-size:.8rem">Protected by Royal Devlopments</p>
</div>
</div>`;
  res.send(render(html, req));
});

// ============= EXTRACT ROUTE =============

app.get('/extract', async (req, res) => {
  const formUrl = req.query.url || '';
  const error = req.query.error || '';

  // Show form if no URL provided
  if (!formUrl) {
    const html = `
<div style="margin-bottom:24px">
<h1 style="color:#fff;font-size:1.8rem;font-weight:800">⬇ Extract Website</h1>
<p style="color:#8b949e;margin-top:4px">Download any website with all assets — powered by wget</p>
</div>
${error ? `<div class="alert alert-error">${error}</div>` : ''}
<div class="card">
<h2>Enter Website URL</h2>
<form action="/extract" method="get" style="margin-top:16px">
<div class="input-group">
<label>Website URL</label>
<input type="url" name="url" placeholder="https://example.com" value="${formUrl}" required>
</div>
<button type="submit" class="btn btn-primary">⬇ Start Extraction</button>
</form>
</div>
<div class="card">
<h2>Recent Extractions</h2>
<div style="color:#8b949e;font-size:.85rem;margin-top:8px">Check the <a href="/history" style="color:#58a6ff">History</a> page for past extractions.</div>
</div>`;
    return res.send(render(html, req));
  }

  try {
    const url = formUrl;
    if (!/^https?:\/\/.+/.test(url)) {
      return res.redirect('/extract?error=Please+enter+a+valid+URL');
    }
    const cleanUrl = url.replace(/\/$/, '');
    const jobId = await startExtraction(cleanUrl);

    const html = `
<div style="margin-bottom:24px">
<h1 style="color:#fff;font-size:1.8rem;font-weight:800">⏳ Extracting</h1>
<p style="color:#8b949e;margin-top:4px">${cleanUrl}</p>
</div>
<div class="card">
<div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:24px">
<div style="background:#0d1117;border-radius:8px;height:24px;overflow:hidden;border:1px solid #30363d">
<div id="progressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:8px;transition:width .3s"></div>
</div>
<p id="progressText" style="color:#8b949e;font-size:.85rem;margin-top:8px;text-align:center">Starting extraction...</p>
<div id="logContainer" style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px 16px;margin-top:16px;max-height:300px;overflow-y:auto;font-family:monospace;font-size:.75rem;line-height:1.5">
<div style="color:#484f58">Waiting for output...</div>
</div>
</div>
</div>
<script>
const jobId = '${jobId}';
const logContainer = document.getElementById('logContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

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
      div.style.color = '#58a6ff';
      const pct = text.match(/(\\d+)%/);
      if (pct) progressBar.style.width = pct[1] + '%';
      const fn = text.match(/'([^']+)'/);
      if (fn) progressText.textContent = '⬇ ' + fn[1].split('/').pop();
    } else if (text.includes('saved')) {
      div.style.color = '#7ee787';
      progressText.textContent = '✅ Saved';
    } else if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
      div.style.color = '#f85149';
    } else if (text.includes('--') && text.includes('--')) {
      div.style.color = '#58a6ff';
      const match = text.match(/https?:\\/\\/[^\\s]+/);
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
    if (s.log && s.log.length > 0) updateLog(s.log);
    if (s.status === 'complete') {
      progressBar.style.width = '100%';
      progressText.textContent = '✅ Complete! Downloading...';
      // Save to history
      await fetch('/api/save-history', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          url: s.url,
          files: s.totalFiles,
          size: s.totalSize,
          status: 'success'
        })
      });
      setTimeout(() => { window.location.href = '/api/result/' + jobId + '?url=' + encodeURIComponent('${cleanUrl}'); }, 1500);
    } else if (s.status === 'error') {
      progressBar.style.background = '#f85149';
      progressText.textContent = '❌ Error';
      logContainer.innerHTML += '<div style="color:#f85149;margin-top:8px;font-weight:600">❌ ' + (s.error || 'Extraction failed') + '</div>';
      await fetch('/api/save-history', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url: s.url, files: 0, size: 0, status: 'error'})
      });
      setTimeout(check, 3000);
    } else {
      setTimeout(check, 1000);
    }
  } catch(e) {
    setTimeout(check, 1000);
  }
}
setTimeout(check, 1000);
</script>`;
    res.send(render(html, req));
  } catch (e) {
    res.redirect('/extract?error=' + encodeURIComponent(e.message));
  }
});

// ============= API =============

app.get('/api/status/:jobId', (req, res) => {
  const status = getJobStatus(req.params.jobId);
  if (!status) return res.status(404).json({ error: 'Job not found' });
  if (!checkIntegrity()) return res.status(403).json({ error: 'Integrity violation' });
  res.json(status);
});

app.post('/api/save-history', async (req, res) => {
  try {
    const history = await loadHistory();
    history.push({
      ...req.body,
      date: new Date().toISOString()
    });
    await saveHistory(history);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/result/:jobId', async (req, res) => {
  const status = getJobStatus(req.params.jobId);
  if (!status) return res.redirect('/?error=Job+expired');
  if (status.status !== 'complete') return res.redirect('/extract?url=' + encodeURIComponent(req.query.url || status.url));

  const url = req.query.url || status.url;
  const sizeKB = (status.totalSize / 1024).toFixed(1);
  const fileRows = status.files.map(f => `<div style="padding:4px 0;color:#8b949e;font-size:.8rem">📄 ${f}</div>`).join('\n');

  const html = `
<div style="margin-bottom:24px">
<h1 style="color:#fff;font-size:1.8rem;font-weight:800">✅ Extraction Complete</h1>
<p style="color:#8b949e;margin-top:4px">${status.title || url}</p>
</div>
<div class="card">
<div class="grid-2" style="margin-bottom:24px">
<div class="stat-card"><div class="num">${status.files.length}</div><div class="label">Files Extracted</div></div>
<div class="stat-card"><div class="num">${sizeKB}KB</div><div class="label">Total Size</div></div>
</div>
<div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px 16px;max-height:200px;overflow-y:auto;margin-bottom:20px">
${fileRows}
</div>
<div style="display:flex;gap:12px;flex-wrap:wrap">
<a class="btn btn-primary" href="/api/download/${status.jobId}?url=${encodeURIComponent(url)}">⬇ Download ZIP</a>
<a class="btn btn-secondary" href="/extract">Extract Another</a>
<a class="btn btn-secondary" href="/">Dashboard</a>
</div>
</div>`;
  res.send(render(html, req));
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

    const jobStatus = getJobStatus(jobId);
    const hostname = jobStatus ? jobStatus.hostname : (req.query.url ? new URL(req.query.url).hostname : 'unknown');
    const hostDir = join(fullDir, hostname);
    try {
      await stat(hostDir);
      await addFiles(hostDir);
    } catch {
      await addFiles(fullDir);
    }

    archive.append(`Website extracted from: ${req.query.url || jobStatus?.url || 'Unknown'}\r\nGenerated by Website Extractor\r\n${BRAND} — ${CREDIT}\r\n`, { name: 'README.txt' });
    await archive.finalize();
    cleanup(jobId);
  } catch (e) {
    res.status(404).json({ error: 'Job not found or expired' });
  }
});

app.post('/api/clear-history', async (req, res) => {
  await saveHistory([]);
  res.redirect('/settings');
});

// ============= STARTUP =============

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`✦ ${BRAND} ✦`);
  console.log(`  ${CREDIT}`);
  console.log(`  Website Extractor v3.0 running on http://${HOST}:${PORT}`);
});
