
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

import { useState, useEffect, useRef, useCallback } from "react";
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
  .app { display: flex; height: 100vh; }

  /* ── Sidebar (vue prof) ── */
  .sidebar {
    width: 280px; flex-shrink: 0; background: var(--surface);
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
  .sidebar-list { flex: 1; overflow-y: auto; padding: 8px; }
  .sidebar-list::-webkit-scrollbar { width: 4px; }
  .sidebar-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

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
  .sidebar-tabs { display: flex; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .sidebar-tabs.eleve-tabs { max-width: 360px; background: var(--surface); }
  .sidebar-tab {
    flex: 1; padding: 12px 0; text-align: center; font-size: 12px; font-weight: 600;
    color: var(--text-muted); cursor: pointer; background: none; border: none;
    font-family: var(--font); border-bottom: 2px solid transparent; transition: all .15s;
  }
  .sidebar-tab.active { color: var(--accent-light); border-bottom-color: var(--accent); }
  .sidebar-tab:hover { color: var(--text); }

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
  .generateur-area { flex: 1; display: flex; min-width: 0; }
  .gen-chapitres-col {
    width: 420px; flex-shrink: 0; border-right: 1px solid var(--border);
    overflow-y: auto; padding: 16px;
  }
  .gen-selection-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .gen-selection-list { flex: 1; overflow-y: auto; padding: 20px 24px; }
  .gen-header { padding: 16px 24px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .gen-header-title { font-size: 16px; font-weight: 600; }
  .gen-header-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

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
  .bubble-meta { font-size: 10px; color: var(--text-muted); margin-top: 4px; text-align: right; }
  .msg-row:not(.mine) .bubble-meta { text-align: left; }

  .bubble-sender { font-size: 11px; font-weight: 600; color: var(--accent-light); margin-bottom: 4px; }

  /* ── Fichier joint ── */
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
  "compléments sur les variables aléatoires.": "VA",
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

function MathText({ children, inline = true }) {
  const segments = renderMathSegments(children || "");
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className="katex-render">
      {segments.map(seg => {
        if (seg.type === "text") return <span key={seg.key}>{seg.content}</span>;
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

// ─── Composant Login ─────────────────────────────────────────────────
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
function Message({ msg, isMe, profile }) {
  const hasFile = !!msg.fichier_url;
  const hasText = !!msg.contenu;
  return (
    <div className={`msg-row${isMe ? " mine" : ""}`}>
      {!isMe && (
        <div className="avatar avatar-sm" style={{ background: isMe ? undefined : "linear-gradient(135deg,#6366f1,#a78bfa)" }}>
          {initials(profile?.nom, profile?.prenom)}
        </div>
      )}
      <div>
        {!isMe && <div className="bubble-sender">{profile?.prenom} {profile?.nom}</div>}
        <div className="bubble">
          {hasFile && (
            <a className="file-bubble" href={msg.fichier_url} target="_blank" rel="noreferrer">
              <span className="file-icon">{fileIcon(msg.fichier_type)}</span>
              <div className="file-details">
                <div className="file-name">{msg.fichier_nom}</div>
                <div className="file-dl">Ouvrir le fichier</div>
              </div>
            </a>
          )}
          {hasText && <div style={{ marginTop: hasFile ? 8 : 0 }}>{msg.contenu}</div>}
          <div className="bubble-meta">{formatTime(msg.created_at)}</div>
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
function GenerateurZone({ currentUser, currentProfile }) {
  const [chapitres, setChapitres] = useState([]);
  const [questionsParChapitre, setQuestionsParChapitre] = useState({}); // { chapitre_id: [questions] }
  const [chapitresOuverts, setChapitresOuverts] = useState({});        // { chapitre_id: bool }
  const [chargementChapitre, setChargementChapitre] = useState({});    // { chapitre_id: bool }
  const [questionsDetail, setQuestionsDetail] = useState({});          // { question_id: bool } détail ouvert
  const [reponsesVisibles, setReponsesVisibles] = useState({});        // { question_id: bool } réponse révélée (masquée par défaut)
  const [selection, setSelection] = useState([]);                       // [question objects, dans l'ordre de sélection]
  const TYPES_DISPONIBLES = ["formule", "méthode", "définition", "théorème"];
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
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [overZone, setOverZone] = useState(null); // "top" | "middle" | "bottom"
  const [loading, setLoading] = useState(true);
  const [questionEnEdition, setQuestionEnEdition] = useState(null); // id de la question en cours d'édition
  const [brouillonEdition, setBrouillonEdition] = useState(null);    // { type, enonce, reponse, niveau }
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);

  // Charger la liste des chapitres au montage
  useEffect(() => {
    supabase.from("chapitres").select("*").order("ordre").then(({ data }) => {
      setChapitres(data || []);
      setLoading(false);
    });
  }, []);

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
          const nbSelectionnees = questions.filter(q => estSelectionnee(q.id)).length;
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
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="gen-selection-col">
        <div className="gen-header">
          <div className="gen-header-title">Sélection pour l'interrogation</div>
          <div className="gen-header-sub">Coche des questions dans les chapitres à gauche pour les ajouter ici</div>
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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
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
          <button className="btn-key" onClick={() => setShowPasswordModal(true)} title="Changer mon mot de passe">
            🔑 Mot de passe
          </button>
          <button className="btn-logout" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
        </div>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

      <div className="messages-list">
        {grouped.map((item, i) =>
          item.type === "date"
            ? <div key={i} className="date-sep">{item.label}</div>
            : <Message key={item.msg.id} msg={item.msg}
                isMe={item.msg.sender_id === currentUser.id}
                profile={allProfiles.find(p => p.id === item.msg.sender_id)} />
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
  const [activeTab, setActiveTab] = useState("chat"); // "chat" ou "ressources"

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
          <div className="sidebar" style={activeTab === "generateur" ? { width: 200 } : {}}>
            <div className="sidebar-tabs">
              <button className={`sidebar-tab${activeTab === "chat" ? " active" : ""}`}
                onClick={() => setActiveTab("chat")}>Élèves</button>
              <button className={`sidebar-tab${activeTab === "ressources" ? " active" : ""}`}
                onClick={() => setActiveTab("ressources")}>Ressources</button>
              <button className={`sidebar-tab${activeTab === "generateur" ? " active" : ""}`}
                onClick={() => setActiveTab("generateur")}>Générateur</button>
            </div>
            {activeTab === "chat" && (
              <>
                <div className="sidebar-header">
                  <div className="sidebar-title">Élèves</div>
                  {totalUnread > 0 && <div className="badge-count">{totalUnread}</div>}
                </div>
                <div className="sidebar-list">
                  {eleves.map(el => (
                    <div key={el.id} className={`eleve-item${selectedEleve === el.id ? " active" : ""}`}
                      onClick={() => setSelectedEleve(el.id)}>
                      <div className="avatar">
                        {initials(el.nom, el.prenom)}
                        {unreadCounts[el.id] > 0 && <div className="unread-dot" />}
                      </div>
                      <div className="eleve-info">
                        <div className="eleve-name">{el.prenom} {el.nom}</div>
                        <div className="eleve-sujet">{el.sujet || "Sujet non défini"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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

        {profile.role === "professeur" && activeTab === "chat" && (
          <ChatZone
            eleveId={selectedEleve}
            currentUser={user}
            currentProfile={profile}
            allProfiles={allProfiles}
          />
        )}
        {profile.role === "professeur" && activeTab === "ressources" && (
          <RessourcesZone currentUser={user} currentProfile={profile} />
        )}
        {profile.role === "professeur" && activeTab === "generateur" && (
          <GenerateurZone currentUser={user} currentProfile={profile} />
        )}
      </div>
    </>
  );
}
