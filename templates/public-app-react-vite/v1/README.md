# Public App React/Vite Template v1

This is the optional React/Vite scaffold for MilosApps public apps. It is a
template, not a shared browser runtime or a new Shell/Essentials contract.
Wolkenpost is the proven reference for the integration boundary.

## Ownership model

1. Copy this directory into a new or explicitly migrating app repository from
   the immutable tag `public-app-react-vite-template-v1.0.0`.
2. Record that tag as scaffold provenance, rename the package and replace the
   starter copy/icon.
3. The app owns all copied source, package pins and `pnpm-lock.yaml` from that
   point forward. Later template tags do not trigger sync, campaigns or
   Windows vendor recheckout.
4. Register a new appKey before implementation. Sync Shell, Layout and
   Essentials separately from their own immutable releases; never copy their
   runtime from this template or import from the Shared worktree.

## Boundary

- Static loader and `<milos-app-shell>` stay outside React.
- React owns only `[data-milos-react-root]` inside the main Shell slot.
- Locale enters through `milosapps:localechange`; app readiness exits through
  `milosAppEssentials.ready()`.
- `src/milosapps-elements.d.ts` types the published Shared custom-element
  boundary without turning those elements into React-owned implementations.
- Runtime assets are bundled and same-origin. There is no React CDN.
- `MILOSAPP_BASE=/your-subpath/` builds a host-specific base without changing
  source imports.
- React Aria is an opt-in recipe under [`recipes/react-aria`](recipes/react-aria/README.md),
  not a baseline dependency.

The standalone preview uses a minimal local startup stylesheet so the scaffold
can validate before it owns a registered appKey. A real consumer replaces that
preview boundary with its pinned app-local Shared bootstraps, manifest, lock
and theme.

## Commands

Use Node 24 and the pinned pnpm version:

```powershell
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
pnpm test:ci
```

For a subpath build:

```powershell
$env:MILOSAPP_BASE='/example-app/'
pnpm build
```

## Required consumer checks

Run checks according to the actual risk tier. The first integration verifies
typecheck, unit tests, production build, strict CSP/no external runtime,
Locale/Ready bridges, Desktop, 390×844 and 360×800 at 200 percent. Later
focused logic changes do not repeat that whole matrix unless they affect the
corresponding boundary. Pin/Vendor/Lock/LF changes retain the existing Windows
recheckout rule.
