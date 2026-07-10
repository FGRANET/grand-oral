// Service de compilation LaTeX pour "Mathématiques à Valadon"
// -------------------------------------------------------------
// Reçoit le contenu d'un fichier .tex (texte brut) en POST /compile,
// le compile avec Tectonic (moteur LaTeX auto-suffisant, licence MIT),
// et renvoie le PDF résultant. C'est EXACTEMENT le même moteur qu'un
// pdflatex/xelatex classique — le rendu est donc identique à celui
// obtenu en compilant le .tex soi-même.

import express from "express";
import cors from "cors";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const app = express();

// Accepte un corps de requête texte brut (le contenu du .tex), jusqu'à 5 Mo
app.use(cors());
app.use(express.text({ type: "*/*", limit: "5mb" }));

app.get("/", (_req, res) => {
  res.send("Service de compilation LaTeX — Mathématiques à Valadon. POST /compile avec le contenu .tex en corps de requête.");
});

app.post("/compile", async (req, res) => {
  const texSource = req.body;
  if (!texSource || typeof texSource !== "string" || texSource.trim().length === 0) {
    return res.status(400).json({ error: "Corps de requête vide ou invalide : le contenu du .tex est attendu en texte brut." });
  }

  // Dossier de travail temporaire et isolé pour chaque requête, supprimé
  // à la fin (succès ou échec) pour ne rien laisser traîner sur le disque.
  const dossier = await fs.mkdtemp(path.join(os.tmpdir(), "latex-"));
  const cheminTex = path.join(dossier, "document.tex");

  try {
    await fs.writeFile(cheminTex, texSource, "utf8");

    // --outdir place le PDF au même endroit ; timeout de sécurité à 45s
    // (largement suffisant pour une interro/QCM, évite qu'une requête
    // malformée ne bloque le service indéfiniment).
    await execFileAsync("tectonic", ["--outdir", dossier, cheminTex], { timeout: 45000 });

    const pdf = await fs.readFile(path.join(dossier, "document.pdf"));
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", "inline; filename=document.pdf");
    res.send(pdf);
  } catch (erreur) {
    const details = erreur.stderr || erreur.stdout || erreur.message || "Erreur inconnue";
    console.error("Échec de compilation :", details);
    res.status(422).json({ error: "Échec de la compilation LaTeX", details: String(details).slice(0, 4000) });
  } finally {
    fs.rm(dossier, { recursive: true, force: true }).catch(() => {});
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Service de compilation LaTeX démarré sur le port ${port}`);
});
