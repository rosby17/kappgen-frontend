# Architecture des domaines NicheCut

Le même build frontend sert deux surfaces selon le nom d'hôte :

- `https://nichecut.tools-cl.com` : landing page marketing.
- `https://appnichecut.tools-cl.com` : application NicheCut.
- `https://api-nichecut.tools-cl.com` : API FastAPI existante.

## Cloudflare Pages

Le projet Pages `nichecut` doit avoir les deux domaines personnalisés :

1. `nichecut.tools-cl.com`
2. `appnichecut.tools-cl.com`

Dans **Workers & Pages → nichecut → Custom domains**, ajouter le second domaine.
Cloudflare crée automatiquement le CNAME et le certificat TLS.

Variables de build :

```env
VITE_API_BASE=https://api-nichecut.tools-cl.com/api
VITE_STORAGE_BASE=https://api-nichecut.tools-cl.com/storage
VITE_APP_ORIGIN=https://appnichecut.tools-cl.com
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
