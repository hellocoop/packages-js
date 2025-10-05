# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-04

### Added

- Initial release of @hellocoop/better-auth
- Better Auth plugin for Hellō OIDC provider
- PKCE-based authentication (no client secret required)
- Support for all Hellō scopes (standard, social accounts, ethereum)
- Hellō-specific parameters support:
    - `provider_hint` - Customize login provider preferences
    - `domain_hint` - Specify account type (managed/personal) or domain
    - `login_hint` - Suggest which account to use
    - `prompt` - Control re-authentication and consent
- Client plugin with Hellō-specific sign-in methods
- Type-safe configuration using TypeScript
- Comprehensive documentation and examples
- Verified claims mapping (email, phone, social accounts)
- Support for 15+ login providers
- Multi-language UI support (14+ languages)
