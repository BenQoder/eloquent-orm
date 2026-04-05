# @benqoder/eloquent-orm - GitHub Package Setup

## Registry

Published to **GitHub Packages** for the `BenQoder/eloquent-orm` repository.

---

## Auto-Publishing

Push to `main` and GitHub Actions will:

1. Install dependencies
2. Build the package
3. Bump the patch version
4. Publish to GitHub Packages
5. Commit the version bump back to `main`

---

## First-Time Local Publish

```bash
cd /Users/benqoder/Projects/Haayaa/eloquent-orm
npm login --registry=https://npm.pkg.github.com
npm publish
```

---

## Installing in Other Projects

Create a project-level `.npmrc`:

```ini
@benqoder:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install:

```bash
npm install @benqoder/eloquent-orm
```

---

## Required Token Scope

For local installs and local publishing, use a GitHub token with:

- `read:packages` to install
- `write:packages` to publish

The GitHub Actions workflow uses the repository `GITHUB_TOKEN`.
