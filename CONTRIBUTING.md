## Contributing to LLM Watch

Thanks for your interest. This file captures quick developer tips and a checklist for preparing the plugin for Grafana Marketplace.

Developer setup
- Clone the repo and install dependencies in the plugin folder:
```bash
git clone <repo-url>
cd plugin/anglerfishlyy-llmwatch-panel
npm install
```

- Run dev build (hot reload):
```bash
npm run dev
```

- Agent development:
```bash
cd ../../agent
npm ci
npm run dev
```

Grafana toolkit validation
- Install toolkit locally (optional):
```bash
npx @grafana/toolkit plugin:validate
```
- Note: Grafana tooling changes over time. If `@grafana/toolkit` is deprecated, use `@grafana/create-plugin` or consult Grafana docs.

Marketplace checklist
- [ ] plugin.json is valid and matches Grafana schema
- [ ] Screenshots included in `src/img` and listed in `src/plugin.json` `info.screenshots`
- [ ] Unit tests (Jest) present and passing
- [ ] E2E tests (Playwright) pass on the target environment
- [ ] Build and CI pipeline includes `npm run ci-build` and signing
- [ ] License and README updated for marketplace audiences

Submitting and signing
- The Grafana Marketplace requires plugins to be signed. Use the `npm run sign` convenience script:
```bash
cd plugin/anglerfishlyy-llmwatch-panel
npm run sign
```
- You will need a signing key and Grafana account. See Grafana docs for steps to obtain signing keys.

Thank you for contributing — please open issues or PRs for any improvements.
