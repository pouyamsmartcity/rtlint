# Ready-to-copy setups

| File | What it sets up |
| --- | --- |
| [`rtlint.config.json`](rtlint.config.json) | A Persian/English Tailwind project: Persian messages, opt-in Persian number rules, legacy code ignored |
| [`eslint.config.js`](eslint.config.js) | rtlint inside ESLint (flat config), Persian messages in the editor |
| [`stylelint.config.mjs`](stylelint.config.mjs) | rtlint's CSS rules inside Stylelint |
| [`vite.config.js`](vite.config.js) | Problems in the Vite dev server; the build fails on errors |
| [`rtlint.yml`](rtlint.yml) | GitHub Actions: changed files only, annotations, job summary, SARIF for code scanning |
| [`.pre-commit-config.yaml`](.pre-commit-config.yaml) | [pre-commit](https://pre-commit.com) hook that fixes staged files |
| [`.lintstagedrc.json`](.lintstagedrc.json) | lint-staged + husky alternative |

Install first: `npm install --save-dev @pouyam/rtlint`.
