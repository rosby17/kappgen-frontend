# Architecture des domaines KappGen

Le même build frontend sert deux surfaces selon le nom d'hôte :

- `https://kappgen.com` : landing page marketing.
- `https://app.kappgen.com` : application KappGen.
- `https://api.kappgen.com` : API FastAPI existante.

## Cloudflare Pages

Le projet Pages `kappgen-frontend` doit avoir les deux domaines personnalisés :

1. `kappgen.com`
2. `app.kappgen.com`

Dans **Workers & Pages → kappgen-frontend → Custom domains**, ajouter le second domaine.
Cloudflare crée automatiquement le CNAME et le certificat TLS.

Variables de build :

```env
VITE_API_BASE=https://api.kappgen.com/api
VITE_STORAGE_BASE=https://api.kappgen.com/storage
VITE_APP_ORIGIN=https://app.kappgen.com
```

Commande de build : `npm run build`

Répertoire de sortie : `dist`

Le fallback SPA est fourni par `public/_redirects` et `vercel.json`.

## Routes de l'application

- `/dashboard`
- `/channels`
- `/channels/new`
- `/channels/:slug`
- `/channels/:slug/edit`
- `/videos`
- `/login`
- `/signup`

En développement, la landing est sur `/` et l'application est disponible sous
`/app/dashboard` grâce au `basename` local du routeur.
