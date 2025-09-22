#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

let force = false;
let explicitSignal;
const positional = [];

for (const arg of args) {
  if (arg === '-f' || arg === '--force') {
    force = true;
  } else if (arg.startsWith('--signal=')) {
    explicitSignal = arg.slice('--signal='.length).trim();
  } else if (arg.startsWith('-')) {
    console.error(`Unknown option: ${arg}`);
    printHelp(1);
  } else {
    positional.push(arg);
  }
}

if (positional.length === 0) {
  console.error('Missing <port> argument.');
  printHelp(1);
}
if (positional.length > 1) {
  console.error('Only one <port> argument is supported.');
  printHelp(1);
}

const port = Number.parseInt(positional[0], 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${positional[0]}. Expected an integer between 1 and 65535.`);
  process.exit(1);
}

const signal = explicitSignal || (force ? 'SIGKILL' : 'SIGTERM');
const pids = Array.from(findPids(port));

if (pids.length === 0) {
  console.log(`No process found listening on TCP port ${port}.`);
  process.exit(0);
}

const { killed, failed } = killPids(pids, signal);

if (killed.length) {
  console.log(`Sent ${signal} to PID${killed.length > 1 ? 's' : ''}: ${killed.join(', ')}.`);
}

if (failed.length) {
  console.error('Failed to signal the following PID(s):');
  for (const { pid, error } of failed) {
    if (error.code === 'ESRCH') {
      console.error(`  - ${pid} (process already exited)`);
    } else if (error.code === 'EPERM') {
      console.error(`  - ${pid} (permission denied)`);
    } else {
      console.error(`  - ${pid} (${error.message})`);
    }
  }
  process.exit(1);
}

function printHelp(exitCode = 0) {
  console.log(`Usage: kp <port> [options]\n\nOptions:\n  -f, --force          Use SIGKILL instead of the default SIGTERM\n      --signal=<name>   Send a specific signal (overrides --force)\n  -h, --help           Show this help message\n`);
  process.exit(exitCode);
}

function findPids(port) {
  if (process.platform === 'win32') {
    return findPidsWindows(port);
  }
  return findPidsUnix(port);
}

function findPidsUnix(port) {
  const pids = new Set();

  // Prefer lsof when available as it is installed by default on macOS and most Linux distributions.
  const lsofAttempts = [
    ['-nti', `tcp:${port}`],
    ['-ti', `:${port}`]
  ];

  for (const args of lsofAttempts) {
    const res = spawnSync('lsof', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (res.error) {
      if (res.error.code === 'ENOENT') {
        break; // lsof not installed.
      }
      continue;
    }
    if (res.status === 0) {
      collectPids(pids, res.stdout);
      if (pids.size) {
        return pids;
      }
    }
  }

  // Fallback to fuser when lsof is unavailable or produced no results.
  const fuser = spawnSync('fuser', ['-n', 'tcp', String(port)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!fuser.error && (fuser.status === 0 || fuser.status === 1)) {
    // fuser emits PID list on stdout, sometimes on stderr depending on implementation.
    collectPids(pids, fuser.stdout);
    collectPids(pids, fuser.stderr);
  }

  if (pids.size) {
    return pids;
  }

  if (process.platform !== 'darwin') {
    const ss = spawnSync('ss', ['-tanp'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!ss.error && typeof ss.stdout === 'string') {
      const regex = new RegExp(`:${port}\\b`);
      const pidRegex = /pid=(\d+)/;
      for (const line of ss.stdout.split('\n')) {
        if (!regex.test(line)) continue;
        const pidMatch = line.match(pidRegex);
        if (pidMatch) {
          pids.add(parseInt(pidMatch[1], 10));
        }
      }
      if (pids.size) {
        return pids;
      }
    }
  }

  // netstat fallback provides broader compatibility even though parsing is noisier.
  const netstatArgsList = process.platform === 'darwin'
    ? [['-an', '-p', 'tcp'], ['-anp', 'tcp']]
    : [['-antp'], ['-anp']];

  const regex = new RegExp(`:${port}\\b`);
  for (const netstatArgs of netstatArgsList) {
    const netstat = spawnSync('netstat', netstatArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (netstat.error || typeof netstat.stdout !== 'string') {
      continue;
    }
    for (const line of netstat.stdout.split('\n')) {
      if (!regex.test(line)) continue;
      const pid = parseInt(line.trim().split(/\s+/).pop(), 10);
      if (Number.isInteger(pid)) {
        pids.add(pid);
      }
    }
    if (pids.size) {
      break;
    }
  }

  return pids;
}

function findPidsWindows(port) {
  const pids = new Set();

  const psCommand = `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`;
  const powershell = spawnSync('powershell', ['-NoProfile', '-Command', psCommand], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (!powershell.error && powershell.stdout) {
    collectPids(pids, powershell.stdout);
  }

  if (pids.size) {
    return pids;
  }

  const netstat = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!netstat.error && typeof netstat.stdout === 'string') {
    const regex = new RegExp(`:${port}\\b`);
    for (const line of netstat.stdout.split('\n')) {
      if (!regex.test(line)) continue;
      const pid = parseInt(line.trim().split(/\s+/).pop(), 10);
      if (Number.isInteger(pid)) {
        pids.add(pid);
      }
    }
  }

  return pids;
}

function collectPids(target, text) {
  if (!text) return;
  for (const token of text.split(/\s+/)) {
    const pid = parseInt(token, 10);
    if (Number.isInteger(pid)) {
      target.add(pid);
    }
  }
}

function killPids(pids, signal) {
  const killed = [];
  const failed = [];

  for (const pid of pids) {
    try {
      process.kill(pid, signal);
      killed.push(pid);
    } catch (error) {
      if (error.code === 'ESRCH') {
        // Treat already stopped processes as non-fatal.
        killed.push(pid);
      } else {
        failed.push({ pid, error });
      }
    }
  }

  return { killed, failed };
}
