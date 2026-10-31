// Stylelint plugin (Stylelint 16+). Runs the CSS-related rtlint rules on
// stylesheets and <style> blocks Stylelint already checks. Problems are
// reported in place; run `rtlint --fix` to apply fixes.
//
//   // stylelint.config.mjs
//   export default { plugins: ['rtlint/stylelint'], rules: { 'rtlint/css': true } };
//
// Options: { "rules": { "css/physical-value": "off", … } } with the same
// syntax as rtlint.config.json.
import stylelint from 'stylelint';
import { lintText, resolveSettings } from './core.js';

const ruleName = 'rtlint/css';
const CSS_RULES = ['css/*', 'class/*', 'security/*'];

const messages = stylelint.utils.ruleMessages(ruleName, {
  problem: (text) => text,
});

const meta = { url: 'https://github.com/pouyamsmartcity/rtlint/blob/main/docs/rules.md' };

function rule(enabled, options = {}) {
  return (root, result) => {
    if (!enabled) return;
    // Each Root is one stylesheet or one <style> block of a .vue/.svelte/.html
    // document; lint its own CSS and shift positions to where it starts.
    const text = root.toString();
    const filePath = root.source?.input?.file ?? 'input.css';
    const own = Object.fromEntries(CSS_RULES.map((p) => [p, 'warn']));
    const settings = resolveSettings(
      { ...options, rules: { '*': 'off', ...own, ...(options.rules ?? {}) } },
      filePath,
    );
    const asCss = /\.(?:css|scss|sass|less|styl|pcss)$/i.test(filePath) ? filePath : 'block.scss';
    const origin = root.source?.start ?? { line: 1, column: 1 };
    const shift = ({ line, column }) => ({
      line: origin.line + line - 1,
      column: line === 1 ? origin.column + column - 1 : column,
    });
    const { messages: found } = lintText(text, { filePath: asCss, settings });
    for (const m of found) {
      stylelint.utils.report({
        ruleName,
        result,
        node: root,
        message: messages.problem(`${m.message} (${m.ruleId})`),
        start: shift({ line: m.line, column: m.column }),
        end: shift({ line: m.endLine, column: m.endColumn }),
        severity: m.severity === 2 ? 'error' : 'warning',
      });
    }
  };
}

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default stylelint.createPlugin(ruleName, rule);
