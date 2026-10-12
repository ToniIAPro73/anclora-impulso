/**
 * Jest reporter: when a run has failures, persists a sanitized diagnostic bundle under
 * backend/artifacts/test-failures/ (git-ignored): exact failing test names, suite execution order and timings,
 * seed/randomization (if used), worker model, environment summary and sanitized console output.
 * Nothing is written for green runs.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sanitize } = require('./sanitize');

class FailureReporter {
  constructor(globalConfig) {
    this.globalConfig = globalConfig;
    this.startedAt = Date.now();
    this.order = [];
  }

  onTestFileStart(test) {
    this.order.push({ file: path.relative(this.globalConfig.rootDir, test.path), startedAtMs: Date.now() - this.startedAt });
  }

  onRunComplete(_contexts, results) {
    const failed = results.numFailedTests > 0 || results.numRuntimeErrorTestSuites > 0 || results.numFailedTestSuites > 0;
    if (!failed) return;

    const suites = results.testResults.map((suite) => {
      const rel = path.relative(this.globalConfig.rootDir, suite.testFilePath);
      const startedMs = (this.order.find((o) => o.file === rel) || {}).startedAtMs;
      return {
        file: rel,
        status: suite.numFailingTests > 0 || suite.testExecError ? 'failed' : 'passed',
        startedAtMs: startedMs,
        durationMs: suite.perfStats ? suite.perfStats.end - suite.perfStats.start : undefined,
        // jest does not expose worker ids; in-band runs execute every suite in the main process.
        executedIn: this.globalConfig.runInBand || this.globalConfig.maxWorkers === 1 ? 'main-process(runInBand)' : 'worker(id not exposed by jest)',
        testExecError: suite.testExecError ? sanitize(String(suite.testExecError.message || suite.testExecError)) : undefined,
        failedTests: suite.testResults
          .filter((t) => t.status === 'failed')
          .map((t) => ({
            fullName: t.fullName,
            durationMs: t.duration,
            failureMessages: (t.failureMessages || []).map((m) => sanitize(m).split('\n').slice(0, 25).join('\n')),
          })),
        slowTests: suite.testResults
          .filter((t) => (t.duration || 0) > 1000)
          .map((t) => ({ fullName: t.fullName, durationMs: t.duration })),
        console: (suite.console || [])
          .slice(-40)
          .map((c) => ({ type: c.type, message: sanitize(String(c.message)).slice(0, 600) })),
      };
    });

    const bundle = {
      generatedAt: new Date().toISOString(),
      summary: {
        failedTests: results.numFailedTests,
        failedSuites: results.numFailedTestSuites,
        runtimeErrorSuites: results.numRuntimeErrorTestSuites,
        totalTests: results.numTotalTests,
      },
      runner: {
        node: process.version,
        platform: `${os.platform()} ${os.release()}`,
        cpus: os.cpus().length,
        loadAvg: os.loadavg().map((n) => Number(n.toFixed(2))),
        runInBand: this.globalConfig.runInBand,
        maxWorkers: this.globalConfig.maxWorkers,
        randomize: this.globalConfig.randomize === true,
        seed: this.globalConfig.randomize === true ? this.globalConfig.seed : null,
        sequencer: this.globalConfig.testSequencer,
        orderNote: 'Suite order below is the actual execution order; with the default sequencer it depends on the jest cache (previous failures/durations).',
        wallClockUtc: new Date(this.startedAt).toISOString(),
      },
      suiteExecutionOrder: this.order.map((o) => o.file),
      suites: suites.filter((s) => s.status === 'failed').concat(suites.filter((s) => s.status === 'passed').map((s) => ({ file: s.file, status: s.status, startedAtMs: s.startedAtMs, durationMs: s.durationMs }))),
    };

    const dir = path.join(this.globalConfig.rootDir, 'artifacts', 'test-failures');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `failure-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(bundle, null, 2));
    process.stderr.write(`\n[failure-reporter] diagnostic bundle: ${path.relative(this.globalConfig.rootDir, file)}\n`);
  }
}

module.exports = FailureReporter;
