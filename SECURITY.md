# Security policy

rtlint reads source files and, with `--fix`, rewrites them. It runs no code from the files it
reads and makes no network requests.

If you find a vulnerability (for example input that makes rtlint hang, or a fix that could
hide malicious code), please report it privately via
[GitHub security advisories](https://github.com/pouyamsmartcity/rtlint/security/advisories/new)
instead of opening a public issue. We aim to respond within a few days.

The `security/bidi-control` rule detects Trojan Source (CVE-2021-42574) characters. If you know
of a variant it misses, that is a security report too.
