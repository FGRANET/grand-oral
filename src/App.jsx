
// =====================================================================
// GRAND ORAL — Application de messagerie Terminale Spé
// Stack : React + Supabase
// 
// INSTRUCTIONS DE DÉPLOIEMENT (à lire avant tout)
// -------------------------------------------------------
// 1. Créer un projet sur https://supabase.com (gratuit)
// 2. Dans Supabase > SQL Editor, exécuter le script SQL ci-dessous
// 3. Copier l'URL et la clé anon dans les constantes SUPABASE_URL / SUPABASE_ANON_KEY
// 4. Déployer sur Vercel : connecter le repo GitHub, c'est tout.
//
// SQL À EXÉCUTER DANS SUPABASE (copier-coller dans SQL Editor) :
// -------------------------------------------------------
// -- Table des profils utilisateurs
// create table profiles (
//   id uuid references auth.users primary key,
//   nom text not null,
//   prenom text not null,
//   role text not null default 'eleve', -- 'eleve' ou 'professeur'
//   sujet text,  -- sujet grand oral de l'élève
//   created_at timestamptz default now()
// );
// alter table profiles enable row level security;
// create policy "Users can read all profiles" on profiles for select using (true);
// create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
//
// -- Table des messages
// create table messages (
//   id uuid default gen_random_uuid() primary key,
//   eleve_id uuid references profiles(id) not null,
//   sender_id uuid references profiles(id) not null,
//   sender_role text not null,
//   contenu text,
//   fichier_url text,
//   fichier_nom text,
//   fichier_type text,
//   lu boolean default false,
//   created_at timestamptz default now()
// );
// alter table messages enable row level security;
// create policy "Eleve sees own messages" on messages for select
//   using (auth.uid() = eleve_id or exists(
//     select 1 from profiles where id = auth.uid() and role = 'professeur'));
// create policy "Can insert messages" on messages for insert
//   with check (auth.uid() = sender_id);
// create policy "Prof can update lu" on messages for update
//   using (exists(select 1 from profiles where id = auth.uid() and role = 'professeur'));
//
// -- Storage bucket pour les fichiers
// insert into storage.buckets (id, name, public) values ('grand-oral', 'grand-oral', true);
// create policy "Authenticated users can upload" on storage.objects
//   for insert with check (bucket_id = 'grand-oral' and auth.role() = 'authenticated');
// create policy "Public read" on storage.objects
//   for select using (bucket_id = 'grand-oral');
//
// -- Realtime : activer sur la table messages dans Supabase > Database > Replication
//
// CRÉER LES COMPTES ÉLÈVES :
// Dans Supabase > Authentication > Users > "Invite user" (ou Add user)
// Email : prenom.nom@grandoral.fr  (inventé, pas besoin d'être réel)
// Puis dans SQL Editor :
// insert into profiles (id, nom, prenom, role, sujet) values
//   ('<uuid-de-l-user>', 'Dupont', 'Emma', 'eleve', 'Impact des réseaux sociaux...');
//
// CRÉER LE COMPTE PROFESSEUR :
// Même méthode, avec role = 'professeur'
// =====================================================================

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import katex from "https://esm.sh/katex@0.16.9";

