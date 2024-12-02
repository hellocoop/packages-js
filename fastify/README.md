# Fastify package for Hellō

[Hellō](https://hello.dev) is an identity network that provides login and registration using the standard OpenID Connect protocol. Hellō offers your users choice between all popular social login providers.

This [Fastify](https://fastify.dev/) package provides an endpoint that handles all protocol interactions and sets an encrypted cookie with the logged in user's information. The cookie contents are decrypted and available as `req.getAuth()`.

See the [Fastify Quickstart documentation](https://www.hello.dev/docs/quickstarts/fastify) for how to add Hellō to your Fastify app in minutes, and the [Fastify SDK documentation](https://www.hello.dev/docs/sdks/fastify) for details.
