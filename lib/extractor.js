import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'node:url';

export async function extract(url) {
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const baseUrl = new URL(url);
  const $ = cheerio.load(response.data);
  const title = $('title').first().text().trim() || baseUrl.hostname;

  const files = { html: response.data, css: [], js: [] };
  const cssFiles = [];
  const jsFiles = [];

  const seen = new Set();

  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const absolute = new URL(href, url).href;
      if (!seen.has(absolute)) {
        seen.add(absolute);
        cssFiles.push({ url: absolute, original: href });
      }
    } catch {}
  });

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    try {
      const absolute = new URL(src, url).href;
      if (!seen.has(absolute)) {
        seen.add(absolute);
        jsFiles.push({ url: absolute, original: src });
      }
    } catch {}
  });

  const cssResults = [];
  for (const f of cssFiles) {
    try {
      const res = await axios.get(f.url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const name = f.original.split('/').pop().split('?')[0] || 'style.css';
      cssResults.push({ name, content: res.data, url: f.url });
    } catch {}
  }

  const jsResults = [];
  for (const f of jsFiles) {
    try {
      const res = await axios.get(f.url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const name = f.original.split('/').pop().split('?')[0] || 'script.js';
      jsResults.push({ name, content: res.data, url: f.url });
    } catch {}
  }

  return { title, url, files: { html: response.data, css: cssResults, js: jsResults } };
}
