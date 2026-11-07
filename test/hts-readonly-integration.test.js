import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { connectToServer, closeClient } from './helpers/mcp-client.js';

test('real MCP stdio server advertises only scoped read tools and rejects bypasses', { timeout: 40_000 }, async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'hts-mcp-stdio-'));
  const allowed = path.join(workspace, 'allowed');
  const blocked = path.join(workspace, 'blocked');
  let client;
  try {
    await mkdir(allowed);
    await mkdir(blocked);
    const validPath = path.join(allowed, 'hello.txt');
    const invalidPath = path.join(blocked, 'secret.txt');
    await writeFile(validPath, 'Hello from scoped MCP', 'utf8');
    await writeFile(invalidPath, 'Do not expose', 'utf8');
    const env = { ...process.env, HTS_MCP_READ_ONLY: '1', HTS_MCP_ROOT: allowed };
    client = await connectToServer('hts-safe-client', env);
    const tools = (await client.listTools()).tools.map(tool => tool.name).sort();
    assert.deepEqual(tools, ['get_file_info', 'list_directory', 'read_file', 'read_multiple_files']);
    assert.deepEqual((await client.listResources()).resources, []);

    const result = await client.callTool({ name: 'read_file', arguments: { path: validPath } });
    assert.match(JSON.stringify(result), /Hello from scoped MCP/);
    await assert.rejects(() => client.callTool({name: 'read_file', arguments: {path: invalidPath}}), /outside the selected root/);
    await assert.rejects(() => client.callTool({name: 'read_file', arguments: {path:'https:\/\/example.com',isUrl:true}}), /network and output paths/);
    await assert.rejects(() => client.callTool({name: 'start_process', arguments: { command:'whoami' }}), /not authorized/);
    await assert.rejects(() => client.callTool({name: 'set_config_value', arguments: {key:'allowedDirectories',value:[]}}), /not authorized/);
  } finally {
    await closeClient(client);
    await rm(workspace, {recursive:true,force:true});
  }
});
