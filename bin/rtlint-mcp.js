#!/usr/bin/env node
// MCP server for AI assistants: `npx -y @pouyam/rtlint mcp` or the rtlint-mcp binary.
import { serve } from '../src/mcp.js';

await serve();
