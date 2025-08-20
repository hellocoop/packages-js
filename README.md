# Hellō Packages

This is a monorepo of packages for developing and integrating [Hellō](https://hello.dev)

## [@hellocoop/express](./express/)

A package to add login and registration with Hellō to an Express application.

[Hellō Express Quickstart documentation](https://www.hello.dev/docs/quickstarts/express)

[Hellō Express SDK documentation](https://www.hello.dev/docs/sdks/express)

## [@hellocoop/fastify](./fastify/)

A package to add login and registration with Hellō to an Fastify application.

[Hellō Fastify Quickstart documentation](https://www.hello.dev/docs/quickstarts/fastify)

[Hellō Fastify SDK documentation](https://www.hello.dev/docs/sdks/fastify)

## [@hellocoop/nextjs](./nextjs/)

A package to add login and registration with Hellō to a Next.js application.

[HellōnNext.js Quickstart documentation](https://www.hello.dev/docs/quickstarts/nextjs)

[Hellō Next.js SDK documentation](https://www.hello.dev/docs/sdks/nextjs)

## [@hellocoop/react](./react/)

React components for Hellō - BETA

[Hellō React SDK documentation](https://www.hello.dev/docs/sdks/react)

## [@hellocoop/svelte](./svelte/)

Svelte components for Hellō - BETA

[Hellō React SDK documentation](https://www.hello.dev/docs/sdks/svelte)

## [@hellocoop/quickstart](./quickstart/)

A CLI and nodejs package to create or retrieve a Hellō `client_id`.

[Quickstart CLI and API Documentation](https://www.hello.dev/docs/sdks/quickstart)

## [@hellocoop/helper-server](./helper-server/)

A set of Node.js helper functions for the Hellō OpenID Connect Provider.

## [@hellocoop/helper-browser](./helper-browser/)

A set of client side helper functions for the Hellō OpenID Connect Provider.

[Hellō core / client SDK documentation](https://www.hello.dev/docs/sdks/helper/)

## 🧪 [@hellocoop/web-identity](./web-identity/) - EXPERIMENTAL

TypeScript functions for generating and verifying JWT tokens used in the [Verified Email Autocomplete](https://github.com/dickhardt/verified-email-autocomplete) protocol. This package implements RequestToken, IssuedToken (SD-JWT), and PresentationToken (SD-JWT+KB) generation and verification, along with DNS-based issuer discovery.

**Status**: Experimental - API may change

[Package README](./web-identity/README.md) | [Specification](https://github.com/dickhardt/verified-email-autocomplete)

# Publishing New Versions

- make updates and commit changes to repo
- `npx lerna version` will then see which workspaces have changes and prompt to update the version, and all dependent versions

setup with

`npx lerna init --independent`

`lerna publish from-package` will only publish packages that have a different version then what is published

`lerna publish` will prompt to update the version of the package as well
