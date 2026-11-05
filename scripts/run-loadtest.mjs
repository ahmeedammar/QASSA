#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function findK6() {
  if (process.env.K6_PATH && existsSync(process.env.K6_PATH)) {
    return process.env.K6_PATH;
  }
  
  const check = spawnSync('k6', ['version'], { stdio: 'ignore' });
  if (check.status === 0) return 'k6';

  const defaultWinPaths = [
    'C:\\Program Files\\k6\\k6.exe',
    'C:\\Program Files (x86)\\k6\\k6.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'k6', 'k6.exe'),
  ];

  for (const p of defaultWinPaths) {
    if (existsSync(p)) return p;
  }

  console.error('k6 executable not found. Please install k6 or set K6_PATH.');
  process.exit(1);
}

const k6Bin = findK6();
const scriptPath = path.resolve('scripts', 'k6-loadtest.js');
const args = ['run', scriptPath, ...process.argv.slice(2)];

console.log(`Running k6 using: ${k6Bin}`);
const result = spawnSync(k6Bin, args, { stdio: 'inherit', env: process.env });

process.exit(result.status ?? 0);
