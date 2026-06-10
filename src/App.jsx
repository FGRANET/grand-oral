
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

  /* ── Zone chat ── */
  .chat-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }

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
function fileIcon(type) {
  if (!type) return "📄";
  if (type.startsWith("image")) return "🖼️";
  if (type.includes("pdf")) return "📕";
  if (type.includes("word") || type.includes("doc")) return "📝";
  return "📎";
}

// ─── Composant Login ─────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true); setErr("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) { setErr("Identifiant ou mot de passe incorrect."); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    onLogin(data.user, profile);
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">Terminale Spé · F. Granet</div>
        <div className="login-title">Grand Oral</div>
        <div className="login-sub">Espace de préparation individuelle</div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="prenom.nom@..." onKeyDown={e => e.key === "Enter" && handleLogin()} />
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
function SaisieSubject({ profile, onSave }) {
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
          Il apparaîtra dans ton espace et aidera M. / Mme Granet à préparer tes réponses.
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

  const displayName = currentProfile?.role === "professeur"
    ? `${eleveProfile?.prenom} ${eleveProfile?.nom}`
    : "M. / Mme Granet";

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
              : "FG"}
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
        <button className="btn-logout" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </div>

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

  // Vérifier session existante
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        setUser(session.user); setProfile(p);
      }
      setLoading(false);
    });
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
    return (
      <>
        <style>{CSS}</style>
        <SaisieSubject
          profile={profile}
          onSave={(sujet) => setProfile({ ...profile, sujet })}
        />
      </>
    );
  }

  const eleves = allProfiles.filter(p => p.role === "eleve").sort((a, b) => a.nom.localeCompare(b.nom));
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {profile.role === "professeur" && (
          <div className="sidebar">
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
          </div>
        )}
        <ChatZone
          eleveId={profile.role === "professeur" ? selectedEleve : user.id}
          currentUser={user}
          currentProfile={profile}
          allProfiles={allProfiles}
        />
      </div>
    </>
  );
}
