
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
    --accent-rgb: 91,115,255;
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
  .login-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
  .login-niveaux-dots { display: flex; gap: 6px; margin-bottom: 28px; }
  .login-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .champ-mdp-wrap { position: relative; display: flex; }
  .champ-mdp-wrap input { flex: 1; padding-right: 40px; }
  .btn-voir-mdp {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; font-size: 15px; padding: 4px 6px;
    line-height: 1; opacity: .7;
  }
  .btn-voir-mdp:hover { opacity: 1; }
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
  .usage-indicator { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
  .usage-badge {
    font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;
    font-family: var(--mono); cursor: default;
  }
  .usage-badge.alerte { color: var(--red); }

  .site-titre { font-size: 19px; font-weight: 600; color: var(--accent-light); flex-shrink: 0; white-space: nowrap; cursor: pointer; }
  .site-titre-clic { font-size: 15px; font-weight: 600; color: var(--accent-light); cursor: pointer; transition: opacity .15s; }
  .site-titre-clic:hover { opacity: .8; }

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
    display: flex; flex-direction: column; background: var(--surface);
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .niveau-top-row1 { display: flex; align-items: center; padding: 8px 16px; }
  .niveau-top-row2 { display: flex; align-items: center; padding: 0 16px; border-top: 1px solid var(--border); }
  .niveau-pills { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
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

  /* ── Spinner de chargement (teinté selon le niveau actif via var(--accent)) ── */
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid var(--border); border-top-color: var(--accent);
    animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .hist-list { display: flex; flex-direction: column; gap: 10px; max-width: 760px; }
  .hist-card { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 14px; padding: 16px 20px; }
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
  .hist-badge.partage { background: rgba(var(--accent-rgb), 0.15); color: var(--accent-light); }
  .hist-badge.qcm { background: rgba(245,158,11,0.15); color: #f59e0b; }
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
  .hist-famille { display: flex; flex-direction: column; gap: 8px; }
  .hist-card-secondaire { opacity: .8; border-left-color: var(--border); margin-left: 16px; }
  .hist-famille-toggle {
    align-self: flex-start; margin-left: 16px; background: none; border: 1px dashed var(--border);
    color: var(--text-muted); border-radius: 8px; padding: 5px 12px; font-family: var(--font);
    font-size: 11px; font-weight: 600; cursor: pointer; transition: all .15s;
  }
  .hist-famille-toggle:hover { background: var(--surface2); color: var(--text); border-color: var(--accent); }

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
    background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--accent);
    border-radius: 10px; margin-bottom: 8px;
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
  .gen-selected-duplicate { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 2px 4px; flex-shrink: 0; border-radius: 6px; }
  .gen-selected-duplicate:hover { color: var(--accent-light); background: var(--surface2); }
  .gen-selected-nbcopies {
    width: 34px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
    color: var(--text); font-family: var(--font); font-size: 12px; text-align: center; padding: 2px 0; flex-shrink: 0;
  }
  .gen-selected-nbcopies:focus { border-color: var(--accent); outline: none; }

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
  .diapo-qcm-choix-liste { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 720px; margin-top: 36px; }
  .diapo-qcm-choix {
    display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 12px;
    border: 1.5px solid var(--border); background: var(--surface); font-size: 18px; text-align: left;
    transition: all .2s;
  }
  .diapo-qcm-choix.correcte { border-color: var(--green); background: rgba(52,211,153,.12); }
  .diapo-qcm-choix-lettre {
    width: 30px; height: 30px; border-radius: 50%; background: var(--surface2); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-weight: 600; font-size: 14px;
  }
  .diapo-qcm-choix.correcte .diapo-qcm-choix-lettre { background: var(--green); color: #0f1117; }

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
  .creer-choix-list { display: flex; flex-direction: column; gap: 8px; }
  .creer-choix-row { display: flex; align-items: center; gap: 10px; }
  .creer-choix-radio { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
  .creer-choix-lettre { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--accent-light); width: 16px; flex-shrink: 0; }
  .creer-choix-input {
    flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 12px; color: var(--text); font-family: var(--mono); font-size: 13px; outline: none;
  }
  .creer-choix-input:focus { border-color: var(--accent); }
  .creer-choix-row.bonne .creer-choix-input { border-color: var(--green); }

  /* Paramètres aléatoires */
  .creer-params { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  .creer-param-row { display: flex; align-items: center; gap: 8px; }
  .creer-param-name { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--accent-light); width: 28px; flex-shrink: 0; }
  .creer-param-input {
    width: 72px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
    padding: 6px 8px; color: var(--text); font-family: var(--font); font-size: 12px; outline: none; text-align: center;
  }
  .creer-param-sep { font-size: 12px; color: var(--text-muted); }
  .creer-param-liste-input {
    flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
    padding: 6px 10px; color: var(--text); font-family: var(--mono); font-size: 12px; outline: none;
  }
  .creer-param-liste-input:focus { border-color: var(--accent); }
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
  .import-scroll-body { flex: 1; overflow-y: auto; min-height: 0; }
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
    margin-bottom: 4px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
  }
  .import-report-item-id { font-family: var(--mono); color: var(--text-muted); flex-shrink: 0; }
  .import-report-item-detail { flex: 1; color: var(--text); white-space: normal; word-break: break-word; }
  .import-report-suggestion { font-family: var(--mono); color: var(--accent-light); font-size: 11px; flex-shrink: 0; }
  .import-format-guide {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 16px; margin-bottom: 16px; font-size: 12px;
  }
  .import-format-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  .import-format-table th { text-align: left; color: var(--text-muted); font-weight: 600; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--border); }
  .import-format-table td { padding: 5px 8px 5px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
  .import-format-table code { background: var(--surface); padding: 1px 5px; border-radius: 4px; font-family: var(--mono); }
  .import-format-note { color: var(--text-muted); margin-top: 8px; line-height: 1.5; }
  .import-format-note strong { color: var(--text); }
  .import-format-actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
  .import-format-example-btn {
    background: none; border: 1px solid var(--accent); color: var(--accent-light);
    border-radius: 8px; padding: 6px 12px; font-family: var(--font); font-size: 12px;
    font-weight: 600; cursor: pointer; transition: all .15s;
  }
  .import-format-example-btn:hover { background: rgba(var(--accent-rgb), .12); }
  .import-actions { display: flex; gap: 10px; flex-shrink: 0; }
  .import-result {
    text-align: center; padding: 30px 0; display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .import-result-icon { font-size: 40px; }

  .katex-render { font-size: 1em; }
  .katex-render .katex { font-size: 1.05em; }
  .latex-table { border-collapse: collapse; margin: 10px auto; }
  .latex-table td { border: 1px solid var(--border, currentColor); padding: 6px 14px; text-align: center; }

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
  .modal-btn-danger { background: var(--red); color: #fff; }
  .modal-btn-danger:hover { filter: brightness(1.12); }
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
// Le sigle officiel de chaque chapitre vit désormais dans la table Supabase
// prefixes_chapitres (chapitre_id -> prefixe), plus dans un objet codé en dur.
// Indexé par chapitre_id (pas par nom) : aucun risque de collision entre deux
// chapitres homonymes de niveaux différents (ex. "Probabilités conditionnelles"
// en Terminale Spé et en Seconde ont chacun leur propre ligne).
async function prefixesParChapitreId(idsChapitres) {
  if (!idsChapitres || idsChapitres.length === 0) return {};
  const { data } = await supabase.from("prefixes_chapitres").select("*").in("chapitre_id", idsChapitres);
  const table = {};
  (data || []).forEach(row => { table[row.chapitre_id] = row.prefixe; });
  return table;
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

// Détecte un tableau LaTeX (\begin{tabular}{...}...\end{tabular}, éventuellement
// entouré de \begin{center}...\end{center}) et le sépare du reste du texte : KaTeX
// ne sait interpréter que des formules mathématiques, jamais des environnements
// de mise en page comme tabular/center, qui doivent donc être rendus en HTML natif.
function extraireSegmentsTableau(texte) {
  if (!texte) return [];
  const regex = /\\begin\{center\}\s*\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}\s*\\end\{center\}|\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g;
  const segments = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(texte)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "texte", content: texte.slice(lastIndex, match.index), key: key++ });
    }
    const corps = match[1] !== undefined ? match[1] : match[2];
    segments.push({ type: "tableau", content: corps, key: key++ });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < texte.length) {
    segments.push({ type: "texte", content: texte.slice(lastIndex), key: key++ });
  }
  return segments;
}

// Parse le corps d'un environnement tabular : retire les \hline, découpe en
// lignes sur \\ puis en cellules sur &. Le contenu de chaque cellule (qui peut
// contenir des formules $...$) est rendu séparément via MathText.
function parserTableauLatex(corps) {
  return corps
    .replace(/\\hline/g, "")
    .split(/\\\\(?:\[[^\]]*\])?/)
    .map(ligne => ligne.trim())
    .filter(ligne => ligne.length > 0)
    .map(ligne => ligne.split("&").map(cellule => cellule.trim()));
}

