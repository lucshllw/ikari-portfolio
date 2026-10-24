# Ikari — Portfolio source

Reviewed source snapshot of the Ikari audiovisual portfolio and its application code.

Website: https://www.ikari-studio.me

Built with SvelteKit, Svelte and TypeScript. Includes responsive portfolio pages, work filtering, media presentation, contact handling and the application components needed for a self-hosted installation.

## Scope

This public repository contains source code, published presentation assets, curated public catalog metadata and tests. The three JSON files under `docs/` contain only public work credits, source links and media checksums required by the seed scripts; research notes and operational reports are excluded. Operational history, internal reports, local databases, customer inquiries, credentials and production configuration are excluded.
The source does not provide access to the production editor, inbox or storage. Authentication and storage must be configured independently for a new installation.

## Development

Use Node.js 24 and npm.

```sh
npm ci
npm run check
npm test
npm run build
```

Copy `.env.example` to `.env` only for your own installation and configure the required values locally. Use an independent `DATA_DIR` outside the repository for persistent data. Never commit `.env`, databases or authentication secrets.
The default build targets a Node.js server. For cloud installations, configure the storage provider, authentication and server-side secrets separately before deployment. Do not connect a test installation to an existing production database.

```sh
npm run dev
```

The development server uses http://127.0.0.1:4173.

## Credits

Website development by Lucas Melo. Audiovisual work, illustrations, covers, logos and fonts belong to their respective authors. Publishing this source does not transfer rights to these materials. This repository does not declare an open-source license for third-party assets.