// ⚠️ REMPLACER PAR VOS VRAIES VALEURS SUPABASE
const SUPABASE_URL = "https://bolmwalxiqsuimuagrhx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbG13YWx4aXFzdWltdWFncmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzA0NTYsImV4cCI6MjA5NjY0NjQ1Nn0.z0SEaKiN1islvPPU_gfypU9i8qhPWXUW4DooBoxcq5Q";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ─── Palette & styles globaux ────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #22263a;
    --border: #2e3250;
    --accent: #5b73ff;
    --accent-light: #7b8fff;
    --green: #34d399;
    --red: #f87171;
    --text: #e8eaf6;
    --text-muted: #7b82a8;
    --bubble-me: #2d3875;
    --bubble-other: #1e2235;
    --font: 'DM Sans', sans-serif;
    --mono: 'DM Mono', monospace;
  }

  body { font-family: var(--font); background: var(--bg); color: var(--text); height: 100vh; overflow: hidden; }

  /* ── Login ── */
  .login-wrap {
    display: flex; align-items: center; justify-content: center;
    height: 100vh;
    background: radial-gradient(ellipse at 60% 40%, #1a1f4e 0%, #0f1117 60%);
  }
  .login-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 48px 40px; width: 360px;
    box-shadow: 0 24px 64px #00000088;
  }
  .login-logo { font-size: 13px; font-weight: 600; letter-spacing: .12em; color: var(--accent); text-transform: uppercase; margin-bottom: 8px; }
  .login-title { font-size: 26px; font-weight: 600; margin-bottom: 6px; }
  .login-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 36px; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .field label { font-size: 12px; font-weight: 500; color: var(--text-muted); letter-spacing: .06em; text-transform: uppercase; }
  .field input {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 10px;
    padding: 12px 14px; color: var(--text); font-family: var(--font); font-size: 14px;
    outline: none; transition: border-color .2s;
  }
  .field input:focus { border-color: var(--accent); }
  .btn-login {
    width: 100%; background: var(--accent); color: #fff; border: none;
    border-radius: 10px; padding: 13px; font-family: var(--font); font-size: 14px;
    font-weight: 600; cursor: pointer; margin-top: 8px; transition: background .2s, transform .1s;
  }
  .btn-login:hover { background: var(--accent-light); }
  .btn-login:active { transform: scale(.98); }
  .login-error { font-size: 13px; color: var(--red); margin-top: 10px; text-align: center; }

  /* ── Layout principal ── */
  /* ── Sélecteur de niveau scolaire ── */
  .app { display: flex; height: 100vh; }

  /* ── Sidebar (vue prof) ── */
  .sidebar {
    width: 280px; flex-shrink: 0; background: #141720;
    border-right: 1px solid var(--border); display: flex; flex-direction: column;
  }
  .sidebar-header {
    padding: 20px 18px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .sidebar-title { font-size: 15px; font-weight: 600; }
  .badge-count {
    background: var(--accent); color: #fff; border-radius: 20px;
    font-size: 11px; font-weight: 700; padding: 2px 8px;
  }
  .sidebar-list { flex: 1; overflow-y: auto; padding: 8px; background: var(--surface); }
  .sidebar-list::-webkit-scrollbar { width: 4px; }
  .sidebar-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  /* ── Indicateur d'usage Supabase ── */
  .usage-indicator { flex-shrink: 0; padding: 0; background: transparent; display: flex; align-items: center; }
  .usage-indicator-toggle {
    width: 100%; background: none; border: none; color: var(--text-muted);
    font-family: var(--font); font-size: 11px; padding: 8px 8px; cursor: pointer;
    display: flex; align-items: center; gap: 7px; border-radius: 8px; transition: background .15s;
  }
  .usage-indicator-toggle:hover { background: var(--surface2); }
  .usage-chevron { margin-left: auto; font-size: 9px; }
  .usage-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
  .usage-dot.alerte { background: var(--red); }
  .usage-detail { padding: 4px 10px 8px; display: flex; flex-direction: column; gap: 10px; }
  .usage-row-label { font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; margin-bottom: 5px; }
  .usage-row-label span { font-family: var(--mono); }
  .usage-bar { height: 4px; background: var(--surface2); border-radius: 3px; overflow: hidden; }
  .usage-bar-fill { height: 100%; border-radius: 3px; transition: width .3s; }

  .eleve-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 12px;
    border-radius: 12px; cursor: pointer; transition: background .15s;
    margin-bottom: 2px;
  }
  .eleve-item:hover { background: var(--surface2); }
  .eleve-item.active { background: var(--surface2); border: 1px solid var(--border); }
  .avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; flex-shrink: 0; position: relative;
  }
  .avatar-sm { width: 32px; height: 32px; font-size: 12px; }
  .unread-dot {
    position: absolute; top: 0; right: 0; width: 10px; height: 10px;
    background: var(--green); border-radius: 50%; border: 2px solid var(--surface);
  }
  .eleve-info { flex: 1; min-width: 0; }
  .eleve-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .eleve-sujet { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

  /* ── Onglets sidebar (Élèves / Ressources) ── */
  .sidebar-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); flex-shrink: 0; padding: 0 12px; background: var(--surface); }
  .sidebar-tabs.eleve-tabs { max-width: 360px; background: var(--surface); }
  .sidebar-tab {
    padding: 12px 18px; font-size: 13px; font-weight: 600;
    color: var(--text-muted); cursor: pointer; background: none; border: none;
    font-family: var(--font); border-bottom: 2px solid transparent; transition: all .15s;
  }
  .sidebar-tab.active { color: var(--accent-light); border-bottom-color: var(--accent); }
  .sidebar-tab:hover { color: var(--text); }

  /* ── Onglets en haut, pleine largeur (quand la sidebar verticale est masquée) ── */
  /* ── Barre multi-niveaux (pills + séparateur + sous-onglets) ── */
  .niveau-top-bar {
    display: flex; align-items: center; background: var(--surface);
    border-bottom: 1px solid var(--border); flex-shrink: 0; padding: 0 16px;
  }
  .niveau-pills { display: flex; align-items: center; gap: 6px; padding: 8px 0; flex-shrink: 0; }
  .niveau-pill {
    padding: 5px 13px; font-size: 12px; font-weight: 500; border-radius: 20px;
    cursor: pointer; font-family: var(--font); border: 0.5px solid var(--border);
    background: var(--surface2); color: var(--text-muted); transition: all .15s;
  }
  .niveau-pill:hover { border-color: currentColor; }
  .niveau-pill.active { color: #fff; border-color: transparent; }
  .niveau-separateur { width: 1.5px; height: 26px; background: var(--border); margin: 0 14px; flex-shrink: 0; border-radius: 2px; }

  .sidebar-tabs-top {
    display: flex; gap: 4px; border-bottom: 1px solid var(--border); background: var(--surface);
    flex-shrink: 0; padding: 0 12px;
  }
  .sidebar-tab-top {
    padding: 12px 18px; font-size: 13px; font-weight: 600; color: var(--text-muted);
    cursor: pointer; background: none; border: none; font-family: var(--font);
    border-bottom: 2px solid transparent; transition: all .15s;
  }
  .sidebar-tab-top.active { color: var(--accent-light); border-bottom-color: var(--accent); }
  .sidebar-tab-top:hover { color: var(--text); }

  /* ── Zone ressources ── */
  .ressources-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .ressources-list { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 14px; max-width: 720px; }
  .ressource-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 18px 20px; position: relative;
  }
  .ressource-titre { font-size: 15px; font-weight: 600; margin-bottom: 8px; padding-right: 28px; }
  .ressource-contenu { font-size: 13px; line-height: 1.6; color: var(--text); white-space: pre-wrap; }
  .ressource-lien {
    display: inline-flex; align-items: center; gap: 6px; margin-top: 10px;
    color: var(--accent-light); font-size: 13px; text-decoration: none; word-break: break-all;
  }
  .ressource-lien:hover { text-decoration: underline; }
  .ressource-fichier {
    display: flex; align-items: center; gap: 10px; margin-top: 10px;
    background: var(--surface2); border: 1px solid var(--border); border-radius: 10px;
    padding: 10px 14px; text-decoration: none; color: var(--text); max-width: 320px;
  }
  .ressource-fichier:hover { border-color: var(--accent); }
  .ressource-fichier img { max-width: 100%; max-height: 240px; border-radius: 8px; margin-top: 10px; display: block; }
  .ressource-date { font-size: 11px; color: var(--text-muted); margin-top: 12px; }
  .ressource-delete {
    position: absolute; top: 16px; right: 16px; background: none; border: none;
    color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 4px;
  }
  .ressource-delete:hover { color: var(--red); }
  .ressources-empty {
    flex: 1; display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 10px; color: var(--text-muted); font-size: 13px;
  }

  /* ── Formulaire de publication (prof) ── */
  .publish-form {
    border-top: 1px solid var(--border); padding: 16px 24px; flex-shrink: 0;
    max-width: 720px; width: 100%;
  }
  .publish-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .publish-input, .publish-textarea {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 10px;
    padding: 10px 14px; color: var(--text); font-family: var(--font); font-size: 13px; outline: none; width: 100%;
  }
  .publish-input:focus, .publish-textarea:focus { border-color: var(--accent); }
  .publish-textarea { resize: vertical; min-height: 70px; line-height: 1.5; }
  .publish-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .publish-attach-label {
    display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted);
    cursor: pointer; padding: 7px 12px; border: 1px solid var(--border); border-radius: 8px; transition: all .15s;
  }
  .publish-attach-label:hover { border-color: var(--accent); color: var(--text); }
  .publish-btn {
    margin-left: auto; background: var(--accent); color: #fff; border: none;
    border-radius: 8px; padding: 9px 18px; font-family: var(--font); font-size: 13px;
    font-weight: 600; cursor: pointer; transition: background .15s;
  }
  .publish-btn:hover { background: var(--accent-light); }
  .publish-btn:disabled { opacity: .4; cursor: not-allowed; }
  .publish-file-chip {
    display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted);
    background: var(--surface2); border-radius: 8px; padding: 6px 10px; max-width: 240px;
  }
  .publish-file-chip button { background: none; border: none; color: var(--red); cursor: pointer; margin-left: 4px; }

  /* ── Générateur d'interrogations ── */
  .generateur-area { flex: 1; display: flex; min-width: 0; min-height: 0; }
  .gen-chapitres-col {
    width: 420px; flex-shrink: 0; border-right: 1px solid var(--border);
    overflow-y: auto; padding: 16px;
  }
  .gen-selection-col { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .gen-selection-list { flex: 1; overflow-y: auto; padding: 20px 24px; }
  .gen-header { padding: 16px 24px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .gen-header-title { font-size: 16px; font-weight: 600; }
  .gen-header-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .gen-header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .gen-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .gen-header-action-btn {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 8px; padding: 6px 12px; font-family: var(--font); font-size: 11px;
    font-weight: 500; cursor: pointer; transition: all .15s; white-space: nowrap;
  }
  .gen-header-action-btn:hover { border-color: var(--accent); color: var(--accent-light); }
  .gen-header-action-btn.danger:hover { border-color: var(--red); color: var(--red); }
  .gen-selected-checkbox { width: 14px; height: 14px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; margin-top: 3px; margin-right: 2px; }

  .gen-chapitre-block { margin-bottom: 6px; }
  .gen-chapitre-row {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    border-radius: 10px; cursor: pointer; transition: background .15s;
  }
  .gen-chapitre-row:hover { background: var(--surface2); }
  .gen-chapitre-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
  .gen-chapitre-nom { font-size: 13px; font-weight: 500; flex: 1; }
  .gen-chapitre-count { font-size: 11px; color: var(--text-muted); background: var(--surface2); border-radius: 10px; padding: 2px 8px; }
  .gen-chevron { font-size: 11px; color: var(--text-muted); transition: transform .15s; }
  .gen-chevron.open { transform: rotate(90deg); }

  .gen-questions-list { padding-left: 30px; display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
  .gen-question-row {
    display: flex; align-items: flex-start; gap: 8px; padding: 7px 10px;
    border-radius: 8px; cursor: pointer; transition: background .15s;
  }
  .gen-question-row:hover { background: var(--surface2); }
  .gen-question-row input[type="checkbox"] { width: 14px; height: 14px; margin-top: 2px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
  .gen-question-summary { flex: 1; min-width: 0; }
  .gen-question-type {
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
    color: var(--accent-light); margin-bottom: 2px;
  }
  .gen-question-id { font-family: var(--mono); color: var(--text-muted); font-weight: 500; text-transform: none; letter-spacing: 0; }

  .gen-exercice-row { display: flex; align-items: flex-start; gap: 8px; padding: 7px 10px; border-radius: 8px; cursor: pointer; transition: background .15s; }
  .gen-exercice-row:hover { background: var(--surface2); }
  .gen-exercice-row input[type="checkbox"] { width: 14px; height: 14px; margin-top: 2px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
  .gen-exercice-badge {
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
    color: #f5b942; margin-bottom: 2px; display: flex; align-items: center; gap: 5px;
  }
  .gen-exercice-detail {
    margin-top: 6px; margin-left: 22px; padding: 12px 14px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 10px; font-size: 13px;
  }
  .gen-exercice-refresh-btn {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 8px; padding: 6px 12px; font-family: var(--font); font-size: 11px;
    cursor: pointer; transition: all .15s; margin-top: 10px;
  }
  .gen-exercice-refresh-btn:hover { border-color: var(--accent); color: var(--accent-light); }
  .gen-question-apercu {
    font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .gen-question-detail {
    margin-top: 6px; margin-left: 22px; padding: 12px 14px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 10px; font-size: 13px;
  }
  .gen-question-detail-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; letter-spacing: .05em; }
  .gen-question-detail-reponse { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
  .gen-question-detail-footer { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; }
  .gen-delete-question-btn {
    background: none; border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 8px; padding: 6px 12px; font-family: var(--font); font-size: 11px;
    cursor: pointer; transition: all .15s;
  }
  .gen-delete-question-btn:hover { border-color: var(--red); color: var(--red); }
  .gen-edit-question-btn {
    background: none; border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 8px; padding: 6px 12px; font-family: var(--font); font-size: 11px;
    cursor: pointer; transition: all .15s; margin-right: 8px;
  }
  .gen-edit-question-btn:hover { border-color: var(--accent); color: var(--accent-light); }

  .gen-edit-form { display: flex; flex-direction: column; gap: 10px; }
  .gen-edit-row { display: flex; gap: 10px; }
  .gen-edit-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .gen-edit-field label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: .04em; }
  .gen-edit-field select, .gen-edit-field input[type="number"] {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 7px 10px; color: var(--text); font-family: var(--font); font-size: 12px; outline: none;
  }
  .gen-edit-textarea {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; color: var(--text); font-family: var(--mono); font-size: 12px; outline: none;
    resize: vertical; min-height: 70px; line-height: 1.5; width: 100%;
  }
  .gen-edit-textarea:focus, .gen-edit-field select:focus, .gen-edit-field input:focus { border-color: var(--accent); }
  .gen-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  .gen-edit-save-btn {
    background: var(--accent); color: #fff; border: none; border-radius: 8px;
    padding: 8px 16px; font-family: var(--font); font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .gen-edit-save-btn:hover { background: var(--accent-light); }
  .gen-edit-save-btn:disabled { opacity: .4; cursor: not-allowed; }
  .gen-edit-cancel-btn {
    background: none; border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 8px; padding: 8px 16px; font-family: var(--font); font-size: 12px; cursor: pointer;
  }

  /* ── Onglet Historique ── */
  .hist-area { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow-y: auto; padding: 24px 32px; }
  .hist-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .hist-toolbar-filter {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 16px; padding: 5px 13px; font-family: var(--font); font-size: 12px;
    font-weight: 500; cursor: pointer; transition: all .15s;
  }
  .hist-toolbar-filter:hover { border-color: var(--accent); }
  .hist-toolbar-filter.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .hist-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted); font-size: 13px; }

  .hist-list { display: flex; flex-direction: column; gap: 10px; max-width: 760px; }
  .hist-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; }
  .hist-card-top { display: flex; align-items: flex-start; gap: 12px; }
  .hist-card-main { flex: 1; min-width: 0; }
  .hist-card-nom { font-size: 14px; font-weight: 600; }
  .hist-card-nom-input {
    font-size: 14px; font-weight: 600; background: var(--surface2); border: 1px solid var(--accent);
    border-radius: 6px; padding: 4px 8px; color: var(--text); font-family: var(--font); width: 100%; outline: none;
  }
  .hist-card-meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .hist-badge {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em;
    padding: 2px 8px; border-radius: 10px; background: var(--surface2); color: var(--text-muted);
  }
  .hist-badge.partage { background: rgba(91,115,255,0.15); color: var(--accent-light); }
  .hist-card-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .hist-icon-btn {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 15px; padding: 6px; border-radius: 8px; transition: all .15s; line-height: 1;
  }
  .hist-icon-btn:hover { background: var(--surface2); color: var(--text); }
  .hist-icon-btn.fav-active { color: #f5b942; }
  .hist-card-rejouer {
    margin-top: 12px; background: var(--accent); color: #fff; border: none; border-radius: 8px;
    padding: 8px 16px; font-family: var(--font); font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .hist-card-rejouer:hover { background: var(--accent-light); }
  .hist-card-auteur { font-size: 11px; color: var(--text-muted); }

  .gen-reveal-btn {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 8px; padding: 7px 14px; font-family: var(--font); font-size: 12px;
    font-weight: 500; cursor: pointer; transition: all .15s;
  }
  .gen-reveal-btn:hover { border-color: var(--accent); color: var(--accent-light); }
  .gen-question-detail-reponse-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .gen-hide-btn {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 11px; font-family: var(--font); padding: 2px 6px; border-radius: 6px; transition: all .15s;
  }
  .gen-hide-btn:hover { color: var(--red); background: var(--surface2); }

  .gen-empty-chapitre { font-size: 12px; color: var(--text-muted); padding: 8px 10px 8px 30px; font-style: italic; }

  .gen-selection-empty {
    flex: 1; display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 10px; color: var(--text-muted); font-size: 13px;
  }
  .gen-selected-item {
    display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px;
    transition: opacity .15s, border-color .15s, transform .1s;
  }
  .gen-selected-item.dragging { opacity: .4; }
  .gen-selected-item { position: relative; }
  .gen-selected-item.drag-over-middle { border-color: var(--accent); background: var(--surface2); }
  .gen-selected-item.drag-over-top::before,
  .gen-selected-item.drag-over-bottom::after {
    content: ""; position: absolute; left: 8px; right: 8px; height: 3px;
    background: var(--accent); border-radius: 2px;
  }
  .gen-selected-item.drag-over-top::before { top: -5px; }
  .gen-selected-item.drag-over-bottom::after { bottom: -5px; }
  .gen-drag-handle {
    color: var(--text-muted); cursor: grab; flex-shrink: 0; font-size: 14px;
    padding: 2px 2px 2px 0; margin-top: 1px; user-select: none; line-height: 1;
  }
  .gen-drag-handle:active { cursor: grabbing; }
  .gen-selected-num {
    width: 22px; height: 22px; border-radius: 50%; background: var(--surface2);
    display: flex; align-items: center; justify-content: center; font-size: 11px;
    font-weight: 600; color: var(--text-muted); flex-shrink: 0; margin-top: 1px;
  }
  .gen-selected-content { flex: 1; min-width: 0; }
  .gen-selected-chapitre { font-size: 10px; color: var(--accent-light); font-weight: 600; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 3px; }
  .gen-selected-enonce { font-size: 13px; line-height: 1.5; }
  .gen-selected-remove { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 2px; flex-shrink: 0; }
  .gen-selected-remove:hover { color: var(--red); }

  .gen-footer {
    border-top: 1px solid var(--border); padding: 16px 24px; flex-shrink: 0;
    display: flex; align-items: center; gap: 14px;
  }
  .gen-footer-count { font-size: 13px; color: var(--text-muted); }
  .gen-footer-count strong { color: var(--text); }
  .gen-export-btn {
    margin-left: auto; background: var(--accent); color: #fff; border: none;
    border-radius: 8px; padding: 10px 20px; font-family: var(--font); font-size: 13px;
    font-weight: 600; cursor: pointer; transition: background .15s; display: flex; align-items: center; gap: 6px;
  }
  .gen-export-btn:hover { background: var(--accent-light); }
  .gen-export-btn:disabled { opacity: .35; cursor: not-allowed; }
  .gen-export-btn-secondary {
    background: var(--surface2); color: var(--text); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 20px; font-family: var(--font); font-size: 13px;
    font-weight: 600; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 6px;
  }
  .gen-export-btn-secondary:hover { border-color: var(--accent); }
  .gen-export-btn-secondary:disabled { opacity: .35; cursor: not-allowed; }

  /* ── Écran de réglages avant lancement du diaporama ── */
  .diapo-settings-overlay {
    position: fixed; inset: 0; background: #000000cc; z-index: 200;
    display: flex; align-items: center; justify-content: center;
  }
  .diapo-settings-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
    padding: 36px 36px; width: 420px; box-shadow: 0 24px 64px #00000088;
  }
  .diapo-settings-title { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
  .diapo-settings-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
  .diapo-settings-section { margin-bottom: 20px; }
  .diapo-settings-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin-bottom: 10px; }
  .diapo-mode-options { display: flex; flex-direction: column; gap: 8px; }
  .diapo-mode-option {
    display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
    border: 1px solid var(--border); border-radius: 10px; cursor: pointer; transition: all .15s;
  }
  .diapo-mode-option:hover { border-color: var(--accent); }
  .diapo-mode-option.selected { border-color: var(--accent); background: var(--surface2); }
  .diapo-mode-option input[type="radio"] { margin-top: 3px; accent-color: var(--accent); cursor: pointer; }
  .diapo-mode-option-title { font-size: 13px; font-weight: 600; }
  .diapo-mode-option-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .diapo-timer-row { display: flex; align-items: center; gap: 10px; }
  .diapo-timer-input {
    width: 80px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 12px; color: var(--text); font-family: var(--font); font-size: 14px; outline: none; text-align: center;
  }
  .diapo-timer-input:focus { border-color: var(--accent); }
  .diapo-timer-unit { font-size: 13px; color: var(--text-muted); }
  .diapo-timer-presets { display: flex; gap: 6px; margin-left: auto; }
  .diapo-timer-preset {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; transition: all .15s;
  }
  .diapo-timer-preset:hover, .diapo-timer-preset.active { border-color: var(--accent); color: var(--accent-light); }
  .diapo-settings-actions { display: flex; gap: 10px; margin-top: 8px; }
  .diapo-launch-btn {
    flex: 1; background: var(--accent); color: #fff; border: none; border-radius: 10px;
    padding: 12px; font-family: var(--font); font-size: 14px; font-weight: 600; cursor: pointer;
    transition: background .15s; display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .diapo-launch-btn:hover { background: var(--accent-light); }
  .diapo-cancel-btn {
    background: var(--surface2); color: var(--text-muted); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 18px; font-family: var(--font); font-size: 14px; cursor: pointer;
  }
  .diapo-cancel-btn:hover { color: var(--text); }

  /* ── Visionneuse plein écran ── */
  .diapo-viewer {
    position: fixed; inset: 0; background: #0a0b10; z-index: 300;
    display: flex; flex-direction: column; color: var(--text);
  }
  .diapo-topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 24px; flex-shrink: 0;
  }
  .diapo-progress { font-size: 13px; color: var(--text-muted); font-family: var(--mono); }
  .diapo-topbar-actions { display: flex; align-items: center; gap: 10px; }
  .diapo-pause-btn, .diapo-close-btn {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 8px 14px; font-family: var(--font); font-size: 12px;
    cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 6px;
  }
  .diapo-pause-btn:hover, .diapo-close-btn:hover { border-color: var(--accent); }
  .diapo-timer-display {
    font-family: var(--mono); font-size: 13px; color: var(--text-muted);
    background: var(--surface); border-radius: 20px; padding: 6px 14px;
    display: flex; align-items: center; gap: 8px; min-width: 70px; justify-content: center;
  }
  .diapo-timer-ring { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }

  .diapo-progress-bar { height: 3px; background: var(--border); flex-shrink: 0; }
  .diapo-progress-bar-fill { height: 100%; background: var(--accent); transition: width .3s linear; }

  .diapo-content {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 40px 80px; text-align: center; cursor: pointer; user-select: none;
  }
  .diapo-chapitre-tag {
    font-size: 13px; color: var(--accent-light); font-weight: 600; text-transform: uppercase;
    letter-spacing: .06em; margin-bottom: 28px;
  }
  .diapo-enonce { font-size: 28px; line-height: 1.5; max-width: 900px; }
  .diapo-enonce .katex { font-size: 1.15em; }
  .diapo-reponse-divider { width: 80px; height: 2px; background: var(--accent); margin: 32px 0; }
  .diapo-reponse { font-size: 24px; line-height: 1.6; max-width: 900px; color: var(--accent-light); }
  .diapo-hint { font-size: 12px; color: var(--text-muted); margin-top: 40px; }

  .diapo-recap { flex: 1; overflow-y: auto; padding: 40px 60px; max-width: 900px; margin: 0 auto; width: 100%; }
  .diapo-recap-title { font-size: 22px; font-weight: 600; margin-bottom: 24px; text-align: center; }
  .diapo-recap-item { margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
  .diapo-recap-num { font-size: 11px; color: var(--text-muted); font-weight: 600; margin-bottom: 6px; }
  .diapo-recap-enonce { font-size: 15px; margin-bottom: 10px; }
  .diapo-recap-reponse { font-size: 15px; color: var(--accent-light); }

  /* ── Import JSON de questions ── */
  .gen-import-bar { padding: 14px 16px; border-bottom: 1px solid var(--border); }

  /* ── Barre de filtres type/niveau ── */
  .gen-filters-bar { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
  .gen-filters-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .gen-filters-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: .04em; width: 100%; margin-bottom: 2px; }
  .gen-filter-chip {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 14px; padding: 4px 11px; font-family: var(--font); font-size: 11px;
    font-weight: 500; cursor: pointer; transition: all .15s; text-transform: capitalize;
  }
  .gen-filter-chip:hover { border-color: var(--accent); }
  .gen-filter-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .gen-filter-reset {
    background: none; border: none; color: var(--text-muted); font-size: 11px;
    cursor: pointer; text-decoration: underline; padding: 0; margin-left: 4px;
  }
  .gen-filter-reset:hover { color: var(--accent-light); }
  .gen-import-btn {
    width: 100%; background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    border-radius: 10px; padding: 10px; font-family: var(--font); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .gen-import-btn:hover { border-color: var(--accent); color: var(--accent-light); }

  .gen-import-bar-row { display: flex; gap: 8px; }
  .gen-export-all-btn {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    border-radius: 10px; padding: 10px; font-family: var(--font); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; gap: 8px;
    flex-shrink: 0;
  }
  .gen-export-all-btn:hover { border-color: var(--accent); color: var(--accent-light); }

  .gen-random-btn {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    border-radius: 10px; padding: 10px; font-family: var(--font); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; gap: 8px;
    flex-shrink: 0; width: 100%; margin-top: 8px;
  }
  .gen-random-btn:hover { border-color: var(--accent); color: var(--accent-light); }

  /* ── Formulaire de création de question/exercice ── */
  .creer-btn {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    border-radius: 10px; padding: 10px; font-family: var(--font); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center;
    gap: 8px; flex-shrink: 0; width: 100%; margin-top: 8px;
  }
  .creer-btn:hover { border-color: var(--accent); color: var(--accent-light); }

  .creer-overlay {
    position: fixed; inset: 0; background: #000000cc; z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .creer-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
    padding: 28px 32px; width: 680px; max-height: 90vh; display: flex; flex-direction: column;
    box-shadow: 0 24px 64px #00000088;
  }
  .creer-title { font-size: 17px; font-weight: 600; margin-bottom: 16px; }
  .creer-mode-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
  .creer-mode-tab {
    padding: 8px 16px; font-size: 13px; font-weight: 500; color: var(--text-muted);
    cursor: pointer; background: none; border: none; font-family: var(--font);
    border-bottom: 2px solid transparent; transition: all .15s;
  }
  .creer-mode-tab.active { color: var(--accent-light); border-bottom-color: var(--accent); }
  .creer-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 4px; }
  .creer-field { display: flex; flex-direction: column; gap: 5px; }
  .creer-field label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: .04em; }
  .creer-field select {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 12px; color: var(--text); font-family: var(--font); font-size: 13px; outline: none;
  }
  .creer-field select:focus { border-color: var(--accent); }
  .creer-textarea {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; color: var(--text); font-family: var(--mono); font-size: 13px; outline: none;
    resize: vertical; min-height: 56px; line-height: 1.5; width: 100%;
  }
  .creer-textarea:focus { border-color: var(--accent); }
  .creer-hint { font-size: 11px; color: var(--text-muted); }
  .creer-hint code { background: var(--surface2); padding: 1px 5px; border-radius: 4px; font-family: var(--mono); }

  /* Paramètres aléatoires */
  .creer-params { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  .creer-param-row { display: flex; align-items: center; gap: 8px; }
  .creer-param-name { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--accent-light); width: 28px; flex-shrink: 0; }
  .creer-param-input {
    width: 72px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
    padding: 6px 8px; color: var(--text); font-family: var(--font); font-size: 12px; outline: none; text-align: center;
  }
  .creer-param-sep { font-size: 12px; color: var(--text-muted); }
  .creer-param-type {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
    padding: 6px 8px; color: var(--text); font-family: var(--font); font-size: 12px; outline: none; margin-left: auto;
  }
  .creer-params-empty { font-size: 12px; color: var(--text-muted); font-style: italic; }
  .creer-add-param { background: none; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 6px; padding: 5px 12px; font-family: var(--font); font-size: 12px; cursor: pointer; transition: all .15s; }
  .creer-add-param:hover { border-color: var(--accent); color: var(--accent-light); }
  .creer-del-param { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 0 4px; }
  .creer-del-param:hover { color: var(--red); }

  /* Zone de test */
  .creer-test { background: var(--surface2); border-radius: 10px; padding: 14px; }
  .creer-test-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .creer-test-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: .04em; }
  .creer-test-btn { background: var(--accent); color: #fff; border: none; border-radius: 7px; padding: 7px 14px; font-family: var(--font); font-size: 12px; font-weight: 600; cursor: pointer; }
  .creer-test-btn:hover { background: var(--accent-light); }
  .creer-test-result { background: var(--surface); border-radius: 8px; padding: 10px 12px; font-size: 13px; }
  .creer-test-reponse { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); color: var(--accent-light); }
  .creer-test-vals { font-size: 10px; color: var(--text-muted); font-family: var(--mono); margin-top: 6px; }
  .creer-test-empty { font-size: 12px; color: var(--text-muted); text-align: center; padding: 8px; }
  .creer-test-err { font-size: 12px; color: var(--red); }
  .creer-actions { display: flex; gap: 10px; margin-top: 18px; flex-shrink: 0; }

  .random-overlay {
    position: fixed; inset: 0; background: #000000cc; z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .random-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
    padding: 32px; width: 600px; max-height: 85vh; display: flex; flex-direction: column;
    box-shadow: 0 24px 64px #00000088;
  }
  .random-title { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
  .random-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
  .random-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
  .random-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: .04em; margin-bottom: 10px; }
  .random-chapitres-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 220px; overflow-y: auto;
    border: 1px solid var(--border); border-radius: 10px; padding: 10px;
  }
  .random-chapitre-item { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 6px; border-radius: 6px; cursor: pointer; }
  .random-chapitre-item:hover { background: var(--surface2); }
  .random-chapitre-item input { accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
  .random-chips-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .random-chip {
    background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 14px; padding: 5px 13px; font-family: var(--font); font-size: 12px;
    font-weight: 500; cursor: pointer; transition: all .15s; text-transform: capitalize;
  }
  .random-chip:hover { border-color: var(--accent); }
  .random-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .random-nb-row { display: flex; align-items: center; gap: 12px; }
  .random-nb-input {
    width: 90px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 12px; color: var(--text); font-family: var(--font); font-size: 14px; outline: none; text-align: center;
  }
  .random-nb-input:focus { border-color: var(--accent); }
  .random-checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
  .random-checkbox-row input { accent-color: var(--accent); cursor: pointer; }
  .random-checkbox-desc { font-size: 11px; color: var(--text-muted); margin-left: 22px; margin-top: 2px; }
  .random-warning {
    background: rgba(248,113,113,0.08); border-left: 3px solid var(--red); color: var(--red);
    font-size: 12px; padding: 10px 14px; border-radius: 8px; margin-top: 4px;
  }
  .random-actions { display: flex; gap: 10px; margin-top: 20px; flex-shrink: 0; }

  .gen-chapitre-export-btn {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 13px; padding: 4px 6px; border-radius: 6px; transition: all .15s; flex-shrink: 0;
  }
  .gen-chapitre-export-btn:hover { color: var(--accent-light); background: var(--surface2); }

  .import-overlay {
    position: fixed; inset: 0; background: #000000cc; z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .import-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
    padding: 32px; width: 640px; max-height: 85vh; display: flex; flex-direction: column;
    box-shadow: 0 24px 64px #00000088;
  }
  .import-title { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
  .import-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
  .import-dropzone {
    border: 2px dashed var(--border); border-radius: 14px; padding: 40px 20px;
    text-align: center; cursor: pointer; transition: all .15s; margin-bottom: 16px;
  }
  .import-dropzone:hover { border-color: var(--accent); background: var(--surface2); }
  .import-dropzone-icon { font-size: 32px; margin-bottom: 10px; opacity: .6; }
  .import-dropzone-text { font-size: 13px; color: var(--text-muted); }
  .import-filename { font-size: 13px; color: var(--accent-light); margin-top: 8px; font-weight: 500; }

  .import-report { flex: 1; overflow-y: auto; margin-bottom: 16px; }
  .import-report-section { margin-bottom: 16px; }
  .import-report-header {
    display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;
    margin-bottom: 8px; padding: 8px 12px; border-radius: 8px;
  }
  .import-report-header.ok { background: rgba(52,211,153,0.1); color: var(--green); }
  .import-report-header.warn { background: rgba(248,113,113,0.08); color: var(--red); }
  .import-report-item {
    font-size: 12px; padding: 8px 12px; background: var(--surface2); border-radius: 8px;
    margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .import-report-item-id { font-family: var(--mono); color: var(--text-muted); flex-shrink: 0; }
  .import-report-item-detail { flex: 1; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .import-report-suggestion { font-family: var(--mono); color: var(--accent-light); font-size: 11px; flex-shrink: 0; }
  .import-actions { display: flex; gap: 10px; flex-shrink: 0; }
  .import-result {
    text-align: center; padding: 30px 0; display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .import-result-icon { font-size: 40px; }

  .katex-render { font-size: 1em; }
  .katex-render .katex { font-size: 1.05em; }

  /* ── Zone chat ── */
  .chat-area { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; }

  .chat-header {
    padding: 14px 20px; background: var(--surface); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  }
  .chat-header-left { display: flex; align-items: center; gap: 12px; }
  .chat-header-name { font-size: 15px; font-weight: 600; }
  .chat-header-sujet { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .btn-logout {
    background: transparent; border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 8px; padding: 6px 12px; font-family: var(--font); font-size: 12px;
    cursor: pointer; transition: all .2s;
  }
  .btn-logout:hover { border-color: var(--red); color: var(--red); }

  /* ── Écran saisie sujet (première connexion) ── */
  .sujet-wrap {
    display: flex; align-items: center; justify-content: center;
    height: 100vh;
    background: radial-gradient(ellipse at 40% 60%, #1a1f4e 0%, #0f1117 60%);
  }
  .sujet-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 48px 40px; width: 480px;
    box-shadow: 0 24px 64px #00000088;
  }
  .sujet-emoji { font-size: 36px; margin-bottom: 16px; }
  .sujet-title { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
  .sujet-sub { font-size: 14px; color: var(--text-muted); margin-bottom: 28px; line-height: 1.6; }
  .sujet-input {
    width: 100%; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 12px; padding: 14px 16px; color: var(--text);
    font-family: var(--font); font-size: 15px; outline: none;
    transition: border-color .2s; resize: none; min-height: 80px; line-height: 1.5;
  }
  .sujet-input:focus { border-color: var(--accent); }
  .sujet-hint { font-size: 12px; color: var(--text-muted); margin-top: 8px; margin-bottom: 20px; }
  .btn-sujet {
    width: 100%; background: var(--accent); color: #fff; border: none;
    border-radius: 10px; padding: 13px; font-family: var(--font); font-size: 14px;
    font-weight: 600; cursor: pointer; transition: background .2s, transform .1s;
  }
  .btn-sujet:hover { background: var(--accent-light); }
  .btn-sujet:disabled { opacity: .4; cursor: not-allowed; }

  /* ── Édition du sujet dans le header ── */
  .sujet-edit-row { display: flex; align-items: center; gap: 6px; }
  .btn-edit-sujet {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 13px; padding: 2px 4px; border-radius: 4px; transition: color .15s;
    line-height: 1;
  }
  .btn-edit-sujet:hover { color: var(--accent-light); }
  .sujet-inline-input {
    background: var(--surface2); border: 1px solid var(--accent);
    border-radius: 6px; padding: 3px 8px; color: var(--text);
    font-family: var(--font); font-size: 12px; outline: none; width: 280px;
  }

  /* ── Bouton clé + modale changement mot de passe ── */
  .btn-key {
    background: transparent; border: 1px solid var(--border); color: var(--text-muted);
    border-radius: 8px; padding: 6px 10px; font-family: var(--font); font-size: 12px;
    cursor: pointer; transition: all .2s; display: flex; align-items: center; gap: 5px;
  }
  .btn-key:hover { border-color: var(--accent); color: var(--accent-light); }
  .header-actions { display: flex; align-items: center; gap: 8px; }

  .modal-overlay {
    position: absolute; inset: 0; background: #00000099;
    display: flex; align-items: center; justify-content: center; z-index: 50;
  }
  .modal-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; padding: 28px 28px; width: 340px;
    box-shadow: 0 24px 64px #00000088;
  }
  .modal-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  .modal-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 20px; }
  .modal-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
  .modal-field label { font-size: 11px; font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }
  .modal-field input {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; color: var(--text); font-family: var(--font); font-size: 14px; outline: none;
  }
  .modal-field input:focus { border-color: var(--accent); }
  .modal-actions { display: flex; gap: 8px; margin-top: 18px; }
  .modal-btn {
    flex: 1; border: none; border-radius: 8px; padding: 10px; font-family: var(--font);
    font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity .15s;
  }
  .modal-btn:disabled { opacity: .4; cursor: not-allowed; }
  .modal-btn-cancel { background: var(--surface2); color: var(--text-muted); }
  .modal-btn-cancel:hover { color: var(--text); }
  .modal-btn-confirm { background: var(--accent); color: #fff; }
  .modal-btn-confirm:hover { background: var(--accent-light); }
  .modal-error { font-size: 12px; color: var(--red); margin-top: 4px; }
  .modal-success { font-size: 12px; color: var(--green); margin-top: 4px; }

  .chat-empty {
    flex: 1; display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 12px; color: var(--text-muted);
  }
  .chat-empty-icon { font-size: 48px; opacity: .3; }
  .chat-empty-text { font-size: 14px; }

  /* ── Messages ── */
  .messages-list { flex: 1; overflow-y: auto; padding: 20px 20px 8px; display: flex; flex-direction: column; gap: 6px; }
  .messages-list::-webkit-scrollbar { width: 4px; }
  .messages-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  .msg-row { display: flex; align-items: flex-end; gap: 8px; }
  .msg-row.mine { flex-direction: row-reverse; }
  .msg-row.mine .avatar { display: none; }

  .bubble {
    max-width: 65%; padding: 10px 14px; border-radius: 16px;
    font-size: 14px; line-height: 1.5; word-break: break-word;
    background: var(--bubble-other); color: var(--text);
    border-bottom-left-radius: 4px;
  }
  .msg-row.mine .bubble {
    background: var(--bubble-me); border-bottom-left-radius: 16px; border-bottom-right-radius: 4px;
  }
  .bubble-meta { font-size: 10px; color: var(--text-muted); margin-top: 4px; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
  .msg-row:not(.mine) .bubble-meta { text-align: left; justify-content: flex-start; }
  .bubble-delete-btn {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 11px; padding: 0; line-height: 1; opacity: .5; transition: opacity .15s;
  }
  .bubble-delete-btn:hover { opacity: 1; color: var(--red); }
  .bubble.bubble-supprime { background: transparent; border: 1px dashed var(--border); }
  .bubble-supprime-text { font-size: 13px; color: var(--text-muted); font-style: italic; }

  .bubble-sender { font-size: 11px; font-weight: 600; color: var(--accent-light); margin-bottom: 4px; }

  /* ── Fichier joint ── */
  .file-bubble-wrap { display: flex; align-items: center; gap: 6px; }
  .file-bubble {
    display: flex; align-items: center; gap: 10px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 14px; text-decoration: none; color: var(--text);
    transition: border-color .2s; max-width: 260px;
  }
  .file-bubble:hover { border-color: var(--accent); }
  .file-icon { font-size: 24px; flex-shrink: 0; }
  .file-details { min-width: 0; }
  .file-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file-dl { font-size: 11px; color: var(--accent-light); margin-top: 2px; }
  .file-delete-btn {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 13px; padding: 6px; border-radius: 6px; flex-shrink: 0; opacity: .6; transition: all .15s;
  }
  .file-delete-btn:hover { opacity: 1; color: var(--red); background: var(--surface2); }
  .file-bubble-supprime { font-size: 12px; color: var(--text-muted); font-style: italic; }

  /* ── Date separator ── */
  .date-sep {
    text-align: center; font-size: 11px; color: var(--text-muted);
    margin: 8px 0; position: relative;
  }
  .date-sep::before, .date-sep::after {
    content: ''; position: absolute; top: 50%; width: 30%; height: 1px;
    background: var(--border);
  }
  .date-sep::before { left: 0; }
  .date-sep::after { right: 0; }

  /* ── Input zone ── */
  .input-zone {
    padding: 12px 16px; background: var(--surface); border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .input-row {
    display: flex; align-items: flex-end; gap: 8px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 16px; padding: 8px 8px 8px 14px; transition: border-color .2s;
  }
  .input-row:focus-within { border-color: var(--accent); }
  .msg-input {
    flex: 1; background: transparent; border: none; color: var(--text);
    font-family: var(--font); font-size: 14px; resize: none; outline: none;
    max-height: 120px; overflow-y: auto; line-height: 1.5;
  }
  .msg-input::placeholder { color: var(--text-muted); }
  .btn-attach, .btn-send {
    width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    font-size: 16px; transition: all .15s;
  }
  .btn-attach { background: var(--surface); color: var(--text-muted); }
  .btn-attach:hover { background: var(--border); color: var(--text); }
  .btn-send { background: var(--accent); color: #fff; }
  .btn-send:hover { background: var(--accent-light); transform: scale(1.05); }
  .btn-send:disabled { opacity: .4; cursor: not-allowed; transform: none; }

  .upload-preview {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; margin-bottom: 8px; font-size: 12px; color: var(--text-muted);
  }
  .upload-preview button {
    background: none; border: none; color: var(--red); cursor: pointer; margin-left: auto; font-size: 16px;
  }
  .upload-bar { height: 3px; background: var(--border); border-radius: 2px; margin-top: 6px; overflow: hidden; }
  .upload-bar-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width .3s; }

  /* ── Scrollbar global ── */
  * { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────
function initials(nom, prenom) {
  return `${(prenom || "?")[0]}${(nom || "?")[0]}`.toUpperCase();
}
// Affichage standard d'un prof côté élève : "F. Granet" (initiale du prénom + nom entier)
function formatNomProf(prenom, nom) {
  if (!prenom || !nom) return "Ton professeur";
  return `${prenom[0].toUpperCase()}. ${nom}`;
}
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// ─── Convention de numérotation des questions : PREFIXE_AUTEUR_NN ──────
// Préfixe officiel par nom de chapitre (clé en minuscules)
const PREFIXES_CHAPITRES = {
  "rappels sur les suites": "SUI",
  "dérivation": "DER",
  "géométrie dans l'espace 1": "GEO1",
  "équations différentielles": "EQD1",
  "fonction ln": "LN",
  "probabilités conditionnelles": "PCOND",
  "raisonnement par récurrence": "REC",
  "combinatoire et dénombrement": "COMB",
  "loi binomiale": "BINOM",
  "limite d'une suite": "LIMS",
  "convexité": "CONV",
  "géométrie dans l'espace 2": "GEO2",
  "fonctions sinus et cosinus": "TRIGO",
  "limites de fonctions": "LIMF",
  "continuité": "CONT",
  "primitives et équations différentielles y'=f": "EQD2",
  "calcul intégral": "INT",
  "compléments sur les variables aléatoires": "VA",
  "concentration et loi des grands nombres": "LGN",
};

function prefixeChapitre(nomChapitre) {
  return PREFIXES_CHAPITRES[(nomChapitre || "").trim().toLowerCase()] || null;
}

function initialesAuteur(prenom, nom) {
  return `${(prenom || "?")[0]}${(nom || "?")[0]}`.toUpperCase();
}

function idRespecteConvention(id, prefixeAttendu, initialesAttendues) {
  const motif = new RegExp(`^${prefixeAttendu}_${initialesAttendues}_\\d{2,}$`);
  return motif.test(id || "");
}

function fileIcon(type) {
  if (!type) return "📄";
  if (type.startsWith("image")) return "🖼️";
  if (type.includes("pdf")) return "📕";
  if (type.includes("word") || type.includes("doc")) return "📝";
  return "📎";
}

// ─── Rendu de texte avec formules LaTeX (KaTeX) ───────────────────────
// Découpe le texte sur les délimiteurs $...$ et $$...$$, rend chaque
// segment de formule avec KaTeX, laisse le reste en texte normal.
function renderMathSegments(texte) {
  if (!texte) return [];
  const segments = [];
  const regex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(texte)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: texte.slice(lastIndex, match.index), key: key++ });
    }
    const formule = match[1] !== undefined ? match[1] : match[2];
    const displayMode = match[1] !== undefined;
    segments.push({ type: "math", content: formule, displayMode, key: key++ });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < texte.length) {
    segments.push({ type: "text", content: texte.slice(lastIndex), key: key++ });
  }
  return segments;
}

// Découpe un segment de texte (hors formule mathématique) en repérant les
// commandes LaTeX de mise en forme courantes : \textbf{...}, \textit{...},
// \underline{...} et \emph{...}. Tout le reste reste du texte brut.
function renderTextSegments(texte, keyDebut) {
  const morceaux = [];
  const regex = /\\(textbf|textit|underline|emph)\{([^}]*)\}/g;
  let lastIndex = 0;
  let match;
  let key = keyDebut;

  while ((match = regex.exec(texte)) !== null) {
    if (match.index > lastIndex) {
      morceaux.push({ type: "brut", content: texte.slice(lastIndex, match.index), key: key++ });
    }
    const commande = match[1];
    const contenu = match[2];
    morceaux.push({ type: commande, content: contenu, key: key++ });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < texte.length) {
    morceaux.push({ type: "brut", content: texte.slice(lastIndex), key: key++ });
  }
  return morceaux;
}

function MathText({ children, inline = true }) {
  const segments = renderMathSegments(children || "");
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className="katex-render">
      {segments.map(seg => {
        if (seg.type === "text") {
          const morceaux = renderTextSegments(seg.content, seg.key * 1000);
          return (
            <span key={seg.key}>
              {morceaux.map(m => {
                if (m.type === "textbf") return <strong key={m.key}>{m.content}</strong>;
                if (m.type === "textit" || m.type === "emph") return <em key={m.key}>{m.content}</em>;
                if (m.type === "underline") return <u key={m.key}>{m.content}</u>;
                return <span key={m.key}>{m.content}</span>;
              })}
            </span>
          );
        }
        try {
          const html = katex.renderToString(seg.content, { displayMode: seg.displayMode, throwOnError: false });
          return <span key={seg.key} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={seg.key}>{seg.content}</span>;
        }
      })}
    </Wrapper>
  );
}

// ─── Moteur de tirage des exercices d'application ──────────────────────
// Tire une valeur aléatoire pour un paramètre donné, selon ses bornes et son type.
function tirerValeurParametre(def) {
  const { min, max, type } = def;
  if (type === "decimal") {
    const valeur = min + Math.random() * (max - min);
    return Math.round(valeur * 10) / 10; // une décimale
  }
  // entier par défaut
  return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min);
}

// Évalue une petite expression arithmétique sûre (uniquement +, -, *, / et
// des nombres/variables), sans jamais utiliser eval(). Suffisant pour des
// expressions comme "2a", "a+b", "-a", "a/2".
function evaluerExpressionSimple(expr, valeurs) {
  // Remplace chaque variable par sa valeur numérique (entre parenthèses pour
  // préserver la priorité des opérations, ex: 2a -> 2*(3) si a=3)
  let expression = expr;
  Object.keys(valeurs).sort((a, b) => b.length - a.length).forEach(nom => {
    const motif = new RegExp(nom, "g");
    expression = expression.replace(motif, `(${valeurs[nom]})`);
  });
  // Insère les multiplications implicites : "2(3)" -> "2*(3)", ")(" -> ")*("
  expression = expression.replace(/(\d)\s*\(/g, "$1*(").replace(/\)\s*\(/g, ")*(");

  // N'autorise que les caractères attendus dans une expression arithmétique
  if (!/^[\d\s+\-*/().]+$/.test(expression)) return expr; // motif non reconnu, on laisse tel quel

  try {
    // new Function reste local et n'exécute que des opérations arithmétiques
    // validées par le test ci-dessus (pas d'accès à l'environnement JS)
    const resultat = new Function(`return (${expression});`)();
    if (typeof resultat !== "number" || !isFinite(resultat)) return expr;
    // Arrondi propre pour éviter les flottants disgracieux (ex: 0.30000000004)
    return Math.round(resultat * 1000) / 1000;
  } catch {
    return expr;
  }
}

// Remplace tous les placeholders {expr} d'un texte modèle par leur valeur
// calculée, en utilisant les valeurs tirées pour chaque paramètre.
function substituerPlaceholders(texteModele, valeurs) {
  return texteModele.replace(/\{([^{}]+)\}/g, (match, expr) => {
    const exprPropre = expr.trim();

    // Cas spécial : {poly(a:2, b:1, c:0)} — polynôme proprement formaté,
    // où le nombre après ":" est le degré de chaque coefficient.
    // Donne par exemple pour a:2, b:1, c:0 → "4x^2 + 3x - 5" (sans jamais
    // afficher "1x", "0" en trop, ou "+ (-5)").
    const matchPoly = exprPropre.match(/^poly\((.+)\)$/);
    if (matchPoly) {
      const termes = matchPoly[1].split(",").map(t => t.trim());
      const coeffs = termes.map(t => {
        const [nomCoeff, degreStr] = t.split(":").map(s => s.trim());
        const valeur = valeurs.hasOwnProperty(nomCoeff) ? valeurs[nomCoeff] : evaluerExpressionSimple(nomCoeff, valeurs);
        const degre = parseInt(degreStr, 10);
        return { valeur: typeof valeur === "number" ? valeur : 0, degre: isNaN(degre) ? 0 : degre };
      });
      return formaterPolynome(coeffs);
    }

    // Cas direct : juste le nom d'une variable connue
    if (valeurs.hasOwnProperty(exprPropre)) {
      const v = valeurs[exprPropre];
      return v < 0 ? `(${v})` : String(v); // parenthèse pour éviter les doubles signes (ex: +-3)
    }
    // Cas d'une expression à évaluer (ex: {2a}, {a+b})
    const resultat = evaluerExpressionSimple(exprPropre, valeurs);
    if (typeof resultat === "number") {
      return resultat < 0 ? `(${resultat})` : String(resultat);
    }
    return match; // n'a pas pu être interprété, on laisse tel quel (visible pour debug)
  });
}

// Construit la chaîne d'un polynôme proprement formatée à partir d'une liste
// de coefficients (du plus haut degré au plus bas), en gérant les cas
// particuliers : coefficient 0 (terme omis), coefficient 1 ou -1 (pas de
// "1" affiché devant la variable), signes correctement espacés ("- 4" et
// non "+ (-4)"), et degré 0 affiché sans variable.
// coeffs: tableau de { valeur, degre } où degre 0 = terme constant
function formaterPolynome(coeffs, variable = "x") {
  const termesValides = coeffs.filter(c => c.valeur !== 0);
  if (termesValides.length === 0) return "0";

  return termesValides.map((c, i) => {
    const { valeur, degre } = c;
    const abs = Math.abs(valeur);
    let partieVariable;
    if (degre === 0) partieVariable = "";
    else if (degre === 1) partieVariable = variable;
    else partieVariable = `${variable}^${degre}`;

    let partieCoeff;
    if (degre === 0) partieCoeff = String(abs);
    else if (abs === 1) partieCoeff = "";
    else partieCoeff = String(abs);

    const terme = partieCoeff + partieVariable;
    if (i === 0) return valeur < 0 ? `-${terme}` : terme;
    return valeur < 0 ? ` - ${terme}` : ` + ${terme}`;
  }).join("");
}

// Tire un exercice complet à partir de son modèle stocké en base :
// retourne { enonce, reponse, valeurs } prêt à être affiché/sélectionné.
function tirerExercice(exercice) {
  const valeurs = {};
  Object.entries(exercice.parametres).forEach(([nom, def]) => {
    valeurs[nom] = tirerValeurParametre(def);
  });
  return {
    enonce: substituerPlaceholders(exercice.enonce_modele, valeurs),
    reponse: substituerPlaceholders(exercice.reponse_modele, valeurs),
    valeurs,
  };
}

// ─── Bibliothèque d'exercices "Option B" (codés sur mesure) ────────────
// Chaque exercice de cette bibliothèque est une fonction qui tire ses
// propres valeurs (avec la logique exacte voulue, y compris les cas
// particuliers comme "jamais 0") et construit l'énoncé/réponse avec
// formaterPolynome pour un affichage toujours propre.
// Convention : chaque fonction prend 0 argument et retourne { enonce, reponse, valeurs }.

function tirerEntierNonNul(min, max) {
  let v;
  do { v = Math.floor(Math.random() * (max - min + 1)) + min; } while (v === 0);
  return v;
}
function tirerEntier(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// DER_FG_EX01 — Dérivée d'un polynôme du second degré
// f(x) = ax² + bx + c, avec a ∈ [-10,10]\{0}, b ∈ [-10,10], c ∈ [-20,20]
function genererDeriveePolynomeDegre2() {
  const a = tirerEntierNonNul(-10, 10);
  const b = tirerEntier(-10, 10);
  const c = tirerEntier(-20, 20);

  const fx = formaterPolynome([{ valeur: a, degre: 2 }, { valeur: b, degre: 1 }, { valeur: c, degre: 0 }]);
  const fpx = formaterPolynome([{ valeur: 2 * a, degre: 1 }, { valeur: b, degre: 0 }]);

  return {
    enonce: `Calculer $f'(x)$ pour $f(x) = ${fx}$.`,
    reponse: `$f'(x) = ${fpx}$`,
    valeurs: { a, b, c },
  };
}

// ─── Automatismes Seconde ───────────────────────────────────────────────

// SEC_FG_EX01 — Résoudre ax + b = cx + d (a ≠ c pour avoir une solution unique)
function genererEquationPremierDegre() {
  let a, c;
  do {
    a = tirerEntierNonNul(-5, 5);
    c = tirerEntierNonNul(-5, 5);
  } while (a === c);
  const b = tirerEntier(-10, 10);
  const d = tirerEntier(-10, 10);

  function pgcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
  const num = d - b, den = a - c;
  const g = pgcd(Math.abs(num), Math.abs(den));
  let numR = num / g, denR = den / g;
  if (denR < 0) { numR = -numR; denR = -denR; }

  const solution = denR === 1 ? String(numR) : numR + "/" + denR;
  const aStr = a === 1 ? "" : a === -1 ? "-" : String(a);
  const cStr = c === 1 ? "" : c === -1 ? "-" : String(c);
  const bStr = b === 0 ? "" : b > 0 ? " + " + b : " - " + Math.abs(b);
  const dStr = d === 0 ? "" : d > 0 ? " + " + d : " - " + Math.abs(d);

  return {
    enonce: `Résoudre : $${aStr}x${bStr} = ${cStr}x${dStr}$`,
    reponse: `$x = ${solution}$`,
    valeurs: { a, b, c, d },
  };
}

// SEC_FG_EX02 — Développer avec identités remarquables : (ax+b)², (ax-b)², (ax+b)(ax-b)
// b est toujours > 0 pour éviter les doubles signes disgracieux
function genererIdentiteRemarquable() {
  const a = tirerEntierNonNul(-4, 4);
  const b = tirerEntierNonNul(1, 5);
  const type = Math.floor(Math.random() * 3);
  const aStr = a === 1 ? "" : a === -1 ? "-" : String(a);
  const A2 = a * a;
  const A2str = A2 === 1 ? "x^2" : A2 + "x^2";
  const B2 = b * b;

  let enonce, reponse;

  if (type === 0) {
    const t2ab = 2 * a * b;
    const t2 = t2ab > 0
      ? " + " + (Math.abs(t2ab) === 1 ? "" : Math.abs(t2ab)) + "x"
      : " - " + (Math.abs(t2ab) === 1 ? "" : Math.abs(t2ab)) + "x";
    enonce = `(${aStr}x + ${b})^2`;
    reponse = A2str + t2 + " + " + B2;
  } else if (type === 1) {
    const t2ab = -2 * a * b;
    const t2 = t2ab > 0
      ? " + " + (Math.abs(t2ab) === 1 ? "" : Math.abs(t2ab)) + "x"
      : " - " + (Math.abs(t2ab) === 1 ? "" : Math.abs(t2ab)) + "x";
    enonce = `(${aStr}x - ${b})^2`;
    reponse = A2str + t2 + " + " + B2;
  } else {
    enonce = `(${aStr}x + ${b})(${aStr}x - ${b})`;
    reponse = A2str + " - " + B2;
  }

  return {
    enonce: `Développer : $${enonce}$`,
    reponse: `$${reponse}$`,
    valeurs: { a, b, type },
  };
}

// SEC_FG_EX03 — Calculer f(c) pour f(x) = ax + b (fonction affine)
function genererImageFonctionAffine() {
  const a = tirerEntierNonNul(-5, 5);
  const b = tirerEntier(-10, 10);
  const c = tirerEntier(-8, 8);
  const resultat = a * c + b;
  const aStr = a === 1 ? "" : a === -1 ? "-" : String(a);
  const bStr = b === 0 ? "" : b > 0 ? " + " + b : " - " + Math.abs(b);
  return {
    enonce: `Calculer $f(${c})$ pour $f(x) = ${aStr}x${bStr}$`,
    reponse: `$f(${c}) = ${resultat}$`,
    valeurs: { a, b, c },
  };
}

// SEC_FG_EX04 — Coefficient multiplicateur ↔ taux d'évolution
// Taux entier entre -50% et +50%, jamais 0
function genererCoeffMultiplicateur() {
  const taux = tirerEntierNonNul(-50, 50);
  const coeff = (100 + taux) / 100;
  const coeffStr = coeff % 1 === 0 ? String(coeff) : coeff.toFixed(2).replace(/0+$/, "");
  const type = Math.random() > 0.5;

  if (type) {
    const sens = taux > 0 ? "une augmentation" : "une diminution";
    return {
      enonce: `Donner le coefficient multiplicateur correspondant à ${sens} de $${Math.abs(taux)}\\%$`,
      reponse: `$\\times ${coeffStr}$`,
      valeurs: { taux, sens: "taux→coeff" },
    };
  } else {
    const evolution = taux > 0
      ? `augmentation de $${taux}\\%$`
      : `diminution de $${Math.abs(taux)}\\%$`;
    return {
      enonce: `Le coefficient multiplicateur $${coeffStr}$ correspond à quelle évolution ?`,
      reponse: evolution,
      valeurs: { taux, sens: "coeff→taux" },
    };
  }
}

// SEC_FG_EX05 — Distance entre deux points A(x1,y1) et B(x2,y2)
function genererDistancePoints() {
  const x1 = tirerEntier(-5, 5), y1 = tirerEntier(-5, 5);
  const x2 = tirerEntier(-5, 5), y2 = tirerEntier(-5, 5);
  const dx = x2 - x1, dy = y2 - y1;
  const d2 = dx * dx + dy * dy;
  const racine = Math.sqrt(d2);
  const resultat = Number.isInteger(racine) ? String(racine) : `\\sqrt{${d2}}`;
  return {
    enonce: `Calculer la distance $AB$ avec $A(${x1};${y1})$ et $B(${x2};${y2})$`,
    reponse: `$AB = ${resultat}$`,
    valeurs: { x1, y1, x2, y2 },
  };
}

// Registre des exercices codés sur mesure : id -> fonction de génération.
// C'est ici qu'on ajoutera chaque nouvel exercice créé avec Claude.
const BIBLIOTHEQUE_EXERCICES = {
  // ── Terminale Spé ──
  "DER_FG_EX01": { generer: genererDeriveePolynomeDegre2, chapitre: "Dérivation", niveauScolaire: "terminale_spe", niveau: 2, titre: "Dérivée d'un polynôme du second degré" },
  // ── Seconde ──
  "SEC_FG_EX01": { generer: genererEquationPremierDegre,   chapitre: "Équations et Inéquations",       niveauScolaire: "seconde", niveau: 1, titre: "Résoudre ax + b = cx + d" },
  "SEC_FG_EX02": { generer: genererIdentiteRemarquable,    chapitre: "Calcul littéral 2",               niveauScolaire: "seconde", niveau: 2, titre: "Développer avec identités remarquables" },
  "SEC_FG_EX03": { generer: genererImageFonctionAffine,    chapitre: "Généralités sur les fonctions",   niveauScolaire: "seconde", niveau: 1, titre: "Image d'un réel par une fonction affine" },
  "SEC_FG_EX04": { generer: genererCoeffMultiplicateur,    chapitre: "Proportions et évolutions",       niveauScolaire: "seconde", niveau: 1, titre: "Coefficient multiplicateur ↔ taux d'évolution" },
  "SEC_FG_EX05": { generer: genererDistancePoints,         chapitre: "Vecteur Partie 1",                niveauScolaire: "seconde", niveau: 1, titre: "Distance entre deux points" },
};


function Login({ onLogin }) {
  const [identifiant, setIdentifiant] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true); setErr("");
    const emailInterne = identifiant.trim().toLowerCase() + "@grandoral.local";
    const { data, error } = await supabase.auth.signInWithPassword({ email: emailInterne, password: pwd });
    if (error) { setErr("Identifiant ou mot de passe incorrect."); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    onLogin(data.user, profile);
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">Terminale Spé · Préparation au Grand Oral</div>
        <div className="login-title">Grand Oral</div>
        <div className="login-sub">Espace de préparation individuelle</div>
        <div className="field">
          <label>Identifiant</label>
          <input type="text" value={identifiant} onChange={e => setIdentifiant(e.target.value)}
            placeholder="prenom.nom" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
            placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <button className="btn-login" onClick={handleLogin} disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
        {err && <div className="login-error">{err}</div>}
      </div>
    </div>
  );
}

// ─── Composant SaisieSubject (première connexion élève) ──────────────
function SaisieSubject({ profile, onSave, nomProf }) {
  const [sujet, setSujet] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!sujet.trim()) return;
    setSaving(true);
    await supabase.from("profiles").update({ sujet: sujet.trim() }).eq("id", profile.id);
    onSave(sujet.trim());
    setSaving(false);
  }

  return (
    <div className="sujet-wrap">
      <div className="sujet-card">
        <div className="sujet-emoji">🎤</div>
        <div className="sujet-title">Bonjour {profile.prenom} !</div>
        <div className="sujet-sub">
          Avant de démarrer, renseigne le sujet de ton Grand Oral.<br />
          Il apparaîtra dans ton espace et aidera {nomProf || "ton professeur"} à préparer tes réponses.
        </div>
        <textarea
          className="sujet-input"
          placeholder="Ex : Le rôle des mathématiques dans la modélisation épidémique…"
          value={sujet}
          onChange={e => setSujet(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
          autoFocus
        />
        <div className="sujet-hint">Entrée pour valider · Tu pourras le modifier à tout moment depuis ton espace.</div>
        <button className="btn-sujet" onClick={handleSave} disabled={!sujet.trim() || saving}>
          {saving ? "Enregistrement…" : "Accéder à mon espace →"}
        </button>
      </div>
    </div>
  );
}

// ─── Composant ChangePasswordModal ────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleChange() {
    setErr("");
    if (pwd1.length < 6) { setErr("Le mot de passe doit faire au moins 6 caractères."); return; }
    if (pwd1 !== pwd2) { setErr("Les deux mots de passe ne correspondent pas."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd1 });
    setSaving(false);
    if (error) { setErr("Erreur : " + error.message); return; }
    setSuccess(true);
    setTimeout(onClose, 1500);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-title">Changer mon mot de passe</div>
        <div className="modal-sub">Choisis un nouveau mot de passe, facile à retenir mais difficile à deviner.</div>
        <div className="modal-field">
          <label>Nouveau mot de passe</label>
          <input type="password" value={pwd1} onChange={e => setPwd1(e.target.value)} placeholder="••••••••" autoFocus />
        </div>
        <div className="modal-field">
          <label>Confirmer le mot de passe</label>
          <input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && handleChange()} />
        </div>
        {err && <div className="modal-error">{err}</div>}
        {success && <div className="modal-success">✓ Mot de passe mis à jour !</div>}
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onClose}>Annuler</button>
          <button className="modal-btn modal-btn-confirm" onClick={handleChange} disabled={saving || success}>
            {saving ? "Enregistrement…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant Message ───────────────────────────────────────────────
function Message({ msg, isMe, profile, onSupprimer, currentProfile, onSupprimerFichier }) {
  const hasFile = !!msg.fichier_url;
  const hasText = !!msg.contenu;
  // Le prof peut retirer le fichier d'un message qui n'est pas le sien (donc un message d'élève)
  const peutSupprimerFichier = currentProfile?.role === "professeur" && !isMe && hasFile && !msg.supprime;
  return (
    <div className={`msg-row${isMe ? " mine" : ""}`}>
      {!isMe && (
        <div className="avatar avatar-sm" style={{ background: isMe ? undefined : "linear-gradient(135deg,#6366f1,#a78bfa)" }}>
          {initials(profile?.nom, profile?.prenom)}
        </div>
      )}
      <div>
        {!isMe && <div className="bubble-sender">{profile?.prenom} {profile?.nom}</div>}
        <div className={`bubble${msg.supprime ? " bubble-supprime" : ""}`}>
          {msg.supprime ? (
            <div className="bubble-supprime-text">🚫 Message supprimé</div>
          ) : (
            <>
              {hasFile && (
                <div className="file-bubble-wrap">
                  <a className="file-bubble" href={msg.fichier_url} target="_blank" rel="noreferrer">
                    <span className="file-icon">{fileIcon(msg.fichier_type)}</span>
                    <div className="file-details">
                      <div className="file-name">{msg.fichier_nom}</div>
                      <div className="file-dl">Ouvrir le fichier</div>
                    </div>
                  </a>
                  {peutSupprimerFichier && (
                    <button className="file-delete-btn" onClick={() => onSupprimerFichier(msg)} title="Supprimer ce fichier (libère de l'espace)">🗑️</button>
                  )}
                </div>
              )}
              {!hasFile && msg.fichier_supprime_par_prof && (
                <div className="file-bubble-supprime">📎 Fichier supprimé par le professeur</div>
              )}
              {hasText && <div style={{ marginTop: hasFile ? 8 : 0 }}>{msg.contenu}</div>}
            </>
          )}
          <div className="bubble-meta">
            {formatTime(msg.created_at)}
            {isMe && !msg.supprime && (
              <button className="bubble-delete-btn" onClick={() => onSupprimer(msg)} title="Supprimer ce message">🗑️</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Composant Chat ──────────────────────────────────────────────────
// ─── Composant DiapoSettings (réglages avant lancement) ──────────────
function DiapoSettings({ nbQuestions, onLancer, onAnnuler }) {
  const [mode, setMode] = useState("apres_chaque_question");
  const [delai, setDelai] = useState(20);

  return (
    <div className="diapo-settings-overlay" onClick={e => e.target === e.currentTarget && onAnnuler()}>
      <div className="diapo-settings-card">
        <div className="diapo-settings-title">Lancer le diaporama</div>
        <div className="diapo-settings-sub">{nbQuestions} question{nbQuestions !== 1 ? "s" : ""} dans la sélection actuelle</div>

        <div className="diapo-settings-section">
          <div className="diapo-settings-label">Affichage des réponses</div>
          <div className="diapo-mode-options">
            <label className={`diapo-mode-option${mode === "apres_chaque_question" ? " selected" : ""}`}>
              <input type="radio" name="mode" checked={mode === "apres_chaque_question"}
                onChange={() => setMode("apres_chaque_question")} />
              <div>
                <div className="diapo-mode-option-title">Réponse après chaque question</div>
                <div className="diapo-mode-option-desc">La réponse s'affiche avant de passer à la question suivante</div>
              </div>
            </label>
            <label className={`diapo-mode-option${mode === "recap_final" ? " selected" : ""}`}>
              <input type="radio" name="mode" checked={mode === "recap_final"}
                onChange={() => setMode("recap_final")} />
              <div>
                <div className="diapo-mode-option-title">Récapitulatif à la fin</div>
                <div className="diapo-mode-option-desc">Toutes les questions défilent sans réponse, puis un récapitulatif final les regroupe toutes</div>
              </div>
            </label>
          </div>
        </div>

        <div className="diapo-settings-section">
          <div className="diapo-settings-label">Délai avant avancée automatique</div>
          <div className="diapo-timer-row">
            <input type="number" className="diapo-timer-input" value={delai} min={5} max={180}
              onChange={e => setDelai(Math.max(5, Math.min(180, Number(e.target.value) || 5)))} />
            <span className="diapo-timer-unit">secondes</span>
            <div className="diapo-timer-presets">
              {[10, 15, 20, 30].map(s => (
                <button key={s} className={`diapo-timer-preset${delai === s ? " active" : ""}`} onClick={() => setDelai(s)}>{s}s</button>
              ))}
            </div>
          </div>
        </div>

        <div className="diapo-settings-actions">
          <button className="diapo-cancel-btn" onClick={onAnnuler}>Annuler</button>
          <button className="diapo-launch-btn" onClick={() => onLancer({ mode, delai })}>
            ▶ Lancer le diaporama
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant DiapoViewer (visionneuse plein écran) ───────────────────
function DiapoViewer({ questions, mode, delai, nomChapitre, onFermer }) {
  const [index, setIndex] = useState(0);
  const [etape, setEtape] = useState("question"); // "question" | "reponse" | "recap"
  const [enPause, setEnPause] = useState(false);
  const [tempsRestant, setTempsRestant] = useState(delai);
  const intervalRef = useRef(null);

  const question = questions[index];
  const estDerniereQuestion = index === questions.length - 1;

  // Logique d'avancée automatique
  const avancer = useCallback(() => {
    if (mode === "apres_chaque_question") {
      if (etape === "question") {
        setEtape("reponse");
        setTempsRestant(delai);
      } else {
        if (estDerniereQuestion) {
          setEtape("recap"); // fin : petit récap même en mode "après chaque question"
        } else {
          setIndex(i => i + 1);
          setEtape("question");
          setTempsRestant(delai);
        }
      }
    } else {
      // mode recap_final : on ne montre jamais la réponse en cours de route
      if (estDerniereQuestion) {
        setEtape("recap");
      } else {
        setIndex(i => i + 1);
        setTempsRestant(delai);
      }
    }
  }, [mode, etape, estDerniereQuestion, delai]);

  // Minuteur automatique
  useEffect(() => {
    if (etape === "recap" || enPause) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTempsRestant(t => {
        if (t <= 1) {
          avancer();
          return delai;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [etape, enPause, avancer, delai]);

  // Avancée manuelle (clic ou touche)
  function avancerManuel() {
    if (etape === "recap") return;
    clearInterval(intervalRef.current);
    avancer();
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") { onFermer(); return; }
      if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        avancerManuel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const progressionPct = ((index + (etape === "reponse" ? 0.5 : 0)) / questions.length) * 100;

  return (
    <div className="diapo-viewer">
      <div className="diapo-topbar">
        <div className="diapo-progress">
          {etape === "recap" ? "Récapitulatif" : `Question ${index + 1} / ${questions.length}`}
        </div>
        <div className="diapo-topbar-actions">
          {etape !== "recap" && (
            <>
              <div className="diapo-timer-display">
                <span className="diapo-timer-ring" style={{ opacity: enPause ? 0.3 : 1 }} />
                {tempsRestant}s
              </div>
              <button className="diapo-pause-btn" onClick={() => setEnPause(p => !p)}>
                {enPause ? "▶ Reprendre" : "⏸ Pause"}
              </button>
            </>
          )}
          <button className="diapo-close-btn" onClick={onFermer}>✕ Fermer</button>
        </div>
      </div>

      <div className="diapo-progress-bar">
        <div className="diapo-progress-bar-fill" style={{ width: `${etape === "recap" ? 100 : progressionPct}%` }} />
      </div>

      {etape !== "recap" ? (
        <div className="diapo-content" onClick={avancerManuel}>
          <div className="diapo-chapitre-tag">{nomChapitre(question.chapitre_id)}</div>
          <div className="diapo-enonce"><MathText inline={false}>{question.enonce}</MathText></div>
          {etape === "reponse" && (
            <>
              <div className="diapo-reponse-divider" />
              <div className="diapo-reponse"><MathText inline={false}>{question.reponse}</MathText></div>
            </>
          )}
          <div className="diapo-hint">Clic, Espace ou → pour avancer · Échap pour fermer</div>
        </div>
      ) : (
        <div className="diapo-recap">
          <div className="diapo-recap-title">📋 Récapitulatif des réponses</div>
          {questions.map((q, i) => (
            <div key={q.id} className="diapo-recap-item">
              <div className="diapo-recap-num">Question {i + 1} · {nomChapitre(q.chapitre_id)}</div>
              <div className="diapo-recap-enonce"><MathText inline={false}>{q.enonce}</MathText></div>
              <div className="diapo-recap-reponse"><MathText inline={false}>{q.reponse}</MathText></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Composant ImportQuestions ──────────────────────────────────────────
function ImportQuestions({ currentUser, currentProfile, chapitres, onFermer, onImportTermine }) {
  const [fichier, setFichier] = useState(null);
  const [analyse, setAnalyse] = useState(null); // { valides, conflits, chapitresInconnus }
  const [analysing, setAnalysing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultat, setResultat] = useState(null); // { nbImportees, nbErreurs }
  const fileRef = useRef(null);

  // Calcule le prochain numéro libre pour un préfixe+auteur donné, en tenant compte
  // à la fois des ids déjà en base ET de ceux déjà attribués plus tôt dans ce même import
  function prochainNumeroLibre(prefixeComplet, idsExistants, idsDejaAttribuesDansCetImport) {
    let n = 1;
    let idCandidat;
    do {
      idCandidat = `${prefixeComplet}_${String(n).padStart(2, "0")}`;
      n++;
    } while (idsExistants.has(idCandidat) || idsDejaAttribuesDansCetImport.has(idCandidat));
    return idCandidat;
  }

  async function analyserFichier(file) {
    setAnalysing(true);
    setResultat(null);
    try {
      const texte = await file.text();
      const data = JSON.parse(texte);
      const liste = Array.isArray(data) ? data : (data.questions || []);

      const { data: existantes } = await supabase.from("questions").select("id");
      const idsExistants = new Set((existantes || []).map(q => q.id));
      const idsAttribues = new Set(); // suivi au fil de CET import, pour éviter 2 suggestions identiques

      const chapitresParNom = {};
      chapitres.forEach(c => { chapitresParNom[c.nom.trim().toLowerCase()] = c.id; });

      const initiales = initialesAuteur(currentProfile?.prenom, currentProfile?.nom);

      const valides = [];        // id déjà conforme à la convention, pas de conflit
      const corrections = [];    // id non conforme et/ou en conflit → id recalculé proposé
      const chapitresInconnus = [];
      const prefixesManquants = [];

      liste.forEach((q, idx) => {
        const nomChap = (q.chapitre || "").trim().toLowerCase();
        const chapitreId = chapitresParNom[nomChap];

        if (!chapitreId) {
          chapitresInconnus.push({ ...q, _ligne: idx + 1 });
          return;
        }

        const prefixe = prefixeChapitre(q.chapitre);
        if (!prefixe) {
          // Chapitre reconnu mais sans préfixe officiel défini (cas normalement impossible
          // si la table PREFIXES_CHAPITRES est à jour avec les 19 chapitres)
          prefixesManquants.push({ ...q, _ligne: idx + 1 });
          return;
        }

        const prefixeComplet = `${prefixe}_${initiales}`;
        const conforme = idRespecteConvention(q.id, prefixe, initiales);
        const enConflit = idsExistants.has(q.id) || idsAttribues.has(q.id);

        if (conforme && !enConflit) {
          idsAttribues.add(q.id);
          valides.push({ ...q, _chapitreId: chapitreId });
        } else {
          const idCorrige = prochainNumeroLibre(prefixeComplet, idsExistants, idsAttribues);
          idsAttribues.add(idCorrige);
          corrections.push({
            ...q,
            _chapitreId: chapitreId,
            _idOriginal: q.id,
            _idCorrige: idCorrige,
            _raison: enConflit ? "id déjà utilisé" : "ne respecte pas la convention",
          });
        }
      });

      setAnalyse({ valides, corrections, chapitresInconnus, prefixesManquants });
    } catch (e) {
      setAnalyse({ erreurParsing: e.message });
    }
    setAnalysing(false);
  }

  function handleFile(file) {
    setFichier(file);
    analyserFichier(file);
  }

  async function lancerImport() {
    if (!analyse) return;
    setImporting(true);

    // On importe : toutes les valides (id déjà conforme) + les corrections (id recalculé)
    const aInserer = [
      ...analyse.valides.map(q => ({
        id: q.id, chapitre_id: q._chapitreId, type: q.type,
        enonce: q.enonce, reponse: q.reponse, niveau: q.niveau || 2,
        prof_id: currentUser.id,
      })),
      ...analyse.corrections.map(q => ({
        id: q._idCorrige, chapitre_id: q._chapitreId, type: q.type,
        enonce: q.enonce, reponse: q.reponse, niveau: q.niveau || 2,
        prof_id: currentUser.id,
      })),
    ];

    let nbImportees = 0;
    let nbErreurs = 0;
    // Insertion par lots de 50 pour rester raisonnable
    for (let i = 0; i < aInserer.length; i += 50) {
      const lot = aInserer.slice(i, i + 50);
      const { error } = await supabase.from("questions").insert(lot);
      if (error) nbErreurs += lot.length;
      else nbImportees += lot.length;
    }

    setImporting(false);
    setResultat({ nbImportees, nbErreurs });
    onImportTermine();
  }

  const totalAImporter = analyse ? analyse.valides.length + analyse.corrections.length : 0;

  return (
    <div className="import-overlay" onClick={e => e.target === e.currentTarget && onFermer()}>
      <div className="import-card">
        <div className="import-title">Importer des questions</div>
        <div className="import-sub">Fichier JSON au format habituel (id, chapitre, type, enonce, reponse, niveau)</div>

        {!resultat && (
          <div className="import-dropzone" onClick={() => fileRef.current?.click()}>
            <div className="import-dropzone-icon">📂</div>
            <div className="import-dropzone-text">
              {fichier ? "Cliquer pour changer de fichier" : "Cliquer pour choisir un fichier .json"}
            </div>
            {fichier && <div className="import-filename">{fichier.name}</div>}
            <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          </div>
        )}

        {analysing && <div className="import-sub">Analyse du fichier…</div>}

        {analyse?.erreurParsing && (
          <div className="import-report-item" style={{ color: "var(--red)" }}>
            Fichier JSON invalide : {analyse.erreurParsing}
          </div>
        )}

        {analyse && !analyse.erreurParsing && !resultat && (
          <div className="import-report">
            <div className="import-report-section">
              <div className="import-report-header ok">
                ✅ {analyse.valides.length} question{analyse.valides.length !== 1 ? "s" : ""} prête{analyse.valides.length !== 1 ? "s" : ""} à importer
              </div>
            </div>

            {analyse.corrections.length > 0 && (
              <div className="import-report-section">
                <div className="import-report-header warn">
                  ⚠️ {analyse.corrections.length} id corrigé{analyse.corrections.length !== 1 ? "s" : ""} pour respecter la convention
                </div>
                {analyse.corrections.map((q, i) => (
                  <div key={i} className="import-report-item">
                    <span className="import-report-item-id">{q._idOriginal || "(vide)"}</span>
                    <span className="import-report-item-detail">{q._raison} — {q.enonce}</span>
                    <span className="import-report-suggestion">→ {q._idCorrige}</span>
                  </div>
                ))}
              </div>
            )}

            {analyse.chapitresInconnus.length > 0 && (
              <div className="import-report-section">
                <div className="import-report-header warn">
                  ❌ {analyse.chapitresInconnus.length} question{analyse.chapitresInconnus.length !== 1 ? "s" : ""} avec un chapitre introuvable (non importée{analyse.chapitresInconnus.length !== 1 ? "s" : ""})
                </div>
                {analyse.chapitresInconnus.map((q, i) => (
                  <div key={i} className="import-report-item">
                    <span className="import-report-item-id">{q.id || `ligne ${q._ligne}`}</span>
                    <span className="import-report-item-detail">Chapitre indiqué : "{q.chapitre}"</span>
                  </div>
                ))}
              </div>
            )}

            {analyse.prefixesManquants?.length > 0 && (
              <div className="import-report-section">
                <div className="import-report-header warn">
                  ❌ {analyse.prefixesManquants.length} question{analyse.prefixesManquants.length !== 1 ? "s" : ""} sans préfixe officiel défini pour ce chapitre (non importée{analyse.prefixesManquants.length !== 1 ? "s" : ""})
                </div>
                {analyse.prefixesManquants.map((q, i) => (
                  <div key={i} className="import-report-item">
                    <span className="import-report-item-id">{q.id || `ligne ${q._ligne}`}</span>
                    <span className="import-report-item-detail">Chapitre : "{q.chapitre}" — contacter F. Granet pour ajouter ce préfixe</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {resultat && (
          <div className="import-result">
            <div className="import-result-icon">{resultat.nbErreurs === 0 ? "🎉" : "⚠️"}</div>
            <div>
              <strong>{resultat.nbImportees}</strong> question{resultat.nbImportees !== 1 ? "s" : ""} importée{resultat.nbImportees !== 1 ? "s" : ""}
              {resultat.nbErreurs > 0 && <> · {resultat.nbErreurs} erreur{resultat.nbErreurs !== 1 ? "s" : ""}</>}
            </div>
          </div>
        )}

        <div className="import-actions">
          {!resultat ? (
            <>
              <button className="diapo-cancel-btn" onClick={onFermer}>Annuler</button>
              <button className="diapo-launch-btn" onClick={lancerImport}
                disabled={!analyse || analyse.erreurParsing || importing || totalAImporter === 0}>
                {importing ? "Import en cours…" : `Importer ${totalAImporter} question${totalAImporter !== 1 ? "s" : ""}`}
              </button>
            </>
          ) : (
            <button className="diapo-launch-btn" onClick={onFermer}>Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Composant GenerateurZone ──────────────────────────────────────────
// ─── Composant UsageIndicator ───────────────────────────────────────────
// Affiche l'usage actuel de la base de données et du stockage de fichiers
// par rapport aux limites du plan gratuit Supabase (500 Mo BDD, 1 Go fichiers).
function formatTaille(octets) {
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(0)} Mo`;
}

function UsageIndicator() {
  const [stats, setStats] = useState(null);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    supabase.rpc("get_usage_stats").then(({ data, error }) => {
      if (!error && data) setStats(data);
    });
  }, []);

  if (!stats) return null;

  const LIMITE_DB = 500 * 1024 * 1024;       // 500 Mo
  const LIMITE_STORAGE = 1024 * 1024 * 1024; // 1 Go

  const pctDb = Math.min(100, (stats.database_bytes / LIMITE_DB) * 100);
  const pctStorage = Math.min(100, (stats.storage_bytes / LIMITE_STORAGE) * 100);
  const alerte = pctDb > 80 || pctStorage > 80;

  return (
    <div className="usage-indicator">
      <button className="usage-indicator-toggle" onClick={() => setOuvert(o => !o)}>
        <span className={`usage-dot${alerte ? " alerte" : ""}`} />
        Stockage Supabase
        <span className="usage-chevron">{ouvert ? "▾" : "▸"}</span>
      </button>
      {ouvert && (
        <div className="usage-detail">
          <div className="usage-row">
            <div className="usage-row-label">Base de données <span>{formatTaille(stats.database_bytes)} / 500 Mo</span></div>
            <div className="usage-bar"><div className="usage-bar-fill" style={{ width: `${pctDb}%`, background: pctDb > 80 ? "var(--red)" : "var(--accent)" }} /></div>
          </div>
          <div className="usage-row">
            <div className="usage-row-label">Fichiers (photos, PDF) <span>{formatTaille(stats.storage_bytes)} / 1 Go</span></div>
            <div className="usage-bar"><div className="usage-bar-fill" style={{ width: `${pctStorage}%`, background: pctStorage > 80 ? "var(--red)" : "var(--accent)" }} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Composant HistoriqueZone ───────────────────────────────────────────
function HistoriqueZone({ currentUser, currentProfile, allProfiles, onRejouer }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState("mes_sessions"); // "mes_sessions" | "favoris" | "partagees"
  const [renommageId, setRenommageId] = useState(null);
  const [brouillonNom, setBrouillonNom] = useState("");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    let requete = supabase.from("sessions_historique").select("*").order("updated_at", { ascending: false });
    if (filtre === "mes_sessions") requete = requete.eq("prof_id", currentUser.id);
    else if (filtre === "favoris") requete = requete.eq("prof_id", currentUser.id).eq("favori", true);
    else if (filtre === "partagees") requete = requete.eq("partage", true).neq("prof_id", currentUser.id);
    const { data } = await requete.limit(100);
    setSessions(data || []);
    setLoading(false);
  }, [filtre, currentUser.id]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  function nomAuteur(profId) {
    const p = allProfiles.find(pr => pr.id === profId);
    return p ? formatNomProf(p.prenom, p.nom) : "?";
  }

  async function toggleFavori(session) {
    await supabase.from("sessions_historique").update({ favori: !session.favori }).eq("id", session.id);
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, favori: !s.favori } : s));
  }

  async function togglePartage(session) {
    await supabase.from("sessions_historique").update({ partage: !session.partage }).eq("id", session.id);
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, partage: !s.partage } : s));
  }

  async function supprimerSession(session) {
    const confirme = window.confirm(`Supprimer définitivement la session "${session.nom}" ?`);
    if (!confirme) return;
    await supabase.from("sessions_historique").delete().eq("id", session.id);
    setSessions(prev => prev.filter(s => s.id !== session.id));
  }

  function commencerRenommage(session) {
    setRenommageId(session.id);
    setBrouillonNom(session.nom);
  }

  async function enregistrerRenommage(session) {
    if (!brouillonNom.trim()) return;
    await supabase.from("sessions_historique").update({ nom: brouillonNom.trim() }).eq("id", session.id);
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, nom: brouillonNom.trim() } : s));
    setRenommageId(null);
  }

  function libelleAction(action) {
    if (action === "tex_eleve") return "📝 .tex élève";
    if (action === "tex_corrige") return "📝 .tex corrigé";
    if (action === "diaporama") return "▶ Diaporama";
    if (action === "pdf") return "📄 PDF";
    return "";
  }

  const estProprietaire = (session) => session.prof_id === currentUser.id;

  return (
    <div className="hist-area">
      <div className="hist-toolbar">
        <button className={`hist-toolbar-filter${filtre === "mes_sessions" ? " active" : ""}`}
          onClick={() => setFiltre("mes_sessions")}>Mes sessions</button>
        <button className={`hist-toolbar-filter${filtre === "favoris" ? " active" : ""}`}
          onClick={() => setFiltre("favoris")}>⭐ Favoris</button>
        <button className={`hist-toolbar-filter${filtre === "partagees" ? " active" : ""}`}
          onClick={() => setFiltre("partagees")}>Partagées par mes collègues</button>
      </div>

      {loading ? (
        <div className="hist-empty">Chargement…</div>
      ) : sessions.length === 0 ? (
        <div className="hist-empty">
          <div style={{ fontSize: 32, opacity: .3 }}>🕓</div>
          <div>
            {filtre === "mes_sessions" && "Aucune session pour l'instant. Exporte un .tex ou lance un diaporama pour en créer une."}
            {filtre === "favoris" && "Aucun favori pour l'instant."}
            {filtre === "partagees" && "Aucune session partagée par tes collègues pour l'instant."}
          </div>
        </div>
      ) : (
        <div className="hist-list">
          {sessions.map(session => (
            <div key={session.id} className="hist-card">
              <div className="hist-card-top">
                <div className="hist-card-main">
                  {renommageId === session.id ? (
                    <input className="hist-card-nom-input" value={brouillonNom} autoFocus
                      onChange={e => setBrouillonNom(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") enregistrerRenommage(session); if (e.key === "Escape") setRenommageId(null); }}
                      onBlur={() => enregistrerRenommage(session)} />
                  ) : (
                    <div className="hist-card-nom">{session.nom}</div>
                  )}
                  <div className="hist-card-meta">
                    <span>{session.question_ids.length} question{session.question_ids.length !== 1 ? "s" : ""}</span>
                    {session.derniere_action && <span className="hist-badge">{libelleAction(session.derniere_action)}</span>}
                    {session.partage && <span className="hist-badge partage">Partagée</span>}
                    {!estProprietaire(session) && <span className="hist-card-auteur">par {nomAuteur(session.prof_id)}</span>}
                  </div>
                </div>
                <div className="hist-card-actions">
                  {estProprietaire(session) && (
                    <>
                      <button className={`hist-icon-btn${session.favori ? " fav-active" : ""}`}
                        onClick={() => toggleFavori(session)} title="Mettre en favori">⭐</button>
                      <button className="hist-icon-btn" onClick={() => commencerRenommage(session)} title="Renommer">✏️</button>
                      <button className="hist-icon-btn" onClick={() => togglePartage(session)}
                        title={session.partage ? "Rendre privée" : "Partager avec mes collègues"}>
                        {session.partage ? "🔓" : "🔒"}
                      </button>
                      <button className="hist-icon-btn" onClick={() => supprimerSession(session)} title="Supprimer">🗑️</button>
                    </>
                  )}
                </div>
              </div>
              <button className="hist-card-rejouer" onClick={() => onRejouer(session.question_ids)}>
                ↻ Rejouer cette sélection
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Composant TirageAleatoire ──────────────────────────────────────────
const TYPES_TIRAGE = ["formule", "méthode", "définition", "théorème", "exercice"];
const NIVEAUX_TIRAGE = [1, 2, 3];

function melanger(tableau) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

// ─── Composant CreerQuestion ─────────────────────────────────────────────
function CreerQuestion({ chapitres, currentUser, niveauScolaire, onFermer, onCree }) {
  const [mode, setMode] = useState("fixe");
  const [chapitreId, setChapitreId] = useState(chapitres[0]?.id || "");
  const [type, setType] = useState("formule");
  const [niveau, setNiveau] = useState(1);
  const [enonce, setEnonce] = useState("");
  const [reponse, setReponse] = useState("");
  const [params, setParams] = useState([]);
  const [testResultat, setTestResultat] = useState(null);
  const [testErreur, setTestErreur] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const variablesDetectees = useMemo(() => {
    const texte = enonce + " " + reponse;
    const variables = new Set();
    const regex = /\{([^{}]+)\}/g;
    let match;
    while ((match = regex.exec(texte)) !== null) {
      const expr = match[1].trim();
      if (/^poly\(/.test(expr)) {
        const interieur = expr.match(/^poly\((.+)\)$/)?.[1] || "";
        interieur.split(",").forEach(t => {
          const nom = t.split(":")[0].trim();
          if (/^[a-zA-Z]+$/.test(nom)) variables.add(nom);
        });
      } else {
        (expr.match(/[a-zA-Z]+/g) || []).forEach(l => variables.add(l));
      }
    }
    return [...variables].sort();
  }, [enonce, reponse]);

  useEffect(() => {
    if (mode !== "aleatoire") return;
    setParams(prev => {
      const existants = Object.fromEntries(prev.map(p => [p.nom, p]));
      return variablesDetectees.map(nom => existants[nom] || { nom, min: "-10", max: "10", type: "entier" });
    });
  }, [variablesDetectees, mode]);

  function mettreAJourParam(index, champ, valeur) {
    setParams(prev => prev.map((p, i) => i === index ? { ...p, [champ]: valeur } : p));
  }

  function lancerTest() {
    setTestErreur(null);
    try {
      const parametres = {};
      params.forEach(p => { parametres[p.nom] = { min: Number(p.min), max: Number(p.max), type: p.type }; });
      const valeurs = {};
      Object.entries(parametres).forEach(([nom, def]) => { valeurs[nom] = tirerValeurParametre(def); });
      const enonceGenere = substituerPlaceholders(enonce, valeurs);
      const reponseGeneree = substituerPlaceholders(reponse, valeurs);
      setTestResultat({ enonce: enonceGenere, reponse: reponseGeneree, valeurs });
    } catch (e) {
      setTestErreur(e.message);
      setTestResultat(null);
    }
  }

  async function enregistrer() {
    if (!enonce.trim() || !reponse.trim() || !chapitreId) return;
    setEnregistrement(true);
    if (mode === "fixe") {
      const { error } = await supabase.from("questions").insert({
        chapitre_id: chapitreId, type, enonce: enonce.trim(),
        reponse: reponse.trim(), niveau, prof_id: currentUser.id,
      });
      setEnregistrement(false);
      if (error) { alert("Erreur : " + error.message); return; }
    } else {
      const parametres = {};
      params.forEach(p => { parametres[p.nom] = { min: Number(p.min), max: Number(p.max), type: p.type }; });
      const initiales = currentUser.email?.split("@")[0].split(".").map(p => p[0]?.toUpperCase()).join("") || "XX";
      const { data: existants } = await supabase.from("exercices_application").select("id").eq("chapitre_id", chapitreId);
      const nn = String((existants?.length || 0) + 1).padStart(2, "0");
      const chapitreCourant = chapitres.find(c => c.id === chapitreId);
      const prefixe = (chapitreCourant?.nom.split(" ").map(w => w[0]).join("") || "AUT").toUpperCase().slice(0, 4);
      const id = `${prefixe}_${initiales}_EX${nn}`;
      const { error } = await supabase.from("exercices_application").insert({
        id, chapitre_id: chapitreId, enonce_modele: enonce.trim(),
        reponse_modele: reponse.trim(), parametres, niveau, prof_id: currentUser.id,
      });
      setEnregistrement(false);
      if (error) { alert("Erreur : " + error.message); return; }
    }
    onCree();
  }

  return (
    <div className="creer-overlay" onClick={e => e.target === e.currentTarget && onFermer()}>
      <div className="creer-card">
        <div className="creer-title">➕ Créer une question</div>
        <div className="creer-mode-tabs">
          <button className={`creer-mode-tab${mode === "fixe" ? " active" : ""}`} onClick={() => setMode("fixe")}>📝 Question fixe</button>
          <button className={`creer-mode-tab${mode === "aleatoire" ? " active" : ""}`} onClick={() => setMode("aleatoire")}>🎲 Question aléatoire</button>
        </div>
        <div className="creer-body">
          <div className="creer-field">
            <label>Chapitre</label>
            <select value={chapitreId} onChange={e => setChapitreId(e.target.value)}>
              {chapitres.map(ch => <option key={ch.id} value={ch.id}>{ch.nom}</option>)}
            </select>
          </div>
          {mode === "fixe" && (
            <div className="creer-field">
              <label>Type</label>
              <select value={type} onChange={e => setType(e.target.value)} style={{ width: 180 }}>
                {["formule", "méthode", "définition", "théorème"].map(t =>
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                )}
              </select>
            </div>
          )}
          <div className="creer-field">
            <label>Niveau</label>
            <select value={niveau} onChange={e => setNiveau(Number(e.target.value))} style={{ width: 140 }}>
              <option value={1}>Niveau 1</option>
              <option value={2}>Niveau 2</option>
              <option value={3}>Niveau 3</option>
            </select>
          </div>
          <div className="creer-field">
            <label>Énoncé {mode === "aleatoire" ? "modèle" : ""}</label>
            <textarea className="creer-textarea" value={enonce} onChange={e => setEnonce(e.target.value)}
              placeholder={mode === "aleatoire"
                ? "Ex : Résoudre $\\{a\\}x + \\{b\\} = 0$"
                : "Ex : Donner la définition d'une suite arithmétique."} />
            {mode === "aleatoire" && (
              <div className="creer-hint">
                Variable : <code>{"{a}"}</code> · Calcul : <code>{"{2a}"}</code> · Polynôme : <code>{"{poly(a:2, b:1, c:0)}"}</code>
              </div>
            )}
          </div>
          <div className="creer-field">
            <label>Réponse {mode === "aleatoire" ? "modèle" : ""}</label>
            <textarea className="creer-textarea" value={reponse} onChange={e => setReponse(e.target.value)}
              placeholder={mode === "aleatoire" ? "Ex : $x = {-b/a}$" : "Ex : Une suite arithmétique est..."} />
          </div>
          {mode === "aleatoire" && (
            <>
              <div className="creer-field">
                <label>Paramètres détectés</label>
                <div className="creer-params">
                  {params.length === 0 ? (
                    <div className="creer-params-empty">Écris l'énoncé avec des variables {"{a}"} pour les voir apparaître ici.</div>
                  ) : params.map((p, i) => (
                    <div key={p.nom} className="creer-param-row">
                      <span className="creer-param-name">{p.nom}</span>
                      <input type="number" className="creer-param-input" value={p.min} onChange={e => mettreAJourParam(i, "min", e.target.value)} />
                      <span className="creer-param-sep">à</span>
                      <input type="number" className="creer-param-input" value={p.max} onChange={e => mettreAJourParam(i, "max", e.target.value)} />
                      <select className="creer-param-type" value={p.type} onChange={e => mettreAJourParam(i, "type", e.target.value)}>
                        <option value="entier">Entier</option>
                        <option value="decimal">Décimal</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="creer-test">
                <div className="creer-test-header">
                  <span className="creer-test-label">Aperçu du tirage</span>
                  <button className="creer-test-btn" onClick={lancerTest} disabled={!enonce.trim() || !reponse.trim()}>🎲 Tirer un exemple</button>
                </div>
                {testErreur && <div className="creer-test-err">Erreur : {testErreur}</div>}
                {testResultat ? (
                  <div className="creer-test-result">
                    <MathText inline={false}>{testResultat.enonce}</MathText>
                    <div className="creer-test-reponse"><MathText inline={false}>{testResultat.reponse}</MathText></div>
                    <div className="creer-test-vals">Valeurs : {JSON.stringify(testResultat.valeurs)}</div>
                  </div>
                ) : !testErreur && <div className="creer-test-empty">Lance un tirage pour vérifier le rendu avant d'enregistrer.</div>}
              </div>
            </>
          )}
        </div>
        <div className="creer-actions">
          <button className="diapo-cancel-btn" onClick={onFermer}>Annuler</button>
          <button className="diapo-launch-btn" onClick={enregistrer}
            disabled={enregistrement || !enonce.trim() || !reponse.trim() || !chapitreId}>
            {enregistrement ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TirageAleatoire({ chapitres, onAnnuler, onTirer, niveauScolaire }) {
  const [chapitresChoisis, setChapitresChoisis] = useState(new Set());
  const [typesChoisis, setTypesChoisis] = useState(new Set(TYPES_TIRAGE));
  const [niveauxChoisis, setNiveauxChoisis] = useState(new Set(NIVEAUX_TIRAGE));
  const [nombre, setNombre] = useState(10);
  const [equilibrer, setEquilibrer] = useState(true);
  const [tirageEnCours, setTirageEnCours] = useState(false);
  const [avertissement, setAvertissement] = useState(null);

  function toggleChapitre(id) {
    setChapitresChoisis(prev => {
      const copie = new Set(prev);
      copie.has(id) ? copie.delete(id) : copie.add(id);
      return copie;
    });
  }
  function toggleType(t) {
    setTypesChoisis(prev => {
      const copie = new Set(prev);
      copie.has(t) ? copie.delete(t) : copie.add(t);
      return copie;
    });
  }
  function toggleNiveau(n) {
    setNiveauxChoisis(prev => {
      const copie = new Set(prev);
      copie.has(n) ? copie.delete(n) : copie.add(n);
      return copie;
    });
  }
  function toutSelectionner() {
    setChapitresChoisis(new Set(chapitres.map(c => c.id)));
  }
  function toutDeselectionner() {
    setChapitresChoisis(new Set());
  }

  async function lancerTirage() {
    if (chapitresChoisis.size === 0 || typesChoisis.size === 0 || niveauxChoisis.size === 0) return;
    setTirageEnCours(true);
    setAvertissement(null);

    const { data: candidates } = await supabase.from("questions").select("*")
      .in("chapitre_id", [...chapitresChoisis])
      .in("type", [...typesChoisis])
      .in("niveau", [...niveauxChoisis]);

    let pool = candidates || [];

    // Inclure les exercices d'application correspondant aux critères : comme
    // ils n'ont pas d'énoncé figé en base, on les tire réellement maintenant
    // et on les ajoute au pool comme des questions classiques déjà résolues.
    if (typesChoisis.has("exercice")) {
      const chapitresParId = {};
      chapitres.forEach(c => { chapitresParId[c.id] = c.nom; });

      [...chapitresChoisis].forEach(chId => {
        const nomChap = chapitresParId[chId];
        const niveau = niveauScolaire || "terminale_spe";
        Object.entries(BIBLIOTHEQUE_EXERCICES)
          .filter(([, def]) => def.chapitre === nomChap
            && def.niveauScolaire === niveau
            && niveauxChoisis.has(def.niveau))
          .forEach(([id, def]) => {
            const tirage = def.generer();
            pool.push({
              id, chapitre_id: chId, type: "exercice", niveau: def.niveau,
              enonce: tirage.enonce, reponse: tirage.reponse,
            });
          });
      });
    }

    let resultat = [];

    if (equilibrer) {
      // Répartit le nombre demandé à peu près équitablement entre les chapitres choisis
      const parChapitre = {};
      pool.forEach(q => {
        (parChapitre[q.chapitre_id] = parChapitre[q.chapitre_id] || []).push(q);
      });
      const chapitresAvecQuestions = Object.keys(parChapitre);
      const quotaParChapitre = Math.ceil(nombre / chapitresAvecQuestions.length);

      chapitresAvecQuestions.forEach(chId => {
        const tirees = melanger(parChapitre[chId]).slice(0, quotaParChapitre);
        resultat.push(...tirees);
      });
      resultat = melanger(resultat).slice(0, nombre);
    } else {
      resultat = melanger(pool).slice(0, nombre);
    }

    if (resultat.length < nombre) {
      setAvertissement(`Seulement ${resultat.length} question${resultat.length !== 1 ? "s" : ""} trouvée${resultat.length !== 1 ? "s" : ""} sur ${nombre} demandée${nombre !== 1 ? "s" : ""} selon ces critères.`);
    }

    setTirageEnCours(false);
    onTirer(resultat);
  }

  const chapitresTries = [...chapitres].sort((a, b) => a.ordre - b.ordre);

  return (
    <div className="random-overlay" onClick={e => e.target === e.currentTarget && onAnnuler()}>
      <div className="random-card">
        <div className="random-title">🎲 Tirage aléatoire</div>
        <div className="random-sub">Compose automatiquement une sélection selon tes critères. Remplace la sélection actuelle.</div>

        <div className="random-body">
          <div>
            <div className="random-section-label">
              Chapitres
              <span style={{ marginLeft: 8, fontWeight: 400, textTransform: "none" }}>
                <a href="#" onClick={e => { e.preventDefault(); toutSelectionner(); }} style={{ color: "var(--accent-light)" }}>Tout cocher</a>
                {" · "}
                <a href="#" onClick={e => { e.preventDefault(); toutDeselectionner(); }} style={{ color: "var(--accent-light)" }}>Tout décocher</a>
              </span>
            </div>
            <div className="random-chapitres-grid">
              {chapitresTries.map(ch => (
                <label key={ch.id} className="random-chapitre-item">
                  <input type="checkbox" checked={chapitresChoisis.has(ch.id)} onChange={() => toggleChapitre(ch.id)} />
                  {ch.nom}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="random-section-label">Type de question</div>
            <div className="random-chips-row">
              {TYPES_TIRAGE.map(t => (
                <button key={t} className={`random-chip${typesChoisis.has(t) ? " active" : ""}`} onClick={() => toggleType(t)}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="random-section-label">Niveau</div>
            <div className="random-chips-row">
              {NIVEAUX_TIRAGE.map(n => (
                <button key={n} className={`random-chip${niveauxChoisis.has(n) ? " active" : ""}`} onClick={() => toggleNiveau(n)}>Niveau {n}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="random-section-label">Nombre de questions</div>
            <div className="random-nb-row">
              <input type="number" className="random-nb-input" min={1} max={200} value={nombre}
                onChange={e => setNombre(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          <div>
            <label className="random-checkbox-row">
              <input type="checkbox" checked={equilibrer} onChange={() => setEquilibrer(e => !e)} />
              Équilibrer entre chapitres
            </label>
            <div className="random-checkbox-desc">Répartit le nombre de questions à peu près équitablement entre les chapitres cochés.</div>
          </div>

          {avertissement && <div className="random-warning">⚠️ {avertissement}</div>}
        </div>

        <div className="random-actions">
          <button className="diapo-cancel-btn" onClick={onAnnuler}>Annuler</button>
          <button className="diapo-launch-btn" onClick={lancerTirage}
            disabled={tirageEnCours || chapitresChoisis.size === 0 || typesChoisis.size === 0 || niveauxChoisis.size === 0}>
            {tirageEnCours ? "Tirage en cours…" : "🎲 Tirer les questions"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant GenerateurZone ──────────────────────────────────────────
function GenerateurZone({ currentUser, currentProfile, sessionARecharger, onSessionChargee, niveauScolaire }) {
  const [chapitres, setChapitres] = useState([]);
  const [questionsParChapitre, setQuestionsParChapitre] = useState({}); // { chapitre_id: [questions] }
  const [exercicesEnBase, setExercicesEnBase] = useState([]);           // exercices_application chargés depuis Supabase
  const [chapitresOuverts, setChapitresOuverts] = useState({});        // { chapitre_id: bool }
  const [chargementChapitre, setChargementChapitre] = useState({});    // { chapitre_id: bool }
  const [questionsDetail, setQuestionsDetail] = useState({});          // { question_id: bool } détail ouvert
  const [reponsesVisibles, setReponsesVisibles] = useState({});        // { question_id: bool } réponse révélée (masquée par défaut)
  const [selection, setSelection] = useState([]);                       // [question objects, dans l'ordre de sélection]
  const [elementsCoches, setElementsCoches] = useState(new Set());      // ids cochés dans la colonne de droite pour suppression groupée
  const [tiragesExercices, setTiragesExercices] = useState({});         // { id_exercice: {enonce, reponse, valeurs} } - dernier tirage affiché
  const [detailExerciceOuvert, setDetailExerciceOuvert] = useState({}); // { id_exercice: bool }
  const TYPES_DISPONIBLES = ["formule", "méthode", "définition", "théorème", "exercice"];
  const NIVEAUX_DISPONIBLES = [1, 2, 3];
  const [typesActifs, setTypesActifs] = useState(new Set(TYPES_DISPONIBLES));
  const [niveauxActifs, setNiveauxActifs] = useState(new Set(NIVEAUX_DISPONIBLES));

  function toggleTypeFiltre(type) {
    setTypesActifs(prev => {
      const copie = new Set(prev);
      copie.has(type) ? copie.delete(type) : copie.add(type);
      return copie;
    });
  }

  function toggleNiveauFiltre(niveau) {
    setNiveauxActifs(prev => {
      const copie = new Set(prev);
      copie.has(niveau) ? copie.delete(niveau) : copie.add(niveau);
      return copie;
    });
  }

  function questionVisible(q) {
    return typesActifs.has(q.type) && niveauxActifs.has(q.niveau);
  }
  const [afficherReglagesDiapo, setAfficherReglagesDiapo] = useState(false);
  const [diapoActive, setDiapoActive] = useState(null); // { mode, delai } ou null
  const [afficherImport, setAfficherImport] = useState(false);
  const [afficherTirage, setAfficherTirage] = useState(false);
  const [afficherCreerQuestion, setAfficherCreerQuestion] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [overZone, setOverZone] = useState(null); // "top" | "middle" | "bottom"
  const [loading, setLoading] = useState(true);
  const [questionEnEdition, setQuestionEnEdition] = useState(null); // id de la question en cours d'édition
  const [brouillonEdition, setBrouillonEdition] = useState(null);    // { type, enonce, reponse, niveau }
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);

  // Charger la liste des chapitres et les exercices depuis la base au changement de niveau
  useEffect(() => {
    setLoading(true);
    setChapitres([]);
    setChapitresOuverts({});
    setQuestionsParChapitre({});
    setExercicesEnBase([]);
    setSelection([]);
    const niveau = niveauScolaire || "terminale_spe";
    supabase.from("chapitres").select("*")
      .eq("niveau_scolaire", niveau)
      .order("ordre")
      .then(({ data }) => {
        const chaps = data || [];
        setChapitres(chaps);
        // Charger les exercices_application associés à ces chapitres
        if (chaps.length > 0) {
          supabase.from("exercices_application")
            .select("*")
            .in("chapitre_id", chaps.map(c => c.id))
            .then(({ data: exos }) => {
              setExercicesEnBase(exos || []);
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      });
  }, [niveauScolaire]);

  // Recharger une sélection depuis l'historique (clic sur "Rejouer" dans l'onglet Historique)
  useEffect(() => {
    if (!sessionARecharger) return;

    // Sépare les ids qui appartiennent à la banque de questions classiques
    // de ceux qui sont des exercices d'application (présents dans la
    // bibliothèque codée, jamais dans la table "questions")
    const idsExercices = sessionARecharger.filter(id => BIBLIOTHEQUE_EXERCICES[id]);
    const idsQuestions = sessionARecharger.filter(id => !BIBLIOTHEQUE_EXERCICES[id]);

    supabase.from("questions").select("*").in("id", idsQuestions.length ? idsQuestions : ["__aucun__"]).then(({ data }) => {
      const parId = {};
      (data || []).forEach(q => { parId[q.id] = q; });

      // Pour les exercices, on retire un nouveau tirage : la session ne
      // mémorise que le modèle, pas les valeurs figées d'origine.
      idsExercices.forEach(id => {
        const def = BIBLIOTHEQUE_EXERCICES[id];
        const chapitreCorrespondant = chapitres.find(c => c.nom === def.chapitre);
        const tirage = def.generer();
        parId[id] = {
          id, chapitre_id: chapitreCorrespondant?.id, type: "exercice", niveau: def.niveau,
          enonce: tirage.enonce, reponse: tirage.reponse,
        };
      });

      // Respecte l'ordre d'origine de la session, pas l'ordre renvoyé par Supabase
      const ordonnee = sessionARecharger.map(id => parId[id]).filter(Boolean);
      setSelection(ordonnee);
      onSessionChargee();
    });
  }, [sessionARecharger]);

  async function toggleChapitre(chapitreId) {
    const estOuvert = chapitresOuverts[chapitreId];
    setChapitresOuverts(prev => ({ ...prev, [chapitreId]: !estOuvert }));

    // Charger les questions de ce chapitre si pas déjà fait
    if (!estOuvert && !questionsParChapitre[chapitreId]) {
      setChargementChapitre(prev => ({ ...prev, [chapitreId]: true }));
      const { data } = await supabase.from("questions").select("*").eq("chapitre_id", chapitreId).order("id");
      setQuestionsParChapitre(prev => ({ ...prev, [chapitreId]: data || [] }));
      setChargementChapitre(prev => ({ ...prev, [chapitreId]: false }));
    }
  }

  function toggleDetailQuestion(questionId) {
    setQuestionsDetail(prev => {
      const ouvert = !prev[questionId];
      // En refermant le détail, on masque aussi la réponse (sécurité : ne jamais la laisser
      // révélée par accident la prochaine fois que ce détail s'ouvre)
      if (!ouvert) setReponsesVisibles(r => ({ ...r, [questionId]: false }));
      return { ...prev, [questionId]: ouvert };
    });
  }

  function toggleReponseVisible(questionId) {
    setReponsesVisibles(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  async function supprimerQuestion(question) {
    const confirme = window.confirm(
      `Supprimer définitivement cette question de la banque commune ?\n\n"${question.enonce.slice(0, 80)}${question.enonce.length > 80 ? "…" : ""}"\n\nCette action est irréversible.`
    );
    if (!confirme) return;

    const { error } = await supabase.from("questions").delete().eq("id", question.id);
    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
      return;
    }

    // Retirer la question de l'état local : liste du chapitre + sélection éventuelle
    setQuestionsParChapitre(prev => ({
      ...prev,
      [question.chapitre_id]: (prev[question.chapitre_id] || []).filter(q => q.id !== question.id),
    }));
    setSelection(prev => prev.filter(q => q.id !== question.id));
  }

  function commencerEdition(question) {
    setQuestionEnEdition(question.id);
    setBrouillonEdition({
      type: question.type,
      enonce: question.enonce,
      reponse: question.reponse,
      niveau: question.niveau,
    });
    // S'assurer que la réponse est visible pendant l'édition, plus pratique pour corriger
    setReponsesVisibles(prev => ({ ...prev, [question.id]: true }));
  }

  function annulerEdition() {
    setQuestionEnEdition(null);
    setBrouillonEdition(null);
  }

  async function enregistrerEdition(question) {
    if (!brouillonEdition?.enonce?.trim() || !brouillonEdition?.reponse?.trim()) return;
    setSauvegardeEnCours(true);

    const { error } = await supabase.from("questions").update({
      type: brouillonEdition.type,
      enonce: brouillonEdition.enonce.trim(),
      reponse: brouillonEdition.reponse.trim(),
      niveau: Number(brouillonEdition.niveau) || question.niveau,
    }).eq("id", question.id);

    setSauvegardeEnCours(false);
    if (error) {
      alert("Erreur lors de l'enregistrement : " + error.message);
      return;
    }

    // Mettre à jour l'état local (liste du chapitre + sélection éventuelle)
    const questionMaj = { ...question, ...brouillonEdition, niveau: Number(brouillonEdition.niveau) || question.niveau };
    setQuestionsParChapitre(prev => ({
      ...prev,
      [question.chapitre_id]: (prev[question.chapitre_id] || []).map(q => q.id === question.id ? questionMaj : q),
    }));
    setSelection(prev => prev.map(q => q.id === question.id ? questionMaj : q));
    setQuestionEnEdition(null);
    setBrouillonEdition(null);
  }


  function estSelectionnee(questionId) {
    return selection.some(q => q.id === questionId);
  }

  function toggleSelection(question) {
    setSelection(prev =>
      prev.some(q => q.id === question.id)
        ? prev.filter(q => q.id !== question.id)
        : [...prev, question]
    );
  }

  function retirerSelection(questionId) {
    setSelection(prev => prev.filter(q => q.id !== questionId));
    setElementsCoches(prev => { const c = new Set(prev); c.delete(questionId); return c; });
  }

  function toutRetirer() {
    if (selection.length === 0) return;
    const confirme = window.confirm(`Retirer les ${selection.length} question${selection.length !== 1 ? "s" : ""} de la sélection ?`);
    if (!confirme) return;
    setSelection([]);
    setElementsCoches(new Set());
  }

  function toggleCocheElement(id) {
    setElementsCoches(prev => {
      const c = new Set(prev);
      c.has(id) ? c.delete(id) : c.add(id);
      return c;
    });
  }

  function retirerElementsCoches() {
    setSelection(prev => prev.filter(q => !elementsCoches.has(q.id)));
    setElementsCoches(new Set());
  }

  function deplacerSelection(indexDepart, indexArrivee) {
    setSelection(prev => {
      const copie = [...prev];
      const [item] = copie.splice(indexDepart, 1);
      copie.splice(indexArrivee, 0, item);
      return copie;
    });
  }

  function intervertirSelection(indexA, indexB) {
    setSelection(prev => {
      const copie = [...prev];
      [copie[indexA], copie[indexB]] = [copie[indexB], copie[indexA]];
      return copie;
    });
  }

  function nomChapitre(chapitreId) {
    return chapitres.find(c => c.id === chapitreId)?.nom || "";
  }

  // ── Exercices d'application (bibliothèque codée sur mesure) ──
  function exercicesDuChapitre(chapitreNom) {
    if (!typesActifs.has("exercice")) return [];
    const niveau = niveauScolaire || "terminale_spe";

    // Exercices codés en dur dans la bibliothèque
    const bibliotheque = Object.entries(BIBLIOTHEQUE_EXERCICES)
      .filter(([, def]) => def.chapitre === chapitreNom
        && def.niveauScolaire === niveau
        && niveauxActifs.has(def.niveau))
      .map(([id, def]) => ({ id, titre: def.titre, niveau: def.niveau, source: "bibliotheque" }));

    // Exercices créés via le formulaire et stockés en base
    const chapitreObj = chapitres.find(c => c.nom === chapitreNom);
    const enBase = chapitreObj
      ? exercicesEnBase
          .filter(ex => ex.chapitre_id === chapitreObj.id && niveauxActifs.has(ex.niveau))
          .map(ex => ({ id: ex.id, titre: ex.enonce_modele.slice(0, 60) + "…", niveau: ex.niveau, source: "base", data: ex }))
      : [];

    return [...bibliotheque, ...enBase];
  }

  function toggleDetailExercice(id) {
    setDetailExerciceOuvert(prev => ({ ...prev, [id]: !prev[id] }));
    // Tire un premier aperçu dès l'ouverture du détail, s'il n'y en a pas déjà un
    if (!detailExerciceOuvert[id] && !tiragesExercices[id]) {
      retirerAuSort(id);
    }
  }

  function retirerAuSort(idExercice) {
    // Source bibliothèque (codé en dur)
    const def = BIBLIOTHEQUE_EXERCICES[idExercice];
    if (def) {
      const tirage = def.generer();
      setTiragesExercices(prev => ({ ...prev, [idExercice]: tirage }));
      setSelection(prev => prev.map(q =>
        q.id === idExercice ? { ...q, enonce: tirage.enonce, reponse: tirage.reponse } : q
      ));
      return;
    }
    // Source base de données (créé via formulaire)
    const exoBase = exercicesEnBase.find(e => e.id === idExercice);
    if (exoBase) {
      const valeurs = {};
      Object.entries(exoBase.parametres).forEach(([nom, d]) => { valeurs[nom] = tirerValeurParametre(d); });
      const tirage = {
        enonce: substituerPlaceholders(exoBase.enonce_modele, valeurs),
        reponse: substituerPlaceholders(exoBase.reponse_modele, valeurs),
        valeurs,
      };
      setTiragesExercices(prev => ({ ...prev, [idExercice]: tirage }));
      setSelection(prev => prev.map(q =>
        q.id === idExercice ? { ...q, enonce: tirage.enonce, reponse: tirage.reponse } : q
      ));
    }
  }

  function estExerciceSelectionne(idExercice) {
    return selection.some(q => q.id === idExercice);
  }

  function toggleSelectionExercice(idExercice, chapitreId, niveau) {
    if (estExerciceSelectionne(idExercice)) {
      setSelection(prev => prev.filter(q => q.id !== idExercice));
      return;
    }

    // Source bibliothèque
    const def = BIBLIOTHEQUE_EXERCICES[idExercice];
    if (def) {
      const tirage = tiragesExercices[idExercice] || def.generer();
      if (!tiragesExercices[idExercice]) setTiragesExercices(prev => ({ ...prev, [idExercice]: tirage }));
      setSelection(prev => [...prev, { id: idExercice, chapitre_id: chapitreId, type: "exercice", enonce: tirage.enonce, reponse: tirage.reponse, niveau }]);
      return;
    }

    // Source base de données
    const exoBase = exercicesEnBase.find(e => e.id === idExercice);
    if (exoBase) {
      let tirage = tiragesExercices[idExercice];
      if (!tirage) {
        const valeurs = {};
        Object.entries(exoBase.parametres).forEach(([nom, d]) => { valeurs[nom] = tirerValeurParametre(d); });
        tirage = {
          enonce: substituerPlaceholders(exoBase.enonce_modele, valeurs),
          reponse: substituerPlaceholders(exoBase.reponse_modele, valeurs),
          valeurs,
        };
        setTiragesExercices(prev => ({ ...prev, [idExercice]: tirage }));
      }
      setSelection(prev => [...prev, { id: idExercice, chapitre_id: chapitreId, type: "exercice", enonce: tirage.enonce, reponse: tirage.reponse, niveau }]);
    }
  }

  // ── Export .tex ──
  function genererTex(avecCorrige) {
    const lignes = [];
    lignes.push("\\documentclass[12pt]{article}");
    lignes.push("\\usepackage[utf8]{inputenc}");
    lignes.push("\\usepackage[T1]{fontenc}");
    lignes.push("\\usepackage[french]{babel}");
    lignes.push("\\usepackage{amsmath,amssymb}");
    lignes.push("\\usepackage{tcolorbox}");
    lignes.push("\\usepackage{fancyhdr}");
    lignes.push("\\usepackage{forloop}");
    lignes.push("\\usepackage[margin=2cm]{geometry}");
    lignes.push("\\pagestyle{fancy}");
    lignes.push("\\fancyhf{}");
    lignes.push("\\lhead{Terminale Spé}");
    lignes.push("\\chead{Interrogation" + (avecCorrige ? " — Corrigé" : "") + "}");
    lignes.push("\\rhead{Durée : 30 min}");
    lignes.push("\\newcounter{qnum}");
    lignes.push("\\newcounter{linectr}");
    lignes.push("\\newcommand{\\reponse}[1]{");
    lignes.push("  \\setcounter{linectr}{0}");
    lignes.push("  \\forloop{linectr}{0}{\\value{linectr} < #1}{\\par\\vspace{4mm}\\hrulefill}");
    lignes.push("}");
    lignes.push("\\begin{document}");
    lignes.push("");

    selection.forEach((q, idx) => {
      lignes.push(`\\stepcounter{qnum}`);
      lignes.push(`\\noindent\\textbf{Question \\theqnum.} ${q.enonce}`);
      lignes.push("");
      if (avecCorrige) {
        lignes.push("\\begin{tcolorbox}[colback=gray!10]");
        lignes.push(q.reponse);
        lignes.push("\\end{tcolorbox}");
      } else {
        lignes.push("\\reponse{3}");
      }
      lignes.push("");
      lignes.push("\\vspace{6mm}");
      lignes.push("");
    });

    lignes.push("\\end{document}");
    return lignes.join("\n");
  }

  // Calcule une signature stable pour un ensemble de questions, peu importe l'ordre
  function calculerSignature(questionsSelection) {
    return questionsSelection.map(q => q.id).slice().sort().join(",");
  }

  // Génère le nom auto : chapitres (max 2, "+N autres" sinon) · date · nombre de questions
  function genererNomSession(questionsSelection) {
    const chapitresUniques = [...new Set(questionsSelection.map(q => nomChapitre(q.chapitre_id)))];
    let partieChapitres;
    if (chapitresUniques.length <= 2) {
      partieChapitres = chapitresUniques.join(", ");
    } else {
      partieChapitres = `${chapitresUniques.slice(0, 2).join(", ")} +${chapitresUniques.length - 2} autre${chapitresUniques.length - 2 > 1 ? "s" : ""}`;
    }
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${partieChapitres} · ${dateStr} · ${questionsSelection.length} question${questionsSelection.length !== 1 ? "s" : ""}`;
  }

  // Sauvegarde (ou met à jour) la sélection actuelle dans l'historique.
  // Une sélection avec la même signature (mêmes questions, peu importe l'ordre)
  // pour ce prof met à jour l'entrée existante plutôt que d'en créer une nouvelle.
  async function sauvegarderDansHistorique(action) {
    if (selection.length === 0) return;
    const signature = calculerSignature(selection);

    const { data: existante } = await supabase.from("sessions_historique")
      .select("id").eq("prof_id", currentUser.id).eq("signature", signature).maybeSingle();

    if (existante) {
      await supabase.from("sessions_historique").update({
        question_ids: selection.map(q => q.id),
        derniere_action: action,
        updated_at: new Date().toISOString(),
      }).eq("id", existante.id);
    } else {
      await supabase.from("sessions_historique").insert({
        prof_id: currentUser.id,
        nom: genererNomSession(selection),
        question_ids: selection.map(q => q.id),
        signature,
        derniere_action: action,
      });
    }
  }

  function telechargerTex(avecCorrige) {
    const contenu = genererTex(avecCorrige);
    const blob = new Blob([contenu], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `interro_${date}${avecCorrige ? "_corrige" : "_eleve"}.tex`;
    a.click();
    URL.revokeObjectURL(url);
    sauvegarderDansHistorique(avecCorrige ? "tex_corrige" : "tex_eleve");
  }

  // Nettoie une question pour l'export : retire les champs internes à la base
  // (chapitre_id, prof_id, created_at) et remet le nom de chapitre en texte,
  // exactement le format attendu pour un futur réimport.
  function questionVersJson(q, nomCh) {
    return {
      id: q.id,
      chapitre: nomCh,
      type: q.type,
      enonce: q.enonce,
      reponse: q.reponse,
      niveau: q.niveau,
    };
  }

  function telechargerJson(contenu, nomFichier) {
    const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exporterChapitre(ch) {
    // Réutilise le cache si déjà chargé, sinon recharge depuis Supabase
    let questions = questionsParChapitre[ch.id];
    if (!questions) {
      const { data } = await supabase.from("questions").select("*").eq("chapitre_id", ch.id).order("id");
      questions = data || [];
    }
    const contenu = questions.map(q => questionVersJson(q, ch.nom));
    const slug = ch.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_");
    telechargerJson(contenu, `questions_${slug}.json`);
  }

  async function exporterToutLaBanque() {
    const { data } = await supabase.from("questions").select("*").order("chapitre_id").order("id");
    const chapitresParId = {};
    chapitres.forEach(c => { chapitresParId[c.id] = c.nom; });
    const contenu = (data || []).map(q => questionVersJson(q, chapitresParId[q.chapitre_id] || "?"));
    const date = new Date().toISOString().slice(0, 10);
    telechargerJson(contenu, `banque_questions_complete_${date}.json`);
  }

  if (loading) {
    return <div className="generateur-area"><div className="gen-selection-empty">Chargement des chapitres…</div></div>;
  }

  return (
    <div className="generateur-area">
      <div className="gen-chapitres-col">
        <div className="gen-import-bar">
          <div className="gen-import-bar-row">
            <button className="gen-import-btn" onClick={() => setAfficherImport(true)}>
              📂 Importer
            </button>
            <button className="gen-export-all-btn" onClick={exporterToutLaBanque}>
              ⬇️ Tout exporter
            </button>
          </div>
          <button className="gen-random-btn" onClick={() => setAfficherTirage(true)}>
            🎲 Tirage aléatoire
          </button>
          <button className="creer-btn" onClick={() => setAfficherCreerQuestion(true)}>
            ➕ Créer une question
          </button>
        </div>

        <div className="gen-filters-bar">
          <div className="gen-filters-row">
            <span className="gen-filters-label">Type de question</span>
            {TYPES_DISPONIBLES.map(type => (
              <button key={type} className={`gen-filter-chip${typesActifs.has(type) ? " active" : ""}`}
                onClick={() => toggleTypeFiltre(type)}>
                {type}
              </button>
            ))}
          </div>
          <div className="gen-filters-row">
            <span className="gen-filters-label">Niveau</span>
            {NIVEAUX_DISPONIBLES.map(niveau => (
              <button key={niveau} className={`gen-filter-chip${niveauxActifs.has(niveau) ? " active" : ""}`}
                onClick={() => toggleNiveauFiltre(niveau)}>
                Niveau {niveau}
              </button>
            ))}
            {(typesActifs.size < TYPES_DISPONIBLES.length || niveauxActifs.size < NIVEAUX_DISPONIBLES.length) && (
              <button className="gen-filter-reset" onClick={() => {
                setTypesActifs(new Set(TYPES_DISPONIBLES));
                setNiveauxActifs(new Set(NIVEAUX_DISPONIBLES));
              }}>
                Réinitialiser
              </button>
            )}
          </div>
        </div>
        {chapitres.map(ch => {
          const ouvert = chapitresOuverts[ch.id];
          const questions = questionsParChapitre[ch.id] || [];
          const questionsFiltrees = questions.filter(questionVisible);
          const nbMasquees = questions.length - questionsFiltrees.length;
          const nbExercicesSelectionnes = exercicesDuChapitre(ch.nom).filter(ex => estExerciceSelectionne(ex.id)).length;
          const nbSelectionnees = questions.filter(q => estSelectionnee(q.id)).length + nbExercicesSelectionnes;
          return (
            <div key={ch.id} className="gen-chapitre-block">
              <div className="gen-chapitre-row" onClick={() => toggleChapitre(ch.id)}>
                <span className={`gen-chevron${ouvert ? " open" : ""}`}>▶</span>
                <span className="gen-chapitre-nom">{ch.nom}</span>
                {nbSelectionnees > 0 && <span className="gen-chapitre-count">{nbSelectionnees} sélectionnée{nbSelectionnees > 1 ? "s" : ""}</span>}
                {ouvert && nbMasquees > 0 && (
                  <span className="gen-chapitre-count" style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>
                    {nbMasquees} masquée{nbMasquees > 1 ? "s" : ""}
                  </span>
                )}
                {ouvert && questions.length > 0 && (
                  <button className="gen-chapitre-export-btn" title="Exporter ce chapitre en JSON"
                    onClick={e => { e.stopPropagation(); exporterChapitre(ch); }}>
                    ⬇️
                  </button>
                )}
              </div>
              {ouvert && (
                <div className="gen-questions-list">
                  {chargementChapitre[ch.id] && (
                    <div className="gen-empty-chapitre">Chargement…</div>
                  )}
                  {!chargementChapitre[ch.id] && questions.length === 0 && (
                    <div className="gen-empty-chapitre">Aucune question dans ce chapitre pour l'instant.</div>
                  )}
                  {!chargementChapitre[ch.id] && questions.length > 0 && questionsFiltrees.length === 0 && (
                    <div className="gen-empty-chapitre">Aucune question ne correspond aux filtres actifs.</div>
                  )}
                  {questionsFiltrees.map(q => (
                    <div key={q.id}>
                      <div className="gen-question-row">
                        <input type="checkbox" checked={estSelectionnee(q.id)}
                          onChange={() => toggleSelection(q)} onClick={e => e.stopPropagation()} />
                        <div className="gen-question-summary" onClick={() => toggleDetailQuestion(q.id)}>
                          <div className="gen-question-type">{q.type} · niveau {q.niveau} · <span className="gen-question-id">{q.id}</span></div>
                          <div className="gen-question-apercu"><MathText>{q.enonce}</MathText></div>
                        </div>
                      </div>
                      {questionsDetail[q.id] && (
                        <div className="gen-question-detail">
                          {questionEnEdition === q.id ? (
                            <div className="gen-edit-form">
                              <div className="gen-edit-row">
                                <div className="gen-edit-field" style={{ flex: "0 0 160px" }}>
                                  <label>Type</label>
                                  <select value={brouillonEdition.type}
                                    onChange={e => setBrouillonEdition(prev => ({ ...prev, type: e.target.value }))}>
                                    <option value="formule">Formule</option>
                                    <option value="méthode">Méthode</option>
                                    <option value="définition">Définition</option>
                                    <option value="théorème">Théorème</option>
                                  </select>
                                </div>
                                <div className="gen-edit-field" style={{ flex: "0 0 100px" }}>
                                  <label>Niveau</label>
                                  <input type="number" min={1} max={3} value={brouillonEdition.niveau}
                                    onChange={e => setBrouillonEdition(prev => ({ ...prev, niveau: e.target.value }))} />
                                </div>
                              </div>
                              <div className="gen-edit-field">
                                <label>Énoncé</label>
                                <textarea className="gen-edit-textarea" value={brouillonEdition.enonce}
                                  onChange={e => setBrouillonEdition(prev => ({ ...prev, enonce: e.target.value }))} />
                              </div>
                              <div className="gen-edit-field">
                                <label>Réponse</label>
                                <textarea className="gen-edit-textarea" value={brouillonEdition.reponse}
                                  onChange={e => setBrouillonEdition(prev => ({ ...prev, reponse: e.target.value }))} />
                              </div>
                              <div className="gen-edit-actions">
                                <button className="gen-edit-cancel-btn" onClick={annulerEdition}>Annuler</button>
                                <button className="gen-edit-save-btn" onClick={() => enregistrerEdition(q)}
                                  disabled={sauvegardeEnCours || !brouillonEdition.enonce?.trim() || !brouillonEdition.reponse?.trim()}>
                                  {sauvegardeEnCours ? "Enregistrement…" : "Enregistrer"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="gen-question-detail-label">Énoncé</div>
                              <MathText inline={false}>{q.enonce}</MathText>
                              <div className="gen-question-detail-reponse">
                                {reponsesVisibles[q.id] ? (
                                  <>
                                    <div className="gen-question-detail-reponse-header">
                                      <div className="gen-question-detail-label">Réponse</div>
                                      <button className="gen-hide-btn" onClick={() => toggleReponseVisible(q.id)}>
                                        🙈 Masquer
                                      </button>
                                    </div>
                                    <MathText inline={false}>{q.reponse}</MathText>
                                  </>
                                ) : (
                                  <button className="gen-reveal-btn" onClick={() => toggleReponseVisible(q.id)}>
                                    👁️ Révéler la réponse
                                  </button>
                                )}
                              </div>
                              {q.prof_id === currentUser.id && (
                                <div className="gen-question-detail-footer">
                                  <button className="gen-edit-question-btn" onClick={() => commencerEdition(q)}>
                                    ✏️ Modifier
                                  </button>
                                  <button className="gen-delete-question-btn" onClick={() => supprimerQuestion(q)}>
                                    🗑️ Supprimer cette question
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {exercicesDuChapitre(ch.nom).map(ex => {
                    const tirage = tiragesExercices[ex.id];
                    return (
                      <div key={ex.id}>
                        <div className="gen-exercice-row">
                          <input type="checkbox" checked={estExerciceSelectionne(ex.id)}
                            onChange={() => toggleSelectionExercice(ex.id, ch.id, ex.niveau)}
                            onClick={e => e.stopPropagation()} />
                          <div className="gen-question-summary" onClick={() => toggleDetailExercice(ex.id)}>
                            <div className="gen-exercice-badge">🎲 Aléatoire · niveau {ex.niveau} · <span className="gen-question-id">{ex.id}</span></div>
                            <div className="gen-question-apercu">{ex.titre}</div>
                          </div>
                        </div>
                        {detailExerciceOuvert[ex.id] && tirage && (
                          <div className="gen-exercice-detail">
                            <div className="gen-question-detail-label">Exemple de tirage</div>
                            <MathText inline={false}>{tirage.enonce}</MathText>
                            <div className="gen-question-detail-reponse">
                              <div className="gen-question-detail-label">Réponse</div>
                              <MathText inline={false}>{tirage.reponse}</MathText>
                            </div>
                            <button className="gen-exercice-refresh-btn" onClick={() => retirerAuSort(ex.id)}>
                              🎲 Retirer au sort
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="gen-selection-col">
        <div className="gen-header">
          <div className="gen-header-row">
            <div>
              <div className="gen-header-title">Sélection pour l'interrogation</div>
              <div className="gen-header-sub">Coche des questions dans les chapitres à gauche pour les ajouter ici</div>
            </div>
            {selection.length > 0 && (
              <div className="gen-header-actions">
                {elementsCoches.size > 0 && (
                  <button className="gen-header-action-btn danger" onClick={retirerElementsCoches}>
                    Retirer la sélection ({elementsCoches.size})
                  </button>
                )}
                <button className="gen-header-action-btn danger" onClick={toutRetirer}>
                  🗑️ Tout retirer
                </button>
              </div>
            )}
          </div>
        </div>

        {selection.length === 0 ? (
          <div className="gen-selection-empty">
            <div style={{ fontSize: 32, opacity: .3 }}>📝</div>
            <div>Aucune question sélectionnée pour l'instant.</div>
          </div>
        ) : (
          <div className="gen-selection-list">
            {selection.map((q, idx) => (
              <div
                key={q.id}
                className={`gen-selected-item${dragIndex === idx ? " dragging" : ""}${overIndex === idx && dragIndex !== null && dragIndex !== idx ? ` drag-over-${overZone}` : ""}`}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragEnter={() => { if (dragIndex !== null && dragIndex !== idx) setOverIndex(idx); }}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null); setOverZone(null); }}
                onDragOver={e => {
                  e.preventDefault();
                  if (dragIndex === null || dragIndex === idx) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const positionY = e.clientY - rect.top;
                  const ratio = positionY / rect.height;
                  // Tiers supérieur/inférieur = insertion, tiers central = interversion
                  const zone = ratio < 0.3 ? "top" : ratio > 0.7 ? "bottom" : "middle";
                  setOverIndex(idx);
                  setOverZone(zone);
                }}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== idx) {
                    if (overZone === "middle") {
                      intervertirSelection(dragIndex, idx);
                    } else {
                      const indexArrivee = overZone === "top"
                        ? idx
                        : (dragIndex < idx ? idx : idx + 1);
                      deplacerSelection(dragIndex, indexArrivee);
                    }
                  }
                  setDragIndex(null); setOverIndex(null); setOverZone(null);
                }}
              >
                <span className="gen-drag-handle" title="Glisser pour réordonner">⠿</span>
                <input type="checkbox" className="gen-selected-checkbox" checked={elementsCoches.has(q.id)}
                  onChange={() => toggleCocheElement(q.id)} onClick={e => e.stopPropagation()} />
                <div className="gen-selected-num">{idx + 1}</div>
                <div className="gen-selected-content">
                  <div className="gen-selected-chapitre">{nomChapitre(q.chapitre_id)}</div>
                  <div className="gen-selected-enonce"><MathText>{q.enonce}</MathText></div>
                </div>
                <button className="gen-selected-remove" onClick={() => retirerSelection(q.id)} title="Retirer">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="gen-footer">
          <div className="gen-footer-count">
            <strong>{selection.length}</strong> question{selection.length !== 1 ? "s" : ""} sélectionnée{selection.length !== 1 ? "s" : ""}
          </div>
          <button className="gen-export-btn-secondary" onClick={() => telechargerTex(false)} disabled={selection.length === 0}>
            📝 .tex élève
          </button>
          <button className="gen-export-btn-secondary" onClick={() => telechargerTex(true)} disabled={selection.length === 0}>
            📝 .tex corrigé
          </button>
          <button className="gen-export-btn" onClick={() => setAfficherReglagesDiapo(true)} disabled={selection.length === 0}>
            ▶ Diaporama
          </button>
        </div>
      </div>

      {afficherReglagesDiapo && (
        <DiapoSettings
          nbQuestions={selection.length}
          onAnnuler={() => setAfficherReglagesDiapo(false)}
          onLancer={(reglages) => {
            setDiapoActive(reglages);
            setAfficherReglagesDiapo(false);
            sauvegarderDansHistorique("diaporama");
          }}
        />
      )}

      {diapoActive && (
        <DiapoViewer
          questions={selection}
          mode={diapoActive.mode}
          delai={diapoActive.delai}
          nomChapitre={nomChapitre}
          onFermer={() => setDiapoActive(null)}
        />
      )}

      {afficherImport && (
        <ImportQuestions
          currentUser={currentUser}
          currentProfile={currentProfile}
          chapitres={chapitres}
          onFermer={() => setAfficherImport(false)}
          onImportTermine={() => {
            // Force le rechargement des chapitres actuellement ouverts pour voir les nouvelles questions
            const ouverts = Object.keys(chapitresOuverts).filter(id => chapitresOuverts[id]);
            setQuestionsParChapitre(prev => {
              const copie = { ...prev };
              ouverts.forEach(id => delete copie[id]);
              return copie;
            });
            ouverts.forEach(id => {
              supabase.from("questions").select("*").eq("chapitre_id", id).order("id").then(({ data }) => {
                setQuestionsParChapitre(prev => ({ ...prev, [id]: data || [] }));
              });
            });
          }}
        />
      )}

      {afficherTirage && (
        <TirageAleatoire
          chapitres={chapitres}
          niveauScolaire={niveauScolaire}
          onAnnuler={() => setAfficherTirage(false)}
          onTirer={(resultat) => {
            setSelection(resultat);
            setAfficherTirage(false);
          }}
        />
      )}

      {afficherCreerQuestion && (
        <CreerQuestion
          chapitres={chapitres}
          currentUser={currentUser}
          niveauScolaire={niveauScolaire}
          onFermer={() => setAfficherCreerQuestion(false)}
          onCree={() => {
            setAfficherCreerQuestion(false);
            // Recharger les exercices depuis la base
            if (chapitres.length > 0) {
              supabase.from("exercices_application")
                .select("*")
                .in("chapitre_id", chapitres.map(c => c.id))
                .then(({ data }) => setExercicesEnBase(data || []));
            }
            setQuestionsParChapitre({});
            setChapitresOuverts({});
          }}
        />
      )}
    </div>
  );
}

// ─── Composant RessourcesZone ──────────────────────────────────────────
function RessourcesZone({ currentUser, currentProfile }) {
  const [ressources, setRessources] = useState([]);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [lien, setLien] = useState("");
  const [file, setFile] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef(null);

  const profId = currentProfile.role === "professeur" ? currentUser.id : currentProfile.prof_id;

  const fetchRessources = useCallback(async () => {
    if (!profId) return;
    const { data } = await supabase.from("ressources")
      .select("*").eq("prof_id", profId).order("created_at", { ascending: false });
    setRessources(data || []);
  }, [profId]);

  useEffect(() => { fetchRessources(); }, [fetchRessources]);

  useEffect(() => {
    if (!profId) return;
    const channel = supabase.channel(`ressources-${profId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ressources", filter: `prof_id=eq.${profId}` },
        () => fetchRessources())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profId, fetchRessources]);

  async function publier() {
    if (!titre.trim() && !contenu.trim() && !lien.trim() && !file) return;
    setPublishing(true);
    let fichierUrl = null, fichierNom = null, fichierType = null;

    if (file) {
      const path = `ressources/${currentUser.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("grand-oral").upload(path, file, { contentType: file.type });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("grand-oral").getPublicUrl(path);
        fichierUrl = publicUrl; fichierNom = file.name; fichierType = file.type;
      }
    }

    await supabase.from("ressources").insert({
      prof_id: currentUser.id,
      titre: titre.trim() || null,
      contenu: contenu.trim() || null,
      lien_url: lien.trim() || null,
      fichier_url: fichierUrl,
      fichier_nom: fichierNom,
      fichier_type: fichierType,
    });

    setTitre(""); setContenu(""); setLien(""); setFile(null); setPublishing(false);
    fetchRessources();
  }

  async function supprimer(id) {
    const ressource = ressources.find(r => r.id === id);

    // Si la ressource a un fichier joint, on le supprime réellement du
    // storage pour libérer l'espace (même bug que celui corrigé côté chat :
    // sans ça, le fichier restait orphelin malgré la suppression de la ligne)
    if (ressource?.fichier_url) {
      const marqueur = "/grand-oral/";
      const indexMarqueur = ressource.fichier_url.indexOf(marqueur);
      if (indexMarqueur !== -1) {
        const path = decodeURIComponent(ressource.fichier_url.slice(indexMarqueur + marqueur.length));
        const { error: erreurStorage } = await supabase.storage.from("grand-oral").remove([path]);
        if (erreurStorage) {
          alert("La ressource va être supprimée, mais le fichier n'a pas pu être effacé du stockage : " + erreurStorage.message);
        }
      }
    }

    await supabase.from("ressources").delete().eq("id", id);
    fetchRessources();
  }

  return (
    <div className="ressources-area">
      {ressources.length === 0 ? (
        <div className="ressources-empty">
          <div style={{ fontSize: 32, opacity: .3 }}>📚</div>
          <div>Aucune ressource publiée pour l'instant.</div>
        </div>
      ) : (
        <div className="ressources-list">
          {ressources.map(r => (
            <div key={r.id} className="ressource-card">
              {currentProfile.role === "professeur" && (
                <button className="ressource-delete" onClick={() => supprimer(r.id)} title="Supprimer">✕</button>
              )}
              {r.titre && <div className="ressource-titre">{r.titre}</div>}
              {r.contenu && <div className="ressource-contenu">{r.contenu}</div>}
              {r.lien_url && (
                <a className="ressource-lien" href={r.lien_url} target="_blank" rel="noreferrer">🔗 {r.lien_url}</a>
              )}
              {r.fichier_url && r.fichier_type?.startsWith("image") && (
                <a href={r.fichier_url} target="_blank" rel="noreferrer">
                  <img src={r.fichier_url} alt={r.fichier_nom} />
                </a>
              )}
              {r.fichier_url && !r.fichier_type?.startsWith("image") && (
                <a className="ressource-fichier" href={r.fichier_url} target="_blank" rel="noreferrer">
                  <span style={{ fontSize: 20 }}>{fileIcon(r.fichier_type)}</span>
                  <span style={{ fontSize: 13 }}>{r.fichier_nom}</span>
                </a>
              )}
              <div className="ressource-date">{formatDate(r.created_at)} à {formatTime(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {currentProfile.role === "professeur" && (
        <div className="publish-form">
          <div className="publish-row">
            <input className="publish-input" placeholder="Titre (optionnel)" value={titre}
              onChange={e => setTitre(e.target.value)} />
          </div>
          <div className="publish-row">
            <textarea className="publish-textarea" placeholder="Texte, consigne, idée de sujet…"
              value={contenu} onChange={e => setContenu(e.target.value)} />
          </div>
          <div className="publish-row">
            <input className="publish-input" placeholder="Lien (optionnel) — https://…" value={lien}
              onChange={e => setLien(e.target.value)} />
          </div>
          <div className="publish-actions">
            {!file ? (
              <label className="publish-attach-label">
                📎 Joindre un fichier
                <input ref={fileRef} type="file" style={{ display: "none" }}
                  onChange={e => setFile(e.target.files[0])} />
              </label>
            ) : (
              <div className="publish-file-chip">
                {fileIcon(file.type)} {file.name}
                <button onClick={() => setFile(null)}>✕</button>
              </div>
            )}
            <button className="publish-btn" onClick={publier}
              disabled={publishing || (!titre.trim() && !contenu.trim() && !lien.trim() && !file)}>
              {publishing ? "Publication…" : "Publier"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Composant ChatZone ─────────────────────────────────────────────────
function ChatZone({ eleveId, currentUser, currentProfile, allProfiles }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const textRef = useRef(null);

  const eleveProfile = allProfiles.find(p => p.id === eleveId);
  const targetEleveId = currentProfile?.role === "professeur" ? eleveId : currentUser?.id;

  const fetchMessages = useCallback(async () => {
    if (!targetEleveId) return;
    const { data } = await supabase.from("messages")
      .select("*").eq("eleve_id", targetEleveId).order("created_at", { ascending: true });
    setMessages(data || []);
    // Marquer comme lus si prof
    if (currentProfile?.role === "professeur" && data?.length) {
      await supabase.from("messages").update({ lu: true })
        .eq("eleve_id", targetEleveId).eq("lu", false).eq("sender_role", "eleve");
    }
  }, [targetEleveId, currentProfile]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime
  useEffect(() => {
    if (!targetEleveId) return;
    const channel = supabase.channel(`messages-${targetEleveId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `eleve_id=eq.${targetEleveId}`
      }, payload => {
        setMessages(prev => [...prev, payload.new]);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [targetEleveId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function saveSubject() {
    if (!subjectDraft.trim()) return;
    await supabase.from("profiles").update({ sujet: subjectDraft.trim() }).eq("id", targetEleveId);
    setEditingSubject(false);
    // Mettre à jour localement le profil affiché
    if (currentProfile?.role === "eleve") {
      currentProfile.sujet = subjectDraft.trim();
    }
  }

  async function send() {
    if (!text.trim() && !file) return;
    const isProf = currentProfile?.role === "professeur";
    let fichierUrl = null, fichierNom = null, fichierType = null;

    if (file) {
      setUploading(true); setUploadProgress(30);
      const path = `${targetEleveId}/${Date.now()}_${file.name}`;
      const { data: upData, error: upErr } = await supabase.storage
        .from("grand-oral").upload(path, file, { contentType: file.type });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("grand-oral").getPublicUrl(path);
        fichierUrl = publicUrl; fichierNom = file.name; fichierType = file.type;
      }
      setUploadProgress(100); setUploading(false); setFile(null);
    }

    await supabase.from("messages").insert({
      eleve_id: targetEleveId,
      sender_id: currentUser.id,
      sender_role: isProf ? "professeur" : "eleve",
      contenu: text.trim() || null,
      fichier_url: fichierUrl,
      fichier_nom: fichierNom,
      fichier_type: fichierType,
    });
    setText(""); setUploadProgress(0);
    textRef.current?.focus();
  }

  // Extrait le chemin de stockage à partir d'une URL publique Supabase
  function extrairePathStorage(url) {
    const marqueur = "/grand-oral/";
    const indexMarqueur = url.indexOf(marqueur);
    if (indexMarqueur === -1) return null;
    return decodeURIComponent(url.slice(indexMarqueur + marqueur.length));
  }

  async function supprimerMessage(msg) {
    const confirme = window.confirm("Supprimer ce message ? Cette action est irréversible.");
    if (!confirme) return;

    // Si le message a un fichier joint, on le supprime réellement du stockage
    // pour libérer l'espace (le message, lui, reste visible comme "supprimé")
    if (msg.fichier_url) {
      const path = extrairePathStorage(msg.fichier_url);
      if (path) {
        const { error: erreurStorage } = await supabase.storage.from("grand-oral").remove([path]);
        if (erreurStorage) {
          alert("Le message va être marqué supprimé, mais le fichier n'a pas pu être effacé du stockage : " + erreurStorage.message);
        }
      }
    }

    await supabase.from("messages").update({
      supprime: true,
      contenu: null,
      fichier_url: null,
      fichier_nom: null,
      fichier_type: null,
    }).eq("id", msg.id);

    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, supprime: true, contenu: null, fichier_url: null, fichier_nom: null, fichier_type: null } : m));
  }

  // Le prof retire uniquement le fichier d'un message de son élève (gestion
  // d'espace), sans toucher au texte éventuellement présent dans ce message
  async function supprimerFichierParProf(msg) {
    const confirme = window.confirm("Supprimer ce fichier pour libérer de l'espace ? Le texte du message, s'il y en a, sera conservé.");
    if (!confirme) return;

    const path = extrairePathStorage(msg.fichier_url);
    if (path) {
      const { error: erreurStorage } = await supabase.storage.from("grand-oral").remove([path]);
      if (erreurStorage) {
        alert("Le fichier n'a pas pu être effacé du stockage : " + erreurStorage.message);
        return;
      }
    }

    await supabase.from("messages").update({
      fichier_url: null,
      fichier_nom: null,
      fichier_type: null,
      fichier_supprime_par_prof: true,
    }).eq("id", msg.id);

    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, fichier_url: null, fichier_nom: null, fichier_type: null, fichier_supprime_par_prof: true } : m));
  }


  // Grouper par date
  const grouped = [];
  let lastDate = null;
  messages.forEach(msg => {
    const d = formatDate(msg.created_at);
    if (d !== lastDate) { grouped.push({ type: "date", label: d }); lastDate = d; }
    grouped.push({ type: "msg", msg });
  });

  if (!eleveId && currentProfile?.role === "professeur") {
    return (
      <div className="chat-area">
        <div className="chat-empty">
          <div className="chat-empty-icon">💬</div>
          <div className="chat-empty-text">Sélectionner un élève pour voir son fil</div>
        </div>
      </div>
    );
  }

  const monProf = currentProfile?.role === "eleve"
    ? allProfiles.find(p => p.id === currentProfile.prof_id)
    : null;

  const displayName = currentProfile?.role === "professeur"
    ? `${eleveProfile?.prenom} ${eleveProfile?.nom}`
    : formatNomProf(monProf?.prenom, monProf?.nom);

  const sujetActuel = currentProfile?.role === "professeur"
    ? eleveProfile?.sujet
    : currentProfile?.sujet;

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="avatar avatar-sm">
            {currentProfile?.role === "professeur"
              ? initials(eleveProfile?.nom, eleveProfile?.prenom)
              : (monProf ? initials(monProf.nom, monProf.prenom) : "?")}
          </div>
          <div>
            <div className="chat-header-name">{displayName}</div>
            {currentProfile?.role === "eleve" ? (
              editingSubject ? (
                <div className="sujet-edit-row">
                  <input
                    className="sujet-inline-input"
                    value={subjectDraft}
                    onChange={e => setSubjectDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") saveSubject();
                      if (e.key === "Escape") setEditingSubject(false);
                    }}
                    autoFocus
                  />
                  <button className="btn-edit-sujet" onClick={saveSubject} title="Valider">✓</button>
                  <button className="btn-edit-sujet" onClick={() => setEditingSubject(false)} title="Annuler">✕</button>
                </div>
              ) : (
                <div className="sujet-edit-row">
                  <div className="chat-header-sujet">
                    {sujetActuel ? `🎤 ${sujetActuel}` : "Sujet non renseigné"}
                  </div>
                  <button
                    className="btn-edit-sujet"
                    title="Modifier mon sujet"
                    onClick={() => { setSubjectDraft(sujetActuel || ""); setEditingSubject(true); }}
                  >✏️</button>
                </div>
              )
            ) : (
              sujetActuel && <div className="chat-header-sujet">🎤 {sujetActuel}</div>
            )}
          </div>
        </div>
        <div className="header-actions">
        </div>
      </div>

      <div className="messages-list">
        {grouped.map((item, i) =>
          item.type === "date"
            ? <div key={i} className="date-sep">{item.label}</div>
            : <Message key={item.msg.id} msg={item.msg}
                isMe={item.msg.sender_id === currentUser.id}
                profile={allProfiles.find(p => p.id === item.msg.sender_id)}
                currentProfile={currentProfile}
                onSupprimer={supprimerMessage}
                onSupprimerFichier={supprimerFichierParProf} />
        )}
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, marginTop: 40 }}>
            Aucun message pour l'instant.<br />
            {currentProfile?.role === "eleve" && "Envoyez votre première question sur le Grand Oral !"}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-zone">
        {file && (
          <div className="upload-preview">
            <span>{fileIcon(file.type)}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
            <button onClick={() => setFile(null)}>✕</button>
          </div>
        )}
        {uploading && (
          <div className="upload-bar" style={{ marginBottom: 8 }}>
            <div className="upload-bar-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
        <div className="input-row">
          <textarea ref={textRef} className="msg-input" rows={1} value={text}
            placeholder="Écrivez un message…"
            onChange={e => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <input ref={fileRef} type="file" style={{ display: "none" }}
            onChange={e => setFile(e.target.files[0])} />
          <button className="btn-attach" onClick={() => fileRef.current?.click()} title="Joindre un fichier">📎</button>
          <button className="btn-send" onClick={send} disabled={!text.trim() && !file || uploading} title="Envoyer">➤</button>
        </div>
      </div>
    </div>
  );
}

// ─── App principale ───────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");
  const [niveauScolaire, setNiveauScolaire] = useState("terminale_spe");
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const COULEURS_NIVEAU = {
    terminale_spe: "#2563eb",
    premiere:      "#7c3aed",
    seconde:       "#059669",
  };
  const couleurActive = COULEURS_NIVEAU[niveauScolaire] || "#2563eb";
  const estTerminaleSpe = niveauScolaire === "terminale_spe";
  const [sessionARecharger, setSessionARecharger] = useState(null); // ids de questions à charger dans le générateur

  // Charger le CSS de KaTeX une seule fois (nécessaire pour un rendu correct des formules)
  useEffect(() => {
    if (!document.getElementById("katex-css")) {
      const link = document.createElement("link");
      link.id = "katex-css";
      link.rel = "stylesheet";
      link.href = "https://esm.sh/katex@0.16.9/dist/katex.min.css";
      document.head.appendChild(link);
    }
  }, []);

  // Vérifier session existante + écouter les changements (login/logout)
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        setUser(session.user); setProfile(p);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        // Réinitialise tout l'état local quand la session se termine
        setUser(null);
        setProfile(null);
        setAllProfiles([]);
        setSelectedEleve(null);
        setUnreadCounts({});
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Charger tous les profils si prof + realtime sur les sujets
  useEffect(() => {
    if (!profile) return;
    supabase.from("profiles").select("*").then(({ data }) => setAllProfiles(data || []));
    // Écouter les mises à jour de sujets en temps réel (vue prof)
    if (profile.role === "professeur") {
      const ch = supabase.channel("profiles-watch")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" },
          payload => {
            setAllProfiles(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
          })
        .subscribe();
      return () => supabase.removeChannel(ch);
    }
  }, [profile]);

  // Compter non-lus (prof)
  useEffect(() => {
    if (profile?.role !== "professeur") return;
    async function fetchUnread() {
      const { data } = await supabase.from("messages").select("eleve_id").eq("lu", false).eq("sender_role", "eleve");
      const counts = {};
      (data || []).forEach(m => { counts[m.eleve_id] = (counts[m.eleve_id] || 0) + 1; });
      setUnreadCounts(counts);
    }
    fetchUnread();
    const ch = supabase.channel("unread-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, fetchUnread)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile]);

  // Basculer vers le bon sous-onglet au changement de niveau
  useEffect(() => {
    if (!estTerminaleSpe && (activeTab === "chat" || activeTab === "ressources")) {
      setActiveTab("automatismes");
    }
    if (estTerminaleSpe && (activeTab === "automatismes" || activeTab === "qcm")) {
      setActiveTab("chat");
    }
  }, [niveauScolaire]);

  function handleLogin(u, p) { setUser(u); setProfile(p); }

  if (loading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117", color: "#7b82a8", fontFamily: "DM Sans, sans-serif" }}>Chargement…</div>;
  if (!user || !profile) return <><style>{CSS}</style><Login onLogin={handleLogin} /></>;

  // Première connexion élève : sujet non renseigné
  if (profile.role === "eleve" && !profile.sujet) {
    const monProf = allProfiles.find(p => p.id === profile.prof_id);
    const nomProf = monProf ? formatNomProf(monProf.prenom, monProf.nom) : null;
    return (
      <>
        <style>{CSS}</style>
        <SaisieSubject
          profile={profile}
          nomProf={nomProf}
          onSave={(sujet) => setProfile({ ...profile, sujet })}
        />
      </>
    );
  }

  const eleves = allProfiles
    .filter(p => p.role === "eleve" && p.prof_id === profile.id)
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {profile.role === "professeur" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}>

            {/* Barre unifiée : pills de niveau + séparateur + sous-onglets */}
            <div className="niveau-top-bar">
              {/* Pills de niveau */}
              <div className="niveau-pills">
                {[
                  { id: "terminale_spe", label: "Terminale spé" },
                  { id: "premiere", label: "Première" },
                  { id: "seconde", label: "Seconde" },
                ].map(n => (
                  <button key={n.id} className={`niveau-pill${niveauScolaire === n.id ? " active" : ""}`}
                    style={niveauScolaire === n.id ? { background: COULEURS_NIVEAU[n.id] } : {}}
                    onClick={() => setNiveauScolaire(n.id)}>
                    {n.label}
                  </button>
                ))}
              </div>

              {/* Séparateur vertical */}
              <div className="niveau-separateur"></div>

              {/* Sous-onglets selon le niveau */}
              {estTerminaleSpe ? (
                <>
                  <button className="sidebar-tab-top" onClick={() => setActiveTab("chat")}
                    style={{ color: activeTab === "chat" ? couleurActive : "", borderBottom: activeTab === "chat" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                    Élèves{totalUnread > 0 && <span className="badge-count" style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px" }}>{totalUnread}</span>}
                  </button>
                  <button className="sidebar-tab-top" onClick={() => setActiveTab("ressources")}
                    style={{ color: activeTab === "ressources" ? couleurActive : "", borderBottom: activeTab === "ressources" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                    Ressources
                  </button>
                  <button className="sidebar-tab-top" onClick={() => setActiveTab("generateur")}
                    style={{ color: activeTab === "generateur" ? couleurActive : "", borderBottom: activeTab === "generateur" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                    Générateur
                  </button>
                  <button className="sidebar-tab-top" onClick={() => setActiveTab("historique")}
                    style={{ color: activeTab === "historique" ? couleurActive : "", borderBottom: activeTab === "historique" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                    Historique
                  </button>
                </>
              ) : (
                <>
                  <button className="sidebar-tab-top" onClick={() => setActiveTab("automatismes")}
                    style={{ color: activeTab === "automatismes" ? couleurActive : "", borderBottom: activeTab === "automatismes" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                    Automatismes
                  </button>
                  <button className="sidebar-tab-top" onClick={() => setActiveTab("qcm")}
                    style={{ color: activeTab === "qcm" ? couleurActive : "", borderBottom: activeTab === "qcm" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                    QCM
                  </button>
                  <button className="sidebar-tab-top" onClick={() => setActiveTab("historique")}
                    style={{ color: activeTab === "historique" ? couleurActive : "", borderBottom: activeTab === "historique" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                    Historique
                  </button>
                </>
              )}

              {/* Actions globales — toujours visibles */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <UsageIndicator />
                <button className="btn-key" onClick={() => setShowPasswordModal(true)} title="Changer mon mot de passe">
                  🔑 Mot de passe
                </button>
                <button className="btn-logout" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
              </div>
            </div>

            {/* Contenu Terminale Spé */}
            {estTerminaleSpe && activeTab === "chat" && (
              <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
                <div className="sidebar">
                  <div className="sidebar-list">
                    {eleves.map(el => (
                      <div key={el.id} className={`eleve-item${selectedEleve === el.id ? " active" : ""}`}
                        onClick={() => setSelectedEleve(el.id)}>
                        <div className="avatar">
                          {initials(el.nom, el.prenom)}
                          {unreadCounts[el.id] > 0 && <div className="unread-dot"></div>}
                        </div>
                        <div className="eleve-info">
                          <div className="eleve-name">{el.prenom} {el.nom}</div>
                          <div className="eleve-sujet">{el.sujet || "Sujet non défini"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <ChatZone eleveId={selectedEleve} currentUser={user} currentProfile={profile} allProfiles={allProfiles} />
              </div>
            )}
            {estTerminaleSpe && (
              <>
                <div style={{ display: activeTab === "ressources" ? "flex" : "none", flex: 1, minHeight: 0 }}>
                  <RessourcesZone currentUser={user} currentProfile={profile} />
                </div>
                <div style={{ display: activeTab === "historique" ? "flex" : "none", flex: 1, minHeight: 0 }}>
                  <HistoriqueZone currentUser={user} currentProfile={profile} allProfiles={allProfiles}
                    onRejouer={(ids) => { setSessionARecharger(ids); setActiveTab("generateur"); }} />
                </div>
              </>
            )}

            {/* GenerateurZone — commun à tous les niveaux (Terminale: onglet Générateur, Seconde/Première: onglet Automatismes) */}
            <div style={{ display: activeTab === "generateur" || activeTab === "automatismes" ? "flex" : "none", flex: 1, minHeight: 0 }}>
              <GenerateurZone currentUser={user} currentProfile={profile}
                sessionARecharger={sessionARecharger} onSessionChargee={() => setSessionARecharger(null)}
                niveauScolaire={niveauScolaire} />
            </div>

            {/* Historique Seconde/Première */}
            {!estTerminaleSpe && (
              <div style={{ display: activeTab === "historique" ? "flex" : "none", flex: 1, minHeight: 0 }}>
                <HistoriqueZone currentUser={user} currentProfile={profile} allProfiles={allProfiles}
                  onRejouer={(ids) => { setSessionARecharger(ids); setActiveTab("automatismes"); }} />
              </div>
            )}

            {/* QCM — à venir */}
            {!estTerminaleSpe && activeTab === "qcm" && (
              <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--text-muted)" }}>
                <div style={{ fontSize: 32, opacity: .3 }}>🚧</div>
                <div style={{ fontSize: 14 }}>Interface QCM — bientôt disponible</div>
              </div>
            )}

          </div>
        )}

        {profile.role === "eleve" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div className="sidebar-tabs eleve-tabs">
              <button className={`sidebar-tab${activeTab === "chat" ? " active" : ""}`}
                onClick={() => setActiveTab("chat")}>💬 Discussion</button>
              <button className={`sidebar-tab${activeTab === "ressources" ? " active" : ""}`}
                onClick={() => setActiveTab("ressources")}>📚 Ressources</button>
            </div>
            {activeTab === "chat" && (
              <ChatZone eleveId={user.id} currentUser={user} currentProfile={profile} allProfiles={allProfiles} />
            )}
            {activeTab === "ressources" && (
              <RessourcesZone currentUser={user} currentProfile={profile} />
            )}
          </div>
        )}

      </div>
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </>
  );
}