function MathText({ children, inline = true }) {
  const segmentsTableau = extraireSegmentsTableau(children || "");
  const contientTableau = segmentsTableau.some(s => s.type === "tableau");
  // Un <table> ne peut pas être imbriqué dans un <span> : on force un conteneur
  // bloc dès qu'un tableau est présent, même si inline avait été demandé.
  const Wrapper = (inline && !contientTableau) ? "span" : "div";
  return (
    <Wrapper className="katex-render">
      {segmentsTableau.map(segTab => {
        if (segTab.type === "tableau") {
          const lignes = parserTableauLatex(segTab.content);
          return (
            <table className="latex-table" key={segTab.key}>
              <tbody>
                {lignes.map((ligne, i) => (
                  <tr key={i}>
                    {ligne.map((cellule, j) => (
                      <td key={j}><MathText>{cellule}</MathText></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        const segments = renderMathSegments(segTab.content);
        return segments.map(seg => {
          const cle = `${segTab.key}-${seg.key}`;
          if (seg.type === "text") {
            const morceaux = renderTextSegments(seg.content, seg.key * 1000);
            return (
              <span key={cle}>
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
            return <span key={cle} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={cle}>{seg.content}</span>;
          }
        });
      })}
    </Wrapper>
  );
}

// ─── Moteur de tirage des exercices d'application ──────────────────────
// Tire une valeur aléatoire pour un paramètre donné, selon ses bornes et son type.
// Formate un nombre avec virgule décimale (notation française)
// Ex : 1.5 → "1,5"  ;  -0.333 → "-0,333"  ;  2 → "2"
function formatNombre(n) {
  if (Number.isInteger(n)) return String(n);
  return String(n).replace(".", ",");
}

// Construit l'objet "parametres" (stocké en jsonb) à partir des lignes du
// formulaire de création. Pour le type "liste", parse le texte "20, 25, 50"
// en tableau de nombres ; pour les autres types, conserve min/max/type.
function construireParametres(params) {
  const parametres = {};
  params.forEach(p => {
    if (p.type === "liste") {
      const valeurs = (p.valeurs || "").split(",").map(s => Number(s.trim())).filter(n => !isNaN(n));
      parametres[p.nom] = { type: "liste", valeurs };
    } else {
      parametres[p.nom] = { min: Number(p.min), max: Number(p.max), type: p.type };
    }
  });
  return parametres;
}

function tirerValeurParametre(def) {
  const { min, max, type } = def;
  if (type === "liste") {
    const valeurs = def.valeurs || [];
    return valeurs[Math.floor(Math.random() * valeurs.length)];
  }
  if (type === "decimal") {
    const valeur = min + Math.random() * (max - min);
    return Math.round(valeur * 10) / 10;
  }
  if (type === "entier_non_nul") {
    let v;
    do { v = Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min); } while (v === 0);
    return v;
  }
  // entier par défaut
  return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min);
}

// Nettoie le texte après substitution : supprime les coefficients 1 et -1
// devant une variable, et les termes +0 ou -0 inutiles.
// Échappe les caractères spéciaux LaTeX qui casseraient la compilation .tex
// sans être visibles à l'écran (KaTeX/l'affichage web ne s'en soucient pas).
// Pour l'instant : le "%" qui démarre un commentaire LaTeX et tronque la ligne.
// N'échappe pas un "\%" déjà présent (évite le double-échappement).
// Génère la documentation complète sous forme de JSON structuré (pas du markdown) :
// le prof voit directement un objet à copier/adapter, avec les listes de valeurs
// valides en tableaux plutôt qu'en prose. Toujours construite à partir des vrais
// chapitres chargés à l'écran, jamais d'une liste recopiée à la main.
// Génère la documentation sous forme de fichier commenté (JSONC) : les
// exemples ne contiennent QUE les champs réellement importables (rien d'autre,
// pas de clé "documentation" mélangée), et toutes les explications vivent en
// commentaires // autour. Toujours construite à partir des vrais chapitres
// chargés à l'écran, jamais d'une liste recopiée à la main.
function genererDocumentationImport(contexte, chapitres, niveauScolaire) {
  const chapitresTries = [...chapitres].sort((a, b) => a.ordre - b.ordre).map(c => c.nom);
  const nomNiveau = { terminale_spe: "Terminale Spé", seconde: "Seconde", premiere_specifique: "Première spécifique", premiere_spe: "Première spécialité", premiere_techno: "Première technologique" }[niveauScolaire] || niveauScolaire;
  const premierChapitre = chapitresTries[0] || "Nom exact d'un chapitre existant";
  const L = [];

  const titre = contexte === "qcm" ? "Documentation import QCM" : "Documentation import Questions / Exercices";
  L.push("// ".padEnd(60, "="));
  L.push(`// ${titre} — ${nomNiveau}`);
  L.push(`// Générée le ${new Date().toLocaleDateString("fr-FR")} depuis les chapitres réellement en base pour ce niveau.`);
  L.push("// ".padEnd(60, "="));
  L.push("");
  L.push('// Chapitres disponibles pour ce niveau (le champ "chapitre" doit');
  L.push("// correspondre EXACTEMENT, insensible à la casse, à l'un de ces noms) :");
  chapitresTries.forEach(nom => L.push(`//   - ${nom}`));
  L.push("");

  const estTerminale = niveauScolaire === "terminale_spe";
  const chapitreDerivation = chapitresTries.find(n => n.toLowerCase() === "dérivation") || premierChapitre;
  const chapitreProba = chapitresTries.find(n => n.toLowerCase() === "probabilités conditionnelles") || premierChapitre;

  if (contexte === "qcm") {
    L.push("// Aucune convention de nommage : l'id du QCM est un uuid auto-généré");
    L.push("// par Supabase, jamais lu depuis le JSON.");
    L.push("");
    L.push('// ── Exemple : QCM fixe ──');
    L.push('// mode "fixe" : enonce + choix (tableau de 4 textes) + bonne_reponse (0 à 3) + niveau (optionnel, 1 par défaut)');
    L.push(JSON.stringify(estTerminale ? {
      chapitre: chapitreProba,
      mode: "fixe",
      enonce: "La probabilité conditionnelle $P_A(B)$ se calcule par :",
      choix: ["$\\dfrac{P(A\\cap B)}{P(A)}$", "$\\dfrac{P(A\\cap B)}{P(B)}$", "$P(A)\\times P(B)$", "$P(A)+P(B)-P(A\\cap B)$"],
      bonne_reponse: 0,
      niveau: 2,
    } : {
      chapitre: premierChapitre,
      mode: "fixe",
      enonce: "25 % de 480 est égal à :",
      choix: ["120", "12", "1200", "1,2"],
      bonne_reponse: 0,
      niveau: 1,
    }, null, 2));
    L.push("");
    L.push('// ── Exemple : QCM aléatoire ──');
    L.push('// mode "aleatoire" : enonce_modele + choix_modele (4 textes avec placeholders) + parametres + bonne_reponse');
    L.push('// bonne_reponse référence l\'ordre de choix_modele tel que stocké ci-dessus.');
    L.push('// L\'application mélange l\'ordre des 4 choix à chaque tirage/affichage ;');
    L.push('// ceci ne concerne que le stockage, pas l\'ordre vu par l\'élève.');
    L.push(JSON.stringify(estTerminale ? {
      chapitre: chapitreDerivation,
      mode: "aleatoire",
      enonce_modele: "La dérivée de $f(x) = {a}x^2 + {b}x$ est :",
      choix_modele: [
        "$f'(x) = {poly(2*a:1, b:0)}$",
        "$f'(x) = {poly(a:1, b:0)}$",
        "$f'(x) = {poly(2*a:2, b:1)}$",
        "$f'(x) = {poly(2*a:1, 0:0)}$",
      ],
      bonne_reponse: 0,
      parametres: {
        a: { type: "entier_non_nul", min: -10, max: 10 },
        b: { type: "entier", min: -10, max: 10 },
      },
      niveau: 2,
    } : {
      chapitre: premierChapitre,
      mode: "aleatoire",
      enonce_modele: "L'opération qui permet de calculer {a} % de {b} est :",
      choix_modele: [
        "$\\dfrac{{b}}{{a}\\times 100}$",
        "${a}\\times {b}\\times 0,1$",
        "$\\dfrac{{b}\\times 100}{{a}}$",
        "$\\dfrac{{a}}{{100}}\\times {b}$",
      ],
      bonne_reponse: 3,
      parametres: {
        a: { type: "liste", valeurs: [20, 25, 50, 75, 80] },
        b: { type: "entier", min: 20, max: 2000 },
      },
      niveau: 1,
    }, null, 2));
  } else {
    L.push("// Types de question disponibles (champ \"type\", mode fixe uniquement) :");
    L.push("//   formule | méthode | définition | théorème | exercice");
    L.push("");
    L.push("// Convention de nommage des ids (un seul sigle par chapitre, table Supabase");
    L.push("// prefixes_chapitres, repli auto-dérivé du nom si absent) :");
    L.push("//   Fixe      : SIGLE_INITIALES_NN     (ex. PCOND_FG_01)");
    L.push("//   Aléatoire : SIGLE_INITIALES_EXNN   (ex. EQIN_FG_EX01)");
    L.push("//   Les initiales viennent du prénom/nom du profil connecté, pas de l'e-mail.");
    L.push("//   \"id\" est optionnel en mode fixe (auto-généré/corrigé si absent ou déjà pris),");
    L.push("//   et TOUJOURS auto-généré en mode aléatoire (jamais lu depuis le JSON).");
    L.push("");
    L.push('// ── Exemple : question fixe (table questions) ──');
    L.push('// champs : chapitre, mode (optionnel), type, enonce, reponse, niveau (optionnel, 2 par défaut)');
    L.push(JSON.stringify(estTerminale ? {
      chapitre: chapitreProba,
      mode: "fixe",
      type: "méthode",
      enonce: "Comment calcule-t-on $P_A(B)$ ?",
      reponse: "$P_A(B) = \\dfrac{P(A \\cap B)}{P(A)}$",
      niveau: 2,
    } : {
      chapitre: premierChapitre,
      mode: "fixe",
      type: "méthode",
      enonce: "Comment calcule-t-on la dérivée d'une fonction ?",
      reponse: "On applique les formules de dérivation usuelles.",
      niveau: 2,
    }, null, 2));
    L.push("");
    L.push('// ── Exemple : exercice aléatoire (table exercices_application) ──');
    L.push('// champs : chapitre, mode, enonce_modele, reponse_modele, parametres, niveau (optionnel), type_calcul (optionnel, libre)');
    L.push(JSON.stringify(estTerminale ? {
      chapitre: chapitreDerivation,
      mode: "aleatoire",
      enonce_modele: "Calculer $f'(x)$ pour $f(x) = {poly(a:2, b:1, c:0)}$",
      reponse_modele: "$f'(x) = {poly(2*a:1, b:0)}$",
      parametres: {
        a: { type: "entier_non_nul", min: -10, max: 10 },
        b: { type: "entier", min: -10, max: 10 },
        c: { type: "entier", min: -20, max: 20 },
      },
      niveau: 2,
    } : {
      chapitre: premierChapitre,
      mode: "aleatoire",
      enonce_modele: "Résoudre l'équation ${a}x + {b} = 0$",
      reponse_modele: "$x = {frac(-b, a)}$",
      parametres: {
        a: { type: "entier_non_nul", min: -9, max: 9 },
        b: { type: "entier", min: -9, max: 9 },
      },
      niveau: 2,
    }, null, 2));
    L.push("");
    L.push('// ── Exemple : exercice aléatoire avec un paramètre de type "liste" ──');
    L.push(JSON.stringify(estTerminale ? {
      chapitre: chapitreDerivation,
      mode: "aleatoire",
      enonce_modele: "Calculer $f'(x)$ pour $f(x) = {a}x^2 + {b}x$",
      reponse_modele: "$f'(x) = {poly(2*a:1, b:0)}$",
      parametres: {
        a: { type: "liste", valeurs: [-4, -2, -1, 1, 2, 4] },
        b: { type: "entier", min: -10, max: 10 },
      },
      type_calcul: "derivee",
      niveau: 2,
    } : {
      chapitre: premierChapitre,
      mode: "aleatoire",
      enonce_modele: "L'opération qui permet de calculer {a} % de {b} est :",
      reponse_modele: "${a}/100 \\times {b}$",
      parametres: {
        a: { type: "liste", valeurs: [20, 25, 50, 75, 80] },
        b: { type: "entier", min: 20, max: 2000 },
      },
      type_calcul: "pourcentage",
      niveau: 1,
    }, null, 2));
  }

  L.push("");
  L.push("// Types de paramètre disponibles (dans \"parametres\") :");
  L.push("//   entier          -> tire un entier entre min et max");
  L.push("//   entier_non_nul  -> idem, en excluant 0");
  L.push("//   decimal         -> tire un décimal, arrondi au dixième");
  L.push("//   liste           -> tire au hasard dans un tableau \"valeurs\" (pas de min/max)");
  L.push("");
  L.push("// Placeholders disponibles dans les textes :");
  L.push("//   {a}                    -> valeur brute de la variable a");
  L.push("//   {2a}                   -> calcul simple implicite (2 fois a)");
  L.push("//   {a*d+c*e*b}            -> expression arithmétique quelconque (+ - * / ())");
  L.push("//   {frac(-b, a)}          -> fraction exacte simplifiée, rendue en LaTeX");
  L.push("//   {sqrt(a*a+b*b)}        -> racine carrée exacte (simplifiée en entier si carré parfait, sinon \\sqrt{d})");
  L.push("//");
  L.push("//   {poly(...)} -> affiche un polynôme bien formé (signes, x/x², termes qui");
  L.push("//   disparaissent si leur coefficient vaut 0 — jamais de \"+0\" ou de \"1x\" moche).");
  L.push("//   Syntaxe : une liste de termes séparés par des virgules, chaque terme");
  L.push("//   s'écrivant  coefficient:degré");
  L.push("//     - le coefficient (avant les deux-points) : une variable (a) ou un calcul (2*a)");
  L.push("//     - le degré (après les deux-points) : la puissance de x -> 2 = x², 1 = x, 0 = pas de x");
  L.push("//");
  L.push("//   Exemple : {poly(a:2, b:1, c:0)}  =>  affiche  ax² + bx + c");
  L.push("//   Avec a=-3, b=0, c=5, ça donne concrètement :  -3x² + 5");
  L.push("//   (le terme en x a disparu tout seul puisque b=0)");
  L.push("//");
  L.push("//   On peut aussi calculer les coefficients, par exemple pour une dérivée :");
  L.push("//     f(x)  = {poly(a:2, b:1, c:0)}   =>  ax² + bx + c");
  L.push("//     f'(x) = {poly(2*a:1, b:0)}      =>  (2a)x + b");
  L.push("");
  L.push("// Pièges à connaître :");
  L.push("//   1. Accolades LaTeX à DOUBLER quand une valeur substituée doit rester groupée");
  L.push("//      en LaTeX (exposant, dénominateur) : \\dfrac{{a}}{{100}} et non \\dfrac{{a}}{100}");
  L.push("//      (sinon les accolades disparaissent, LaTeX ne prend que le caractère suivant).");
  L.push("//   2. Formule illustrative avec des lettres ressemblant à des variables");
  L.push("//      (ex. R=U^2/P, non calculée) : n'utiliser AUCUNE accolade LaTeX autour de U/P.");
  L.push("//   3. Le signe % s'écrit tel quel ({a} % de {b}), jamais \\%  — l'export .tex");
  L.push("//      échappe automatiquement le caractère.");

  return L.join("\n");
}



function echapperLatex(texte) {
  return (texte || "").replace(/(?<!\\)%/g, "\\%");
}

function nettoyerExpression(texte) {
  return texte
    // 1x → x, -1x → -x
    .replace(/\b1([a-zA-Z])/g, "$1")
    .replace(/(^|[+\-\s])-1([a-zA-Z])/g, (m, avant, lettre) => avant + "-" + lettre)
    // + 0 terme → supprimer
    .replace(/\s*\+\s*0(?=[x\s$})]|$)/g, "")
    .replace(/\s*-\s*0(?=[x\s$})]|$)/g, "")
    // + (-5) ou + (-1,5) → - 5 ou - 1,5
    .replace(/\+\s*\((-[\d.,]+)\)/g, (m, n) => "- " + n.replace("-", ""))
    // - (-5) → + 5
    .replace(/-\s*\((-[\d.,]+)\)/g, (m, n) => "+ " + n.replace("-", ""))
    // Parenthèses dans accolade LaTeX {(-5)} → {-5}
    .replace(/\{(\(-[\d.,]+\))\}/g, (m, inner) => "{" + inner.slice(1, -1) + "}")
    // + -5 → - 5
    .replace(/\+\s*(-[\d.,]+)/g, (m, n) => "- " + n.replace("-", ""))
    .replace(/\s{2,}/g, " ").trim();
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
  // Normalise d'abord \{var\} → {var} pour accepter les deux notations
  const texte = texteModele.replace(/\\{([^{}]+)\\}/g, "{$1}");
  const resultat = texte.replace(/\{([^{}]+)\}/g, (match, expr) => {
    const exprPropre = expr.trim();

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

    // Cas spécial : {frac(num, den)} — fraction exacte simplifiée en LaTeX
    // Ex: {frac(-b, a)} avec b=5, a=3 → \frac{-5}{3}
    const matchFrac = exprPropre.match(/^frac\((.+),(.+)\)$/);
    if (matchFrac) {
      const num = evaluerExpressionSimple(matchFrac[1].trim(), valeurs);
      const den = evaluerExpressionSimple(matchFrac[2].trim(), valeurs);
      if (typeof num === "number" && typeof den === "number" && den !== 0) {
        const pgcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while(b) { [a,b] = [b, a%b]; } return a || 1; };
        const g = pgcd(Math.abs(Math.round(num)), Math.abs(Math.round(den)));
        let n = Math.round(num) / g, d = Math.round(den) / g;
        if (d < 0) { n = -n; d = -d; }
        if (d === 1) return String(n);
        return `\\frac{${n}}{${d}}`;
      }
    }

    // Cas spécial : {sqrt(expr)} — racine carrée exacte, simplifiée en entier
    // si c'est un carré parfait, sinon renvoyée sous forme \sqrt{d} en LaTeX.
    // Ex: {sqrt(dx*dx+dy*dy)} avec dx=3, dy=4 → 5 (carré parfait, 25)
    //     {sqrt(dx*dx+dy*dy)} avec dx=1, dy=2 → \sqrt{5} (pas un carré parfait)
    const matchSqrt = exprPropre.match(/^sqrt\((.+)\)$/);
    if (matchSqrt) {
      const valeur = evaluerExpressionSimple(matchSqrt[1].trim(), valeurs);
      if (typeof valeur === "number" && valeur >= 0) {
        const arrondi = Math.round(valeur);
        const racine = Math.sqrt(arrondi);
        if (Number.isInteger(racine)) return String(racine);
        return `\\sqrt{${arrondi}}`;
      }
    }

    if (valeurs.hasOwnProperty(exprPropre)) {
      const v = valeurs[exprPropre];
      return formatNombre(v); // virgule décimale française
    }
    const res = evaluerExpressionSimple(exprPropre, valeurs);
    if (typeof res === "number") {
      return formatNombre(res);
    }
    return match;
  });
  // Nettoyage post-substitution : 1x→x, +0→rien, etc.
  return nettoyerExpression(resultat);
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

// Tire un QCM complet à partir de son modèle stocké en base (mode "aleatoire") :
// applique le même moteur que tirerExercice, mais sur l'énoncé ET sur les 4 choix.
// En mode "fixe", retourne directement les valeurs telles quelles (rien à calculer).
// Dans les deux cas, l'ordre des 4 choix est mélangé à CHAQUE tirage, pour éviter
// que les élèves finissent par apprendre la lettre plutôt que le contenu de la bonne
// réponse. bonne_reponse est réindexé pour continuer à pointer vers le bon choix
// après mélange.
function tirerQcm(qcm) {
  let enonce, choix, valeurs = {};
  if (qcm.mode !== "aleatoire") {
    enonce = qcm.enonce;
    choix = qcm.choix;
  } else {
    Object.entries(qcm.parametres || {}).forEach(([nom, def]) => {
      valeurs[nom] = tirerValeurParametre(def);
    });
    enonce = substituerPlaceholders(qcm.enonce_modele, valeurs);
    choix = (qcm.choix_modele || []).map(c => substituerPlaceholders(c, valeurs));
  }

  const ordre = melanger([0, 1, 2, 3]);
  const choixMelanges = ordre.map(i => choix[i]);
  const bonneReponseMelangee = ordre.indexOf(qcm.bonne_reponse);

  return { enonce, choix: choixMelanges, bonne_reponse: bonneReponseMelangee, valeurs };
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

// ─── Automatismes ───────────────────────────────────────────────────────
// Tous les exercices écrits sur mesure ici ont été migrés vers la table
// exercices_application (voir migration_exercices_seconde.json et
// migration_exercice_terminale.json) et validés en base — ils ne sont donc
// plus codés en dur. Le registre reste vide, prêt pour de futurs ajouts
// ponctuels si un besoin très spécifique l'exigeait.
const BIBLIOTHEQUE_EXERCICES = {};


function Login({ onLogin }) {
  const [identifiant, setIdentifiant] = useState("");
  const [pwd, setPwd] = useState("");
  const [voirPwd, setVoirPwd] = useState(false);
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
        <div className="login-logo">Lycée Valadon</div>
        <div className="login-title">Mathématiques à Valadon</div>
        <div className="login-sub">Automatismes, QCM et préparation au Grand Oral</div>
        <div className="login-niveaux-dots">
          <span className="login-dot" style={{ background: "#2563eb" }} />
          <span className="login-dot" style={{ background: "#7c3aed" }} />
          <span className="login-dot" style={{ background: "#059669" }} />
        </div>
        <div className="field">
          <label>Identifiant</label>
          <input type="text" value={identifiant} onChange={e => setIdentifiant(e.target.value)}
            placeholder="prenom.nom" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <div className="champ-mdp-wrap">
            <input type={voirPwd ? "text" : "password"} value={pwd} onChange={e => setPwd(e.target.value)}
              placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <button type="button" className="btn-voir-mdp" onClick={() => setVoirPwd(v => !v)}
              title={voirPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {voirPwd ? "🙈" : "👁️"}
            </button>
          </div>
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
        <div className="site-titre-clic" onClick={() => supabase.auth.signOut()} title="Se déconnecter">
          Mathématiques à Valadon
        </div>
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
  const [voirPwd, setVoirPwd] = useState(false);
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
          <div className="champ-mdp-wrap">
            <input type={voirPwd ? "text" : "password"} value={pwd1} onChange={e => setPwd1(e.target.value)} placeholder="••••••••" autoFocus />
            <button type="button" className="btn-voir-mdp" onClick={() => setVoirPwd(v => !v)}
              title={voirPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {voirPwd ? "🙈" : "👁️"}
            </button>
          </div>
        </div>
        <div className="modal-field">
          <label>Confirmer le mot de passe</label>
          <div className="champ-mdp-wrap">
            <input type={voirPwd ? "text" : "password"} value={pwd2} onChange={e => setPwd2(e.target.value)} placeholder="••••••••"
              onKeyDown={e => e.key === "Enter" && handleChange()} />
            <button type="button" className="btn-voir-mdp" onClick={() => setVoirPwd(v => !v)}
              title={voirPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {voirPwd ? "🙈" : "👁️"}
            </button>
          </div>
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

// ─── Composant ConfirmModal (remplace window.confirm par une modale stylée,
// cohérente avec le reste de l'interface) ──────────────────────────────
// Usage : passer titre + message, danger=true pour une action irréversible
// (bouton rouge) ou false pour une action bénigne (bouton coloré niveau actif).
function ConfirmModal({ titre, message, texteConfirmer = "Confirmer", danger = false, onConfirm, onAnnuler }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onAnnuler()}>
      <div className="modal-card">
        <div className="modal-title">{titre}</div>
        {message && <div className="modal-sub" style={{ whiteSpace: "pre-line" }}>{message}</div>}
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onAnnuler}>Annuler</button>
          <button className={`modal-btn ${danger ? "modal-btn-danger" : "modal-btn-confirm"}`} onClick={onConfirm}>
            {texteConfirmer}
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
// ─── Composant DiapoViewerQcm (projection au tableau des QCM) ──────────
// Même structure que DiapoViewer (minuteur, pause, récap, clavier), mais le
// contenu affiche les 4 choix au lieu d'une réponse libre. Non interactif
// pour l'instant (les choix ne sont pas cliquables) — la révélation se fait
// comme les autres questions, au clic/avancée. Le clic sur un choix pourra
// être ajouté plus tard sans reprendre le reste (voir le composant ChoixQcm).
function ChoixQcm({ texte, lettre, correcte }) {
  return (
    <div className={`diapo-qcm-choix${correcte ? " correcte" : ""}`}>
      <span className="diapo-qcm-choix-lettre">{lettre}</span>
      <MathText>{texte}</MathText>
    </div>
  );
}

function DiapoViewerQcm({ questions, mode, delai, nomChapitre, onFermer }) {
  const [index, setIndex] = useState(0);
  const [etape, setEtape] = useState("question"); // "question" | "reponse" | "recap"
  const [enPause, setEnPause] = useState(false);
  const [tempsRestant, setTempsRestant] = useState(delai);
  const intervalRef = useRef(null);

  const question = questions[index];
  const estDerniereQuestion = index === questions.length - 1;
  const lettres = ["a", "b", "c", "d"];

  const avancer = useCallback(() => {
    if (mode === "apres_chaque_question") {
      if (etape === "question") {
        setEtape("reponse");
        setTempsRestant(delai);
      } else {
        if (estDerniereQuestion) {
          setEtape("recap");
        } else {
          setIndex(i => i + 1);
          setEtape("question");
          setTempsRestant(delai);
        }
      }
    } else {
      if (estDerniereQuestion) {
        setEtape("recap");
      } else {
        setIndex(i => i + 1);
        setTempsRestant(delai);
      }
    }
  }, [mode, etape, estDerniereQuestion, delai]);

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
          {etape === "recap" ? "Récapitulatif" : `QCM ${index + 1} / ${questions.length}`}
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
          <div className="diapo-qcm-choix-liste">
            {question.choix.map((c, i) => (
              <ChoixQcm key={i} texte={c} lettre={lettres[i]} correcte={etape === "reponse" && i === question.bonne_reponse} />
            ))}
          </div>
          <div className="diapo-hint">Clic, Espace ou → pour avancer · Échap pour fermer</div>
        </div>
      ) : (
        <div className="diapo-recap">
          <div className="diapo-recap-title">📋 Récapitulatif des bonnes réponses</div>
          {questions.map((q, i) => (
            <div key={q.id} className="diapo-recap-item">
              <div className="diapo-recap-num">QCM {i + 1} · {nomChapitre(q.chapitre_id)}</div>
              <div className="diapo-recap-enonce"><MathText inline={false}>{q.enonce}</MathText></div>
              <div className="diapo-recap-reponse">{lettres[q.bonne_reponse]}) <MathText>{q.choix[q.bonne_reponse]}</MathText></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportQuestions({ currentUser, currentProfile, chapitres, niveauScolaire, onFermer, onImportTermine }) {
  const [fichier, setFichier] = useState(null);
  const [analyse, setAnalyse] = useState(null); // { valides, conflits, chapitresInconnus }
  const [analysing, setAnalysing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultat, setResultat] = useState(null); // { nbImportees, nbErreurs }
  const fileRef = useRef(null);

  function telechargerDocumentation() {
    const contenu = genererDocumentationImport("questions", chapitres, niveauScolaire);
    const blob = new Blob([contenu], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `documentation_import_questions_${niveauScolaire}.jsonc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function telechargerExempleQuestions() {
    const exemple = [
      {
        chapitre: "Nom exact d'un chapitre existant",
        mode: "fixe",
        id: "PREFIXE_XX_01",
        type: "méthode",
        enonce: "Comment calcule-t-on la dérivée d'une fonction ?",
        reponse: "On applique les formules de dérivation usuelles.",
        niveau: 2,
      },
      {
        chapitre: "Nom exact d'un chapitre existant",
        mode: "aleatoire",
        enonce_modele: "Résoudre l'équation ${a}x + {b} = 0$",
        reponse_modele: "$x = {frac(-b, a)}$",
        parametres: {
          a: { type: "entier_non_nul", min: -9, max: 9 },
          b: { type: "entier", min: -9, max: 9 },
        },
        niveau: 2,
      },
      {
        chapitre: "Nom exact d'un chapitre existant",
        mode: "aleatoire",
        enonce_modele: "L'opération qui permet de calculer {a} % de {b} est :",
        reponse_modele: "${a}/100 \\times {b}$",
        parametres: {
          a: { type: "liste", valeurs: [20, 25, 50, 75, 80] },
          b: { type: "entier", min: 20, max: 2000 },
        },
        type_calcul: "pourcentage",
        niveau: 1,
      },
    ];
    const blob = new Blob([JSON.stringify(exemple, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exemple_import_questions.json";
    a.click();
    URL.revokeObjectURL(url);
  }

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

      const [{ data: existantesFixe }, { data: existantesAleatoire }] = await Promise.all([
        supabase.from("questions").select("id"),
        supabase.from("exercices_application").select("id"),
      ]);
      const idsExistantsFixe = new Set((existantesFixe || []).map(q => q.id));
      const idsExistantsAleatoire = new Set((existantesAleatoire || []).map(q => q.id));
      const idsAttribuesFixe = new Set();       // suivi au fil de CET import
      const idsAttribuesAleatoire = new Set();

      const chapitresParNom = {};
      chapitres.forEach(c => { chapitresParNom[c.nom.trim().toLowerCase()] = c.id; });

      // Sigles officiels (table prefixes_chapitres), indexés par chapitre_id —
      // un seul sigle par chapitre, partagé par le mode fixe ET aléatoire.
      const prefixesTable = await prefixesParChapitreId(chapitres.map(c => c.id));

      const initiales = initialesAuteur(currentProfile?.prenom, currentProfile?.nom);

      const valides = [];          // fixe : id déjà conforme, pas de conflit
      const corrections = [];      // fixe : id non conforme et/ou en conflit → id recalculé
      const valideesAleatoire = [];// aléatoire : id généré automatiquement
      const invalidesAleatoire = [];
      const chapitresInconnus = [];

      liste.forEach((q, idx) => {
        const nomChap = (q.chapitre || "").trim().toLowerCase();
        const chapitreId = chapitresParNom[nomChap];

        if (!chapitreId) {
          chapitresInconnus.push({ ...q, _ligne: idx + 1 });
          return;
        }

        // Sigle officiel si ce chapitre en a un ; sinon repli auto-dérivé du nom
        // (ex. chapitres de Première, pas encore renseignés dans la table).
        const prefixeAuto = ((q.chapitre || "").split(" ").map(w => w[0]).filter(Boolean).join("") || "AUT").toUpperCase().slice(0, 4);
        const prefixe = prefixesTable[chapitreId] || prefixeAuto;

        const mode = q.mode === "aleatoire" ? "aleatoire" : "fixe";

        if (mode === "aleatoire") {
          if (!q.enonce_modele || !q.reponse_modele || !q.parametres || typeof q.parametres !== "object" || Array.isArray(q.parametres)) {
            invalidesAleatoire.push({ ...q, _ligne: idx + 1, _erreur: "enonce_modele, reponse_modele et parametres (objet) requis" });
            return;
          }
          const prefixeComplet = `${prefixe}_${initiales}_EX`;
          let n = 1, idCandidat;
          do {
            idCandidat = `${prefixeComplet}${String(n).padStart(2, "0")}`;
            n++;
          } while (idsExistantsAleatoire.has(idCandidat) || idsAttribuesAleatoire.has(idCandidat));
          idsAttribuesAleatoire.add(idCandidat);
          valideesAleatoire.push({ ...q, _chapitreId: chapitreId, _idGenere: idCandidat });
          return;
        }

        // Mode fixe : sigle officiel ou repli auto-dérivé (tous les niveaux
        // sont donc désormais couverts, plus de limitation à Terminale Spé)
        const prefixeComplet = `${prefixe}_${initiales}`;
        const conforme = idRespecteConvention(q.id, prefixe, initiales);
        const enConflit = idsExistantsFixe.has(q.id) || idsAttribuesFixe.has(q.id);

        if (conforme && !enConflit) {
          idsAttribuesFixe.add(q.id);
          valides.push({ ...q, _chapitreId: chapitreId });
        } else {
          const idCorrige = prochainNumeroLibre(prefixeComplet, idsExistantsFixe, idsAttribuesFixe);
          idsAttribuesFixe.add(idCorrige);
          corrections.push({
            ...q,
            _chapitreId: chapitreId,
            _idOriginal: q.id,
            _idCorrige: idCorrige,
            _raison: enConflit ? "id déjà utilisé" : "ne respecte pas la convention",
          });
        }
      });

      setAnalyse({ valides, corrections, valideesAleatoire, invalidesAleatoire, chapitresInconnus });
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

    // Fixe → table questions (id déjà conforme + corrections)
    const questionsAInserer = [
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
    // Aléatoire → table exercices_application (id généré à l'analyse)
    // type_calcul est omis quand il n'est pas fourni (plutôt qu'envoyé à null) :
    // comme CreerQuestion ne l'envoie jamais non plus pour la création manuelle,
    // ça laisse une éventuelle valeur par défaut Supabase s'appliquer.
    const exercicesAInserer = analyse.valideesAleatoire.map(q => {
      const ligne = {
        id: q._idGenere, chapitre_id: q._chapitreId,
        enonce_modele: q.enonce_modele, reponse_modele: q.reponse_modele,
        parametres: q.parametres, niveau: q.niveau || 2, prof_id: currentUser.id,
      };
      if (q.type_calcul) ligne.type_calcul = q.type_calcul;
      return ligne;
    });

    let nbImportees = 0;
    let nbErreurs = 0;
    const detailsErreurs = []; // { id, message } — pour affichage et diagnostic

    // Insertion ligne par ligne (pas par lot) : si une ligne a un problème de
    // schéma (colonne NOT NULL, contrainte...), les autres s'importent quand
    // même, et on sait précisément laquelle a échoué et pourquoi.
    for (const q of questionsAInserer) {
      const { error } = await supabase.from("questions").insert(q);
      if (error) { nbErreurs++; detailsErreurs.push({ id: q.id, message: error.message }); }
      else nbImportees++;
    }
    for (const ex of exercicesAInserer) {
      const { error } = await supabase.from("exercices_application").insert(ex);
      if (error) { nbErreurs++; detailsErreurs.push({ id: ex.id, message: error.message }); }
      else nbImportees++;
    }

    setImporting(false);
    setResultat({ nbImportees, nbErreurs, detailsErreurs });
    onImportTermine();
  }

  const totalAImporter = analyse ? analyse.valides.length + analyse.corrections.length + analyse.valideesAleatoire.length : 0;

  return (
    <div className="import-overlay">
      <div className="import-card">
        <div className="import-title">Importer des questions</div>

        <div className="import-scroll-body">
        <div className="import-format-guide">
          <table className="import-format-table">
            <thead>
              <tr><th>Champ</th><th>Obligatoire</th><th>Détail</th></tr>
            </thead>
            <tbody>
              <tr><td><code>chapitre</code></td><td>toujours</td><td>Nom exact d'un chapitre déjà créé (insensible à la casse)</td></tr>
              <tr><td><code>mode</code></td><td>non</td><td><code>"fixe"</code> (défaut) ou <code>"aleatoire"</code></td></tr>
              <tr><td><code>id</code>, <code>type</code></td><td>si fixe</td><td><code>id</code> auto-corrigé s'il est absent ou déjà pris ; <code>type</code> = formule/méthode/définition/théorème/exercice</td></tr>
              <tr><td><code>enonce</code>, <code>reponse</code></td><td>si fixe</td><td>textes bruts (LaTeX entre <code>$...$</code> accepté)</td></tr>
              <tr><td><code>enonce_modele</code>, <code>reponse_modele</code>, <code>parametres</code></td><td>si aléatoire</td><td>id généré automatiquement, <code>parametres</code> = objet (voir l'exemple)</td></tr>
              <tr><td><code>niveau</code></td><td>non</td><td>2 par défaut</td></tr>
            </tbody>
          </table>
          <div className="import-format-actions">
            <button className="import-format-example-btn" onClick={telechargerDocumentation}>📖 Documentation complète</button>
            <button className="import-format-example-btn" onClick={telechargerExempleQuestions}>📥 Télécharger un exemple</button>
          </div>
        </div>

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
                ✅ {analyse.valides.length} question{analyse.valides.length !== 1 ? "s" : ""} fixe{analyse.valides.length !== 1 ? "s" : ""} prête{analyse.valides.length !== 1 ? "s" : ""} à importer
              </div>
            </div>

            {analyse.valideesAleatoire.length > 0 && (
              <div className="import-report-section">
                <div className="import-report-header ok">
                  ✅ {analyse.valideesAleatoire.length} exercice{analyse.valideesAleatoire.length !== 1 ? "s" : ""} aléatoire{analyse.valideesAleatoire.length !== 1 ? "s" : ""} prêt{analyse.valideesAleatoire.length !== 1 ? "s" : ""} à importer
                </div>
                {analyse.valideesAleatoire.map((q, i) => (
                  <div key={i} className="import-report-item">
                    <span className="import-report-item-id">{q._idGenere}</span>
                    <span className="import-report-item-detail">{q.enonce_modele}</span>
                  </div>
                ))}
              </div>
            )}

            {analyse.invalidesAleatoire.length > 0 && (
              <div className="import-report-section">
                <div className="import-report-header warn">
                  ❌ {analyse.invalidesAleatoire.length} exercice{analyse.invalidesAleatoire.length !== 1 ? "s" : ""} aléatoire{analyse.invalidesAleatoire.length !== 1 ? "s" : ""} avec des champs invalides (non importé{analyse.invalidesAleatoire.length !== 1 ? "s" : ""})
                </div>
                {analyse.invalidesAleatoire.map((q, i) => (
                  <div key={i} className="import-report-item">
                    <span className="import-report-item-id">ligne {q._ligne}</span>
                    <span className="import-report-item-detail">{q._erreur}</span>
                  </div>
                ))}
              </div>
            )}

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
          </div>
        )}

        {resultat && (
          <div className="import-result">
            <div className="import-result-icon">{resultat.nbErreurs === 0 ? "🎉" : "⚠️"}</div>
            <div>
              <strong>{resultat.nbImportees}</strong> question{resultat.nbImportees !== 1 ? "s" : ""} importée{resultat.nbImportees !== 1 ? "s" : ""}
              {resultat.nbErreurs > 0 && <> · {resultat.nbErreurs} erreur{resultat.nbErreurs !== 1 ? "s" : ""}</>}
            </div>
            {resultat.detailsErreurs?.length > 0 && (
              <div className="import-report" style={{ marginTop: 12, textAlign: "left" }}>
                {resultat.detailsErreurs.map((e, i) => (
                  <div key={i} className="import-report-item">
                    <span className="import-report-item-id">{e.id || "(sans id)"}</span>
                    <span className="import-report-item-detail">{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>

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

// ─── Composant ImportQcm ────────────────────────────────────────────────
// Import en masse de QCM depuis un fichier JSON. Contrairement aux questions
// classiques, l'id du QCM est un uuid généré par Supabase — pas de convention
// de nommage à vérifier, donc l'analyse est plus simple : on matche juste le
// chapitre par son nom et on valide les champs requis selon le mode.
function ImportQcm({ currentUser, chapitres, niveauScolaire, onFermer, onImportTermine }) {
  const [fichier, setFichier] = useState(null);
  const [analyse, setAnalyse] = useState(null); // { valides, invalides, chapitresInconnus }
  const [analysing, setAnalysing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultat, setResultat] = useState(null);
  const fileRef = useRef(null);

  // Vérifie les champs requis selon le mode ; retourne null si valide, ou un message d'erreur
  function telechargerDocumentation() {
    const contenu = genererDocumentationImport("qcm", chapitres, niveauScolaire);
    const blob = new Blob([contenu], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `documentation_import_qcm_${niveauScolaire}.jsonc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function telechargerExempleQcm() {
    const exemple = [
      {
        chapitre: "Nom exact d'un chapitre existant",
        mode: "fixe",
        enonce: "25 % de 480 est égal à :",
        choix: ["120", "12", "1200", "1,2"],
        bonne_reponse: 0,
        niveau: 1,
      },
      {
        chapitre: "Nom exact d'un chapitre existant",
        mode: "aleatoire",
        enonce_modele: "L'opération qui permet de calculer {a} % de {b} est :",
        choix_modele: [
          "$\\dfrac{{b}}{{a}\\times 100}$",
          "${a}\\times {b}\\times 0,1$",
          "$\\dfrac{{b}\\times 100}{{a}}$",
          "$\\dfrac{{a}}{{100}}\\times {b}$",
        ],
        bonne_reponse: 3,
        parametres: {
          a: { type: "liste", valeurs: [20, 25, 50, 75, 80] },
          b: { type: "entier", min: 20, max: 2000 },
        },
        niveau: 1,
      },
    ];
    const blob = new Blob([JSON.stringify(exemple, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exemple_import_qcm.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function validerQcm(q) {
    const mode = q.mode === "aleatoire" ? "aleatoire" : "fixe";
    if (typeof q.bonne_reponse !== "number" || q.bonne_reponse < 0 || q.bonne_reponse > 3) {
      return "bonne_reponse doit être 0, 1, 2 ou 3";
    }
    if (mode === "fixe") {
      if (!q.enonce || !Array.isArray(q.choix) || q.choix.length !== 4 || q.choix.some(c => !c || typeof c !== "string")) {
        return "mode fixe : enonce et choix (tableau de 4 textes) requis";
      }
    } else {
      if (!q.enonce_modele || !Array.isArray(q.choix_modele) || q.choix_modele.length !== 4 || q.choix_modele.some(c => !c || typeof c !== "string")) {
        return "mode aléatoire : enonce_modele et choix_modele (tableau de 4 textes) requis";
      }
      if (!q.parametres || typeof q.parametres !== "object" || Array.isArray(q.parametres)) {
        return "mode aléatoire : parametres (objet) requis";
      }
    }
    return null;
  }

  async function analyserFichier(file) {
    setAnalysing(true);
    setResultat(null);
    try {
      const texte = await file.text();
      const data = JSON.parse(texte);
      const liste = Array.isArray(data) ? data : (data.qcm || []);

      const chapitresParNom = {};
      chapitres.forEach(c => { chapitresParNom[c.nom.trim().toLowerCase()] = c.id; });

      const valides = [];
      const invalides = [];
      const chapitresInconnus = [];

      liste.forEach((q, idx) => {
        const nomChap = (q.chapitre || "").trim().toLowerCase();
        const chapitreId = chapitresParNom[nomChap];
        if (!chapitreId) {
          chapitresInconnus.push({ ...q, _ligne: idx + 1 });
          return;
        }
        const erreur = validerQcm(q);
        if (erreur) {
          invalides.push({ ...q, _ligne: idx + 1, _erreur: erreur });
          return;
        }
        valides.push({ ...q, _chapitreId: chapitreId });
      });

      setAnalyse({ valides, invalides, chapitresInconnus });
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

    const aInserer = analyse.valides.map(q => {
      const mode = q.mode === "aleatoire" ? "aleatoire" : "fixe";
      const base = {
        chapitre_id: q._chapitreId, mode, bonne_reponse: q.bonne_reponse,
        niveau: q.niveau || 1, prof_id: currentUser.id,
      };
      const donnees = mode === "fixe"
        ? { ...base, enonce: q.enonce, choix: q.choix, enonce_modele: null, choix_modele: null, parametres: null }
        : { ...base, enonce: null, choix: null, enonce_modele: q.enonce_modele, choix_modele: q.choix_modele, parametres: q.parametres };
      return { ...donnees, _apercu: (q.enonce || q.enonce_modele || "").slice(0, 40) };
    });

    let nbImportees = 0;
    let nbErreurs = 0;
    const detailsErreurs = [];
    for (const { _apercu, ...q } of aInserer) {
      const { error } = await supabase.from("qcm").insert(q);
      if (error) { nbErreurs++; detailsErreurs.push({ id: _apercu, message: error.message }); }
      else nbImportees++;
    }

    setImporting(false);
    setResultat({ nbImportees, nbErreurs, detailsErreurs });
    onImportTermine();
  }

  const totalAImporter = analyse ? analyse.valides.length : 0;

  return (
    <div className="import-overlay">
      <div className="import-card">
        <div className="import-title">Importer des QCM</div>

        <div className="import-scroll-body">
        <div className="import-format-guide">
          <table className="import-format-table">
            <thead>
              <tr><th>Champ</th><th>Obligatoire</th><th>Détail</th></tr>
            </thead>
            <tbody>
              <tr><td><code>chapitre</code></td><td>toujours</td><td>Nom exact d'un chapitre déjà créé (insensible à la casse)</td></tr>
              <tr><td><code>mode</code></td><td>non</td><td><code>"fixe"</code> (défaut) ou <code>"aleatoire"</code></td></tr>
              <tr><td><code>enonce</code>, <code>choix</code></td><td>si fixe</td><td><code>choix</code> = tableau de 4 textes</td></tr>
              <tr><td><code>enonce_modele</code>, <code>choix_modele</code>, <code>parametres</code></td><td>si aléatoire</td><td><code>parametres</code> = objet (voir l'exemple)</td></tr>
              <tr><td><code>bonne_reponse</code></td><td>toujours</td><td>index 0 à 3</td></tr>
              <tr><td><code>niveau</code></td><td>non</td><td>1 par défaut</td></tr>
            </tbody>
          </table>
          <div className="import-format-actions">
            <button className="import-format-example-btn" onClick={telechargerDocumentation}>📖 Documentation complète</button>
            <button className="import-format-example-btn" onClick={telechargerExempleQcm}>📥 Télécharger un exemple</button>
          </div>
        </div>

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
                ✅ {analyse.valides.length} QCM prêt{analyse.valides.length !== 1 ? "s" : ""} à importer
              </div>
            </div>

            {analyse.invalides.length > 0 && (
              <div className="import-report-section">
                <div className="import-report-header warn">
                  ❌ {analyse.invalides.length} QCM avec des champs invalides (non importé{analyse.invalides.length !== 1 ? "s" : ""})
                </div>
                {analyse.invalides.map((q, i) => (
                  <div key={i} className="import-report-item">
                    <span className="import-report-item-id">ligne {q._ligne}</span>
                    <span className="import-report-item-detail">{q._erreur}</span>
                  </div>
                ))}
              </div>
            )}

            {analyse.chapitresInconnus.length > 0 && (
              <div className="import-report-section">
                <div className="import-report-header warn">
                  ❌ {analyse.chapitresInconnus.length} QCM avec un chapitre introuvable (non importé{analyse.chapitresInconnus.length !== 1 ? "s" : ""})
                </div>
                {analyse.chapitresInconnus.map((q, i) => (
                  <div key={i} className="import-report-item">
                    <span className="import-report-item-id">ligne {q._ligne}</span>
                    <span className="import-report-item-detail">Chapitre indiqué : "{q.chapitre}"</span>
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
              <strong>{resultat.nbImportees}</strong> QCM importé{resultat.nbImportees !== 1 ? "s" : ""}
              {resultat.nbErreurs > 0 && <> · {resultat.nbErreurs} erreur{resultat.nbErreurs !== 1 ? "s" : ""}</>}
            </div>
            {resultat.detailsErreurs?.length > 0 && (
              <div className="import-report" style={{ marginTop: 12, textAlign: "left" }}>
                {resultat.detailsErreurs.map((e, i) => (
                  <div key={i} className="import-report-item">
                    <span className="import-report-item-id">{e.id || "(sans énoncé)"}</span>
                    <span className="import-report-item-detail">{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>

        <div className="import-actions">
          {!resultat ? (
            <>
              <button className="diapo-cancel-btn" onClick={onFermer}>Annuler</button>
              <button className="diapo-launch-btn" onClick={lancerImport}
                disabled={!analyse || analyse.erreurParsing || importing || totalAImporter === 0}>
                {importing ? "Import en cours…" : `Importer ${totalAImporter} QCM`}
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

  useEffect(() => {
    supabase.rpc("get_usage_stats").then(({ data, error }) => {
      if (!error && data) setStats(data);
    });
  }, []);

  if (!stats) return null;

  const LIMITE_DB = 500 * 1024 * 1024;       // 500 Mo
  const LIMITE_STORAGE = 1024 * 1024 * 1024; // 1 Go

  const pctDb = Math.min(100, Math.round((stats.database_bytes / LIMITE_DB) * 100));
  const pctStorage = Math.min(100, Math.round((stats.storage_bytes / LIMITE_STORAGE) * 100));

  return (
    <div className="usage-indicator">
      <span className={`usage-badge${pctDb > 80 ? " alerte" : ""}`}
        title={`Base de données : ${formatTaille(stats.database_bytes)} / 500 Mo`}>
        🗄️ {pctDb}%
      </span>
      <span className={`usage-badge${pctStorage > 80 ? " alerte" : ""}`}
        title={`Fichiers (photos, PDF) : ${formatTaille(stats.storage_bytes)} / 1 Go`}>
        📁 {pctStorage}%
      </span>
    </div>
  );
}

// ─── Composant HistoriqueZone ───────────────────────────────────────────
function HistoriqueZone({ currentUser, currentProfile, allProfiles, onRejouer, niveauScolaire, actif, historiqueVersion }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState("mes_sessions"); // "mes_sessions" | "favoris" | "partagees"
  const [renommageId, setRenommageId] = useState(null);
  const [brouillonNom, setBrouillonNom] = useState("");
  const [sessionASupprimer, setSessionASupprimer] = useState(null); // session en attente de confirmation
  const [famillesDepliees, setFamillesDepliees] = useState(() => new Set()); // clés de familles dont l'historique des tirages est affiché

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const niveau = niveauScolaire || "terminale_spe";
    let requete = supabase.from("sessions_historique").select("*")
      .eq("niveau_scolaire", niveau)
      .order("updated_at", { ascending: false });
    if (filtre === "mes_sessions") requete = requete.eq("prof_id", currentUser.id);
    else if (filtre === "favoris") requete = requete.eq("prof_id", currentUser.id).eq("favori", true);
    else if (filtre === "partagees") requete = requete.eq("partage", true).neq("prof_id", currentUser.id);
    const { data } = await requete.limit(100);
    setSessions(data || []);
    setLoading(false);
  }, [filtre, currentUser.id, niveauScolaire]);

  useEffect(() => {
    if (!actif) return;
    fetchSessions();
  }, [actif, fetchSessions, historiqueVersion]);

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

  function demanderSuppressionSession(session) {
    setSessionASupprimer(session);
  }

  async function confirmerSuppressionSession() {
    const session = sessionASupprimer;
    if (!session) return;
    setSessionASupprimer(null);
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

  // Regroupe les sessions par famille (même signature = mêmes ids, indépendamment du tirage).
  // `sessions` est trié par updated_at desc, donc pour chaque famille le premier élément
  // rencontré est le tirage le plus récent — l'ordre des familles suit naturellement
  // l'activité la plus récente en premier.
  const familles = useMemo(() => {
    const map = new Map();
    sessions.forEach(s => {
      const cle = `${s.type_session}__${s.signature}`;
      if (!map.has(cle)) map.set(cle, []);
      map.get(cle).push(s);
    });
    return [...map.values()];
  }, [sessions]);

  function toggleFamille(cle) {
    setFamillesDepliees(prev => {
      const copie = new Set(prev);
      if (copie.has(cle)) copie.delete(cle); else copie.add(cle);
      return copie;
    });
  }

  function libelleAction(action) {
    if (action === "tex_eleve") return "📝 .tex élève";
    if (action === "tex_corrige") return "📝 .tex corrigé";
    if (action === "diaporama") return "▶ Diaporama";
    if (action === "pdf") return "📄 PDF";
    return "";
  }

  const estProprietaire = (session) => session.prof_id === currentUser.id;

  function renderCarte(session, secondaire) {
    return (
      <div key={session.id} className={`hist-card${secondaire ? " hist-card-secondaire" : ""}`}>
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
              {session.type_session === "qcm" && <span className="hist-badge qcm">🔤 QCM</span>}
              {session.partage && <span className="hist-badge partage">Partagée</span>}
              {!estProprietaire(session) && <span className="hist-card-auteur">par {nomAuteur(session.prof_id)}</span>}
            </div>
          </div>
          <div className="hist-card-actions">
            {estProprietaire(session) && (
              <>
                <button className={`hist-icon-btn${session.favori ? " fav-active" : ""}`}
                  onClick={() => toggleFavori(session)} title={session.favori ? "Retirer des favoris" : "Mettre en favori"}>
                  {session.favori ? "★" : "☆"}
                </button>
                <button className="hist-icon-btn" onClick={() => commencerRenommage(session)} title="Renommer">✏️</button>
                <button className="hist-icon-btn" onClick={() => togglePartage(session)}
                  title={session.partage ? "Rendre privée" : "Partager avec mes collègues"}>
                  {session.partage ? "🔓" : "🔒"}
                </button>
                <button className="hist-icon-btn" onClick={() => demanderSuppressionSession(session)} title="Supprimer">🗑️</button>
              </>
            )}
          </div>
        </div>
        {(() => {
          const contenu = session.contenu_selection;
          const aAleatoire = Array.isArray(contenu) && contenu.some(q => q.mode === "aleatoire" || q._aleatoire === true);
          if (contenu && aAleatoire) {
            return (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="hist-card-rejouer" onClick={() => onRejouer(session, "memes")} title="Recharge exactement les mêmes valeurs qu'à l'origine">
                  ↻ Mêmes valeurs
                </button>
                <button className="hist-card-rejouer" onClick={() => onRejouer(session, "nouvelles")} title="Retire de nouvelles valeurs pour les éléments aléatoires">
                  🎲 Nouvelles valeurs
                </button>
              </div>
            );
          }
          return (
            <button className="hist-card-rejouer" onClick={() => onRejouer(session, "nouvelles")}>
              ↻ Rejouer cette sélection
            </button>
          );
        })()}
      </div>
    );
  }

  return (
    <>
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
        <div className="hist-empty"><div className="spinner"></div>Chargement…</div>
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
          {familles.map(groupe => {
            const [tete, ...anciens] = groupe;
            const cleFamille = `${tete.type_session}__${tete.signature}`;
            const estDepliee = famillesDepliees.has(cleFamille);
            return (
              <div key={cleFamille} className="hist-famille">
                {renderCarte(tete, false)}
                {anciens.length > 0 && (
                  <button className="hist-famille-toggle" onClick={() => toggleFamille(cleFamille)}>
                    {estDepliee ? "▲ Masquer" : "🔄"} {anciens.length} tirage{anciens.length > 1 ? "s" : ""} précédent{anciens.length > 1 ? "s" : ""}
                  </button>
                )}
                {estDepliee && anciens.map(session => renderCarte(session, true))}
              </div>
            );
          })}
        </div>
      )}
    </div>
    {sessionASupprimer && (
      <ConfirmModal
        titre="Supprimer cette session ?"
        message={`"${sessionASupprimer.nom}" sera définitivement supprimée.\nCette action est irréversible.`}
        texteConfirmer="Supprimer"
        danger
        onConfirm={confirmerSuppressionSession}
        onAnnuler={() => setSessionASupprimer(null)}
      />
    )}
    </>
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
function CreerQuestion({ chapitres, currentUser, currentProfile, niveauScolaire, onFermer, onCree, questionAEditer }) {
  const estEdition = !!questionAEditer;
  // En édition, détecter le mode selon le type de la question
  const modeInitial = questionAEditer
    ? (questionAEditer._source === "base_aleatoire" ? "aleatoire" : "fixe")
    : "fixe";

  const [mode, setMode] = useState(modeInitial);
  const [chapitreId, setChapitreId] = useState(
    questionAEditer?.chapitre_id || chapitres[0]?.id || ""
  );
  const [type, setType] = useState(questionAEditer?.type || "formule");
  const [niveau, setNiveau] = useState(questionAEditer?.niveau || 1);
  const [enonce, setEnonce] = useState(
    questionAEditer?.enonce_modele || questionAEditer?.enonce || ""
  );
  const [reponse, setReponse] = useState(
    questionAEditer?.reponse_modele || questionAEditer?.reponse || ""
  );
  // Initialiser les params depuis la question à éditer si mode aléatoire
  const paramsInitiaux = questionAEditer?.parametres
    ? Object.entries(questionAEditer.parametres).map(([nom, def]) => ({
        nom, min: String(def.min ?? ""), max: String(def.max ?? ""), type: def.type || "entier",
        valeurs: (def.valeurs || []).join(", "),
      }))
    : [];
  const [params, setParams] = useState(paramsInitiaux);
  const [testResultat, setTestResultat] = useState(null);
  const [testErreur, setTestErreur] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const variablesDetectees = useMemo(() => {
    // Normalise \{var\} → {var} avant d'analyser
    const texteNorm = (enonce + " " + reponse).replace(/\\{([^{}]+)\\}/g, "{$1}");
    const variables = new Set();
    const regex = /\{([^{}]+)\}/g;
    let match;
    while ((match = regex.exec(texteNorm)) !== null) {
      const expr = match[1].trim();
      if (/^poly\(/.test(expr)) {
        const interieur = expr.match(/^poly\((.+)\)$/)?.[1] || "";
        interieur.split(",").forEach(t => {
          const nom = t.split(":")[0].trim();
          if (/^[a-zA-Z]+$/.test(nom)) variables.add(nom);
        });
      } else if (/^frac\(/.test(expr)) {
        // Extraire les variables des deux arguments de frac()
        const interieur = expr.match(/^frac\((.+),(.+)\)$/);
        if (interieur) {
          [interieur[1], interieur[2]].forEach(arg => {
            (arg.match(/[a-zA-Z]+/g) || []).forEach(l => variables.add(l));
          });
        }
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
      return variablesDetectees.map(nom => existants[nom] || { nom, min: "-10", max: "10", type: "entier", valeurs: "" });
    });
  }, [variablesDetectees, mode]);

  function mettreAJourParam(index, champ, valeur) {
    setParams(prev => prev.map((p, i) => i === index ? { ...p, [champ]: valeur } : p));
  }

  function lancerTest() {
    setTestErreur(null);
    try {
      const parametres = construireParametres(params);
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
      const donnees = {
        chapitre_id: chapitreId, type, enonce: enonce.trim(),
        reponse: reponse.trim(), niveau,
      };
      let error;
      if (estEdition && questionAEditer._source === "base_fixe") {
        ({ error } = await supabase.from("questions").update(donnees).eq("id", questionAEditer.id));
      } else {
        const initiales = initialesAuteur(currentProfile?.prenom, currentProfile?.nom);
        const chapitreCourant = chapitres.find(c => c.id === chapitreId);
        const prefixesTable = await prefixesParChapitreId([chapitreId]);
        const prefixeAuto = (chapitreCourant?.nom.split(" ").map(w => w[0]).filter(Boolean).join("") || "AUT").toUpperCase().slice(0, 4);
        const prefixe = prefixesTable[chapitreId] || prefixeAuto;
        const { data: existantes } = await supabase.from("questions").select("id").eq("chapitre_id", chapitreId);
        const idsExistants = new Set((existantes || []).map(q => q.id));
        let n = 1, id;
        do { id = `${prefixe}_${initiales}_${String(n).padStart(2, "0")}`; n++; } while (idsExistants.has(id));
        ({ error } = await supabase.from("questions").insert({ ...donnees, id, prof_id: currentUser.id }));
      }
      setEnregistrement(false);
      if (error) { alert("Erreur : " + error.message); return; }
    } else {
      const parametres = construireParametres(params);
      if (estEdition && questionAEditer._source === "base_aleatoire") {
        const { error } = await supabase.from("exercices_application").update({
          chapitre_id: chapitreId, enonce_modele: enonce.trim(),
          reponse_modele: reponse.trim(), parametres, niveau,
        }).eq("id", questionAEditer.id);
        setEnregistrement(false);
        if (error) { alert("Erreur : " + error.message); return; }
      } else {
        const initiales = initialesAuteur(currentProfile?.prenom, currentProfile?.nom);
        const { data: existants } = await supabase.from("exercices_application").select("id").eq("chapitre_id", chapitreId);
        const nn = String((existants?.length || 0) + 1).padStart(2, "0");
        const chapitreCourant = chapitres.find(c => c.id === chapitreId);
        const prefixesTable = await prefixesParChapitreId([chapitreId]);
        const prefixeAuto = (chapitreCourant?.nom.split(" ").map(w => w[0]).filter(Boolean).join("") || "AUT").toUpperCase().slice(0, 4);
        const prefixe = prefixesTable[chapitreId] || prefixeAuto;
        const id = `${prefixe}_${initiales}_EX${nn}`;
        const { error } = await supabase.from("exercices_application").insert({
          id, chapitre_id: chapitreId, enonce_modele: enonce.trim(),
          reponse_modele: reponse.trim(), parametres, niveau, prof_id: currentUser.id,
        });
        setEnregistrement(false);
        if (error) { alert("Erreur : " + error.message); return; }
      }
    }
    onCree();
  }

  return (
    <div className="creer-overlay" onClick={e => e.target === e.currentTarget && onFermer()}>
      <div className="creer-card">
        <div className="creer-title">{estEdition ? "✏️ Modifier la question" : "➕ Créer une question"}</div>
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
                Variable : <code>{"{a}"}</code> · Calcul : <code>{"{2a}"}</code> · Polynôme : <code>{"{poly(a:2, b:1, c:0)}"}</code> · Fraction exacte : <code>{"{frac(-b, a)}"}</code> · Racine exacte : <code>{"{sqrt(a*a+b*b)}"}</code>
              </div>
            )}
            {mode === "aleatoire" && (
              <div className="creer-hint">
                ⚠️ Un nombre constant entre accolades LaTeX (numérateur, dénominateur…) doit être doublé, ex. <code>{"{{100}}"}</code> et non <code>{"{100}"}</code>, sinon les accolades sont mangées par la substitution.
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
                      {p.type === "liste" ? (
                        <input type="text" className="creer-param-liste-input" value={p.valeurs}
                          onChange={e => mettreAJourParam(i, "valeurs", e.target.value)}
                          placeholder="Ex : 20, 25, 50, 75, 80" />
                      ) : (
                        <>
                          <input type="number" className="creer-param-input" value={p.min} onChange={e => mettreAJourParam(i, "min", e.target.value)} />
                          <span className="creer-param-sep">à</span>
                          <input type="number" className="creer-param-input" value={p.max} onChange={e => mettreAJourParam(i, "max", e.target.value)} />
                        </>
                      )}
                      <select className="creer-param-type" value={p.type} onChange={e => mettreAJourParam(i, "type", e.target.value)}>
                        <option value="entier">Entier</option>
                        <option value="entier_non_nul">Entier ≠ 0</option>
                        <option value="decimal">Décimal</option>
                        <option value="liste">Liste de valeurs</option>
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
            {enregistrement ? "Enregistrement…" : estEdition ? "Mettre à jour" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant CreerQcm (création/édition d'un QCM, fixe ou aléatoire) ──
function CreerQcm({ chapitres, currentUser, niveauScolaire, onFermer, onCree, qcmAEditer }) {
  const estEdition = !!qcmAEditer;
  const [mode, setMode] = useState(qcmAEditer?.mode || "fixe");
  const [chapitreId, setChapitreId] = useState(qcmAEditer?.chapitre_id || chapitres[0]?.id || "");
  const [niveau, setNiveau] = useState(qcmAEditer?.niveau || 1);
  const [enonce, setEnonce] = useState(
    qcmAEditer?.enonce_modele || qcmAEditer?.enonce || ""
  );
  const [choix, setChoix] = useState(
    qcmAEditer?.choix_modele || qcmAEditer?.choix || ["", "", "", ""]
  );
  const [bonneReponse, setBonneReponse] = useState(qcmAEditer?.bonne_reponse ?? 0);
  const paramsInitiaux = qcmAEditer?.parametres
    ? Object.entries(qcmAEditer.parametres).map(([nom, def]) => ({
        nom, min: String(def.min ?? ""), max: String(def.max ?? ""), type: def.type || "entier",
        valeurs: (def.valeurs || []).join(", "),
      }))
    : [];
  const [params, setParams] = useState(paramsInitiaux);
  const [testResultat, setTestResultat] = useState(null);
  const [testErreur, setTestErreur] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);

  function mettreAJourChoix(index, valeur) {
    setChoix(prev => prev.map((c, i) => i === index ? valeur : c));
  }

  // Détecte les variables {a}, {poly(...)}, {frac(...)} dans l'énoncé ET les 4 choix
  const variablesDetectees = useMemo(() => {
    const texteNorm = (enonce + " " + choix.join(" ")).replace(/\\{([^{}]+)\\}/g, "{$1}");
    const variables = new Set();
    const regex = /\{([^{}]+)\}/g;
    let match;
    while ((match = regex.exec(texteNorm)) !== null) {
      const expr = match[1].trim();
      if (/^poly\(/.test(expr)) {
        const interieur = expr.match(/^poly\((.+)\)$/)?.[1] || "";
        interieur.split(",").forEach(t => {
          const nom = t.split(":")[0].trim();
          if (/^[a-zA-Z]+$/.test(nom)) variables.add(nom);
        });
      } else if (/^frac\(/.test(expr)) {
        const interieur = expr.match(/^frac\((.+),(.+)\)$/);
        if (interieur) {
          [interieur[1], interieur[2]].forEach(arg => {
            (arg.match(/[a-zA-Z]+/g) || []).forEach(l => variables.add(l));
          });
        }
      } else {
        (expr.match(/[a-zA-Z]+/g) || []).forEach(l => variables.add(l));
      }
    }
    return [...variables].sort();
  }, [enonce, choix]);

  useEffect(() => {
    if (mode !== "aleatoire") return;
    setParams(prev => {
      const existants = Object.fromEntries(prev.map(p => [p.nom, p]));
      return variablesDetectees.map(nom => existants[nom] || { nom, min: "-10", max: "10", type: "entier", valeurs: "" });
    });
  }, [variablesDetectees, mode]);

  function mettreAJourParam(index, champ, valeur) {
    setParams(prev => prev.map((p, i) => i === index ? { ...p, [champ]: valeur } : p));
  }

  const choixValides = choix.every(c => c.trim().length > 0);

  function lancerTest() {
    setTestErreur(null);
    try {
      const parametres = construireParametres(params);
      const valeurs = {};
      Object.entries(parametres).forEach(([nom, def]) => { valeurs[nom] = tirerValeurParametre(def); });
      const enonceGenere = substituerPlaceholders(enonce, valeurs);
      const choixGeneres = choix.map(c => substituerPlaceholders(c, valeurs));
      setTestResultat({ enonce: enonceGenere, choix: choixGeneres, valeurs });
    } catch (e) {
      setTestErreur(e.message);
      setTestResultat(null);
    }
  }

  async function enregistrer() {
    if (!enonce.trim() || !choixValides || !chapitreId) return;
    setEnregistrement(true);

    let donnees;
    if (mode === "fixe") {
      donnees = {
        chapitre_id: chapitreId, mode: "fixe",
        enonce: enonce.trim(), choix: choix.map(c => c.trim()),
        bonne_reponse: bonneReponse, niveau,
        enonce_modele: null, choix_modele: null, parametres: null,
      };
    } else {
      const parametres = construireParametres(params);
      donnees = {
        chapitre_id: chapitreId, mode: "aleatoire",
        enonce_modele: enonce.trim(), choix_modele: choix.map(c => c.trim()),
        bonne_reponse: bonneReponse, niveau, parametres,
        enonce: null, choix: null,
      };
    }

    const { error } = estEdition
      ? await supabase.from("qcm").update(donnees).eq("id", qcmAEditer.id)
      : await supabase.from("qcm").insert({ ...donnees, prof_id: currentUser.id });

    setEnregistrement(false);
    if (error) { alert("Erreur : " + error.message); return; }
    onCree();
  }

  const lettres = ["a", "b", "c", "d"];

  return (
    <div className="creer-overlay" onClick={e => e.target === e.currentTarget && onFermer()}>
      <div className="creer-card">
        <div className="creer-title">{estEdition ? "✏️ Modifier le QCM" : "➕ Créer un QCM"}</div>
        <div className="creer-mode-tabs">
          <button className={`creer-mode-tab${mode === "fixe" ? " active" : ""}`} onClick={() => setMode("fixe")}>📝 QCM fixe</button>
          <button className={`creer-mode-tab${mode === "aleatoire" ? " active" : ""}`} onClick={() => setMode("aleatoire")}>🎲 QCM aléatoire</button>
        </div>
        <div className="creer-body">
          <div className="creer-field">
            <label>Chapitre</label>
            <select value={chapitreId} onChange={e => setChapitreId(e.target.value)}>
              {chapitres.map(ch => <option key={ch.id} value={ch.id}>{ch.nom}</option>)}
            </select>
          </div>
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
                ? "Ex : Quelle est la dérivée de $f(x) = \\{a\\}x^2$ ?"
                : "Ex : Quelle est la limite de cette suite ?"} />
            {mode === "aleatoire" && (
              <div className="creer-hint">
                Variable : <code>{"{a}"}</code> · Calcul : <code>{"{2a}"}</code> · Polynôme : <code>{"{poly(a:2, b:1, c:0)}"}</code> · Fraction exacte : <code>{"{frac(-b, a)}"}</code> · Racine exacte : <code>{"{sqrt(a*a+b*b)}"}</code>
              </div>
            )}
            {mode === "aleatoire" && (
              <div className="creer-hint">
                ⚠️ Un nombre constant entre accolades LaTeX (numérateur, dénominateur…) doit être doublé, ex. <code>{"{{100}}"}</code> et non <code>{"{100}"}</code>, sinon les accolades sont mangées par la substitution.
              </div>
            )}
          </div>
          <div className="creer-field">
            <label>Choix {mode === "aleatoire" ? "modèles" : ""} — coche la bonne réponse</label>
            <div className="creer-choix-list">
              {choix.map((c, i) => (
                <div key={i} className={`creer-choix-row${bonneReponse === i ? " bonne" : ""}`}>
                  <input type="radio" className="creer-choix-radio" name="bonne-reponse"
                    checked={bonneReponse === i} onChange={() => setBonneReponse(i)}
                    title="Marquer comme bonne réponse" />
                  <span className="creer-choix-lettre">{lettres[i]})</span>
                  <input type="text" className="creer-choix-input" value={c}
                    onChange={e => mettreAJourChoix(i, e.target.value)}
                    placeholder={`Proposition ${lettres[i]}`} />
                </div>
              ))}
            </div>
          </div>
          {mode === "aleatoire" && (
            <>
              <div className="creer-field">
                <label>Paramètres détectés</label>
                <div className="creer-params">
                  {params.length === 0 ? (
                    <div className="creer-params-empty">Écris l'énoncé ou les choix avec des variables {"{a}"} pour les voir apparaître ici.</div>
                  ) : params.map((p, i) => (
                    <div key={p.nom} className="creer-param-row">
                      <span className="creer-param-name">{p.nom}</span>
                      {p.type === "liste" ? (
                        <input type="text" className="creer-param-liste-input" value={p.valeurs}
                          onChange={e => mettreAJourParam(i, "valeurs", e.target.value)}
                          placeholder="Ex : 20, 25, 50, 75, 80" />
                      ) : (
                        <>
                          <input type="number" className="creer-param-input" value={p.min} onChange={e => mettreAJourParam(i, "min", e.target.value)} />
                          <span className="creer-param-sep">à</span>
                          <input type="number" className="creer-param-input" value={p.max} onChange={e => mettreAJourParam(i, "max", e.target.value)} />
                        </>
                      )}
                      <select className="creer-param-type" value={p.type} onChange={e => mettreAJourParam(i, "type", e.target.value)}>
                        <option value="entier">Entier</option>
                        <option value="entier_non_nul">Entier ≠ 0</option>
                        <option value="decimal">Décimal</option>
                        <option value="liste">Liste de valeurs</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="creer-test">
                <div className="creer-test-header">
                  <span className="creer-test-label">Aperçu du tirage</span>
                  <button className="creer-test-btn" onClick={lancerTest} disabled={!enonce.trim() || !choixValides}>🎲 Tirer un exemple</button>
                </div>
                {testErreur && <div className="creer-test-err">Erreur : {testErreur}</div>}
                {testResultat ? (
                  <div className="creer-test-result">
                    <MathText inline={false}>{testResultat.enonce}</MathText>
                    <div className="creer-test-reponse">
                      {testResultat.choix.map((c, i) => (
                        <div key={i}>{lettres[i]}) <MathText>{c}</MathText>{i === bonneReponse ? " ✓" : ""}</div>
                      ))}
                    </div>
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
            disabled={enregistrement || !enonce.trim() || !choixValides || !chapitreId}>
            {enregistrement ? "Enregistrement…" : estEdition ? "Mettre à jour" : "Enregistrer"}
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
      const niveau = niveauScolaire || "terminale_spe";

      // Exercices codés en dur (bibliothèque)
      [...chapitresChoisis].forEach(chId => {
        const nomChap = chapitresParId[chId];
        Object.entries(BIBLIOTHEQUE_EXERCICES)
          .filter(([, def]) => def.chapitre === nomChap
            && def.niveauScolaire === niveau
            && niveauxChoisis.has(def.niveau))
          .forEach(([id, def]) => {
            const tirage = def.generer();
            pool.push({
              id, chapitre_id: chId, type: "exercice", niveau: def.niveau,
              enonce: tirage.enonce, reponse: tirage.reponse,
              _cle: id, _aleatoire: true,
            });
          });
      });

      // Exercices créés via le formulaire et stockés en base (jusqu'ici absents du tirage)
      const { data: exercicesBase } = await supabase.from("exercices_application").select("*")
        .in("chapitre_id", [...chapitresChoisis])
        .in("niveau", [...niveauxChoisis]);
      (exercicesBase || []).forEach(ex => {
        const tirage = tirerExercice(ex);
        pool.push({
          id: ex.id, chapitre_id: ex.chapitre_id, type: "exercice", niveau: ex.niveau,
          enonce: tirage.enonce, reponse: tirage.reponse,
          _cle: ex.id, _aleatoire: true,
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

      const pris = new Set();
      chapitresAvecQuestions.forEach(chId => {
        const tirees = melanger(parChapitre[chId]).slice(0, quotaParChapitre);
        tirees.forEach(q => pris.add(q));
        resultat.push(...tirees);
      });
      // Le quota par chapitre peut écrêter les chapitres bien fournis sans que les
      // chapitres moins fournis ne compensent : si le vivier total permet d'atteindre
      // le nombre demandé (ou de le rapprocher), on complète avec les candidats restants.
      const cible = Math.min(nombre, pool.length);
      if (resultat.length < cible) {
        const restants = pool.filter(q => !pris.has(q));
        resultat.push(...melanger(restants).slice(0, cible - resultat.length));
      }
      resultat = melanger(resultat).slice(0, nombre);
    } else {
      resultat = melanger(pool).slice(0, nombre);
    }

    if (resultat.length < nombre) {
      setAvertissement(`Seulement ${resultat.length} question${resultat.length !== 1 ? "s" : ""} trouvée${resultat.length !== 1 ? "s" : ""} sur ${nombre} demandée${nombre !== 1 ? "s" : ""} selon ces critères.`);
    }

    // Filet de sécurité : garantit une _cle sur chaque élément (les questions
    // fixes venant de "candidates" n'en ont pas nativement), sans écraser
    // celles déjà posées sur les exercices aléatoires ci-dessus.
    resultat = resultat.map(q => ({ ...q, _cle: q._cle || q.id }));

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
// ─── Composant TirageAleatoireQcm ────────────────────────────────────────
function TirageAleatoireQcm({ chapitres, onAnnuler, onTirer }) {
  const [chapitresChoisis, setChapitresChoisis] = useState(new Set());
  const [niveauxChoisis, setNiveauxChoisis] = useState(new Set([1, 2, 3]));
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
  function toggleNiveau(n) {
    setNiveauxChoisis(prev => {
      const copie = new Set(prev);
      copie.has(n) ? copie.delete(n) : copie.add(n);
      return copie;
    });
  }
  function toutSelectionner() { setChapitresChoisis(new Set(chapitres.map(c => c.id))); }
  function toutDeselectionner() { setChapitresChoisis(new Set()); }
  function toutSelectionnerOrigine(niveauScolaireCh) {
    setChapitresChoisis(prev => {
      const copie = new Set(prev);
      chapitres.filter(c => c.niveau_scolaire === niveauScolaireCh).forEach(c => copie.add(c.id));
      return copie;
    });
  }
  function toutDeselectionnerOrigine(niveauScolaireCh) {
    setChapitresChoisis(prev => {
      const copie = new Set(prev);
      chapitres.filter(c => c.niveau_scolaire === niveauScolaireCh).forEach(c => copie.delete(c.id));
      return copie;
    });
  }
  function couleurOrigine(niveauScolaireCh) {
    return niveauScolaireCh === "seconde" ? "#059669" : "#7c3aed";
  }

  async function lancerTirage() {
    if (chapitresChoisis.size === 0 || niveauxChoisis.size === 0) return;
    setTirageEnCours(true);
    setAvertissement(null);

    const { data: candidats } = await supabase.from("qcm").select("*")
      .in("chapitre_id", [...chapitresChoisis])
      .in("niveau", [...niveauxChoisis]);

    const pool = candidats || [];
    let resultat = [];

    if (equilibrer) {
      const parChapitre = {};
      pool.forEach(q => { (parChapitre[q.chapitre_id] = parChapitre[q.chapitre_id] || []).push(q); });
      const chapitresAvecQcm = Object.keys(parChapitre);
      const quotaParChapitre = Math.ceil(nombre / (chapitresAvecQcm.length || 1));
      const pris = new Set();
      chapitresAvecQcm.forEach(chId => {
        const choisis = melanger(parChapitre[chId]).slice(0, quotaParChapitre);
        choisis.forEach(q => pris.add(q));
        resultat.push(...choisis);
      });
      // Idem que pour les questions classiques : complète si le quota par chapitre
      // a laissé des candidats de côté alors que le vivier permettait d'en tirer plus.
      const cible = Math.min(nombre, pool.length);
      if (resultat.length < cible) {
        const restants = pool.filter(q => !pris.has(q));
        resultat.push(...melanger(restants).slice(0, cible - resultat.length));
      }
      resultat = melanger(resultat).slice(0, nombre);
    } else {
      resultat = melanger(pool).slice(0, nombre);
    }

    // Chaque QCM aléatoire est tiré immédiatement pour obtenir un énoncé/choix concrets
    const tires = resultat.map(q => {
      const tirage = tirerQcm(q);
      return { id: q.id, chapitre_id: q.chapitre_id, niveau: q.niveau, mode: q.mode,
        enonce: tirage.enonce, choix: tirage.choix, bonne_reponse: tirage.bonne_reponse, _cle: q.id };
    });

    if (tires.length < nombre) {
      setAvertissement(`Seulement ${tires.length} QCM trouvé${tires.length !== 1 ? "s" : ""} sur ${nombre} demandé${nombre !== 1 ? "s" : ""} selon ces critères.`);
    }

    setTirageEnCours(false);
    onTirer(tires);
  }

  const chapitresTries = [...chapitres].sort((a, b) => a.ordre - b.ordre);

  return (
    <div className="random-overlay" onClick={e => e.target === e.currentTarget && onAnnuler()}>
      <div className="random-card">
        <div className="random-title">🎲 Tirage aléatoire de QCM</div>
        <div className="random-sub">Compose automatiquement une sélection de QCM selon tes critères. Remplace la sélection actuelle.</div>

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
            {["seconde", "premiere_automatismes"].map(origine => {
              const chapitresOrigine = chapitresTries.filter(ch => ch.niveau_scolaire === origine);
              if (chapitresOrigine.length === 0) return null;
              return (
                <div key={origine} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                    <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: couleurOrigine(origine) }} />
                    {origine === "seconde" ? "Seconde" : "Première"}
                    <a href="#" onClick={e => { e.preventDefault(); toutSelectionnerOrigine(origine); }} style={{ color: "var(--accent-light)" }}>tout cocher</a>
                    ·
                    <a href="#" onClick={e => { e.preventDefault(); toutDeselectionnerOrigine(origine); }} style={{ color: "var(--accent-light)" }}>tout décocher</a>
                  </div>
                  <div className="random-chapitres-grid">
                    {chapitresOrigine.map(ch => (
                      <label key={ch.id} className="random-chapitre-item">
                        <input type="checkbox" checked={chapitresChoisis.has(ch.id)} onChange={() => toggleChapitre(ch.id)} />
                        {ch.nom}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="random-section-label">Niveau</div>
            <div className="random-chips-row">
              {[1, 2, 3].map(n => (
                <button key={n} className={`random-chip${niveauxChoisis.has(n) ? " active" : ""}`} onClick={() => toggleNiveau(n)}>Niveau {n}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="random-section-label">Nombre de QCM</div>
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
            <div className="random-checkbox-desc">Répartit le nombre de QCM à peu près équitablement entre les chapitres cochés.</div>
          </div>

          {avertissement && <div className="random-warning">⚠️ {avertissement}</div>}
        </div>

        <div className="random-actions">
          <button className="diapo-cancel-btn" onClick={onAnnuler}>Annuler</button>
          <button className="diapo-launch-btn" onClick={lancerTirage}
            disabled={tirageEnCours || chapitresChoisis.size === 0 || niveauxChoisis.size === 0}>
            {tirageEnCours ? "Tirage en cours…" : "🎲 Tirer les QCM"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GenerateurZone({ currentUser, currentProfile, sessionARecharger, onSessionChargee, contenuExactARecharger, onContenuExactCharge, niveauScolaire, onSessionSauvegardee }) {
  const [chapitres, setChapitres] = useState([]);
  const [questionsParChapitre, setQuestionsParChapitre] = useState({}); // { chapitre_id: [questions] }
  const [exercicesEnBase, setExercicesEnBase] = useState([]);           // exercices_application chargés depuis Supabase
  const [chapitresOuverts, setChapitresOuverts] = useState({});        // { chapitre_id: bool }
  const [chargementChapitre, setChargementChapitre] = useState({});    // { chapitre_id: bool }
  const [questionsDetail, setQuestionsDetail] = useState({});          // { question_id: bool } détail ouvert
  const [reponsesVisibles, setReponsesVisibles] = useState({});        // { question_id: bool } réponse révélée (masquée par défaut)
  const [selection, setSelection] = useState([]);                       // [question objects, dans l'ordre de sélection]
  const [elementsCoches, setElementsCoches] = useState(new Set());      // ids cochés dans la colonne de droite pour suppression groupée
  const [nbCopiesParItem, setNbCopiesParItem] = useState({});           // _cle -> nombre de copies à dupliquer
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
  const [questionAModifier, setQuestionAModifier] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [overZone, setOverZone] = useState(null); // "top" | "middle" | "bottom"
  const [loading, setLoading] = useState(true);
  const [questionEnEdition, setQuestionEnEdition] = useState(null); // id de la question en cours d'édition
  const [brouillonEdition, setBrouillonEdition] = useState(null);    // { type, enonce, reponse, niveau }
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);
  const [questionASupprimer, setQuestionASupprimer] = useState(null); // question en attente de confirmation
  const [exerciceASupprimer, setExerciceASupprimer] = useState(null); // exercice aléatoire en attente de confirmation
  const [confirmerToutRetirer, setConfirmerToutRetirer] = useState(false);

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

    // Sépare les ids qui appartiennent encore à l'ancienne bibliothèque codée
    // en dur (presque vide désormais) de tout le reste, qui peut venir soit
    // de la table "questions" (fixe) soit de "exercices_application" (aléatoire).
    const idsBibliotheque = sessionARecharger.filter(id => BIBLIOTHEQUE_EXERCICES[id]);
    const idsAutres = sessionARecharger.filter(id => !BIBLIOTHEQUE_EXERCICES[id]);

    Promise.all([
      supabase.from("questions").select("*").in("id", idsAutres.length ? idsAutres : ["__aucun__"]),
      supabase.from("exercices_application").select("*").in("id", idsAutres.length ? idsAutres : ["__aucun__"]),
    ]).then(([{ data: questionsData }, { data: exercicesData }]) => {
      const parId = {};
      (questionsData || []).forEach(q => { parId[q.id] = { ...q, _cle: q.id }; });

      // Exercices aléatoires stockés en base : on retire un nouveau tirage,
      // la session ne mémorise que le modèle, pas les valeurs figées d'origine.
      (exercicesData || []).forEach(ex => {
        const valeurs = {};
        Object.entries(ex.parametres || {}).forEach(([nom, d]) => { valeurs[nom] = tirerValeurParametre(d); });
        parId[ex.id] = {
          id: ex.id, chapitre_id: ex.chapitre_id, type: "exercice", niveau: ex.niveau,
          enonce: substituerPlaceholders(ex.enonce_modele, valeurs),
          reponse: substituerPlaceholders(ex.reponse_modele, valeurs),
          _cle: ex.id, _aleatoire: true,
        };
      });

      // Anciens exercices encore codés en dur (cas résiduel, la bibliothèque est vide aujourd'hui)
      idsBibliotheque.forEach(id => {
        const def = BIBLIOTHEQUE_EXERCICES[id];
        const chapitreCorrespondant = chapitres.find(c => c.nom === def.chapitre);
        const tirage = def.generer();
        parId[id] = {
          id, chapitre_id: chapitreCorrespondant?.id, type: "exercice", niveau: def.niveau,
          enonce: tirage.enonce, reponse: tirage.reponse,
          _cle: id, _aleatoire: true,
        };
      });

      // Respecte l'ordre d'origine de la session, pas l'ordre renvoyé par Supabase
      const ordonnee = sessionARecharger.map(id => parId[id]).filter(Boolean);
      setSelection(ordonnee);
      onSessionChargee();
    });
  }, [sessionARecharger]);

  // Rechargement "mêmes valeurs" : le contenu est déjà résolu (sauvegardé tel
  // quel dans l'historique), aucun tirage ni requête nécessaire.
  useEffect(() => {
    if (!contenuExactARecharger) return;
    setSelection(contenuExactARecharger);
    onContenuExactCharge();
  }, [contenuExactARecharger]);

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

  function demanderSuppressionQuestion(question) {
    setQuestionASupprimer(question);
  }

  async function confirmerSuppressionQuestion() {
    const question = questionASupprimer;
    if (!question) return;
    setQuestionASupprimer(null);

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

  function demanderSuppressionExercice(exercice) {
    setExerciceASupprimer(exercice);
  }

  async function confirmerSuppressionExercice() {
    const exercice = exerciceASupprimer;
    if (!exercice) return;
    setExerciceASupprimer(null);

    const { error } = await supabase.from("exercices_application").delete().eq("id", exercice.id);
    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
      return;
    }

    setExercicesEnBase(prev => prev.filter(e => e.id !== exercice.id));
    setSelection(prev => prev.filter(q => q.id !== exercice.id));
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
        : [...prev, { ...question, _cle: question.id }]
    );
  }

  function retirerSelection(cle) {
    setSelection(prev => prev.filter(q => q._cle !== cle));
    setElementsCoches(prev => { const c = new Set(prev); c.delete(cle); return c; });
  }

  function toutRetirer() {
    if (selection.length === 0) return;
    setConfirmerToutRetirer(true);
  }

  function confirmerToutRetirerAction() {
    setConfirmerToutRetirer(false);
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
    setSelection(prev => prev.filter(q => !elementsCoches.has(q._cle)));
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

  // Ajoute `nombre` nouvelles instances du même exercice aléatoire. Chaque
  // tirage est vérifié différent de toutes les copies déjà présentes ET de
  // celles ajoutées plus tôt dans ce même lot.
  function dupliquerSelection(item, nombre) {
    if (!item._aleatoire) return;

    const def = BIBLIOTHEQUE_EXERCICES[item.id];
    const exoBase = !def ? exercicesEnBase.find(e => e.id === item.id) : null;
    if (!def && !exoBase) return; // source introuvable (exercice supprimé entre-temps)

    function tirerUnExemplaire() {
      if (def) return def.generer();
      const valeurs = {};
      Object.entries(exoBase.parametres).forEach(([nom, d]) => { valeurs[nom] = tirerValeurParametre(d); });
      return {
        enonce: substituerPlaceholders(exoBase.enonce_modele, valeurs),
        reponse: substituerPlaceholders(exoBase.reponse_modele, valeurs),
      };
    }

    setSelection(prev => {
      const idx = prev.findIndex(s => s._cle === item._cle);
      const enoncesConnus = prev.filter(s => s.id === item.id).map(s => s.enonce);
      const nouvellesInstances = [];

      for (let i = 0; i < nombre; i++) {
        let tirage, tentative = 0;
        do {
          tirage = tirerUnExemplaire();
          tentative++;
          // Sécurité : au-delà de 25 tentatives, la plage de tirage est trop
          // restreinte pour garantir l'unicité — on prend le dernier tirage tel quel.
        } while (
          (enoncesConnus.includes(tirage.enonce) || nouvellesInstances.some(n => n.enonce === tirage.enonce))
          && tentative < 25
        );
        nouvellesInstances.push({
          ...item,
          enonce: tirage.enonce,
          reponse: tirage.reponse,
          _cle: `${item.id}__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}_${i}`,
        });
      }

      const copie = [...prev];
      copie.splice(idx + 1, 0, ...nouvellesInstances);
      return copie;
    });
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
      setSelection(prev => [...prev, { id: idExercice, chapitre_id: chapitreId, type: "exercice", enonce: tirage.enonce, reponse: tirage.reponse, niveau, _cle: idExercice, _aleatoire: true }]);
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
      setSelection(prev => [...prev, { id: idExercice, chapitre_id: chapitreId, type: "exercice", enonce: tirage.enonce, reponse: tirage.reponse, niveau, _cle: idExercice, _aleatoire: true }]);
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
    lignes.push("\\noindent\\textbf{Nom :}\\underline{\\hspace{3.5cm}} \\hfill \\textbf{Prénom :}\\underline{\\hspace{3.5cm}} \\hfill \\textbf{Classe :}\\underline{\\hspace{2cm}}");
    lignes.push("");
    lignes.push("\\vspace{6mm}");
    lignes.push("");

    selection.forEach((q, idx) => {
      lignes.push(`\\stepcounter{qnum}`);
      lignes.push(`\\noindent\\textbf{Question \\theqnum.} ${echapperLatex(q.enonce)}`);
      lignes.push("");
      if (avecCorrige) {
        lignes.push("\\begin{tcolorbox}[colback=gray!10]");
        lignes.push(echapperLatex(q.reponse));
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

  // Calcule une signature stable pour un ensemble de questions, peu importe l'ordre.
  // C'est la signature de "famille" : elle ne dépend que des ids, pas du contenu réellement tiré.
  function calculerSignature(questionsSelection) {
    return questionsSelection.map(q => q.id).slice().sort().join(",");
  }

  // Signature du tirage réel : dépend du contenu effectivement généré (énoncé/réponse),
  // donc deux tirages différents d'une même famille (mêmes ids) donnent des signatures différentes.
  function calculerSignatureTirage(questionsSelection) {
    const brut = questionsSelection.slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(q => `${q.id}|${q.enonce}|${q.reponse}`)
      .join("§§");
    let h = 5381;
    for (let i = 0; i < brut.length; i++) h = ((h * 33) ^ brut.charCodeAt(i)) >>> 0;
    return h.toString(36);
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
    const tirageSignature = calculerSignatureTirage(selection);
    const niveau = niveauScolaire || "terminale_spe";

    // Un tirage strictement identique (même famille ET même contenu déjà tiré) met à jour
    // sa carte existante — un simple re-export du même tirage ne crée pas de doublon.
    const { data: existante } = await supabase.from("sessions_historique")
      .select("id").eq("prof_id", currentUser.id).eq("signature", signature)
      .eq("tirage_signature", tirageSignature).eq("type_session", "classique").maybeSingle();

    let erreur;
    if (existante) {
      const { error } = await supabase.from("sessions_historique").update({
        question_ids: selection.map(q => q.id),
        contenu_selection: selection,
        derniere_action: action,
        updated_at: new Date().toISOString(),
      }).eq("id", existante.id);
      erreur = error;
    } else {
      const { error } = await supabase.from("sessions_historique").insert({
        prof_id: currentUser.id,
        nom: genererNomSession(selection),
        question_ids: selection.map(q => q.id),
        contenu_selection: selection,
        signature,
        tirage_signature: tirageSignature,
        derniere_action: action,
        niveau_scolaire: niveau,
        type_session: "classique",
      });
      erreur = error;

      // Limite à 5 tirages conservés par famille : au-delà, supprime les plus anciens
      // (jamais les favoris, qui échappent à la purge automatique).
      if (!error) {
        const { data: memeFamille } = await supabase.from("sessions_historique")
          .select("id, updated_at, favori").eq("prof_id", currentUser.id).eq("signature", signature)
          .eq("type_session", "classique").order("updated_at", { ascending: false });
        if (memeFamille && memeFamille.length > 5) {
          const supprimables = memeFamille.slice(5).filter(s => !s.favori).map(s => s.id);
          if (supprimables.length > 0) {
            await supabase.from("sessions_historique").delete().in("id", supprimables);
          }
        }
      }
    }
    if (erreur) {
      alert("Erreur lors de la sauvegarde dans l'historique : " + erreur.message);
      return;
    }
    onSessionSauvegardee?.();
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
      chapitre: nomCh,
      mode: "fixe",
      id: q.id,
      type: q.type,
      enonce: q.enonce,
      reponse: q.reponse,
      niveau: q.niveau,
    };
  }

  function exerciceVersJson(ex, nomCh) {
    return {
      chapitre: nomCh,
      mode: "aleatoire",
      enonce_modele: ex.enonce_modele,
      reponse_modele: ex.reponse_modele,
      parametres: ex.parametres,
      niveau: ex.niveau,
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

  // Les exercices de BIBLIOTHEQUE_EXERCICES sont codés en dur (fonction generer()
  // en JS), donc impossibles à sérialiser en JSON — ils ne peuvent structurellement
  // pas faire partie de l'export. On prévient plutôt que de les faire disparaître
  // silencieusement.
  function idsCodesEnDurPourChapitres(nomsChapitres) {
    const noms = new Set(nomsChapitres);
    return Object.entries(BIBLIOTHEQUE_EXERCICES)
      .filter(([, def]) => noms.has(def.chapitre) && def.niveauScolaire === niveauScolaire)
      .map(([id]) => id);
  }

  async function exporterChapitre(ch) {
    // Réutilise le cache si déjà chargé, sinon recharge depuis Supabase
    let questions = questionsParChapitre[ch.id];
    if (!questions) {
      const { data } = await supabase.from("questions").select("*").eq("chapitre_id", ch.id).order("id");
      questions = data || [];
    }
    const { data: exercicesDuChapitre } = await supabase.from("exercices_application").select("*").eq("chapitre_id", ch.id);
    const contenu = [
      ...questions.map(q => questionVersJson(q, ch.nom)),
      ...(exercicesDuChapitre || []).map(ex => exerciceVersJson(ex, ch.nom)),
    ];
    const slug = ch.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_");
    telechargerJson(contenu, `questions_${slug}.json`);

    const idsExclus = idsCodesEnDurPourChapitres([ch.nom]);
    if (idsExclus.length > 0) {
      alert(`⚠️ ${idsExclus.length} exercice(s) codé(s) en dur (non exportable(s), car écrits en JS et pas en base) : ${idsExclus.join(", ")}`);
    }
  }

  // Exporte uniquement le niveau actif (Terminale Spé / Seconde / Première),
  // pas toute la table — chapitres est déjà scopé par niveauScolaire.
  async function exporterToutLaBanque() {
    const idsChapitres = chapitres.map(c => c.id);
    if (idsChapitres.length === 0) return;
    const chapitresParId = {};
    chapitres.forEach(c => { chapitresParId[c.id] = c.nom; });

    const [{ data: toutesQuestions }, { data: tousExercices }] = await Promise.all([
      supabase.from("questions").select("*").in("chapitre_id", idsChapitres).order("chapitre_id").order("id"),
      supabase.from("exercices_application").select("*").in("chapitre_id", idsChapitres).order("chapitre_id").order("id"),
    ]);
    const contenu = [
      ...(toutesQuestions || []).map(q => questionVersJson(q, chapitresParId[q.chapitre_id] || "?")),
      ...(tousExercices || []).map(ex => exerciceVersJson(ex, chapitresParId[ex.chapitre_id] || "?")),
    ];
    const date = new Date().toISOString().slice(0, 10);
    telechargerJson(contenu, `banque_${niveauScolaire}_${date}.json`);

    const idsExclus = idsCodesEnDurPourChapitres(chapitres.map(c => c.nom));
    if (idsExclus.length > 0) {
      alert(`⚠️ ${idsExclus.length} exercice(s) codé(s) en dur (non exportable(s), car écrits en JS et pas en base) : ${idsExclus.join(", ")}`);
    }
  }

  if (loading) {
    return <div className="generateur-area"><div className="gen-selection-empty"><div className="spinner"></div>Chargement des chapitres…</div></div>;
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
                                  <button className="gen-edit-question-btn" onClick={() => { setQuestionAModifier({ ...q, _source: "base_fixe" }); setAfficherCreerQuestion(true); }}>
                                    ✏️ Modifier
                                  </button>
                                  <button className="gen-delete-question-btn" onClick={() => demanderSuppressionQuestion(q)}>
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
                            {ex.source === "base" && ex.data?.prof_id === currentUser.id && (
                              <>
                                <button className="gen-exercice-refresh-btn" style={{ marginLeft: 8 }}
                                  onClick={() => { setQuestionAModifier({ ...ex.data, _source: "base_aleatoire" }); setAfficherCreerQuestion(true); }}>
                                  ✏️ Modifier
                                </button>
                                <button className="gen-delete-question-btn" style={{ marginLeft: 8 }}
                                  onClick={() => demanderSuppressionExercice(ex.data)}>
                                  🗑️ Supprimer
                                </button>
                              </>
                            )}
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
                key={q._cle}
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
                <input type="checkbox" className="gen-selected-checkbox" checked={elementsCoches.has(q._cle)}
                  onChange={() => toggleCocheElement(q._cle)} onClick={e => e.stopPropagation()} />
                <div className="gen-selected-num">{idx + 1}</div>
                <div className="gen-selected-content">
                  <div className="gen-selected-chapitre">{nomChapitre(q.chapitre_id)}</div>
                  <div className="gen-selected-enonce"><MathText>{q.enonce}</MathText></div>
                </div>
                {q._aleatoire && (
                  <>
                    <input type="number" className="gen-selected-nbcopies" min={1} max={20}
                      value={nbCopiesParItem[q._cle] || 1}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setNbCopiesParItem(prev => ({ ...prev, [q._cle]: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))} />
                    <button className="gen-selected-duplicate" onClick={() => dupliquerSelection(q, nbCopiesParItem[q._cle] || 1)} title="Dupliquer avec de nouveaux tirages">🎲+</button>
                  </>
                )}
                <button className="gen-selected-remove" onClick={() => retirerSelection(q._cle)} title="Retirer">✕</button>
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
          niveauScolaire={niveauScolaire}
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
            // Recharge aussi les exercices aléatoires (oublié jusqu'ici : un import
            // d'exercices aléatoires n'apparaissait pas sans rechargement manuel de la page)
            if (chapitres.length > 0) {
              supabase.from("exercices_application")
                .select("*")
                .in("chapitre_id", chapitres.map(c => c.id))
                .then(({ data }) => setExercicesEnBase(data || []));
            }
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
          currentProfile={currentProfile}
          niveauScolaire={niveauScolaire}
          questionAEditer={questionAModifier}
          onFermer={() => { setAfficherCreerQuestion(false); setQuestionAModifier(null); }}
          onCree={() => {
            setAfficherCreerQuestion(false);
            setQuestionAModifier(null);
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
      {questionASupprimer && (
        <ConfirmModal
          titre="Supprimer cette question ?"
          message={`"${questionASupprimer.enonce.slice(0, 80)}${questionASupprimer.enonce.length > 80 ? "…" : ""}"\n\nSupprimée de la banque commune, définitivement.`}
          texteConfirmer="Supprimer"
          danger
          onConfirm={confirmerSuppressionQuestion}
          onAnnuler={() => setQuestionASupprimer(null)}
        />
      )}
      {exerciceASupprimer && (
        <ConfirmModal
          titre="Supprimer cet exercice ?"
          message={`"${exerciceASupprimer.enonce_modele.slice(0, 80)}${exerciceASupprimer.enonce_modele.length > 80 ? "…" : ""}"\n\nSupprimé de la banque commune, définitivement.`}
          texteConfirmer="Supprimer"
          danger
          onConfirm={confirmerSuppressionExercice}
          onAnnuler={() => setExerciceASupprimer(null)}
        />
      )}
      {confirmerToutRetirer && (
        <ConfirmModal
          titre="Vider la sélection ?"
          message={`Retirer les ${selection.length} question${selection.length !== 1 ? "s" : ""} de la sélection en cours.`}
          texteConfirmer="Retirer"
          onConfirm={confirmerToutRetirerAction}
          onAnnuler={() => setConfirmerToutRetirer(false)}
        />
      )}
    </div>
  );
}

// ─── Composant RessourcesZone ──────────────────────────────────────────
// ─── Composant QcmZone ────────────────────────────────────────────────
// Rubrique indépendante pour les QCM (fixe + aléatoire), sur le modèle de
// GenerateurZone mais simplifiée : un seul "type" de contenu, pas de filtre
// par type de question, tirage/édition/export propres aux QCM.
function QcmZone({ currentUser, currentProfile, qcmSessionARecharger, onSessionChargee, qcmContenuExactARecharger, onContenuExactCharge, niveauScolaire, onSessionSauvegardee }) {
  const [chapitres, setChapitres] = useState([]);
  const [qcmParChapitre, setQcmParChapitre] = useState({});       // { chapitre_id: [qcm] }
  const [chapitresOuverts, setChapitresOuverts] = useState({});
  const [chargementChapitre, setChargementChapitre] = useState({});
  const [detailOuvert, setDetailOuvert] = useState({});            // { qcm_id: bool }
  const [tiragesQcm, setTiragesQcm] = useState({});                 // { qcm_id: {enonce, choix, valeurs} } dernier tirage
  const [selection, setSelection] = useState([]);
  const [elementsCoches, setElementsCoches] = useState(new Set());
  const [nbCopiesParItem, setNbCopiesParItem] = useState({});           // _cle -> nombre de copies à dupliquer
  const NIVEAUX_DISPONIBLES = [1, 2, 3];
  const [niveauxActifs, setNiveauxActifs] = useState(new Set(NIVEAUX_DISPONIBLES));
  // Filtre par origine (Seconde / nouveautés Première) — exclure/inclure vite,
  // sans avoir à décocher chapitre par chapitre.
  const ORIGINES_QCM = [
    { id: "seconde", label: "Seconde", couleur: "#059669" },
    { id: "premiere_automatismes", label: "Première", couleur: "#7c3aed" },
  ];
  const [originesActives, setOriginesActives] = useState(new Set(ORIGINES_QCM.map(o => o.id)));
  function toggleOrigine(id) {
    setOriginesActives(prev => {
      const copie = new Set(prev);
      copie.has(id) ? copie.delete(id) : copie.add(id);
      return copie;
    });
  }
  function couleurOrigine(niveauScolaireChapitre) {
    return ORIGINES_QCM.find(o => o.id === niveauScolaireChapitre)?.couleur || "#7b82a8";
  }
  const [afficherReglagesDiapo, setAfficherReglagesDiapo] = useState(false);
  const [diapoActive, setDiapoActive] = useState(null);
  const [afficherTirage, setAfficherTirage] = useState(false);
  const [afficherCreerQcm, setAfficherCreerQcm] = useState(false);
  const [afficherImportQcm, setAfficherImportQcm] = useState(false);
  const [qcmAModifier, setQcmAModifier] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [overZone, setOverZone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qcmASupprimer, setQcmASupprimer] = useState(null);
  const [confirmerToutRetirer, setConfirmerToutRetirer] = useState(false);

  // Automatismes QCM regroupe Seconde et les nouveautés de Première (probas
  // conditionnelles, second degré) — indépendant du niveau sélectionné dans
  // les pills, donc pas de dépendance à la prop niveauScolaire ici.
  const NIVEAUX_QCM = ["seconde", "premiere_automatismes"];

  function toggleNiveauFiltre(niveau) {
    setNiveauxActifs(prev => {
      const copie = new Set(prev);
      copie.has(niveau) ? copie.delete(niveau) : copie.add(niveau);
      return copie;
    });
  }
  function qcmVisible(q) { return niveauxActifs.has(q.niveau); }

  // Charge une seule fois les chapitres des deux niveaux (Seconde + nouveautés Première)
  useEffect(() => {
    setLoading(true);
    setChapitres([]);
    setChapitresOuverts({});
    setQcmParChapitre({});
    setSelection([]);
    supabase.from("chapitres").select("*")
      .in("niveau_scolaire", NIVEAUX_QCM)
      .order("ordre")
      .then(({ data }) => {
        setChapitres(data || []);
        setLoading(false);
      });
  }, []);

  // Recharger une sélection depuis l'historique (clic sur "Rejouer")
  useEffect(() => {
    if (!qcmSessionARecharger) return;
    supabase.from("qcm").select("*").in("id", qcmSessionARecharger.length ? qcmSessionARecharger : ["__aucun__"]).then(({ data }) => {
      const parId = {};
      (data || []).forEach(q => { parId[q.id] = q; });
      const nouvelleSelection = qcmSessionARecharger
        .filter(id => parId[id])
        .map(id => {
          const q = parId[id];
          const tirage = tirerQcm(q);
          return { id: q.id, chapitre_id: q.chapitre_id, niveau: q.niveau, mode: q.mode,
            enonce: tirage.enonce, choix: tirage.choix, bonne_reponse: tirage.bonne_reponse };
        });
      setSelection(nouvelleSelection);
      onSessionChargee();
    });
  }, [qcmSessionARecharger]);

  // Rechargement "mêmes valeurs" : le contenu est déjà résolu, aucun tirage nécessaire.
  useEffect(() => {
    if (!qcmContenuExactARecharger) return;
    setSelection(qcmContenuExactARecharger);
    onContenuExactCharge();
  }, [qcmContenuExactARecharger]);

  async function toggleChapitre(chapitreId) {
    const estOuvert = chapitresOuverts[chapitreId];
    setChapitresOuverts(prev => ({ ...prev, [chapitreId]: !estOuvert }));
    if (!estOuvert && !qcmParChapitre[chapitreId]) {
      setChargementChapitre(prev => ({ ...prev, [chapitreId]: true }));
      const { data } = await supabase.from("qcm").select("*").eq("chapitre_id", chapitreId).order("created_at");
      setQcmParChapitre(prev => ({ ...prev, [chapitreId]: data || [] }));
      setChargementChapitre(prev => ({ ...prev, [chapitreId]: false }));
    }
  }

  function toggleDetail(qcmId) {
    setDetailOuvert(prev => {
      const ouvert = !prev[qcmId];
      return { ...prev, [qcmId]: ouvert };
    });
    // Tire un aperçu à l'ouverture pour un QCM aléatoire, s'il n'y en a pas déjà un
    const q = Object.values(qcmParChapitre).flat().find(item => item.id === qcmId);
    if (q && q.mode === "aleatoire" && !detailOuvert[qcmId] && !tiragesQcm[qcmId]) {
      retirerAuSort(q);
    }
  }

  function retirerAuSort(q) {
    const tirage = tirerQcm(q);
    setTiragesQcm(prev => ({ ...prev, [q.id]: tirage }));
    setSelection(prev => prev.map(s => s.id === q.id ? { ...s, enonce: tirage.enonce, choix: tirage.choix, bonne_reponse: tirage.bonne_reponse } : s));
  }

  function estSelectionne(qcmId) { return selection.some(s => s.id === qcmId); }

  function toggleSelection(q) {
    if (estSelectionne(q.id)) {
      setSelection(prev => prev.filter(s => s.id !== q.id));
      return;
    }
    let tirage = tiragesQcm[q.id];
    if (!tirage) {
      tirage = tirerQcm(q);
      setTiragesQcm(prev => ({ ...prev, [q.id]: tirage }));
    }
    setSelection(prev => [...prev, {
      id: q.id, chapitre_id: q.chapitre_id, niveau: q.niveau, mode: q.mode,
      enonce: tirage.enonce, choix: tirage.choix, bonne_reponse: tirage.bonne_reponse,
      _cle: q.id,
    }]);
  }

  function retirerSelection(cle) {
    setSelection(prev => prev.filter(s => s._cle !== cle));
    setElementsCoches(prev => { const c = new Set(prev); c.delete(cle); return c; });
  }

  // Ajoute `nombre` nouvelles instances du même QCM aléatoire. Chaque tirage
  // est vérifié différent de toutes les copies déjà présentes ET de celles
  // ajoutées plus tôt dans ce même lot.
  function dupliquerSelection(item, nombre) {
    if (item.mode !== "aleatoire") return;
    const source = Object.values(qcmParChapitre).flat().find(q => q.id === item.id);
    if (!source) return; // source introuvable (QCM supprimé entre-temps)

    setSelection(prev => {
      const idx = prev.findIndex(s => s._cle === item._cle);
      const enoncesConnus = prev.filter(s => s.id === item.id).map(s => s.enonce);
      const nouvellesInstances = [];

      for (let i = 0; i < nombre; i++) {
        let tirage, tentative = 0;
        do {
          tirage = tirerQcm(source);
          tentative++;
        } while (
          (enoncesConnus.includes(tirage.enonce) || nouvellesInstances.some(n => n.enonce === tirage.enonce))
          && tentative < 25
        );
        nouvellesInstances.push({
          ...item,
          enonce: tirage.enonce,
          choix: tirage.choix,
          bonne_reponse: tirage.bonne_reponse,
          _cle: `${item.id}__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}_${i}`,
        });
      }

      const copie = [...prev];
      copie.splice(idx + 1, 0, ...nouvellesInstances);
      return copie;
    });
  }

  function toggleCocheElement(id) {
    setElementsCoches(prev => { const c = new Set(prev); c.has(id) ? c.delete(id) : c.add(id); return c; });
  }

  function retirerElementsCoches() {
    setSelection(prev => prev.filter(s => !elementsCoches.has(s._cle)));
    setElementsCoches(new Set());
  }

  function toutRetirer() {
    if (selection.length === 0) return;
    setConfirmerToutRetirer(true);
  }
  function confirmerToutRetirerAction() {
    setConfirmerToutRetirer(false);
    setSelection([]);
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

  function nomChapitre(chapitreId) { return chapitres.find(c => c.id === chapitreId)?.nom || ""; }

  function demanderSuppressionQcm(q) { setQcmASupprimer(q); }
  async function confirmerSuppressionQcm() {
    const q = qcmASupprimer;
    if (!q) return;
    setQcmASupprimer(null);
    const { error } = await supabase.from("qcm").delete().eq("id", q.id);
    if (error) { alert("Erreur lors de la suppression : " + error.message); return; }
    setQcmParChapitre(prev => ({ ...prev, [q.chapitre_id]: (prev[q.chapitre_id] || []).filter(item => item.id !== q.id) }));
    setSelection(prev => prev.filter(s => s.id !== q.id));
  }

  // ── Historique (partagé avec les sessions classiques, différencié par type_session) ──
  // Signature de famille (ids), comme pour les sessions classiques.
  function calculerSignature(qcmSelection) {
    return qcmSelection.map(q => q.id).slice().sort().join(",");
  }
  // Signature du tirage réel : dépend du contenu effectivement tiré (énoncé/choix),
  // donc un nouveau tirage aléatoire d'un QCM donne une signature différente.
  function calculerSignatureTirage(qcmSelection) {
    const brut = qcmSelection.slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(q => `${q.id}|${q.enonce}|${(q.choix || []).join("~")}|${q.bonne_reponse}`)
      .join("§§");
    let h = 5381;
    for (let i = 0; i < brut.length; i++) h = ((h * 33) ^ brut.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function genererNomSession(qcmSelection) {
    const chapitresUniques = [...new Set(qcmSelection.map(q => nomChapitre(q.chapitre_id)))];
    let partieChapitres = chapitresUniques.length <= 2
      ? chapitresUniques.join(", ")
      : `${chapitresUniques.slice(0, 2).join(", ")} +${chapitresUniques.length - 2} autre${chapitresUniques.length - 2 > 1 ? "s" : ""}`;
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${partieChapitres} · ${dateStr} · ${qcmSelection.length} QCM`;
  }
  async function sauvegarderDansHistorique(action) {
    if (selection.length === 0) return;
    const signature = calculerSignature(selection);
    const tirageSignature = calculerSignatureTirage(selection);
    // Niveau fixe, indépendant de la pill sélectionnée : le QCM mélange
    // Seconde et Première, donc "le niveau au moment du clic" n'a pas de sens.
    const niveau = "automatismes_qcm";
    const { data: existante } = await supabase.from("sessions_historique")
      .select("id").eq("prof_id", currentUser.id).eq("signature", signature)
      .eq("tirage_signature", tirageSignature).eq("type_session", "qcm").maybeSingle();
    let erreur;
    if (existante) {
      const { error } = await supabase.from("sessions_historique").update({
        question_ids: selection.map(q => q.id),
        contenu_selection: selection,
        derniere_action: action,
        updated_at: new Date().toISOString(),
      }).eq("id", existante.id);
      erreur = error;
    } else {
      const { error } = await supabase.from("sessions_historique").insert({
        prof_id: currentUser.id,
        nom: genererNomSession(selection),
        question_ids: selection.map(q => q.id),
        contenu_selection: selection,
        signature,
        tirage_signature: tirageSignature,
        derniere_action: action,
        niveau_scolaire: niveau,
        type_session: "qcm",
      });
      erreur = error;

      // Limite à 5 tirages conservés par famille (jamais les favoris).
      if (!error) {
        const { data: memeFamille } = await supabase.from("sessions_historique")
          .select("id, updated_at, favori").eq("prof_id", currentUser.id).eq("signature", signature)
          .eq("type_session", "qcm").order("updated_at", { ascending: false });
        if (memeFamille && memeFamille.length > 5) {
          const supprimables = memeFamille.slice(5).filter(s => !s.favori).map(s => s.id);
          if (supprimables.length > 0) {
            await supabase.from("sessions_historique").delete().in("id", supprimables);
          }
        }
      }
    }
    if (erreur) {
      alert("Erreur lors de la sauvegarde dans l'historique : " + erreur.message);
      return;
    }
    onSessionSauvegardee?.();
  }

  // ── Export .tex — feuille avec cases à cocher ──
  function genererTexQcm(avecCorrige) {
    const lettres = ["a", "b", "c", "d"];
    const lignes = [];
    lignes.push("\\documentclass[12pt]{article}");
    lignes.push("\\usepackage[utf8]{inputenc}");
    lignes.push("\\usepackage[T1]{fontenc}");
    lignes.push("\\usepackage[french]{babel}");
    lignes.push("\\usepackage{amsmath,amssymb}");
    lignes.push("\\usepackage{enumitem}");
    lignes.push("\\usepackage{multicol}");
    lignes.push("\\usepackage{fancyhdr}");
    lignes.push("\\usepackage[margin=2.5cm]{geometry}");
    lignes.push("\\setlength{\\parindent}{0pt}");
    lignes.push("\\setlength{\\parskip}{0pt}");
    lignes.push("\\pagestyle{fancy}");
    lignes.push("\\fancyhf{}");
    lignes.push("\\lhead{QCM}");
    lignes.push("\\chead{Interrogation" + (avecCorrige ? " — Corrigé" : "") + "}");
    lignes.push("\\rhead{Durée : 20 min}");
    lignes.push("\\newcounter{qnum}");
    lignes.push("\\begin{document}");
    lignes.push("");
    lignes.push("\\noindent\\textbf{Nom :}\\underline{\\hspace{3.5cm}} \\hfill \\textbf{Prénom :}\\underline{\\hspace{3.5cm}} \\hfill \\textbf{Classe :}\\underline{\\hspace{2cm}}");
    lignes.push("");
    lignes.push("\\vspace{6mm}");
    lignes.push("");

    selection.forEach((q, idx) => {
      lignes.push(`\\stepcounter{qnum}`);
      lignes.push(`\\noindent\\textbf{Question \\theqnum.} ${echapperLatex(q.enonce)}`);
      lignes.push("");
      lignes.push("\\vspace{4mm}");
      lignes.push("");
      lignes.push("\\small");
      lignes.push("\\begin{multicols}{2}");
      lignes.push("\\begin{enumerate}[leftmargin=2.4em, itemsep=4mm, label=$\\square$~\\alph*)]");
      q.choix.forEach((c, i) => {
        const estBonne = avecCorrige && i === q.bonne_reponse;
        const texteEchappe = echapperLatex(c);
        const texte = estBonne ? `\\textbf{${texteEchappe}}` : texteEchappe;
        if (estBonne) {
          lignes.push(`\\item[$\\blacksquare$~${lettres[i]})] ${texte}`);
        } else {
          lignes.push(`\\item ${texte}`);
        }
        if (i === 1) lignes.push("\\columnbreak"); // force a,b à gauche / c,d à droite
      });
      lignes.push("\\end{enumerate}");
      lignes.push("\\end{multicols}");
      lignes.push("\\normalsize");
      lignes.push("");
      if (idx < selection.length - 1) {
        lignes.push("\\vspace{6mm}");
        lignes.push("\\noindent\\hrulefill");
        lignes.push("\\vspace{6mm}");
      }
      lignes.push("");
    });

    lignes.push("\\end{document}");
    return lignes.join("\n");
  }

  function telechargerTexQcm(avecCorrige) {
    const contenu = genererTexQcm(avecCorrige);
    const blob = new Blob([contenu], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `qcm_${date}${avecCorrige ? "_corrige" : "_eleve"}.tex`;
    a.click();
    URL.revokeObjectURL(url);
    sauvegarderDansHistorique(avecCorrige ? "tex_corrige" : "tex_eleve");
  }

  // Exporte toute la banque de QCM du niveau actif dans le même format
  // que celui attendu par ImportQcm (chapitre nommé, mode fixe/aléatoire,
  // parametres inclus) — utile pour sauvegarder, migrer, ou repartir d'un
  // exemple concret pour écrire de nouveaux QCM en JSON.
  async function exporterJsonQcm() {
    const idsChapitres = chapitres.map(c => c.id);
    if (idsChapitres.length === 0) return;
    const nomParChapitreId = {};
    chapitres.forEach(c => { nomParChapitreId[c.id] = c.nom; });

    const { data, error } = await supabase.from("qcm").select("*").in("chapitre_id", idsChapitres);
    if (error) { alert("Erreur lors de l'export : " + error.message); return; }

    const liste = (data || []).map(q => {
      const base = {
        chapitre: nomParChapitreId[q.chapitre_id] || "",
        mode: q.mode,
        bonne_reponse: q.bonne_reponse,
        niveau: q.niveau,
      };
      return q.mode === "aleatoire"
        ? { ...base, enonce_modele: q.enonce_modele, choix_modele: q.choix_modele, parametres: q.parametres }
        : { ...base, enonce: q.enonce, choix: q.choix };
    });

    const blob = new Blob([JSON.stringify(liste, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `qcm_banque_automatismes_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="generateur-area"><div className="gen-selection-empty"><div className="spinner"></div>Chargement des chapitres…</div></div>;
  }

  return (
    <div className="generateur-area">
      <div className="gen-chapitres-col">
        <div className="gen-import-bar">
          <button className="gen-random-btn" onClick={() => setAfficherTirage(true)}>
            🎲 Tirage aléatoire
          </button>
          <button className="creer-btn" onClick={() => setAfficherCreerQcm(true)}>
            ➕ Créer un QCM
          </button>
          <button className="gen-import-btn" onClick={() => setAfficherImportQcm(true)}>
            📂 Importer JSON
          </button>
          <button className="gen-import-btn" onClick={exporterJsonQcm}>
            💾 Exporter JSON
          </button>
        </div>

        <div className="gen-filters-bar">
          <div className="gen-filters-row">
            <span className="gen-filters-label">Niveau</span>
            {NIVEAUX_DISPONIBLES.map(niveau => (
              <button key={niveau} className={`gen-filter-chip${niveauxActifs.has(niveau) ? " active" : ""}`}
                onClick={() => toggleNiveauFiltre(niveau)}>
                Niveau {niveau}
              </button>
            ))}
            {niveauxActifs.size < NIVEAUX_DISPONIBLES.length && (
              <button className="gen-filter-reset" onClick={() => setNiveauxActifs(new Set(NIVEAUX_DISPONIBLES))}>
                Réinitialiser
              </button>
            )}
          </div>
          <div className="gen-filters-row">
            <span className="gen-filters-label">Origine</span>
            {ORIGINES_QCM.map(o => (
              <button key={o.id} className={`gen-filter-chip${originesActives.has(o.id) ? " active" : ""}`}
                style={originesActives.has(o.id) ? { background: o.couleur, borderColor: o.couleur } : {}}
                onClick={() => toggleOrigine(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {chapitres.filter(ch => originesActives.has(ch.niveau_scolaire)).map(ch => {
          const ouvert = chapitresOuverts[ch.id];
          const qcmDuChapitre = qcmParChapitre[ch.id] || [];
          const qcmFiltres = qcmDuChapitre.filter(qcmVisible);
          const nbMasques = qcmDuChapitre.length - qcmFiltres.length;
          const nbSelectionnes = qcmDuChapitre.filter(q => estSelectionne(q.id)).length;
          return (
            <div key={ch.id} className="gen-chapitre-block">
              <div className="gen-chapitre-row" onClick={() => toggleChapitre(ch.id)}>
                <span className={`gen-chevron${ouvert ? " open" : ""}`}>▶</span>
                <span aria-hidden="true" title={ch.niveau_scolaire === "seconde" ? "Seconde" : "Première"}
                  style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: couleurOrigine(ch.niveau_scolaire), marginRight: 8, flexShrink: 0 }} />
                <span className="gen-chapitre-nom">{ch.nom}</span>
                {nbSelectionnes > 0 && <span className="gen-chapitre-count">{nbSelectionnes} sélectionné{nbSelectionnes > 1 ? "s" : ""}</span>}
                {ouvert && nbMasques > 0 && (
                  <span className="gen-chapitre-count" style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>
                    {nbMasques} masqué{nbMasques > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {ouvert && (
                <div className="gen-questions-list">
                  {chargementChapitre[ch.id] && <div className="gen-empty-chapitre">Chargement…</div>}
                  {!chargementChapitre[ch.id] && qcmDuChapitre.length === 0 && (
                    <div className="gen-empty-chapitre">Aucun QCM dans ce chapitre pour l'instant.</div>
                  )}
                  {!chargementChapitre[ch.id] && qcmDuChapitre.length > 0 && qcmFiltres.length === 0 && (
                    <div className="gen-empty-chapitre">Aucun QCM ne correspond aux filtres actifs.</div>
                  )}
                  {qcmFiltres.map(q => {
                    const tirage = tiragesQcm[q.id];
                    const apercu = q.mode === "aleatoire" ? (tirage?.enonce || q.enonce_modele) : q.enonce;
                    return (
                      <div key={q.id}>
                        <div className="gen-exercice-row">
                          <input type="checkbox" checked={estSelectionne(q.id)}
                            onChange={() => toggleSelection(q)} onClick={e => e.stopPropagation()} />
                          <div style={{ flex: 1, minWidth: 0 }} onClick={() => toggleDetail(q.id)}>
                            <div className="gen-question-type">
                              {q.mode === "aleatoire" ? "🎲 aléatoire" : "📝 fixe"} · niveau {q.niveau}
                            </div>
                            <div className="gen-question-apercu"><MathText>{apercu}</MathText></div>
                          </div>
                        </div>
                        {detailOuvert[q.id] && (
                          <div className="gen-question-detail">
                            {(() => {
                              const t = q.mode === "aleatoire" ? tirage : { enonce: q.enonce, choix: q.choix };
                              if (!t) return null;
                              return (
                                <>
                                  <MathText inline={false}>{t.enonce}</MathText>
                                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                                    {t.choix.map((c, i) => (
                                      <div key={i} style={{ color: i === q.bonne_reponse ? "var(--green)" : "var(--text-muted)" }}>
                                        {["a", "b", "c", "d"][i]}) <MathText>{c}</MathText>{i === q.bonne_reponse ? " ✓" : ""}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              );
                            })()}
                            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                              {q.mode === "aleatoire" && (
                                <button className="gen-exercice-refresh-btn" onClick={() => retirerAuSort(q)}>🎲 Retirer</button>
                              )}
                              {q.prof_id === currentUser.id && (
                                <>
                                  <button className="gen-edit-question-btn" onClick={() => { setQcmAModifier(q); setAfficherCreerQcm(true); }}>
                                    ✏️ Modifier
                                  </button>
                                  <button className="gen-delete-question-btn" onClick={() => demanderSuppressionQcm(q)}>
                                    🗑️ Supprimer
                                  </button>
                                </>
                              )}
                            </div>
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
              <div className="gen-header-title">Sélection pour le QCM</div>
              <div className="gen-header-sub">Coche des QCM dans les chapitres à gauche pour les ajouter ici</div>
            </div>
            {selection.length > 0 && (
              <div className="gen-header-actions">
                {elementsCoches.size > 0 && (
                  <button className="gen-header-action-btn danger" onClick={retirerElementsCoches}>
                    Retirer la sélection ({elementsCoches.size})
                  </button>
                )}
                <button className="gen-header-action-btn danger" onClick={toutRetirer}>🗑️ Tout retirer</button>
              </div>
            )}
          </div>
        </div>

        {selection.length === 0 ? (
          <div className="gen-selection-empty">
            <div style={{ fontSize: 32, opacity: .3 }}>🔤</div>
            <div>Aucun QCM sélectionné pour l'instant.</div>
          </div>
        ) : (
          <div className="gen-selection-list">
            {selection.map((q, idx) => (
              <div
                key={q._cle}
                className={`gen-selected-item${dragIndex === idx ? " dragging" : ""}${overIndex === idx && dragIndex !== null && dragIndex !== idx ? ` drag-over-${overZone}` : ""}`}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragEnter={() => { if (dragIndex !== null && dragIndex !== idx) setOverIndex(idx); }}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null); setOverZone(null); }}
                onDragOver={e => {
                  e.preventDefault();
                  if (dragIndex === null || dragIndex === idx) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientY - rect.top) / rect.height;
                  const zone = ratio < 0.3 ? "top" : ratio > 0.7 ? "bottom" : "middle";
                  setOverIndex(idx); setOverZone(zone);
                }}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== idx) {
                    if (overZone === "middle") intervertirSelection(dragIndex, idx);
                    else deplacerSelection(dragIndex, overZone === "top" ? idx : (dragIndex < idx ? idx : idx + 1));
                  }
                  setDragIndex(null); setOverIndex(null); setOverZone(null);
                }}
              >
                <span className="gen-drag-handle" title="Glisser pour réordonner">⠿</span>
                <input type="checkbox" className="gen-selected-checkbox" checked={elementsCoches.has(q._cle)}
                  onChange={() => toggleCocheElement(q._cle)} onClick={e => e.stopPropagation()} />
                <div className="gen-selected-num">{idx + 1}</div>
                <div className="gen-selected-content">
                  <div className="gen-selected-chapitre">{nomChapitre(q.chapitre_id)}</div>
                  <div className="gen-selected-enonce"><MathText>{q.enonce}</MathText></div>
                </div>
                {q.mode === "aleatoire" && (
                  <>
                    <input type="number" className="gen-selected-nbcopies" min={1} max={20}
                      value={nbCopiesParItem[q._cle] || 1}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setNbCopiesParItem(prev => ({ ...prev, [q._cle]: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))} />
                    <button className="gen-selected-duplicate" onClick={() => dupliquerSelection(q, nbCopiesParItem[q._cle] || 1)} title="Dupliquer avec de nouveaux tirages">🎲+</button>
                  </>
                )}
                <button className="gen-selected-remove" onClick={() => retirerSelection(q._cle)} title="Retirer">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="gen-footer">
          <div className="gen-footer-count">
            <strong>{selection.length}</strong> QCM sélectionné{selection.length !== 1 ? "s" : ""}
          </div>
          <button className="gen-export-btn-secondary" onClick={() => telechargerTexQcm(false)} disabled={selection.length === 0}>
            📝 .tex élève
          </button>
          <button className="gen-export-btn-secondary" onClick={() => telechargerTexQcm(true)} disabled={selection.length === 0}>
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
        <DiapoViewerQcm
          questions={selection}
          mode={diapoActive.mode}
          delai={diapoActive.delai}
          nomChapitre={nomChapitre}
          onFermer={() => setDiapoActive(null)}
        />
      )}

      {afficherTirage && (
        <TirageAleatoireQcm
          chapitres={chapitres}
          onAnnuler={() => setAfficherTirage(false)}
          onTirer={(tirage) => { setSelection(tirage); setAfficherTirage(false); }}
        />
      )}

      {afficherCreerQcm && (
        <CreerQcm
          chapitres={chapitres}
          currentUser={currentUser}
          niveauScolaire={niveauScolaire}
          qcmAEditer={qcmAModifier}
          onFermer={() => { setAfficherCreerQcm(false); setQcmAModifier(null); }}
          onCree={() => {
            setAfficherCreerQcm(false);
            setQcmAModifier(null);
            setQcmParChapitre({});
            setChapitresOuverts({});
          }}
        />
      )}

      {afficherImportQcm && (
        <ImportQcm
          currentUser={currentUser}
          chapitres={chapitres}
          niveauScolaire={niveauScolaire}
          onFermer={() => setAfficherImportQcm(false)}
          onImportTermine={() => {
            setQcmParChapitre({});
            setChapitresOuverts({});
          }}
        />
      )}

      {qcmASupprimer && (
        <ConfirmModal
          titre="Supprimer ce QCM ?"
          message="Supprimé définitivement, cette action est irréversible."
          texteConfirmer="Supprimer"
          danger
          onConfirm={confirmerSuppressionQcm}
          onAnnuler={() => setQcmASupprimer(null)}
        />
      )}
      {confirmerToutRetirer && (
        <ConfirmModal
          titre="Vider la sélection ?"
          message={`Retirer les ${selection.length} QCM de la sélection en cours.`}
          texteConfirmer="Retirer"
          onConfirm={confirmerToutRetirerAction}
          onAnnuler={() => setConfirmerToutRetirer(false)}
        />
      )}
    </div>
  );
}

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
  const [messageASupprimer, setMessageASupprimer] = useState(null); // message en attente de confirmation
  const [fichierASupprimer, setFichierASupprimer] = useState(null); // message dont le fichier est en attente de confirmation
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

  function demanderSuppressionMessage(msg) {
    setMessageASupprimer(msg);
  }

  async function confirmerSuppressionMessage() {
    const msg = messageASupprimer;
    if (!msg) return;
    setMessageASupprimer(null);

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
  function demanderSuppressionFichier(msg) {
    setFichierASupprimer(msg);
  }

  async function confirmerSuppressionFichier() {
    const msg = fichierASupprimer;
    if (!msg) return;
    setFichierASupprimer(null);

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
                onSupprimer={demanderSuppressionMessage}
                onSupprimerFichier={demanderSuppressionFichier} />
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
      {messageASupprimer && (
        <ConfirmModal
          titre="Supprimer ce message ?"
          message="Cette action est irréversible."
          texteConfirmer="Supprimer"
          danger
          onConfirm={confirmerSuppressionMessage}
          onAnnuler={() => setMessageASupprimer(null)}
        />
      )}
      {fichierASupprimer && (
        <ConfirmModal
          titre="Supprimer ce fichier ?"
          message="Le texte du message, s'il y en a, sera conservé. Seul le fichier joint sera effacé du stockage."
          texteConfirmer="Supprimer le fichier"
          danger
          onConfirm={confirmerSuppressionFichier}
          onAnnuler={() => setFichierASupprimer(null)}
        />
      )}
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
  const [activeTab, setActiveTab] = useState("generateur");
  const [niveauScolaire, setNiveauScolaire] = useState("terminale_spe");
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => { document.title = "Mathématiques à Valadon"; }, []);

  const COULEURS_NIVEAU = {
    terminale_spe: "#2563eb",
    premiere_specifique: "#7c3aed",
    premiere_spe:        "#9333ea",
    premiere_techno:     "#c026d3",
    seconde:       "#059669",
  };
  // Variante claire (hover, textes accentués) et triplet RGB (badges semi-transparents)
  // pour chaque couleur de niveau — mêmes usages que --accent-light / --accent-rgb.
  const COULEURS_NIVEAU_LIGHT = {
    terminale_spe: "#60a5fa",
    premiere_specifique: "#a78bfa",
    premiere_spe:        "#c084fc",
    premiere_techno:     "#e879f9",
    seconde:       "#34d399",
  };
  const COULEURS_NIVEAU_RGB = {
    terminale_spe: "37,99,235",
    premiere_specifique: "124,58,237",
    premiere_spe:        "147,51,234",
    premiere_techno:     "192,38,211",
    seconde:       "5,150,105",
  };
  const COULEUR_QCM = "#f59e0b";
  const COULEUR_QCM_LIGHT = "#fbbf24";
  const COULEUR_QCM_RGB = "245,158,11";
  const estContexteQcm = activeTab === "qcm" || activeTab === "historique_qcm";
  const couleurActive = estContexteQcm ? COULEUR_QCM : (COULEURS_NIVEAU[niveauScolaire] || "#2563eb");
  const estTerminaleSpe = niveauScolaire === "terminale_spe";
  // Injectées en CSS custom properties sur le conteneur de contenu : tout ce qui
  // utilise déjà var(--accent) / var(--accent-light) / var(--accent-rgb) (filtres,
  // badges, boutons, checkboxes, tirage, barre de progression…) se reteinte
  // automatiquement selon le niveau actif, sans toucher au CSS de chaque composant.
  // L'onglet QCM a sa propre identité (ambre) : elle prime sur la couleur du niveau,
  // pour ne pas hériter du niveau sélectionné juste avant d'y accéder.
  const styleNiveau = {
    "--accent": couleurActive,
    "--accent-light": estContexteQcm ? COULEUR_QCM_LIGHT : (COULEURS_NIVEAU_LIGHT[niveauScolaire] || "#7b8fff"),
    "--accent-rgb": estContexteQcm ? COULEUR_QCM_RGB : (COULEURS_NIVEAU_RGB[niveauScolaire] || "91,115,255"),
    background: "radial-gradient(ellipse 1200px 800px at 15% 0%, rgba(var(--accent-rgb), 0.06), transparent 60%), var(--bg)",
  };
  const [sessionARecharger, setSessionARecharger] = useState(null); // ids de questions à charger dans le générateur
  const [contenuExactARecharger, setContenuExactARecharger] = useState(null); // contenu déjà résolu (mêmes valeurs), générateur
  // Incrémenté à chaque sauvegarde de session (diaporama/.tex), pour que
  // l'Historique se rafraîchisse même s'il est déjà ouvert au moment de la sauvegarde.
  const [historiqueVersion, setHistoriqueVersion] = useState(0);
  const notifierNouvelleSessionHistorique = () => setHistoriqueVersion(v => v + 1);
  const [qcmSessionARecharger, setQcmSessionARecharger] = useState(null); // ids de qcm à charger dans la rubrique QCM
  const [qcmContenuExactARecharger, setQcmContenuExactARecharger] = useState(null); // contenu déjà résolu (mêmes valeurs), QCM

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

  // Basculer vers le bon sous-onglet au changement de niveau — le défaut est
  // toujours le premier sous-onglet de la liste (Automatismes, quel que soit le niveau).
  useEffect(() => {
    if (activeTab === "qcm" || activeTab === "historique_qcm") {
      setActiveTab(estTerminaleSpe ? "generateur" : "automatismes");
      return;
    }
    const ongletsTerminale = ["generateur", "historique", "ressources", "chat"];
    const ongletsAutres = ["automatismes", "historique"];
    if (estTerminaleSpe && !ongletsTerminale.includes(activeTab)) {
      setActiveTab("generateur");
    }
    if (!estTerminaleSpe && !ongletsAutres.includes(activeTab)) {
      setActiveTab("automatismes");
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
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0, ...styleNiveau }}>

            {/* Barre unifiée : rangée 1 fixe (titre + QCM + niveaux + compte), rangée 2 contextuelle (sous-onglets) */}
            <div className="niveau-top-bar">
              <div className="niveau-top-row1">
                <div className="site-titre" onClick={() => supabase.auth.signOut()} title="Se déconnecter">Mathématiques à Valadon</div>
                <div className="niveau-separateur"></div>

                {/* Automatismes QCM : indépendant du niveau (regroupe Seconde + Première),
                    point d'entrée unique fixe en première ligne, avant les pills de niveau.
                    Reste visible même sur Terminale Spé — cette rangée ne bouge jamais. */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <button className={`niveau-pill${estContexteQcm ? " active" : ""}`}
                    style={estContexteQcm ? { background: COULEUR_QCM, color: "#1c1300" } : {}}
                    onClick={() => setActiveTab("qcm")}>
                    <span aria-hidden="true" style={{ marginRight: 6 }}>🎲</span>Automatismes QCM
                  </button>
                  <span style={{ fontSize: 9, color: COULEUR_QCM, letterSpacing: ".03em" }}>SECONDE + 1RE</span>
                </div>
                <div className="niveau-separateur"></div>

                {/* Pills de niveau */}
                <div className="niveau-pills">
                  {[
                    { id: "terminale_spe", label: "Terminale spé", icone: "🔷" },
                    { id: "premiere_specifique", label: "1re spécifique", icone: "🔶" },
                    { id: "premiere_spe", label: "1re spécialité", icone: "🔸" },
                    { id: "premiere_techno", label: "1re techno", icone: "🔻" },
                    { id: "seconde", label: "Seconde", icone: "🔺" },
                  ].map(n => (
                    <button key={n.id} className={`niveau-pill${(!estContexteQcm && niveauScolaire === n.id) ? " active" : ""}`}
                      style={(!estContexteQcm && niveauScolaire === n.id) ? { background: COULEURS_NIVEAU[n.id] } : {}}
                      onClick={() => {
                        setNiveauScolaire(n.id);
                        if (estContexteQcm) {
                          setActiveTab(n.id === "terminale_spe" ? "generateur" : "automatismes");
                        }
                      }}>
                      <span aria-hidden="true" style={{ marginRight: 6 }}>{n.icone}</span>{n.label}
                    </button>
                  ))}
                </div>

                {/* Actions de compte — à droite de la même rangée */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <UsageIndicator />
                  <button className="btn-key" onClick={() => setShowPasswordModal(true)} title="Changer mon mot de passe">
                    🔑 Mot de passe
                  </button>
                  <button className="btn-logout" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
                </div>
              </div>

              <div className="niveau-top-row2">
                {/* Sous-onglets contextuels : QCM (si actif) prime sur le niveau,
                    sinon Terminale Spé ou Seconde/Première selon la pill sélectionnée */}
                {estContexteQcm ? (
                  <>
                    <button className="sidebar-tab-top" onClick={() => setActiveTab("qcm")}
                      style={{ color: activeTab === "qcm" ? COULEUR_QCM : "", borderBottom: activeTab === "qcm" ? `2px solid ${COULEUR_QCM}` : "2px solid transparent" }}>
                      QCM
                    </button>
                    <button className="sidebar-tab-top" onClick={() => setActiveTab("historique_qcm")}
                      style={{ color: activeTab === "historique_qcm" ? COULEUR_QCM : "", borderBottom: activeTab === "historique_qcm" ? `2px solid ${COULEUR_QCM}` : "2px solid transparent" }}>
                      Historique
                    </button>
                  </>
                ) : estTerminaleSpe ? (
                  <>
                    <button className="sidebar-tab-top" onClick={() => setActiveTab("generateur")}
                      style={{ color: activeTab === "generateur" ? couleurActive : "", borderBottom: activeTab === "generateur" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                      Automatismes
                    </button>
                    <button className="sidebar-tab-top" onClick={() => setActiveTab("historique")}
                      style={{ color: activeTab === "historique" ? couleurActive : "", borderBottom: activeTab === "historique" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                      Historique
                    </button>
                    <button className="sidebar-tab-top" onClick={() => setActiveTab("ressources")}
                      style={{ color: activeTab === "ressources" ? couleurActive : "", borderBottom: activeTab === "ressources" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                      Ressources
                    </button>
                    <button className="sidebar-tab-top" onClick={() => setActiveTab("chat")}
                      style={{ color: activeTab === "chat" ? couleurActive : "", borderBottom: activeTab === "chat" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                      Grand Oral{totalUnread > 0 && <span className="badge-count" style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px" }}>{totalUnread}</span>}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="sidebar-tab-top" onClick={() => setActiveTab("automatismes")}
                      style={{ color: activeTab === "automatismes" ? couleurActive : "", borderBottom: activeTab === "automatismes" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                      Automatismes
                    </button>
                    <button className="sidebar-tab-top" onClick={() => setActiveTab("historique")}
                      style={{ color: activeTab === "historique" ? couleurActive : "", borderBottom: activeTab === "historique" ? `2px solid ${couleurActive}` : "2px solid transparent" }}>
                      Historique
                    </button>
                  </>
                )}
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
                    niveauScolaire={niveauScolaire} actif={activeTab === "historique"} historiqueVersion={historiqueVersion}
                    onRejouer={(session, mode) => {
                      if (session.type_session === "qcm") {
                        if (mode === "memes" && session.contenu_selection) setQcmContenuExactARecharger(session.contenu_selection);
                        else setQcmSessionARecharger(session.question_ids);
                        setActiveTab("qcm");
                      } else {
                        if (mode === "memes" && session.contenu_selection) setContenuExactARecharger(session.contenu_selection);
                        else setSessionARecharger(session.question_ids);
                        setActiveTab("generateur");
                      }
                    }} />
                </div>
              </>
            )}

            {/* GenerateurZone — commun à tous les niveaux, tous affichés sous l'onglet "Automatismes" */}
            <div style={{ display: activeTab === "generateur" || activeTab === "automatismes" ? "flex" : "none", flex: 1, minHeight: 0 }}>
              <GenerateurZone currentUser={user} currentProfile={profile}
                sessionARecharger={sessionARecharger} onSessionChargee={() => setSessionARecharger(null)}
                contenuExactARecharger={contenuExactARecharger} onContenuExactCharge={() => setContenuExactARecharger(null)}
                niveauScolaire={niveauScolaire} onSessionSauvegardee={notifierNouvelleSessionHistorique} />
            </div>

            {/* Historique Seconde/Première */}
            {!estTerminaleSpe && (
              <div style={{ display: activeTab === "historique" ? "flex" : "none", flex: 1, minHeight: 0 }}>
                <HistoriqueZone currentUser={user} currentProfile={profile} allProfiles={allProfiles}
                  niveauScolaire={niveauScolaire} actif={activeTab === "historique"} historiqueVersion={historiqueVersion}
                  onRejouer={(session, mode) => {
                    if (session.type_session === "qcm") {
                      if (mode === "memes" && session.contenu_selection) setQcmContenuExactARecharger(session.contenu_selection);
                      else setQcmSessionARecharger(session.question_ids);
                      setActiveTab("qcm");
                    } else {
                      if (mode === "memes" && session.contenu_selection) setContenuExactARecharger(session.contenu_selection);
                      else setSessionARecharger(session.question_ids);
                      setActiveTab("automatismes");
                    }
                  }} />
              </div>
            )}

            {/* QCM */}
            <div style={{ display: activeTab === "qcm" ? "flex" : "none", flex: 1, minHeight: 0 }}>
              <QcmZone currentUser={user} currentProfile={profile}
                qcmSessionARecharger={qcmSessionARecharger} onSessionChargee={() => setQcmSessionARecharger(null)}
                qcmContenuExactARecharger={qcmContenuExactARecharger} onContenuExactCharge={() => setQcmContenuExactARecharger(null)}
                niveauScolaire={niveauScolaire} onSessionSauvegardee={notifierNouvelleSessionHistorique} />
            </div>

            {/* Historique QCM : indépendant du niveau, comme l'onglet Automatismes QCM lui-même */}
            <div style={{ display: activeTab === "historique_qcm" ? "flex" : "none", flex: 1, minHeight: 0 }}>
              <HistoriqueZone currentUser={user} currentProfile={profile} allProfiles={allProfiles}
                niveauScolaire="automatismes_qcm" actif={activeTab === "historique_qcm"} historiqueVersion={historiqueVersion}
                onRejouer={(session, mode) => {
                  if (mode === "memes" && session.contenu_selection) setQcmContenuExactARecharger(session.contenu_selection);
                  else setQcmSessionARecharger(session.question_ids);
                  setActiveTab("qcm");
                }} />
            </div>

          </div>
        )}

        {profile.role === "eleve" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div className="site-titre-clic" onClick={() => supabase.auth.signOut()} title="Se déconnecter"
              style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
              Mathématiques à Valadon
            </div>
            <div className="sidebar-tabs eleve-tabs">
              <button className={`sidebar-tab${activeTab === "chat" ? " active" : ""}`}
                onClick={() => setActiveTab("chat")}>💬 Discussion</button>
              <button className={`sidebar-tab${activeTab === "ressources" ? " active" : ""}`}
                onClick={() => setActiveTab("ressources")}>📚 Ressources</button>
              <button className="btn-logout" style={{ marginLeft: "auto" }} onClick={() => supabase.auth.signOut()}>
                Déconnexion
              </button>
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
      {showPasswordModal && profile?.role === "professeur" && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </>
  );
}
