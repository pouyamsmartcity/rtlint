// Node entry point: the browser-safe core plus file and config helpers.
export * from './core.js';
export { findConfig, loadConfig } from './config.js';
export { collectFiles, DEFAULT_IGNORE } from './files.js';
export { formatters } from './formatters/index.js';
export { run } from './cli.js';
