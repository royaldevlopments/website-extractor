import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const JOBS_DIR = join(tmpdir(), 'we-jobs');

export async function extract(url) {
  await mkdir(JOBS_DIR, { recursive: true });
  const jobId = randomUUID();
  const outDir = join(JOBS_DIR, jobId);
  await mkdir(outDir, { recursive: true });

  // Clean up URL - remove trailing /
  const cleanUrl = url.replace(/\/$/, '');
  const hostname = new URL(cleanUrl).hostname;

  const cmd = `wget --mirror --convert-links --adjust-extension --page-requisites --no-parent -P "${outDir}" "${cleanUrl}" 2>&1`;

  try {
    execSync(cmd, { timeout: 120000, stdio: 'pipe', shell: '/bin/bash' });
  } catch (e) {
    // wget returns non-zero for some "errors" that are actually fine
    // We still want to continue if files were downloaded
  }

  // Find all downloaded files
  const files = [];
  async function walk(dir, relativePath = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relativePath ? join(relativePath, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== '..' && entry.name !== '.') {
          await walk(fullPath, relPath);
        }
      } else {
        const stats = await stat(fullPath);
        files.push({ path: fullPath, relPath, size: stats.size });
      }
    }
  }

  const actualOutDir = join(outDir, hostname);
  if (existsSync(actualOutDir)) {
    await walk(actualOutDir);
  } else {
    // Maybe wget didn't create the hostname subdirectory
    await walk(outDir);
  }

  return { jobId, files, title: hostname, url: cleanUrl, outDir };
}

export function cleanup(jobId) {
  const dir = join(JOBS_DIR, jobId);
  if (existsSync(dir)) {
    return rm(dir, { recursive: true, force: true });
  }
}
