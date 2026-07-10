# Service de compilation LaTeX — Mathématiques à Valadon
# ---------------------------------------------------------
# Base légère (Debian), on y ajoute Tectonic (moteur LaTeX auto-suffisant,
# licence MIT) et un petit serveur Node/Express qui l'expose en HTTP.

FROM node:20-bookworm-slim

# Version figée de Tectonic (mettre à jour cette valeur pour changer de version)
ENV TECTONIC_VERSION=0.16.9

# Récupère le binaire Tectonic précompilé (pas de compilation depuis les
# sources : téléchargement direct depuis les releases GitHub officielles).
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    curl -fsSL -o /tmp/tectonic.tar.gz \
      "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic@${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-gnu.tar.gz" && \
    tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/tectonic && \
    rm /tmp/tectonic.tar.gz && \
    apt-get remove -y curl && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

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
