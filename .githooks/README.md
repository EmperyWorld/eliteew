# Git hooks (Zero-Trust)

Version-controlled Git hooks for EliteEW monorepo integrity.

## Install (operator)

```bash
bash scripts/eliteew/install-zero-trust-git-hooks.sh
```

Or via [pre-commit](https://pre-commit.com/) (recommended on command-center):

```bash
pre-commit install
```

Canon: `documentation/platform/ZERO-TRUST-GIT-HOOKS.md`

Emergency bypass (logged, not for routine use):

```bash
SKIP_ZERO_TRUST_PRE_COMMIT=1 git commit ...
```
