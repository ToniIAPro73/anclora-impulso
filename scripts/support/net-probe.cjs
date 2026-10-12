#!/usr/bin/env node
/**
 * Network-barrier probe. Starts a LOCAL sentinel TCP server (not in any allow-list) with a connection counter and runs a
 * connect attempt from a child process launched through the barrier wrapper given in argv:
 *   node net-probe.cjs <profile.sb>
 * 1. barrier probe: child under `sandbox-exec -f <profile>` must fail to connect; the sentinel must count ZERO connections;
 * 2. control: the SAME child without the barrier must connect (proves the sentinel is reachable and counted, so a zero
 *    in step 1 is not vacuous).
 * Prints one JSON object. Exit 0 only if barrier=blocked, sentinel=0 before control and control=connected.
 */
const net = require('net');
const { spawnSync } = require('child_process');

const profile = process.argv[2];
let connections = 0;
const server = net.createServer((socket) => { connections += 1; socket.destroy(); });
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const childSrc = `const c=require('net').connect(${port},'127.0.0.1');c.on('connect',()=>{console.log('CONNECTED');process.exit(0)});c.on('error',e=>{console.log('ERROR '+e.code);process.exit(0)});setTimeout(()=>{console.log('TIMEOUT');process.exit(0)},5000)`;
  const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000 });
  const blocked = run('/usr/bin/sandbox-exec', ['-f', profile, process.execPath, '-e', childSrc]);
  const afterBarrier = connections;
  const control = run(process.execPath, ['-e', childSrc]);
  setTimeout(() => {
    const result = {
      sentinel: { host: '127.0.0.1', note: 'local, outside every allow-list; port is ephemeral and not recorded' },
      barrierProbe: { outcome: blocked.stdout.trim(), exitStatus: blocked.status, sentinelConnectionsAfter: afterBarrier },
      control: { outcome: control.stdout.trim(), sentinelConnectionsAfter: connections },
    };
    result.pass = /^ERROR (EPERM|EACCES)/.test(result.barrierProbe.outcome) && afterBarrier === 0 &&
      result.control.outcome === 'CONNECTED' && connections === 1;
    console.log(JSON.stringify(result));
    server.close();
    process.exit(result.pass ? 0 : 1);
  }, 300);
});
