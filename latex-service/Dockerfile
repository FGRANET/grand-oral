# Service de compilation LaTeX — Mathématiques à Valadon
# ---------------------------------------------------------
# Base Alpine : Tectonic y est un paquet officiel (dépôt "community"), avec
# TOUTES ses dépendances gérées automatiquement par apk. On évite ainsi les
# deux pièges rencontrés avec un binaire téléchargé manuellement sur Debian :
# bibliothèques partagées manquantes, et incompatibilité de version de glibc.

FROM alpine:3.21

# nodejs/npm pour le serveur, tectonic pour la compilation, ca-certificates
# pour les requêtes HTTPS (récupération du bundle TeXLive au premier usage —
# ici uniquement au moment du préchauffage, voir plus bas).
RUN apk add --no-cache nodejs npm tectonic ca-certificates

WORKDIR /app

# Le cache Tectonic (bundle TeXLive + packages) est stocké ici, DANS l'image :
# préchauffé une seule fois au moment du build (étape suivante), ce qui évite
# tout appel réseau au moment de compiler une vraie interro en production —
# important sur les hébergements gratuits où le conteneur peut redémarrer
# fréquemment (veille après inactivité, redéploiements, etc.).
ENV TECTONIC_CACHE_DIR=/app/.tectonic-cache

# Préchauffage : compile un document minimal qui utilise EXACTEMENT les
# mêmes packages que l'application (inputenc, fontenc, babel french,
# amsmath/amssymb, tcolorbox, fancyhdr, forloop, geometry, enumitem, multicol).
# Le résultat (le PDF) n'est pas conservé, seul le cache rempli nous intéresse.
COPY warmup.tex ./warmup.tex
RUN tectonic --outdir /tmp warmup.tex && rm warmup.tex /tmp/warmup.pdf

# Dépendances Node du serveur
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
