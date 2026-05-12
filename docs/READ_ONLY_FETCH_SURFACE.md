# Read-Only Fetch Surface

This ORM intentionally exposes fetch/query behavior only. Native mutation methods such as `save`, `create`, `insert`, `update`, `delete`, `increment`, `decrement`, `attach`, `detach`, and `sync` must not be added to the public ORM surface.

## Supported Fetch Improvements

- Laravel-style object predicates: `where({ ... })` and `orWhere({ ... })`
- Null-aware object predicates: `{ deleted_at: null }` compiles as `IS NULL`
- Key predicates: `whereKey()` and `whereKeyNot()`
- Column comparisons: `whereColumn()` and `orWhereColumn()`
- Relation aggregate projections: `withAggregate()`, `withSum()`, `withAvg()`, `withMin()`, and `withMax()`
- Broader relation query delegation through relation objects, including predicates, eager loading, aggregates, ordering, and read execution helpers
- Eager-load callback and column replay by full relation path, including nested relations like `posts.tags`
- Runtime direct scope discovery: a model method named `scopePublished(query)` is callable as `Model.query().published()`
- Read-helper extension hooks via `Eloquent.registerReadHelper()` and `Eloquent.registerReadHelpers()`
- Optional cast inference for row-like sources by setting `static inferCasts = true`

## Guardrail

Run:

```bash
npm run test:fetch-surface
```

The scanner verifies required read APIs exist and fails if public native mutation methods are introduced in `src/Eloquent.ts` or relation classes.
