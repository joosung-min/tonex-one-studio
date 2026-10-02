import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['server.js', 'sw.js'];
for (const dir of ['src', 'scripts', 'tests']) {
  for (const entry of await readdir(
    new URL('../' + dir + '/', import.meta.url),
    { recursive: true },
  )) {
    if (/\.(?:js|mjs)$/.test(entry)) files.push(dir + '/' + entry);
  }
}
for (const file of files)
  execFileSync(process.execPath, ['--check', file], {
    cwd: root,
    stdio: 'inherit',
  });
console.log(`Syntax checked ${files.length} JavaScript files.`);
