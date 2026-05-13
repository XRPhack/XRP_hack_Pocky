import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const processes = [];
let shuttingDown = false;

const ports = [
  { name: 'API server', port: 8787 },
  { name: 'Vite dev server', port: 5173 }
];

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });

    socket.on('connect', () => {
      socket.end();
      resolve(false);
    });

    socket.on('error', () => resolve(true));
    socket.setTimeout(1_000, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

async function assertPortsAvailable() {
  const occupied = [];

  for (const entry of ports) {
    if (!(await isPortAvailable(entry.port))) {
      occupied.push(entry);
    }
  }

  if (occupied.length === 0) {
    return;
  }

  for (const entry of occupied) {
    console.error(`[dev:all] Port ${entry.port} is already in use by another ${entry.name} process.`);
  }

  console.error('[dev:all] Stop the existing process first, then run npm run dev:all again.');
  process.exit(1);
}

function run(name, command, args) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  processes.push(child);

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[dev:all] ${name} exited with ${reason}. Stopping the other process.`);
    shutdown(code ?? 1);
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

await assertPortsAvailable();

console.log('[dev:all] Starting NomokDon local demo stack...');
console.log('[dev:all] API health: http://127.0.0.1:8787/api/health');
console.log('[dev:all] Tenant app:  http://127.0.0.1:5173/tenant/');
console.log('[dev:all] Verify app:  http://127.0.0.1:5173/verify/');
console.log('[dev:all] Issuer app:  http://127.0.0.1:5173/issuer/');
console.log('[dev:all] Root / is only a launcher/placeholder; use the app URLs above for demo QA.');

run('api', 'npm', ['run', 'server']);
run('vite', 'npm', ['run', 'dev', '--', '--port', '5173', '--strictPort']);
