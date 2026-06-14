import express from 'express';
import helmet from 'helmet';
import archiver from 'archiver';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from './lib/extractor.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'https:', 'data:'],
    }
  },
  crossOriginResourcePolicy: false
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));

app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !/^https?:\/\/.+/.test(url)) {
      return res.status(400).json({ error: 'Valid URL required (http:// or https://)' });
    }
    const result = await extract(url);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/download', async (req, res) => {
  try {
    const { html, css, js, title } = req.body;
    if (!html) return res.status(400).json({ error: 'No content to download' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    archive.append(html, { name: 'index.html' });

    if (css && css.length > 0) {
      const cssDir = 'css';
      for (const f of css) {
        archive.append(f.content, { name: `${cssDir}/${f.name}` });
      }
    }

    if (js && js.length > 0) {
      const jsDir = 'js';
      for (const f of js) {
        archive.append(f.content, { name: `${jsDir}/${f.name}` });
      }
    }

    const notes = `🚀 Website Extractor Output 🚀\r\n\r\nExtracted from: ${req.body.url || 'Unknown'}\r\n\r\nFiles:\r\n- index.html\r\n- css/ (${css?.length || 0} files)\r\n- js/ (${js?.length || 0} files)\r\n\r\nHappy coding!`;
    archive.append(notes, { name: 'README_NOTES.txt' });

    await archive.finalize();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Website Extractor running on http://${HOST}:${PORT}`);
});
