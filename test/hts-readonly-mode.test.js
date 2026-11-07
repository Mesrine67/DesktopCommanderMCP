import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  isHtsAllowedTool, assertHtsReadOnlyTool,
} from '../dist/utils/hts-readonly-mode.js';
import { isTelemetryDisabledValue } from '../dist/config-manager.js';

test('HTS read-only mode denies unapproved tools, URLs and out-of-root paths', async () => {
  const previousEnabled = process.env.HTS_MCP_READ_ONLY;
  const previousRoot = process.env.HTS_MCP_ROOT;
  const dir = await mkdtemp(path.join(tmpdir(), 'hts-mcp-policy-'));
  const allowed = path.join(dir, 'allowed');
  const outside = path.join(dir, 'outside');
  try {
    await mkdir(allowed);
    await mkdir(outside);
    const insideFile = path.join(allowed, 'source.txt');
    const outsideFile = path.join(outside, 'private.txt');
    await writeFile(insideFile, 'test data', 'utf8');
    await writeFile(outsideFile, 'private', 'utf8');
    process.env.HTS_MCP_READ_ONLY = '1';
    process.env.HTS_MCP_ROOT = allowed;
    assert.equal(isTelemetryDisabledValue(true), true, 'telemetry disabled regardless of persisted setting');

    assert.equal(isHtsAllowedTool('read_file'), true);
    assert.equal(isHtsAllowedTool('start_process'), false);
    assert.equal(isHtsAllowedTool('set_config_value'), false);
    await assertHtsReadOnlyTool('read_file', { path: insideFile });
    await assertHtsReadOnlyTool('list_directory', { path: allowed, depth: 2 });
    await assertHtsReadOnlyTool('read_multiple_files', { paths: [insideFile] });
    await assert.rejects(() => assertHtsReadOnlyTool('start_process', { command: 'whoami' }), /not authorized/);
    await assert.rejects(() => assertHtsReadOnlyTool('read_file', { path: outsideFile }), /outside the selected root/);
    await assert.rejects(() => assertHtsReadOnlyTool('read_file', { path: 'https://example.com/a', isUrl: true }), /network and output paths/);
    await assert.rejects(() => assertHtsReadOnlyTool('read_file', { path: insideFile, outputPath: outsideFile }), /network and output paths/);
    await assert.rejects(() => assertHtsReadOnlyTool('list_directory', { path: allowed, depth: 999 }), /depth/);
    await assert.rejects(() => assertHtsReadOnlyTool('read_multiple_files', { paths: [] }), /invalid list/);

    // Windows junctions or POSIX symlinks must not bypass the folder restriction.
    const link = path.join(allowed, 'external-link');
    try {
      await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
      await assert.rejects(() => assertHtsReadOnlyTool('read_file', { path: path.join(link, 'private.txt') }), /outside the selected root/);
    } catch (error) {
      if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error;
    }
    delete process.env.HTS_MCP_ROOT;
    await assert.rejects(() => assertHtsReadOnlyTool('read_file', { path: insideFile }), /mandatory/);
  } finally {
    if (previousEnabled === undefined) delete process.env.HTS_MCP_READ_ONLY;
    else process.env.HTS_MCP_READ_ONLY = previousEnabled;
    if (previousRoot === undefined) delete process.env.HTS_MCP_ROOT;
    else process.env.HTS_MCP_ROOT = previousRoot;
    await rm(dir, { recursive: true, force: true });
  }
});
