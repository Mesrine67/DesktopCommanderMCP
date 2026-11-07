/**
 * Opt-in, fail-closed MCP profile for HébergTonServ Desktop.
 *
 * HTS_MCP_READ_ONLY=1 and HTS_MCP_ROOT=<existing absolute directory>
 * are required. This is intentionally distinct from upstream's user-managed
 * allowedDirectories setting: an empty array there grants full disk access.
 */
import path from "node:path";
import { realpath } from "node:fs/promises";

export const HTS_READ_ONLY_TOOLS = new Set([
  "read_file",
  "read_multiple_files",
  "list_directory",
  "get_file_info",
] as const);

export function isHtsReadOnlyMode(): boolean {
  return process.env.HTS_MCP_READ_ONLY === "1";
}

export function isHtsAllowedTool(tool: string): boolean {
  return !isHtsReadOnlyMode() || HTS_READ_ONLY_TOOLS.has(tool as never);
}

function requestedPaths(tool: string, input: Record<string, unknown>): string[] {
  if (tool === "read_multiple_files") {
    if (!Array.isArray(input.paths) || !input.paths.length || input.paths.length > 20
        || !input.paths.every(item => typeof item === "string")) {
      throw new Error("HTS read-only: invalid list of file paths.");
    }
    return input.paths as string[];
  }

  if (typeof input.path !== "string") {
    throw new Error("HTS read-only: a file or directory path is required.");
  }
  return [input.path];
}

function withinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative));
}

export async function assertHtsReadOnlyTool(
  tool: string,
  params: unknown,
): Promise<void> {
  if (!isHtsReadOnlyMode()) return;
  if (!isHtsAllowedTool(tool)) {
    throw new Error("HTS read-only: this MCP tool is not authorized.");
  }

  const root = process.env.HTS_MCP_ROOT;
  if (!root || !path.isAbsolute(root)) {
    throw new Error("HTS read-only: an absolute HTS_MCP_ROOT is mandatory.");
  }
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new Error("HTS read-only: invalid tool arguments.");
  }
  const args = params as Record<string, unknown>;
  if (args.isUrl === true || args.outputPath !== undefined) {
    throw new Error("HTS read-only: network and output paths are disabled.");
  }
  if (tool === "list_directory" && typeof args.depth === "number"
      && (!Number.isInteger(args.depth) || args.depth < 0 || args.depth > 3)) {
    throw new Error("HTS read-only: directory depth must be between 0 and 3.");
  }

  // Resolve both sides: Windows junctions and symbolic links must not escape
  // an allowed directory even if the textual path looks like a descendant.
  const rootReal = await realpath(root).catch(() => {
    throw new Error("HTS read-only: configured root does not exist.");
  });
  for (const requested of requestedPaths(tool, args)) {
    if (!path.isAbsolute(requested) || requested.includes("://")) {
      throw new Error("HTS read-only: only absolute local paths are allowed.");
    }
    const targetReal = await realpath(requested).catch(() => {
      throw new Error("HTS read-only: requested path does not exist.");
    });
    if (!withinRoot(rootReal, targetReal)) {
      throw new Error("HTS read-only: access outside the selected root is denied.");
    }
  }
}
