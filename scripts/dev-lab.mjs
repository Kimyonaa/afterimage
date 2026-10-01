import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['scripts/run-framework.mjs', 'dev', '--hostname', '127.0.0.1'], {
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['ml/serve.mjs'], { stdio: 'inherit' }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
}
for (const child of children)
  child.on('exit', (code) => {
    if (!stopping && code !== 0) {
      stop();
      process.exitCode = code ?? 1;
    }
  });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
