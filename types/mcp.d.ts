export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
export const TOOLS: McpTool[];
/** Runs one MCP tool and returns its data. */
export function callTool(name: string, args?: Record<string, unknown>, cwd?: string): unknown;
/** Handles one JSON-RPC message; null for notifications. */
export function handle(message: Record<string, unknown>, cwd?: string): Record<string, unknown> | null;
/** Serves MCP over stdio until stdin closes. */
export function serve(io?: { stdin?: NodeJS.ReadableStream; stdout?: NodeJS.WritableStream; cwd?: string }): Promise<void>;
