# Vendored: `structured-headers`

An RFC 8941 (Structured Field Values for HTTP) parser and serializer.

|               |                                            |
| ------------- | ------------------------------------------ |
| Upstream      | https://github.com/evert/structured-header |
| Package       | `structured-headers`                       |
| Version taken | **1.0.1**                                  |
| Licence       | MIT — see `LICENSE` in this directory      |
| Copyright     | 2018-2023 Bad Gateway Inc. (Evert Pot)     |

## What was taken

The whole parser and serializer, from upstream `src/`:

| This directory  | Upstream            |
| --------------- | ------------------- |
| `parser.ts`     | `src/parser.ts`     |
| `serializer.ts` | `src/serializer.ts` |
| `types.ts`      | `src/types.ts`      |
| `token.ts`      | `src/token.ts`      |
| `util.ts`       | `src/util.ts`       |
| `index.ts`      | `src/index.ts`      |

Nothing else from the package was taken: no build config, no tests, no browser
bundle.

This directory is listed in the package's `files`, so the MIT licence text
travels with every published copy of the compiled output, as the licence
requires.

## Why vendored rather than depended on

`@hellocoop/httpsig` has zero runtime dependencies, deliberately. It verifies
HTTP message signatures, so every package in its dependency closure is a
package that can silently change how a signature is checked. The same reasoning
produced the hand-written JWT verification in `src/utils/` — written by reading
`jose` rather than importing it.

A copy that is read, reviewed, and pinned is a different risk than a version
range resolved at install time. `structured-headers` is itself zero-dependency
and MIT, so copying it costs nothing in licence terms and removes the supply
chain entirely.

## Why the whole grammar rather than a subset

`Signature-Input` is a Dictionary of Inner Lists with parameters, which
exercises nearly every production RFC 8941 defines — Strings with escapes,
Tokens, Integers, Byte Sequences, and parameters on both the inner items and
the Inner List itself. `Signature` is a Dictionary of Byte Sequences.
`Signature-Key` is a Dictionary of Tokens with String parameters. A partial
copy covering "just the Dictionary bits" would have to grow into the rest
anyway, and that growth is how a divergent fourth implementation gets written.

## What was changed

Formatting only, to match this repository's Prettier configuration (4-space
indent, no semicolons, single quotes) and its ESM-style `.js` import
specifiers. No logic, no control flow, no error messages, and no exported names
were changed, so this directory stays diffable against upstream `src/` when
upstream fixes something.

The copy is byte-identical to upstream once the repository's Prettier
configuration is applied and the `.js` specifiers are removed. That is
checkable:

```sh
# from the repository root, with structured-headers@1.0.1 in node_modules
mkdir -p /tmp/sh && cp node_modules/structured-headers/src/*.ts /tmp/sh/
npx prettier --tab-width 4 --no-semi --single-quote --trailing-comma all \
    --write '/tmp/sh/*.ts'

for f in parser serializer types token util index; do
    sed '1,5d' httpsig/src/vendor/structured-headers/$f.ts \
        | sed "s/\.js'/'/g" \
        | diff -u /tmp/sh/$f.ts - || echo "DIVERGED: $f"
done
```

(`sed '1,5d'` drops the vendoring header comment added to each file.)

## Upgrading

1. Read the upstream changelog between the pinned version and the new one.
2. Re-copy `src/`, reformat, restore the `.js` import specifiers.
3. Update the version in this README.
4. Run `npm test` in `httpsig/` — `tests/test-structured-fields.ts` covers the
   shapes this package depends on, including the ones naive parsers get wrong.
