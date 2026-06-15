import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const JOBS_DIR = join(tmpdir(), 'we-jobs');
const jobs = new Map();

export async function startExtraction(url) {
  await mkdir(JOBS_DIR, { recursive: true });
  const jobId = randomUUID();
  const outDir = join(JOBS_DIR, jobId);
  await mkdir(outDir, { recursive: true });

  const cleanUrl = url.replace(/\/$/, '');
  const hostname = new URL(cleanUrl).hostname;

  const cmd = `wget --mirror --convert-links --adjust-extension --page-requisites --no-parent -P "${outDir}" "${cleanUrl}"`;

  const job = {
    jobId,
    url: cleanUrl,
    hostname,
    outDir,
    status: 'running',
    files: [],
    title: hostname,
    error: null
  };
  jobs.set(jobId, job);

  const proc = spawn('/bin/bash', ['-c', cmd], {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000
  });

  proc.on('exit', async (code) => {
    try {
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
        await walk(outDir);
      }

      job.files = files;
      job.status = 'complete';
    } catch (e) {
      job.error = e.message;
      job.status = 'error';
    }
  });

  proc.on('error', (e) => {
    job.error = e.message;
    job.status = 'error';
  });

  return jobId;
}

export function getJobStatus(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;

  const totalSize = job.files.reduce((s, f) => s + f.size, 0);

  return {
    jobId: job.jobId,
    url: job.url,
    title: job.title,
    status: job.status,
    files: job.files.map(f => f.relPath),
    totalFiles: job.files.length,
    totalSize,
    error: job.error
  };
}

export function getJobDir(jobId) {
  const job = jobs.get(jobId);
  return job ? job.outDir : null;
}

// Legacy sync extract for backward compatibility
export async function extract(url) {
  const jobId = await startExtraction(url);
  // Poll until done
  return new Promise((resolve, reject) => {
    const check = setInterval(() => {
      const status = getJobStatus(jobId);
      if (status.status === 'complete') {
        clearInterval(check);
        resolve({
          jobId: status.jobId,
          files: status.files.map((f, i) => ({ path: f, relPath: f, size: 0 })),
          title: status.title,
          url: status.url,
          outDir: getJobDir(jobId)
        });
      } else if (status.status === 'error') {
        clearInterval(check);
        reject(new Error(status.error));
      }
    }, 500);
  });
}

export async function cleanup(jobId) {
  const dir = join(JOBS_DIR, jobId);
  if (existsSync(dir)) {
    return rm(dir, { recursive: true, force: true });
  }
}
