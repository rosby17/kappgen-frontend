import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import freedomSunrise from './assets/dashboard/freedom-sunrise.png';

const getOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '');
const isLocalhost = getOrigin().includes('localhost') || getOrigin().includes('127.0.0.1');

let rawApiBase = import.meta.env.VITE_API_BASE || (isLocalhost ? `${getOrigin()}/api` : "https://api.kappgen.com/api");
if (rawApiBase.startsWith("http://api.kappgen.com")) {
  rawApiBase = rawApiBase.replace("http://", "https://");
}
const API_BASE = rawApiBase;

// Mirrors SERVICE_UNAVAILABLE_MESSAGE in backend/src/worker/queue_runner.py —
// a render failure with exactly this text means an underlying paid-provider
// outage, not something the creator did wrong; used to offer "switch this
// channel to manual" instead of just "Relancer" (which would just fail again).
const SERVICE_UNAVAILABLE_MESSAGE = "Les serveurs de KappGen sont temporairement indisponibles. Veuillez réessayer plus tard.";
// Mirrors CREDIT_INSUFFICIENT_MESSAGE in backend/src/worker/queue_runner.py —
// keep the two in sync so the "recharger" CTA below only shows for this exact message.
const CREDIT_INSUFFICIENT_MESSAGE = "La génération automatique est en pause : ton solde de crédits KappGen est épuisé. Recharge des crédits pour que cette chaîne continue à écrire et publier ses vidéos automatiquement.";

// Mirrors src/utils/billing.py's IZIVOICE_*/THUMBNAIL_CREDITS constants —
// used here only to show the creator a cost estimate and to gate paid
// options behind an actual balance; the real charge always happens
// server-side, this is display/UX only.
const IMAGE_GENERATION_CREDITS = 1000; // display default (~mid-point); real per-image cost varies, see below
const IMAGE_GENERATION_CREDITS_MIN = 956;
const IMAGE_GENERATION_CREDITS_MAX = 1001;
const THUMBNAIL_GENERATION_CREDITS = 2000;
const MUSIC_GENERATION_CREDITS = 300;
const TRANSCRIPTION_CREDITS_PER_SEC = 3;
const AUTH_PATHS = new Set(['/login', '/signup', '/signin']);

// Broad coverage of the languages with established YouTube audiences. Values
// are human-readable because they are passed directly to the script-writing
// agent (Claude handles language names more reliably than locale codes).
const SCRIPT_LANGUAGES = [
  ['English', 'English', 'EN'], ['Français', 'French', 'FR'], ['Español', 'Spanish', 'ES'],
  ['Português (Brasil)', 'Brazilian Portuguese', 'PT-BR'], ['Deutsch', 'German', 'DE'],
  ['Italiano', 'Italian', 'IT'], ['العربية', 'Arabic', 'AR'], ['हिन्दी', 'Hindi', 'HI'],
  ['বাংলা', 'Bengali', 'BN'], ['اردو', 'Urdu', 'UR'], ['Türkçe', 'Turkish', 'TR'],
  ['Русский', 'Russian', 'RU'], ['Українська', 'Ukrainian', 'UK'], ['Polski', 'Polish', 'PL'],
  ['Nederlands', 'Dutch', 'NL'], ['Bahasa Indonesia', 'Indonesian', 'ID'],
  ['Bahasa Melayu', 'Malay', 'MS'], ['Tiếng Việt', 'Vietnamese', 'VI'], ['ไทย', 'Thai', 'TH'],
  ['Filipino', 'Filipino', 'FIL'], ['日本語', 'Japanese', 'JA'], ['한국어', 'Korean', 'KO'],
  ['中文（简体）', 'Simplified Chinese', 'ZH-CN'], ['中文（繁體）', 'Traditional Chinese', 'ZH-TW'],
  ['தமிழ்', 'Tamil', 'TA'], ['తెలుగు', 'Telugu', 'TE'], ['मराठी', 'Marathi', 'MR'],
  ['ગુજરાતી', 'Gujarati', 'GU'], ['ਪੰਜਾਬੀ', 'Punjabi', 'PA'], ['മലയാളം', 'Malayalam', 'ML'],
  ['ಕನ್ನಡ', 'Kannada', 'KN'], ['नेपाली', 'Nepali', 'NE'], ['فارسی', 'Persian', 'FA'],
  ['עברית', 'Hebrew', 'HE'], ['Kiswahili', 'Swahili', 'SW'], ['Hausa', 'Hausa', 'HA'],
  ['Yorùbá', 'Yoruba', 'YO'], ['Igbo', 'Igbo', 'IG'], ['Afrikaans', 'Afrikaans', 'AF'],
  ['Amharic', 'Amharic', 'AM'], ['Soomaali', 'Somali', 'SO'], ['Ελληνικά', 'Greek', 'EL'],
  ['Română', 'Romanian', 'RO'], ['Čeština', 'Czech', 'CS'], ['Magyar', 'Hungarian', 'HU'],
  ['Svenska', 'Swedish', 'SV'], ['Norsk', 'Norwegian', 'NO'], ['Dansk', 'Danish', 'DA'],
  ['Suomi', 'Finnish', 'FI'], ['Български', 'Bulgarian', 'BG'], ['Српски', 'Serbian', 'SR'],
  ['Hrvatski', 'Croatian', 'HR'], ['Slovenčina', 'Slovak', 'SK'], ['Català', 'Catalan', 'CA'],
].map(([label, value, code]) => ({ label, value, code }));

// Every browser exposes the IANA tz database via Intl (Safari included, since
// 15.4) — fall back to a short curated list only on something ancient.
const TIMEZONE_OPTIONS = (() => {
  try {
    if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) return Intl.supportedValuesOf('timeZone');
  } catch {}
  return ['Africa/Douala', 'Europe/Paris', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney'];
})();

// Default guidance text for the auto-script structure, per script language.
// These are meta-instructions read by the *creator* while configuring their
// channel (Claude itself understands English instructions fine regardless of
// the target script language) — so only languages creators actually
// configure in are translated here; anything else falls back to English.
const SCRIPT_STRUCTURE_DEFAULTS = {
  English: {
    parts: [
      { name: 'hook_intro', word_count: 250, guidance: "Open with a striking hook, present the topic and why it matters, naturally invite the viewer to like and subscribe, tease what's coming without revealing everything." },
      { name: 'context', word_count: 250, guidance: 'Give background and context for the topic, and explain why this truth is often misunderstood or overlooked today.' },
      { name: 'main_part_one', word_count: 900, guidance: 'Develop the core ideas with concrete examples, stories, or analogies; ask thought-provoking questions; naturally remind the listener to like and subscribe partway through.' },
      { name: 'main_part_two', word_count: 900, guidance: 'Go deeper, reveal less obvious insights, explain the benefits of applying this, and address common misconceptions.' },
      { name: 'application', word_count: 900, guidance: 'Give concrete practical steps to apply today, explain how this transforms daily life, and include one short original illustrative story that carries the lesson without stating it outright.' },
      { name: 'conclusion', word_count: 300, guidance: 'Summarize the key ideas powerfully, end with a strong closing statement, and a natural call to action to share, comment, or explore further.' },
    ],
    formatting_rules: [
      'Write every number out in words, never as digits.',
      'Do not include any section titles or labels anywhere in the text.',
      'Write only words meant to be read aloud by a voiceover — no visual directions, no music cues, no stage directions.',
      'Write in flowing continuous paragraphs, never a single isolated line.',
    ],
    cta_style: 'Weave in a natural invitation to like, subscribe, and comment without breaking the tone.',
  },
  Français: {
    parts: [
      { name: 'hook_intro', word_count: 250, guidance: "Ouvre avec une accroche percutante, présente le sujet et pourquoi il compte, invite naturellement à aimer et s'abonner, laisse entrevoir la suite sans tout révéler." },
      { name: 'context', word_count: 250, guidance: "Donne le contexte du sujet et explique pourquoi cette vérité est souvent mal comprise ou négligée aujourd'hui." },
      { name: 'main_part_one', word_count: 900, guidance: "Développe les idées centrales avec des exemples concrets, des histoires ou des analogies ; pose des questions qui font réfléchir ; rappelle naturellement d'aimer et de s'abonner à mi-parcours." },
      { name: 'main_part_two', word_count: 900, guidance: "Va plus loin, révèle des aspects moins évidents, explique les bénéfices d'appliquer cela, et corrige les idées reçues courantes." },
      { name: 'application', word_count: 900, guidance: "Donne des étapes concrètes à appliquer dès aujourd'hui, explique comment cela transforme le quotidien, et inclus une courte histoire originale illustrant la leçon sans l'énoncer directement." },
      { name: 'conclusion', word_count: 300, guidance: "Résume les idées clés avec force, termine par une déclaration marquante, et un appel naturel à partager, commenter ou explorer davantage." },
    ],
    formatting_rules: [
      "Écris tous les nombres en toutes lettres, jamais en chiffres.",
      "N'inclus aucun titre ni label de section dans le texte.",
      "N'écris que des mots destinés à être lus à voix haute par une narration — aucune indication visuelle, aucune référence musicale, aucune indication de mise en scène.",
      "Écris en paragraphes fluides et continus, jamais en ligne isolée.",
    ],
    cta_style: "Glisse une invitation naturelle à aimer, s'abonner et commenter sans casser le ton.",
  },
};
// The structure editor's own part names/guidance text are meta-instructions
// read by the *creator* configuring their channel — KappGen's interface is
// French, so these always default to French, regardless of `language`
// below, which is a completely separate setting: the language the AI
// actually WRITES the generated video's script in. A francophone creator
// can perfectly well generate English-language videos while still reading
// French labels here to understand what they're configuring.
const getScriptStructureDefaults = () => SCRIPT_STRUCTURE_DEFAULTS.Français;

// Rough conversion ratios used only to let the creator set a script's total
// length as characters or as a target video duration instead of raw word
// counts. Matches the ~150 wpm speech-rate estimate already used server-side
// (backend/src/api/routes/videos.py) so the duration shown here lines up
// with the duration the backend will actually estimate.
const CHARS_PER_WORD = 6;
const WORDS_PER_MINUTE = 150;
const wordsToChars = (words) => Math.round(words * CHARS_PER_WORD);
const charsToWords = (chars) => Math.round(chars / CHARS_PER_WORD);
const wordsToMinutes = (words) => words / WORDS_PER_MINUTE;
const minutesToWords = (minutes) => Math.round(minutes * WORDS_PER_MINUTE);

// Rescales every part's word_count proportionally so the parts sum to
// newTotalWords, preserving each part's relative share of the total. The
// last part absorbs the rounding remainder so the sum always matches exactly.
const redistributePartsToTotal = (parts, newTotalWords) => {
  if (!parts.length) return parts;
  const currentTotal = parts.reduce((sum, p) => sum + (Number(p.word_count) || 0), 0) || parts.length;
  let running = 0;
  return parts.map((p, i) => {
    if (i === parts.length - 1) return { ...p, word_count: Math.max(0, newTotalWords - running) };
    const share = Math.round(((Number(p.word_count) || 0) / currentTotal) * newTotalWords);
    running += share;
    return { ...p, word_count: share };
  });
};

let rawStorageBase = import.meta.env.VITE_STORAGE_BASE || (isLocalhost ? `${getOrigin()}/storage` : "https://api.kappgen.com/storage");
if (rawStorageBase.startsWith("http://api.kappgen.com")) {
  rawStorageBase = rawStorageBase.replace("http://", "https://");
}
const STORAGE_BASE = rawStorageBase;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const MARKETING_ORIGIN = import.meta.env.VITE_MARKETING_ORIGIN || (isLocalhost ? getOrigin().replace(/\/app\/?$/, '') : "https://kappgen.com");

// Human-readable URL slug derived from a channel name, e.g. "Riviere de Grace" -> "riviere-de-grace".
// Purely a display/routing convenience — the channel's real id is still what's sent to the API.
const slugifyChannelName = (name) =>
  (name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'chaine';

// Encodes an AudioBuffer as a 16-bit PCM WAV Blob — no external library
// needed, and WAV decodes losslessly on the backend's own ffmpeg re-encode,
// so there's no quality tradeoff versus shipping the original container.
const encodeWav = (audioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(audioBuffer.getChannelData(ch));
  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

// Voice cloning only ever uses the first ~30s of a sample (see backend's
// CLONE_MAX_SECONDS) — trimming here, before upload, avoids sending an
// entire long recording (which can be tens of MB and slow on a weak
// connection) just to have the server throw most of it away. Falls back to
// uploading the original file untouched if decoding fails for any reason
// (unsupported codec, browser quirk, etc.) — the backend still trims safely
// either way, this is purely a client-side upload-size optimization.
const trimAudioClientSide = async (file, maxSeconds = 32) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return file;
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioCtx();
    let decoded;
    try {
      decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      audioCtx.close();
    }
    if (decoded.duration <= maxSeconds) return file;

    const frameCount = Math.floor(Math.min(maxSeconds, decoded.duration) * decoded.sampleRate);
    // Manually copy the first frameCount samples per channel — simpler and
    // more portable than wiring up an OfflineAudioContext render graph just
    // to truncate a buffer.
    const out = new AudioBuffer({
      length: frameCount,
      numberOfChannels: decoded.numberOfChannels,
      sampleRate: decoded.sampleRate,
    });
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      out.copyToChannel(decoded.getChannelData(ch).subarray(0, frameCount), ch);
    }
    const wavBlob = encodeWav(out);
    const trimmedName = (file.name || 'audio').replace(/\.[^.]+$/, '') + `-${maxSeconds}s.wav`;
    return new File([wavBlob], trimmedName, { type: 'audio/wav' });
  } catch (err) {
    console.warn('Découpage audio côté client impossible, envoi du fichier original :', err);
    return file;
  }
};

const getVideoUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.replace(/^(\.nichecut-storage\/|storage\/|\/)+/, '');
  return `${STORAGE_BASE}/${cleanPath}`;
};

// The AI-generated thumbnail (thumbnail.jpg) always sits next to output.mp4
// in the same render folder — used as the video card's poster so what the
// creator sees here matches exactly what gets uploaded to YouTube.
const getVideoThumbnailUrl = (vid, bustKey) => {
  if (!vid?.output_path) return null;
  return getVideoUrl(vid.output_path.replace(/[^/]+$/, 'thumbnail.jpg')) + `?v=${bustKey || vid.finished_at || ''}`;
};

// Preset Subtitle Styles
const SUBTITLE_PRESETS = [
  {
    id: 'hormozi',
    name: 'Hormozi Gold 🔥',
    font: 'Inter',
    size: 46,
    color: '#FFD700',
    outline_color: '#000000',
    outline_width: 4,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'tiktok_glow',
    name: 'TikTok Neon Cyan ⚡',
    font: 'Inter',
    size: 44,
    color: '#00FFFF',
    outline_color: '#003b46',
    outline_width: 3,
    position: 'bottom',
    karaoke: true,
    box_color: 'rgba(0,0,0,0.6)'
  },
  {
    id: 'cinematic_dark',
    name: 'Cinématique Épuré 🎬',
    font: 'Inter',
    size: 40,
    color: '#FFFFFF',
    outline_color: '#111111',
    outline_width: 2,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'classic_stoic',
    name: 'Stoïcien Vintage 📜',
    font: 'Bebas Neue',
    size: 50,
    color: '#F5EBE0',
    outline_color: '#2B1E16',
    outline_width: 3,
    position: 'bottom',
    karaoke: false,
    box_color: 'rgba(20,15,10,0.7)'
  },
  {
    id: 'mrbeast_bold',
    name: 'MrBeast Impact 💥',
    font: 'Liberation Sans',
    size: 52,
    color: '#FFFFFF',
    outline_color: '#000000',
    outline_width: 6,
    position: 'center',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'soft_pastel',
    name: 'Pastel Doux 🌸',
    font: 'Comfortaa',
    size: 40,
    color: '#FFD6EC',
    outline_color: '#5B2A4A',
    outline_width: 2,
    position: 'bottom',
    karaoke: true,
    box_color: 'rgba(40,15,35,0.5)'
  },
  {
    id: 'editorial_clean',
    name: 'Éditorial Minimal ✒️',
    font: 'Open Sans',
    size: 38,
    color: '#FFFFFF',
    outline_color: '#000000',
    outline_width: 1,
    position: 'bottom',
    karaoke: false,
    box_color: 'rgba(0,0,0,0.75)'
  },
  {
    id: 'lime_pop',
    name: 'Lime Pop 🍋',
    font: 'Inter',
    size: 46,
    color: '#CCFF00',
    outline_color: '#0a1a00',
    outline_width: 4,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'royal_purple',
    name: 'Violet Royal 👑',
    font: 'Cabin',
    size: 44,
    color: '#D8B4FE',
    outline_color: '#2E1065',
    outline_width: 3,
    position: 'top',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'true_crime',
    name: 'True Crime Rouge 🩸',
    font: 'Bebas Neue',
    size: 48,
    color: '#FF3B3B',
    outline_color: '#1a0000',
    outline_width: 4,
    position: 'bottom',
    karaoke: true,
    box_color: 'rgba(10,0,0,0.6)'
  },
  {
    id: 'comic_fun',
    name: 'Comique Ludique 🎈',
    font: 'Comic Neue',
    size: 46,
    color: '#FFA500',
    outline_color: '#3D1F00',
    outline_width: 4,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'news_lower_third',
    name: 'JT Bandeau 📰',
    font: 'Roboto',
    size: 36,
    color: '#FFFFFF',
    outline_color: '#000000',
    outline_width: 1,
    position: 'bottom',
    karaoke: false,
    box_color: 'rgba(180,0,0,0.85)'
  },
  {
    id: 'motivation_gold',
    name: 'Motivation Or ⭐',
    font: 'Inter',
    size: 48,
    color: '#FFC700',
    outline_color: '#3a2600',
    outline_width: 5,
    position: 'center',
    karaoke: true,
    box_color: 'transparent'
  },
  // Box/pill-background presets — text sits on a solid rounded rectangle
  // instead of relying on an outline for contrast (the "caption bubble" look).
  {
    id: 'white_pill',
    name: 'Bulle Blanche ⬜',
    font: 'Inter',
    size: 40,
    color: '#0A0A0A',
    outline_color: '#FFFFFF',
    outline_width: 0,
    position: 'bottom',
    karaoke: false,
    box_color: '#FFFFFF'
  },
  {
    id: 'black_pill',
    name: 'Bulle Noire ⬛',
    font: 'Inter',
    size: 40,
    color: '#FFFFFF',
    outline_color: '#000000',
    outline_width: 0,
    position: 'bottom',
    karaoke: true,
    box_color: '#000000'
  },
  {
    id: 'sunny_yellow_box',
    name: 'Boîte Jaune Soleil 🌞',
    font: 'Poppins',
    size: 42,
    color: '#1A1400',
    outline_color: '#1A1400',
    outline_width: 0,
    position: 'bottom',
    karaoke: true,
    box_color: '#FFD400'
  },
  {
    id: 'coral_box',
    name: 'Boîte Corail 🪸',
    font: 'Poppins',
    size: 40,
    color: '#FFFFFF',
    outline_color: '#7A1E00',
    outline_width: 0,
    position: 'bottom',
    karaoke: true,
    box_color: '#FF6B4A'
  },
  {
    id: 'mint_box',
    name: 'Boîte Menthe 🌿',
    font: 'Comfortaa',
    size: 38,
    color: '#043D2E',
    outline_color: '#043D2E',
    outline_width: 0,
    position: 'bottom',
    karaoke: false,
    box_color: '#8FF0C6'
  },
  {
    id: 'gold_box',
    name: 'Boîte Dorée 🏆',
    font: 'Inter',
    size: 42,
    color: '#231600',
    outline_color: '#231600',
    outline_width: 0,
    position: 'center',
    karaoke: true,
    box_color: '#F2C94C'
  },
  // More outline-only styles, extra font/color variety
  {
    id: 'ice_blue',
    name: 'Bleu Glacé ❄️',
    font: 'Poppins',
    size: 44,
    color: '#E0F7FF',
    outline_color: '#053B4D',
    outline_width: 3,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'forest_green',
    name: 'Vert Forêt 🌲',
    font: 'Cabin',
    size: 44,
    color: '#B7F0B1',
    outline_color: '#0C2B0A',
    outline_width: 3,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'hot_pink',
    name: 'Rose Vif 💗',
    font: 'Poppins',
    size: 44,
    color: '#FF3D9A',
    outline_color: '#3A001C',
    outline_width: 4,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'noir_serif',
    name: 'Noir Élégant 🎩',
    font: 'Georgia',
    size: 42,
    color: '#F5F5F5',
    outline_color: '#000000',
    outline_width: 2,
    position: 'bottom',
    karaoke: false,
    box_color: 'transparent'
  },
  {
    id: 'sunset_orange',
    name: 'Coucher de Soleil 🌅',
    font: 'Bebas Neue',
    size: 50,
    color: '#FF7A29',
    outline_color: '#4A1900',
    outline_width: 4,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'electric_blue',
    name: 'Bleu Électrique ⚡',
    font: 'Inter',
    size: 46,
    color: '#3DA9FF',
    outline_color: '#00142E',
    outline_width: 4,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  },
  {
    id: 'blood_moon',
    name: 'Lune de Sang 🌑',
    font: 'Bebas Neue',
    size: 48,
    color: '#E8E8E8',
    outline_color: '#5C0000',
    outline_width: 4,
    position: 'bottom',
    karaoke: true,
    box_color: 'transparent'
  }
];

// Fonts actually installed on the render server (see Dockerfile) — what you pick here
// is exactly what libass will use to burn the subtitles into the final video.
// A starting point only — the real list grows from what channels actually
// use (see fetchNicheOptions/GET /api/channels/niches), merged in at runtime.
const NICHE_OPTIONS = [
  "Philosophie", "Philosophie Stoïcienne", "Philosophie de Machiavel", "Philosophie de Napoleon Hill",
  "Stoïcisme", "Spiritualité", "Prière", "Méditation", "Bouddhisme", "Islam",
  "Mythologie", "Histoires Antiques", "Histoire Africaine", "Histoire Européenne", "Histoire",
  "Développement Personnel", "Motivation", "Récits Captivants", "Psychologie", "Finance", "Business",
  "Santé & Bien-être", "Football", "Sport", "Science", "Faits Divers", "True Crime", "Voyage", "Cuisine",
];

// Every family below is actually installed on the render server (see
// Dockerfile) — verified by downloading each Debian font package and
// reading its real name table, not guessed from the package name.
const SUBTITLE_FONTS = [
  { value: 'Roboto', label: 'Roboto', group: 'Sans-serif' },
  { value: 'Open Sans', label: 'Open Sans', group: 'Sans-serif' },
  { value: 'Lato', label: 'Lato', group: 'Sans-serif' },
  { value: 'Inter', label: 'Inter', group: 'Sans-serif' },
  { value: 'Liberation Sans', label: 'Liberation Sans', group: 'Sans-serif' },
  { value: 'DejaVu Sans', label: 'DejaVu Sans', group: 'Sans-serif' },
  { value: 'Noto Sans', label: 'Noto Sans', group: 'Sans-serif' },
  { value: 'Cabin', label: 'Cabin', group: 'Sans-serif' },
  { value: 'Karla', label: 'Karla', group: 'Sans-serif' },
  { value: 'Manrope', label: 'Manrope', group: 'Sans-serif' },
  { value: 'Sora', label: 'Sora', group: 'Sans-serif' },
  { value: 'Clear Sans', label: 'Clear Sans', group: 'Sans-serif' },
  { value: 'Carlito', label: 'Carlito', group: 'Sans-serif' },
  { value: 'Cantarell', label: 'Cantarell', group: 'Sans-serif' },
  { value: 'National Park', label: 'National Park', group: 'Sans-serif' },

  { value: 'Bebas Neue', label: 'Bebas Neue', group: 'Display / Impact' },
  { value: 'League Spartan', label: 'League Spartan', group: 'Display / Impact' },
  { value: 'Yanone Kaffeesatz', label: 'Yanone Kaffeesatz', group: 'Display / Impact' },
  { value: 'Play', label: 'Play', group: 'Display / Impact' },
  { value: 'Jura', label: 'Jura', group: 'Display / Impact' },
  { value: 'B612', label: 'B612', group: 'Display / Impact' },

  { value: 'Comfortaa', label: 'Comfortaa', group: 'Rond, doux' },
  { value: 'Quicksand', label: 'Quicksand', group: 'Rond, doux' },
  { value: 'Dosis', label: 'Dosis', group: 'Rond, doux' },

  { value: 'Comic Neue', label: 'Comic Neue', group: 'Ludique' },
  { value: 'Lobster Two', label: 'Lobster Two', group: 'Ludique' },
  { value: 'Kaushan Script', label: 'Kaushan Script', group: 'Ludique' },
  { value: 'Dancing Script', label: 'Dancing Script', group: 'Ludique' },
  { value: 'Leckerli One', label: 'Leckerli One', group: 'Ludique' },
  { value: 'Lemonada', label: 'Lemonada', group: 'Ludique' },
  { value: 'Cabin Sketch', label: 'Cabin Sketch', group: 'Ludique' },
  { value: 'Tuffy', label: 'Tuffy', group: 'Ludique' },

  { value: 'Vollkorn', label: 'Vollkorn', group: 'Éditorial / Serif' },
  { value: 'EB Garamond', label: 'EB Garamond', group: 'Éditorial / Serif' },
  { value: 'Cardo', label: 'Cardo', group: 'Éditorial / Serif' },
  { value: 'Quattrocento', label: 'Quattrocento', group: 'Éditorial / Serif' },
  { value: 'Caladea', label: 'Caladea', group: 'Éditorial / Serif' },
  { value: 'Liberation Serif', label: 'Liberation Serif', group: 'Éditorial / Serif' },
  { value: 'Linux Libertine O', label: 'Linux Libertine', group: 'Éditorial / Serif' },
  { value: 'Roboto Slab', label: 'Roboto Slab', group: 'Éditorial / Serif' },
  { value: 'Karmilla', label: 'Karmilla', group: 'Éditorial / Serif' },

  { value: 'Courier Prime', label: 'Courier Prime', group: 'Machine à écrire' },
];

// Available Voice Models
// Stable, bundled stock photos for the Effets step's preview when the client
// hasn't uploaded their own image library yet — previously that preview was
// just blank text ("importez un dossier") until they did, which made it
// impossible to actually see any effect before finishing the whole wizard.
const STABLE_EFFECT_PREVIEW_IMAGES = [
  '/assets/dashboard/freedom-sunrise.png',
  '/assets/dashboard/freedom-sleep.png',
  '/assets/backgrounds/nichecut-abstract-tech.webp',
];

const VOICE_MODELS = [
  { id: 'fr-FR-Thomas', name: 'Thomas — Voix Stoïque & Profonde', lang: 'fr-FR', desc: 'Idéal pour philosophie, citations et stoïcisme' },
  { id: 'fr-FR-Elodie', name: 'Élodie — Narrative Éléganter', lang: 'fr-FR', desc: 'Idéal pour récits historiques et contes' },
  { id: 'fr-FR-Nicolas', name: 'Nicolas — Voix Grave & Envoûtante', lang: 'fr-FR', desc: 'Idéal pour spiritualité et méditations guidées' },
  { id: 'fr-FR-Claire', name: 'Claire — Douce & Inspirante', lang: 'fr-FR', desc: 'Idéal pour développement personnel' }
];

// localStorage-backed "saved" / "cloned" voice bookmarks — the shared voice
// catalog and the clone endpoint don't tag these server-side, so the voice
// library modal tracks them client-side per browser, à la bibliothèque
// Easy Voice (onglets Bibliothèque / Clonées / Enregistrées / Par défaut).
const SAVED_VOICE_IDS_KEY = 'nichecut_saved_voice_ids';
const CLONED_VOICE_IDS_KEY = 'nichecut_cloned_voice_ids';
function readVoiceIdList(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function writeVoiceIdList(key, ids) {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* ignore quota/private mode */ }
}

// Full-object cache (name/preview_url/...) for every saved/cloned voice ever
// seen in this browser, keyed by id — the id lists above only remember
// *which* voices to badge as saved/cloned, not their metadata. Without this,
// a cloned voice that later scrolls out of the ~1000-entry catalog page (the
// shared Izivoice account can hold thousands of voices across every KappGen
// creator) silently vanishes from the "Mes voix clonées" tab on the very
// next catalog refetch, even though the channel using it keeps working fine
// (its voice_id is stored server-side, independent of this cache).
const VOICE_META_CACHE_KEY = 'nichecut_voice_meta_cache';
function readVoiceMetaCache() {
  try { return JSON.parse(localStorage.getItem(VOICE_META_CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeVoiceMetaCache(cache) {
  try { localStorage.setItem(VOICE_META_CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore quota/private mode */ }
}

// Visual sources a channel can enable — any combination now, tried in this
// fixed priority order at render time (AI first, then the channel's own
// library, then the niche's community library — see the identical
// resolve_enabled_image_sources in backend/src/pipeline/images.py, which
// this must stay in sync with). `sources` (a list) is the current shape on
// image_style; `source` (a single exclusive string) is the old one, read
// here for every channel saved before this existed.
const IMAGE_SOURCE_PRIORITY = ['ai_generated', 'library', 'community'];
function resolveEnabledImageSources(imageStyle) {
  if (!imageStyle) return ['library'];
  const sources = imageStyle.sources;
  if (Array.isArray(sources) && sources.length) {
    const enabled = IMAGE_SOURCE_PRIORITY.filter(s => sources.includes(s));
    if (enabled.length) return enabled;
  }
  const legacy = imageStyle.source || 'library';
  if (legacy === 'hybrid') return ['ai_generated', 'library'];
  if (IMAGE_SOURCE_PRIORITY.includes(legacy)) return [legacy];
  return ['library'];
}

// Raw Izivoice catalog items are passed through as-is by the backend, so
// their exact schema isn't fixed — this keeps the fields the picker actually
// filters/sorts on (language, gender, accent, usage) alongside the flattened
// `desc` line, and best-effort tags entries the account itself cloned.
function mapCatalogVoice(v) {
  let previewUrl = v.preview_url || v.languages?.find(item => item.preview_url)?.preview_url || null;
  if (previewUrl && previewUrl.startsWith('/')) {
    previewUrl = `${API_BASE}${previewUrl}`;
  }
  return {
    id: v.voice_id,
    name: v.name || v.voice_id,
    language: v.language || null,
    gender: v.gender || null,
    accent: v.accent || null,
    usage: v.usage_character_count_1y || v.usage_count || 0,
    desc: [v.language, v.gender, v.accent].filter(Boolean).join(' · ') || 'Voix Izivoice',
    preview_url: previewUrl,
  };
}

// A single, module-level "now playing" preview — starting a new preview
// anywhere in the app (library modal, studio picker, ...) stops whichever
// one was already playing, à la claimGlobalAudioPlayback() in Easy Voice.
let __voicePreviewAudio = null;
let __voicePreviewOnStop = null;
function playVoicePreviewExclusive(url, onStop) {
  if (__voicePreviewAudio) {
    __voicePreviewAudio.pause();
    __voicePreviewOnStop?.();
  }
  const audio = new Audio(url);
  __voicePreviewAudio = audio;
  __voicePreviewOnStop = onStop;
  audio.onended = () => {
    onStop();
    if (__voicePreviewAudio === audio) { __voicePreviewAudio = null; __voicePreviewOnStop = null; }
  };
  audio.play().catch(() => {});
  return audio;
}
function stopVoicePreview() {
  __voicePreviewAudio?.pause();
  __voicePreviewOnStop?.();
  __voicePreviewAudio = null;
  __voicePreviewOnStop = null;
}

function VoiceAvatar({ voice, size = 40, playable = false, playing = false, generating = false, onTogglePlay }) {
  const seed = voice?.id || voice?.name || 'voice';
  return (
    <div
      className={`group relative shrink-0 rounded-full overflow-hidden bg-[var(--bg-surface-alt)] ${playable ? 'cursor-pointer' : ''}`}
      style={{ width: size, height: size }}
      onClick={playable && !generating ? (e) => { e.stopPropagation(); onTogglePlay(); } : undefined}
      title={playable ? (generating ? 'Génération de l’aperçu…' : playing ? 'Mettre en pause' : 'Écouter un extrait') : undefined}
    >
      <img
        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1b2230,11151c`}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {playable && (
        <div className={`absolute inset-0 flex items-center justify-center bg-black/55 transition-opacity ${playing || generating ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <span className={`material-symbols-outlined text-white ${generating ? 'animate-spin' : ''}`} style={{ fontSize: Math.max(14, size * 0.4) }}>{generating ? 'progress_activity' : playing ? 'pause' : 'play_arrow'}</span>
        </div>
      )}
    </div>
  );
}

function VoiceCard({ voice, active, saved, mine, playingId, generatingPreviewId, onSelect, onToggleSave, onPlayPreview }) {
  const playing = playingId === voice.id;
  const generating = generatingPreviewId === voice.id;
  return (
    <div
      onClick={() => onSelect(voice)}
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
        active ? 'bg-[#00c2ff]/10 border-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] hover:border-slate-500'
      }`}
    >
      <VoiceAvatar
        voice={voice}
        size={32}
        playable={!!voice.preview_url || mine}
        playing={playing}
        generating={generating}
        onTogglePlay={() => onPlayPreview(mine ? { ...voice, cloned: true } : voice)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-white truncate">{voice.name}</span>
          {mine && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#00c2ff]/15 text-[#56d9ff]">Clonée</span>
          )}
        </div>
        <p className="text-[10px] text-slate-500 truncate">{voice.desc || 'Voix'}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleSave(voice); }}
        className="shrink-0 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
        title={saved ? 'Retirer des enregistrées' : 'Enregistrer cette voix'}
      >
        <span
          className={`material-symbols-outlined text-[15px] ${saved ? 'text-[#00c2ff]' : 'text-slate-400'}`}
          style={{ fontVariationSettings: saved ? "'FILL' 1" : "'FILL' 0" }}
        >bookmark</span>
      </button>
      {active && <span className="material-symbols-outlined text-[16px] text-[#00c2ff] shrink-0">check_circle</span>}
    </div>
  );
}

function VoiceLibrarySelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
          value ? 'bg-[#00c2ff]/10 border-[#00c2ff]/50 text-[#56d9ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'
        }`}
      >
        {value || label}
        <span className={`material-symbols-outlined text-[14px] transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 min-w-[160px] bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-50 overflow-hidden py-1 max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between gap-2 ${!value ? 'text-[#00c2ff] font-bold' : 'text-slate-300'}`}
          >
            {label} (tous)
            {!value && <span className="material-symbols-outlined text-[14px] shrink-0">check</span>}
          </button>
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between gap-2 ${value === opt ? 'text-[#00c2ff] font-bold' : 'text-slate-300'}`}
            >
              <span className="truncate">{opt}</span>
              {value === opt && <span className="material-symbols-outlined text-[14px] shrink-0">check</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VoiceLibraryModal({
  voices, selectedId, savedIds, clonedIds,
  searchQuery, onSearchChange, searching,
  onSelect, onToggleSave, onClose, onOpenCloner, cloningEnabled, onAddVoiceById,
  onLoadMore, loadingMore, hasMore
}) {
  const [tab, setTab] = useState('library');
  const [playingId, setPlayingId] = useState(null);
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterAccent, setFilterAccent] = useState('');
  const [sortBy, setSortBy] = useState('recommended');
  const scrollRef = useRef(null);
  const [addByIdOpen, setAddByIdOpen] = useState(false);
  const [addByIdValue, setAddByIdValue] = useState('');
  const [addByIdLoading, setAddByIdLoading] = useState(false);
  const [addByIdError, setAddByIdError] = useState('');

  const submitAddById = async () => {
    const id = addByIdValue.trim();
    if (!id) return;
    setAddByIdLoading(true);
    setAddByIdError('');
    try {
      await onAddVoiceById(id);
      setAddByIdValue('');
      setAddByIdOpen(false);
    } catch (e) {
      setAddByIdError(e.message);
    } finally {
      setAddByIdLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      stopVoicePreview();
    };
  }, []);

  // Infinite scroll — the catalog has 11 000+ voices; loading the next page
  // automatically as the list nears its bottom instead of behind a click
  // matches the "load more" UX everywhere else voices are browsed.
  const handleListScroll = () => {
    if (tab !== 'library' || searchQuery.trim() || !hasMore || loadingMore) return;
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) onLoadMore();
  };

  const [generatingPreviewId, setGeneratingPreviewId] = useState(null);

  const handlePlayPreview = async (voice) => {
    if (playingId === voice.id) {
      stopVoicePreview();
      setPlayingId(null);
      return;
    }
    let url = voice.preview_url;
    if (!url) {
      // Covers both a cloned voice with no sample yet (cloned before
      // on-demand generation existed, or whose best-effort generation right
      // after cloning failed) and a catalog voice whose entry came back
      // without one — generate it now instead of leaving the play button dead.
      setGeneratingPreviewId(voice.id);
      try {
        const res = await authFetch(`${API_BASE}/channels/voice/${voice.id}/preview/generate`, { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.detail || "Impossible de générer l'aperçu.");
        url = `${API_BASE}${body.preview_url}`;
      } catch (err) {
        showToast(err.message, 'error');
        setGeneratingPreviewId(null);
        return;
      }
      setGeneratingPreviewId(null);
    }
    if (!url) return;
    playVoicePreviewExclusive(url, () => setPlayingId(null));
    setPlayingId(voice.id);
  };

  const TABS = [
    { id: 'library', label: 'Bibliothèque' },
    { id: 'cloned', label: 'Mes voix clonées' },
    { id: 'saved', label: 'Enregistrées' },
  ];
  const baseList = tab === 'library' ? voices
    : tab === 'cloned' ? voices.filter(v => clonedIds.includes(v.id))
    : voices.filter(v => savedIds.includes(v.id));

  const { languages, genders, accents } = useMemo(() => {
    const langs = new Set(), gens = new Set(), accs = new Set();
    voices.forEach(v => {
      if (v.language) langs.add(v.language);
      if (v.gender) gens.add(v.gender);
      if (v.accent) accs.add(v.accent);
    });
    return { languages: [...langs].sort(), genders: [...gens].sort(), accents: [...accs].sort() };
  }, [voices]);

  const list = useMemo(() => {
    let arr = baseList;
    if (tab === 'library') {
      if (filterLanguage) arr = arr.filter(v => v.language === filterLanguage);
      if (filterGender) arr = arr.filter(v => v.gender === filterGender);
      if (filterAccent) arr = arr.filter(v => v.accent === filterAccent);
      if (sortBy === 'name_asc') arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
      else if (sortBy === 'popular') arr = [...arr].sort((a, b) => (b.usage || 0) - (a.usage || 0));
    }
    return arr;
  }, [baseList, tab, filterLanguage, filterGender, filterAccent, sortBy]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-4xl h-[85vh] bg-[var(--bg-input)] border border-[var(--border-soft)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
          <div>
            <h3 className="text-sm font-extrabold text-white">Sélectionner une voix</h3>
            <p className="text-[11px] text-slate-500">Choisis une voix dans la bibliothèque, tes voix clonées, ou tes favoris.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pt-3 flex-wrap">
          <div className="flex items-center gap-1 bg-[#0b0f16] border border-[var(--border-subtle)] rounded-xl p-1">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  tab === t.id ? 'bg-[#00c2ff]/15 text-[#56d9ff]' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {cloningEnabled ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAddByIdOpen(o => !o)}
                className="px-3 py-2 rounded-lg border border-[var(--border)] text-slate-300 hover:text-white hover:border-slate-500 text-[11px] font-bold flex items-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">tag</span>
                Ajouter par ID
              </button>
              <button
                type="button"
                onClick={onOpenCloner}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#65e0ff] to-[#1a9cff] text-[var(--bg-deep)] text-[11px] font-extrabold flex items-center gap-1.5 shadow-md shadow-[#00c2ff]/20 hover:brightness-110 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">fingerprint</span>
                Cloner ma voix
              </button>
            </div>
          ) : (
            <span className="shrink-0 text-[10px] text-slate-600">Clonage disponible après la création</span>
          )}
        </div>

        {addByIdOpen && (
          <div className="px-5 pt-3">
            <div className="bg-[#0b0f16] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-slate-400">Tu as déjà une voix clonée directement sur Izivoice ? Colle son identifiant (voice_id) pour l'utiliser ici sans la recloner.</p>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={addByIdValue}
                  onChange={e => setAddByIdValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitAddById(); }}
                  placeholder="Ex : 6f2b1a9e-..."
                  className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                />
                <button
                  type="button"
                  onClick={submitAddById}
                  disabled={!addByIdValue.trim() || addByIdLoading}
                  className="shrink-0 px-4 py-2 rounded-lg bg-[#00c2ff] text-slate-950 text-xs font-bold hover:bg-[#38d0ff] disabled:opacity-50 transition-all"
                >
                  {addByIdLoading ? 'Vérification…' : 'Ajouter'}
                </button>
              </div>
              {addByIdError && <p className="text-[11px] text-rose-400">{addByIdError}</p>}
            </div>
          </div>
        )}

        {tab === 'library' && (
          <div className="px-5 pt-3 space-y-2">
            <div className="relative">
              <span className="material-symbols-outlined text-[16px] text-slate-500 absolute left-3 top-1/2 -translate-y-1/2">search</span>
              <input
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Rechercher dans les 11 000+ voix (langue, accent, nom...)"
                className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg pl-9 pr-9 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
              />
              {searching && <span className="material-symbols-outlined text-[14px] text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 animate-spin">progress_activity</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <VoiceLibrarySelect label="Langue" value={filterLanguage} onChange={setFilterLanguage} options={languages} />
              <VoiceLibrarySelect label="Genre" value={filterGender} onChange={setFilterGender} options={genders} />
              <VoiceLibrarySelect label="Accent" value={filterAccent} onChange={setFilterAccent} options={accents} />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-[#00c2ff] outline-none ml-auto"
              >
                <option value="recommended">Tri : Recommandé</option>
                <option value="popular">Tri : Popularité</option>
                <option value="name_asc">Tri : Nom (A-Z)</option>
              </select>
              {(filterLanguage || filterGender || filterAccent) && (
                <button
                  type="button"
                  onClick={() => { setFilterLanguage(''); setFilterGender(''); setFilterAccent(''); }}
                  className="text-[10px] font-bold text-slate-500 hover:text-white"
                >
                  Réinitialiser
                </button>
              )}
              <span className="text-[10px] text-slate-500 shrink-0">{list.length} voix</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} onScroll={handleListScroll} className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-10">
              <span className="material-symbols-outlined text-[32px] text-slate-600">record_voice_over</span>
              <p className="text-xs text-slate-500">
                {tab === 'cloned' ? "Aucune voix clonée pour l'instant." : tab === 'saved' ? 'Aucune voix enregistrée.' : 'Aucune voix trouvée.'}
              </p>
            </div>
          ) : (
            <>
              {list.map(v => (
                <VoiceCard
                  key={v.id}
                  voice={v}
                  active={selectedId === v.id}
                  saved={savedIds.includes(v.id)}
                  mine={clonedIds.includes(v.id)}
                  playingId={playingId}
                  generatingPreviewId={generatingPreviewId}
                  onSelect={(voice) => { onSelect(voice); onClose(); }}
                  onToggleSave={onToggleSave}
                  onPlayPreview={handlePlayPreview}
                />
              ))}
              {tab === 'library' && !searchQuery.trim() && hasMore && loadingMore && (
                <div className="w-full py-3 flex items-center justify-center gap-1.5 text-slate-500 text-[11px]">
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  Chargement de plus de voix…
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// "hope-in-christ_daily.mp3" -> "Hope in christ daily" — just enough cleanup
// (extension stripped, separators turned into spaces, first letter capitalized)
// to make a usable default voice name, not a full title-case pass.
const nameFromFilename = (filename) => {
  const base = (filename || '').replace(/\.[^./]+$/, '').replace(/[-_]+/g, ' ').trim();
  return base ? base[0].toUpperCase() + base.slice(1) : '';
};

// Feature checklists mirror the marketing landing page's #tarifs section
// (LandingPage.jsx) — same plan names, same promise, so a creator never sees
// a different feature list depending on where they subscribe.
// Same feature rows on every tier (so cards compare line-by-line), each
// marked included:true/false per tier — progressively more checked from
// Starter (the fewest) to Pro (all of them). The credit amount itself isn't
// repeated here — it's already shown at the top of the card, right under
// the price, so listing it again as a feature line was pure duplication.
// { text, included } — included:false still shows the line grayed out with
// a red cross instead of a green check, since a check on an excluded
// feature reads as "you have this."
const PLAN_CHANNEL_COUNTS = { 'Starter': '1 chaîne', 'Creator': '2 chaînes', 'Standard': 'Jusqu’à 5 chaînes', 'Pro': 'Chaînes illimitées' };
const PLAN_VIDEO_DURATIONS = { 'Starter': 'Vidéos jusqu’à 10 min', 'Creator': 'Vidéos jusqu’à 25 min', 'Standard': 'Vidéos jusqu’à 1h', 'Pro': 'Durée de vidéo illimitée' };
// "Accès à ..." on purpose, not "Voix off incluse" — a checked line unlocks
// the feature (you're allowed to use it), it doesn't make it free/unlimited:
// every use still draws down the credit balance like any other generation.
const buildPlanFeatures = (planName, { transcription, aiImages, aiScript, autoPublish, prioritySupport }) => [
  { text: 'Accès à la voix off', included: true },
  { text: PLAN_CHANNEL_COUNTS[planName], included: true },
  { text: PLAN_VIDEO_DURATIONS[planName], included: true },
  { text: 'Accès à la transcription automatique', included: transcription },
  { text: 'Accès à la génération d’images IA', included: aiImages },
  { text: 'Accès au script automatique IA', included: aiScript },
  { text: 'Accès à la publication automatique YouTube', included: autoPublish },
  { text: 'Support prioritaire', included: prioritySupport },
];
const PLAN_DETAILS = {
  'Starter': { tagline: 'Pour tester la voix off sans engagement.', features: buildPlanFeatures('Starter', {
    transcription: false, aiImages: false, aiScript: false, autoPublish: false, prioritySupport: false,
  }) },
  'Creator': { tagline: 'Pour créer régulièrement sans y penser.', features: buildPlanFeatures('Creator', {
    transcription: true, aiImages: true, aiScript: true, autoPublish: false, prioritySupport: false,
  }) },
  'Standard': { tagline: 'Le meilleur rapport crédits / prix.', features: buildPlanFeatures('Standard', {
    transcription: true, aiImages: true, aiScript: true, autoPublish: true, prioritySupport: false,
  }), featured: true, badgeText: 'Le plus populaire' },
  'Pro': { tagline: 'Pour un usage intensif et plusieurs chaînes.', features: buildPlanFeatures('Pro', {
    transcription: true, aiImages: true, aiScript: true, autoPublish: true, prioritySupport: true,
  }) },
};

// Bottom-sheet pricing popup — opened from the sidebar's "Offres & Tarifs"
// icon (diamond) so a creator can check/upgrade plans from anywhere in the
// app without leaving to a full Paramètres page. Mounts closed and flips to
// open a tick later so the translate-y transition actually animates in,
// same trick as any slide-up sheet (can't transition from the initial
// render's own starting state).
function PricingModal({ onClose, plans, subscription, checkoutPlanId, onSelectPlan, loading }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => setEntered(true), 10);
    return () => { document.body.style.overflow = ''; clearTimeout(t); };
  }, []);
  const handleClose = () => {
    setEntered(false);
    setTimeout(onClose, 200);
  };
  const sortedPlans = [...plans].sort((a, b) => a.price_fcfa - b.price_fcfa);
  const currentPlanName = subscription?.active ? subscription.subscription.plan_name : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-4xl max-h-[85vh] overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-5 transition-transform duration-300 ease-out ${
          entered ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00c2ff]">diamond</span>
              Offres & Tarifs
            </h3>
            <p className="text-xs text-slate-400 mt-1">Génère plus de vidéos et débloque la génération d’images IA avec un abonnement actif.</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500">Chargement des offres...</p>
        ) : sortedPlans.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune offre disponible pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
            {sortedPlans.map(p => {
              const details = PLAN_DETAILS[p.name] || { tagline: '', features: [] };
              const isCurrent = currentPlanName === p.name;
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl p-5 space-y-4 border ${
                    details.featured
                      ? 'bg-gradient-to-b from-[#00c2ff]/10 to-[var(--bg-surface)] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10'
                      : 'bg-[var(--bg-surface-alt)] border-[var(--border-soft)]'
                  }`}
                >
                  {(details.featured || details.badgeText) && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap ${details.featured ? 'bg-gradient-to-r from-[#00c2ff] to-[#0088ff] text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
                      <span className="material-symbols-outlined text-[13px]">bolt</span> {details.badgeText || 'Recommandée'}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-extrabold text-white">{p.name}</div>
                    <p className="text-[11px] text-slate-400 mt-1 min-h-[28px]">{details.tagline}</p>
                  </div>
                  <div>
                    {p.original_price_fcfa && (
                      <div className="text-[11px] text-slate-500 line-through">{p.original_price_fcfa.toLocaleString()} FCFA</div>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-white">{p.price_fcfa.toLocaleString()}</span>
                      <span className="text-xs font-bold text-slate-400">FCFA</span>
                    </div>
                    {p.credits ? (
                      <div className="text-[11px] text-[#00c2ff] font-bold mt-0.5">{p.credits.toLocaleString()} crédits</div>
                    ) : null}
                    <div className="text-[11px] text-slate-500">{p.credits ? 'crédits à vie' : `/ ${p.duration_days} jours`}</div>
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {details.features.map(f => (
                      <li key={f.text} className={`flex items-start gap-1.5 text-[11px] ${f.included ? 'text-slate-300' : 'text-slate-500'}`}>
                        <span className={`material-symbols-outlined text-[14px] shrink-0 mt-0.5 ${f.included ? 'text-emerald-400' : 'text-red-400'}`}>{f.included ? 'check' : 'close'}</span>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div className="py-2 text-center bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 rounded-xl font-bold text-[11px]">
                      Offre actuelle
                    </div>
                  ) : (
                    <button
                      onClick={() => onSelectPlan(p)}
                      disabled={checkoutPlanId === p.id}
                      className={`py-2.5 rounded-xl font-bold text-[11px] disabled:opacity-50 ${details.featured ? 'bg-gradient-to-r from-[#00c2ff] to-[#0088ff] text-slate-950' : 'bg-[#00c2ff] text-slate-950'}`}
                    >
                      Recharger
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Payment-method picker shown after choosing a plan — one focused screen
// (plan summary + method list) instead of raw provider-name buttons, so a
// creator who's never heard of "Maketou" or "Tara Money" still recognizes
// "Mobile Money" / "Carte Bancaire" / "PayPal" as things they can actually
// pay with. Mobile Money settles through Maketou; Carte Bancaire and PayPal
// both settle through Tara Money — no method shown here that isn't actually
// wired to one of our two real processors.

function PaymentModal({ plan, onClose, onCheckout, checkingOut }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, []);
  const handleClose = () => { setEntered(false); setTimeout(onClose, 200); };
  if (!plan) return null;

  // Credits never expire — no "pay more for longer validity" choice any
  // more, every pack is a flat one-time price for a permanent balance.
  const isCreditPack = !!plan.credits;
  const displayPrice = plan.price_fcfa;

  const methods = [
    { id: 'mobile_money', provider: 'maketou', icon: 'smartphone', title: 'Mobile Money', subtitle: 'Orange, MTN, Moov, Wave...', badge: 'Populaire' },
    { id: 'card', provider: 'tarapay', icon: 'credit_card', title: 'Carte Bancaire', subtitle: 'Visa, Mastercard sécurisé' },
    { id: 'paypal', provider: 'tarapay', icon: 'account_balance_wallet', title: 'PayPal', subtitle: 'Paiement sécurisé via PayPal' },
  ];

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-md bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-t-3xl sm:rounded-3xl p-6 space-y-5 transition-transform duration-300 ease-out ${
          entered ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-white">Paiement</h3>
            <p className="text-xs text-slate-400 mt-1">Réglez votre <strong className="text-white">{plan.name}</strong> en toute sécurité.</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="bg-[#00c2ff]/10 border border-[#00c2ff]/30 rounded-2xl px-4 py-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wide text-[#56d9ff]">{plan.name}</div>
            {isCreditPack && <div className="text-[10px] text-slate-400 mt-0.5">{plan.credits.toLocaleString()} crédits</div>}
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold text-white">{displayPrice.toLocaleString()} FCFA</div>
            <div className="text-[10px] text-slate-400">{isCreditPack ? 'Crédits à vie' : `/ ${plan.duration_days} jours`}</div>
          </div>
        </div>


        <div className="space-y-2.5">
          {methods.map(m => (
            <button
              key={m.id}
              onClick={() => onCheckout(plan.id, m.provider, 'lifetime')}
              disabled={checkingOut}
              className="w-full flex items-center gap-3.5 p-3.5 bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-dropdown)] border border-[var(--border)] hover:border-[#00c2ff]/50 rounded-2xl transition-all text-left disabled:opacity-50 relative"
            >
              {m.badge && (
                <span className="absolute -top-2 right-3 text-[8px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gradient-to-r from-[#00c2ff] to-[#0088ff] text-slate-950">{m.badge}</span>
              )}
              <span className="w-10 h-10 rounded-xl bg-[#00c2ff]/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#00c2ff] text-[20px]">{m.icon}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white">{m.title}</div>
                <div className="text-[10px] text-slate-400 truncate">{m.subtitle}</div>
              </div>
              {checkingOut ? (
                <span className="material-symbols-outlined text-[16px] text-slate-500 animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[16px] text-slate-500">chevron_right</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <span className="material-symbols-outlined text-[13px]">lock</span>
          Paiement 100% sécurisé
        </div>
      </div>
    </div>
  );
}

function VoiceCloneModal({ onClose, onSubmit, submitting }) {
  const [name, setName] = useState('Ma voix');
  const [nameTouched, setNameTouched] = useState(false);
  const [file, setFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectFile = (f) => {
    setFile(f);
    if (!nameTouched) {
      const derived = nameFromFilename(f.name);
      if (derived) setName(derived);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; clearInterval(timerRef.current); };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setFile(new File([blob], 'enregistrement.webm', { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      alert("Impossible d'accéder au micro.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const canSubmit = file && name.trim() && !submitting;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[var(--bg-input)] border border-[var(--border-soft)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00c2ff] text-[18px]">fingerprint</span>
            Cloner une voix
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">Échantillon audio</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                  file && !recording ? 'border-[#00c2ff] bg-[#00c2ff]/5' : 'border-[var(--border)] hover:border-slate-500'
                }`}
              >
                <span className="material-symbols-outlined text-[22px] text-[#56d9ff]">upload_file</span>
                <span className="text-[11px] font-bold text-white">Importer un fichier</span>
                <span className="text-[10px] text-slate-500">MP3, WAV, M4A...</span>
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={e => e.target.files?.[0] && selectFile(e.target.files[0])} />

              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-4 text-center transition-colors ${
                  recording ? 'border-rose-500 bg-rose-500/10' : 'border-dashed border-[var(--border)] hover:border-slate-500'
                }`}
              >
                <span className={`material-symbols-outlined text-[22px] ${recording ? 'text-rose-400 animate-pulse' : 'text-[#56d9ff]'}`}>mic</span>
                <span className="text-[11px] font-bold text-white">{recording ? `Enregistrement… ${recordSeconds}s` : 'Enregistrer'}</span>
                <span className="text-[10px] text-slate-500">{recording ? 'Cliquer pour arrêter' : 'Depuis ton micro'}</span>
              </button>
            </div>
            {file && (
              <div className="mt-2">
                <AudioFilePreview file={file} onRemove={() => setFile(null)} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Nom de cette voix</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setNameTouched(true); }}
              placeholder="Ex : Ma voix"
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
            />
          </div>

        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-[var(--border-subtle)]">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-slate-300 text-xs font-bold hover:border-slate-500">
            Annuler
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(file, name.trim())}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#65e0ff] to-[#1a9cff] text-[var(--bg-deep)] font-extrabold text-xs disabled:opacity-40"
          >
            {submitting ? 'Clonage…' : 'Cloner la voix'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Dedicated setup flow for the "Vidéo Musicale" product — deliberately kept
// separate from the 9-step narration wizard above instead of threading a
// content_type branch through it: a music channel skips script/voiceover/
// subtitles entirely, so forking here is far less risky than conditionally
// disabling half of an already-huge stateful component. Mirrors that
// wizard's own look exactly (same card shell, step-pill header, per-step
// "N. Titre" heading, Retour/Suivant footer) so it doesn't feel like a
// bolted-on plain form next to Montage Simple.
const MUSIC_WIZARD_STEPS = ['Identité', 'Style & Musique', 'Montage', 'Publication'];

function MusicChannelWizard({ authFetch, showToast, onCreated, onBack }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    style_prompt: '',
    title_examples: '',
    edit_mode: 'loop', // 'loop' | 'compilation'
    image_count: 1, // 0-N — creator's choice, no fixed montage complexity
    target_duration_minutes: 10,
    automation_mode: 'manual', // 'manual' | 'auto'
    videos_per_day: 1,
  });
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [creating, setCreating] = useState(false);

  const generatePreview = async () => {
    if (!form.style_prompt.trim()) return showToast('Décris le style musical voulu.', 'error');
    setPreviewing(true);
    setPreviewUrl(null);
    try {
      const body = new FormData();
      body.append('style_prompt', form.style_prompt.trim());
      const res = await authFetch(`${API_BASE}/channels/music-video/preview`, { method: 'POST', body, timeoutMs: 60000 });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Aperçu impossible.");
      }
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const createChannel = async () => {
    if (!form.name.trim()) return showToast('Donne un nom à ta chaîne.', 'error');
    if (!form.style_prompt.trim()) return showToast('Décris le style musical voulu.', 'error');
    setCreating(true);
    try {
      const res = await authFetch(`${API_BASE}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          niche: 'Musique',
          content_type: 'music',
          automation_mode: form.automation_mode,
          videos_per_day: form.videos_per_day,
          music_channel_config: {
            style_prompt: form.style_prompt.trim(),
            title_examples: form.title_examples,
            edit_mode: form.edit_mode,
            image_count: form.image_count,
            target_duration_minutes: form.target_duration_minutes,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Création impossible.");
      }
      const channel = await res.json();
      showToast('Chaîne musicale créée.', 'success');
      onCreated(channel);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const goNext = () => {
    if (step === 1 && !form.name.trim()) return showToast('Donne un nom à ta chaîne.', 'error');
    if (step === 2 && !form.style_prompt.trim()) return showToast('Décris le style musical voulu.', 'error');
    setStep(s => Math.min(4, s + 1));
  };

  return (
    <div className="max-w-[1240px] mx-auto p-4 sm:p-8">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-4 sm:p-8 shadow-2xl space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] pb-4 sm:pb-6">
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-extrabold text-white flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#00c2ff] text-[20px]">library_music</span>
              Nouvelle Chaîne Musicale
            </h2>
            <p className="text-xs text-slate-400 mt-1">Étape {step} sur {MUSIC_WIZARD_STEPS.length} — pas de script, pas de voix off, le contenu c'est la musique elle-même.</p>
          </div>
          <button onClick={onBack} className="text-slate-400 hover:text-white p-2 shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Step pills */}
        <div className="flex sm:grid sm:grid-cols-4 gap-2 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
          {MUSIC_WIZARD_STEPS.map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = step === stepNum;
            const isPassed = step > stepNum;
            return (
              <button
                key={stepNum}
                onClick={() => setStep(stepNum)}
                className={`shrink-0 whitespace-nowrap py-2 px-3 sm:px-1 text-center rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-[#00c2ff] text-slate-950 shadow-md' :
                  isPassed ? 'bg-[#00c2ff]/20 text-[#00c2ff] border border-[#00c2ff]/40' :
                  'bg-[var(--bg-surface-alt)] text-slate-400'
                }`}
              >
                {stepNum}. {label}
              </button>
            );
          })}
        </div>

        {/* STEP 1: IDENTITÉ */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-base font-bold text-white">1. Identité de la Chaîne</h3>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Nom de la chaîne YouTube</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex : Lofi pour réviser"
                className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#00c2ff] outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 2: STYLE & MUSIQUE */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-base font-bold text-white">2. Style & Musique</h3>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Style musical</label>
              <textarea
                rows={3}
                value={form.style_prompt}
                onChange={e => setForm({ ...form, style_prompt: e.target.value })}
                placeholder="Ex : lofi hip-hop mélancolique, piano doux, boucle de pluie en fond, tempo lent — pour étudier ou dormir"
                className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-xs text-white focus:border-[#00c2ff] outline-none resize-none"
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={generatePreview}
                  disabled={previewing}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] text-xs font-bold text-white hover:border-[#00c2ff]/60 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-[15px] ${previewing ? 'animate-spin' : ''}`}>{previewing ? 'progress_activity' : 'music_note'}</span>
                  {previewing ? 'Génération...' : 'Écouter un aperçu (gratuit)'}
                </button>
                {previewUrl && <audio controls src={previewUrl} className="h-9" />}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Exemples de titres</label>
              <textarea
                rows={3}
                value={form.title_examples}
                onChange={e => setForm({ ...form, title_examples: e.target.value })}
                placeholder={"Un titre par ligne\nEx :\nLofi pour réviser toute la nuit\nPluie douce et piano pour dormir"}
                className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-xs text-white focus:border-[#00c2ff] outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* STEP 3: MONTAGE */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-base font-bold text-white">3. Montage</h3>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Comment remplir la durée</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, edit_mode: 'loop' })}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${form.edit_mode === 'loop' ? 'border-[#00c2ff] bg-[#00c2ff]/5' : 'border-[var(--border)] hover:border-slate-500'}`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">repeat</span> Boucle</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Une seule musique répétée jusqu'à la durée voulue.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, edit_mode: 'compilation' })}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${form.edit_mode === 'compilation' ? 'border-[#00c2ff] bg-[#00c2ff]/5' : 'border-[var(--border)] hover:border-slate-500'}`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">queue_music</span> Compilation</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Plusieurs musiques enchaînées pour les vidéos longues.</div>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 px-1">
                {form.edit_mode === 'loop'
                  ? "Une piste générée sera répétée en boucle jusqu'à atteindre la durée cible."
                  : "Plusieurs pistes seront générées et enchaînées pour atteindre la durée cible."}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Images illustratives</label>
              <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5">
                <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">image</span>
                <span className="text-[11px] text-slate-400 flex-1">Nombre d'images (0 = aucune, juste le spectre audio)</span>
                {[0, 1, 2, 3].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, image_count: n })}
                    className={`w-7 h-7 rounded-lg text-xs font-bold border transition-colors ${form.image_count === n ? 'bg-[#00c2ff] text-slate-950 border-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] text-slate-300 border-[var(--border)] hover:border-slate-500'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Durée cible</label>
              <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5">
                <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">schedule</span>
                <span className="text-[11px] text-slate-400 flex-1">Minutes</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={form.target_duration_minutes}
                  onChange={e => setForm({ ...form, target_duration_minutes: Math.max(1, Math.min(180, parseInt(e.target.value) || 1)) })}
                  className="w-16 text-center bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg py-1 text-xs font-bold text-white focus:border-[#00c2ff] outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: PUBLICATION */}
        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-base font-bold text-white">4. Publication</h3>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Mode de production</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, automation_mode: 'manual' })}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${form.automation_mode === 'manual' ? 'border-[#00c2ff] bg-[#00c2ff]/5' : 'border-[var(--border)] hover:border-slate-500'}`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">touch_app</span> Manuel</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Tu déclenches chaque vidéo toi-même.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, automation_mode: 'auto' })}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${form.automation_mode === 'auto' ? 'border-[#00c2ff] bg-[#00c2ff]/5' : 'border-[var(--border)] hover:border-slate-500'}`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">auto_awesome</span> Automatique</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">L'IA génère seule, chaque jour.</div>
                </button>
              </div>
              <p className="text-[10px] text-amber-400/80 mt-2 px-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">construction</span>
                La génération automatique de vidéos musicales arrive bientôt — configure ta chaîne dès maintenant, la production démarrera dès que ce sera prêt.
              </p>
            </div>
          </div>
        )}

        {/* Footer navigation */}
        <div className="flex flex-wrap justify-between items-center gap-3 pt-6 border-t border-[var(--border-soft)]">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-2.5 rounded-xl bg-[var(--bg-surface-alt)] text-white font-bold text-xs hover:bg-[var(--border-soft)] transition-colors"
            >
              Retour
            </button>
          ) : <div></div>}

          {step < MUSIC_WIZARD_STEPS.length ? (
            <button
              onClick={goNext}
              className="px-6 py-2.5 rounded-xl bg-[#00c2ff] text-slate-950 font-bold text-xs hover:bg-[#38d0ff] transition-all flex items-center gap-2 shadow-md"
            >
              Suivant
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={createChannel}
              disabled={creating}
              className="px-8 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              {creating ? 'Création...' : 'Créer la chaîne musicale'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Custom video player styled to match the app's dark/cyan design, replacing native browser controls.
function VideoPlayer({ src, autoPlay, className, onTimeUpdate, seekTo, onPlayingChange }) {
  const videoRef = useRef(null);
  // Always starts false, even with autoPlay — the browser can silently block
  // autoplay, and onPlay (below) is what actually confirms playback started.
  // Assuming success here left the icon stuck on "pause" while nothing played.
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    // isPlaying is driven by the video's own onPlay/onPause events below, not
    // set here — setting it manually after a play() that silently fails (e.g.
    // interrupted by another call, or fired before the src is actually ready)
    // left the button showing "pause" while nothing was actually playing, and
    // every click after that re-entered the same paused branch and failed again.
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  const seekToTime = (nextTime) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const bounded = Math.min(duration, Math.max(0, Number(nextTime) || 0));
    v.currentTime = bounded;
    setCurrentTime(bounded);
    setProgress((bounded / duration) * 100);
  };

  const skip = (seconds) => (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(duration || Infinity, Math.max(0, v.currentTime + seconds));
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const toggleFullscreen = (e) => {
    e.stopPropagation();
    videoRef.current?.requestFullscreen?.();
  };

  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // External seek requests (e.g. clicking a scene in a timeline) — only acts
  // when seekTo actually changes, so it doesn't fight the user's own scrubbing.
  useEffect(() => {
    if (seekTo == null) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Number(seekTo) || 0);
    setCurrentTime(v.currentTime);
    if (duration) setProgress((v.currentTime / duration) * 100);
  }, [seekTo]);

  useEffect(() => { onPlayingChange?.(isPlaying); }, [isPlaying]);

  return (
    <div className={`relative bg-black ${className || ''}`} onClick={(e) => e.stopPropagation()}>
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        onClick={togglePlay}
        onTimeUpdate={(e) => { setCurrentTime(e.target.currentTime); setProgress(e.target.duration ? (e.target.currentTime / e.target.duration) * 100 : 0); onTimeUpdate?.(e.target.currentTime); }}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Custom controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pt-8 pb-2 pointer-events-none">
        <div className="pointer-events-auto">
          <div className="relative w-full h-5 mb-1 group/seek flex items-center">
            <div className="absolute inset-x-0 h-1.5 bg-white/20 rounded-full overflow-hidden pointer-events-none">
              <div className="h-full bg-[#00c2ff] rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <div className="absolute w-3 h-3 rounded-full bg-[#00c2ff] shadow-[0_0_8px_rgba(0,194,255,.65)] pointer-events-none opacity-0 group-hover/seek:opacity-100 transition-opacity" style={{ left: `calc(${progress}% - 6px)` }} />
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onClick={(e) => e.stopPropagation()}
              onInput={(e) => seekToTime(e.currentTarget.value)}
              onChange={(e) => seekToTime(e.currentTarget.value)}
              aria-label="Position dans la vidéo"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button onClick={skip(-10)} title="Reculer de 10s" className="text-white hover:text-[#00c2ff] transition-colors">
                <span className="material-symbols-outlined text-[20px]">replay_10</span>
              </button>
              <button onClick={togglePlay} className="text-white hover:text-[#00c2ff] transition-colors">
                <span className="material-symbols-outlined text-[22px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
              </button>
              <button onClick={skip(10)} title="Avancer de 10s" className="text-white hover:text-[#00c2ff] transition-colors">
                <span className="material-symbols-outlined text-[20px]">forward_10</span>
              </button>
              <span className="text-[10px] font-mono text-white/80">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button onClick={toggleMute} className="text-white hover:text-[#00c2ff] transition-colors">
                <span className="material-symbols-outlined text-[18px]">{isMuted ? 'volume_off' : 'volume_up'}</span>
              </button>
              <button onClick={toggleFullscreen} className="text-white hover:text-[#00c2ff] transition-colors">
                <span className="material-symbols-outlined text-[18px]">fullscreen</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const formatMediaTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

const subtitlePositionClass = (position) => {
  const normalized = String(position || 'bottom').toLowerCase();
  if (normalized === 'top') return 'top-[12%]';
  if (normalized === 'center') return 'top-1/2 -translate-y-1/2';
  return 'bottom-[12%]';
};

const applySubtitleCase = (text, caseMode) => {
  if (caseMode === 'upper') return text.toUpperCase();
  if (caseMode === 'lower') return text.toLowerCase();
  return text;
};

const subtitleAlignClass = (align) => {
  const normalized = String(align || 'center').toLowerCase();
  if (normalized === 'left') return 'justify-start';
  if (normalized === 'right') return 'justify-end';
  return 'justify-center';
};

// Custom swatch + popover color picker, styled to match the app instead of
// the browser's native <input type="color"> dialog. Still delegates to a
// hidden native input for full-spectrum picking ("Autre couleur..."), but
// the everyday path is a hex field plus a curated preset row.
const COLOR_PICKER_PRESETS = [
  '#FFFFFF', '#000000', '#FFD700', '#00FFFF', '#FF3D9A', '#FF3B3B',
  '#3DA9FF', '#8FF0C6', '#CCFF00', '#F2C94C', '#D8B4FE', '#FF7A29'
];

function ColorPickerButton({ value, onChange, label, allowNone = false }) {
  const [open, setOpen] = useState(false);
  const isNone = allowNone && (!value || value === 'transparent');
  const [hexDraft, setHexDraft] = useState(isNone ? '' : (value || '#FFFFFF'));
  const wrapRef = useRef(null);

  useEffect(() => { setHexDraft(isNone ? '' : (value || '#FFFFFF')); }, [value, isNone]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const commitHex = (hex) => {
    setHexDraft(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex);
  };

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[#00c2ff] rounded-xl px-2.5 py-2 transition-colors"
      >
        <span
          className="w-6 h-6 rounded-lg border border-white/20 flex-shrink-0"
          style={isNone ? { backgroundImage: 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)' } : { backgroundColor: value || '#FFFFFF' }}
        />
        <span className="text-xs font-mono text-slate-300">{isNone ? 'Aucune' : (value || '#FFFFFF').toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 mt-2 w-56 bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl p-3 space-y-3">
          {label && <div className="text-[11px] font-bold text-slate-300">{label}</div>}
          <div className="grid grid-cols-6 gap-2">
            {COLOR_PICKER_PRESETS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { commitHex(c); onChange(c); }}
                className={`w-full aspect-square rounded-lg border-2 transition-transform hover:scale-110 ${!isNone && value?.toUpperCase() === c ? 'border-[#00c2ff]' : 'border-white/15'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg border border-white/20 flex-shrink-0" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(hexDraft) ? hexDraft : 'transparent' }} />
            <input
              value={hexDraft}
              onChange={e => commitHex(e.target.value)}
              placeholder="#RRGGBB"
              className="flex-1 min-w-0 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:border-[#00c2ff] outline-none"
            />
          </div>
          {allowNone && (
            <button
              type="button"
              onClick={() => { onChange('transparent'); setOpen(false); }}
              className={`w-full text-center text-[11px] font-bold py-1.5 rounded-lg transition-colors ${isNone ? 'bg-[#00c2ff]/10 text-[#00c2ff]' : 'text-slate-400 hover:text-white'}`}
            >
              Aucune couleur
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AudioFilePreview({ file, onRemove, volume }) {
  const audioRef = useRef(null);
  const [src, setSrc] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    // HTML5 audio.volume is linear, but human hearing perceives loudness roughly
    // logarithmically — a cubic taper makes the low end of the slider (where this
    // ambient/ducked music mostly lives) actually sound as quiet as the % implies.
    if (audioRef.current && typeof volume === 'number') audioRef.current.volume = Math.pow(Math.max(0, Math.min(1, volume)), 3);
  }, [volume, src]);

  const togglePlayback = async (event) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !src) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch {
      // play() was interrupted (e.g. src not ready yet or a pause() raced it) — ignore, UI reflects actual state via onPlay/onPause.
    }
  };

  const seek = (event) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Number(event.target.value);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-input)] p-3" onClick={(event) => event.stopPropagation()}>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={togglePlayback} disabled={!src} className="w-9 h-9 shrink-0 rounded-full bg-[#00c2ff] text-slate-950 flex items-center justify-center hover:bg-[#39d0ff] disabled:opacity-40 disabled:cursor-not-allowed">
          <span className="material-symbols-outlined text-[22px]">{playing ? 'pause' : 'play_arrow'}</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-white truncate mb-2">{file.name}</div>
          <input type="range" min="0" max={duration || 0} step="0.01" value={Math.min(currentTime, duration || 0)} onChange={seek} className="w-full h-1 accent-[#00c2ff] cursor-pointer" />
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
            <span>{formatMediaTime(currentTime)}</span><span>{formatMediaTime(duration)}</span>
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onRemove(); }}
            title="Retirer ce fichier"
            className="shrink-0 w-7 h-7 rounded-full bg-[var(--bg-surface-alt)] hover:bg-rose-950 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Same playback UI as AudioFilePreview, but for a track that's already on the
// server (a URL, not a local File) — used for already-uploaded music tracks
// and for a just-generated AI music preview.
function ServerAudioPreview({ src, name, volume, onRemove }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // HTML5 audio.volume is linear, but human hearing perceives loudness roughly
    // logarithmically — a cubic taper makes the low end of the slider (where this
    // ambient/ducked music mostly lives) actually sound as quiet as the % implies.
    if (audioRef.current && typeof volume === 'number') audioRef.current.volume = Math.pow(Math.max(0, Math.min(1, volume)), 3);
  }, [volume, src]);

  const togglePlayback = async (event) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !src) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch {
      // play() was interrupted (e.g. src not ready yet or a pause() raced it) — ignore, UI reflects actual state via onPlay/onPause.
    }
  };

  const seek = (event) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Number(event.target.value);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-input)] p-3" onClick={(event) => event.stopPropagation()}>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={togglePlayback} disabled={!src} className="w-9 h-9 shrink-0 rounded-full bg-[#00c2ff] text-slate-950 flex items-center justify-center hover:bg-[#39d0ff] disabled:opacity-40 disabled:cursor-not-allowed">
          <span className="material-symbols-outlined text-[22px]">{playing ? 'pause' : 'play_arrow'}</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-white truncate mb-2">{name}</div>
          <input type="range" min="0" max={duration || 0} step="0.01" value={Math.min(currentTime, duration || 0)} onChange={seek} className="w-full h-1 accent-[#00c2ff] cursor-pointer" />
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
            <span>{formatMediaTime(currentTime)}</span><span>{formatMediaTime(duration)}</span>
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onRemove(); }}
            title="Retirer ce fichier"
            className="shrink-0 w-7 h-7 rounded-full bg-[var(--bg-surface-alt)] hover:bg-rose-950 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Renders a channel's logo as a rounded-square avatar, or the KappGen icon
// if no logo is set. Falls back to the KappGen icon automatically if the
// image URL 404s (e.g. a logo file lost before persistent storage was fixed)
// instead of showing a broken-image icon with overflowing alt text.
// The real render burns subtitles onto a 1920x1080 frame with libass, where
// `size` is a literal pixel font size on that canvas (PlayResX=1920 in the
// .ass header). A preview box on screen is never 1920px wide, so matching it
// visually means scaling every subtitle metric (font size, outline width) by
// the box's actual measured width ÷ 1920 — not a flat guessed multiplier,
// which drifts from the real render the moment the box's width changes.
function useSubtitlePreviewScale() {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.25);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.offsetWidth / 1920);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, scale];
}

// Remembers a local folder handle (File System Access API — Chrome/Edge only)
// per channel, in IndexedDB, so "Rafraîchir" can re-read the same folder with
// a single permission click instead of re-opening the OS file picker.
// Browsers deliberately don't let a site auto-watch or silently re-read a
// local folder without the user re-confirming access, so this is the closest
// a website can get to "one-click refresh".
const FOLDER_HANDLE_DB = "nichecut_folder_handles";
function openHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FOLDER_HANDLE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveFolderHandle(channelKey, handle) {
  try {
    const db = await openHandleDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, channelKey);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* best-effort — refresh button just won't appear */ }
}
async function getFolderHandle(channelKey) {
  try {
    const db = await openHandleDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get(channelKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
// Matches backend/src/config.py's IMAGE_UPLOAD_EXTENSIONS — kept as the
// ONLY filter for a folder/drop selection. It used to be OR'd with a
// `file.type.startsWith('image/')` MIME check, which is far too permissive:
// the browser reports plenty of formats we don't actually accept (or even
// derivative/sidecar files from a Photos.app export) as an "image/*" MIME
// type, so a folder the creator was sure held under 50 real photos was
// getting "227 images sélectionnées" — inflated by files this extension
// list would have correctly excluded, some of which then failed partway
// through upload as a confusing "erreur réseau".
const LOCAL_IMAGE_EXTENSIONS_RE = /\.(jpg|jpeg|jfif|jpe|png|webp|gif|avif|bmp|tif|tiff|heic|heif)$/i;

async function readImagesFromDirHandle(dirHandle) {
  const files = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file" && LOCAL_IMAGE_EXTENSIONS_RE.test(entry.name)) {
      const file = await entry.getFile();
      files.push(file);
    }
  }
  return files;
}

function YouTubeIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 28 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M27.4 3.12A3.45 3.45 0 0 0 25 .71C22.82 0 14 0 14 0S5.18 0 3 .71A3.45 3.45 0 0 0 .6 3.12 36.1 36.1 0 0 0 0 10a36.1 36.1 0 0 0 .6 6.88 3.45 3.45 0 0 0 2.4 2.41C5.18 20 14 20 14 20s8.82 0 11-.71a3.45 3.45 0 0 0 2.4-2.41A36.1 36.1 0 0 0 28 10a36.1 36.1 0 0 0-.6-6.88Z" fill="#FF0000"/>
      <path d="M11.2 14.29 18.48 10 11.2 5.71v8.58Z" fill="#fff"/>
    </svg>
  );
}

// A YouTube-Studio-style dropdown for a small set of named modes (icon +
// label + one-line description each) — closed state shows just the current
// choice, open state lists every option. Used for "Génération du script" and
// "Publication YouTube" instead of a row of always-expanded cards.
function ModeDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value) || options[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-slate-500 transition-colors text-left"
      >
        <span className="w-8 h-8 rounded-lg bg-[#00c2ff]/10 text-[#00c2ff] flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[17px]">{current.icon}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-white">{current.label}</span>
          <span className="block text-[10px] text-slate-400 truncate">{current.desc}</span>
        </span>
        <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-30 py-1.5 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${opt.value === value ? 'bg-[#00c2ff]/15 text-[#00c2ff]' : 'bg-white/5 text-slate-400'}`}>
                <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs font-bold ${opt.value === value ? 'text-[#00c2ff]' : 'text-white'}`}>{opt.label}</span>
                <span className="block text-[10px] text-slate-400">{opt.desc}</span>
              </span>
              {opt.value === value && <span className="material-symbols-outlined text-[15px] text-[#00c2ff] shrink-0">check</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact hour-of-day picker ("07h00") — replaces the native <select> whose
// unstyled browser popup (system font, no rounding, overflowing the card)
// broke the rest of the app's design language.
// Shared by HourDropdown/MinuteDropdown — lets someone type the exact number
// directly (e.g. typing "14" then Enter) instead of only scrolling a 24- or
// 60-row list, same idea as the searchable language picker elsewhere.
// A logo is usually meant to be seen whole (square-ish, rarely cropped), but
// an overlay sticker or the logo itself might be cut from a circular/rounded
// design with a plain background outside it — this lets the creator clip the
// image into that shape instead of always showing its full raw rectangle,
// both here in the live preview and in the actual rendered video.
function ShapePicker({ value, onChange }) {
  const shapes = [
    { id: 'rectangle', label: 'Rectangle', radius: '3px' },
    { id: 'rounded', label: 'Coins arrondis', radius: '35%' },
    { id: 'circle', label: 'Cercle', radius: '50%' },
  ];
  return (
    <div className="flex items-center gap-1 flex-shrink-0" title="Forme">
      {shapes.map(s => (
        <button
          key={s.id}
          type="button"
          title={s.label}
          onClick={() => onChange(s.id)}
          className={`w-6 h-6 flex items-center justify-center rounded-md border transition-colors ${
            (value || 'rectangle') === s.id
              ? 'bg-[#00c2ff]/10 border-[#00c2ff]'
              : 'bg-[var(--bg-input)] border-[var(--border)] hover:border-slate-500'
          }`}
        >
          <span className={`w-2.5 h-2.5 ${(value || 'rectangle') === s.id ? 'bg-[#00c2ff]' : 'bg-slate-500'}`} style={{ borderRadius: s.radius }} />
        </button>
      ))}
    </div>
  );
}

// Compact labeled slider used for the size/x/y controls on the logo and each
// overlay — three of these side by side instead of one long unlabeled bar,
// so it's clear which knob moves what.
function MiniSlider({ label, value, min, max, onChange }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-[9px] font-mono text-slate-400">{Math.round(value)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#00c2ff]"
      />
    </div>
  );
}

function NumberDropdown({ value, onChange, max, suffix, width }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setDraft('');
    inputRef.current?.focus();
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const commitDraft = () => {
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n) && n >= 0 && n <= max) { onChange(n); setOpen(false); }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-slate-500 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors"
      >
        {String(value).padStart(2, '0')}{suffix}
        <span className={`material-symbols-outlined text-[14px] text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div className={`absolute left-0 top-full mt-1.5 ${width} max-h-64 overflow-hidden flex flex-col bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-50`}>
          <input
            ref={inputRef}
            type="number"
            min={0}
            max={max}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitDraft(); }}
            placeholder={`0-${max}`}
            className="w-full px-3 py-1.5 text-[11px] font-bold text-white bg-[var(--bg-input)] border-b border-[var(--border-dropdown)] outline-none focus:border-[#00c2ff]"
          />
          <div className="overflow-y-auto py-1">
            {Array.from({ length: max + 1 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => { onChange(n); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center justify-between gap-2 ${
                  n === value ? 'text-[#00c2ff] font-bold bg-[#00c2ff]/10' : 'text-slate-300 hover:bg-[var(--bg-hover)]'
                }`}
              >
                {String(n).padStart(2, '0')}{suffix}
                {n === value && <span className="material-symbols-outlined text-[13px] shrink-0">check</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HourDropdown({ value, onChange }) {
  return <NumberDropdown value={value} onChange={onChange} max={23} suffix="h00" width="w-24" />;
}

function MinuteDropdown({ value, onChange }) {
  return <NumberDropdown value={value} onChange={onChange} max={59} suffix=" min" width="w-20" />;
}

// One HH/MM/SS digit-group of ScriptTimeInput below. Keeps its own draft so
// typing or deleting in one group can only ever change that group's two
// digits — it never touches, and can never blank out, the other groups or
// the field as a whole. Losing focus with an empty/invalid draft snaps back
// to the last committed value instead of leaving the box empty.
function TimeSegmentInput({ value, max, onChange, onAdvance, fieldRef }) {
  const [draft, setDraft] = useState(String(value).padStart(2, '0'));
  useEffect(() => { setDraft(String(value).padStart(2, '0')); }, [value]);

  const commitValue = (raw) => {
    const n = parseInt(raw, 10);
    const clamped = Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : value;
    setDraft(String(clamped).padStart(2, '0'));
    if (clamped !== value) onChange(clamped);
    return clamped;
  };

  return (
    <input
      ref={fieldRef}
      type="text"
      inputMode="numeric"
      maxLength={2}
      value={draft}
      onFocus={e => e.target.select()}
      onChange={e => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
        if (digits.length === 2) {
          // Commit with the just-typed digits directly instead of leaving it
          // to onBlur: onAdvance() below moves focus to the next segment,
          // which fires blur on this input in the same tick — before React
          // has re-rendered with the new draft — so a blur-driven commit()
          // would still be reading the previous, stale draft value.
          commitValue(digits);
          onAdvance?.();
        } else {
          setDraft(digits);
        }
      }}
      onBlur={e => commitValue(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className="w-5 bg-transparent text-center text-[11px] font-bold text-white outline-none border-0 ring-0 focus:ring-0 focus:outline-none appearance-none p-0"
    />
  );
}

// HH:MM:SS field, styled to match the rest of the app instead of the
// browser's native <input type="time"> popup (unstyled, light-background on
// most browsers, clashing with the dark UI). The ":" separators are plain
// text, not part of any input, so they can never be typed over or deleted —
// only the digit-groups around them are editable (see TimeSegmentInput).
function ScriptTimeInput({ hour, minute, second, onChange }) {
  const minuteRef = useRef(null);
  const secondRef = useRef(null);
  return (
    <div className="flex items-center gap-0.5 bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-slate-500 focus-within:border-[#00c2ff] rounded-lg px-2 py-1.5">
      <TimeSegmentInput value={hour} max={23} onChange={h => onChange(h, minute, second)} onAdvance={() => minuteRef.current?.focus()} />
      <span className="text-slate-500 text-[11px] font-bold">:</span>
      <TimeSegmentInput fieldRef={minuteRef} value={minute} max={59} onChange={m => onChange(hour, m, second)} onAdvance={() => secondRef.current?.focus()} />
      <span className="text-slate-500 text-[11px] font-bold">:</span>
      <TimeSegmentInput fieldRef={secondRef} value={second} max={59} onChange={s => onChange(hour, minute, s)} />
    </div>
  );
}

// Ordered pipeline steps shown to the creator while a video renders (and, for
// auto-published channels, while it's uploaded to YouTube afterwards) — turns
// the raw progress_stage string from the backend into a visual "what's
// happening right now" strip instead of just a percentage bar.
// Matches the real order in backend/src/pipeline/orchestrator.py's progress()
// calls: voiceover/transcription always runs first (from the script if typed,
// or straight from an uploaded audio file — either way it's the audio step,
// there's no separate "writing the script" stage in the render itself, that
// already happened before the video was queued), *then* the already-written
// script gets cut into scene-length segments, then visuals, subtitles, scene
// animation, the voice/music mix, and the final assembly. The scene-cutting
// step used to be labeled "Script" here, which read as "the script gets
// written after the audio" — backwards, and confusing, even though the real
// order was always correct (the script exists before rendering starts at
// all). Relabeled "Scènes" since that's what this step actually does.
// The first two steps only apply to auto-generated videos (channel
// automation writes its own topic + script before the video even exists
// yet) — a manually-typed script or an uploaded audio file skips straight
// to "Audio" since there's nothing for these two to show. See
// generate_and_queue_auto_video in backend/src/worker/queue_runner.py,
// which now creates the video row at "Recherche du sujet" instead of only
// once the script is already fully written.
const PIPELINE_STEPS = [
  { match: /recherche du sujet/i, floor: 0, label: 'Sujet', icon: 'travel_explore' },
  { match: /rédaction du script/i, floor: 5, label: 'Script', icon: 'edit_note' },
  { match: /transcription|voix|reprise/i, floor: 25, label: 'Audio', icon: 'graphic_eq' },
  { match: /découpage|scènes en/i, floor: 40, label: 'Scènes', icon: 'auto_stories' },
  { match: /préparation des visuels/i, floor: 48, label: 'Visuels', icon: 'image' },
  { match: /sous-titres|animation|mixage|montage final/i, floor: 60, label: 'Montage', icon: 'movie' },
  { match: /assemblage|youtube|miniature|publication/i, floor: 90, label: 'Finalisation', icon: 'movie_edit' },
];

function getActivePipelineStepIndex(stage, percent) {
  const stageText = stage || '';
  const byStage = PIPELINE_STEPS.findIndex(s => s.match.test(stageText));
  if (byStage !== -1) return byStage;
  // Fallback purely on percent for stages whose exact wording changes.
  let idx = 0;
  PIPELINE_STEPS.forEach((s, i) => { if ((percent || 0) >= s.floor) idx = i; });
  return idx;
}

function PipelineStepper({ stage, percent, failed = false }) {
  const activeIndex = getActivePipelineStepIndex(stage, percent);
  return (
    <div className="grid grid-cols-7 items-start w-full">
      {PIPELINE_STEPS.map((step, i) => {
        const state = failed && i === activeIndex ? 'failed' : i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
        return (
          <div key={step.label} className="relative flex flex-col items-center gap-1.5" title={step.label}>
            {i > 0 && <div className={`absolute right-1/2 top-3 h-px w-full ${i <= activeIndex ? 'bg-[#00c2ff]/45' : 'bg-slate-800'}`} />}
            <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all border ${
              state === 'done' ? 'bg-[#0b2b2b] text-emerald-400 border-emerald-500/25' :
              state === 'active' ? 'bg-[#062d40] text-[#4ed9ff] border-[#00c2ff]/70 shadow-[0_0_14px_rgba(0,194,255,.25)]' :
              state === 'failed' ? 'bg-rose-500/20 text-rose-400' :
              'bg-[#111a27] text-slate-600 border-slate-800'
            }`}>
              {state === 'done' ? (
                <span className="material-symbols-outlined text-[12px]">check</span>
              ) : step.icon === 'youtube' ? (
                <YouTubeIcon className="w-2.5 h-2" />
              ) : (
                <span className={`material-symbols-outlined text-[12px] ${state === 'active' ? 'animate-pulse' : ''}`}>{step.icon}</span>
              )}
            </div>
            <span className={`text-[7px] font-bold truncate max-w-[45px] ${state === 'active' ? 'text-[#62dcff]' : state === 'done' ? 'text-slate-400' : 'text-slate-600'}`}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChannelAvatar({ channel, logoUrl, sizeClass = "w-12 h-12", textClass = "text-lg" }) {
  const [failed, setFailed] = useState(false);
  const percent = channel?.completion_percent;
  const incomplete = percent != null && percent < 100;

  // Always circular, regardless of what a caller might still pass — every
  // channel logo across the app (cards, headers, sidebar) must be a circle.
  const image = (!logoUrl || failed) ? (
    <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-[#004c66] to-[#007f99] flex items-center justify-center flex-shrink-0 border border-[#00c2ff]/30 shadow-md p-2`}>
      <img src="/assets/logo/logo-kappgen.png" alt="KappGen" className="w-full h-full object-contain" />
    </div>
  ) : (
    <img
      src={logoUrl}
      alt={channel?.name}
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover border border-[var(--border)] flex-shrink-0 shadow-md`}
    />
  );

  if (!incomplete) return image;

  // Pipeline not finished yet (missing voice and/or visuals) — a ring +
  // percentage on the avatar itself, rather than blocking the channel from
  // being saved at all. Generation stays blocked separately, elsewhere.
  // Stays bottom-right (its original spot) — it's now a fixed-size true
  // circle (not a stretched pill) to actually match the avatar's own
  // roundness instead of reading as a rounded square. The green/red status
  // dot some callers overlay moved to the top corner so it stops colliding
  // with this badge.
  return (
    <div className={`relative ${sizeClass} flex-shrink-0`} title={percent < 100 ? `Configuration à ${percent}% — configure une source visuelle (Option A ou B) pour pouvoir générer une vidéo` : 'Pipeline configuré — prêt à générer des vidéos'}>
      <div
        className="absolute inset-0 rounded-full p-[2.5px]"
        style={{ background: `conic-gradient(#00c2ff ${percent}%, var(--border) 0)` }}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-[var(--bg-input-alt)]">
          {image}
        </div>
      </div>
      <span className="absolute -bottom-1 -right-1 w-[20px] h-[20px] bg-[#00c2ff] text-slate-950 text-[7px] font-black rounded-full leading-none shadow-md flex items-center justify-center">
        {percent}%
      </span>
    </div>
  );
}

function SkeletonGrid({ count = 6, cardClassName = "min-h-[220px]" }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-5 animate-pulse ${cardClassName}`}>
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--border-soft)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 bg-[var(--border-soft)] rounded" />
              <div className="h-2.5 w-1/3 bg-[var(--border-soft)] rounded" />
            </div>
          </div>
          <div className="h-2.5 w-full bg-[var(--border-soft)] rounded mb-2" />
          <div className="h-2.5 w-5/6 bg-[var(--border-soft)] rounded mb-4" />
          <div className="h-8 w-full bg-[var(--border-soft)] rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function viewFromPath(path) {
  if (path === '/' || path === '/dashboard' || path === '/home') return 'home';
  if (path === '/channels') return 'channels';
  if (path === '/videos') return 'videos';
  if (path === '/channels/new') return 'wizard';
  if (/^\/channels\/[^/]+\/edit$/.test(path)) return 'wizard';
  if (/^\/channels\/[^/]+$/.test(path)) return 'channel_detail';
  if (path === '/settings') return 'settings';
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin';
  return 'home';
}

// Each admin sidebar entry gets its own named route (/admin/resources, etc.)
// so a page refresh stays on the current tab instead of bouncing back to
// the overview.
const ADMIN_TABS = ['overview', 'users', 'videos', 'library', 'transactions', 'costs', 'resources'];
function adminTabFromPath(path) {
  const m = path.match(/^\/admin\/([a-z_]+)$/);
  if (m && ADMIN_TABS.includes(m[1])) return m[1];
  return 'overview';
}

const THEME_STORAGE_KEY = 'nichecut_theme'; // 'light' | 'dark' | 'auto'

// Resolves the effective light/dark value for a given preference — 'auto'
// follows the OS-level prefers-color-scheme instead of a fixed choice.
const resolveEffectiveTheme = (pref) => {
  if (pref === 'light' || pref === 'dark') return pref;
  return (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
};

// Dependency-free line chart for the admin overview — two series (new users,
// new videos) over a day range, drawn as plain SVG paths so this doesn't need
// a charting library for one dashboard graph.
function AdminActivityChart({ series }) {
  if (!series || series.length === 0) return <p className="text-xs text-slate-500 py-10 text-center">Aucune donnée.</p>;

  const width = 100;
  const height = 40;
  const maxVal = Math.max(1, ...series.map(d => Math.max(d.new_users, d.new_videos)));
  const stepX = series.length > 1 ? width / (series.length - 1) : 0;
  const toPoints = (key) => series.map((d, i) => `${i * stepX},${height - (d[key] / maxVal) * height}`).join(' ');

  const labelEvery = Math.max(1, Math.ceil(series.length / 7));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-40">
        <polyline points={toPoints('new_videos')} fill="none" stroke="#00c2ff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polyline points={toPoints('new_users')} fill="none" stroke="#f59e0b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-slate-500">
        {series.map((d, i) => (i % labelEvery === 0 || i === series.length - 1) ? (
          <span key={d.date}>{new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
        ) : null)}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-[#00c2ff]" />Nouvelles vidéos</div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Nouveaux utilisateurs</div>
      </div>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    document.title = 'KappGen Studio — Espace de production';
  }, []);

  const [themePreference, setThemePreference] = useState(() => {
    try { return localStorage.getItem(THEME_STORAGE_KEY) || 'dark'; } catch { return 'dark'; }
  });

  // Applies the resolved theme to <html data-theme="…"> (index.css keys all
  // light-mode overrides off that attribute) and keeps it in sync with the
  // OS setting live while on 'auto', without needing a page reload.
  useEffect(() => {
    const apply = () => { document.documentElement.dataset.theme = resolveEffectiveTheme(themePreference); };
    apply();
    try { localStorage.setItem(THEME_STORAGE_KEY, themePreference); } catch {}
    if (themePreference !== 'auto' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [themePreference]);

  const [channels, setChannels] = useState([]);
  const [nicheOptions, setNicheOptions] = useState(NICHE_OPTIONS);
  const [activeChannel, setActiveChannel] = useState(null);
  const [channelVideos, setChannelVideos] = useState([]);
  const [allVideos, setAllVideos] = useState([]);
  const allVideosStatusRef = useRef({}); // video id -> last known status, to detect a fresh done transition
  const [costRecap, setCostRecap] = useState(null); // { videoTitle, total_credits, items } — shown right after a render finishes
  const [view, setView] = useState(() => viewFromPath(window.location.pathname)); // 'home', 'channels', 'videos', 'channel_detail', 'wizard'
  // Declared here (not down with the rest of the admin dashboard state) because
  // the state->URL sync effect below references it in its dependency array,
  // which is evaluated at render time — a `const` declared later in the same
  // component body would still be in its temporal dead zone at that point.
  const [adminTab, setAdminTab] = useState(() => adminTabFromPath(window.location.pathname)); // 'overview' | 'users' | 'plans' | 'videos' | 'transactions'
  // Product switcher (à la IziVoice Creative) — 'montage' is the real product;
  // 'avatar' and 'music' are placeholder entry points for not-yet-built
  // product lines (music: a channel whose content IS the music — style +
  // example titles, AI-generated tracks, then a lightweight loop/compilation
  // assembly with an audio-spectrum visual — distinct from music_preference,
  // which is just background music behind a narration video).
  const [activeProduct, setActiveProduct] = useState('montage');
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const NICHECUT_PRODUCTS = [
    { id: 'montage', label: 'Montage Simple', icon: 'movie_edit', available: true },
    { id: 'avatar', label: 'Vidéos Avatar', icon: 'face', available: false },
    { id: 'music', label: 'Vidéo Musicale', icon: 'library_music', available: true },
  ];
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [channelsLoadError, setChannelsLoadError] = useState('');
  const [videosLoadError, setVideosLoadError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  // Modals & Menu Popups
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [generatingAutoVideo, setGeneratingAutoVideo] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showChannelPickerModal, setShowChannelPickerModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showScriptStructureModal, setShowScriptStructureModal] = useState(false);
  const [scriptStructurePasteText, setScriptStructurePasteText] = useState('');
  const [scriptStructureAnalyzing, setScriptStructureAnalyzing] = useState(false);
  const [scriptStructureAnalyzeError, setScriptStructureAnalyzeError] = useState('');
  const [languageSearch, setLanguageSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('kappgen_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const toggleSidebarCollapsed = () => setSidebarCollapsed(prev => {
    const next = !prev;
    try { localStorage.setItem('kappgen_sidebar_collapsed', next ? '1' : '0'); } catch {}
    return next;
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [openChannelMenuId, setOpenChannelMenuId] = useState(null);
  const [openVideoMenuId, setOpenVideoMenuId] = useState(null);
  // The video-actions dropdown is portaled to <body> (see videoMenuAnchor
  // below) so it isn't clipped by the scrollable video grid's overflow —
  // fixed-position coordinates computed from the kebab button's own rect
  // at click time, since a plain CSS dropdown gets cut off by any
  // scrolling/overflow-hidden ancestor regardless of z-index.
  const [videoMenuAnchor, setVideoMenuAnchor] = useState(null);
  const openVideoMenu = (vidId, e) => {
    e.stopPropagation();
    if (openVideoMenuId === vidId) { setOpenVideoMenuId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const margin = 12;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    // The menu has more entries than reliably fit below a button near the
    // bottom of the viewport — it used to just render past the screen edge
    // with no way to scroll it into view (a fixed-position portal isn't
    // inside the page's own scroll container). Flip it to open upward when
    // there's more room there, and cap+scroll it either way as a safety net
    // for any screen size.
    const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;
    setVideoMenuAnchor({
      top: openUpward ? null : rect.bottom + 6,
      bottom: openUpward ? window.innerHeight - rect.top + 6 : null,
      right: window.innerWidth - rect.right,
      maxHeight: Math.max(160, (openUpward ? spaceAbove : spaceBelow) - 6),
    });
    setOpenVideoMenuId(vidId);
  };
  const [publishingVideoId, setPublishingVideoId] = useState(null);
  const [publishReviewVideo, setPublishReviewVideo] = useState(null);
  const [publishTitleDraft, setPublishTitleDraft] = useState('');
  const [publishDescriptionDraft, setPublishDescriptionDraft] = useState('');
  const [videoSelectionMode, setVideoSelectionMode] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState(new Set());
  const toggleVideoSelected = (id) => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const exitVideoSelectionMode = () => {
    setVideoSelectionMode(false);
    setSelectedVideoIds(new Set());
  };
  const handleBulkDeleteVideos = async () => {
    if (selectedVideoIds.size === 0) return;
    const ok = await askConfirm(`Supprimer définitivement ${selectedVideoIds.size} vidéo(s) et leurs fichiers rendus ?`, { title: `Supprimer ${selectedVideoIds.size} vidéo(s) ?`, danger: true });
    if (!ok) return;
    try {
      await Promise.all(Array.from(selectedVideoIds).map(id => authFetch(`${API_BASE}/videos/${id}`, { method: 'DELETE' })));
      showToast(`${selectedVideoIds.size} vidéo(s) supprimée(s).`, 'success');
    } catch (err) {
      showToast('Certaines suppressions ont échoué.', 'error');
    } finally {
      exitVideoSelectionMode();
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
    }
  };
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);
  // Backend timestamps are ISO strings without a timezone suffix (naive UTC).
  // `new Date("2026-01-01T12:00:00")` treats that as LOCAL time, not UTC, which
  // silently inflates every elapsed/relative time display by the browser's UTC
  // offset. Force UTC interpretation by appending "Z" when no offset is present.
  const parseServerDate = (iso) => {
    if (!iso) return null;
    const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
    return new Date(hasTimezone ? iso : `${iso}Z`);
  };
  const formatElapsed = (startedAt) => {
    if (!startedAt) return null;
    const secs = Math.max(0, Math.floor((nowTick - parseServerDate(startedAt).getTime()) / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}min ${s}s` : `${s}s`;
  };
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return null;
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  const formatRelativeDate = (iso) => {
    if (!iso) return '';
    const diffMs = nowTick - parseServerDate(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  };
  const formatSyncAgo = (channelId, _tick) => {
    if (!channelId) return 'jamais';
    let iso = null;
    try { iso = localStorage.getItem(`nichecut_last_sync_${channelId}`); } catch {}
    if (!iso) return 'jamais';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  };

  const [submitStep, setSubmitStep] = useState(1); // 1 = form, 2 = confirm/preview before launch

  useEffect(() => {
    if (showSubmitModal) setSubmitStep(1);
  }, [showSubmitModal]);

  const [loading, setLoading] = useState(false);
  const [connectingYouTubeFromWizard, setConnectingYouTubeFromWizard] = useState(false);
  const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [videoFilterChannelId, setVideoFilterChannelId] = useState('all');
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
  const [librarySyncHasHandle, setLibrarySyncHasHandle] = useState(false);
  const [librarySyncing, setLibrarySyncing] = useState(false);
  const [librarySyncTick, setLibrarySyncTick] = useState(0); // bumped to force the relative-time label to re-render
  // Each subtitle preview box is a different pixel width on screen, so each
  // needs its own live-measured scale relative to the real 1920-wide render.
  const [wizardSubtitlePreviewRef, wizardSubtitlePreviewScale] = useSubtitlePreviewScale();
  const [mockupSubtitlePreviewRef, mockupSubtitlePreviewScale] = useSubtitlePreviewScale();
  const [submitSubtitlePreviewRef, submitSubtitlePreviewScale] = useSubtitlePreviewScale();
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, danger, resolve }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const askConfirm = (message, { title = "Confirmer l'action", danger = false } = {}) => {
    return new Promise((resolve) => {
      setConfirmDialog({ title, message, danger, resolve });
    });
  };

  const resolveConfirm = (value) => {
    if (confirmDialog) confirmDialog.resolve(value);
    setConfirmDialog(null);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Google redirects back here after a YouTube connection attempt (?youtube=connected|error&youtube_channel_id=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ytStatus = params.get('youtube');
    if (!ytStatus) return;
    if (ytStatus === 'connected') {
      showToast('Chaîne YouTube connectée avec succès.', 'success');
    } else {
      const msg = params.get('youtube_message');
      showToast(msg ? `Connexion YouTube échouée : ${msg}` : 'Connexion YouTube échouée.', 'error');
    }
    const returnedChannelId = params.get('youtube_channel_id');

    (async () => {
      await fetchChannels();
      if (!returnedChannelId) {
        navigate('/channels');
        return;
      }
      try {
        const res = await authFetch(`${API_BASE}/channels/${returnedChannelId}`);
        if (!res.ok) throw new Error();
        const chan = await res.json();
        let returnStep = null;
        try {
          const raw = sessionStorage.getItem('nichecut_return_to_wizard_step');
          sessionStorage.removeItem('nichecut_return_to_wizard_step');
          const n = raw ? parseInt(raw, 10) : NaN;
          if (Number.isFinite(n) && n >= 1 && n <= 9) returnStep = n;
        } catch {}
        if (returnStep) {
          // Back into the wizard, same step — name/description/logo are already
          // filled in from `chan` (the backend just synced them on connect).
          openEditWizard(chan, null, returnStep);
          navigate(`/channels/${slugifyChannelName(chan.name)}/edit`);
        } else {
          setActiveChannel(chan);
          fetchChannelVideos(chan.id);
          setView('channel_detail');
          navigate(`/channels/${slugifyChannelName(chan.name)}`);
        }
      } catch {
        navigate('/channels');
      }
    })();
  }, []);

  // Karaoke Animation Preview Index
  const [previewWordIndex, setPreviewWordIndex] = useState(0);

  // Karaoke timer animation effect for subtitle preview
  useEffect(() => {
    const timer = setInterval(() => {
      setPreviewWordIndex(prev => (prev + 1) % 6);
    }, 800);
    return () => clearInterval(timer);
  }, []);

  // Close channel popup menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.channel-menu-container')) {
        setOpenChannelMenuId(null);
      }
      if (!e.target.closest('.video-menu-container')) {
        setOpenVideoMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // User Auth State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("nichecut_user");
    return saved ? JSON.parse(saved) : null;
  });
  // The session token itself lives only in an httpOnly cookie set by the
  // backend (src/utils/auth.py: set_session_cookie) — never in localStorage
  // or JS-readable state, so a hypothetical XSS bug can't exfiltrate it.
  // `credentials: 'include'` makes fetch send that cookie automatically.
  // `timeoutMs`, when given, aborts the request instead of leaving it
  // pending forever — plain `fetch()` has no built-in timeout, so a single
  // hung request (dead connection, backend stall) can otherwise freeze an
  // awaiting caller indefinitely. This bit the voice-clone status poll: each
  // iteration awaited one fetch with no timeout, so one stuck request froze
  // the whole polling loop before it ever reached its own 5-minute give-up
  // counter, leaving "Clonage…" stuck on screen with no error, no retry, no
  // way out short of a page reload.
  const authFetch = (url, options = {}) => {
    const { timeoutMs, ...rest } = options;
    if (!timeoutMs) {
      return fetch(url, { ...rest, credentials: 'include' }).then(res => {
        if (res.status === 401) handleLogout();
        return res;
      });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...rest, credentials: 'include', signal: controller.signal })
      .then(res => {
        if (res.status === 401) handleLogout();
        return res;
      })
      .finally(() => clearTimeout(timer));
  };
  const storeAuthSession = (loggedUser) => {
    setCurrentUser(loggedUser);
    localStorage.setItem("nichecut_user", JSON.stringify(loggedUser));
  };
  const [authTab, setAuthTab] = useState(() => window.location.pathname.endsWith('/signup') || window.location.pathname.endsWith('/signin') ? 'register' : 'login'); // 'login' | 'register' | 'forgot'
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [forgotForm, setForgotForm] = useState({ email: '', newPassword: '' });
  const [forgotStep, setForgotStep] = useState('request'); // 'request' | 'verify'
  const [resetCode, setResetCode] = useState('');
  const [settingsTab, setSettingsTab] = useState('profile'); // 'profile' | 'security' | 'api'
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', locale: 'fr' });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '' });
  const [showSettingsPassword, setShowSettingsPassword] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [justCreatedApiKey, setJustCreatedApiKey] = useState(null);
  const [izivoiceConnection, setIzivoiceConnection] = useState({ connected: false, mode: 'nichecut', key_prefix: null });
  const [izivoiceApiKey, setIzivoiceApiKey] = useState('');
  const [izivoiceConnecting, setIzivoiceConnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');


  // Submission Form State (Nouvelle Vidéo)
  const [submitMode, setSubmitMode] = useState('text'); // 'text' | 'audio_upload'
  const [singleScriptText, setSingleScriptText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('fr-FR-Thomas');
  const [availableVoices, setAvailableVoices] = useState(VOICE_MODELS);
  const defaultVoicesRef = useRef(VOICE_MODELS);
  const [voiceSearching, setVoiceSearching] = useState(false);
  const [cloningVoice, setCloningVoice] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [izivoiceStatus, setIzivoiceStatus] = useState(null);
  const [showIzivoiceKeyModal, setShowIzivoiceKeyModal] = useState(false);
  const [izivoiceKeyDraft, setIzivoiceKeyDraft] = useState('');
  const [savingIzivoiceKey, setSavingIzivoiceKey] = useState(false);
  const cloneVoiceInputRef = useRef(null);
  const [showVoiceLibrary, setShowVoiceLibrary] = useState(false);
  // Separate from VoiceLibraryModal's own (locally-scoped) playingId — this one
  // is for the compact voice selector on the Voix Off step, outside that modal.
  const [wizardVoicePreviewId, setWizardVoicePreviewId] = useState(null);
  const [wizardVoiceGeneratingId, setWizardVoiceGeneratingId] = useState(null);
  const [showVoiceCloner, setShowVoiceCloner] = useState(false);
  const [savedVoiceIds, setSavedVoiceIds] = useState(() => readVoiceIdList(SAVED_VOICE_IDS_KEY));
  const [clonedVoiceIds, setClonedVoiceIds] = useState(() => readVoiceIdList(CLONED_VOICE_IDS_KEY));
  const [voiceMetaCache, setVoiceMetaCache] = useState(() => readVoiceMetaCache());
  // Remembers a saved/cloned voice's display info so it survives a catalog
  // refetch (see VOICE_META_CACHE_KEY above) — call this anywhere a voice
  // gets bookmarked or cloned, alongside the id-list tracking.
  const cacheVoiceMeta = (voice) => {
    if (!voice?.id) return;
    setVoiceMetaCache(prev => {
      const next = { ...prev, [voice.id]: voice };
      writeVoiceMetaCache(next);
      return next;
    });
  };
  // Re-adds any saved/cloned voice missing from a freshly fetched catalog
  // page/search result, using the cached metadata — otherwise a voice cloned
  // earlier in this browser silently disappears from the picker the moment
  // it scrolls outside whatever page window the catalog fetch happens to
  // cover (see VOICE_META_CACHE_KEY comment).
  const mergeKnownVoices = (list) => {
    const missingIds = [...clonedVoiceIds, ...savedVoiceIds].filter(id => !list.some(v => v.id === id));
    if (missingIds.length === 0) return list;
    const missing = missingIds.map(id => voiceMetaCache[id]).filter(Boolean);
    return [...missing, ...list];
  };
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [catalogNextPage, setCatalogNextPage] = useState(10);
  const [loadingMoreVoices, setLoadingMoreVoices] = useState(false);
  const [audioFilesList, setAudioFilesList] = useState([]);
  // Izivoice STT transcription (for accurate audio-upload subtitles) is billable —
  // default on, but the user can opt out in the final preview to avoid credit cost.
  const [transcribeAudio, setTranscribeAudio] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Wizard State
  const [wizardStep, setWizardStep] = useState(1);
  // Aperçu Final (step 6) recap checklist — purely local to the preview, lets the
  // user toggle each configured element on/off to see the mockup with/without it.
  // Only "visual" has no real per-channel setting (a video always needs a
  // background) — logo/subtitles/effects/music toggle real newChannel fields
  // instead, see isRecapChecked/toggleRecap in the step-6 wizard block.
  const [recapVisible, setRecapVisible] = useState({ visual: true });
  // Drag-and-drop reordering of the "Calques" stack on the pipeline wizard's
  // final preview step — id of the layer currently being dragged, or null.
  const [draggedLayerId, setDraggedLayerId] = useState(null);
  const [wizardMode, setWizardMode] = useState('create');
  // Which pipeline the 'wizard' view renders — 'narration' (the existing
  // 9-step script/voiceover flow) or 'music' (MusicChannelWizard). Same
  // view/sidebar/header shell either way; only the step content differs.
  const [wizardContentType, setWizardContentType] = useState('narration');
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [subtitleTab, setSubtitleTab] = useState('presets');
  const [nicheMode, setNicheMode] = useState('preset');
  const [styleAnalyzing, setStyleAnalyzing] = useState(false);
  const [musicFiles, setMusicFiles] = useState([]);
  const [musicUploading, setMusicUploading] = useState(false);
  const musicInputRef = useRef(null);
  const [aiMusicGenerating, setAiMusicGenerating] = useState(false);
  const [aiMusicPreviewUrl, setAiMusicPreviewUrl] = useState(null);

  const handleGenerateMusicPreview = async () => {
    setAiMusicGenerating(true);
    if (aiMusicPreviewUrl) URL.revokeObjectURL(aiMusicPreviewUrl);
    setAiMusicPreviewUrl(null);
    try {
      const formData = new FormData();
      formData.append('niche', newChannel.niche || '');
      if (newChannel.music_preference.ai_prompt) formData.append('ai_prompt', newChannel.music_preference.ai_prompt);
      formData.append('duration', '20');
      const res = await authFetch(`${API_BASE}/channels/preview-ai-music`, { method: 'POST', body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Génération impossible.");
      }
      const blob = await res.blob();
      setAiMusicPreviewUrl(URL.createObjectURL(blob));
      // A real music choice was made — same rule as picking a file in "Mes propres musiques".
      setNewChannel(prev => ({ ...prev, music_preference: { ...prev.music_preference, enabled: true } }));
    } catch (err) {
      showToast(err.message || "Erreur lors de la génération de la musique.", "error");
    } finally {
      setAiMusicGenerating(false);
    }
  };

  const handleMusicFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) {
      setMusicFiles(prev => [...prev, ...files]);
      // A real music choice was made — turn the feature on automatically.
      setNewChannel(prev => ({ ...prev, music_preference: { ...prev.music_preference, enabled: true } }));
    }
  };

  const uploadChannelMusic = async (channelId) => {
    if (!musicFiles.length) return;
    const formData = new FormData();
    musicFiles.forEach(f => formData.append('files', f));
    const res = await authFetch(`${API_BASE}/channels/${channelId}/music`, { method: 'POST', body: formData });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail || "Impossible d'importer les musiques.");
    }
    return res.json();
  };

  const handleDeleteMusicTrack = async (trackPath) => {
    if (!editingChannelId) return;
    try {
      const res = await authFetch(`${API_BASE}/channels/${editingChannelId}/music?track_path=${encodeURIComponent(trackPath)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Suppression impossible.");
      const updated = await res.json();
      setNewChannel(prev => ({ ...prev, music_preference: { ...prev.music_preference, tracks: updated.music_preference?.tracks || [] } }));
    } catch (err) {
      showToast(err.message, "error");
    }
  };
  const styleReferenceInputRef = useRef(null);

  const handleAnalyzeStyleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStyleAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch(`${API_BASE}/channels/analyze-style-image`, { method: 'POST', body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Analyse impossible.");
      }
      const data = await res.json();
      setNewChannel(prev => ({ ...prev, image_style: { ...prev.image_style, style_prompt: data.style_prompt } }));
      showToast("Style analysé et appliqué au prompt.", "success");
    } catch (err) {
      showToast(err.message || "Erreur lors de l'analyse de l'image.", "error");
    } finally {
      setStyleAnalyzing(false);
    }
  };
  const thumbnailStyleInputRef = useRef(null);
  const [thumbnailStyleAnalyzing, setThumbnailStyleAnalyzing] = useState(false);

  // AI-proposed thumbnail identity flow: propose one concrete, niche-specific
  // concept (illustration style + recurring subject + palette) with a real
  // preview image, let the creator approve it (locked in as this channel's
  // thumbnail_style — every future thumbnail reuses it automatically) or
  // ask for a genuinely different one instead of a generic template.
  const [thumbnailConceptLoading, setThumbnailConceptLoading] = useState(false);
  const [thumbnailConceptProposal, setThumbnailConceptProposal] = useState(null); // { concept, preview_url }
  const [rejectedThumbnailConcepts, setRejectedThumbnailConcepts] = useState([]);

  const handleProposeThumbnailConcept = async () => {
    if (!editingChannelId) {
      showToast("Enregistre d'abord la chaîne avant de proposer un style de miniature.", "error");
      return;
    }
    setThumbnailConceptLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/channels/${editingChannelId}/thumbnail-concept/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejected_concepts: rejectedThumbnailConcepts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Proposition de style impossible.");
      setThumbnailConceptProposal(data);
    } catch (err) {
      showToast(err.message || "Proposition de style impossible.", "error");
    } finally {
      setThumbnailConceptLoading(false);
    }
  };

  const handleRejectThumbnailConcept = () => {
    if (thumbnailConceptProposal?.concept) {
      const c = thumbnailConceptProposal.concept;
      setRejectedThumbnailConcepts(prev => [...prev, `${c.concept_name}: ${c.style_prompt}`]);
    }
    setThumbnailConceptProposal(null);
    handleProposeThumbnailConcept();
  };

  const handleApproveThumbnailConcept = async () => {
    if (!editingChannelId || !thumbnailConceptProposal?.concept) return;
    const c = thumbnailConceptProposal.concept;
    try {
      const res = await authFetch(`${API_BASE}/channels/${editingChannelId}/thumbnail-concept/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style_prompt: c.style_prompt, concept_name: c.concept_name, text_style: c.text_style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Validation impossible.");
      setNewChannel(prev => ({ ...prev, thumbnail_style: data.thumbnail_style }));
      setThumbnailConceptProposal(null);
      setRejectedThumbnailConcepts([]);
      showToast("Style de miniature validé — toutes les prochaines vidéos de cette chaîne le garderont.", "success");
    } catch (err) {
      showToast(err.message || "Validation impossible.", "error");
    }
  };

  const handleUploadThumbnailStyle = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (!editingChannelId) {
      showToast("Enregistre d'abord la chaîne avant d'ajouter des images de référence de miniature.", "error");
      return;
    }
    setThumbnailStyleAnalyzing(true);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      const res = await authFetch(`${API_BASE}/channels/${editingChannelId}/thumbnail-style`, { method: 'POST', body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Analyse impossible.");
      }
      const data = await res.json();
      setNewChannel(prev => ({ ...prev, thumbnail_style: data.thumbnail_style }));
      setChannels(prev => prev.map(c => c.id === data.id ? data : c));
      showToast(`Style de miniature ré-analysé sur ${(data.thumbnail_style?.reference_image_paths || []).length} image(s).`, "success");
    } catch (err) {
      showToast(err.message || "Erreur lors de l'analyse des images.", "error");
    } finally {
      setThumbnailStyleAnalyzing(false);
    }
  };

  // Extra sticker overlays (e.g. a "Subscribe" button or bell icon a creator
  // used to paste on by hand) — same deferred-until-saved pattern as the
  // thumbnail reference images above: the channel must exist server-side
  // before a file can be attached to it.
  const [overlayUploading, setOverlayUploading] = useState(false);
  const handleUploadOverlay = async (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    if (!editingChannelId) {
      showToast("Enregistre d'abord la chaîne avant d'ajouter des incrustations.", "error");
      return;
    }
    setOverlayUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch(`${API_BASE}/channels/${editingChannelId}/overlays`, { method: 'POST', body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Ajout de l'incrustation impossible.");
      }
      const data = await res.json();
      setNewChannel(prev => ({ ...prev, branding: { ...prev.branding, overlays: data.branding?.overlays || [] } }));
      setChannels(prev => prev.map(c => c.id === data.id ? data : c));
      showToast("Incrustation ajoutée.", "success");
    } catch (err) {
      showToast(err.message || "Erreur lors de l'ajout de l'incrustation.", "error");
    } finally {
      setOverlayUploading(false);
    }
  };

  // No dedicated "replace image" endpoint — swaps it by deleting the old
  // overlay and uploading the new file, then reapplying the corner/size/
  // enabled the creator already set so replacing the picture doesn't reset
  // its placement.
  const handleReplaceOverlayFile = async (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    const overlayId = replacingOverlayId;
    if (!file || !overlayId || !editingChannelId) { setReplacingOverlayId(null); return; }
    const old = (newChannel.branding.overlays || []).find(o => o.id === overlayId);
    setOverlayUploading(true);
    try {
      // Upload the replacement first, then only delete the old one once
      // that succeeded — the other order (delete, then upload) could leave
      // neither image in place if the upload failed after the delete went
      // through. replace_id keeps this from tripping the 6-overlay cap.
      const formData = new FormData();
      formData.append('file', file);
      formData.append('replace_id', overlayId);
      const res = await authFetch(`${API_BASE}/channels/${editingChannelId}/overlays`, { method: 'POST', body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Remplacement impossible.");
      }
      const data = await res.json();
      let overlays = data.branding?.overlays || [];
      const newest = overlays[overlays.length - 1];
      if (old && newest) {
        overlays = overlays.map(o => o.id === newest.id ? { ...o, corner: old.corner, x_percent: old.x_percent, y_percent: old.y_percent, size_percent: old.size_percent, opacity: old.opacity, shape: old.shape, enabled: old.enabled } : o);
      }
      const delRes = await authFetch(`${API_BASE}/channels/${editingChannelId}/overlays/${overlayId}`, { method: 'DELETE' });
      if (delRes.ok) {
        const delData = await delRes.json();
        overlays = (delData.branding?.overlays || []).map(o => o.id === newest?.id ? overlays.find(x => x.id === newest.id) || o : o);
      }
      setNewChannel(prev => ({ ...prev, branding: { ...prev.branding, overlays } }));
      setChannels(prev => prev.map(c => c.id === data.id ? { ...data, branding: { ...data.branding, overlays } } : c));
      showToast("Image remplacée.", "success");
    } catch (err) {
      showToast(err.message || "Erreur lors du remplacement.", "error");
    } finally {
      setOverlayUploading(false);
      setReplacingOverlayId(null);
    }
  };

  const handleDeleteOverlay = async (overlayId) => {
    if (!editingChannelId) return;
    try {
      const res = await authFetch(`${API_BASE}/channels/${editingChannelId}/overlays/${overlayId}`, { method: 'DELETE' });
      if (res.status === 404) {
        // Already gone server-side (e.g. this channel was open in another tab
        // that replaced/deleted it first, leaving this tab's local state
        // pointing at a stale id) — the end state the user wants is already
        // true, so just drop it locally instead of showing a scary error.
        setNewChannel(prev => ({ ...prev, branding: { ...prev.branding, overlays: (prev.branding.overlays || []).filter(o => o.id !== overlayId) } }));
        return;
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `Suppression impossible (${res.status}).`);
      }
      const data = await res.json();
      setNewChannel(prev => ({ ...prev, branding: { ...prev.branding, overlays: data.branding?.overlays || [] } }));
      setChannels(prev => prev.map(c => c.id === data.id ? data : c));
    } catch (err) {
      showToast(err.message || "Erreur lors de la suppression.", "error");
    }
  };

  // Corner/size/enabled changes are just local state until the channel is
  // saved (same PUT as every other branding field) — no dedicated endpoint,
  // consistent with how the rest of the wizard's fields work.
  const updateOverlayField = (overlayId, field, value) => {
    setNewChannel(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        overlays: (prev.branding.overlays || []).map(o => o.id === overlayId ? { ...o, [field]: value } : o),
      },
    }));
  };

  const handleRemoveThumbnailStyle = async (imagePath = null) => {
    if (!editingChannelId) return;
    setThumbnailStyleAnalyzing(true);
    try {
      const url = imagePath
        ? `${API_BASE}/channels/${editingChannelId}/thumbnail-style?image_path=${encodeURIComponent(imagePath)}`
        : `${API_BASE}/channels/${editingChannelId}/thumbnail-style`;
      const res = await authFetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error("Suppression impossible.");
      const data = await res.json();
      setNewChannel(prev => ({ ...prev, thumbnail_style: data.thumbnail_style || null }));
      setChannels(prev => prev.map(c => c.id === data.id ? data : c));
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setThumbnailStyleAnalyzing(false);
    }
  };
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const logoInputRef = useRef(null);
  const overlayInputRef = useRef(null);
  const replaceOverlayInputRef = useRef(null);
  const [replacingOverlayId, setReplacingOverlayId] = useState(null);

  // Local Image Folder Upload State for Wizard Step 5
  const [localImageFiles, setLocalImageFiles] = useState([]);
  const [libraryUploadStatus, setLibraryUploadStatus] = useState(null); // null | 'analyzing' | 'uploading' | 'validating' | 'success' | 'error'
  const [libraryUploadProgress, setLibraryUploadProgress] = useState(0);
  const [libraryUploadMessage, setLibraryUploadMessage] = useState('');
  const [stagedLibraryToken, setStagedLibraryToken] = useState(null);
  // Community library availability for the channel's current niche —
  // refetched whenever the niche changes, drives whether "Bibliothèque
  // collaborative" can be selected as a visual source (Step 4).
  const [communityLibraryAvailability, setCommunityLibraryAvailability] = useState(null); // null (loading/unknown) | { available, folder_count, image_count }
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const [isFolderDragging, setIsFolderDragging] = useState(false);
  const wizardFolderInputRef = useRef(null);
  const channelSyncInputRef = useRef(null);
  const libraryUploadXhrRef = useRef(null);

  const defaultChannelForm = {
    name: '',
    description: '',
    niche: 'Philosophie & Stoïcisme',
    subtitle_style: {
      enabled: true,
      font: 'Inter',
      size: 44,
      color: '#FFD700',
      base_color: '#FFFFFF',
      outline_color: '#000000',
      outline_width: 3,
      position: 'bottom',
      align: 'center',
      karaoke: true,
      highlight_mode: 'word',
      box_color: 'transparent',
      box_padding: 10,
      words_per_line: 6,
      text_case: 'none',
      bold: false,
      italic: false,
      letter_spacing: 0,
      opacity: 100,
      rotation: 0,
      x_offset: 0,
      y_offset: 0,
      shadow: false,
      shadow_color: '#000000',
      shadow_distance: 3
    },
    branding: {
      logo_path: '',
      logo_enabled: true,
      logo_corner: 'top-right',
      logo_size_percent: 14,
      overlays: [],
    },
    music_preference: {
      // Off until the creator actually picks something (upload / AI generate) —
      // auto-flips to true the moment they make a real choice, see handleMusicFileSelect
      // and the OPTION A/B card clicks in the Musique step.
      enabled: false,
      mode: 'library',
      track_id_or_style: 'ambient',
      volume: 0.10
    },
    image_style: {
      source: 'library',
      // Left empty on purpose: this used to default to a "stoic sculpture
      // style" prompt (leftover from the Philosophie & Stoïcisme example
      // channel) which every new channel silently inherited regardless of
      // its actual niche, since picking a niche never touches this field —
      // producing off-topic imagery (e.g. philosophy-style visuals on a
      // health or religion channel) unless the creator happened to notice
      // and clear it manually.
      style_prompt: '',
      library_path: '',
      library_image_count: 0
    },
    thumbnail_style: null,
    effects_config: {
      enabled: true,
      grain: true,
      overlay_effect: 'grain',
      overlay_effects: ['grain'],
      color_grade: 'warm',
      grain_intensity: 50,
      vignette_intensity: 50,
      zoom_min_pct: 1.0,
      zoom_max_pct: 1.15,
      watermark_enabled: true
    },
    automation_mode: 'manual',
    automation_style_prompt: '',
    topic_examples: '',
    use_web_trends: false,
    // Auto-detected from the browser — the daily generation window and the
    // scheduled publish hour are both read in this timezone, never a single
    // region imposed on every creator.
    timezone: (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Africa/Douala',
    videos_per_day: 1,
    automation_window_start_hour: 7,
    automation_window_end_hour: 11,
    active_days: null,
    script_generation_hour: -1, // -1 = "as soon as possible" (sent explicitly so an edit can clear a previously-set hour)
    script_generation_minute: 0,
    script_generation_second: 0,
    script_generation_days: null,
    publish_mode: 'manual',
    publish_time_mode: 'range',
    publish_schedule_hour: 8,
    publish_schedule_day_offset: 1,
    script_structure: {
      language: 'English',
      ...getScriptStructureDefaults(),
    },
    voice_id: '',
    voice_name: '',
    voice_settings: { speed: 0.845, stability: 0.8, similarity_boost: 0.9, style: 0 }
  };
  const [newChannel, setNewChannel] = useState(defaultChannelForm);

  useEffect(() => {
    const niche = (newChannel?.niche || '').trim();
    if (view !== 'wizard' || wizardStep !== 4 || !niche) return;
    let cancelled = false;
    fetch(`${API_BASE}/channels/community-library/availability?niche=${encodeURIComponent(niche)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        setCommunityLibraryAvailability(data);
        // Auto-select the collaborative library the moment it's known to be
        // available, instead of making the creator notice and tick a box
        // themselves — but only while they haven't already made a real
        // choice (still on the untouched default with nothing uploaded),
        // so this never silently overrides a deliberate "own images" pick.
        setNewChannel(prev => {
          const style = prev.image_style || {};
          const untouched = style.source === 'library' && !style.library_path && !(style.library_image_count > 0);
          if (data?.available && untouched) {
            return { ...prev, image_style: { ...style, source: 'community', sources: ['community'] } };
          }
          return prev;
        });
      })
      .catch(() => { if (!cancelled) setCommunityLibraryAvailability(null); });
    return () => { cancelled = true; };
  }, [view, wizardStep, newChannel?.niche]);

  const fetchChannels = async () => {
    if (!currentUser) return;
    try {
      // The backend now derives the caller from the bearer token, not this
      // param — it ignores it, and 401s without a token regardless.
      const res = await authFetch(`${API_BASE}/channels`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Réponse API invalide');
      setChannels(data);
      setChannelsLoadError('');
    } catch (e) {
      console.error("API error loading channels:", e);
      setChannelsLoadError("Impossible de charger vos chaînes. Vérifiez que l’API KappGen est accessible.");
    } finally {
      setChannelsLoaded(true);
    }
  };

  const fetchNicheOptions = async () => {
    try {
      const res = await authFetch(`${API_BASE}/channels/niches`);
      if (!res.ok) return;
      const saved = await res.json();
      if (Array.isArray(saved)) {
        setNicheOptions(prev => Array.from(new Set([...NICHE_OPTIONS, ...saved])).sort((a, b) => a.localeCompare(b, 'fr')));
      }
    } catch (e) {
      console.error("Erreur lors du chargement des niches:", e);
    }
  };

  const fetchAllVideos = async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`${API_BASE}/videos`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Réponse API invalide');

      // Detect a video that just flipped to 'done' since the last poll, and
      // pull its cost recap — this is the "juste après la génération" trigger,
      // since render completion is only ever observed here (polling), not as
      // a direct response to a submit call.
      const previousStatuses = allVideosStatusRef.current;
      const freshlyDone = data.filter(v => v.status === 'done' && previousStatuses[v.id] && previousStatuses[v.id] !== 'done');
      allVideosStatusRef.current = Object.fromEntries(data.map(v => [v.id, v.status]));

      setAllVideos(data);
      setVideosLoadError('');

      if (freshlyDone.length > 0) {
        const video = freshlyDone[0];
        authFetch(`${API_BASE}/videos/${video.id}/cost-recap`).then(r => r.ok ? r.json() : null).then(recap => {
          if (recap && recap.total_credits > 0) setCostRecap({ videoTitle: video.title || 'Vidéo', ...recap });
        }).catch(() => {});
      }
    } catch (e) {
      console.error("API error loading videos:", e);
      setVideosLoadError("Impossible de charger vos vidéos. Vérifiez que l’API KappGen est accessible.");
    } finally {
      setVideosLoaded(true);
    }
  };

  const [folders, setFolders] = useState([]);
  const [videoFilterFolderId, setVideoFilterFolderId] = useState('all');
  // Which folder we're browsing inside of, file-explorer style — null is the
  // root (top-level folders + videos with no folder). Distinct from
  // videoFilterFolderId ('all' | folder id | null) which decides what the
  // video grid actually shows; navigating folders keeps the two in sync.
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const folderPath = (() => {
    const path = [];
    let id = currentFolderId;
    const byId = new Map(folders.map(f => [f.id, f]));
    while (id) {
      const f = byId.get(id);
      if (!f) break;
      path.unshift(f);
      id = f.parent_id;
    }
    return path;
  })();
  const openFolder = (folderId) => { setCurrentFolderId(folderId); setVideoFilterFolderId(folderId ?? null); };
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [movingVideoId, setMovingVideoId] = useState(null);
  const [draggedVideoId, setDraggedVideoId] = useState(null);
  const [draggedFolderId, setDraggedFolderId] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null);
  const [folderSidebarCollapsed, setFolderSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('kappgen_folder_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const toggleFolderSidebarCollapsed = () => setFolderSidebarCollapsed(prev => {
    const next = !prev;
    try { localStorage.setItem('kappgen_folder_sidebar_collapsed', next ? '1' : '0'); } catch {}
    return next;
  });
  const [renamingFolder, setRenamingFolder] = useState(null); // { id, name } while the rename modal is open
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renamingFolderBusy, setRenamingFolderBusy] = useState(false);

  // Vertical folder tree — recurses into sub-folders, indenting each level.
  const renderFolderTree = (parentId, depth) => (
    folders.filter(f => f.parent_id === parentId).map(f => (
      <div key={f.id} className="relative group/folder">
        <button
          onClick={() => openFolder(f.id)}
          draggable
          onDragStart={(e) => { e.stopPropagation(); setDraggedFolderId(f.id); e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'move'; }}
          onDragEnd={() => setDraggedFolderId(null)}
          onDragOver={(e) => { if (draggedVideoId || (draggedFolderId && draggedFolderId !== f.id)) { e.preventDefault(); setDragOverFolderId(f.id); } }}
          onDragLeave={() => setDragOverFolderId(id => id === f.id ? null : id)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverFolderId(null);
            if (draggedFolderId && draggedFolderId !== f.id) {
              const movedId = draggedFolderId;
              setDraggedFolderId(null);
              moveFolderInto(movedId, f.id);
              return;
            }
            const videoId = draggedVideoId || e.dataTransfer.getData('text/plain');
            setDraggedVideoId(null);
            if (videoId) moveVideoToFolder(videoId, f.id);
          }}
          style={folderSidebarCollapsed ? {} : { paddingLeft: `${8 + depth * 16}px` }}
          title={f.name}
          className={`w-full text-left py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${folderSidebarCollapsed ? 'px-0 justify-center' : 'pr-7'} ${
            videoFilterFolderId === f.id ? 'bg-[#00c2ff] text-slate-950' : 'text-slate-300 hover:text-white hover:bg-[var(--bg-hover)]'
          } ${dragOverFolderId === f.id ? 'ring-2 ring-[#00c2ff] ring-offset-1 ring-offset-[var(--bg-page)]' : ''} ${draggedFolderId === f.id ? 'opacity-40' : ''}`}
        >
          <span className="material-symbols-outlined text-[15px] flex-shrink-0">folder</span>
          {!folderSidebarCollapsed && (
            <>
              <span className="truncate flex-1">{f.name}</span>
              <span className={`flex-shrink-0 ${videoFilterFolderId === f.id ? 'text-slate-950/60' : 'text-slate-500'}`}>({f.video_count})</span>
            </>
          )}
        </button>

        {/* Folder actions (rename/delete) — shown on hover, or always when its menu is open */}
        {!folderSidebarCollapsed && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpenFolderMenuId(id => id === f.id ? null : f.id); }}
            className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-md transition-opacity ${
              openFolderMenuId === f.id ? 'opacity-100' : 'opacity-0 group-hover/folder:opacity-100'
            } ${videoFilterFolderId === f.id ? 'text-slate-950/70 hover:bg-slate-950/10' : 'text-slate-400 hover:text-white hover:bg-[var(--bg-dropdown)]'}`}
          >
            <span className="material-symbols-outlined text-[15px]">more_vert</span>
          </button>
        )}
        {openFolderMenuId === f.id && (
          <div className="absolute right-1 top-full mt-1 w-36 bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-20 py-1 text-left">
            <button
              onClick={(e) => { e.stopPropagation(); setOpenFolderMenuId(null); setRenamingFolder(f); setRenameFolderValue(f.name); }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium"
            >
              <span className="material-symbols-outlined text-[15px] text-[#00c2ff]">edit</span> Renommer
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteFolder(f); }}
              className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/50 flex items-center gap-2 font-medium"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span> Supprimer
            </button>
          </div>
        )}

        {folders.some(sub => sub.parent_id === f.id) && renderFolderTree(f.id, depth + 1)}
      </div>
    ))
  );

  const fetchFolders = async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`${API_BASE}/folders`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      setFolders(await res.json());
    } catch (e) {
      console.error("Erreur chargement des dossiers:", e);
    }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      const res = await authFetch(`${API_BASE}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: currentFolderId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec de création');
      setNewFolderName('');
      setShowNewFolderModal(false);
      fetchFolders();
    } catch (e) {
      console.error("Erreur création dossier:", e);
      alert("Impossible de créer le dossier : " + e.message);
    } finally {
      setCreatingFolder(false);
    }
  };

  const moveFolderInto = async (folderId, parentId) => {
    try {
      const res = await authFetch(`${API_BASE}/folders/${folderId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: parentId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec du déplacement');
      fetchFolders();
    } catch (e) {
      console.error("Erreur déplacement dossier:", e);
      alert("Impossible de déplacer le dossier : " + e.message);
    }
  };

  const submitRenameFolder = async () => {
    if (!renamingFolder) return;
    const name = renameFolderValue.trim();
    if (!name) return;
    setRenamingFolderBusy(true);
    try {
      const res = await authFetch(`${API_BASE}/folders/${renamingFolder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec du renommage');
      setRenamingFolder(null);
      fetchFolders();
      showToast('Dossier renommé.', 'success');
    } catch (e) {
      showToast('Impossible de renommer le dossier : ' + e.message, 'error');
    } finally {
      setRenamingFolderBusy(false);
    }
  };

  const deleteFolder = async (folder) => {
    setOpenFolderMenuId(null);
    const ok = await askConfirm(
      `Supprimer le dossier "${folder.name}" ? Les vidéos qu'il contient ne seront pas supprimées — elles reviendront simplement en dehors de tout dossier.`,
      { title: 'Supprimer le dossier', danger: true }
    );
    if (!ok) return;
    try {
      const res = await authFetch(`${API_BASE}/folders/${folder.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec de la suppression');
      if (currentFolderId === folder.id) openFolder(null);
      fetchFolders();
      showToast('Dossier supprimé.', 'success');
    } catch (e) {
      showToast('Impossible de supprimer le dossier : ' + e.message, 'error');
    }
  };

  const moveVideoToFolder = async (videoId, folderId) => {
    setMovingVideoId(null);
    setOpenVideoMenuId(null);
    try {
      const res = await authFetch(`${API_BASE}/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folderId ? { folder_id: folderId } : { clear_folder: true }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec du déplacement');
      fetchAllVideos();
      fetchFolders();
    } catch (e) {
      console.error("Erreur déplacement vidéo:", e);
      alert("Impossible de déplacer la vidéo : " + e.message);
    }
  };

  const fetchChannelVideos = async (channelId) => {
    try {
      const res = await authFetch(`${API_BASE}/videos/channel/${channelId}`);
      if (res.ok) {
        const data = await res.json();
        setChannelVideos(data);
      }
    } catch (e) {
      console.error("API error loading channel videos:", e);
    }
  };

  // URL <-> app-state routing. The app keeps its existing `view`/`activeChannel`/
  // `wizardMode` state machine; these two effects just keep the browser URL in
  // sync with it (state -> URL) and rebuild state from the URL on load, refresh,
  // or back/forward navigation (URL -> state).
  const findChannelBySlug = (slug) => channels.find((c) => slugifyChannelName(c.name) === slug);
  const editingChannel = editingChannelId ? channels.find((c) => c.id === editingChannelId) : null;
  const urlHydratedRef = useRef(false);

  const pathForState = () => {
    switch (view) {
      case 'channels': return '/channels';
      case 'videos': return '/videos';
      case 'channel_detail': return activeChannel ? `/channels/${slugifyChannelName(activeChannel.name)}` : '/channels';
      case 'wizard': return wizardMode === 'edit' && editingChannel ? `/channels/${slugifyChannelName(editingChannel.name)}/edit` : '/channels/new';
      case 'settings': return '/settings';
      case 'admin': return `/admin/${adminTab}`;
      case 'home':
      default: return '/dashboard';
    }
  };

  // state -> URL
  useEffect(() => {
    if (showAuthModal || AUTH_PATHS.has(location.pathname)) return; // auth routes own their URL
    // On first mount, `view`/`wizardMode`/`editingChannelId` still hold their bare
    // useState defaults for one render — before the URL -> state effect below has
    // run even once to hydrate them from the actual URL. Firing this effect in
    // that gap would compute a URL from those defaults (e.g. bounce a direct hit
    // on /channels/:slug/edit to /channels/new) and clobber the real URL before
    // it's ever read. So do nothing here until hydration has happened at least once.
    if (!urlHydratedRef.current) return;
    // On a hard refresh of /channels/:slug(/edit), activeChannel/editingChannel resolve to
    // null until the URL -> state effect below finds them in `channels`. Don't bounce the
    // URL away in that gap — let that effect stay authoritative for hydrating these routes.
    if (view === 'channel_detail' && !activeChannel) return;
    if (view === 'wizard' && wizardMode === 'edit' && editingChannelId && !editingChannel) return;
    const target = pathForState();
    if (location.pathname !== target) navigate(target);
  }, [view, activeChannel, wizardMode, editingChannelId, showAuthModal, adminTab]);

  // URL -> state (initial load, refresh, direct link, back/forward)
  useEffect(() => {
    urlHydratedRef.current = true;
    const path = location.pathname;
    if (path === '/login') { setShowAuthModal(true); setAuthTab('login'); return; }
    if (path === '/signup' || path === '/signin') { setShowAuthModal(true); setAuthTab('register'); return; }
    if (path === '/channels') { setView('channels'); return; }
    if (path === '/videos') { setView('videos'); return; }
    if (path === '/settings') { setView('settings'); return; }
    if (path === '/admin' || path.startsWith('/admin/')) { setView('admin'); setAdminTab(adminTabFromPath(path)); return; }
    if (path === '/billing/success') {
      const params = new URLSearchParams(location.search);
      setBillingVerifyOrderId(params.get('order_id'));
      setView('settings');
      setSettingsTab('billing');
      return;
    }
    if (path === '/verify-email') {
      const token = new URLSearchParams(location.search).get('token');
      if (token) {
        fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, { method: 'POST' })
          .then(res => res.json().then(data => ({ ok: res.ok, data })))
          .then(({ ok, data }) => {
            showToast(ok ? "Adresse email confirmée !" : (data.detail || "Lien de vérification invalide."), ok ? "success" : "error");
          })
          .catch(() => showToast("Erreur réseau pendant la vérification.", "error"));
      }
      navigate(currentUser ? '/settings' : '/login');
      return;
    }
    if (path === '/channels/new') {
      // Guard against re-running on every `channels` refetch — only (re)reset the
      // form the first time we land here, not on every poll while the user is
      // actively filling it in.
      if (wizardMode !== 'create' || view !== 'wizard') openCreateWizard();
      return;
    }
    const editMatch = path.match(/^\/channels\/([^/]+)\/edit$/);
    if (editMatch) {
      const chan = findChannelBySlug(editMatch[1]);
      if (chan) {
        // Same guard: only (re)populate the wizard the first time we land on this
        // channel's edit URL, not on every `channels` refetch — otherwise every
        // background poll would silently wipe whatever the user is mid-editing.
        if (editingChannelId !== chan.id || view !== 'wizard') {
          openEditWizard(chan, null, loadWizardStep(chan.id) || 1);
        } else {
          setActiveChannel(chan);
        }
      } else if (channelsLoaded) {
        navigate('/channels'); // unknown slug once channels are known
      }
      return;
    }
    const detailMatch = path.match(/^\/channels\/([^/]+)$/);
    if (detailMatch) {
      const chan = findChannelBySlug(detailMatch[1]);
      if (chan) {
        if (!activeChannel || activeChannel.id !== chan.id) {
          setActiveChannel(chan);
          fetchChannelVideos(chan.id);
        }
        setView('channel_detail');
      } else if (channelsLoaded) {
        navigate('/channels'); // unknown slug once channels are known
      }
      return;
    }
    setView('home');
  }, [location.pathname, channels]);

  // Persist the current page/tab so a refresh (or the polling re-render below)
  // doesn't bounce the user back to Home.
  useEffect(() => {
    sessionStorage.setItem('nichecut_view', view);
  }, [view]);

  useEffect(() => {
    if (activeChannel) {
      sessionStorage.setItem('nichecut_active_channel_id', activeChannel.id);
    }
  }, [activeChannel]);

  // Local image library auto-sync: checks whether a folder handle was
  // remembered for this channel (File System Access API), and if the browser
  // still has standing "read" permission for it (no prompt needed), silently
  // re-reads and re-uploads it every 4h while this tab stays open. This can't
  // run when the tab/browser is closed — no website can sync a local folder
  // in the true background, browsers block that for privacy reasons.
  useEffect(() => {
    if (view !== 'channel_detail' || !activeChannel) {
      setLibrarySyncHasHandle(false);
      return;
    }
    let cancelled = false;
    getFolderHandle(activeChannel.id).then((handle) => {
      if (!cancelled) setLibrarySyncHasHandle(!!handle);
    });
    const AUTO_SYNC_MS = 4 * 60 * 60 * 1000;
    const interval = setInterval(() => {
      refreshFromRememberedFolder(activeChannel.id, { silent: true }).then((ok) => {
        if (ok) setLibrarySyncTick(t => t + 1);
      });
    }, AUTO_SYNC_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [view, activeChannel]);

  useEffect(() => {
    fetchNicheOptions();
  }, []);

  useEffect(() => {
    // No dashboard data — not even a fetch attempt — until the visitor is signed
    // in. Anonymous access to the dashboard used to leak every user's channels.
    if (!currentUser) return;
    fetchChannels();
    fetchAllVideos();
    fetchFolders();
    // Was 6s — that's 3 requests/6s sustained for as long as any tab stays
    // open, and it multiplies with every extra KappGen tab a creator has
    // open at once. At that rate it's plausible to eventually trip
    // Cloudflare's rate-limiting/bot-protection on the API's edge, which
    // fails at the connection level (shows up in the browser as a plain
    // "Failed to fetch", no readable HTTP error) rather than a clean 429.
    // 15s keeps the UI reasonably live without hammering the API this hard.
    const interval = setInterval(() => {
      fetchChannels();
      fetchAllVideos();
      if (activeChannel) {
        fetchChannelVideos(activeChannel.id);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [activeChannel, currentUser?.id]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const endpoint = authTab === 'register' ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(authForm)
      });
      if (res.ok) {
        const data = await res.json();
        storeAuthSession(data.user);
        setShowAuthModal(false);
      } else {
        const err = await res.json();
        showToast(err.detail || "Erreur d'authentification.", "error");
      }
    } catch (err) {
      showToast("Erreur réseau: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const requestingCode = forgotStep === 'request';
      const res = await authFetch(`${API_BASE}/auth/${requestingCode ? 'forgot-password' : 'reset-password'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestingCode
          ? { email: forgotForm.email }
          : { email: forgotForm.email, code: resetCode, new_password: forgotForm.newPassword })
      });
      if (res.ok) {
        if (requestingCode) {
          setForgotStep('verify');
          showToast("Si ce compte existe, un code vient d'être envoyé par email.", "success");
        } else {
          showToast("Mot de passe réinitialisé. Connecte-toi avec le nouveau.", "success");
          setAuthForm({ email: forgotForm.email, password: '' });
          setForgotForm({ email: '', newPassword: '' });
          setResetCode('');
          setForgotStep('request');
          setAuthTab('login');
        }
      } else {
        const err = await res.json();
        showToast(err.detail || "Erreur lors de la réinitialisation.", "error");
      }
    } catch (err) {
      showToast("Erreur réseau: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (response) => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      if (res.ok) {
        const data = await res.json();
        storeAuthSession(data.user);
        setShowAuthModal(false);
        showToast(`Bienvenue, ${data.user.name} !`, "success");
      } else {
        const err = await res.json();
        showToast(err.detail || "Erreur de connexion Google.", "error");
      }
    } catch (err) {
      showToast("Erreur réseau: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const googleButtonRef = useRef(null);

  // Renders Google's own hosted sign-in button instead of driving the One Tap
  // prompt() flow — prompt() fails silently (no visible error, button just
  // "does nothing") once a user has dismissed it once or has 3P cookies
  // restricted, which is exactly the symptom reported in production.
  useEffect(() => {
    if (!showAuthModal || authTab === 'forgot' || !GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    let attempts = 0;

    const tryRender = () => {
      if (cancelled) return;
      const ready = window.google && window.google.accounts && window.google.accounts.id;
      // The GSI script tag is `async defer` — it's very likely not loaded yet
      // the first time this runs (e.g. right on app mount, since sign-in is
      // now mandatory). Previously this just gave up silently, so the button
      // either never appeared or — once Google's own lazy init eventually
      // kicked in on its own — rendered at its unconstrained default width,
      // overflowing the modal on narrow screens.
      if (!ready) {
        if (attempts++ < 25) setTimeout(tryRender, 200);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      if (!googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = "";
      // Google's renderButton `width` is a fixed pixel value, not responsive —
      // measure the actual container instead of hardcoding one. A few px of
      // margin guards against Google's own iframe still slightly overshooting
      // the requested width for longer locale text (French labels run longer
      // than English) — the wrapper's overflow-hidden below is the hard clamp
      // either way.
      const measured = Math.floor(googleButtonRef.current.getBoundingClientRect().width);
      const containerWidth = Math.max(200, Math.min(400, (measured || 300) - 4));
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "filled_blue",
        size: "large",
        width: containerWidth,
        text: "continue_with",
        locale: "fr",
      });
    };

    tryRender();
    return () => { cancelled = true; };
  }, [showAuthModal, authTab]);

  // Close the profile dropdown on any click outside it — a document-level
  // listener instead of a full-screen "catcher" overlay, so it isn't at the
  // mercy of z-index/stacking-context quirks elsewhere on the page (the
  // overlay approach was silently losing outside clicks to other stacked
  // elements, only closing when the avatar itself was clicked again).
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("nichecut_user");
    localStorage.removeItem("nichecut_token"); // cleanup for sessions created before the httpOnly-cookie migration
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    sessionStorage.removeItem('nichecut_view');
    sessionStorage.removeItem('nichecut_active_channel_id');
    setActiveChannel(null);
    setWizardMode('create');
    setEditingChannelId(null);
    setView('home');
    setAuthTab('login');
    setShowAuthModal(true);
  };

  // Sessions saved before the httpOnly-cookie migration may have a
  // currentUser but no valid cookie yet (old token was only in localStorage,
  // now removed) — authFetch's 401 interceptor above already bounces those
  // back to the login screen the moment any authenticated call is made, so
  // no separate check is needed here.

  useEffect(() => {
    if (view === 'settings' && currentUser) {
      setProfileForm({ name: currentUser.name || '', phone: currentUser.phone || '', locale: currentUser.locale || 'fr' });
      setSettingsTab('profile');
      setJustCreatedApiKey(null);
      fetchApiKeys();
      fetchIzivoiceConnection();
    }
  }, [view, currentUser]);

  const fetchApiKeys = async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`${API_BASE}/api-keys`);
      if (res.ok) setApiKeys(await res.json());
    } catch (e) {
      console.error("Erreur chargement clés API:", e);
    }
  };

  const fetchIzivoiceConnection = async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`${API_BASE}/channels/izivoice/status?user_id=${encodeURIComponent(currentUser.id)}`);
      if (res.ok) setIzivoiceConnection(await res.json());
    } catch (e) {
      console.error('Erreur statut Izivoice:', e);
    }
  };

  const handleConnectIzivoice = async (e) => {
    e.preventDefault();
    if (!izivoiceApiKey.trim()) return;
    setIzivoiceConnecting(true);
    try {
      const res = await authFetch(`${API_BASE}/channels/izivoice/connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, api_key: izivoiceApiKey.trim() })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Connexion Izivoice impossible.');
      setIzivoiceConnection(body);
      setIzivoiceApiKey('');
      showToast('Compte Izivoice synchronisé avec KappGen.', 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setIzivoiceConnecting(false); }
  };

  const handleDisconnectIzivoice = async () => {
    const ok = await askConfirm("KappGen repassera sur son moteur vocal par défaut. Tes vidéos et tes chaînes restent intactes.", { title: 'Déconnecter Izivoice ?' });
    if (!ok) return;
    const res = await authFetch(`${API_BASE}/channels/izivoice/connect?user_id=${encodeURIComponent(currentUser.id)}`, { method: 'DELETE' });
    if (res.ok) {
      setIzivoiceConnection(await res.json());
      setAvailableVoices(VOICE_MODELS);
      showToast('Izivoice déconnecté. Le moteur KappGen prend le relais.', 'success');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/auth/me/${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileForm.name, phone: profileForm.phone, locale: profileForm.locale })
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentUser(updated);
        localStorage.setItem("nichecut_user", JSON.stringify(updated));
        showToast("Profil mis à jour.", "success");
      } else {
        const err = await res.json();
        showToast(err.detail || "Erreur lors de la mise à jour.", "error");
      }
    } catch (err) {
      showToast("Erreur réseau: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSettings = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          old_password: passwordForm.oldPassword,
          new_password: passwordForm.newPassword
        })
      });
      if (res.ok) {
        showToast("Mot de passe modifié.", "success");
        setPasswordForm({ oldPassword: '', newPassword: '' });
      } else {
        const err = await res.json();
        showToast(err.detail || "Erreur lors du changement.", "error");
      }
    } catch (err) {
      showToast("Erreur réseau: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newApiKeyName.trim() || 'Clé API' })
      });
      if (res.ok) {
        const created = await res.json();
        setJustCreatedApiKey(created);
        setNewApiKeyName('');
        fetchApiKeys();
      } else {
        const err = await res.json();
        showToast(err.detail || "Erreur lors de la création.", "error");
      }
    } catch (err) {
      showToast("Erreur réseau: " + err.message, "error");
    }
  };

  const handleRevokeApiKey = async (keyId) => {
    const ok = await askConfirm("Toute application qui l'utilise perdra l'accès immédiatement.", { title: "Révoquer cette clé API ?", danger: true });
    if (!ok) return;
    try {
      await authFetch(`${API_BASE}/api-keys/${keyId}`, { method: 'DELETE' });
      fetchApiKeys();
      showToast("Clé API révoquée.", "success");
    } catch (err) {
      showToast("Erreur réseau: " + err.message, "error");
    }
  };

  const resetWizardState = () => {
    setNewChannel(defaultChannelForm);
    setNicheMode('preset');
    setWizardMode('create');
    setEditingChannelId(null);
    setLogoFile(null);
    setLogoPreviewUrl(null);
    setLocalImageFiles([]);
    setMusicFiles([]);
    setLibraryUploadStatus(null);
    setLibraryUploadProgress(0);
    setLibraryUploadMessage('');
    setStagedLibraryToken(null);
    if (libraryUploadXhrRef.current) libraryUploadXhrRef.current.abort();
    setWizardStep(1);
  };

  // Draft persistence — configured settings (music mode/volume, subtitle style,
  // effects, niche, etc.) survive navigating away from the wizard and back within
  // the same browser session, so an accidental step-away doesn't lose unsaved
  // work. Cleared once the channel is actually saved. Can't cover raw files
  // (a not-yet-uploaded logo/music/image picked in this session) — those really
  // are gone if the wizard unmounts, since a File object can't survive that.
  const draftKey = (id) => `nichecut_draft_${id || 'new'}`;
  // Root cause of a channel's settings silently reverting to old values
  // (e.g. Next Age Health Fr's image style repeatedly regressing to a
  // retired default): this draft is auto-saved on every keystroke while
  // the wizard is open and restored UNCONDITIONALLY the next time it's
  // opened, with no staleness check — a browser tab left open across a
  // session (sessionStorage survives page reloads, just not a closed tab)
  // silently resurrected a draft captured before a later fix, overwriting
  // the correct data freshly fetched from the server on every reopen, and
  // re-persisting the stale values the moment it was saved again. A draft
  // is only ever meant to recover an accidental navigate-away moments ago,
  // not to outlive the tab indefinitely — so it now expires.
  const DRAFT_MAX_AGE_MS = 30 * 60 * 1000;
  const loadDraft = (id) => {
    try {
      const raw = sessionStorage.getItem(draftKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !('savedAt' in parsed)) return null;
      if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
        sessionStorage.removeItem(draftKey(id));
        return null;
      }
      return parsed.data;
    } catch { return null; }
  };
  const clearDraft = (id) => { try { sessionStorage.removeItem(draftKey(id)); } catch {} };

  useEffect(() => {
    if (view !== 'wizard') return;
    try { sessionStorage.setItem(draftKey(editingChannelId), JSON.stringify({ data: newChannel, savedAt: Date.now() })); } catch {}
  }, [newChannel, view, editingChannelId]);

  // Same idea as the draft above, but for which step the creator was on — so a
  // hard refresh on e.g. the Publication step (8) lands back there instead of
  // bouncing to Identité (1). Keyed by channel id (or 'new' pre-save).
  const wizardStepKey = (id) => `nichecut_wizard_step_${id || 'new'}`;
  const loadWizardStep = (id) => {
    try {
      const raw = sessionStorage.getItem(wizardStepKey(id));
      const n = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(n) && n >= 1 && n <= 9 ? n : null;
    } catch { return null; }
  };
  useEffect(() => {
    if (view !== 'wizard') return;
    try { sessionStorage.setItem(wizardStepKey(editingChannelId), String(wizardStep)); } catch {}
  }, [wizardStep, view, editingChannelId]);

  const openCreateWizard = (contentType = 'narration') => {
    setWizardContentType(contentType);
    resetWizardState();
    if (contentType === 'narration') {
      const draft = loadDraft(null);
      if (draft) setNewChannel(draft);
    }
    setView('wizard');
  };

  // Mode automatique = zéro intervention : le créateur ne doit jamais voir le
  // formulaire manuel (script/voix) pour une chaîne "auto" — un clic sur
  // "Nouvelle vidéo" déclenche directement la génération par l'Agent, comme
  // le ferait le pipeline quotidien, et affiche juste l'attente du rendu.
  const startNewVideoFor = async (channel) => {
    // Music channels have no per-video form either — everything needed
    // (style, titles, montage) was already set once at channel creation.
    if (channel.content_type !== 'music' && channel.automation_mode !== 'auto') {
      setActiveChannel(channel);
      setShowSubmitModal(true);
      return;
    }
    setActiveChannel(channel);
    setGeneratingAutoVideo(true);

    // generate-now returns instantly (the actual generation runs in a
    // background thread server-side, taking a minute or two) — without an
    // immediate placeholder, a creator saw nothing happen for that whole
    // stretch, assumed the click didn't register, and clicked again (and
    // again), firing 2-3 real generations for one intended video. This
    // reuses the exact same "rendering" card UI a real queued video already
    // gets (PipelineStepper), just with a client-only id, so it's visually
    // indistinguishable from the real thing the moment it exists.
    const placeholderId = `pending-${channel.id}-${Date.now()}`;
    const placeholder = {
      id: placeholderId,
      channel_id: channel.id,
      title: null,
      status: 'rendering',
      progress_stage: 'Lancement de la génération…',
      progress_percent: 1,
      created_at: new Date().toISOString(),
      folder_id: null,
      _pending: true,
    };
    const countBefore = allVideos.filter(v => v.channel_id === channel.id && !v._pending).length;
    setAllVideos(prev => [placeholder, ...prev]);
    setChannelVideos(prev => [placeholder, ...prev]);

    const stopPending = () => {
      setAllVideos(prev => prev.filter(v => v.id !== placeholderId));
      setChannelVideos(prev => prev.filter(v => v.id !== placeholderId));
      setGeneratingAutoVideo(false);
    };

    try {
      const res = await authFetch(`${API_BASE}/channels/${channel.id}/generate-now`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Erreur lors du lancement.", "error");
        stopPending();
        return;
      }
      showToast("C’est lancé. Tu peux quitter cet écran, KappGen reste au travail.", "success");
      fetchChannels();

      // Poll for the real video to actually show up instead of the one-shot
      // refresh that used to run here (nothing new exists yet at that point,
      // since generation hasn't finished) — every 5s for up to 3min, which
      // comfortably covers a multi-part script write. The video row now
      // appears within a second or two of the click (topic/script writing
      // are tracked stages themselves), so this poll usually finds it on
      // the very first tick.
      //
      // Once found, its LIVE fields are merged into the placeholder IN
      // PLACE (same client-only id) instead of swapping the card for the
      // real one outright — swapping changes the React key, which forces
      // an unmount/remount of the card (and replays its mount-in
      // animation), reading as a visible blank flash right as generation
      // was clearly progressing. The real id only takes over at the next
      // ordinary background refresh elsewhere in the app, by which point
      // there's no animation tied to that transition.
      let attempts = 0;
      const maxAttempts = 36;
      let matchedRealId = null;
      const poll = async () => {
        attempts += 1;
        const res2 = await authFetch(`${API_BASE}/videos/channel/${channel.id}`).catch(() => null);
        if (res2 && res2.ok) {
          const data = await res2.json();
          const real = matchedRealId
            ? data.find(v => v.id === matchedRealId)
            : data.find(v => v.channel_id === channel.id && !allVideos.some(existing => existing.id === v.id && !existing._pending));
          if (real) {
            matchedRealId = real.id;
            const merged = { ...real, id: placeholderId, _pending: true };
            setAllVideos(prev => prev.map(v => v.id === placeholderId ? merged : v));
            setChannelVideos(prev => prev.map(v => v.id === placeholderId ? merged : v));
            if (real.status === 'done' || real.status === 'failed') {
              fetchChannelVideos(channel.id);
              fetchAllVideos();
              stopPending();
              return;
            }
            setTimeout(poll, 5000);
            return;
          }
        }
        if (attempts >= maxAttempts) {
          stopPending();
          return;
        }
        setTimeout(poll, 5000);
      };
      setTimeout(poll, 5000);
    } catch (e) {
      showToast("Erreur réseau: " + e.message, "error");
      stopPending();
    }
  };

  // Defaults to every channel (Home's generic CTA) — the "Mes Vidéos" page
  // passes its own product-scoped list so a music-channel context never
  // offers to create/pick a narration channel or vice versa.
  const openNewVideoFlow = (channelList = channels, contentType = 'narration') => {
    if (channelList.length === 0) {
      openCreateWizard(contentType);
    } else if (channelList.length === 1) {
      startNewVideoFor(channelList[0]);
    } else {
      setShowChannelPickerModal(true);
    }
  };

  const openEditWizard = (channel, e, startStep = 1) => {
    if (e) e.stopPropagation();
    setOpenChannelMenuId(null);
    setWizardMode('edit');
    setEditingChannelId(channel.id);
    // Without this, wizardContentType kept whatever it was last set to (e.g.
    // 'music' from a previous "Vidéo Musicale" creation) — editing an
    // unrelated narration channel right after would wrongly render
    // MusicChannelWizard instead of the actual narration edit flow.
    setWizardContentType(channel.content_type === 'music' ? 'music' : 'narration');
    setNewChannel({
      // A connected channel's real identity lives on youtube_channel_title —
      // channel.name should already mirror it (set on connect / periodic sync),
      // but fall back here too so a channel that predates that sync doesn't
      // make the creator re-type a name YouTube already gave us.
      name: channel.name || channel.youtube_channel_title || '',
      description: channel.description || '',
      // Never falls back to a specific niche like the old default did — an
      // empty niche here should read as "unset, pick one" in the UI, not
      // silently masquerade as a real (wrong) choice a save could persist.
      niche: channel.niche || '',
      subtitle_style: { ...defaultChannelForm.subtitle_style, ...(channel.subtitle_style || {}) },
      branding: { ...defaultChannelForm.branding, ...(channel.branding || {}) },
      music_preference: { ...defaultChannelForm.music_preference, ...(channel.music_preference || {}) },
      image_style: { ...defaultChannelForm.image_style, ...(channel.image_style || {}) },
      thumbnail_style: channel.thumbnail_style || null,
      effects_config: {
        ...defaultChannelForm.effects_config,
        ...(channel.effects_config || {}),
        // Channels saved before overlay effects were multi-select only have the old
        // single-choice string — expand it into the new array the first time it's opened.
        overlay_effects: channel.effects_config?.overlay_effects || ({
          none: [], grain: ['grain'], white_noise: ['white_noise'],
          vignette: ['vignette'], grain_vignette: ['grain', 'vignette'],
        })[channel.effects_config?.overlay_effect || 'grain'] || ['grain'],
      },
      automation_mode: channel.automation_mode || 'manual',
      automation_style_prompt: channel.automation_style_prompt || '',
      topic_examples: channel.topic_examples || '',
      use_web_trends: !!channel.use_web_trends,
      videos_per_day: channel.videos_per_day ?? 1,
      automation_window_start_hour: channel.automation_window_start_hour ?? 7,
      automation_window_end_hour: channel.automation_window_end_hour ?? 11,
      active_days: channel.active_days || null,
      script_generation_hour: channel.script_generation_hour ?? -1,
      script_generation_minute: channel.script_generation_minute ?? 0,
      script_generation_second: channel.script_generation_second ?? 0,
      script_generation_days: channel.script_generation_days || null,
      timezone: channel.timezone || defaultChannelForm.timezone,
      publish_mode: channel.publish_mode || 'manual',
      publish_time_mode: channel.publish_time_mode || 'range',
      publish_schedule_hour: channel.publish_schedule_hour ?? 8,
      publish_schedule_day_offset: channel.publish_schedule_day_offset ?? 1,
      script_structure: channel.script_structure || defaultChannelForm.script_structure,
      voice_id: channel.voice_id || '',
      voice_name: channel.voice_name || '',
      voice_settings: channel.voice_settings || defaultChannelForm.voice_settings,
    });
    const draft = loadDraft(channel.id);
    if (draft) setNewChannel(draft);
    setNicheMode(nicheOptions.includes((draft || channel).niche) ? 'preset' : 'custom');
    setLogoFile(null);
    setMusicFiles([]);
    setLocalImageFiles([]);
    setSelectedFolderName('');
    setLibraryUploadStatus(null);
    setLibraryUploadProgress(0);
    setLibraryUploadMessage('');
    setStagedLibraryToken(null);
    setLogoPreviewUrl(channel.branding?.logo_path
      ? `${STORAGE_BASE}/${channel.branding.logo_path}`
      : (channel.youtube_channel_thumbnail_url || null));
    setWizardStep(startStep);
    setView('wizard');
  };

  const resizeImageFile = (file, maxDim = 512, quality = 0.9) => new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('resize failed'));
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('image load failed')); };
    img.src = objectUrl;
  });

  const handleLogoFileSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file after an error
    if (!file) return;
    // The original file is what gets uploaded and burned into the rendered video —
    // never downscaled. Only the on-screen preview thumbnail is resized, purely so a
    // huge photo doesn't stall the browser's blob decode.
    setLogoFile(file);
    let previewFile = file;
    if (file.size > 800 * 1024) {
      try {
        previewFile = await resizeImageFile(file);
      } catch {
        // Browser couldn't decode this image (e.g. an iPhone HEIC photo) — no preview,
        // but the original file is already staged above and will still upload fine.
      }
    }
    try {
      setLogoPreviewUrl(URL.createObjectURL(previewFile));
    } catch {
      setLogoPreviewUrl(null);
    }
  };

  // Cloudflare hard-caps a single proxied request body at 100MB — a real
  // photo folder (100+ images) blows past that in one shot and gets killed
  // with a 413 right as the browser finishes sending it. Split into batches
  // safely under that ceiling and upload them one after another instead.
  //
  // Kept well under that 100MB ceiling (not just under it) for a second
  // reason: Cloudflare's own proxy also has a ~100s idle/total timeout on a
  // single request, and an 80MB batch on a slow/mobile connection can
  // easily take longer than that to finish sending — the connection gets
  // cut mid-upload, surfacing as a plain "Erreur réseau" with no HTTP status
  // to explain it (seen in production: a creator's import stalled and died
  // this way partway through, even with the retry-on-network-error below,
  // because retrying the SAME oversized batch just hits the same timeout
  // again). A smaller batch finishes well inside that window even on a slow
  // connection, at the cost of a few more round-trips for a very large import.
  const LIBRARY_UPLOAD_BATCH_MAX_BYTES = 20 * 1024 * 1024;
  const LIBRARY_UPLOAD_BATCH_MAX_FILES = 25;

  const buildLibraryUploadBatches = (files) => {
    const batches = [];
    let current = [];
    let currentBytes = 0;
    for (const file of files) {
      if (current.length > 0 && (currentBytes + file.size > LIBRARY_UPLOAD_BATCH_MAX_BYTES || current.length >= LIBRARY_UPLOAD_BATCH_MAX_FILES)) {
        batches.push(current);
        current = [];
        currentBytes = 0;
      }
      current.push(file);
      currentBytes += file.size;
    }
    if (current.length) batches.push(current);
    return batches;
  };

  const uploadOneLibraryBatch = (batchFiles, { url, extraFields, onBatchProgress }) => {
    const formData = new FormData();
    batchFiles.forEach(file => formData.append('files', file));
    Object.entries(extraFields || {}).forEach(([k, v]) => { if (v != null) formData.append(k, v); });
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      libraryUploadXhrRef.current = xhr;
      xhr.open('POST', url);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onBatchProgress(event.loaded / event.total);
      };
      xhr.onerror = () => reject(new Error('Erreur réseau pendant l’importation des images.'));
      xhr.onabort = () => reject(new Error('Importation annulée.'));
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(data.detail || `Échec de l’importation (HTTP ${xhr.status}).`));
          return;
        }
        resolve(data);
      };
      xhr.send(formData);
    });
  };

  const uploadLibraryWithProgress = (files, folderName) => {
    if (libraryUploadXhrRef.current) libraryUploadXhrRef.current.abort();
    setLibraryUploadStatus('analyzing');
    setLibraryUploadProgress(2);
    setLibraryUploadMessage(`Analyse de ${files.length} images…`);
    setStagedLibraryToken(null);

    const isDirectUpload = wizardMode === 'edit' && editingChannelId;
    const batches = buildLibraryUploadBatches(files);
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
    let bytesDoneBeforeCurrentBatch = 0;

    const run = async () => {
      setLibraryUploadStatus('uploading');
      let stagingToken = null;
      let lastData = null;
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const url = isDirectUpload
          ? `${API_BASE}/channels/${editingChannelId}/library-images`
          : `${API_BASE}/channels/library-images/staging`;
        const extraFields = isDirectUpload
          ? { append: i > 0 ? 'true' : 'false', share_with_community: newChannel.image_style.share_with_community ? 'true' : 'false' }
          : (stagingToken ? { staging_token: stagingToken } : {});
        const batchBytes = batch.reduce((sum, f) => sum + f.size, 0);
        const onBatchProgress = (ratio) => {
          const doneBytes = bytesDoneBeforeCurrentBatch + ratio * batchBytes;
          const percent = Math.min(96, Math.round(5 + (doneBytes / totalBytes) * 91));
          setLibraryUploadProgress(percent);
          setLibraryUploadMessage(
            batches.length > 1
              ? `Importation (lot ${i + 1}/${batches.length}) : ${Math.round((doneBytes / totalBytes) * files.length).toLocaleString('fr-FR')} / ${files.length.toLocaleString('fr-FR')} images`
              : `Importation : ${Math.round(ratio * files.length).toLocaleString('fr-FR')} / ${files.length.toLocaleString('fr-FR')} images`
          );
        };
        // A transient network blip on any one batch used to abort the whole
        // import immediately — for a large folder split into many batches,
        // that meant losing everything already uploaded (e.g. 50% through
        // 234 images) over one brief hiccup, with no way to resume short of
        // starting over. Retries the SAME batch up to 3 times (a couple
        // seconds apart) before actually giving up; a real rejection from
        // the server (bad file, auth, etc.) still fails immediately since
        // only the network-error case is worth retrying.
        const MAX_BATCH_ATTEMPTS = 5;
        let attempt = 0;
        for (;;) {
          try {
            lastData = await uploadOneLibraryBatch(batch, { url, extraFields, onBatchProgress });
            break;
          } catch (err) {
            attempt += 1;
            const isNetworkError = /Erreur réseau/.test(err.message);
            if (!isNetworkError || attempt >= MAX_BATCH_ATTEMPTS) throw err;
            setLibraryUploadMessage(`Accroc réseau sur le lot ${i + 1}/${batches.length}, nouvelle tentative (${attempt}/${MAX_BATCH_ATTEMPTS})…`);
            // Backs off a bit longer each time — a connection that just had a
            // multi-second hiccup needs more than a flat 2s to actually
            // recover before the next (still sizeable) batch attempt.
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }
        bytesDoneBeforeCurrentBatch += batchBytes;
        if (!isDirectUpload) stagingToken = lastData.staging_token;
      }
      return lastData;
    };

    return run().then((data) => {
      setLibraryUploadStatus('validating');
      setLibraryUploadProgress(97);
      if (isDirectUpload) {
        setNewChannel(prev => ({ ...prev, image_style: { ...prev.image_style, ...(data.image_style || {}) } }));
      } else {
        setStagedLibraryToken(data.staging_token);
        setNewChannel(prev => ({
          ...prev,
          image_style: { ...prev.image_style, library_image_count: data.library_image_count || files.length }
        }));
      }
      setLibraryUploadStatus('success');
      setLibraryUploadProgress(100);
      setLibraryUploadMessage(`${data.library_image_count || files.length} images analysées, importées et prêtes.`);
      showToast(`${data.library_image_count || files.length} images importées à 100 %.`, 'success');
      return data;
    }).catch(error => {
      if (error.message === 'Importation annulée.') return;
      setLibraryUploadStatus('error');
      setLibraryUploadMessage(error.message);
      showToast(error.message, 'error');
      throw error;
    });
  };

  const markLibrarySynced = (channelKey) => {
    if (!channelKey) return;
    try { localStorage.setItem(`nichecut_last_sync_${channelKey}`, new Date().toISOString()); } catch {}
  };

  const prepareLocalImageFiles = (files, folderName, channelKeyForSync) => {
    setSelectedFolderName(folderName);
    setLocalImageFiles(files);
    uploadLibraryWithProgress(files, folderName)
      .then(() => markLibrarySynced(channelKeyForSync))
      .catch(() => {});
  };

  // File System Access API (Chrome/Edge): remembers the folder handle so a
  // later "Rafraîchir" can re-read it with one permission click instead of
  // reopening the OS folder picker. Falls back to the classic <input
  // webkitdirectory> picker on browsers that don't support it (Safari, Firefox).
  const pickFolderModern = async (channelKeyForSync) => {
    if (!window.showDirectoryPicker) return false;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      const files = await readImagesFromDirHandle(dirHandle);
      if (files.length === 0) {
        showToast("Aucune image trouvée dans ce dossier.", "error");
        return true;
      }
      if (channelKeyForSync) await saveFolderHandle(channelKeyForSync, dirHandle);
      prepareLocalImageFiles(files, dirHandle.name, channelKeyForSync);
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') return true; // user cancelled the picker — not an error
      return false; // unexpected failure — fall back to the classic picker
    }
  };

  const refreshFromRememberedFolder = async (channelKeyForSync, { silent = false } = {}) => {
    const handle = await getFolderHandle(channelKeyForSync);
    if (!handle) return false;
    try {
      let permission = await handle.queryPermission({ mode: 'read' });
      if (permission !== 'granted') {
        if (silent) return false; // never prompt during a silent background sync
        permission = await handle.requestPermission({ mode: 'read' });
      }
      if (permission !== 'granted') return false;
      const files = await readImagesFromDirHandle(handle);
      if (files.length === 0) {
        if (!silent) showToast("Le dossier semble vide maintenant.", "error");
        return false;
      }
      prepareLocalImageFiles(files, handle.name, channelKeyForSync);
      return true;
    } catch {
      return false;
    }
  };

  const handleLocalFolderSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => 
      LOCAL_IMAGE_EXTENSIONS_RE.test(f.name)
    );
    if (files.length > 0) {
      // Extract directory name from webkitRelativePath
      const firstPath = files[0].webkitRelativePath || '';
      const folderName = firstPath ? firstPath.split('/')[0] : 'Dossier Images';
      prepareLocalImageFiles(files, folderName);
    }
  };

  const handleFolderDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFolderDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      LOCAL_IMAGE_EXTENSIONS_RE.test(f.name)
    );

    if (droppedFiles.length > 0) {
      const folderName = "Dossier Images Déposé";
      prepareLocalImageFiles(droppedFiles, folderName);
    }
  };

  const uploadChannelLogo = async (channelId) => {
    if (!logoFile) return;
    const formData = new FormData();
    formData.append("file", logoFile);
    await authFetch(`${API_BASE}/channels/${channelId}/logo`, { method: 'POST', body: formData });
  };

  // Toggles a real, saved channel setting (used by the "Aperçu avant lancement"
  // recap) — optimistic local update + immediate PUT so it survives the launch
  // and any later edit, exactly like toggling the same setting in the pipeline.
  const toggleActiveChannelFlag = async (group, field) => {
    if (!activeChannel) return;
    const previous = activeChannel;
    const updatedGroup = { ...activeChannel[group], [field]: !activeChannel[group]?.[field] };
    setActiveChannel({ ...activeChannel, [group]: updatedGroup });
    try {
      const res = await authFetch(`${API_BASE}/channels/${activeChannel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [group]: updatedGroup })
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setActiveChannel(saved);
      setChannels(prev => prev.map(c => c.id === saved.id ? saved : c));
    } catch {
      showToast("Impossible d'enregistrer ce réglage.", "error");
      setActiveChannel(previous);
    }
  };

  const handleConnectYouTubeFromWizard = async () => {
    setConnectingYouTubeFromWizard(true);
    try {
      let channelId = wizardMode === 'edit' ? editingChannelId : null;
      if (!channelId) {
        // Not saved yet — create the channel now (defaults for everything not
        // yet configured, including the name — that's exactly what the real
        // YouTube channel name will overwrite once connected) so the OAuth
        // callback has a real id to attach to.
        const res = await authFetch(`${API_BASE}/channels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newChannel, name: newChannel.name.trim() || 'Nouvelle chaîne' }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail || "Impossible de créer la chaîne avant la connexion YouTube.");
        }
        const created = await res.json();
        channelId = created.id;
        setWizardMode('edit');
        setEditingChannelId(channelId);
        await fetchChannels();
      }
      const authRes = await authFetch(`${API_BASE}/channels/${channelId}/youtube/auth-url`);
      if (!authRes.ok) {
        const detail = await authRes.json().catch(() => ({}));
        throw new Error(detail.detail || "Connexion YouTube indisponible.");
      }
      const data = await authRes.json();
      // Google's OAuth consent screen needs a full page navigation, which
      // unmounts the whole app — on return, the app previously always landed
      // on the channel's detail page instead of back in the wizard, so the
      // name/description/logo that connecting just filled in server-side were
      // never visible until the creator manually reopened "Modifier". Leave a
      // breadcrumb so the return effect can reopen the wizard on this same step.
      try { sessionStorage.setItem('nichecut_return_to_wizard_step', String(wizardStep)); } catch {}
      // The draft autosave (see the effect below) just wrote this channel's
      // pre-connect state (blank name, no logo, etc.) to sessionStorage.
      // openEditWizard would normally replay that draft over whatever fresh
      // data comes back — clear it now so the real YouTube identity wins.
      clearDraft(channelId);
      window.location.href = data.auth_url;
    } catch (err) {
      showToast(err.message, 'error');
      setConnectingYouTubeFromWizard(false);
    }
  };

  const handleSaveChannel = async () => {
    if (!newChannel.name) return showToast("Veuillez saisir un nom de chaîne.", "error");
    const needsLibrary = resolveEnabledImageSources(newChannel.image_style).includes('library');
    const uploadReady = libraryUploadStatus === 'success';
    const hasStoredLibrary = Number(newChannel.image_style.library_image_count || 0) > 0
      && String(newChannel.image_style.library_path || '').startsWith('channels/');
    // A pipeline can be saved and finished later — it just won't be able to
    // render a video yet (blocked separately, at generation time) until the
    // voice and visuals are actually configured. Only an upload genuinely
    // mid-flight blocks saving, since there's nothing consistent to attach.
    if (needsLibrary && ['analyzing', 'uploading', 'validating'].includes(libraryUploadStatus)) {
      setWizardStep(5);
      return showToast("Attendez que l’importation des images atteigne 100 %, ou revenez plus tard pour terminer.", "error");
    }
    const savingIncomplete = needsLibrary && !hasStoredLibrary && !(uploadReady && stagedLibraryToken);
    try {
      setLoading(true);
      let saved;
      if (wizardMode === 'edit' && editingChannelId) {
        const res = await authFetch(`${API_BASE}/channels/${editingChannelId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newChannel)
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = "Erreur de mise à jour.";
          try { msg = JSON.parse(text).detail || msg; } catch {}
          throw new Error(msg);
        }
        saved = await res.json();
      } else {
        const res = await authFetch(`${API_BASE}/channels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newChannel)
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = "Erreur de création.";
          try { msg = JSON.parse(text).detail || msg; } catch {}
          throw new Error(msg);
        }
        saved = await res.json();
      }

      if (logoFile) {
        await uploadChannelLogo(saved.id);
      }
      if (musicFiles.length) {
        saved = await uploadChannelMusic(saved.id);
        setMusicFiles([]);
      }
      if (stagedLibraryToken && needsLibrary) {
        const attachForm = new FormData();
        attachForm.append('staging_token', stagedLibraryToken);
        attachForm.append('share_with_community', newChannel.image_style.share_with_community ? 'true' : 'false');
        const attachRes = await authFetch(`${API_BASE}/channels/${saved.id}/library-images/staging`, { method: 'POST', body: attachForm });
        if (!attachRes.ok) {
          const detail = await attachRes.json().catch(() => ({}));
          throw new Error(detail.detail || "Impossible de rattacher les images importées à la chaîne.");
        }
        saved = await attachRes.json();
      }

      await fetchChannels();
      fetchNicheOptions();
      setActiveChannel(saved);
      setView('channel_detail');
      fetchChannelVideos(saved.id);
      clearDraft(wizardMode === 'edit' ? editingChannelId : null);
      resetWizardState();
      if (savingIncomplete || !saved.is_render_ready) {
        showToast(`Chaîne enregistrée (${saved.completion_percent ?? 50}% configurée) — configure une source visuelle (Option A ou B) avant de générer une vidéo.`, 'success');
      } else {
        showToast('Chaîne enregistrée.', 'success');
      }
    } catch (e) {
      showToast("Erreur lors de l'enregistrement de la chaîne: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Once a channel is connected to YouTube, its real channel avatar replaces
  // whatever placeholder logo was set during setup — same idea as the name.
  // A logo the creator uploaded themselves always wins — it's an explicit
  // choice they made, so it must never be silently overridden by the
  // auto-filled YouTube avatar (that one only fills the gap when nothing
  // was chosen manually).
  // Same 4 corners the renderer actually composites at (assembler.py's
  // CORNER_OVERLAY_XY) — used by the Identité step's placement preview so
  // logo/overlay position in the mockup matches the real render exactly.
  const overlayCornerStyle = (corner) => {
    const margin = '6%';
    switch (corner) {
      case 'top-left': return { top: margin, left: margin };
      case 'bottom-left': return { bottom: margin, left: margin };
      case 'bottom-right': return { bottom: margin, right: margin };
      case 'top-right':
      default: return { top: margin, right: margin };
    }
  };

  // Direct placement: x_percent/y_percent map straight onto the frame (0 =
  // image's own top-left touches the frame's left/top edge, 100 = touches
  // the right/bottom edge minus the image's own size) — deliberately no
  // safety margin baked in here, so dragging the sliders all the way can
  // push the image flush to an edge or, past 0/100, partly off-frame, if
  // that's genuinely what's wanted. The margin only exists as the *starting
  // point* the 4 quick-position presets set (see PRESET_MARGIN_PERCENT
  // below) — once placed, free dragging isn't clamped back to it.
  const overlayPositionStyle = (xPercent, yPercent) => ({
    left: `${xPercent}%`,
    top: `${yPercent}%`,
  });

  const PRESET_MARGIN_PERCENT = 6;
  // The frame is 16:9 (wider than tall), so an image sized as X% of the
  // frame's WIDTH has a height — assuming a roughly square logo/sticker,
  // true for the reported bug case — equal to that many % of width in
  // pixels, which is a *larger* percentage of the frame's shorter HEIGHT.
  // Using sizePercent directly for the bottom margin under-reserved that
  // extra vertical room, so "bottom" presets clipped the image against the
  // frame's bottom edge instead of sitting cleanly inside it.
  const FRAME_ASPECT = 16 / 9;
  // The 4 quick-position buttons stay balanced/inset (never flush to an
  // edge) regardless of the image's current size, unlike free dragging.
  const presetXY = (id, sizePercent) => {
    const rightX = 100 - PRESET_MARGIN_PERCENT - sizePercent;
    const bottomY = 100 - PRESET_MARGIN_PERCENT - sizePercent * FRAME_ASPECT;
    switch (id) {
      case 'top-left': return { x: PRESET_MARGIN_PERCENT, y: PRESET_MARGIN_PERCENT };
      case 'top-right': return { x: rightX, y: PRESET_MARGIN_PERCENT };
      case 'bottom-left': return { x: PRESET_MARGIN_PERCENT, y: bottomY };
      case 'bottom-right': return { x: rightX, y: bottomY };
      default: return { x: rightX, y: PRESET_MARGIN_PERCENT };
    }
  };

  const shapeClipStyle = (shape) => {
    if (shape === 'circle') return { borderRadius: '50%' };
    if (shape === 'rounded') return { borderRadius: '18%' };
    return {};
  };

  const getChannelLogoUrl = (channel) => {
    if (channel?.branding?.logo_path) return getVideoUrl(channel.branding.logo_path);
    if (channel?.youtube_channel_thumbnail_url) return channel.youtube_channel_thumbnail_url;
    return "/assets/logo/logo-kappgen.png";
  };

  // Shared by the identity/branding steps of the wizard. This used to be
  // declared only inside the final recap step, while step 1 also referenced
  // it. Opening an existing channel on step 1 therefore threw a ReferenceError
  // and React unmounted the whole app, leaving only the page's black backdrop.
  const resolvedLogoUrl = logoPreviewUrl
    || (wizardMode === 'edit' && editingChannel && getChannelLogoUrl(editingChannel) !== "/assets/logo/logo-kappgen.png"
      ? getChannelLogoUrl(editingChannel)
      : null);

  const getChannelStatusInfo = (channel) => {
    const rendering = channel.rendering_count || 0;
    const queued = channel.queued_count || 0;
    const done = channel.done_count || 0;
    const failed = channel.failed_count || 0;
    if (channel.is_active === false) return { label: 'Désactivée', className: 'bg-slate-800/80 text-slate-400 border border-slate-600/60' };
    if (rendering > 0) return { label: 'KappGen travaille', className: 'bg-blue-950/80 text-blue-300 border border-blue-700/60 animate-pulse' };
    if (queued > 0) return { label: 'En file', className: 'bg-amber-950/80 text-amber-300 border border-amber-700/60' };
    if (done > 0) return { label: 'Prête', className: 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60' };
    if (failed > 0) return { label: 'Échec de rendu', className: 'bg-rose-950/80 text-rose-300 border border-rose-700/60' };
    return { label: 'Configurée', className: 'bg-slate-700/80 text-[#f1f5f9] border border-slate-600/60' };
  };

  // Compact dot-only version of the same status, overlaid on the channel avatar.
  // Kept strictly binary (green/red) rather than the multi-color badge above —
  // green = channel active and healthy (render-ready, nothing stuck failed),
  // red = needs attention (pipeline incomplete, or a video failed to render).
  const getChannelStatusDotColor = (channel) => {
    const failed = channel.failed_count || 0;
    if (channel.is_active === false || failed > 0 || !channel.is_render_ready) return 'bg-red-500';
    return 'bg-emerald-500';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('audio/') || f.type.startsWith('video/') || /\.(mp3|wav|m4a|mp4|aac|flac|ogg)$/i.test(f.name)
    );

    if (droppedFiles.length > 0) {
      setAudioFilesList(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleSubjectSubmit = async () => {
    if (!activeChannel) return showToast("Veuillez sélectionner une chaîne.", "error");

    const formData = new FormData();
    formData.append("channel_id", activeChannel.id);
    formData.append("input_type", submitMode === 'audio_upload' ? 'audio' : 'text');
    formData.append("voice_id", selectedVoice);

    if (submitMode === 'text') {
      if (!singleScriptText.trim()) return showToast("Veuillez saisir le texte de votre script.", "error");
      formData.append("script_text", singleScriptText.trim());
    } else if (submitMode === 'audio_upload') {
      if (audioFilesList.length === 0) return showToast("Veuillez glisser-déposer au moins un fichier audio.", "error");
      audioFilesList.forEach(file => {
        formData.append("audio_files", file);
      });
      formData.append("transcribe_audio", transcribeAudio ? "true" : "false");
    }

    try {
      setLoading(true);
      // Explicit timeout: without one, a stalled connection or an
      // unresponsive session left the button reading "Lancement..."
      // forever with no error ever shown — indistinguishable, from the
      // creator's side, from the click having done nothing at all.
      const res = await authFetch(`${API_BASE}/videos`, {
        method: 'POST',
        body: formData,
        timeoutMs: 30000,
      });
      if (res.ok) {
        setSingleScriptText('');
        setAudioFilesList([]);
        setShowSubmitModal(false);
        fetchChannelVideos(activeChannel.id);
        fetchChannels();
        fetchAllVideos();
        showToast("C’est lancé. Tu peux quitter cet écran, KappGen reste au travail.", "success");
      } else if (res.status === 401) {
        showToast("Ta session a expiré — reconnecte-toi puis relance la vidéo.", "error");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Erreur lors de l'envoi.", "error");
      }
    } catch (e) {
      showToast(
        e.name === 'AbortError'
          ? "La connexion au serveur a expiré. Vérifie ta connexion et réessaie."
          : "Erreur réseau: " + e.message,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // Admin dashboard state — all fetched/mutated via /api/admin/* (server-side
  // gated on is_admin; the client-side currentUser.is_admin check just hides
  // the nav entry, it isn't itself a security boundary).
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminPlans, setAdminPlans] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [adminGrantForm, setAdminGrantForm] = useState({ plan_id: '', duration_days: 30, note: '' });
  const [adminCreditForm, setAdminCreditForm] = useState({ amount: '', note: '' });
  const [adminCreditBusy, setAdminCreditBusy] = useState(false);
  const [adminGranting, setAdminGranting] = useState(false);
  const [adminActivity, setAdminActivity] = useState(null);
  const [adminVideos, setAdminVideos] = useState([]);
  const [adminVideosLoading, setAdminVideosLoading] = useState(false);
  const [adminLibraryFolders, setAdminLibraryFolders] = useState([]);
  const [adminLibraryLoading, setAdminLibraryLoading] = useState(false);
  const [adminLibraryNicheFilter, setAdminLibraryNicheFilter] = useState('');
  const [adminLibraryExpandedId, setAdminLibraryExpandedId] = useState(null);
  const [adminLibraryImages, setAdminLibraryImages] = useState([]);
  const [adminLibraryImageTotal, setAdminLibraryImageTotal] = useState(0);
  const [adminLibraryImagesHasMore, setAdminLibraryImagesHasMore] = useState(false);
  const [adminLibraryImagesLoadingMore, setAdminLibraryImagesLoadingMore] = useState(false);
  const [adminLibraryGridColumns, setAdminLibraryGridColumns] = useState(5);
  const [adminLibraryLightboxIndex, setAdminLibraryLightboxIndex] = useState(null);
  const [adminLibraryLightboxZoom, setAdminLibraryLightboxZoom] = useState(1);
  const [adminLibraryMoveFolder, setAdminLibraryMoveFolder] = useState(null);
  const [adminLibraryMoveNiche, setAdminLibraryMoveNiche] = useState('');
  const [adminLibraryMoveBusy, setAdminLibraryMoveBusy] = useState(false);
  const adminLibraryLoadMoreRef = useRef(null);
  // Full oversight view — every known niche always listed (even empty), every
  // user's channel library inside it regardless of whether they opted into
  // community sharing (see admin.py's /community-library/overview), plus a
  // server-wide image total. Separate from adminLibraryFolders above, which
  // only ever covered opted-in (CommunityLibraryFolder) rows.
  const [adminLibraryOverview, setAdminLibraryOverview] = useState({ total_images: 0, niches: [] });
  const [collapsedLibraryUsers, setCollapsedLibraryUsers] = useState({});
  // Drill-down navigation (niche -> user -> channel folders) instead of one
  // long list of nested expandable rows — a dense divider-heavy table read
  // as cluttered once there were 28 niches to show. 'grid' (cards, default)
  // or 'list' (compact rows) applies at whichever level is currently shown.
  const [adminLibraryViewMode, setAdminLibraryViewMode] = useState('grid');
  const [adminLibraryDrillNiche, setAdminLibraryDrillNiche] = useState(null);
  const [adminLibraryDrillUserKey, setAdminLibraryDrillUserKey] = useState(null);
  const [adminLibraryDrillFolder, setAdminLibraryDrillFolder] = useState(null);
  const [adminLibrarySelectedImages, setAdminLibrarySelectedImages] = useState([]);
  // Which niche sections are collapsed, by niche name — folders now
  // auto-accumulate for every channel (see _persist_generated_images_to_channel_library
  // in images.py), so a flat table would grow unwieldy fast; grouping by
  // niche first (niches expanded by default) is the "niche folder, channel
  // folders inside it" browsing structure this was actually meant to have.
  const [collapsedLibraryNiches, setCollapsedLibraryNiches] = useState({});
  const [adminVideoDetail, setAdminVideoDetail] = useState(null);
  const [adminVideoDetailLoading, setAdminVideoDetailLoading] = useState(false);
  const [adminVideoRetrying, setAdminVideoRetrying] = useState(false);
  const [adminVideoSearch, setAdminVideoSearch] = useState('');
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminOrdersLoading, setAdminOrdersLoading] = useState(false);
  const [adminCosts, setAdminCosts] = useState(null);
  const [adminCostsLoading, setAdminCostsLoading] = useState(false);
  const [adminCostsDays, setAdminCostsDays] = useState(30);
  const [adminProviders, setAdminProviders] = useState(null);
  const [thumbnailProviderMode, setThumbnailProviderModeState] = useState('free_only');
  const [thumbnailProviderModeSaving, setThumbnailProviderModeSaving] = useState(false);
  const [hfAccounts, setHfAccounts] = useState([]);
  const [hfAccountsLoading, setHfAccountsLoading] = useState(false);
  const [hfAccountForm, setHfAccountForm] = useState({ token: '', label: '' });
  const [hfAccountBusy, setHfAccountBusy] = useState(false);
  const [hfAccountChecking, setHfAccountChecking] = useState(null);
  const [editingHfLabelId, setEditingHfLabelId] = useState(null);
  const [editingHfLabelValue, setEditingHfLabelValue] = useState('');
  const [adminProvidersLoading, setAdminProvidersLoading] = useState(false);

  // Billing (subscription) tab, under Paramètres — public plan list + this
  // user's current subscription status + checkout kickoff.
  const [billingPlans, setBillingPlans] = useState([]);
  const [billingSubscription, setBillingSubscription] = useState(null);
  const [creditBalance, setCreditBalance] = useState(null);
  const [hasPurchasedCredits, setHasPurchasedCredits] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState(null);
  const [billingVerifyOrderId, setBillingVerifyOrderId] = useState(null);
  const [billingVerifyStatus, setBillingVerifyStatus] = useState(null); // null | 'pending' | 'success' | 'failed'

  // Live cost preview for the "Structure du script auto-généré" editor —
  // debounce-fetched from /api/billing/estimate-script-cost as the creator
  // adjusts length/parts, so they see what Automatique generation will
  // actually charge them before committing to a length (real Claude spend,
  // billed at SCRIPT_GENERATION_COST_MARKUP_MULTIPLIER — see billing.py).
  const [scriptCostEstimate, setScriptCostEstimate] = useState(null);
  const [scriptCostLoading, setScriptCostLoading] = useState(false);
  const scriptStructureParts = newChannel?.script_structure?.parts || defaultChannelForm.script_structure.parts || [];
  const scriptStructureTotalWords = scriptStructureParts.reduce((sum, p) => sum + (Number(p.word_count) || 0), 0);
  const scriptStructureNumParts = scriptStructureParts.length;

  useEffect(() => {
    if (!showScriptStructureModal || scriptStructureTotalWords <= 0) return;
    setScriptCostLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await authFetch(`${API_BASE}/billing/estimate-script-cost?total_words=${scriptStructureTotalWords}&num_parts=${scriptStructureNumParts}`);
        if (res.ok) setScriptCostEstimate(await res.json());
      } catch (err) {
        console.error("Erreur estimation coût script:", err);
      } finally {
        setScriptCostLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [showScriptStructureModal, scriptStructureTotalWords, scriptStructureNumParts]);

  // Landed back from Maketou/Tara Money's hosted checkout on /billing/success —
  // poll /api/billing/verify until it resolves (Maketou has no webhook, this
  // return-page call is its only confirmation path; Tara usually confirms via
  // its webhook first, but this also catches it if the webhook is slow).
  useEffect(() => {
    if (!billingVerifyOrderId || !currentUser) return;
    setBillingVerifyStatus('pending');
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const res = await authFetch(`${API_BASE}/billing/verify?order_id=${encodeURIComponent(billingVerifyOrderId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success') {
            setBillingVerifyStatus('success');
            fetchBillingData();
            return;
          }
        }
      } catch (err) {
        console.error("Erreur vérification paiement:", err);
      }
      if (attempts < 10) setTimeout(poll, 3000);
      else setBillingVerifyStatus('failed');
    };
    poll();
  }, [billingVerifyOrderId, currentUser?.id]);

  const fetchBillingData = async () => {
    setBillingLoading(true);
    try {
      const [plansRes, subRes, creditsRes] = await Promise.all([
        fetch(`${API_BASE}/billing/plans`),
        authFetch(`${API_BASE}/billing/subscription`),
        authFetch(`${API_BASE}/billing/credits`),
      ]);
      if (plansRes.ok) setBillingPlans(await plansRes.json());
      if (subRes.ok) setBillingSubscription(await subRes.json());
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        setCreditBalance(creditsData.balance);
        setHasPurchasedCredits(!!creditsData.has_purchased_credits);
      }
    } catch (err) {
      console.error("Erreur chargement abonnement:", err);
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) fetchBillingData();
  }, [currentUser?.id]);

  // rooseveltmkr@gmail.com is the KappGen owner account — exempt from every
  // paid-feature gate (subscription or credit-purchase based).
  const isSubscriptionExempt = currentUser?.email === 'rooseveltmkr@gmail.com';
  const hasActiveSubscription = isSubscriptionExempt || !!billingSubscription?.active;
  // Watermark removal specifically: a lifetime unlock once the creator has
  // ever paid for a credit pack — not tied to a currently-active
  // subscription, and free-trial creators (never having paid) never qualify.
  const canRemoveWatermark = isSubscriptionExempt || hasPurchasedCredits;
  // Generic "can this creator afford a paid AI generation right now" check —
  // images, thumbnails, AI music preview all cost real credits, so none of
  // them should even be selectable without enough balance to cover one call.
  const canAffordCredits = (amount) => isSubscriptionExempt || (creditBalance != null && creditBalance >= amount);
  const canGenerateAIImages = canAffordCredits(IMAGE_GENERATION_CREDITS);
  const canGenerateAIMusic = canAffordCredits(MUSIC_GENERATION_CREDITS);

  const startCheckout = async (planId, provider, billingCycle = 'monthly') => {
    setCheckoutPlanId(planId);
    try {
      const res = await authFetch(`${API_BASE}/billing/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, provider, billing_cycle: billingCycle }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec du paiement');
      const data = await res.json();
      window.location.href = data.redirect_url;
    } catch (err) {
      showToast(err.message, 'error');
      setCheckoutPlanId(null);
    }
  };

  const fetchAdminData = async () => {
    setAdminUsersLoading(true);
    try {
      const [usersRes, plansRes, statsRes, activityRes] = await Promise.all([
        authFetch(`${API_BASE}/admin/users${adminSearch ? `?q=${encodeURIComponent(adminSearch)}` : ''}`),
        authFetch(`${API_BASE}/admin/plans`),
        authFetch(`${API_BASE}/admin/stats`),
        authFetch(`${API_BASE}/admin/activity`),
      ]);
      if (usersRes.ok) setAdminUsers(await usersRes.json());
      if (plansRes.ok) setAdminPlans(await plansRes.json());
      if (statsRes.ok) setAdminStats(await statsRes.json());
      if (activityRes.ok) setAdminActivity(await activityRes.json());
    } catch (err) {
      console.error("Erreur chargement admin:", err);
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const fetchAdminVideos = async () => {
    setAdminVideosLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/videos${adminVideoSearch ? `?q=${encodeURIComponent(adminVideoSearch)}` : ''}`);
      if (res.ok) setAdminVideos(await res.json());
    } catch (err) {
      console.error("Erreur chargement vidéos admin:", err);
    } finally {
      setAdminVideosLoading(false);
    }
  };

  const fetchAdminLibraryOverview = async () => {
    setAdminLibraryLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/community-library/overview`);
      if (res.ok) setAdminLibraryOverview(await res.json());
    } catch (err) {
      console.error("Erreur chargement de l'aperçu de la bibliothèque:", err);
    } finally {
      setAdminLibraryLoading(false);
    }
  };

  const fetchAdminLibraryFolders = async () => {
    setAdminLibraryLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/community-library${adminLibraryNicheFilter ? `?niche=${encodeURIComponent(adminLibraryNicheFilter)}` : ''}`);
      if (res.ok) setAdminLibraryFolders(await res.json());
    } catch (err) {
      console.error("Erreur chargement bibliothèque collaborative:", err);
    } finally {
      setAdminLibraryLoading(false);
    }
  };

  // Keyed by channel_id (not the CommunityLibraryFolder id) so browsing and
  // deleting images works identically whether or not the channel's owner
  // opted into community sharing — the admin can inspect and curate any
  // channel's library, shared or not.
  const openAdminLibraryFolder = async (folder, nicheName) => {
    const channelId = folder.channel_id;
    setAdminLibraryExpandedId(channelId);
    setAdminLibraryDrillFolder({ ...folder, current_niche: nicheName });
    setAdminLibrarySelectedImages([]);
    setAdminLibraryImages([]);
    setAdminLibraryImageTotal(0);
    setAdminLibraryImagesHasMore(false);
    try {
      const res = await authFetch(`${API_BASE}/admin/channel-library/${channelId}/images?niche=${encodeURIComponent(nicheName)}&offset=0&limit=60`);
      if (res.ok) {
        const data = await res.json();
        setAdminLibraryImages(data.filenames || []);
        setAdminLibraryImageTotal(data.total || 0);
        setAdminLibraryImagesHasMore(!!data.has_more);
      }
    } catch (err) {
      console.error("Erreur chargement aperçu dossier:", err);
    }
  };

  const loadMoreAdminLibraryImages = async (channelId) => {
    if (adminLibraryImagesLoadingMore || !adminLibraryImagesHasMore) return;
    setAdminLibraryImagesLoadingMore(true);
    try {
      const nicheParam = adminLibraryDrillFolder?.current_niche ? `niche=${encodeURIComponent(adminLibraryDrillFolder.current_niche)}&` : '';
      const res = await authFetch(`${API_BASE}/admin/channel-library/${channelId}/images?${nicheParam}offset=${adminLibraryImages.length}&limit=60`);
      if (!res.ok) throw new Error("Chargement impossible.");
      const data = await res.json();
      setAdminLibraryImages(prev => [...prev, ...(data.filenames || [])]);
      setAdminLibraryImageTotal(data.total || 0);
      setAdminLibraryImagesHasMore(!!data.has_more);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAdminLibraryImagesLoadingMore(false);
    }
  };

  useEffect(() => {
    const sentinel = adminLibraryLoadMoreRef.current;
    if (!sentinel || !adminLibraryExpandedId || !adminLibraryImagesHasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) loadMoreAdminLibraryImages(adminLibraryExpandedId);
    }, { rootMargin: '500px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [adminLibraryExpandedId, adminLibraryImagesHasMore, adminLibraryImagesLoadingMore, adminLibraryImages.length]);

  const openAdminLibraryMove = (folder, currentNiche) => {
    if (adminLibrarySelectedImages.length === 0) return;
    setAdminLibraryMoveFolder({ ...folder, current_niche: currentNiche });
    setAdminLibraryMoveNiche(currentNiche || '');
  };

  const moveAdminLibraryFolder = async () => {
    if (!adminLibraryMoveFolder || !adminLibraryMoveNiche) return;
    setAdminLibraryMoveBusy(true);
    try {
      // Whole-folder merge (see mergeAdminLibraryFolder below, one-click
      // "Fusionner ce dossier avec…") hits a dedicated endpoint that reads
      // every file server-side — the per-image /niche route needs an
      // explicit filenames list, capped by whatever's currently loaded in
      // the grid (nowhere near enough for a folder of hundreds).
      const url = adminLibraryMoveFolder.wholeFolder
        ? `${API_BASE}/admin/channel-library/${adminLibraryMoveFolder.channel_id}/merge`
        : `${API_BASE}/admin/channel-library/${adminLibraryMoveFolder.channel_id}/niche`;
      const body = adminLibraryMoveFolder.wholeFolder
        ? { niche: adminLibraryMoveNiche }
        : { niche: adminLibraryMoveNiche, filenames: adminLibrarySelectedImages };
      const res = await authFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Déplacement impossible.");
      if (adminLibraryMoveFolder.wholeFolder) {
        const data = await res.json();
        setAdminLibraryMoveFolder(null);
        await fetchAdminLibraryOverview();
        showToast(`Dossier fusionné avec la niche « ${adminLibraryMoveNiche} » (${data.image_count} image${data.image_count > 1 ? 's' : ''}).`, 'success');
      } else {
        const movedCount = adminLibrarySelectedImages.length;
        setAdminLibraryImages(images => images.filter(name => !adminLibrarySelectedImages.includes(name)));
        setAdminLibraryImageTotal(total => Math.max(0, total - movedCount));
        setAdminLibrarySelectedImages([]);
        setAdminLibraryMoveFolder(null);
        await fetchAdminLibraryOverview();
        showToast(`${movedCount} image${movedCount > 1 ? 's ont' : ' a'} été classée${movedCount > 1 ? 's' : ''} dans ${adminLibraryMoveNiche}.`, 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAdminLibraryMoveBusy(false);
    }
  };

  // One-click folder-level shortcut for "Fusionner ce dossier avec…" — same
  // move mechanism/modal as the per-image "Déplacer vers…", just targeting
  // the whole folder server-side instead of a client-picked filename list.
  const mergeAdminLibraryFolder = (uf, currentNiche) => {
    setAdminLibraryMoveFolder({ channel_id: uf.channel_id, channel_name: uf.channel_name, current_niche: currentNiche, wholeFolder: true });
    setAdminLibraryMoveNiche(currentNiche || '');
  };

  useEffect(() => {
    if (adminLibraryLightboxIndex == null) return;
    const onKeyDown = event => {
      if (event.key === 'Escape') setAdminLibraryLightboxIndex(null);
      if (event.key === 'ArrowLeft') setAdminLibraryLightboxIndex(index => Math.max(0, index - 1));
      if (event.key === 'ArrowRight') setAdminLibraryLightboxIndex(index => Math.min(adminLibraryImages.length - 1, index + 1));
      if (event.key === '+' || event.key === '=') setAdminLibraryLightboxZoom(zoom => Math.min(3, zoom + 0.25));
      if (event.key === '-') setAdminLibraryLightboxZoom(zoom => Math.max(0.5, zoom - 0.25));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adminLibraryLightboxIndex, adminLibraryImages.length]);

  const setAdminLibraryFolderStatus = async (folder, status) => {
    try {
      const res = await authFetch(`${API_BASE}/admin/community-library/${folder.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Échec de la mise à jour.");
      fetchAdminLibraryOverview();
      showToast(status === 'approved' ? 'Dossier validé et ajouté à la bibliothèque de sa niche.' : status === 'flagged' ? 'Dossier signalé et exclu de la bibliothèque.' : 'Statut mis à jour.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Admin override, independent of the creator's own share_with_community
  // toggle — final say on what feeds a niche's shared pool stays with the
  // admin, the creator's setting is just the starting point. Doesn't touch
  // the channel's own flag (their Studio UI keeps showing their real choice).
  const forceShareChannelLibrary = async (channelId, status = 'approved') => {
    try {
      const res = await authFetch(`${API_BASE}/admin/channel-library/${channelId}/force-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Échec du partage forcé.");
      fetchAdminLibraryOverview();
      showToast('Dossier partagé avec la communauté (décision admin).', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const unshareChannelLibrary = async (channelId) => {
    try {
      const res = await authFetch(`${API_BASE}/admin/channel-library/${channelId}/unshare`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Échec du retrait.");
      fetchAdminLibraryOverview();
      showToast('Dossier retiré de la bibliothèque partagée.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Removes one specific image an admin judges unfit for the niche/community
  // — most images from an auto-shared channel are fine, so the fix for one
  // bad one is deleting just that one, not flagging the channel's whole folder.
  const deleteAdminLibraryImage = async (channelId, filename) => {
    try {
      const res = await authFetch(`${API_BASE}/admin/channel-library/${channelId}/images/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Suppression impossible.");
      setAdminLibraryImages(prev => prev.filter(name => name !== filename));
      setAdminLibrarySelectedImages(prev => prev.filter(name => name !== filename));
      setAdminLibraryImageTotal(total => Math.max(0, total - 1));
      fetchAdminLibraryOverview();
      showToast('Image supprimée.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openAdminVideoDetail = async (videoId) => {
    setAdminVideoDetail({ id: videoId });
    setAdminVideoDetailLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/videos/${videoId}`);
      if (res.ok) setAdminVideoDetail(await res.json());
      else setAdminVideoDetail(null);
    } catch (err) {
      console.error("Erreur chargement détail vidéo admin:", err);
      setAdminVideoDetail(null);
    } finally {
      setAdminVideoDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!adminVideoDetail?.id || !['queued', 'rendering'].includes(adminVideoDetail.status)) return;
    const timer = setInterval(async () => {
      try {
        const res = await authFetch(`${API_BASE}/admin/videos/${adminVideoDetail.id}`);
        if (res.ok) {
          const updated = await res.json();
          setAdminVideoDetail(updated);
          setAdminVideos(videos => videos.map(video => video.id === updated.id ? { ...video, ...updated } : video));
        }
      } catch (err) {
        console.error("Erreur actualisation progression admin:", err);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [adminVideoDetail?.id, adminVideoDetail?.status]);

  const retryAdminVideo = async () => {
    if (!adminVideoDetail?.id) return;
    setAdminVideoRetrying(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/videos/${adminVideoDetail.id}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Relance impossible.');
      const updated = await res.json();
      setAdminVideoDetail(prev => ({ ...prev, ...updated }));
      setAdminVideos(videos => videos.map(video => video.id === updated.id ? { ...video, ...updated } : video));
      showToast('Vidéo relancée.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAdminVideoRetrying(false);
    }
  };

  const deleteAdminVideo = async (videoId) => {
    if (!window.confirm("Supprimer définitivement cette vidéo ?")) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/videos/${videoId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec de la suppression');
      setAdminVideos(prev => prev.filter(v => v.id !== videoId));
      showToast('Vidéo supprimée.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const fetchAdminOrders = async () => {
    setAdminOrdersLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/orders`);
      if (res.ok) setAdminOrders(await res.json());
    } catch (err) {
      console.error("Erreur chargement transactions admin:", err);
    } finally {
      setAdminOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'admin' && currentUser?.is_admin) fetchAdminData();
  }, [view, currentUser?.is_admin]);

  useEffect(() => {
    if (view === 'admin' && currentUser?.is_admin && adminTab === 'videos') fetchAdminVideos();
  }, [view, currentUser?.is_admin, adminTab]);

  useEffect(() => {
    if (view === 'admin' && currentUser?.is_admin && adminTab === 'transactions') fetchAdminOrders();
  }, [view, currentUser?.is_admin, adminTab]);

  useEffect(() => {
    if (view === 'admin' && currentUser?.is_admin && adminTab === 'library') fetchAdminLibraryOverview();
  }, [view, currentUser?.is_admin, adminTab, adminLibraryNicheFilter]);

  const fetchAdminCosts = async () => {
    setAdminCostsLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/costs?days=${adminCostsDays}`);
      if (res.ok) setAdminCosts(await res.json());
    } catch (err) {
      console.error("Erreur chargement des coûts admin:", err);
    } finally {
      setAdminCostsLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'admin' && currentUser?.is_admin && adminTab === 'costs') fetchAdminCosts();
  }, [view, currentUser?.is_admin, adminTab, adminCostsDays]);

  const fetchAdminProviders = async () => {
    setAdminProvidersLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/providers/status`);
      if (res.ok) setAdminProviders((await res.json()).providers);
    } catch (err) {
      console.error("Erreur vérification des fournisseurs:", err);
    } finally {
      setAdminProvidersLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'admin' && currentUser?.is_admin && adminTab === 'resources') { fetchAdminProviders(); fetchHfAccounts(); fetchThumbnailProviderMode(); }
  }, [view, currentUser?.is_admin, adminTab]);

  const fetchThumbnailProviderMode = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/settings/thumbnail-provider-mode`);
      if (res.ok) setThumbnailProviderModeState((await res.json()).mode || 'free_only');
    } catch (err) {
      console.error("Erreur chargement du mode de génération des miniatures:", err);
    }
  };

  const setThumbnailProviderMode = async (mode) => {
    setThumbnailProviderModeSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/settings/thumbnail-provider-mode`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error();
      setThumbnailProviderModeState(mode);
      showToast(mode === 'free_only' ? 'Miniatures en 100% gratuit.' : 'Miniatures en gratuit puis payant.', 'success');
    } catch {
      showToast('Échec de la mise à jour.', 'error');
    } finally {
      setThumbnailProviderModeSaving(false);
    }
  };

  const fetchHfAccounts = async () => {
    setHfAccountsLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/hf-accounts`);
      if (res.ok) setHfAccounts(await res.json());
    } catch (err) {
      console.error("Erreur chargement comptes Hugging Face:", err);
    } finally {
      setHfAccountsLoading(false);
    }
  };

  const addHfAccount = async () => {
    const token = hfAccountForm.token.trim();
    if (!token) return showToast('Colle un token Hugging Face.', 'error');
    setHfAccountBusy(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/hf-accounts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, label: hfAccountForm.label.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Échec de l'ajout.");
      const account = await res.json();
      setHfAccounts(prev => [...prev, account]);
      setHfAccountForm({ token: '', label: '' });
      showToast(account.status === 'active' ? 'Compte ajouté et fonctionnel.' : `Compte ajouté (statut: ${account.status}).`, account.status === 'active' ? 'success' : 'error');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setHfAccountBusy(false);
    }
  };

  const checkHfAccount = async (id) => {
    setHfAccountChecking(id);
    try {
      const res = await authFetch(`${API_BASE}/admin/hf-accounts/${id}/check`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const account = await res.json();
      setHfAccounts(prev => prev.map(a => a.id === id ? account : a));
    } catch {
      showToast('Échec de la vérification.', 'error');
    } finally {
      setHfAccountChecking(null);
    }
  };

  const toggleHfAccount = async (id, isEnabled) => {
    try {
      const res = await authFetch(`${API_BASE}/admin/hf-accounts/${id}?is_enabled=${isEnabled}`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      const account = await res.json();
      setHfAccounts(prev => prev.map(a => a.id === id ? account : a));
    } catch {
      showToast('Échec de la mise à jour.', 'error');
    }
  };

  const renameHfAccount = async (id) => {
    const label = editingHfLabelValue.trim();
    try {
      const res = await authFetch(`${API_BASE}/admin/hf-accounts/${id}?label=${encodeURIComponent(label)}`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      const account = await res.json();
      setHfAccounts(prev => prev.map(a => a.id === id ? account : a));
      setEditingHfLabelId(null);
    } catch {
      showToast('Échec du renommage.', 'error');
    }
  };

  const deleteHfAccount = async (id) => {
    if (!window.confirm('Retirer ce compte Hugging Face ?')) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/hf-accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setHfAccounts(prev => prev.filter(a => a.id !== id));
    } catch {
      showToast('Échec de la suppression.', 'error');
    }
  };

  const openAdminUser = async (userId) => {
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${userId}`);
      if (res.ok) setAdminSelectedUser(await res.json());
    } catch (err) {
      console.error("Erreur chargement utilisateur:", err);
    }
  };

  const grantAdminSubscription = async () => {
    if (!adminSelectedUser) return;
    setAdminGranting(true);
    try {
      const body = adminGrantForm.plan_id
        ? { plan_id: adminGrantForm.plan_id, note: adminGrantForm.note || null }
        : { duration_days: parseInt(adminGrantForm.duration_days) || 30, note: adminGrantForm.note || null };
      const res = await authFetch(`${API_BASE}/admin/users/${adminSelectedUser.id}/grant-subscription`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec de l\'octroi');
      showToast('Abonnement accordé.', 'success');
      await openAdminUser(adminSelectedUser.id);
      fetchAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAdminGranting(false);
    }
  };

  const revokeAdminSubscription = async (userId) => {
    try {
      await authFetch(`${API_BASE}/admin/users/${userId}/revoke-subscription`, { method: 'POST' });
      showToast('Abonnement révoqué.', 'success');
      await openAdminUser(userId);
      fetchAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const adjustAdminCredits = async (direction) => {
    if (!adminSelectedUser) return;
    const amount = parseInt(adminCreditForm.amount, 10);
    if (!amount || amount <= 0) return showToast('Indique un montant de crédits positif.', 'error');
    setAdminCreditBusy(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${adminSelectedUser.id}/credits/${direction}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note: adminCreditForm.note || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Échec de l'opération.");
      const data = await res.json();
      setAdminSelectedUser(prev => ({
        ...prev,
        credit_balance: data.credit_balance,
        ...(data.subscription ? {
          subscriptions: [data.subscription, ...(prev.subscriptions || [])],
        } : {}),
      }));
      setAdminCreditForm({ amount: '', note: '' });
      showToast(direction === 'grant' ? 'Crédits ajoutés.' : 'Crédits retirés.', 'success');
      fetchAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAdminCreditBusy(false);
    }
  };

  const [studioVideo, setStudioVideo] = useState(null);

  useEffect(() => {
    // Server-side source of truth for "Mes voix clonées" — VoiceCloneJob
    // rows persist per-user regardless of browser/device, unlike the old
    // localStorage-only tracking (nichecut_cloned_voice_ids), which made a
    // creator's own cloned voices "disappear" the moment they opened the
    // wizard from a different tab, browser, or after clearing site data,
    // even though the channel using that voice_id kept generating fine the
    // whole time (see /channels/voice/clone/mine in channels.py).
    const inWizard = view === 'wizard';
    if ((!showSubmitModal || submitMode !== 'text') && !inWizard && !studioVideo) return;
    if (!currentUser) return;
    authFetch(`${API_BASE}/channels/voice/clone/mine`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const serverVoices = data.voices || [];
        if (!serverVoices.length) return;
        const mapped = serverVoices.map(v => ({
          id: v.id, name: v.name, desc: 'Voix personnelle clonée', cloned: true,
          preview_url: v.preview_url ? `${API_BASE}${v.preview_url}` : null,
        }));
        setAvailableVoices(prev => {
          const newOnes = mapped.filter(v => !prev.some(p => p.id === v.id));
          const merged = newOnes.length ? [...newOnes, ...prev] : prev;
          defaultVoicesRef.current = merged;
          return merged;
        });
        mapped.forEach(cacheVoiceMeta);
        setClonedVoiceIds(prev => {
          const next = [...new Set([...mapped.map(v => v.id), ...prev])];
          writeVoiceIdList(CLONED_VOICE_IDS_KEY, next);
          return next;
        });
      })
      .catch(() => {});
  }, [showSubmitModal, submitMode, view, currentUser?.id, studioVideo?.id]);

  useEffect(() => {
    // Voice is a channel-level setting now — fetch the catalog whenever it's
    // actually needed: the submit modal (read-only reminder) or the wizard's
    // own voice section (where it's actually configured).
    const inWizard = view === 'wizard';
    if ((!showSubmitModal || submitMode !== 'text') && !inWizard && !studioVideo) return;
    const ownerQuery = currentUser ? `?user_id=${encodeURIComponent(currentUser.id)}` : '';
    authFetch(`${API_BASE}/channels/voice/catalog${ownerQuery}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const voices = mergeKnownVoices((data.voices || []).map(mapCatalogVoice));
        if (voices.length) {
          defaultVoicesRef.current = voices;
          setAvailableVoices(voices);
          setCatalogHasMore(Boolean(data.has_more));
          setCatalogNextPage(data.next_page ?? 10);
          const preferred = inWizard ? newChannel.voice_id : activeChannel?.voice_id;
          if (preferred && voices.some(v => v.id === preferred)) setSelectedVoice(preferred);
          else if (!voices.some(v => v.id === selectedVoice)) setSelectedVoice(voices[0].id);
        }
      })
      .catch(() => {});
  }, [showSubmitModal, submitMode, view, currentUser?.id, activeChannel?.voice_id, studioVideo?.id]);

  const loadMoreVoices = async () => {
    if (loadingMoreVoices || !catalogHasMore) return;
    setLoadingMoreVoices(true);
    try {
      const ownerQuery = currentUser ? `&user_id=${encodeURIComponent(currentUser.id)}` : '';
      const res = await authFetch(`${API_BASE}/channels/voice/catalog?page=${catalogNextPage}&${ownerQuery.slice(1)}`);
      const data = await res.json().catch(() => ({}));
      const newVoices = (data.voices || []).map(mapCatalogVoice);
      if (newVoices.length) {
        setAvailableVoices(prev => {
          const merged = [...prev, ...newVoices.filter(v => !prev.some(p => p.id === v.id))];
          defaultVoicesRef.current = merged;
          return merged;
        });
      }
      setCatalogHasMore(Boolean(data.has_more));
      setCatalogNextPage(catalogNextPage + 1);
    } catch {
      showToast('Impossible de charger plus de voix.', 'error');
    } finally {
      setLoadingMoreVoices(false);
    }
  };

  // Izivoice's catalog holds 11 000+ voices — the default fetch above only
  // covers the first ~1000, so a name/accent/language typed here that isn't
  // in that slice needs its own server-side search instead of filtering the
  // already-loaded list (which would silently miss almost everything).
  useEffect(() => {
    const query = voiceSearchQuery.trim();
    if (query.length < 2) {
      setAvailableVoices(defaultVoicesRef.current);
      return;
    }
    const ownerQuery = currentUser ? `&user_id=${encodeURIComponent(currentUser.id)}` : '';
    setVoiceSearching(true);
    const handle = setTimeout(() => {
      authFetch(`${API_BASE}/channels/voice/catalog?search=${encodeURIComponent(query)}${ownerQuery}`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
          const voices = mergeKnownVoices((data.voices || []).map(mapCatalogVoice));
          setAvailableVoices(voices);
        })
        .catch(() => {})
        .finally(() => setVoiceSearching(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [voiceSearchQuery, currentUser?.id]);

  useEffect(() => {
    if (view !== 'wizard' || !currentUser) return;
    authFetch(`${API_BASE}/channels/izivoice/status?user_id=${encodeURIComponent(currentUser.id)}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setIzivoiceStatus)
      .catch(() => {});
  }, [view, currentUser?.id]);

  const handleConnectIzivoiceKey = async () => {
    if (!izivoiceKeyDraft.trim() || !currentUser) return;
    setSavingIzivoiceKey(true);
    try {
      const res = await authFetch(`${API_BASE}/channels/izivoice/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, api_key: izivoiceKeyDraft.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Clé invalide.');
      setIzivoiceStatus(body);
      setShowIzivoiceKeyModal(false);
      setIzivoiceKeyDraft('');
      showToast('Clé Izivoice connectée — tes voix clonées et ton historique sont maintenant synchronisés.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingIzivoiceKey(false);
    }
  };

  const handleDisconnectIzivoiceKey = async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`${API_BASE}/channels/izivoice/connect?user_id=${encodeURIComponent(currentUser.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setIzivoiceStatus({ connected: false, key_prefix: null, mode: 'nichecut' });
      setShowIzivoiceKeyModal(false);
      showToast('Clé Izivoice déconnectée — retour au compte KappGen par défaut.', 'success');
    } catch {
      showToast('Impossible de déconnecter la clé.', 'error');
    }
  };

  const toggleSavedVoice = (voice) => {
    setSavedVoiceIds(prev => {
      const next = prev.includes(voice.id) ? prev.filter(id => id !== voice.id) : [voice.id, ...prev];
      writeVoiceIdList(SAVED_VOICE_IDS_KEY, next);
      return next;
    });
    cacheVoiceMeta(voice);
  };

  // Lets someone attach a voice they already cloned directly on Izivoice
  // (outside KappGen) by pasting its voice_id — a fallback path around the
  // in-app clone flow above, and the fastest option for anyone who already
  // knows their id. Throws on failure so the caller (the inline form) can
  // show the error next to the input instead of a toast.
  const handleAddVoiceById = async (voiceId) => {
    const res = await authFetch(`${API_BASE}/channels/voice/lookup/${encodeURIComponent(voiceId)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.detail || 'Identifiant introuvable.');
    const voice = { id: body.voice_id, name: body.name, language: body.language, gender: body.gender, desc: 'Voix personnelle (Izivoice)', cloned: true };
    setAvailableVoices(prev => [voice, ...prev.filter(v => v.id !== voice.id)]);
    setSelectedVoice(voice.id);
    setClonedVoiceIds(prev => {
      const next = [voice.id, ...prev.filter(id => id !== voice.id)];
      writeVoiceIdList(CLONED_VOICE_IDS_KEY, next);
      return next;
    });
    cacheVoiceMeta(voice);
    if (view === 'wizard') setNewChannel(prev => ({ ...prev, voice_id: voice.id, voice_name: voice.name }));
    showToast('Voix ajoutée et sélectionnée.', 'success');
  };

  const handleCloneVoice = async (file, name) => {
    // Voice is a channel-level setting: cloned either from the "Nouvelle
    // vidéo" modal (activeChannel already saved) or from the wizard's voice
    // section while editing an existing channel (editingChannelId) — cloning
    // needs a real channel id to attach to, so it's unavailable while still
    // creating a brand-new, unsaved channel.
    const targetChannelId = view === 'wizard' ? editingChannelId : activeChannel?.id;
    if (!file || !targetChannelId || !name?.trim()) return;
    setCloningVoice(true);
    try {
      const clip = await trimAudioClientSide(file, 32);
      const form = new FormData();
      form.append('name', name.trim());
      if (currentUser) form.append('user_id', currentUser.id);
      form.append('audio', clip);
      const res = await authFetch(`${API_BASE}/channels/${targetChannelId}/voice/clone`, { method: 'POST', body: form, timeoutMs: 60000 });
      const started = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(started.detail || 'Clonage impossible.');

      // Izivoice's clone call can run well past Cloudflare's ~100s proxy
      // timeout — the backend kicks it off in the background and returns a
      // job_id right away instead of holding the request open, so poll for
      // the real result here instead of expecting it in this response.
      let body;
      for (let attempt = 0; ; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
        // Each poll gets its own timeout — a single hung/dropped request
        // (dead connection, backend stall) used to freeze this whole loop
        // on one `await` forever, leaving "Clonage…" stuck on screen with
        // no error and no way out short of a page reload. A timed-out poll
        // just counts as a skipped attempt and retries instead of aborting
        // the clone outright — the job may still be running fine server-side.
        let statusRes;
        try {
          statusRes = await authFetch(`${API_BASE}/channels/voice/clone/status/${started.job_id}`, { timeoutMs: 15000 });
        } catch (pollErr) {
          if (attempt > 100) throw new Error("Le clonage prend trop de temps, réessaie plus tard.");
          continue;
        }
        const statusBody = await statusRes.json().catch(() => ({}));
        if (!statusRes.ok) throw new Error(statusBody.detail || 'Clonage impossible.');
        if (statusBody.status === 'done') { body = statusBody; break; }
        if (statusBody.status === 'error') throw new Error(statusBody.detail || 'Clonage impossible.');
        if (attempt > 100) throw new Error("Le clonage prend trop de temps, réessaie plus tard.");
      }
      const voice = {
        id: body.voice_id,
        name: body.name,
        desc: 'Voix personnelle clonée',
        cloned: true,
        // Relative to our own API (unlike catalog voices' preview_url, which
        // Izivoice already returns as an absolute URL) — prefix with
        // API_BASE so it resolves against api.kappgen.com, not the
        // frontend's own origin.
        preview_url: body.preview_url ? `${API_BASE}${body.preview_url}` : null,
      };
      setAvailableVoices(prev => [voice, ...prev.filter(v => v.id !== voice.id)]);
      setSelectedVoice(voice.id);
      setClonedVoiceIds(prev => {
        const next = [voice.id, ...prev.filter(id => id !== voice.id)];
        writeVoiceIdList(CLONED_VOICE_IDS_KEY, next);
        return next;
      });
      cacheVoiceMeta(voice);
      if (view === 'wizard') setNewChannel(prev => ({ ...prev, voice_id: voice.id, voice_name: voice.name }));
      showToast('Ta voix a été clonée et sélectionnée.', 'success');
      setShowVoiceCloner(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCloningVoice(false);
      if (cloneVoiceInputRef.current) cloneVoiceInputRef.current.value = '';
    }
  };

  const saveChannelVoice = async (voiceId, settings = activeChannel?.voice_settings) => {
    setSelectedVoice(voiceId);
    if (!activeChannel) return;
    const voice = availableVoices.find(item => item.id === voiceId);
    const payload = {
      voice_id: voiceId,
      voice_name: voice?.name || voiceId,
      voice_settings: settings || { speed: 0.845, stability: 0.8, similarity_boost: 0.9, style: 0 }
    };
    try {
      const res = await authFetch(`${API_BASE}/channels/${activeChannel.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setActiveChannel(saved);
      setChannels(prev => prev.map(channel => channel.id === saved.id ? saved : channel));
    } catch {
      showToast("La voix est sélectionnée pour cette vidéo, mais le réglage permanent n'a pas pu être enregistré.", 'error');
    }
  };

  const handleRetryVideo = async (videoId) => {
    try {
      await authFetch(`${API_BASE}/videos/${videoId}/retry`, { method: 'POST' });
      if (activeChannel) fetchChannelVideos(activeChannel.id);
      fetchAllVideos();
    } catch (e) {
      console.error(e);
    }
  };

  // One-click escape hatch from a channel-wide outage (e.g. every paid AI
  // provider out of credits at once): automation_mode "auto" hides the
  // manual script/voice form, so a creator stuck behind a SERVICE_UNAVAILABLE
  // failure has no way to keep producing videos by hand until this flips
  // them back to "manual" — never leaves them fully blocked on our own outage.
  const handleDisableChannelAutomation = async (channelId) => {
    try {
      const res = await authFetch(`${API_BASE}/channels/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automation_mode: 'manual' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec de la désactivation.');
      showToast("Automatisation désactivée — tu peux maintenant soumettre une vidéo manuellement.", 'success');
      fetchChannels();
      if (activeChannel?.id === channelId) setActiveChannel(prev => prev ? { ...prev, automation_mode: 'manual' } : prev);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteVideo = async (videoId, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    const ok = await askConfirm("Cette action est définitive et supprimera le fichier rendu.", { title: "Supprimer cette vidéo ?", danger: true });
    if (!ok) return;
    try {
      await authFetch(`${API_BASE}/videos/${videoId}`, { method: 'DELETE' });
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
    } catch (err) {
      console.error("Erreur lors de la suppression de la vidéo:", err);
    }
  };

  const [downloadModalVideo, setDownloadModalVideo] = useState(null);
  const [downloadingQuality, setDownloadingQuality] = useState(null);

  const handleDownloadVideo = (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    if (!vid.output_path) return;
    setDownloadModalVideo(vid);
  };

  const [approvingVideoId, setApprovingVideoId] = useState(null);
  const handleToggleApproval = async (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    setApprovingVideoId(vid.id);
    try {
      const res = await authFetch(`${API_BASE}/videos/${vid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_for_publish: !vid.approved_for_publish }),
      });
      if (!res.ok) throw new Error("Impossible de mettre à jour l'approbation.");
      showToast(vid.approved_for_publish ? 'Publication annulée — la vidéo reste en attente.' : 'Approuvée : elle sera publiée à l’heure programmée.', 'success');
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
    } catch (e2) {
      showToast(e2.message, 'error');
    } finally {
      setApprovingVideoId(null);
    }
  };

  // Videos are auto-deleted from the server after 48h by default now (disk
  // space) — this opts one out, keeping it around longer by moving it to R2
  // storage instead of local disk. Meant to become a paid feature; no
  // charge/gate wired up yet (see Video.extended_retention).
  const [togglingRetentionId, setTogglingRetentionId] = useState(null);
  const handleToggleExtendedRetention = async (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    setTogglingRetentionId(vid.id);
    try {
      const res = await authFetch(`${API_BASE}/videos/${vid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extended_retention: !vid.extended_retention }),
      });
      if (!res.ok) throw new Error("Impossible de mettre à jour la conservation.");
      showToast(vid.extended_retention ? 'Conservation prolongée désactivée — suppression automatique après 48h.' : 'Vidéo conservée plus longtemps.', 'success');
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
    } catch (e2) {
      showToast(e2.message, 'error');
    } finally {
      setTogglingRetentionId(null);
    }
  };

  const handlePublishYouTube = (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    if (vid.youtube_video_id) {
      window.open(`https://youtu.be/${vid.youtube_video_id}`, '_blank', 'noopener,noreferrer');
      return;
    }
    // Review step: the AI already proposed a ready-to-publish title (100
    // chars max, YouTube's limit) and description right after the render
    // finished — let the creator see and tweak them before anything goes live.
    setPublishTitleDraft((vid.title || '').slice(0, 100));
    setPublishDescriptionDraft(vid.youtube_description || '');
    setPublishReviewVideo(vid);
  };

  const confirmPublishYouTube = async () => {
    const vid = publishReviewVideo;
    if (!vid) return;
    if (!publishTitleDraft.trim()) return showToast('Le titre ne peut pas être vide.', 'error');
    setPublishingVideoId(vid.id);
    try {
      const metaRes = await authFetch(`${API_BASE}/videos/${vid.id}/youtube-metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: publishTitleDraft.trim(), description: publishDescriptionDraft }),
      });
      if (!metaRes.ok) throw new Error("Impossible d'enregistrer le titre/la description.");

      // The actual YouTube upload runs in the background on the server (it
      // can take minutes) — this call only kicks it off, so the modal closes
      // right away instead of making the creator sit and wait. Progress from
      // here on shows up on the video card itself (see the youtube_publish
      // progress_stage badge), the same way auto/scheduled publishes do.
      const res = await authFetch(`${API_BASE}/videos/${vid.id}/youtube/publish`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body.detail;
        if (detail?.code === 'youtube_auth_required') {
          showToast('Authentification YouTube requise. Connecte la chaîne pour continuer.', 'error');
          if (detail.auth_url) window.location.assign(detail.auth_url);
          return;
        }
        throw new Error(typeof detail === 'string' ? detail : detail?.message || 'Publication impossible.');
      }
      if (body.status === 'already_published') {
        showToast('Cette vidéo est déjà publiée sur YouTube.', 'success');
        if (body.youtube_url) window.open(body.youtube_url, '_blank', 'noopener,noreferrer');
      } else {
        showToast('Publication lancée — la vidéo continue de se publier en arrière-plan, tu peux continuer à travailler.', 'success');
      }
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
      setPublishReviewVideo(null);
    } catch (err) {
      showToast(err.message || 'Publication YouTube impossible.', 'error');
    } finally {
      setPublishingVideoId(null);
    }
  };

  // Shared by runDownload (video) and runThumbnailDownload — a plain <a
  // download> navigation, not fetch()+blob(): that would buffer the whole
  // file (hundreds of MB for a video) in JS memory with no progress
  // feedback before anything visibly happens. The backend routes already
  // send Content-Disposition: attachment, so this just lets the browser
  // stream straight to disk with its own native download UI.
  const triggerFileDownload = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const runThumbnailDownload = (vid) => {
    const base = `kappgen-${(vid.title || vid.script_text || 'video').slice(0, 40).replace(/[^a-z0-9]+/gi, '-')}`;
    triggerFileDownload(`${API_BASE}/videos/${vid.id}/thumbnail/download`, `${base}-thumbnail.jpg`);
  };

  const runDownload = (vid, quality) => {
    setDownloadingQuality(quality);
    const base = `kappgen-${(vid.title || vid.script_text || 'video').slice(0, 40).replace(/[^a-z0-9]+/gi, '-')}`;
    triggerFileDownload(`${API_BASE}/videos/${vid.id}/download?quality=${quality}`, `${base}-${quality}.mp4`);
    // The creator asked for the thumbnail to come down alongside the video
    // itself every time, not just as a separate manual step — a short delay
    // avoids the two downloads racing/being coalesced by some browsers when
    // fired in the exact same tick from one click.
    setTimeout(() => triggerFileDownload(`${API_BASE}/videos/${vid.id}/thumbnail/download`, `${base}-thumbnail.jpg`), 400);
    setTimeout(() => {
      setDownloadingQuality(null);
      setDownloadModalVideo(null);
    }, 600);
  };

  // KappGen Studio — post-render editor: swap a bad scene image without
  // redoing TTS/pacing/image-gen for the whole video.
  const [studioScenes, setStudioScenes] = useState([]);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioReplacingIndex, setStudioReplacingIndex] = useState(null);
  const [studioReassembling, setStudioReassembling] = useState(false);
  const [studioSelectedIndex, setStudioSelectedIndex] = useState(null);
  const [studioSubtitleDraft, setStudioSubtitleDraft] = useState('');
  const [studioSavingSubtitle, setStudioSavingSubtitle] = useState(false);
  const [studioRegeneratingAudio, setStudioRegeneratingAudio] = useState(false);
  const [studioConfirmRegen, setStudioConfirmRegen] = useState(false);
  const [studioTitleDraft, setStudioTitleDraft] = useState('');
  const [studioEditingTitle, setStudioEditingTitle] = useState(false);
  const [studioSavingTitle, setStudioSavingTitle] = useState(false);
  const [studioEditingFullScript, setStudioEditingFullScript] = useState(false);
  const [studioFullScriptDraft, setStudioFullScriptDraft] = useState('');
  const [studioSavingFullScript, setStudioSavingFullScript] = useState(false);
  const [studioPlaybackTime, setStudioPlaybackTime] = useState(0);
  const [studioIsPlaying, setStudioIsPlaying] = useState(false);
  const [studioSeekTo, setStudioSeekTo] = useState(null);
  const [studioVoiceMenuOpen, setStudioVoiceMenuOpen] = useState(false);
  const [studioPreviewPlayingId, setStudioPreviewPlayingId] = useState(null);
  const [studioVoiceDraft, setStudioVoiceDraft] = useState(null);
  const [studioRegeneratingVoice, setStudioRegeneratingVoice] = useState(false);

  const openStudio = async (vid) => {
    setStudioVideo(vid);
    setSelectedVideo(null);
    setStudioLoading(true);
    setStudioScenes([]);
    setStudioSelectedIndex(null);
    setStudioTitleDraft(vid.title || '');
    setStudioEditingTitle(false);
    setStudioEditingFullScript(false);
    setStudioPlaybackTime(0);
    setStudioIsPlaying(false);
    setStudioSeekTo(null);
    setStudioVoiceMenuOpen(false);
    setStudioVoiceDraft(vid.voice_id || null);
    try {
      const res = await authFetch(`${API_BASE}/videos/${vid.id}/scenes`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Scènes indisponibles');
      const scenes = await res.json();
      setStudioScenes(scenes);
      if (Array.isArray(scenes)) setStudioFullScriptDraft(scenes.map(s => s.text || '').join('\n\n'));
    } catch (err) {
      console.error("Erreur chargement des scènes:", err);
      setStudioScenes(null); // null = "not editable", distinct from [] = "loaded, no scenes"
    } finally {
      setStudioLoading(false);
    }
  };

  const closeStudio = () => {
    setStudioVideo(null);
    setStudioScenes([]);
    setStudioSelectedIndex(null);
    setStudioEditingTitle(false);
    setStudioEditingFullScript(false);
  };

  const saveStudioTitle = async () => {
    if (!studioVideo || !studioTitleDraft.trim()) return;
    setStudioSavingTitle(true);
    try {
      const res = await authFetch(`${API_BASE}/videos/${studioVideo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: studioTitleDraft.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec de l’enregistrement du titre');
      const updated = await res.json();
      setStudioVideo(updated);
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
      showToast('Titre mis à jour.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setStudioSavingTitle(false);
      setStudioEditingTitle(false);
    }
  };

  // Splits the freely-edited full script back into per-scene paragraphs and
  // patches only the scenes whose text actually changed — reuses the existing
  // per-scene subtitle endpoint rather than needing a new bulk one. Requires
  // the paragraph count to stay the same as the scene count since each
  // paragraph maps 1:1 to a scene's timing.
  const saveStudioFullScript = async () => {
    if (!studioVideo || !studioScenes || !studioScenes.length) return;
    const paragraphs = studioFullScriptDraft.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (paragraphs.length !== studioScenes.length) {
      // Finding the exact spot is more useful than just the count on a
      // 40+ scene script — the first paragraph that no longer matches its
      // original scene text is right where a blank line got merged or added.
      const firstMismatch = studioScenes.findIndex((scene, i) => (paragraphs[i] || '') !== (scene.text || '').trim());
      const hint = firstMismatch === -1 ? '' : ` Ça part en décalage à partir de la scène ${firstMismatch + 1} — vérifie la ligne vide juste avant/après ce paragraphe.`;
      showToast(`Le script doit garder ${studioScenes.length} paragraphes (un par scène) — actuellement ${paragraphs.length}.${hint}`, 'error');
      return;
    }
    setStudioSavingFullScript(true);
    try {
      const changed = studioScenes.filter((scene, i) => paragraphs[i] !== (scene.text || '').trim());
      for (const scene of changed) {
        const idx = studioScenes.indexOf(scene);
        const res = await authFetch(`${API_BASE}/videos/${studioVideo.id}/scenes/${scene.index}/subtitle`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: paragraphs[idx] }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Échec sur la scène ${scene.index + 1}`);
      }
      if (changed.length) {
        setStudioReassembling(true);
        pollReassembly(studioVideo.id);
        showToast(`${changed.length} scène(s) mise(s) à jour, réassemblage en cours…`, 'success');
      }
      setStudioEditingFullScript(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setStudioSavingFullScript(false);
    }
  };

  // Full re-render with a different voice — there's no incremental per-video
  // voice swap, so this resubmits the whole script as a fresh video for the
  // same channel via the existing submit pipeline.
  const regenerateStudioWithVoice = async () => {
    if (!studioVideo || !studioVoiceDraft || !studioScenes?.length) return;
    const fullText = studioScenes.map(s => s.text || '').join('\n\n');
    const ok = await askConfirm("KappGen va relancer un rendu complet de cette vidéo avec la nouvelle voix. Cela crée une nouvelle vidéo distincte — l'actuelle reste inchangée.", { title: 'Régénérer avec cette voix ?' });
    if (!ok) return;
    setStudioRegeneratingVoice(true);
    try {
      const form = new FormData();
      form.append('channel_id', studioVideo.channel_id);
      form.append('input_type', 'text');
      form.append('script_text', fullText);
      form.append('voice_id', studioVoiceDraft);
      const res = await authFetch(`${API_BASE}/videos`, { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec de la régénération');
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
      showToast('Nouvelle vidéo lancée avec la voix choisie.', 'success');
      closeStudio();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setStudioRegeneratingVoice(false);
    }
  };

  // Re-fetches the scene list in place (after a text/audio edit finishes) so
  // durations/text stay current without closing and reopening the Studio.
  const refreshStudioScenes = async () => {
    if (!studioVideo) return;
    try {
      const res = await authFetch(`${API_BASE}/videos/${studioVideo.id}/scenes`);
      if (res.ok) setStudioScenes(await res.json());
    } catch (err) {
      console.error("Erreur rafraîchissement des scènes:", err);
    }
  };

  const pollReassembly = (videoId, { onDone } = {}) => {
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`${API_BASE}/videos/${videoId}`);
        if (!res.ok) return;
        const v = await res.json();
        if (v.status === 'done' || v.status === 'failed') {
          clearInterval(interval);
          setStudioReassembling(false);
          fetchAllVideos();
          if (activeChannel) fetchChannelVideos(activeChannel.id);
          if (v.status === 'failed') alert("Le réassemblage a échoué : " + (v.error_message || 'Erreur inconnue'));
          else {
            setStudioVideo(v);
            refreshStudioScenes();
            showToast('La scène a été mise à jour et la vidéo réassemblée.', 'success');
            if (onDone) onDone();
          }
        }
      } catch (err) {
        console.error("Erreur polling réassemblage:", err);
      }
    }, 3000);
  };

  const replaceSceneImage = async (sceneIndex, file) => {
    if (!studioVideo || !file) return;
    setStudioReplacingIndex(sceneIndex);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await authFetch(`${API_BASE}/videos/${studioVideo.id}/scenes/${sceneIndex}/image`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec du remplacement');
      const updatedVideo = await res.json();
      setStudioReassembling(true);
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
      pollReassembly(updatedVideo.id);
    } catch (err) {
      console.error("Erreur remplacement image:", err);
      alert("Le remplacement de l'image a échoué : " + err.message);
    } finally {
      setStudioReplacingIndex(null);
    }
  };

  const saveSceneSubtitle = async (sceneIndex) => {
    if (!studioVideo || !studioSubtitleDraft.trim()) return;
    setStudioSavingSubtitle(true);
    try {
      const res = await authFetch(`${API_BASE}/videos/${studioVideo.id}/scenes/${sceneIndex}/subtitle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: studioSubtitleDraft.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec de la correction');
      const updatedVideo = await res.json();
      setStudioReassembling(true);
      pollReassembly(updatedVideo.id);
    } catch (err) {
      console.error("Erreur édition sous-titre:", err);
      alert("La correction du sous-titre a échoué : " + err.message);
    } finally {
      setStudioSavingSubtitle(false);
    }
  };

  const regenerateSceneAudio = async (sceneIndex) => {
    if (!studioVideo || !studioSubtitleDraft.trim()) return;
    setStudioConfirmRegen(false);
    setStudioRegeneratingAudio(true);
    try {
      const res = await authFetch(`${API_BASE}/videos/${studioVideo.id}/scenes/${sceneIndex}/regenerate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: studioSubtitleDraft.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Échec de la régénération');
      const updatedVideo = await res.json();
      setStudioReassembling(true);
      pollReassembly(updatedVideo.id);
    } catch (err) {
      console.error("Erreur régénération audio:", err);
      alert("La régénération de la voix a échoué : " + err.message);
    } finally {
      setStudioRegeneratingAudio(false);
    }
  };

  const selectStudioScene = (scene, { seek = false } = {}) => {
    setStudioSelectedIndex(scene.index);
    setStudioSubtitleDraft(scene.text || '');
    setStudioConfirmRegen(false);
    if (seek) setStudioSeekTo(scene.start);
  };

  useEffect(() => {
    if (studioScenes && studioScenes.length > 0 && studioSelectedIndex === null) {
      selectStudioScene(studioScenes[0]);
    }
  }, [studioScenes]);

  const [reusingAudioId, setReusingAudioId] = useState(null);
  const [regeneratingTitleId, setRegeneratingTitleId] = useState(null);
  const handleRegenerateTitle = async (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    setRegeneratingTitleId(vid.id);
    try {
      const res = await authFetch(`${API_BASE}/videos/${vid.id}/youtube-metadata/regenerate`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
      showToast('Titre régénéré.', 'success');
      return updated;
    } catch {
      showToast('Impossible de régénérer le titre.', 'error');
      return null;
    } finally {
      setRegeneratingTitleId(null);
    }
  };

  // Rename modal: lets the creator either type their own title or ask the AI
  // to propose one, instead of only ever getting a one-click AI regeneration
  // with no way to pick the exact wording themselves.
  const [renameModalVideo, setRenameModalVideo] = useState(null);
  const [renameTitleDraft, setRenameTitleDraft] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const openRenameModal = (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    setRenameModalVideo(vid);
    setRenameTitleDraft(vid.title || '');
  };
  const closeRenameModal = () => { setRenameModalVideo(null); setRenameTitleDraft(''); };
  const regenerateTitleInModal = async () => {
    if (!renameModalVideo) return;
    const updated = await handleRegenerateTitle(renameModalVideo);
    if (updated) setRenameTitleDraft(updated.title || '');
  };
  const saveRenameTitle = async () => {
    if (!renameModalVideo) return;
    const title = renameTitleDraft.trim();
    if (!title) return showToast('Le titre ne peut pas être vide.', 'error');
    setRenameSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/videos/${renameModalVideo.id}/youtube-metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error();
      fetchAllVideos();
      if (activeChannel) fetchChannelVideos(activeChannel.id);
      showToast('Titre enregistré.', 'success');
      closeRenameModal();
    } catch {
      showToast("Impossible d'enregistrer le titre.", 'error');
    } finally {
      setRenameSaving(false);
    }
  };

  const [resyncingThumbnailId, setResyncingThumbnailId] = useState(null);
  const handleResyncThumbnail = async (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    setResyncingThumbnailId(vid.id);
    try {
      const res = await authFetch(`${API_BASE}/videos/${vid.id}/youtube-thumbnail/resync`, { method: 'POST' });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Échec de la mise à jour de la miniature.");
      }
      showToast('Miniature mise à jour sur YouTube.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setResyncingThumbnailId(null);
    }
  };

  // A Set (not a single id) so regenerating several videos' thumbnails at once
  // shows/clears each card's own spinner independently instead of the last
  // click's finally-block wiping every other card's in-flight indicator.
  const [regeneratingCardThumbnailIds, setRegeneratingCardThumbnailIds] = useState(() => new Set());
  const [thumbnailBust, setThumbnailBust] = useState({});
  // Full-size thumbnail preview modal, with a regenerate action right there
  // instead of only a blind one-click "Régénérer" in the kebab menu.
  const [thumbnailModalVideo, setThumbnailModalVideo] = useState(null);
  const openThumbnailModal = (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    setThumbnailModalVideo(vid);
  };
  const handleRegenerateCardThumbnail = async (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    setRegeneratingCardThumbnailIds(prev => new Set(prev).add(vid.id));
    try {
      const res = await authFetch(`${API_BASE}/videos/${vid.id}/thumbnail/regenerate`, { method: 'POST' });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Échec de la régénération de la miniature.");
      }
      // thumbnail.jpg is overwritten in place — vid.finished_at doesn't change,
      // so the <img>/poster would keep serving the old cached file without this.
      setThumbnailBust(prev => ({ ...prev, [vid.id]: Date.now() }));
      showToast('Miniature régénérée.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRegeneratingCardThumbnailIds(prev => {
        const next = new Set(prev);
        next.delete(vid.id);
        return next;
      });
    }
  };

  const handleReuseAudio = async (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    if (!vid.output_path) return;
    setReusingAudioId(vid.id);
    try {
      const res = await authFetch(`${API_BASE}/videos/${vid.id}/audio`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const fileName = `${(vid.script_text || 'audio').slice(0, 40).replace(/[^a-z0-9]+/gi, '-')}.m4a`;
      const file = new File([blob], fileName, { type: blob.type || 'audio/mp4' });

      const channel = channels.find(c => c.id === vid.channel_id) || null;
      if (channel) setActiveChannel(channel);
      setSubmitMode('audio_upload');
      setAudioFilesList([file]);
      setSubmitStep(1);
      setShowSubmitModal(true);
    } catch (err) {
      console.error("Erreur lors de la réutilisation de l'audio:", err);
      showToast("Impossible de récupérer l'audio de cette vidéo.", "error");
    } finally {
      setReusingAudioId(null);
    }
  };

  const startEditingTitle = (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    setEditingTitleValue(vid.title || vid.script_text || "");
    setEditingTitleId(vid.id);
  };

  const commitTitleEdit = async (vid) => {
    const trimmed = editingTitleValue.trim();
    setEditingTitleId(null);
    if (!trimmed || trimmed === (vid.title || vid.script_text)) return;
    try {
      const res = await authFetch(`${API_BASE}/videos/${vid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed })
      });
      if (res.ok) {
        fetchAllVideos();
        if (activeChannel) fetchChannelVideos(activeChannel.id);
        showToast("Vidéo renommée.", "success");
      } else {
        const err = await res.json();
        showToast(err.detail || "Erreur lors du renommage.", "error");
      }
    } catch (err) {
      console.error("Erreur lors du renommage de la vidéo:", err);
      showToast("Erreur lors du renommage.", "error");
    }
  };

  const handleDeleteChannel = async (channelId, e) => {
    e.stopPropagation();
    setOpenChannelMenuId(null);
    const ok = await askConfirm("Toutes les vidéos et paramètres associés seront supprimés définitivement.", { title: "Supprimer cette chaîne ?", danger: true });
    if (!ok) return;
    try {
      const res = await authFetch(`${API_BASE}/channels/${channelId}`, { method: 'DELETE' });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Impossible de supprimer cette chaîne.");
      }
      fetchChannels();
      if (activeChannel && activeChannel.id === channelId) {
        setActiveChannel(null);
        setView('channels');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  };

  const handleToggleChannelActive = async (channel, e) => {
    if (e) e.stopPropagation();
    setOpenChannelMenuId(null);
    const activating = !channel.is_active;
    if (!activating) {
      const ok = await askConfirm("Aucune nouvelle vidéo ne sera générée (manuelle ou automatique) tant qu'elle reste désactivée. Rien n'est supprimé — tu peux la réactiver à tout moment.", { title: `Désactiver « ${channel.name} » ?` });
      if (!ok) return;
    }
    try {
      const res = await authFetch(`${API_BASE}/channels/${channel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: activating }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Impossible de modifier l'état de la chaîne.");
      }
      const updated = await res.json();
      setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, ...updated } : c));
      if (activeChannel && activeChannel.id === channel.id) setActiveChannel(prev => ({ ...prev, ...updated }));
      showToast(activating ? 'Chaîne réactivée.' : 'Chaîne désactivée — plus aucune vidéo ne sera générée.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  };

  // "Mes Chaînes" and "Mes Vidéos" are scoped to the active product — a music
  // channel's pipeline (no script/voix off, loop/compilation montage) is
  // fundamentally different from a narration one's, so mixing them in the
  // same list would show configuration that doesn't apply. Home stays
  // unscoped (global totals across every product) since it's just an overview.
  const activeProductContentType = activeProduct === 'music' ? 'music' : 'narration';
  const productChannels = channels.filter(c => (c.content_type || 'narration') === activeProductContentType);
  const productChannelIds = new Set(productChannels.map(c => c.id));
  const filteredChannels = productChannels.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.niche.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalQueued = channels.reduce((acc, c) => acc + (c.queued_count || 0) + (c.rendering_count || 0), 0);
  const totalCompleted = channels.reduce((acc, c) => acc + (c.done_count || 0), 0);
  const autoChannelsCount = channels.filter(c => c.automation_mode === 'auto').length;

  // Sample sentence for karaoke animation preview
  const sampleWords = [
    { text: "Le", highlight: previewWordIndex === 0 },
    { text: "calme", highlight: previewWordIndex === 1 },
    { text: "intérieur", highlight: previewWordIndex === 2 },
    { text: "dépend", highlight: previewWordIndex === 3 },
    { text: "de votre", highlight: previewWordIndex === 4 },
    { text: "esprit", highlight: previewWordIndex === 5 },
  ];

  // Real route guard: protected URLs never render the dashboard for anonymous
  // visitors. Keep the requested path so a successful sign-in can return there.
  const isAuthRoute = AUTH_PATHS.has(location.pathname);
  if (!currentUser && !isAuthRoute) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (currentUser && isAuthRoute) {
    const requestedPath = typeof location.state?.from === 'string' ? location.state.from : '/dashboard';
    const safeDestination = requestedPath.startsWith('/') && !AUTH_PATHS.has(requestedPath.split('?')[0]) ? requestedPath : '/dashboard';
    return <Navigate to={safeDestination} replace />;
  }

  return (
    <div className="font-body-md antialiased overflow-hidden flex h-screen bg-[var(--bg-input-alt)] text-[#e5e8f0]">
      {!isAuthRoute && (<>

      {/* MOBILE TOP BAR — the desktop sidenav + header below are both `hidden`
          under md, so mobile needs its own always-visible bar with a hamburger
          to reach navigation at all. */}
      <div className="flex md:hidden items-center justify-between px-4 h-14 fixed top-0 left-0 right-0 z-40 bg-[var(--bg-surface-soft)] border-b border-[var(--border-soft)]">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:bg-[var(--bg-dropdown)] hover:text-white -ml-1.5"
          aria-label="Ouvrir le menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { window.location.href = 'https://kappgen.com'; }}>
          <img src="/assets/logo/logo-kappgen.png" alt="KappGen" className="w-7 h-7 rounded-lg object-cover" />
          <span className="font-title-sm text-sm font-black text-white tracking-wide">KappGen</span>
        </div>
        {currentUser ? (
          <button onClick={() => setView('settings')} className="w-8 h-8 rounded-full overflow-hidden border border-[var(--border)] flex-shrink-0">
            {currentUser.picture_url ? (
              <img src={currentUser.picture_url} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#00c2ff] to-[#0088ff] flex items-center justify-center text-slate-950 text-xs font-black">
                {(currentUser.name || '?')[0].toUpperCase()}
              </div>
            )}
          </button>
        ) : (
          <div className="w-8 h-8" />
        )}
      </div>

      {/* MOBILE NAV DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <nav className="relative w-[260px] max-w-[80vw] h-full bg-[var(--bg-surface-soft)] border-r border-[var(--border-soft)] py-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="px-6 mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => { window.location.href = 'https://kappgen.com'; }}>
                  <img src="/assets/logo/logo-kappgen.png" alt="KappGen" className="w-9 h-9 rounded-xl shadow-lg shadow-[#00c2ff]/20 object-cover" />
                  <div>
                    <div className="font-title-sm text-base font-black text-white tracking-wide">KappGen</div>
                    <div className="text-slate-400 text-xs font-normal">Video Automation</div>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="px-3 space-y-1.5">
                {[
                  { id: 'home', label: 'Home', icon: 'home', active: view === 'home' || view === 'dashboard' },
                  { id: 'channels', label: 'Mes Chaînes', icon: 'subscriptions', active: view === 'channels' || view === 'channel_detail' },
                  { id: 'videos', label: 'Mes Vidéos', icon: 'movie', active: view === 'videos' },
                ].map(({ id, label, icon, active }) => (
                  <button
                    key={id}
                    onClick={() => { setView(id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 cursor-pointer rounded-xl transition-all font-medium text-sm ${
                      active
                        ? 'bg-gradient-to-r from-[#00c2ff] to-[#0099ff] text-slate-950 font-bold shadow-md shadow-[#00c2ff]/20'
                        : 'text-slate-300 hover:bg-[var(--bg-dropdown)] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-3 space-y-1.5">
              {currentUser && (
                <button
                  onClick={() => { setShowPricingModal(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm hover:bg-[var(--bg-dropdown)]"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#00c2ff]">diamond</span>
                  <span className="text-left">
                    <span className="block text-xs font-bold text-white">
                      {creditBalance != null ? `${creditBalance.toLocaleString()} crédits` : 'Offres & Tarifs'}
                    </span>
                    <span className="block text-[10px] text-slate-400">Recharger</span>
                  </span>
                </button>
              )}
              {currentUser ? (
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-[var(--bg-dropdown)] hover:text-white"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  Déconnexion
                </button>
              ) : (
                <button
                  onClick={() => { setShowAuthModal(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-[#00c2ff] text-slate-950"
                >
                  Connexion
                </button>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* SIDE NAVBAR */}
      <nav className={`hidden md:flex flex-col bg-[var(--bg-surface-soft)] text-primary font-label-bold text-label-bold fixed left-0 top-0 h-screen z-40 border-r border-[var(--border-soft)] py-6 justify-between transition-[width] duration-200 ${sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'}`}>

        <div>
          {/* Collapse/expand toggle — same idea as iziVoice's rail-mode sidebar */}
          <div className={`px-3 mb-2 flex ${sidebarCollapsed ? 'justify-center' : 'justify-end'}`}>
            <button
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? 'Agrandir le menu' : 'Réduire le menu'}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-[var(--bg-dropdown)] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">{sidebarCollapsed ? 'dock_to_right' : 'dock_to_left'}</span>
            </button>
          </div>

          {/* Brand Logo Header — swaps to an "Admin / Back Office" identity
              while in the admin view, same idea as iziVoice's admin panel,
              so it visually reads as a distinct back office rather than the
              regular app shell with an extra tab bolted on. */}
          {view === 'admin' ? (
            <div className={`mb-6 flex items-center gap-3 ${sidebarCollapsed ? 'px-3 justify-center' : 'px-6'}`} title="KappGen Admin">
              <div className="w-9 h-9 rounded-xl bg-[#00c2ff]/15 border border-[#00c2ff]/30 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[#00c2ff] text-[20px]">shield_person</span>
              </div>
              {!sidebarCollapsed && (
                <div>
                  <div className="font-title-sm text-base font-black text-white tracking-wide">KappGen Admin</div>
                  <div className="text-slate-400 text-xs font-normal">Back Office</div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div
                className={`mb-3 flex items-center gap-3 cursor-pointer ${sidebarCollapsed ? 'px-3 justify-center' : 'px-6'}`}
                onClick={() => { window.location.href = 'https://kappgen.com'; }}
                title="KappGen — Video Automation"
              >
                <img src="/assets/logo/logo-kappgen.png" alt="KappGen" className="w-9 h-9 rounded-xl shadow-lg shadow-[#00c2ff]/20 object-cover flex-shrink-0" />
                {!sidebarCollapsed && (
                  <div>
                    <div className="font-title-sm text-base font-black text-white tracking-wide">KappGen</div>
                    <div className="text-slate-400 text-xs font-normal">Video Automation</div>
                  </div>
                )}
              </div>

              {/* Product Switcher */}
              <div className={`mb-8 relative ${sidebarCollapsed ? 'px-3' : 'px-3'}`}>
                <button
                  onClick={() => setProductMenuOpen(o => !o)}
                  title={NICHECUT_PRODUCTS.find(p => p.id === activeProduct)?.label}
                  className={`w-full py-2 flex items-center gap-2 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-dropdown)] border border-[var(--border)] transition-colors text-left ${sidebarCollapsed ? 'px-0 justify-center' : 'px-3'}`}
                >
                  <span className="material-symbols-outlined text-[16px] text-[#00c2ff] flex-shrink-0">{NICHECUT_PRODUCTS.find(p => p.id === activeProduct)?.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="min-w-0 flex-1 text-xs font-bold text-white truncate">
                        {NICHECUT_PRODUCTS.find(p => p.id === activeProduct)?.label}
                      </span>
                      <span className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform ${productMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    </>
                  )}
                </button>

                {productMenuOpen && (
                  <div className={`absolute top-full mt-1.5 bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden ${sidebarCollapsed ? 'left-0 w-56' : 'left-3 right-3'}`}>
                    {NICHECUT_PRODUCTS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setProductMenuOpen(false);
                          // "Vidéo Musicale" opens the exact same create-wizard flow as
                          // "Nouvelle chaîne" (same shell, sidebar, header) with a
                          // different pipeline — not a separate bolted-on screen. Avatar
                          // has no wizard yet, so it still falls back to its placeholder.
                          setActiveProduct(p.id);
                          if (p.id === 'music') { openCreateWizard('music'); return; }
                          setView('home');
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-xs font-medium flex items-center gap-2.5 hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${p.id === activeProduct ? 'text-[#00c2ff]' : 'text-slate-400'}`}>{p.icon}</span>
                        <span className={`flex-1 ${p.id === activeProduct ? 'text-white font-bold' : 'text-slate-300'}`}>{p.label}</span>
                        {!p.available && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">Bientôt</span>
                        )}
                        {p.id === activeProduct && <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">check</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Navigation Links - Single Active Item Highlighted */}
          {view === 'admin' ? (
            <div className="px-3 space-y-1.5">
              {!sidebarCollapsed && <div className="px-4 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Administration</div>}

              {[
                { id: 'overview', label: "Vue d'ensemble", icon: 'dashboard' },
                { id: 'users', label: 'Utilisateurs', icon: 'group' },
                { id: 'videos', label: 'Vidéos', icon: 'movie' },
                { id: 'library', label: 'Bibliothèque collaborative', icon: 'diversity_3' },
                { id: 'transactions', label: 'Transactions', icon: 'payments' },
                { id: 'costs', label: 'Coûts', icon: 'monitoring' },
                { id: 'resources', label: 'Ressources', icon: 'dns' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setAdminTab(t.id)}
                  title={t.label}
                  className={`w-full flex items-center gap-3.5 py-3 cursor-pointer rounded-xl transition-all font-medium text-sm ${sidebarCollapsed ? 'px-0 justify-center' : 'px-4'} ${
                    adminTab === t.id
                      ? 'bg-gradient-to-r from-[#00c2ff] to-[#0099ff] text-slate-950 font-bold shadow-md shadow-[#00c2ff]/20'
                      : 'text-slate-300 hover:bg-[var(--bg-dropdown)] hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined w-5 shrink-0 text-center text-[20px]" style={{ fontVariationSettings: adminTab === t.id ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
                  {!sidebarCollapsed && <span className="min-w-0 flex-1 text-left leading-tight">{t.label}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 space-y-1.5">
              {[
                { id: 'home', label: 'Home', icon: 'home', active: view === 'home' || view === 'dashboard', onClick: () => setView('home') },
                { id: 'channels', label: 'Mes Chaînes', icon: 'subscriptions', active: view === 'channels' || view === 'channel_detail', onClick: () => setView('channels') },
                { id: 'videos', label: 'Mes Vidéos', icon: 'movie', active: view === 'videos', onClick: () => setView('videos') },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={t.onClick}
                  title={t.label}
                  className={`w-full flex items-center gap-3.5 py-3 cursor-pointer rounded-xl transition-all font-medium text-sm ${sidebarCollapsed ? 'px-0 justify-center' : 'px-4'} ${
                    t.active
                      ? 'bg-gradient-to-r from-[#00c2ff] to-[#0099ff] text-slate-950 font-bold shadow-md shadow-[#00c2ff]/20'
                      : 'text-slate-300 hover:bg-[var(--bg-dropdown)] hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: t.active ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
                  {!sidebarCollapsed && t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {view !== 'admin' && currentUser && (
          <div className={`px-3 pt-4 mt-4 border-t border-[var(--border-soft)] space-y-2`}>
            <button
              onClick={() => setShowPricingModal(true)}
              title={creditBalance != null ? `${creditBalance.toLocaleString()} crédits — Recharger` : 'Offres & Tarifs'}
              className={`w-full flex items-center gap-2 py-2.5 rounded-xl text-sm transition-colors hover:bg-[var(--bg-dropdown)] ${sidebarCollapsed ? 'justify-center px-0' : 'px-3'}`}
            >
              <span className="material-symbols-outlined text-[20px] text-[#00c2ff]">diamond</span>
              {!sidebarCollapsed && (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-xs font-bold text-white">
                    {creditBalance != null ? `${creditBalance.toLocaleString()} crédits` : 'Offres & Tarifs'}
                  </span>
                  <span className="block text-[10px] text-slate-400">Recharger</span>
                </span>
              )}
            </button>
          </div>
        )}

      </nav>

      {/* MAIN CONTENT AREA */}
      <main className={`relative flex-1 flex flex-col pt-14 md:pt-0 h-screen overflow-hidden bg-[var(--bg-input-alt)] transition-[margin] duration-200 ${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'}`}>
        {activeProduct === 'avatar' && (
          <div className="absolute inset-0 z-30 bg-[var(--bg-input-alt)] flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-20 h-20 rounded-2xl bg-[#00c2ff]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[40px] text-[#00c2ff]">face</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">Vidéos Avatar</h2>
            <p className="text-sm text-slate-400 max-w-md">
              Bientôt disponible — des vidéos avec un avatar IA qui parle à la caméra, dans le même esprit de pilote automatique.
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full uppercase tracking-wide">
              <span className="material-symbols-outlined text-[16px]">construction</span> En cours de développement
            </span>
            <button
              onClick={() => setActiveProduct('montage')}
              className="mt-2 px-5 py-2.5 bg-[var(--bg-surface-alt)] text-white rounded-xl font-bold text-xs hover:bg-[var(--border-soft)] transition-colors border border-[var(--border)]"
            >
              Retour à Montage Simple
            </button>
          </div>
        )}
        
        {/* Top Header Bar */}
        <div className="relative z-30 hidden md:flex justify-between items-center px-8 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-soft)]/60 backdrop-blur-md">
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {view === 'home' && 'Tableau de Bord'}
            {view === 'channels' && 'Vos Pipelines de Chaînes'}
            {view === 'videos' && 'Bibliothèque de Vidéos'}
            {view === 'wizard' && (wizardMode === 'edit' ? 'Modifier le Pipeline' : 'Assistant de Création de Chaîne')}
            {view === 'channel_detail' && (activeChannel ? `Chaîne: ${activeChannel.name}` : 'Détail Chaîne')}
            {view === 'settings' && 'Paramètres'}
          </h1>

          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="relative focus-glow rounded-xl">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: '18px' }}>search</span>
              <input 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none w-60 transition-all" 
                placeholder="Rechercher une chaîne..." 
                type="text"
              />
            </div>

            {/* Quick theme toggle — flips light/dark directly; 'auto' (follow OS)
                stays a Paramètres-only choice since a two-state icon button can't
                represent three states cleanly. */}
            <button
              onClick={() => setThemePreference(resolveEffectiveTheme(themePreference) === 'dark' ? 'light' : 'dark')}
              title={resolveEffectiveTheme(themePreference) === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[#00c2ff]/50 transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {resolveEffectiveTheme(themePreference) === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Admin shortcut — only ever visible to admins; the route itself is
                already gated server-side regardless. While already in admin,
                this becomes a "back to app" button instead. */}
            {currentUser?.is_admin && (
              <button
                onClick={() => setView(view === 'admin' ? 'home' : 'admin')}
                title={view === 'admin' ? "Retour à l'app" : 'Administration'}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0 border ${
                  view === 'admin'
                    ? 'bg-[#00c2ff]/10 text-[#00c2ff] border-[#00c2ff]/50'
                    : 'text-slate-400 hover:text-white bg-[var(--bg-surface-alt)] border-[var(--border)] hover:border-[#00c2ff]/50'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {view === 'admin' ? 'arrow_back' : 'shield_person'}
                </span>
              </button>
            )}

            {/* Profile widget — top right */}
            {currentUser ? (
              <div ref={profileMenuRef} className="relative flex-shrink-0">
                <div
                  onClick={() => setProfileMenuOpen(o => !o)}
                  className="w-9 h-9 rounded-full cursor-pointer transition-all shadow-sm ring-2 ring-transparent hover:ring-[#00c2ff]/50 flex-shrink-0 overflow-hidden"
                  title="Mon compte"
                >
                  {currentUser.picture_url ? (
                    <img src={currentUser.picture_url} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-[#00c2ff] text-slate-950 flex items-center justify-center font-bold text-sm">
                      {currentUser.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                {profileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl shadow-2xl z-[70] overflow-hidden py-1.5">
                    <div className="px-3.5 py-2.5 border-b border-[var(--border-soft)]">
                      <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                    </div>
                    <button
                      onClick={() => { setView('settings'); setProfileMenuOpen(false); }}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-bold flex items-center gap-2 text-slate-300 hover:bg-[var(--bg-surface-alt)] hover:text-white transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">settings</span>
                      Paramètres
                    </button>
                    {currentUser.is_admin && (
                      <button
                        onClick={() => { setView('admin'); setProfileMenuOpen(false); }}
                        className="w-full text-left px-3.5 py-2.5 text-xs font-bold flex items-center gap-2 text-slate-300 hover:bg-[var(--bg-surface-alt)] hover:text-white transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">shield_person</span>
                        Administration
                      </button>
                    )}
                    <button
                      onClick={() => { handleLogout(); setProfileMenuOpen(false); }}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-bold flex items-center gap-2 text-rose-400 hover:bg-rose-950/50 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="py-2 px-4 bg-[#00c2ff] text-slate-950 rounded-xl font-bold text-xs hover:bg-[#38d0ff] transition-colors flex items-center gap-2 shadow-md flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">account_circle</span>
                Connexion
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Canvas View Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-[1400px] mx-auto space-y-8">
            
            {/* VIEW 1: HOME / DASHBOARD OVERVIEW */}
            {(view === 'home' || view === 'dashboard') && (
              <>
                <div className="pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#55d8ff] mb-2">Ton espace KappGen</p>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-[-.02em]">
                    Salut {currentUser?.name?.split(' ')[0] || ''}, vas te détendre
                  </h1>
                </div>

                {/* A single quiet promise card, integrated into the existing dashboard language. */}
                <section className="relative min-h-[420px] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_80%_50%,rgba(0,194,255,.08),transparent_46%),var(--bg-surface)]">
                  <img
                    src={freedomSunrise}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover object-center md:object-right opacity-80"
                    style={{
                      WebkitMaskImage: 'radial-gradient(ellipse 68% 125% at 65% 50%, #000 28%, rgba(0,0,0,.92) 48%, transparent 82%)',
                      maskImage: 'radial-gradient(ellipse 68% 125% at 65% 50%, #000 28%, rgba(0,0,0,.92) 48%, transparent 82%)'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-surface)] via-[var(--bg-surface)]/55 to-transparent pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0f141c]/65 to-transparent pointer-events-none" />
                  <div className="relative z-10 min-h-[420px] flex flex-col justify-center p-6 md:p-8 max-w-xl">
                    <h3 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">Tu vis. KappGen travaille.</h3>
                    <p className="text-sm text-slate-400 leading-6 mt-3 max-w-md">KappGen AI prépare tes vidéos et veille sur tes publications. Voyage, repose-toi ou profite simplement de ton temps.</p>
                    <div className="flex items-center gap-3 mt-6">
                      <button onClick={productChannels.length ? () => setView('channels') : () => openCreateWizard(activeProductContentType)} className="px-5 py-2.5 bg-[#00c2ff] hover:bg-[#38d0ff] text-slate-950 font-bold text-xs rounded-xl transition-colors">
                        {productChannels.length ? 'Voir mes chaînes' : 'Configurer une chaîne'}
                      </button>
                      <button onClick={() => openNewVideoFlow(productChannels, activeProductContentType)} className="text-xs font-bold text-slate-300 hover:text-white transition-colors">Créer une vidéo</button>
                    </div>
                  </div>
                </section>

                {/* Pipelines Preview in Home */}
                <section>
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-bold text-white">Aperçu des Chaînes</h3>
                  </div>

                  {productChannels.length === 0 ? (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-10 text-center">
                      <span className="material-symbols-outlined text-[48px] text-slate-500 mb-3">subscriptions</span>
                      <h4 className="text-base font-bold text-white mb-1">Aucune chaîne configurée</h4>
                      <p className="text-xs text-slate-400 mb-5">Configure ton univers une fois. KappGen s’occupera de la suite.</p>
                      <button onClick={() => openCreateWizard(activeProductContentType)} className="px-5 py-2.5 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl">
                        + Créer une chaîne
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {[...productChannels]
                        .sort((a, b) =>
                          ((b.queued_count || 0) + (b.rendering_count || 0) + (b.done_count || 0)) -
                          ((a.queued_count || 0) + (a.rendering_count || 0) + (a.done_count || 0))
                        )
                        .slice(0, 3)
                        .map(chan => {
                        const statusInfo = getChannelStatusInfo(chan);
                        return (
                          <div 
                            key={chan.id} 
                            onClick={() => { setActiveChannel(chan); fetchChannelVideos(chan.id); setView('channel_detail'); }}
                            className="bg-[var(--bg-surface)] border border-[var(--border-soft)] hover:border-[#00c2ff]/40 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 shadow-md space-y-4"
                          >
                            <div className="flex items-center gap-3">
                              <ChannelAvatar channel={chan} logoUrl={getChannelLogoUrl(chan)} sizeClass="w-12 h-12" roundedClass="rounded-xl" textClass="text-lg" />
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-white text-sm truncate">{chan.name}</h4>
                                <span className="text-xs text-slate-400 block truncate">{chan.niche}</span>
                              </div>
                              {chan.automation_mode === 'auto' ? (
                                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-[#00c2ff] bg-[#00c2ff]/10 px-2 py-1 rounded-lg uppercase" title="Publication automatique quotidienne">
                                  <span className="material-symbols-outlined text-[13px]">bolt</span> Auto
                                </span>
                              ) : (
                                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-500/10 px-2 py-1 rounded-lg uppercase" title="Tu soumets chaque script toi-même">
                                  Manuel
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--border-subtle)]">
                              <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${statusInfo.className}`}>
                                {statusInfo.label}
                              </span>
                              <span className="text-slate-400">{chan.done_count || 0} vidéos prêtes</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* VIEW 2: MES CHAÎNES (Dedicated Channel Pipelines Cards List with 3-Dots Menu) */}
            {view === 'channels' && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold text-white">Vos Pipelines de Chaînes</h2>
                  <p className="text-xs text-slate-400 mt-1">Configurez l'identité, les sous-titres et les effets de vos chaînes automatiques.</p>
                </div>

                {!channelsLoaded ? (
                  <SkeletonGrid count={6} />
                ) : channelsLoadError ? (
                  <div className="bg-rose-950/40 border border-rose-800 rounded-2xl p-8 text-center">
                    <span className="material-symbols-outlined text-[46px] text-rose-400 mb-3">cloud_off</span>
                    <h3 className="text-lg font-bold text-white mb-2">Chargement impossible</h3>
                    <p className="text-sm text-rose-200 mb-5">{channelsLoadError}</p>
                    <button onClick={fetchChannels} className="bg-rose-200 text-rose-950 px-5 py-2.5 rounded-xl font-bold text-sm">
                      Réessayer
                    </button>
                  </div>
                ) : filteredChannels.length === 0 ? (
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-[54px] text-slate-500 mb-4">video_settings</span>
                    <h3 className="text-lg font-bold text-white mb-2">Aucune chaîne trouvée</h3>
                    <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                      Configurez votre premier pipeline vidéo (sous-titres karaoké, logo, musique de fond, images) et générez sans limite.
                    </p>
                    <button 
                      onClick={() => openCreateWizard(activeProductContentType)}
                      className="bg-[#00c2ff] text-slate-950 px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#38d0ff] transition-all shadow-lg inline-flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined">add</span> Créer un Pipeline de Chaîne
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Add Channel Card — kept first so it stays easy to find as the
                        channel list grows, instead of getting pushed further down
                        every time a new channel is added. */}
                    <button
                      onClick={() => openCreateWizard(activeProductContentType)}
                      className="rounded-2xl p-5 border-2 border-dashed border-[var(--border)] hover:border-[#00c2ff] hover:bg-[var(--bg-surface)] transition-all flex flex-col items-center justify-center gap-3 min-h-[220px] text-slate-400 hover:text-[#00c2ff] group"
                    >
                      <div className="w-14 h-14 rounded-full bg-[var(--bg-surface-alt)] group-hover:bg-[#00c2ff]/10 flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[28px]">add</span>
                      </div>
                      <span className="font-bold text-sm">Ajouter une Chaîne</span>
                    </button>

                    {filteredChannels.map(chan => {
                      const logoUrl = getChannelLogoUrl(chan);
                      const statusInfo = getChannelStatusInfo(chan);
                      const isMenuOpen = openChannelMenuId === chan.id;

                      return (
                        <div
                          key={chan.id}
                          onClick={() => { setActiveChannel(chan); fetchChannelVideos(chan.id); setView('channel_detail'); }}
                          className="bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-soft)] hover:border-[#00c2ff]/40 rounded-2xl p-5 transition-all cursor-pointer group flex flex-col justify-between min-h-[220px] shadow-lg relative card-warm-hover channel-menu-container"
                        >
                          {/* Card Header & 3-Dots Action Button */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="relative shrink-0">
                                <ChannelAvatar channel={chan} logoUrl={logoUrl} sizeClass="w-12 h-12" textClass="text-lg" />
                                <span
                                  className={`absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full ${getChannelStatusDotColor(chan)} ring-2 ring-[var(--bg-surface)]`}
                                  title={chan.is_render_ready ? (chan.failed_count > 0 ? 'Échec de rendu à corriger' : 'Chaîne active') : 'Configuration incomplète'}
                                />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-base text-white group-hover:text-[#00c2ff] transition-colors truncate">{chan.name}</h4>
                                <span className="text-xs font-medium text-slate-400 truncate block mt-0.5">{chan.niche}</span>
                              </div>
                            </div>

                            {/* 3-Dots Menu Button (Kebab Menu) */}
                            <div className="relative flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenChannelMenuId(isMenuOpen ? null : chan.id);
                                }}
                                className="p-2 rounded-xl hover:bg-[#2a3547] text-slate-400 hover:text-white transition-colors"
                                title="Actions chaîne"
                              >
                                <span className="material-symbols-outlined text-[20px]">more_vert</span>
                              </button>

                              {/* Dropdown Popup Menu */}
                              {isMenuOpen && (
                                <div className="absolute right-0 top-10 w-48 bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in duration-150">
                                  <button
                                    onClick={(e) => openEditWizard(chan, e)}
                                    className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">edit</span>
                                    Modifier la chaîne
                                  </button>
                                  <button
                                    onClick={(e) => handleToggleChannelActive(chan, e)}
                                    className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-amber-400">{chan.is_active === false ? 'play_circle' : 'pause_circle'}</span>
                                    {chan.is_active === false ? 'Réactiver la chaîne' : 'Désactiver la chaîne'}
                                  </button>
                                  <div className="h-[1px] bg-[var(--border-dropdown)] my-1"></div>
                                  <button
                                    onClick={(e) => handleDeleteChannel(chan.id, e)}
                                    className="w-full text-left px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-950/50 flex items-center gap-2 font-medium"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                    Supprimer la chaîne
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Status Tag */}
                          <div className="mt-4">
                            <span className={`inline-block px-3 py-1 rounded-lg text-[11px] font-bold ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </div>

                          {/* Counters Grid */}
                          <div className="grid grid-cols-2 gap-2 mt-4">
                            <div className="bg-[var(--bg-input)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">En File</div>
                              <div className="text-base text-[#00c2ff] font-extrabold mt-0.5">{(chan.queued_count || 0) + (chan.rendering_count || 0)}</div>
                            </div>
                            <div className="bg-[var(--bg-input)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Vidéos Prêtes</div>
                              <div className="text-base text-white font-extrabold mt-0.5">{chan.done_count || 0}</div>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* VIEW 3: MES VIDÉOS (Videos Library View) */}
            {view === 'videos' && (
              <section className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-white">Bibliothèque de Vidéos</h2>
                    <p className="text-xs text-slate-400 mt-1">Historique de tous les sujets de vidéos rendus ou en cours de traitement.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Channel Filter Selector */}
                    <select
                      value={videoFilterChannelId}
                      onChange={e => setVideoFilterChannelId(e.target.value)}
                      className="bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="all">Toutes les chaînes ({productChannels.length})</option>
                      {productChannels.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => videoSelectionMode ? exitVideoSelectionMode() : setVideoSelectionMode(true)}
                      className={`px-4 py-2 font-bold text-xs rounded-xl transition-all flex items-center gap-2 flex-shrink-0 border ${
                        videoSelectionMode ? 'bg-[#00c2ff]/10 text-[#00c2ff] border-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] text-slate-300 hover:text-white border-[var(--border)]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{videoSelectionMode ? 'close' : 'checklist'}</span>
                      {videoSelectionMode ? 'Annuler' : 'Sélectionner'}
                    </button>
                    <button
                      onClick={() => openNewVideoFlow(productChannels, activeProductContentType)}
                      className="px-4 py-2 bg-[#00c2ff] hover:bg-[#38d0ff] text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md shadow-[#00c2ff]/20 flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Nouvelle Vidéo
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                <aside className={`flex-shrink-0 space-y-1 transition-[width] duration-200 ${folderSidebarCollapsed ? 'w-10' : 'w-48'}`}>
                  <button
                    onClick={toggleFolderSidebarCollapsed}
                    title={folderSidebarCollapsed ? 'Agrandir les dossiers' : 'Réduire les dossiers'}
                    className={`w-full flex items-center py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--bg-hover)] transition-colors mb-1 ${folderSidebarCollapsed ? 'justify-center' : 'justify-end px-1'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{folderSidebarCollapsed ? 'dock_to_right' : 'dock_to_left'}</span>
                  </button>
                  <button
                    onClick={() => { setCurrentFolderId(null); setVideoFilterFolderId('all'); }}
                    onDragOver={(e) => { if (draggedVideoId) { e.preventDefault(); setDragOverFolderId('all'); } }}
                    onDragLeave={() => setDragOverFolderId(id => id === 'all' ? null : id)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverFolderId(null);
                      const videoId = draggedVideoId || e.dataTransfer.getData('text/plain');
                      setDraggedVideoId(null);
                      if (videoId) moveVideoToFolder(videoId, null);
                    }}
                    title={`Toutes (${allVideos.filter(v => productChannelIds.has(v.channel_id)).length})`}
                    className={`w-full text-left py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${folderSidebarCollapsed ? 'px-0 justify-center' : 'px-2'} ${
                      videoFilterFolderId === 'all' ? 'bg-[#00c2ff] text-slate-950' : 'text-slate-300 hover:text-white hover:bg-[var(--bg-hover)]'
                    } ${dragOverFolderId === 'all' ? 'ring-2 ring-[#00c2ff] ring-offset-1 ring-offset-[var(--bg-page)]' : ''}`}
                  >
                    <span className="material-symbols-outlined text-[15px]">apps</span> {!folderSidebarCollapsed && `Toutes (${allVideos.filter(v => productChannelIds.has(v.channel_id)).length})`}
                  </button>
                  {renderFolderTree(null, 0)}
                  <button
                    onClick={() => setShowNewFolderModal(true)}
                    title="Nouveau dossier"
                    className={`w-full text-left py-1.5 rounded-lg text-xs font-bold text-[#00c2ff] hover:bg-[#00c2ff]/10 border border-dashed border-[#00c2ff]/40 flex items-center gap-1.5 transition-all ${folderSidebarCollapsed ? 'px-0 justify-center' : 'px-2'}`}
                  >
                    <span className="material-symbols-outlined text-[15px]">create_new_folder</span> {!folderSidebarCollapsed && 'Nouveau dossier'}
                  </button>
                </aside>

                <div className="flex-1 min-w-0 space-y-6">

                {videoSelectionMode && (
                  <div className="sticky top-0 z-10 bg-[#0f1621] border border-[#00c2ff]/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
                    <span className="text-xs font-bold text-white">{selectedVideoIds.size} vidéo(s) sélectionnée(s)</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedVideoIds(new Set(
                          allVideos
                            .filter(v => productChannelIds.has(v.channel_id))
                            .filter(v => videoFilterChannelId === 'all' || v.channel_id === videoFilterChannelId)
                            .filter(v => videoFilterFolderId === 'all' || v.folder_id === videoFilterFolderId)
                            .map(v => v.id)
                        ))}
                        className="text-xs font-bold text-slate-300 hover:text-white px-2"
                      >
                        Tout sélectionner
                      </button>
                      <button
                        onClick={handleBulkDeleteVideos}
                        disabled={selectedVideoIds.size === 0}
                        className="px-3.5 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Supprimer ({selectedVideoIds.size})
                      </button>
                    </div>
                  </div>
                )}

                {/* Folder navigation — file-explorer style: breadcrumb for the
                    current path, then the folders and "Toutes" reset live as
                    drop targets right below it. */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <button
                    onClick={() => openFolder(null)}
                    className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${currentFolderId === null ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">home</span>
                  </button>
                  {folderPath.map((f, i) => (
                    <span key={f.id} className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-slate-600">chevron_right</span>
                      <button
                        onClick={() => openFolder(f.id)}
                        className={`px-2 py-1 rounded-lg font-bold transition-colors ${i === folderPath.length - 1 ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {f.name}
                      </button>
                    </span>
                  ))}
                </div>

                {/* Visual Video Cards Grid */}
                {!videosLoaded ? (
                  <SkeletonGrid count={8} cardClassName="min-h-[260px]" />
                ) : videosLoadError ? (
                  <div className="bg-rose-950/40 border border-rose-800 rounded-2xl p-8 text-center">
                    <span className="material-symbols-outlined text-[46px] text-rose-400 mb-3">cloud_off</span>
                    <h3 className="text-lg font-bold text-white mb-2">Chargement impossible</h3>
                    <p className="text-sm text-rose-200 mb-5">{videosLoadError}</p>
                    <button onClick={fetchAllVideos} className="bg-rose-200 text-rose-950 px-5 py-2.5 rounded-xl font-bold text-sm">
                      Réessayer
                    </button>
                  </div>
                ) : allVideos.filter(v => productChannelIds.has(v.channel_id)).length === 0 ? (
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-[54px] text-slate-500 mb-3">movie</span>
                    <h3 className="text-base font-bold text-white mb-1">Aucune vidéo dans l'historique</h3>
                    <p className="text-xs text-slate-400 mb-5">Lancez votre première génération de vidéo.</p>
                    <button
                      onClick={() => openNewVideoFlow(productChannels, activeProductContentType)}
                      className="px-5 py-2.5 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl"
                    >
                      + Nouvelle Vidéo
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {allVideos
                      .filter(v => productChannelIds.has(v.channel_id))
                      .filter(v => videoFilterChannelId === 'all' || v.channel_id === videoFilterChannelId)
                      .filter(v => videoFilterFolderId === 'all' || v.folder_id === videoFilterFolderId)
                      .map(vid => {
                        const channelObj = channels.find(c => c.id === vid.channel_id);
                        const isSelected = selectedVideoIds.has(vid.id);
                        return (
                          <div
                            key={vid.id}
                            onClick={() => videoSelectionMode && toggleVideoSelected(vid.id)}
                            draggable={!videoSelectionMode}
                            onDragStart={(e) => { setDraggedVideoId(vid.id); e.dataTransfer.setData('text/plain', vid.id); e.dataTransfer.effectAllowed = 'move'; }}
                            onDragEnd={() => { setDraggedVideoId(null); setDragOverFolderId(null); }}
                            className={`bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border rounded-2xl p-4 transition-all group flex flex-col justify-between shadow-lg relative card-warm-hover video-menu-container ${
                              videoSelectionMode ? 'cursor-pointer ' + (isSelected ? 'border-[#00c2ff]' : 'border-[var(--border-soft)]') : 'border-[var(--border-soft)] hover:border-[#00c2ff]/40 cursor-grab active:cursor-grabbing'
                            } ${draggedVideoId === vid.id ? 'opacity-40' : ''}`}
                          >
                            {videoSelectionMode && (
                              <div className={`absolute top-2.5 left-2.5 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSelected ? 'bg-[#00c2ff] border-[#00c2ff]' : 'bg-slate-950/70 border-slate-500'}`}>
                                {isSelected && <span className="material-symbols-outlined text-[14px] text-slate-950">check</span>}
                              </div>
                            )}
                            {/* Video Poster Frame — click opens the big preview player directly */}
                            <div
                              onClick={(e) => { if (videoSelectionMode) { e.stopPropagation(); toggleVideoSelected(vid.id); return; } vid.status === 'done' && setSelectedVideo(vid); }}
                              className={`aspect-[16/9] bg-slate-950 rounded-xl relative overflow-hidden border border-[var(--border)] flex items-center justify-center ${vid.status === 'done' ? 'cursor-pointer group' : ''}`}
                            >
                              {regeneratingCardThumbnailIds.has(vid.id) && (
                                <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                  <span className="material-symbols-outlined text-[32px] text-[#00c2ff] animate-spin">progress_activity</span>
                                  <span className="text-[10px] font-bold text-white">Régénération de la miniature…</span>
                                </div>
                              )}
                              {vid.status === 'done' && vid.output_path ? (
                                <>
                                  <video
                                    src={getVideoUrl(vid.output_path)}
                                    poster={getVideoThumbnailUrl(vid, thumbnailBust[vid.id])}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    preload="metadata"
                                  />
                                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[48px] text-[#00c2ff] drop-shadow-lg group-hover:scale-110 transition-transform">play_circle</span>
                                  </div>
                                  {vid.duration_seconds != null && (
                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                                      {formatDuration(vid.duration_seconds)}
                                    </div>
                                  )}
                                  {vid.progress_stage && /youtube|miniature/i.test(vid.progress_stage) && !vid.youtube_video_id && !vid.youtube_publish_error && (
                                    <div className="absolute inset-x-0 bottom-0 bg-black/85 px-2 py-1.5 flex items-center gap-1.5">
                                      <YouTubeIcon className="w-3.5 h-2.5 animate-pulse" />
                                      <span className="text-[9px] font-bold text-white truncate">{vid.progress_stage}</span>
                                    </div>
                                  )}
                                </>
                              ) : vid.status === 'rendering' ? (
                                <div className="px-4 py-5 text-center w-full max-w-[245px]">
                                  <PipelineStepper stage={vid.progress_stage} percent={vid.progress_percent} />
                                  <div className="mt-4 text-[11px] font-bold text-slate-100 truncate">{vid.progress_stage || 'Rendu en cours…'}</div>
                                  <div className="mt-2.5 h-1 rounded-full bg-slate-800/90 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#20bff0] to-[#62dcff] transition-all duration-700 rounded-full" style={{ width: `${vid.progress_percent || 2}%` }} />
                                  </div>
                                  <div className="mt-2 flex items-center justify-between text-[9px] font-mono">
                                    <span className="text-[#5ddaff] font-bold">{vid.progress_percent || 2}%</span>
                                    {vid.started_at && <span className="text-slate-500">{formatElapsed(vid.started_at)}</span>}
                                  </div>
                                </div>
                              ) : vid.status === 'failed' ? (
                                <div className="w-full h-full px-4 py-3 text-center flex flex-col items-center justify-center gap-1.5">
                                  <span className="material-symbols-outlined text-[38px] leading-none text-rose-400">warning</span>
                                  <div className="text-[11px] font-extrabold text-rose-300">Échec</div>
                                  <div className="max-w-full text-[9px] leading-relaxed text-rose-300/80 line-clamp-2" title={vid.error_message || ''}>
                                    {(vid.error_message || 'Erreur inconnue').split('\n')[0]}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRetryVideo(vid.id); }}
                                    title="Relancer la génération"
                                    className="mt-0.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00c2ff] px-4 py-1.5 text-[11px] font-extrabold text-slate-950 shadow-lg shadow-[#00c2ff]/20 transition-all hover:bg-[#32ceff] hover:scale-[1.03] active:scale-95"
                                  >
                                    <span className="material-symbols-outlined text-[19px]">refresh</span>
                                    Relancer
                                  </button>
                                </div>
                              ) : vid.status === 'done' ? (
                                <div className="p-4 text-center space-y-2">
                                  <span className="material-symbols-outlined text-[36px] text-slate-500">inventory_2</span>
                                  <div className="text-[11px] font-bold font-mono text-slate-400">Fichier expiré</div>
                                  <div className="text-[9px] text-slate-500">Rendu terminé, fichier purgé après la période de rétention.</div>
                                </div>
                              ) : (
                                <div className="p-4 text-center space-y-2">
                                  <span className="material-symbols-outlined text-[36px] text-amber-400">hourglass_empty</span>
                                  <div className="text-[11px] font-bold font-mono text-amber-300">En file d'attente</div>
                                </div>
                              )}

                              {/* Status Badge Top Left */}
                              {vid.status !== 'rendering' && <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${
                                  vid.status === 'done' ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/80' :
                                  vid.status === 'failed' ? 'bg-rose-950/90 text-rose-300 border border-rose-700/80' :
                                  'bg-amber-950/90 text-amber-300 border border-amber-700/80'
                                }`}>
                                  {vid.status === 'done' ? 'Prête' : vid.status === 'failed' ? 'Échec' : 'En file'}
                                </span>
                                {/* Published-to-YouTube marker — prevents re-publishing the same
                                    video by mistake, since the main "Publier"/"Voir" button text
                                    alone was easy to miss at a glance across a whole grid. */}
                                {vid.youtube_video_id && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-red-950/90 text-red-300 border border-red-700/80">
                                    <span className="material-symbols-outlined text-[11px]">check_circle</span>
                                    Publiée
                                  </span>
                                )}
                              </div>}
                            </div>

                            {/* Kebab Menu Top Right — rendered outside the poster frame so the
                                dropdown (incl. "Supprimer") is never clipped by its overflow-hidden */}
                            <div className="absolute top-6 right-6 z-20">
                              <button
                                onClick={(e) => openVideoMenu(vid.id, e)}
                                className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors shadow-md"
                                title="Actions vidéo"
                              >
                                <span className="material-symbols-outlined text-[16px]">more_vert</span>
                              </button>
                              {openVideoMenuId === vid.id && videoMenuAnchor && createPortal(
                                <div style={{ position: 'fixed', top: videoMenuAnchor.top ?? undefined, bottom: videoMenuAnchor.bottom ?? undefined, right: videoMenuAnchor.right, maxHeight: videoMenuAnchor.maxHeight, overflowY: 'auto' }} className="video-menu-container w-44 bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-[100] py-1.5">
                                  {vid.status === 'done' && (
                                    <button onClick={(e) => openRenameModal(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium">
                                      <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">drive_file_rename_outline</span> Renommer
                                    </button>
                                  )}
                                  {vid.status === 'done' && (
                                    <button onClick={(e) => openThumbnailModal(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium">
                                      <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">photo_camera</span> Voir la miniature
                                    </button>
                                  )}
                                  {vid.status === 'done' && vid.editable && (
                                    <button onClick={(e) => { e.stopPropagation(); setOpenVideoMenuId(null); openStudio(vid); }} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium">
                                      <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">movie_edit</span> Éditer la vidéo
                                    </button>
                                  )}
                                  {vid.status === 'done' && (
                                    <button onClick={(e) => handleDownloadVideo(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium">
                                      <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">download</span> Télécharger
                                    </button>
                                  )}
                                  {vid.status === 'done' && (
                                    <button disabled={togglingRetentionId === vid.id} onClick={(e) => handleToggleExtendedRetention(vid, e)} title="Par défaut, une vidéo est supprimée du serveur après 48h." className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                      <span className={`material-symbols-outlined text-[16px] ${vid.extended_retention ? 'text-emerald-400' : 'text-[#00c2ff]'}`}>{vid.extended_retention ? 'lock_clock' : 'schedule'}</span>
                                      {vid.extended_retention ? 'Conservée plus longtemps' : 'Conserver plus longtemps'}
                                    </button>
                                  )}
                                  {vid.status === 'done' && vid.scheduled_publish_at && !vid.youtube_video_id && (
                                    <button disabled={approvingVideoId === vid.id} onClick={(e) => handleToggleApproval(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                      <span className={`material-symbols-outlined text-[16px] ${vid.approved_for_publish ? 'text-emerald-400' : 'text-[#00c2ff]'}`}>{vid.approved_for_publish ? 'check_circle' : 'pending'}</span>
                                      {vid.approved_for_publish ? 'Approuvée — annuler' : 'Approuver la publication'}
                                    </button>
                                  )}
                                  {vid.status === 'done' && (
                                    <button disabled={publishingVideoId === vid.id} onClick={(e) => handlePublishYouTube(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                      <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">{vid.youtube_video_id ? 'open_in_new' : 'smart_display'}</span>
                                      {vid.youtube_video_id ? 'Voir sur YouTube' : publishingVideoId === vid.id ? 'Publication…' : 'Publier sur YouTube'}
                                    </button>
                                  )}
                                  {vid.status === 'done' && vid.youtube_video_id && (
                                    <button disabled={resyncingThumbnailId === vid.id} onClick={(e) => handleResyncThumbnail(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                      <span className={`material-symbols-outlined text-[16px] text-[#00c2ff] ${resyncingThumbnailId === vid.id ? 'animate-spin' : ''}`}>{resyncingThumbnailId === vid.id ? 'progress_activity' : 'image'}</span>
                                      {resyncingThumbnailId === vid.id ? 'Mise à jour…' : 'Mettre à jour la miniature'}
                                    </button>
                                  )}
                                  {vid.status === 'done' && (
                                    <button disabled={reusingAudioId === vid.id} onClick={(e) => handleReuseAudio(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                      <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">graphic_eq</span> {reusingAudioId === vid.id ? 'Récupération…' : "Réutiliser l'audio"}
                                    </button>
                                  )}
                                  {vid.status === 'done' && vid.editable && (
                                    <button onClick={(e) => { e.stopPropagation(); setOpenVideoMenuId(null); openStudio(vid); }} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium">
                                      <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">auto_fix_high</span> Éditer
                                    </button>
                                  )}
                                  <div className="h-[1px] bg-[var(--border-dropdown)] my-1"></div>
                                  <button onClick={(e) => { e.stopPropagation(); setMovingVideoId(movingVideoId === vid.id ? null : vid.id); }} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium">
                                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">drive_file_move</span> Déplacer vers…
                                  </button>
                                  {movingVideoId === vid.id && (
                                    <div className="border-t border-[var(--border-dropdown)] mt-1 pt-1 max-h-40 overflow-y-auto">
                                      {vid.folder_id && (
                                        <button onClick={(e) => { e.stopPropagation(); moveVideoToFolder(vid.id, null); }} className="w-full text-left px-4 py-2 text-[11px] text-slate-400 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2">
                                          <span className="material-symbols-outlined text-[14px]">folder_off</span> Retirer du dossier
                                        </button>
                                      )}
                                      {folders.length === 0 ? (
                                        <p className="px-4 py-2 text-[11px] text-slate-500">Aucun dossier — créez-en un.</p>
                                      ) : folders.map(f => (
                                        <button
                                          key={f.id}
                                          onClick={(e) => { e.stopPropagation(); moveVideoToFolder(vid.id, f.id); }}
                                          className="w-full text-left px-4 py-2 text-[11px] text-slate-300 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 truncate"
                                        >
                                          <span className="material-symbols-outlined text-[14px] text-[#00c2ff]">folder</span> {f.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <div className="h-[1px] bg-[var(--border-dropdown)] my-1"></div>
                                  <button onClick={(e) => handleDeleteVideo(vid.id, e)} className="w-full text-left px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-950/50 flex items-center gap-2 font-medium">
                                    <span className="material-symbols-outlined text-[16px]">delete</span> Supprimer
                                  </button>
                                </div>,
                                document.body
                              )}
                            </div>

                            {/* Card Content Information */}
                            <div className="mt-3 space-y-2 flex-1 flex flex-col justify-between">
                              <div>
                                {channelObj && (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <ChannelAvatar channel={channelObj} logoUrl={getChannelLogoUrl(channelObj)} sizeClass="w-4 h-4" roundedClass="rounded-md" textClass="text-[8px]" />
                                    <span className="text-[11px] font-bold text-[#00c2ff] truncate">{channelObj.name}</span>
                                  </div>
                                )}

                                {editingTitleId === vid.id ? (
                                  <input
                                    autoFocus
                                    value={editingTitleValue}
                                    onChange={(e) => setEditingTitleValue(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={() => commitTitleEdit(vid)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.currentTarget.blur(); }
                                      if (e.key === 'Escape') { setEditingTitleId(null); }
                                    }}
                                    className="w-full bg-[var(--bg-surface-alt)] border border-[#00c2ff] rounded-lg px-2 py-1 text-white text-xs font-semibold outline-none"
                                  />
                                ) : (
                                  <p
                                    onDoubleClick={(e) => startEditingTitle(vid, e)}
                                    className="text-white text-xs font-semibold line-clamp-2 cursor-text"
                                    title="Double-cliquez pour renommer"
                                  >
                                    {vid.title || vid.script_text}
                                  </p>
                                )}
                                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                  {formatRelativeDate(vid.finished_at || vid.created_at)}
                                </p>
                              </div>

                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                </div>
                </div>
              </section>
            )}

            {/* VIEW 4: CHANNEL DETAIL VIEW */}
            {view === 'channel_detail' && activeChannel && (
              <div className="space-y-8">
                <section className="relative overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,.10)]">
                  <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#00c2ff]/[.055] blur-3xl pointer-events-none" />
                  <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-7">
                  {/* xl:contents makes this wrapper disappear from the layout at xl+ (its
                      two children rejoin the row above as before); below xl it's a real
                      row so "Nouvelle Vidéo" sits next to the channel name instead of
                      wrapping to its own line under the sync/actions cluster. */}
                  <div className="flex items-center justify-between gap-3 xl:contents">
                  <div
                    onClick={(e) => openEditWizard(activeChannel, e)}
                    title="Modifier la configuration de la chaîne"
                    className="flex items-center gap-5 sm:gap-6 min-w-0 cursor-pointer -m-2 p-2 rounded-2xl hover:bg-white/[.03] transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#36d5ff]/35 to-[#6b7dff]/10 blur-sm" />
                      <div className="relative">
                        <ChannelAvatar channel={activeChannel} logoUrl={getChannelLogoUrl(activeChannel)} sizeClass="w-16 h-16 sm:w-20 sm:h-20" roundedClass="rounded-2xl" textClass="text-2xl" />
                        {(() => {
                          const s = getChannelStatusInfo(activeChannel);
                          return (
                            <span
                              title={s.label}
                              className={`absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full ${getChannelStatusDotColor(activeChannel)} ring-[3px] ring-[var(--bg-surface)]`}
                            />
                          );
                        })()}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-extrabold text-white truncate tracking-[-.025em] flex items-center gap-2">
                        <span className="truncate">{activeChannel.name}</span>
                        <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0" aria-hidden="true">edit</span>
                      </h1>
                      {activeChannel.youtube_channel_handle && (
                        <div className="text-slate-400 text-[11px] font-medium mt-0.5">{activeChannel.youtube_channel_handle}</div>
                      )}
                      {activeChannel.youtube_connected ? (
                        <div className="inline-flex items-center gap-1.5 mt-2.5">
                          <a
                            href={
                              activeChannel.youtube_channel_handle
                                ? `https://www.youtube.com/${activeChannel.youtube_channel_handle.startsWith('@') ? activeChannel.youtube_channel_handle : `@${activeChannel.youtube_channel_handle}`}`
                                : `https://www.youtube.com/channel/${activeChannel.youtube_channel_id}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Ouvrir la chaîne sur YouTube"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-[.1em] bg-[#00c2ff]/10 text-[#00c2ff] border border-[#00c2ff]/30 hover:bg-[#00c2ff]/20 transition-colors"
                          >
                            <YouTubeIcon className="w-3.5 h-2.5" />
                            Voir la chaîne
                          </a>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await askConfirm(`Déconnecter la chaîne YouTube "${activeChannel.youtube_channel_title || ''}" ? La publication automatique s'arrêtera.`, { title: 'Déconnecter YouTube', danger: true });
                              if (!ok) return;
                              try {
                                const res = await authFetch(`${API_BASE}/channels/${activeChannel.id}/youtube/disconnect`, { method: 'POST' });
                                if (!res.ok) throw new Error();
                                const updated = await res.json();
                                setActiveChannel(updated);
                                fetchChannels();
                                showToast('Chaîne YouTube déconnectée.', 'success');
                              } catch {
                                showToast('Impossible de déconnecter YouTube.', 'error');
                              }
                            }}
                            title="Déconnecter YouTube"
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[13px]">link_off</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const res = await authFetch(`${API_BASE}/channels/${activeChannel.id}/youtube/auth-url`);
                              if (!res.ok) {
                                const detail = await res.json().catch(() => ({}));
                                throw new Error(detail.detail || "Connexion YouTube indisponible.");
                              }
                              const data = await res.json();
                              window.location.href = data.auth_url;
                            } catch (err) {
                              showToast(err.message, 'error');
                            }
                          }}
                          title="Connecter YouTube"
                          className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-[.1em] bg-slate-800/80 text-[#cbd5e1] border border-slate-700/60 hover:bg-slate-700/80 hover:text-[#f1f5f9] transition-colors"
                        >
                          <YouTubeIcon className="w-3.5 h-2.5" />
                          Connecter YouTube
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Mobile/tablet copy — same row as the channel name, icon-only.
                      Hidden at xl+ where the desktop copy (in the actions cluster
                      below) takes over. */}
                  <button
                    onClick={() => startNewVideoFor(activeChannel)}
                    disabled={generatingAutoVideo}
                    title="Nouvelle Vidéo"
                    className="xl:hidden shrink-0 min-h-11 min-w-11 px-3.5 py-2 bg-gradient-to-r from-[#61dcff] to-[#16b8ff] text-[#041018] rounded-xl font-extrabold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00bfff]/20 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span className="hidden sm:inline">Nouvelle Vidéo</span>
                  </button>
                  </div>

                  <div className="flex items-stretch gap-2 flex-shrink-0 flex-wrap xl:justify-end rounded-2xl xl:bg-[var(--bg-surface-soft)] xl:border xl:border-[var(--border-subtle)] xl:p-2">
                    {(activeChannel.image_style?.source === 'library' || activeChannel.image_style?.source === 'hybrid') && (
                      <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={channelSyncInputRef}
                            webkitdirectory="true"
                            directory="true"
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files).filter(f =>
                                LOCAL_IMAGE_EXTENSIONS_RE.test(f.name)
                              );
                              if (files.length > 0) {
                                const firstPath = files[0].webkitRelativePath || '';
                                const folderName = firstPath ? firstPath.split('/')[0] : 'Dossier Images';
                                prepareLocalImageFiles(files, folderName, activeChannel.id);
                              }
                              setLibrarySyncing(false);
                            }}
                            className="hidden"
                          />
                          <div className="flex items-stretch">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setLibrarySyncing(true);
                                // Already-authorized folder → resync it directly, no dialog at all.
                                if (librarySyncHasHandle) {
                                  const ok = await refreshFromRememberedFolder(activeChannel.id);
                                  setLibrarySyncing(false);
                                  if (!ok) showToast("Impossible de rafraîchir automatiquement — resélectionne le dossier.", "error");
                                  return;
                                }
                                // First time (or unsupported browser): pick the folder right here,
                                // no navigation to the wizard.
                                const handled = await pickFolderModern(activeChannel.id);
                                if (!handled && channelSyncInputRef.current) {
                                  channelSyncInputRef.current.click();
                                  return; // syncing flag cleared by the input's onChange above
                                }
                                setLibrarySyncing(false);
                                setLibrarySyncHasHandle(!!(await getFolderHandle(activeChannel.id)));
                              }}
                              disabled={librarySyncing}
                              title="Mettre à jour la bibliothèque"
                              className="min-h-11 px-3.5 py-2 bg-[var(--bg-surface-alt)] text-white rounded-xl hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center gap-2.5 border border-[var(--border)] disabled:opacity-60 text-left"
                            >
                              <span className={`material-symbols-outlined text-[18px] text-[#52d5ff] ${librarySyncing ? 'animate-spin' : ''}`}>{librarySyncing ? 'progress_activity' : 'sync'}</span>
                              <span className="hidden sm:grid leading-tight"><strong className="text-[10px]">{librarySyncing ? 'Synchronisation…' : 'Bibliothèque visuelle'}</strong><small className="text-[8px] font-medium text-slate-500 mt-1">Synchronisée {formatSyncAgo(activeChannel.id, nowTick)}</small></span>
                            </button>
                          </div>
                      </div>
                    )}
                    {/* "Nouvelle Vidéo" itself now lives next to the channel name
                        above (see the identity row) so it stays on the same line
                        as the name on mobile instead of wrapping to its own row —
                        this desktop-only copy keeps it grouped with the sync
                        button in the xl+ actions cluster. */}
                    <button
                      onClick={() => startNewVideoFor(activeChannel)}
                      disabled={generatingAutoVideo}
                      title="Nouvelle Vidéo"
                      className="hidden xl:flex min-h-11 px-4 sm:px-5 py-2 bg-gradient-to-r from-[#61dcff] to-[#16b8ff] text-[#041018] rounded-xl font-extrabold text-xs hover:brightness-110 transition-all items-center justify-center gap-2 shadow-lg shadow-[#00bfff]/20 disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      <span>Nouvelle Vidéo</span>
                    </button>
                  </div>
                  </div>
                </section>

                {(() => {
                  // Same folders as "Mes Vidéos", scoped to this channel — moving
                  // a video into a folder here or there shows up in both, and old
                  // videos stay tucked away in their folder instead of piling up
                  // in one flat, ever-growing list.
                  const channelFolderVideos = allVideos
                    .filter(v => v.channel_id === activeChannel.id)
                    .filter(v => videoFilterFolderId === 'all' || v.folder_id === videoFilterFolderId);
                  return (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-white">Vidéos de la Chaîne ({channelVideos.length})</h3>
                    {channelVideos.length > 0 && (
                      <button
                        onClick={() => videoSelectionMode ? exitVideoSelectionMode() : setVideoSelectionMode(true)}
                        className={`px-3.5 py-1.5 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 border ${
                          videoSelectionMode ? 'bg-[#00c2ff]/10 text-[#00c2ff] border-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] text-slate-300 hover:text-white border-[var(--border)]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{videoSelectionMode ? 'close' : 'checklist'}</span>
                        {videoSelectionMode ? 'Annuler' : 'Sélectionner'}
                      </button>
                    )}
                  </div>
                  {videoSelectionMode && (
                    <div className="sticky top-0 z-10 bg-[#0f1621] border border-[#00c2ff]/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
                      <span className="text-xs font-bold text-white">{selectedVideoIds.size} vidéo(s) sélectionnée(s)</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedVideoIds(new Set(channelFolderVideos.map(v => v.id)))} className="text-xs font-bold text-slate-300 hover:text-white px-2">
                          Tout sélectionner
                        </button>
                        <button
                          onClick={handleBulkDeleteVideos}
                          disabled={selectedVideoIds.size === 0}
                          className="px-3.5 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          Supprimer ({selectedVideoIds.size})
                        </button>
                      </div>
                    </div>
                  )}
                  {channelVideos.length === 0 ? (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-10 text-center">
                      <span className="material-symbols-outlined text-[40px] text-slate-500 mb-2">description</span>
                      <h4 className="text-base font-bold text-white mb-1">Aucune vidéo soumise</h4>
                      <p className="text-xs text-slate-400 mb-5">
                        {activeChannel.automation_mode === 'auto'
                          ? "Lance la génération : KappGen AI choisit le sujet et écrit le script lui-même."
                          : 'Soumettez votre premier sujet (texte de script ou fichiers audio).'}
                      </p>
                      <button
                        onClick={() => startNewVideoFor(activeChannel)}
                        disabled={generatingAutoVideo}
                        className="bg-[#00c2ff] text-slate-950 px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-[#38d0ff] transition-all disabled:opacity-60"
                      >
                        {generatingAutoVideo ? 'Génération en cours…' : (activeChannel.automation_mode === 'auto' ? 'Générer une vidéo' : 'Soumettre un sujet de vidéo')}
                      </button>
                    </div>
                  ) : (
                    <>
                    {/* Folder navigation — same dossiers as "Mes Vidéos", scoped to
                        this channel's videos, so moving a video into a folder from
                        either screen shows up in both. Keeps old videos tucked away
                        without ever deleting them. */}
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <button
                        onClick={() => openFolder(null)}
                        className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${currentFolderId === null ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">home</span>
                      </button>
                      {folderPath.map((f, i) => (
                        <span key={f.id} className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-slate-600">chevron_right</span>
                          <button
                            onClick={() => openFolder(f.id)}
                            className={`px-2 py-1 rounded-lg font-bold transition-colors ${i === folderPath.length - 1 ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            {f.name}
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {folders.filter(f => f.parent_id === currentFolderId).map(f => {
                        const countInChannel = allVideos.filter(v => v.channel_id === activeChannel.id && v.folder_id === f.id).length;
                        return (
                          <button
                            key={f.id}
                            onClick={() => openFolder(f.id)}
                            onDragOver={(e) => { if (draggedVideoId) { e.preventDefault(); setDragOverFolderId(f.id); } }}
                            onDragLeave={() => setDragOverFolderId(id => id === f.id ? null : id)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverFolderId(null);
                              const videoId = draggedVideoId || e.dataTransfer.getData('text/plain');
                              setDraggedVideoId(null);
                              if (videoId) moveVideoToFolder(videoId, f.id);
                            }}
                            title={f.name}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                              dragOverFolderId === f.id ? 'ring-2 ring-[#00c2ff] ring-offset-1 ring-offset-[var(--bg-page)]' : ''
                            } bg-[var(--bg-surface-alt)] text-slate-300 hover:text-white border-[var(--border)]`}
                          >
                            <span className="material-symbols-outlined text-[15px] text-[#00c2ff]">folder</span> {f.name} <span className="text-slate-500">({countInChannel})</span>
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setShowNewFolderModal(true)}
                        title="Nouveau dossier"
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#00c2ff] hover:bg-[#00c2ff]/10 border border-dashed border-[#00c2ff]/40 flex items-center gap-1.5 transition-all"
                      >
                        <span className="material-symbols-outlined text-[15px]">create_new_folder</span> Nouveau dossier
                      </button>
                    </div>
                    {channelFolderVideos.length === 0 ? (
                      <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-10 text-center">
                        <span className="material-symbols-outlined text-[40px] text-slate-500 mb-2">folder_off</span>
                        <h4 className="text-base font-bold text-white mb-1">Dossier vide</h4>
                        <p className="text-xs text-slate-400">Aucune vidéo de cette chaîne dans ce dossier.</p>
                      </div>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {channelFolderVideos.map(vid => {
                        const isSelected = selectedVideoIds.has(vid.id);
                        return (
                        <div
                          key={vid.id}
                          onClick={() => videoSelectionMode && toggleVideoSelected(vid.id)}
                          draggable={!videoSelectionMode}
                          onDragStart={(e) => { setDraggedVideoId(vid.id); e.dataTransfer.setData('text/plain', vid.id); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragEnd={() => { setDraggedVideoId(null); setDragOverFolderId(null); }}
                          className={`bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border rounded-2xl p-4 transition-all group flex flex-col justify-between shadow-lg relative card-warm-hover video-menu-container ${
                            videoSelectionMode ? 'cursor-pointer ' + (isSelected ? 'border-[#00c2ff]' : 'border-[var(--border-soft)]') : 'border-[var(--border-soft)] hover:border-[#00c2ff]/40 cursor-grab active:cursor-grabbing'
                          } ${draggedVideoId === vid.id ? 'opacity-40' : ''}`}
                        >
                          {videoSelectionMode && (
                            <div className={`absolute top-2.5 left-2.5 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSelected ? 'bg-[#00c2ff] border-[#00c2ff]' : 'bg-slate-950/70 border-slate-500'}`}>
                              {isSelected && <span className="material-symbols-outlined text-[14px] text-slate-950">check</span>}
                            </div>
                          )}
                          {/* Thumbnail Poster — click opens the big preview player directly */}
                          <div
                            onClick={(e) => { if (videoSelectionMode) { e.stopPropagation(); toggleVideoSelected(vid.id); return; } vid.status === 'done' && setSelectedVideo(vid); }}
                            className={`aspect-[16/9] bg-slate-950 rounded-xl relative overflow-hidden border border-[var(--border)] flex items-center justify-center ${vid.status === 'done' ? 'cursor-pointer group' : ''}`}
                          >
                            {regeneratingCardThumbnailIds.has(vid.id) && (
                              <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[32px] text-[#00c2ff] animate-spin">progress_activity</span>
                                <span className="text-[10px] font-bold text-white">Régénération de la miniature…</span>
                              </div>
                            )}
                            {vid.status === 'done' && vid.output_path ? (
                              <>
                                <video
                                  src={getVideoUrl(vid.output_path)}
                                  poster={getVideoThumbnailUrl(vid, thumbnailBust[vid.id])}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  preload="metadata"
                                />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <span className="material-symbols-outlined text-[48px] text-[#00c2ff] drop-shadow-lg group-hover:scale-110 transition-transform">play_circle</span>
                                </div>
                                {vid.duration_seconds != null && (
                                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                                    {formatDuration(vid.duration_seconds)}
                                  </div>
                                )}
                                {vid.progress_stage && /youtube|miniature/i.test(vid.progress_stage) && !vid.youtube_video_id && !vid.youtube_publish_error && (
                                  <div className="absolute inset-x-0 bottom-0 bg-black/85 px-2 py-1.5 flex items-center gap-1.5">
                                    <YouTubeIcon className="w-3.5 h-2.5 animate-pulse" />
                                    <span className="text-[9px] font-bold text-white truncate">{vid.progress_stage}</span>
                                  </div>
                                )}
                              </>
                            ) : vid.status === 'rendering' ? (
                              <div className="px-4 py-5 text-center w-full max-w-[245px]">
                                <PipelineStepper stage={vid.progress_stage} percent={vid.progress_percent} />
                                <div className="mt-4 text-[11px] font-bold text-slate-100 truncate">{vid.progress_stage || 'Rendu en cours…'}</div>
                                <div className="mt-2.5 h-1 rounded-full bg-slate-800/90 overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-[#20bff0] to-[#62dcff] transition-all duration-700 rounded-full" style={{ width: `${vid.progress_percent || 2}%` }} />
                                </div>
                                <div className="mt-2 flex items-center justify-between text-[9px] font-mono">
                                  <span className="text-[#5ddaff] font-bold">{vid.progress_percent || 2}%</span>
                                  {vid.started_at && <span className="text-slate-500">{formatElapsed(vid.started_at)}</span>}
                                </div>
                              </div>
                            ) : vid.status === 'failed' ? (
                              <div className="w-full h-full px-4 py-3 text-center flex flex-col items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-[38px] leading-none text-rose-400">warning</span>
                                <div className="text-[11px] font-extrabold text-rose-300">Échec</div>
                                <div className="max-w-full text-[9px] leading-relaxed text-rose-300/80 line-clamp-2" title={vid.error_message || ''}>
                                  {(vid.error_message || 'Erreur inconnue').split('\n')[0]}
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRetryVideo(vid.id); }}
                                  title="Relancer la génération"
                                  className="mt-0.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00c2ff] px-4 py-1.5 text-[11px] font-extrabold text-slate-950 shadow-lg shadow-[#00c2ff]/20 transition-all hover:bg-[#32ceff] hover:scale-[1.03] active:scale-95"
                                >
                                  <span className="material-symbols-outlined text-[19px]">refresh</span>
                                  Relancer
                                </button>
                              </div>
                            ) : vid.status === 'done' ? (
                              <div className="p-4 text-center space-y-2">
                                <span className="material-symbols-outlined text-[36px] text-slate-500">inventory_2</span>
                                <div className="text-[11px] font-bold font-mono text-slate-400">Fichier expiré</div>
                              </div>
                            ) : (
                              <div className="p-4 text-center space-y-2">
                                <span className="material-symbols-outlined text-[36px] text-amber-400">hourglass_empty</span>
                                <div className="text-[11px] font-bold font-mono text-amber-300">En file</div>
                              </div>
                            )}

                            {/* Status Badge */}
                            {vid.status !== 'rendering' && <div className="absolute top-2 left-2 z-10">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${
                                vid.status === 'done' ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/80' :
                                vid.status === 'failed' ? 'bg-rose-950/90 text-rose-300 border border-rose-700/80' :
                                'bg-amber-950/90 text-amber-300 border border-amber-700/80'
                              }`}>
                                {vid.status === 'done' ? 'Prête' : vid.status === 'failed' ? 'Échec' : 'En file'}
                              </span>
                            </div>}
                          </div>

                          {/* Kebab Menu — outside the poster's overflow-hidden so "Supprimer" is never clipped */}
                          <div className="absolute top-6 right-6 z-20">
                            <button
                              onClick={(e) => openVideoMenu(vid.id, e)}
                              className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors shadow-md"
                              title="Actions vidéo"
                            >
                              <span className="material-symbols-outlined text-[16px]">more_vert</span>
                            </button>
                            {openVideoMenuId === vid.id && videoMenuAnchor && createPortal(
                              <div style={{ position: 'fixed', top: videoMenuAnchor.top ?? undefined, bottom: videoMenuAnchor.bottom ?? undefined, right: videoMenuAnchor.right, maxHeight: videoMenuAnchor.maxHeight, overflowY: 'auto' }} className="video-menu-container w-44 bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-[100] py-1.5">
                                {vid.status === 'done' && (
                                  <button disabled={regeneratingTitleId === vid.id} onClick={(e) => handleRegenerateTitle(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                    <span className={`material-symbols-outlined text-[16px] text-[#00c2ff] ${regeneratingTitleId === vid.id ? 'animate-spin' : ''}`}>{regeneratingTitleId === vid.id ? 'progress_activity' : 'auto_awesome'}</span> {regeneratingTitleId === vid.id ? 'Régénération…' : 'Régénérer le titre'}
                                  </button>
                                )}
                                {vid.status === 'done' && (
                                  <button disabled={regeneratingCardThumbnailIds.has(vid.id)} onClick={(e) => handleRegenerateCardThumbnail(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                    <span className={`material-symbols-outlined text-[16px] text-[#00c2ff] ${regeneratingCardThumbnailIds.has(vid.id) ? 'animate-spin' : ''}`}>{regeneratingCardThumbnailIds.has(vid.id) ? 'progress_activity' : 'photo_camera'}</span> {regeneratingCardThumbnailIds.has(vid.id) ? 'Régénération…' : 'Régénérer la miniature'}
                                  </button>
                                )}
                                {vid.status === 'done' && vid.editable && (
                                  <button onClick={(e) => { e.stopPropagation(); setOpenVideoMenuId(null); openStudio(vid); }} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium">
                                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">movie_edit</span> Éditer la vidéo
                                  </button>
                                )}
                                {vid.status === 'done' && (
                                  <button onClick={(e) => handleDownloadVideo(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium">
                                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">download</span> Télécharger
                                  </button>
                                )}
                                {vid.status === 'done' && (
                                  <button disabled={togglingRetentionId === vid.id} onClick={(e) => handleToggleExtendedRetention(vid, e)} title="Par défaut, une vidéo est supprimée du serveur après 48h." className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                    <span className={`material-symbols-outlined text-[16px] ${vid.extended_retention ? 'text-emerald-400' : 'text-[#00c2ff]'}`}>{vid.extended_retention ? 'lock_clock' : 'schedule'}</span>
                                    {vid.extended_retention ? 'Conservée plus longtemps' : 'Conserver plus longtemps'}
                                  </button>
                                )}
                                {vid.status === 'done' && vid.scheduled_publish_at && !vid.youtube_video_id && (
                                  <button disabled={approvingVideoId === vid.id} onClick={(e) => handleToggleApproval(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                    <span className={`material-symbols-outlined text-[16px] ${vid.approved_for_publish ? 'text-emerald-400' : 'text-[#00c2ff]'}`}>{vid.approved_for_publish ? 'check_circle' : 'pending'}</span>
                                    {vid.approved_for_publish ? 'Approuvée — annuler' : 'Approuver la publication'}
                                  </button>
                                )}
                                {vid.status === 'done' && (
                                  <button disabled={publishingVideoId === vid.id} onClick={(e) => handlePublishYouTube(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">{vid.youtube_video_id ? 'open_in_new' : 'smart_display'}</span>
                                    {vid.youtube_video_id ? 'Voir sur YouTube' : publishingVideoId === vid.id ? 'Publication…' : 'Publier sur YouTube'}
                                  </button>
                                )}
                                {vid.status === 'done' && vid.youtube_video_id && (
                                  <button disabled={resyncingThumbnailId === vid.id} onClick={(e) => handleResyncThumbnail(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                    <span className={`material-symbols-outlined text-[16px] text-[#00c2ff] ${resyncingThumbnailId === vid.id ? 'animate-spin' : ''}`}>{resyncingThumbnailId === vid.id ? 'progress_activity' : 'image'}</span>
                                    {resyncingThumbnailId === vid.id ? 'Mise à jour…' : 'Mettre à jour la miniature'}
                                  </button>
                                )}
                                {vid.status === 'done' && (
                                  <button disabled={reusingAudioId === vid.id} onClick={(e) => handleReuseAudio(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">graphic_eq</span> {reusingAudioId === vid.id ? 'Récupération…' : "Réutiliser l'audio"}
                                  </button>
                                )}
                                <div className="h-[1px] bg-[var(--border-dropdown)] my-1"></div>
                                <button onClick={(e) => { e.stopPropagation(); setMovingVideoId(movingVideoId === vid.id ? null : vid.id); }} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 font-medium">
                                  <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">drive_file_move</span> Déplacer vers…
                                </button>
                                {movingVideoId === vid.id && (
                                  <div className="border-t border-[var(--border-dropdown)] mt-1 pt-1 max-h-40 overflow-y-auto">
                                    {vid.folder_id && (
                                      <button onClick={(e) => { e.stopPropagation(); moveVideoToFolder(vid.id, null); }} className="w-full text-left px-4 py-2 text-[11px] text-slate-400 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[14px]">folder_off</span> Retirer du dossier
                                      </button>
                                    )}
                                    {folders.length === 0 ? (
                                      <p className="px-4 py-2 text-[11px] text-slate-500">Aucun dossier — créez-en un.</p>
                                    ) : folders.map(f => (
                                      <button
                                        key={f.id}
                                        onClick={(e) => { e.stopPropagation(); moveVideoToFolder(vid.id, f.id); }}
                                        className="w-full text-left px-4 py-2 text-[11px] text-slate-300 hover:bg-[var(--bg-hover)] hover:text-white flex items-center gap-2 truncate"
                                      >
                                        <span className="material-symbols-outlined text-[14px] text-[#00c2ff]">folder</span> {f.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div className="h-[1px] bg-[var(--border-dropdown)] my-1"></div>
                                <button onClick={(e) => handleDeleteVideo(vid.id, e)} className="w-full text-left px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-950/50 flex items-center gap-2 font-medium">
                                  <span className="material-symbols-outlined text-[16px]">delete</span> Supprimer
                                </button>
                              </div>,
                              document.body
                            )}
                          </div>

                          {/* Info & Title */}
                          <div className="mt-3 space-y-2 flex-1 flex flex-col justify-between">
                            <div>
                              {editingTitleId === vid.id ? (
                                <input
                                  autoFocus
                                  value={editingTitleValue}
                                  onChange={(e) => setEditingTitleValue(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={() => commitTitleEdit(vid)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.currentTarget.blur(); }
                                    if (e.key === 'Escape') { setEditingTitleId(null); }
                                  }}
                                  className="w-full bg-[var(--bg-surface-alt)] border border-[#00c2ff] rounded-lg px-2 py-1 text-white text-xs font-semibold outline-none"
                                />
                              ) : (
                                <p
                                  onDoubleClick={(e) => startEditingTitle(vid, e)}
                                  className="text-white text-xs font-semibold line-clamp-2 cursor-text"
                                  title="Double-cliquez pour renommer"
                                >
                                  {vid.title || vid.script_text}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                {formatRelativeDate(vid.finished_at || vid.created_at)}
                              </p>
                            </div>

                            {vid.status === 'failed' && vid.error_message === CREDIT_INSUFFICIENT_MESSAGE && (
                              <div className="pt-2 flex items-center gap-2">
                                <button
                                  onClick={() => setShowPricingModal(true)}
                                  className="flex-1 py-1.5 bg-[#00c2ff]/10 text-[#59d8ff] border border-[#00c2ff]/30 rounded-xl font-bold text-xs hover:bg-[#00c2ff]/20 transition-all flex items-center justify-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[16px]">bolt</span> Recharger des crédits
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );})}
                    </div>
                    )}
                    </>
                  )}
                </section>
                  );
                })()}
              </div>
            )}

            {/* VIEW 5: CHANNEL WIZARD (CREATE / EDIT) */}
            {view === 'wizard' && wizardContentType === 'music' && (
              <MusicChannelWizard
                authFetch={authFetch}
                showToast={showToast}
                onBack={() => setView('channels')}
                onCreated={(channel) => {
                  setChannels(prev => [channel, ...prev]);
                  setView('channels');
                }}
              />
            )}

            {view === 'wizard' && wizardContentType !== 'music' && (
              <div className="max-w-[1240px] mx-auto bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-4 sm:p-8 shadow-2xl space-y-6 sm:space-y-8">
                {/* Wizard Header Stepper */}
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] pb-4 sm:pb-6">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-extrabold text-white">
                      {wizardMode === 'edit' ? 'Modifier le Pipeline de la Chaîne' : 'Configuration du Template de Montage de sa Chaîne'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Étape {wizardStep} sur 9</p>
                  </div>
                  <button
                    onClick={() => setView(wizardMode === 'edit' && editingChannelId ? 'channel_detail' : 'channels')}
                    className="text-slate-400 hover:text-white p-2 shrink-0"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Steps Timeline Indicator — a fixed 9-col grid crushed every label
                    unreadable on mobile (~40px/column). Below sm, it's a horizontally
                    scrollable row of pills sized to their own text instead; sm+ keeps
                    the original evenly-spaced grid. */}
                <div className="flex sm:grid sm:grid-cols-9 gap-2 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
                  {['Identité', 'Script', 'Voix Off', 'Visuels', 'Musique', 'Sous-titres', 'Effets', 'Publication', 'Aperçu'].map((label, idx) => {
                    const stepNum = idx + 1;
                    const isActive = wizardStep === stepNum;
                    const isPassed = wizardStep > stepNum;
                    return (
                      <button
                        key={stepNum}
                        onClick={() => setWizardStep(stepNum)}
                        className={`shrink-0 whitespace-nowrap py-2 px-3 sm:px-1 text-center rounded-xl text-xs font-bold transition-all ${
                          isActive ? 'bg-[#00c2ff] text-slate-950 shadow-md' :
                          isPassed ? 'bg-[#00c2ff]/20 text-[#00c2ff] border border-[#00c2ff]/40' :
                          'bg-[var(--bg-surface-alt)] text-slate-400'
                        }`}
                      >
                        {stepNum}. {label}
                      </button>
                    );
                  })}
                </div>

                {/* STEP 1: IDENTITÉ DE LA CHAÎNE (LOGO & NOM) */}
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-white">1. Identité de la Chaîne</h3>

                    <div className="flex items-start gap-4">
                      <div
                        onClick={() => logoInputRef.current && logoInputRef.current.click()}
                        className="w-16 h-16 rounded-full bg-[var(--bg-surface-alt)] border-2 border-dashed border-[var(--border)] hover:border-[#00c2ff] cursor-pointer flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors group"
                        title={logoPreviewUrl ? "Changer la photo" : "Sélectionner une photo"}
                      >
                        {logoPreviewUrl ? (
                          <img
                            src={logoPreviewUrl}
                            alt="Logo"
                            className="w-full h-full object-cover"
                            onError={() => {
                              // Preview only — the file itself (logoFile) stays selected and will still upload.
                              setLogoPreviewUrl(null);
                            }}
                          />
                        ) : (
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-[#00c2ff] text-[20px]">add_a_photo</span>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/*"
                        onChange={handleLogoFileSelect}
                        className="hidden"
                      />

                      <div className="flex-1 min-w-0">
                        <label className="block text-xs font-bold text-slate-300 mb-2">Nom de la chaîne YouTube</label>
                        <div className="flex items-center gap-2">
                          <input
                            value={newChannel.name}
                            onChange={e => setNewChannel({ ...newChannel, name: e.target.value })}
                            className="flex-1 min-w-0 max-w-64 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00c2ff] outline-none"
                            placeholder="Ex: Stoic Mind Daily"
                          />
                          {editingChannel?.youtube_connected ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shrink-0">
                              <YouTubeIcon className="w-3.5 h-2.5" /> {editingChannel.youtube_channel_title || 'Connectée'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={connectingYouTubeFromWizard}
                              onClick={handleConnectYouTubeFromWizard}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-800/80 text-slate-300 border border-slate-700/60 hover:bg-slate-700/80 hover:text-white transition-colors disabled:opacity-50 shrink-0"
                            >
                              <YouTubeIcon className="w-3.5 h-2.5" /> {connectingYouTubeFromWizard ? 'Connexion…' : 'Connecter la chaîne YouTube'}
                            </button>
                          )}
                        </div>
                        {!editingChannel?.youtube_connected && (
                          <p className="text-[11px] text-slate-500 mt-2">
                            Connecte-la maintenant pour remplir automatiquement le nom, la photo et le pseudo à partir de ta vraie chaîne.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Logo + custom overlays (Subscribe button, bell icon...) —
                        used to be hardcoded top-right at a fixed 100px; now the
                        creator picks each one's corner and size, with a live
                        preview at the exact proportions they'll render at. */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-5 items-start">
                      <div className="space-y-4">
                        {/* Logo + extra sticker overlays (Subscribe button, bell icon...)
                            all in one list, same row layout for every one of them — the
                            logo is really just an image too, auto-filled once when the
                            channel connects (see _fill_logo_from_youtube_avatar), with
                            the same × to remove it from the video as any other overlay.
                            Removing it only ever flips branding.logo_enabled off — the
                            channel's own identity logo (used for its avatar elsewhere in
                            the app) is never deleted, so there's always a "Remettre"
                            chip to bring it straight back without re-uploading anything. */}
                        <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-300">Incrustations d'images</label>
                            <button
                              type="button"
                              onClick={() => editingChannelId ? overlayInputRef.current?.click() : showToast("Enregistre d'abord la chaîne avant d'ajouter des incrustations.", "error")}
                              disabled={overlayUploading || (newChannel.branding.overlays || []).length >= 6}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#00c2ff]/10 text-[#00c2ff] border border-[#00c2ff]/40 hover:bg-[#00c2ff]/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[14px]">{overlayUploading ? 'progress_activity' : 'add_photo_alternate'}</span>
                              {overlayUploading ? 'Ajout…' : 'Ajouter'}
                            </button>
                            <input type="file" ref={overlayInputRef} accept="image/png,image/webp,image/gif" onChange={handleUploadOverlay} className="hidden" />
                            <input type="file" ref={replaceOverlayInputRef} accept="image/png,image/webp,image/gif" onChange={handleReplaceOverlayFile} className="hidden" />
                          </div>

                          {resolvedLogoUrl && (newChannel.branding.logo_enabled ?? true) && (() => {
                            const logoSize = newChannel.branding.logo_size_percent ?? 14;
                            const logoX = newChannel.branding.logo_x_percent ?? presetXY(newChannel.branding.logo_corner, logoSize).x;
                            const logoY = newChannel.branding.logo_y_percent ?? presetXY(newChannel.branding.logo_corner, logoSize).y;
                            return (
                              <div className="bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-2.5 space-y-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-slate-950/40 flex-shrink-0 overflow-hidden" title="Logo de la chaîne">
                                    <img src={resolvedLogoUrl} alt="" className="w-full h-full object-contain" />
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0" title="Positions rapides">
                                    {[
                                      { id: 'top-left', label: 'Haut gauche', icon: 'north_west' },
                                      { id: 'top-right', label: 'Haut droite', icon: 'north_east' },
                                      { id: 'bottom-left', label: 'Bas gauche', icon: 'south_west' },
                                      { id: 'bottom-right', label: 'Bas droite', icon: 'south_east' },
                                    ].map(c => {
                                      const target = presetXY(c.id, logoSize);
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          title={`Placer le logo : ${c.label}`}
                                          onClick={() => setNewChannel({ ...newChannel, branding: { ...newChannel.branding, logo_corner: c.id, logo_x_percent: target.x, logo_y_percent: target.y } })}
                                          className={`w-6 h-6 flex items-center justify-center rounded-md border transition-colors ${
                                            Math.round(logoX) === Math.round(target.x) && Math.round(logoY) === Math.round(target.y)
                                              ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]'
                                              : 'bg-[var(--bg-input)] border-[var(--border)] text-slate-500 hover:border-slate-500'
                                          }`}
                                        >
                                          <span className="material-symbols-outlined text-[12px]">{c.icon}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <ShapePicker value={newChannel.branding.logo_shape || 'rectangle'} onChange={v => setNewChannel({ ...newChannel, branding: { ...newChannel.branding, logo_shape: v } })} />
                                  <button
                                    type="button"
                                    onClick={() => setNewChannel({ ...newChannel, branding: { ...newChannel.branding, logo_enabled: false } })}
                                    title="Retirer le logo de la vidéo (l'identité de la chaîne reste inchangée)"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-950/40 flex-shrink-0 ml-auto"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5 pl-1">
                                  <MiniSlider label="Taille" value={logoSize} min={3} max={35} onChange={v => setNewChannel({ ...newChannel, branding: { ...newChannel.branding, logo_size_percent: v } })} />
                                  <MiniSlider label="Position X" value={logoX} min={-20} max={120} onChange={v => setNewChannel({ ...newChannel, branding: { ...newChannel.branding, logo_x_percent: v } })} />
                                  <MiniSlider label="Position Y" value={logoY} min={-20} max={120} onChange={v => setNewChannel({ ...newChannel, branding: { ...newChannel.branding, logo_y_percent: v } })} />
                                </div>
                              </div>
                            );
                          })()}
                          {resolvedLogoUrl && !(newChannel.branding.logo_enabled ?? true) && (
                            <button
                              type="button"
                              onClick={() => setNewChannel({ ...newChannel, branding: { ...newChannel.branding, logo_enabled: true } })}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-dashed border-[var(--border)] text-slate-500 hover:border-slate-500 hover:text-slate-300 transition-colors text-[11px] font-bold"
                            >
                              <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                              Logo de la chaîne retiré de la vidéo — remettre
                            </button>
                          )}

                          {!editingChannelId ? (
                            <p className="text-[11px] text-slate-500">Enregistre d'abord la chaîne pour ajouter des incrustations (PNG recommandé).</p>
                          ) : (newChannel.branding.overlays || []).length === 0 ? (
                            <p className="text-[11px] text-slate-500">Aucune incrustation — ajoute n'importe quelle image à superposer sur la vidéo (bouton « Abonne-toi », cloche de notification, mascotte, sticker, logo secondaire...), placée au coin de ton choix, taille réglable.</p>
                          ) : (
                            <div className="space-y-2.5">
                              {(newChannel.branding.overlays || []).map(ov => {
                                const ovSize = ov.size_percent ?? 12;
                                const xy = presetXY(ov.corner, ovSize);
                                const xPercent = ov.x_percent ?? xy.x;
                                const yPercent = ov.y_percent ?? xy.y;
                                return (
                                <div key={ov.id} className="bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-2.5 space-y-2">
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => { setReplacingOverlayId(ov.id); replaceOverlayInputRef.current?.click(); }}
                                      disabled={overlayUploading}
                                      title="Cliquer pour remplacer l'image"
                                      className="w-9 h-9 rounded-lg bg-slate-950/40 flex-shrink-0 relative overflow-hidden group/thumb disabled:opacity-50"
                                    >
                                      <img src={getVideoUrl(ov.image_path)} alt="" className="w-full h-full object-contain" />
                                      <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 group-hover/thumb:bg-slate-950/60 transition-colors">
                                        <span className="material-symbols-outlined text-[14px] text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity">{overlayUploading && replacingOverlayId === ov.id ? 'progress_activity' : 'sync'}</span>
                                      </span>
                                    </button>
                                    <div className="flex items-center gap-1 flex-shrink-0" title="Positions rapides">
                                      {[
                                        { id: 'top-left', label: 'Haut gauche', icon: 'north_west' },
                                        { id: 'top-right', label: 'Haut droite', icon: 'north_east' },
                                        { id: 'bottom-left', label: 'Bas gauche', icon: 'south_west' },
                                        { id: 'bottom-right', label: 'Bas droite', icon: 'south_east' },
                                      ].map(c => {
                                        const target = presetXY(c.id, ovSize);
                                        return (
                                          <button
                                            key={c.id}
                                            type="button"
                                            title={c.label}
                                            onClick={() => setNewChannel(prev => ({ ...prev, branding: { ...prev.branding, overlays: (prev.branding.overlays || []).map(o => o.id === ov.id ? { ...o, corner: c.id, x_percent: target.x, y_percent: target.y } : o) } }))}
                                            className={`w-6 h-6 flex items-center justify-center rounded-md border transition-colors ${
                                              Math.round(xPercent) === Math.round(target.x) && Math.round(yPercent) === Math.round(target.y)
                                                ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]'
                                                : 'bg-[var(--bg-input)] border-[var(--border)] text-slate-500 hover:border-slate-500'
                                            }`}
                                          >
                                            <span className="material-symbols-outlined text-[12px]">{c.icon}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <ShapePicker value={ov.shape || 'rectangle'} onChange={v => updateOverlayField(ov.id, 'shape', v)} />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOverlay(ov.id)}
                                      title="Supprimer"
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-950/40 flex-shrink-0 ml-auto"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2.5 pl-1">
                                    <MiniSlider label="Taille" value={ovSize} min={4} max={35} onChange={v => updateOverlayField(ov.id, 'size_percent', v)} />
                                    <MiniSlider label="Position X" value={xPercent} min={-20} max={120} onChange={v => updateOverlayField(ov.id, 'x_percent', v)} />
                                    <MiniSlider label="Position Y" value={yPercent} min={-20} max={120} onChange={v => updateOverlayField(ov.id, 'y_percent', v)} />
                                  </div>
                                </div>
                              );})}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Live preview — exact proportions (% of the 1920px-wide
                          render frame) at the exact corner each element will
                          actually be composited at, so there's no guessing. The
                          4 faint corner guides are always shown (whether or not
                          anything is placed there) so it's clear all 4 slots
                          exist, not just whichever one is currently in use. */}
                      <div className="lg:sticky lg:top-4">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Aperçu du placement</div>
                        <div className="w-full aspect-video rounded-xl bg-gradient-to-b from-slate-800 to-slate-950 border border-[var(--border)] relative overflow-hidden">
                          <img
                            src={STABLE_EFFECT_PREVIEW_IMAGES[0]}
                            alt=""
                            aria-hidden
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-950/25" />
                          {/* Not forced to a square — a logo is usually square-ish,
                              but overlay stickers (a "Subscribe" banner, etc.) are
                              often wider than tall, so the guide uses a neutral
                              landscape rectangle rather than implying every image
                              must be square. */}
                          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => (
                            <div
                              key={corner}
                              className="absolute w-[14%] aspect-[4/3] border border-dashed border-slate-600/50 rounded"
                              style={overlayCornerStyle(corner)}
                            />
                          ))}
                          {(newChannel.branding.logo_enabled ?? true) && logoPreviewUrl && (
                            <img
                              src={logoPreviewUrl}
                              alt=""
                              className="absolute object-contain drop-shadow-lg"
                              style={{
                                width: `${newChannel.branding.logo_size_percent || 14}%`,
                                ...overlayPositionStyle(
                                  newChannel.branding.logo_x_percent ?? presetXY(newChannel.branding.logo_corner, newChannel.branding.logo_size_percent ?? 14).x,
                                  newChannel.branding.logo_y_percent ?? presetXY(newChannel.branding.logo_corner, newChannel.branding.logo_size_percent ?? 14).y
                                ),
                                ...shapeClipStyle(newChannel.branding.logo_shape),
                              }}
                            />
                          )}
                          {(newChannel.branding.overlays || []).filter(o => o.enabled ?? true).map(ov => (
                            <img
                              key={ov.id}
                              src={getVideoUrl(ov.image_path)}
                              alt=""
                              className="absolute object-contain drop-shadow-lg"
                              style={{
                                width: `${ov.size_percent || 12}%`,
                                ...overlayPositionStyle(
                                  ov.x_percent ?? presetXY(ov.corner, ov.size_percent ?? 12).x,
                                  ov.y_percent ?? presetXY(ov.corner, ov.size_percent ?? 12).y
                                ),
                                ...shapeClipStyle(ov.shape),
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5">Les pointillés marquent les 4 coins disponibles pour le logo et chaque incrustation.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">Description de la chaîne</label>
                      <textarea
                        rows="2"
                        value={newChannel.description}
                        onChange={e => setNewChannel({ ...newChannel, description: e.target.value })}
                        className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs text-white focus:border-[#00c2ff] outline-none placeholder-slate-500"
                        placeholder="De quoi parle ta chaîne ? (sujets, ton, public visé...) — aide à détecter la niche et donne du contexte à KappGen AI pour l'écriture automatique."
                      />
                      <p className="text-[10px] text-slate-500 mt-1.5">Se remplit automatiquement depuis la description YouTube si tu connectes la chaîne, tant que tu n'as pas déjà écrit la tienne.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">Niche de contenu</label>
                      <div className="flex flex-wrap gap-2">
                        {nicheOptions.map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setNewChannel({ ...newChannel, niche: n })}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                              newChannel.niche === n
                                ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]'
                                : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <input
                        value={newChannel.niche}
                        onChange={e => setNewChannel({ ...newChannel, niche: e.target.value })}
                        className="w-full mt-2 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                        placeholder="Écris ta propre niche..."
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: GÉNÉRATION DU SCRIPT */}
                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white">2. Génération du Script</h3>
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-[11px] font-bold text-slate-400">Manuel</span>
                        <button
                          type="button"
                          onClick={() => setNewChannel({ ...newChannel, automation_mode: (newChannel.automation_mode || 'manual') === 'auto' ? 'manual' : 'auto' })}
                          className={`relative w-9 h-5 rounded-full overflow-hidden transition-colors ${(newChannel.automation_mode || 'manual') === 'auto' ? 'bg-[#00c2ff]' : 'bg-[var(--border)]'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${(newChannel.automation_mode || 'manual') === 'auto' ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <span className="text-[11px] font-bold text-slate-400">Automatique</span>
                      </label>
                    </div>
                    <p className="text-xs text-slate-400 -mt-4">
                      {(newChannel.automation_mode || 'manual') === 'auto'
                        ? "KappGen AI choisit le sujet et écrit le script pour toi."
                        : 'Tu écris ou colles le script toi-même à chaque vidéo.'}
                    </p>

                    {newChannel.automation_mode === 'auto' && !hasActiveSubscription
                      && (currentUser?.free_video_quota_granted - currentUser?.free_videos_used <= 0)
                      && (creditBalance != null && creditBalance <= 0) && (
                      <div className="flex items-start gap-2.5 border border-amber-500/30 bg-amber-500/10 rounded-xl p-3">
                        <span className="material-symbols-outlined text-amber-300 text-[18px] shrink-0 mt-0.5">warning</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-amber-200">La génération automatique ne fonctionnera pas encore</p>
                          <p className="text-[11px] text-amber-200/80 mt-0.5">
                            Ton solde de crédits est à zéro et tu n'as plus de vidéo gratuite disponible. Recharge des crédits pour que cette chaîne écrive et publie réellement ses vidéos toute seule.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowPricingModal(true)}
                            className="mt-2 text-[11px] font-bold text-amber-200 underline decoration-dotted underline-offset-2 hover:text-amber-100"
                          >
                            Voir les offres de crédits
                          </button>
                        </div>
                      </div>
                    )}

                    {newChannel.automation_mode === 'auto' && (() => {
                      const structure = newChannel.script_structure || defaultChannelForm.script_structure;
                      const parts = structure.parts || [];
                      const totalWords = parts.reduce((sum, p) => sum + (Number(p.word_count) || 0), 0);
                      return (
                        <button
                          type="button"
                          onClick={() => setShowScriptStructureModal(true)}
                          className="w-full flex items-center justify-between gap-3 border border-[var(--border)] hover:border-[#00c2ff]/60 rounded-xl p-4 bg-[var(--bg-surface-alt)] transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-lg bg-[#00c2ff]/10 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[18px] text-[#00c2ff]">description</span>
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white">Structure du script auto-généré</div>
                              <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                {parts.length} parties · ~{totalWords} mots · {SCRIPT_LANGUAGES.find(l => l.value === (structure.language || 'English'))?.label || structure.language}
                              </div>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-slate-500 shrink-0">chevron_right</span>
                        </button>
                      );
                    })()}

                    {newChannel.automation_mode === 'auto' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">Exemples de sujets / titres</label>
                        <textarea
                          value={newChannel.topic_examples || ''}
                          onChange={e => setNewChannel({ ...newChannel, topic_examples: e.target.value })}
                          placeholder={"Colle directement une liste de vidéos qui marchent dans ta niche — les tiennes, ou celles d'une chaîne concurrente copiées en vrac (avec le nombre de vues et la date, aucun souci). L'IA s'occupe de repérer les plus virales et d'en tirer le style pour écrire tes prochains scripts.\n\nEx :\nLe jour où tu arrêtes de demander la permission de vivre — 2,3 M de vues — il y a 4 mois\nPourquoi le silence de Dieu n'est pas un abandon"}
                          rows={12}
                          className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-xs text-white focus:border-[#00c2ff] outline-none resize-y"
                        />
                        <p className="text-[10px] text-slate-500 mt-1.5 px-1">Sans ça, le choix des sujets reste générique. Colle en vrac (vues, dates compris) — l'IA analyse elle-même pour repérer les vidéos les plus virales et s'en inspirer.</p>
                      </div>
                    )}

                    {newChannel.automation_mode === 'auto' && (
                      <label className="flex items-center gap-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!newChannel.use_web_trends}
                          onChange={e => setNewChannel({ ...newChannel, use_web_trends: e.target.checked })}
                          className="w-4 h-4 accent-[#00c2ff]"
                        />
                        <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">travel_explore</span>
                        <span className="text-[11px] text-slate-300">Puiser dans l'actualité récente (recherche web) — pour une chaîne d'actu/tendances</span>
                      </label>
                    )}

                    {newChannel.automation_mode === 'auto' && (
                      <div>
                        <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5">
                          <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">calendar_today</span>
                          <span className="text-[11px] text-slate-400 shrink-0">Scripts (vidéos) par jour :</span>
                          <div className="flex-1 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setNewChannel({ ...newChannel, videos_per_day: Math.max(1, (newChannel.videos_per_day || 1) - 1) })}
                              className="w-7 h-7 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)] text-white hover:border-slate-500 flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[16px]">remove</span>
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={newChannel.videos_per_day || 1}
                              onChange={e => {
                                const n = parseInt(e.target.value);
                                setNewChannel({ ...newChannel, videos_per_day: Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 1 });
                              }}
                              className="w-14 text-center bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg py-1 text-xs font-bold text-white focus:border-[#00c2ff] outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setNewChannel({ ...newChannel, videos_per_day: Math.min(100, (newChannel.videos_per_day || 1) + 1) })}
                              className="w-7 h-7 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)] text-white hover:border-slate-500 flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5 px-1">La plage horaire, les jours et le fuseau de publication de la vidéo finie se règlent à l'étape « Publication ».</p>
                      </div>
                    )}

                    {newChannel.automation_mode === 'auto' && (() => {
                      const hasFixedHour = (newChannel.script_generation_hour ?? -1) >= 0;
                      const genDays = newChannel.script_generation_days;
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 flex-wrap">
                            <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">schedule</span>
                            <span className="text-[11px] text-slate-400 shrink-0">Écriture du script :</span>
                            <div className="flex items-center gap-1 bg-[var(--bg-input-alt)] border border-[var(--border)] rounded-lg p-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setNewChannel({ ...newChannel, script_generation_hour: -1 })}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${!hasFixedHour ? 'bg-[#00c2ff] text-slate-950' : 'text-slate-400 hover:text-white'}`}
                              >
                                Dès que possible
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (hasFixedHour) return;
                                  const now = new Date();
                                  setNewChannel({ ...newChannel, script_generation_hour: now.getHours(), script_generation_minute: now.getMinutes(), script_generation_second: now.getSeconds() });
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${hasFixedHour ? 'bg-[#00c2ff] text-slate-950' : 'text-slate-400 hover:text-white'}`}
                              >
                                Heure fixe
                              </button>
                            </div>
                            {hasFixedHour && (
                              <ScriptTimeInput
                                hour={newChannel.script_generation_hour}
                                minute={newChannel.script_generation_minute ?? 0}
                                second={newChannel.script_generation_second ?? 0}
                                onChange={(h, m, s) => setNewChannel({ ...newChannel, script_generation_hour: h, script_generation_minute: m, script_generation_second: s })}
                              />
                            )}
                          </div>

                          {hasFixedHour && (
                            <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">event_repeat</span>
                                <span className="text-[11px] text-slate-400">Jours de génération</span>
                              </div>
                              <div className="flex gap-1.5">
                                {[
                                  { id: 0, label: 'L' }, { id: 1, label: 'M' }, { id: 2, label: 'M' },
                                  { id: 3, label: 'J' }, { id: 4, label: 'V' }, { id: 5, label: 'S' }, { id: 6, label: 'D' },
                                ].map(({ id, label }) => {
                                  const isOn = !genDays || genDays.length === 0 || genDays.includes(id);
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      onClick={() => {
                                        const current = (genDays && genDays.length > 0) ? genDays : [0, 1, 2, 3, 4, 5, 6];
                                        const next = current.includes(id) ? current.filter(d => d !== id) : [...current, id].sort();
                                        setNewChannel({ ...newChannel, script_generation_days: next.length === 7 ? null : next });
                                      }}
                                      className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
                                        isOn ? 'bg-[#00c2ff] text-slate-950 border-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <p className="text-[10px] text-slate-500 px-1">
                            {hasFixedHour
                              ? `KappGen AI commence à écrire le script à partir de ${String(newChannel.script_generation_hour).padStart(2, '0')}:${String(newChannel.script_generation_minute ?? 0).padStart(2, '0')}:${String(newChannel.script_generation_second ?? 0).padStart(2, '0')} (fuseau de la chaîne, vérifié toutes les ~10 min — les secondes sont enregistrées mais pas garanties à l'exécution) — pratique pour vérifier que l'automatisation se déclenche bien.`
                              : "Le script est écrit dès qu'un créneau du jour est libre, sans heure fixe."} Dès que le script est prêt, la vidéo part automatiquement en rendu.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* STEP 3: VOIX OFF */}
                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-white">3. Voix Off</h3>
                    <p className="text-xs text-slate-400 -mt-4">Choisie une seule fois ici — utilisée automatiquement pour chaque vidéo de cette chaîne.</p>

                    {/* Personal Izivoice key connect: hidden from the client-facing wizard
                        (deemed not useful for clients) — backend support (izivoice/connect,
                        status, key routing) stays intact, only the UI entry point is gone,
                        so this is a one-line revert if that changes. */}

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">Bibliothèque de voix</label>
                      {(() => {
                        const activeId = newChannel.voice_id || selectedVoice;
                        const activeVoice = availableVoices.find(v => v.id === activeId) || (activeId ? { id: activeId, name: newChannel.voice_name || activeId, desc: 'Voix' } : null);
                        return (
                          <div
                            onClick={() => setShowVoiceLibrary(true)}
                            className="flex items-center gap-2.5 bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[#00c2ff]/60 rounded-xl px-3 py-2 cursor-pointer transition-colors"
                          >
                            {activeVoice ? (
                              <>
                                <VoiceAvatar
                                  voice={activeVoice}
                                  size={34}
                                  playable
                                  playing={wizardVoicePreviewId === activeVoice.id}
                                  generating={wizardVoiceGeneratingId === activeVoice.id}
                                  onTogglePlay={async () => {
                                    if (wizardVoicePreviewId === activeVoice.id) { stopVoicePreview(); setWizardVoicePreviewId(null); return; }
                                    let url = activeVoice.preview_url;
                                    if (!url) {
                                      // Catalog voices already have one; a cloned voice can lack it
                                      // (cloned before on-demand generation existed, or the best-effort
                                      // generation right after cloning failed) — generate it now on click
                                      // instead of leaving the avatar looking clickable but dead.
                                      setWizardVoiceGeneratingId(activeVoice.id);
                                      try {
                                        const res = await authFetch(`${API_BASE}/channels/voice/${activeVoice.id}/preview/generate`, { method: 'POST' });
                                        const body = await res.json().catch(() => ({}));
                                        if (!res.ok) throw new Error(body.detail || "Impossible de générer l'aperçu.");
                                        url = `${API_BASE}${body.preview_url}`;
                                        setAvailableVoices(prev => prev.map(v => v.id === activeVoice.id ? { ...v, preview_url: url } : v));
                                      } catch (err) {
                                        showToast(err.message, 'error');
                                        setWizardVoiceGeneratingId(null);
                                        return;
                                      }
                                      setWizardVoiceGeneratingId(null);
                                    }
                                    playVoicePreviewExclusive(url, () => setWizardVoicePreviewId(null));
                                    setWizardVoicePreviewId(activeVoice.id);
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white truncate">{activeVoice.name}</p>
                                  <p className="text-[10px] text-slate-500 truncate">{activeVoice.desc}</p>
                                </div>
                              </>
                            ) : (
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-400">Aucune voix sélectionnée</p>
                              </div>
                            )}
                            <span className="shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#65e0ff] to-[#1a9cff] text-[var(--bg-deep)] text-[11px] font-extrabold flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[15px]">record_voice_over</span>
                              Changer
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">Réglages de la voix</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['speed', 'Vitesse', 0.5, 1.5, 0.05],
                          ['stability', 'Stabilité', 0, 1, 0.05],
                          ['similarity_boost', 'Fidélité', 0, 1, 0.05],
                          ['style', 'Expression', 0, 1, 0.05]
                        ].map(([field, label, min, max, step]) => {
                          const settings = newChannel.voice_settings || { speed: 0.845, stability: 0.8, similarity_boost: 0.9, style: 0 };
                          const value = Number(settings[field] ?? (field === 'speed' ? 0.845 : 0));
                          return <label key={field} className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3">
                            <span className="flex justify-between text-[10px] font-bold text-slate-300 mb-2"><span>{label}</span><span className="text-[#55d8ff]">{value.toFixed(2)}</span></span>
                            <input type="range" min={min} max={max} step={step} value={value} onChange={e => {
                              setNewChannel({ ...newChannel, voice_settings: { ...settings, [field]: Number(e.target.value) } });
                            }} className="w-full accent-[#00c2ff]" />
                          </label>;
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: VISUELS & SOURCES D'IMAGES (OPTION A & OPTION B COCHABLES) */}
                {wizardStep === 4 && (() => {
                  // All three independently toggleable now — tried in fixed
                  // priority order at render time (AI, then local library,
                  // then community), not mutually exclusive modes anymore.
                  // See resolveEnabledImageSources / the identical priority
                  // in backend/src/pipeline/images.py.
                  const enabledImageSources = resolveEnabledImageSources(newChannel.image_style);
                  const isOptionAChecked = enabledImageSources.includes('library');
                  const isOptionBChecked = enabledImageSources.includes('ai_generated');
                  const isCommunityChecked = enabledImageSources.includes('community');

                  const setEnabledImageSources = (next) => {
                    // Never let every source end up disabled — a channel
                    // with nothing checked can't render at all, so falls
                    // back to "library" rather than leaving it empty.
                    const cleaned = IMAGE_SOURCE_PRIORITY.filter(s => next.includes(s));
                    const sources = cleaned.length ? cleaned : ['library'];
                    setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, sources, source: sources[0] } });
                  };

                  const toggleOptionA = () => {
                    setEnabledImageSources(isOptionAChecked ? enabledImageSources.filter(s => s !== 'library') : [...enabledImageSources, 'library']);
                  };

                  const toggleOptionB = () => {
                    if (!isOptionBChecked && !canGenerateAIImages) {
                      showToast(`Crédits insuffisants pour la génération d'images IA (~${IMAGE_GENERATION_CREDITS_MIN.toLocaleString()}–${IMAGE_GENERATION_CREDITS_MAX.toLocaleString()} crédits/image).`, 'error');
                      return;
                    }
                    setEnabledImageSources(isOptionBChecked ? enabledImageSources.filter(s => s !== 'ai_generated') : [...enabledImageSources, 'ai_generated']);
                  };

                  // Combinable with A/B now, not exclusive — checking it adds
                  // the niche's shared pool as a further fallback tier below
                  // whatever else is enabled, instead of replacing it.
                  const toggleCommunity = () => {
                    setEnabledImageSources(isCommunityChecked ? enabledImageSources.filter(s => s !== 'community') : [...enabledImageSources, 'community']);
                  };

                  // How many distinct AI images to generate for this video — the
                  // rest of the timeline reuses/recycles them instead of generating
                  // a fresh (paid) image per scene, so the creator controls their
                  // own cost instead of it scaling silently with video length.
                  const maxUniqueImages = newChannel.image_style.max_unique_images ?? 10;
                  // Backward-compat default: channels saved before this toggle
                  // existed but already had a max_unique_images value meant it
                  // manually, so keep treating those as "manual".
                  const imageCountMode = newChannel.image_style.image_count_mode ?? (newChannel.image_style.max_unique_images ? 'manual' : 'auto');

                  const hasStoredLibrary = Number(newChannel.image_style.library_image_count || 0) > 0
                    && String(newChannel.image_style.library_path || '').startsWith('channels/');

                  return (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-bold text-white">4. Source d'Images Visuelles & Mode de Génération</h3>
                        <p className="text-xs text-slate-400 mt-1">Sélectionnez la ou les sources visuelles souhaitées (Vous pouvez cocher l'Option A, l'Option B, ou les deux !).</p>
                      </div>

                      {/* 2 CARDS SELECTION GRID WITH CHECKBOXES */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* OPTION A: DOSSIER IMAGES LOCALES */}
                        <div 
                          onClick={toggleOptionA}
                          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer space-y-4 flex flex-col justify-between ${
                            isOptionAChecked
                              ? 'bg-[var(--bg-surface-alt)] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10'
                              : 'bg-[var(--bg-surface-soft)] border-[var(--border-soft)] hover:border-slate-500 opacity-60'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="material-symbols-outlined text-[#00c2ff] text-[24px]">folder_open</span>
                                <h4 className="font-bold text-white text-xs">Option A: Importer un dossier local</h4>
                              </div>
                              <input 
                                type="checkbox"
                                checked={isOptionAChecked}
                                onChange={toggleOptionA}
                                className="w-5 h-5 accent-[#00c2ff] cursor-pointer rounded"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Sélectionnez un dossier complet contenant toutes les images de votre machine.
                            </p>
                          </div>

                          {/* Folder Picker & File Fallback Dropzone */}
                          <div
                            onDragOver={(e) => { e.preventDefault(); setIsFolderDragging(true); }}
                            onDragLeave={() => setIsFolderDragging(false)}
                            onDrop={handleFolderDrop}
                            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                              isFolderDragging ? 'border-[#00c2ff] bg-[#00c2ff]/10' : 'border-[var(--border)] hover:border-[#00c2ff] bg-[var(--bg-input-alt)]/60'
                            }`}
                          >
                            <input
                              type="file"
                              ref={wizardFolderInputRef}
                              webkitdirectory="true"
                              directory="true"
                              multiple
                              onChange={handleLocalFolderSelect}
                              className="hidden"
                            />
                            <span className="material-symbols-outlined text-slate-400 text-[28px] mb-1">drive_folder_upload</span>
                            
                            <div className="flex flex-col gap-2 mt-1">
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const channelKey = wizardMode === 'edit' ? editingChannelId : null;
                                  const handled = await pickFolderModern(channelKey);
                                  if (!handled && wizardFolderInputRef.current) wizardFolderInputRef.current.click();
                                }}
                                className="px-3 py-1.5 bg-[#00c2ff] text-slate-950 rounded-lg text-xs font-bold hover:bg-[#38d0ff] transition-all"
                              >
                                📁 Choisir un dossier d'images
                              </button>
                            </div>
                            
                            {localImageFiles.length > 0 && (
                              <div className="mt-3 px-2.5 py-1 bg-emerald-950 text-emerald-300 rounded-lg text-[10px] font-bold font-mono truncate">
                                ✓ {selectedFolderName || 'Dossier'} : {localImageFiles.length} images sélectionnées
                              </div>
                            )}
                            {localImageFiles.length === 0 && !libraryUploadStatus && hasStoredLibrary && (
                              <div className="mt-3 px-3 py-2 bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 rounded-lg text-[10px] font-bold">
                                ✓ {newChannel.image_style.library_image_count} images déjà enregistrées sur le serveur — pas besoin de réimporter, choisis un dossier seulement pour remplacer.
                              </div>
                            )}
                            {libraryUploadStatus && (
                              <div className={`mt-3 p-3 rounded-xl border text-left space-y-2 ${
                                libraryUploadStatus === 'success'
                                  ? 'bg-emerald-950/60 border-emerald-700/60'
                                  : libraryUploadStatus === 'error'
                                    ? 'bg-red-950/50 border-red-700/60'
                                    : 'bg-[#081c2a] border-[#00c2ff]/40'
                              }`}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className={`flex items-center gap-1.5 text-[10px] font-bold ${
                                    libraryUploadStatus === 'success' ? 'text-emerald-300' :
                                    libraryUploadStatus === 'error' ? 'text-red-300' : 'text-[#00c2ff]'
                                  }`}>
                                    <span className={`material-symbols-outlined text-[15px] ${
                                      ['analyzing', 'uploading', 'validating'].includes(libraryUploadStatus) ? 'animate-spin' : ''
                                    }`}>
                                      {libraryUploadStatus === 'success' ? 'check_circle' : libraryUploadStatus === 'error' ? 'error' : 'progress_activity'}
                                    </span>
                                    {libraryUploadMessage || 'Préparation de l’importation…'}
                                  </div>
                                  <span className={`text-xs font-mono font-black ${libraryUploadStatus === 'success' ? 'text-emerald-300' : 'text-white'}`}>
                                    {libraryUploadProgress}%
                                  </span>
                                </div>
                                <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${libraryUploadStatus === 'error' ? 'bg-red-500' : libraryUploadStatus === 'success' ? 'bg-emerald-400' : 'bg-[#00c2ff]'}`}
                                    style={{ width: `${libraryUploadProgress}%` }}
                                  />
                                </div>
                                {libraryUploadStatus === 'success' && (
                                  <p className="text-[9px] text-emerald-300/80">Importation terminée. Vous pouvez passer à l’aperçu final.</p>
                                )}
                              </div>
                            )}
                            {isOptionAChecked && (
                              <div className="flex items-start gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  id="share-with-community"
                                  checked={!!newChannel.image_style.share_with_community}
                                  onChange={() => setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, share_with_community: !newChannel.image_style.share_with_community } })}
                                  className="w-4 h-4 mt-0.5 accent-[#00c2ff] cursor-pointer shrink-0"
                                />
                                <label htmlFor="share-with-community" className="text-[10px] text-slate-400 cursor-pointer">
                                  Partager cette bibliothèque avec la communauté KappGen (aide les autres créateurs de ta niche à démarrer plus vite).
                                </label>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* OPTION B: GÉNÉRATION IA AUTOMATIQUE */}
                        <div
                          onClick={toggleOptionB}
                          className={`p-5 rounded-2xl border-2 transition-all space-y-4 flex flex-col justify-between ${
                            isOptionBChecked
                              ? 'bg-[var(--bg-surface-alt)] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10 cursor-pointer'
                              : canGenerateAIImages
                                ? 'bg-[var(--bg-surface-soft)] border-[var(--border-soft)] hover:border-slate-500 opacity-60 cursor-pointer'
                                : 'bg-[var(--bg-surface-soft)] border-[var(--border-soft)] opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="material-symbols-outlined text-[#00c2ff] text-[24px]">auto_awesome</span>
                                <h4 className="font-bold text-white text-xs">Option B: Génération IA Automatique</h4>
                                <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gradient-to-r from-[#00c2ff] to-[#0088ff] text-slate-950">Pro</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={isOptionBChecked}
                                disabled={!isOptionBChecked && !canGenerateAIImages}
                                onChange={toggleOptionB}
                                className="w-5 h-5 accent-[#00c2ff] cursor-pointer rounded disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400">
                              L'IA génère automatiquement les visuels pour chaque scène, dans le style que tu décris ci-dessous — ~{IMAGE_GENERATION_CREDITS_MIN.toLocaleString()}–{IMAGE_GENERATION_CREDITS_MAX.toLocaleString()} crédits par image générée.
                            </p>
                            {!hasActiveSubscription && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setView('settings'); setSettingsTab('billing'); }}
                                className="text-[10px] font-bold text-[#56d9ff] hover:underline flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[13px]">workspace_premium</span>
                                Réservé aux abonnés Pro — passer à l'abonnement
                              </button>
                            )}
                            {hasActiveSubscription && !canGenerateAIImages && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setView('settings'); setSettingsTab('billing'); }}
                                className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[13px]">bolt</span>
                                Solde de crédits insuffisant — recharger
                              </button>
                            )}
                          </div>

                          {isOptionBChecked && (
                            <div onClick={(e) => e.stopPropagation()} className="p-3 rounded-xl bg-[var(--bg-input-alt)] border border-[var(--border)] space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, image_count_mode: 'auto', max_unique_images: null } })}
                                  className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-colors ${
                                    imageCountMode === 'auto' ? 'bg-[#00c2ff]/15 border-[#00c2ff] text-white' : 'bg-transparent border-[var(--border)] text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Auto — KappGen décide
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, image_count_mode: 'manual' } })}
                                  className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-colors ${
                                    imageCountMode === 'manual' ? 'bg-[#00c2ff]/15 border-[#00c2ff] text-white' : 'bg-transparent border-[var(--border)] text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Nombre précis
                                </button>
                              </div>

                              {imageCountMode === 'auto' ? (
                                <p className="text-[10px] text-slate-500">
                                  KappGen choisit automatiquement combien d'images générer selon la longueur de la vidéo, et débite tes crédits au fur et à mesure ({IMAGE_GENERATION_CREDITS_MIN.toLocaleString()}–{IMAGE_GENERATION_CREDITS_MAX.toLocaleString()} crédits par image).
                                </p>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between gap-3">
                                    <label className="text-[10px] font-bold text-slate-300">Nombre d'images à générer par vidéo</label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={maxUniqueImages}
                                      onChange={e => {
                                        const raw = e.target.value;
                                        if (raw === '') return; // let them clear the field while typing a new value
                                        const parsed = parseInt(raw, 10);
                                        if (Number.isNaN(parsed)) return;
                                        setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, max_unique_images: Math.max(1, parsed) } });
                                      }}
                                      onBlur={e => {
                                        if (e.target.value !== '' && !Number.isNaN(parseInt(e.target.value, 10))) return;
                                        setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, max_unique_images: 1 } });
                                      }}
                                      className="w-16 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-white text-center focus:border-[#00c2ff] outline-none"
                                    />
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    Le reste de la vidéo réutilise ces images au lieu d'en générer une nouvelle par scène — tu maîtrises le coût, pas la durée.
                                  </p>
                                  <p className="text-[11px] font-bold text-[#56d9ff]">
                                    Coût estimé par vidéo générée : {maxUniqueImages} × {IMAGE_GENERATION_CREDITS_MIN.toLocaleString()}–{IMAGE_GENERATION_CREDITS_MAX.toLocaleString()} = {(maxUniqueImages * IMAGE_GENERATION_CREDITS_MIN).toLocaleString()}–{(maxUniqueImages * IMAGE_GENERATION_CREDITS_MAX).toLocaleString()} crédits
                                  </p>
                                  {creditBalance != null && !isSubscriptionExempt && maxUniqueImages * IMAGE_GENERATION_CREDITS_MAX > creditBalance && (
                                    <p className="text-[10px] font-bold text-amber-400">
                                      ⚠ Ton solde ({creditBalance.toLocaleString()} crédits) peut ne pas couvrir ce nombre d'images — les images manquantes utiliseront ta bibliothèque à la place.
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold text-slate-300">Décris le style visuel et le sujet des images (ex: médecins, hôpital, plantes médicinales pour une chaîne santé)</label>
                              <div onClick={(e) => e.stopPropagation()}>
                                <input
                                  ref={styleReferenceInputRef}
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  onChange={handleAnalyzeStyleImage}
                                  className="hidden"
                                />
                                <button
                                  type="button"
                                  disabled={styleAnalyzing}
                                  onClick={() => styleReferenceInputRef.current && styleReferenceInputRef.current.click()}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-[#00c2ff]/10 text-[#00c2ff] hover:bg-[#00c2ff]/20 transition-colors disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[13px]">{styleAnalyzing ? 'hourglass_top' : 'image_search'}</span>
                                  {styleAnalyzing ? 'Analyse...' : "Envoyer une image d'inspiration"}
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mb-1.5">
                              Envoie une photo qui ressemble à ce que tu veux voir dans tes vidéos — l'IA en retiendra à la fois le style visuel et le sujet (personnages, décors) pour rester dans ta niche.
                            </p>
                            <textarea
                              rows="2"
                              value={newChannel.image_style.style_prompt}
                              onChange={e => setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, style_prompt: e.target.value } })}
                              className="w-full bg-[var(--bg-input-alt)] border border-[var(--border)] rounded-xl p-2.5 text-[11px] text-white focus:border-[#00c2ff] outline-none placeholder-slate-500"
                              placeholder="Ex: médecins en blouse blanche, hôpital moderne, éclairage clinique rassurant..."
                            />
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {[
                                'Cinématique, éclairage dramatique',
                                'Aquarelle douce',
                                'Photo réaliste, style documentaire',
                                'Illustration religieuse classique',
                                'Néon futuriste, cyberpunk',
                              ].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, style_prompt: preset } })}
                                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[var(--bg-surface-alt)] text-slate-300 hover:bg-[#00c2ff]/10 hover:text-[#00c2ff] border border-[var(--border)] transition-colors"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1.5">Ce style guide chaque image générée — plus c'est précis, plus le résultat est cohérent d'une vidéo à l'autre.</p>
                          </div>
                        </div>

                      </div>

                      {(() => {
                        const nicheSet = (newChannel.niche || '').trim();
                        const available = communityLibraryAvailability?.available;
                        const disabled = !nicheSet || !available;
                        return (
                          <div
                            onClick={() => { if (!disabled) toggleCommunity(); }}
                            className={`p-4 rounded-xl border transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                              isCommunityChecked ? 'border-[#00c2ff] bg-[#00c2ff]/5' : 'border-[var(--border)] bg-[#171b23] hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isCommunityChecked}
                                disabled={disabled}
                                onChange={() => { if (!disabled) toggleCommunity(); }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-5 h-5 mt-0.5 accent-[#00c2ff] cursor-pointer rounded shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[18px] text-[#00c2ff]">diversity_3</span>
                                  <span className="text-sm font-bold text-white">Bibliothèque collaborative</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                  {!nicheSet
                                    ? "Choisis d'abord une niche (étape 1) pour voir si une bibliothèque partagée existe déjà."
                                    : available
                                      ? `${communityLibraryAvailability.folder_count} dossier(s) partagé(s) par la communauté pour la niche « ${nicheSet} » (${communityLibraryAvailability.image_count} images). Aucun upload requis de ta part.`
                                      : `Pas encore de bibliothèque disponible pour la niche « ${nicheSet} » — sois le premier à partager la tienne (case ci-dessus) !`}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {enabledImageSources.length > 1 && (
                        <div className="bg-[#00c2ff]/10 border border-[#00c2ff]/30 p-3 rounded-xl flex items-center gap-2.5 text-xs text-[#00c2ff]">
                          <span className="material-symbols-outlined text-[20px]">info</span>
                          <span>
                            <strong>{enabledImageSources.length} sources activées.</strong> Ordre de priorité à la génération : {enabledImageSources.map((s, i) => (
                              <span key={s}>{i > 0 ? ' → ' : ''}{s === 'ai_generated' ? 'IA' : s === 'library' ? 'dossier local' : 'bibliothèque collaborative'}</span>
                            ))}. Chaque source n'est utilisée que si la précédente échoue ou manque d'images.
                          </span>
                        </div>
                      )}

                      <div className="bg-[#171b23] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Mini mockup of a YouTube video card — makes it obvious at a
                                glance that this section is about the clickable thumbnail
                                image, not the video content itself. */}
                            <div className="w-28 h-16 rounded-md bg-[var(--bg-input-alt)] border border-[var(--border)] flex-shrink-0 relative overflow-hidden">
                              <img
                                src={
                                  newChannel.thumbnail_style?.reference_image_paths?.[0]
                                    ? `${STORAGE_BASE}/${newChannel.thumbnail_style.reference_image_paths[0]}`
                                    : STABLE_EFFECT_PREVIEW_IMAGES[0]
                                }
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                              <span className="absolute inset-0 flex items-center justify-center">
                                <span className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                                  <span className="material-symbols-outlined text-white text-[14px]">play_arrow</span>
                                </span>
                              </span>
                              <span className="absolute bottom-1 right-1 px-1 rounded bg-black/70 text-[9px] font-bold text-white leading-tight">4:12</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-xs">Style de la miniature YouTube</h4>
                            </div>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <input
                              ref={thumbnailStyleInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              multiple
                              onChange={handleUploadThumbnailStyle}
                              className="hidden"
                            />
                            <button
                              type="button"
                              disabled={thumbnailStyleAnalyzing || !canGenerateAIImages}
                              title={canGenerateAIImages ? undefined : `Crédits insuffisants (${THUMBNAIL_GENERATION_CREDITS.toLocaleString()} crédits/miniature générée)`}
                              onClick={() => thumbnailStyleInputRef.current && thumbnailStyleInputRef.current.click()}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-[#00c2ff]/10 text-[#00c2ff] hover:bg-[#00c2ff]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined text-[13px]">{thumbnailStyleAnalyzing ? 'hourglass_top' : 'image_search'}</span>
                              {thumbnailStyleAnalyzing ? 'Analyse...' : (newChannel.thumbnail_style?.style_prompt ? "Ajouter d'autres images" : "Ajouter des images de référence")}
                            </button>
                          </div>
                        </div>
                        {/* AI concept proposal — the primary path: a real, niche-specific
                            visual identity (subject/character + palette + style), not a
                            generic template. Once approved it's locked as this channel's
                            thumbnail_style, so every future thumbnail follows it automatically. */}
                        <div className="bg-[#0d1117] border border-[var(--border)] rounded-xl p-3 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[15px] text-[#00c2ff]">auto_awesome</span>
                              Style de miniature proposé par l'IA, adapté à ta niche
                            </p>
                            {!thumbnailConceptProposal && (
                              <button
                                type="button"
                                disabled={thumbnailConceptLoading || !canGenerateAIImages}
                                title={canGenerateAIImages ? undefined : `Crédits insuffisants (${THUMBNAIL_GENERATION_CREDITS.toLocaleString()} crédits/miniature générée)`}
                                onClick={handleProposeThumbnailConcept}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#00c2ff] text-black hover:bg-[#00c2ff]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                <span className="material-symbols-outlined text-[13px]">{thumbnailConceptLoading ? 'hourglass_top' : 'auto_awesome'}</span>
                                {thumbnailConceptLoading ? 'Génération...' : (newChannel.thumbnail_style?.concept_name ? "Essayer un autre style" : "Proposer un style")}
                              </button>
                            )}
                          </div>

                          {!editingChannelId && (
                            <p className="text-[10px] text-slate-500">Enregistre d'abord la chaîne (avec sa niche) pour débloquer cette option.</p>
                          )}

                          {newChannel.thumbnail_style?.concept_name && !thumbnailConceptProposal && (
                            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-950/40 border border-emerald-700/40">
                              <span className="material-symbols-outlined text-[15px] text-emerald-400">check_circle</span>
                              <p className="text-[10px] text-emerald-300"><strong>Style verrouillé :</strong> {newChannel.thumbnail_style.concept_name} — toutes les prochaines vidéos de cette chaîne l'utiliseront.</p>
                            </div>
                          )}

                          {thumbnailConceptLoading && (
                            <div className="flex items-center justify-center py-6 text-[11px] text-slate-400 gap-2">
                              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                              Réflexion sur un style pour « {newChannel.niche || 'ta niche'} »...
                            </div>
                          )}

                          {thumbnailConceptProposal && !thumbnailConceptLoading && (
                            <div className="space-y-2">
                              <img
                                src={`${API_BASE.replace(/\/api$/, '')}${thumbnailConceptProposal.preview_url}`}
                                alt={thumbnailConceptProposal.concept.concept_name}
                                className="w-full aspect-video object-cover rounded-lg border border-[var(--border)]"
                              />
                              <p className="text-xs font-bold text-white">{thumbnailConceptProposal.concept.concept_name}</p>
                              <p className="text-[10px] text-slate-400">{thumbnailConceptProposal.concept.rationale}</p>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={handleApproveThumbnailConcept}
                                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[14px]">check</span> Valider ce style
                                </button>
                                <button
                                  type="button"
                                  disabled={thumbnailConceptLoading || !canGenerateAIImages}
                                  onClick={handleRejectThumbnailConcept}
                                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[var(--bg-surface-alt)] text-slate-200 hover:bg-[var(--bg-hover)] border border-[var(--border)] transition-colors disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[14px]">refresh</span> Un autre style
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400">
                          Ou configure-le toi-même : décris le style de fond voulu, ou donne des exemples en image. {THUMBNAIL_GENERATION_CREDITS.toLocaleString()} crédits/miniature.
                        </p>
                        <textarea
                          rows="2"
                          value={newChannel.thumbnail_style?.style_prompt || ''}
                          onChange={e => setNewChannel({ ...newChannel, thumbnail_style: { ...(newChannel.thumbnail_style || {}), style_prompt: e.target.value } })}
                          className="w-full bg-[var(--bg-input-alt)] border border-[var(--border)] rounded-xl p-2.5 text-[11px] text-white focus:border-[#00c2ff] outline-none placeholder-slate-500"
                          placeholder="Ex: peinture à l'huile classique, palette dorée, contre-jour dramatique..."
                        />
                        {/* Visual style picker — these are proven YouTube-thumbnail
                            archetypes (the composition + text pattern that actually drives
                            clicks), not generic art-style mood boards. Each card previews a
                            real example so the choice is "which of these click patterns fits
                            my niche", not a guess from an aesthetic label. See
                            /assets/thumbnail-styles for the reference images. */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { key: 'shocked_face', label: 'Visage choqué', prompt: 'Gros plan visage à l’expression choquée/intense, éclairage dramatique, texte énorme en gras avec contour noir, couleurs saturées, haut contraste' },
                            { key: 'before_after', label: 'Avant / Après', prompt: 'Image divisée en deux, avant terne à gauche, après lumineux et vivant à droite, texte blanc énorme en gras, contraste marqué entre les deux moitiés' },
                            { key: 'number_hook', label: 'Chiffre choc', prompt: 'Chiffre géant en 3D glossy occupant un tiers du cadre, texte blanc énorme en gras à côté, fond sombre dramatique, haut contraste' },
                            { key: 'warning_alert', label: 'Alerte / Urgence', prompt: 'Bandes de danger jaune et noir, texte rouge énorme en gras avec contour blanc, icône d’alerte, fond sombre orageux, haut contraste' },
                            { key: 'silhouette_quote', label: 'Silhouette inspirante', prompt: 'Silhouette sur une crête au coucher de soleil dramatique, texte blanc énorme en gras en bas, cinématique, haut contraste' },
                            { key: 'versus_duel', label: 'Duel / VS', prompt: 'Deux personnes face à face en contre-jour coloré, énorme texte VS en 3D au centre, éclairs dramatiques, haut contraste' },
                            { key: 'zoom_circle', label: 'Zoom + cercle', prompt: 'Détail entouré d’un épais cercle rouge façon marqueur, texte noir énorme en gras en haut, fond clair et propre, haut contraste' },
                            { key: 'portrait_storytelling', label: 'Portrait storytelling', prompt: 'Portrait propre au regard pensif, fond flouté chaleureux, légende blanche en gras en bas de l’image, haut contraste' },
                          ].map((style) => {
                            const active = newChannel.thumbnail_style?.style_prompt === style.prompt;
                            return (
                              <button
                                key={style.key}
                                type="button"
                                onClick={() => setNewChannel({ ...newChannel, thumbnail_style: { ...(newChannel.thumbnail_style || {}), style_prompt: style.prompt } })}
                                className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-colors group ${
                                  active ? 'border-[#00c2ff]' : 'border-transparent hover:border-[#00c2ff]/50'
                                }`}
                              >
                                <img
                                  src={`/assets/thumbnail-styles/${style.key}.jpg`}
                                  alt={style.label}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate text-left">{style.label}</span>
                                {active && (
                                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#00c2ff] flex items-center justify-center">
                                    <span className="material-symbols-outlined text-slate-950 text-[12px]">check</span>
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {!canGenerateAIImages && (
                          <button
                            type="button"
                            onClick={() => { setView('settings'); setSettingsTab('billing'); }}
                            className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[13px]">bolt</span>
                            Solde de crédits insuffisant — recharger
                          </button>
                        )}
                        {(newChannel.thumbnail_style?.reference_image_paths || []).length > 0 ? (
                          <div className="bg-[var(--bg-input-alt)] border border-[var(--border)] rounded-lg p-2.5 space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {(newChannel.thumbnail_style.reference_image_paths || []).map((path) => (
                                <div key={path} className="relative group shrink-0">
                                  <img
                                    src={`${STORAGE_BASE}/${path}`}
                                    alt="Référence miniature"
                                    className="w-14 h-14 rounded-lg object-cover border border-[var(--border)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveThumbnailStyle(path)}
                                    disabled={thumbnailStyleAnalyzing}
                                    title="Retirer cette image"
                                    className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center disabled:opacity-50"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500">Style dérivé des images ci-dessus — modifie le texte plus haut si tu veux l'affiner.</p>
                              <button
                                type="button"
                                onClick={() => handleRemoveThumbnailStyle()}
                                disabled={thumbnailStyleAnalyzing}
                                className="mt-1 text-[10px] font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                              >
                                Retirer les images de référence
                              </button>
                            </div>
                          </div>
                        ) : !editingChannelId ? (
                          <p className="text-[10px] text-amber-400/80">Enregistre d'abord la chaîne pour pouvoir ajouter des images de référence de miniature.</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}

                {/* STEP 5: MUSIQUE DE FOND & AUDIO */}
                {wizardStep === 5 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white">5. Musique de Fond Ambiante & Auto-Ducking</h3>
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-[11px] font-bold text-slate-400">Pas de musique</span>
                        <button
                          type="button"
                          onClick={() => setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, enabled: !(newChannel.music_preference.enabled ?? true) } })}
                          className={`relative w-9 h-5 rounded-full overflow-hidden transition-colors ${(newChannel.music_preference.enabled ?? true) ? 'bg-[#00c2ff]' : 'bg-[var(--border)]'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${(newChannel.music_preference.enabled ?? true) ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <span className="text-[11px] font-bold text-slate-400">Musique activée</span>
                      </label>
                    </div>
                    {!(newChannel.music_preference.enabled ?? true) && (
                      <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-700/40 rounded-xl px-3 py-2">
                        Musique désactivée — tes vidéos n'auront aucun fond sonore, seulement la voix off.
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* OPTION A: MES PROPRES MUSIQUES — stays selectable even while the
                          toggle above is off, so a creator can stage tracks first and have
                          the toggle auto-flip on (see handleMusicFileSelect) rather than
                          needing to turn music on before they're allowed to pick any. */}
                      <div
                        onClick={() => setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, mode: 'library' } })}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer space-y-4 flex flex-col ${
                          (newChannel.music_preference.mode || 'library') === 'library'
                            ? 'bg-[var(--bg-surface-alt)] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10'
                            : 'bg-[var(--bg-surface-soft)] border-[var(--border-soft)] hover:border-slate-500 opacity-60'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[#00c2ff] text-[24px]">library_music</span>
                            <h4 className="font-bold text-white text-xs">Mes propres musiques</h4>
                          </div>
                          <p className="text-[11px] text-slate-400">Importe tes morceaux — un est choisi au hasard à chaque vidéo. Jamais de musique tierce sans droits.</p>
                        </div>

                        <div
                          onClick={(e) => { e.stopPropagation(); musicInputRef.current && musicInputRef.current.click(); }}
                          className="border-2 border-dashed border-[var(--border)] hover:border-[#00c2ff] rounded-xl p-4 text-center cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-slate-400 text-[24px]">upload_file</span>
                          <p className="text-[11px] text-slate-300 mt-1 font-bold">Clique pour importer un ou plusieurs morceaux</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">MP3, WAV, M4A, OGG</p>
                        </div>
                        <input
                          ref={musicInputRef}
                          type="file"
                          accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,.mp3,.wav,.m4a,.ogg"
                          multiple
                          onChange={handleMusicFileSelect}
                          className="hidden"
                        />

                        {(newChannel.music_preference.tracks || []).length > 0 && (
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            {(newChannel.music_preference.tracks || []).map(t => (
                              <ServerAudioPreview
                                key={t}
                                src={getVideoUrl(t)}
                                name={t.split('/').pop()}
                                volume={newChannel.music_preference.volume ?? 0.10}
                                onRemove={() => handleDeleteMusicTrack(t)}
                              />
                            ))}
                          </div>
                        )}

                        {musicFiles.length > 0 && (
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-[10px] text-slate-500">Écoute directement — ils seront importés quand tu enregistres.</p>
                            {musicFiles.map((f, i) => (
                              <AudioFilePreview
                                key={`${f.name}-${i}`}
                                file={f}
                                volume={newChannel.music_preference.volume ?? 0.10}
                                onRemove={() => setMusicFiles(prev => prev.filter((_, idx) => idx !== i))}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* OPTION B: GÉNÉRER AVEC L'IA — same rule as Option A: stays
                          selectable even while the toggle above is off, so the creator
                          can generate/preview a track first and have the toggle
                          auto-flip on (see handleGenerateMusicPreview). */}
                      <div
                        onClick={() => setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, mode: 'ai_generate' } })}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer space-y-4 flex flex-col ${
                          newChannel.music_preference.mode === 'ai_generate'
                            ? 'bg-[var(--bg-surface-alt)] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10'
                            : 'bg-[var(--bg-surface-soft)] border-[var(--border-soft)] hover:border-slate-500 opacity-60'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[#00c2ff] text-[24px]">auto_awesome</span>
                            <h4 className="font-bold text-white text-xs">Générer avec l'IA</h4>
                          </div>
                          <p className="text-[11px] text-slate-400">KappGen écrit le prompt à partir de la niche (et du script), puis IziVoice génère la musique — {MUSIC_GENERATION_CREDITS.toLocaleString()} crédits par génération.</p>
                          {!canGenerateAIMusic && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setView('settings'); setSettingsTab('billing'); }}
                              className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[13px]">bolt</span>
                              Solde de crédits insuffisant — recharger
                            </button>
                          )}
                        </div>

                        <div onClick={(e) => e.stopPropagation()}>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">Prompt musical personnalisé (optionnel)</label>
                          <textarea
                            rows="2"
                            value={newChannel.music_preference.ai_prompt || ''}
                            onChange={e => setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, ai_prompt: e.target.value } })}
                            className="w-full bg-[var(--bg-input-alt)] border border-[var(--border)] rounded-xl p-2.5 text-[11px] text-white focus:border-[#00c2ff] outline-none placeholder-slate-500"
                            placeholder="Ex : piano doux, ambiance méditative, tempo lent... (laisse vide pour un prompt automatique)"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleGenerateMusicPreview(); }}
                          disabled={aiMusicGenerating || !canGenerateAIMusic}
                          title={canGenerateAIMusic ? undefined : `Crédits insuffisants (${MUSIC_GENERATION_CREDITS.toLocaleString()} crédits)`}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00c2ff] text-slate-950 font-bold text-xs hover:bg-[#38d0ff] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-[18px]">{aiMusicGenerating ? 'hourglass_top' : 'auto_awesome'}</span>
                          {aiMusicGenerating ? 'Génération...' : (aiMusicPreviewUrl ? 'Régénérer et réécouter' : 'Générer et écouter un aperçu')}
                        </button>

                        {aiMusicPreviewUrl && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <ServerAudioPreview
                              src={aiMusicPreviewUrl}
                              name="Aperçu généré (20s)"
                              volume={newChannel.music_preference.volume ?? 0.10}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">Volume Musique ({Math.round((newChannel.music_preference.volume ?? 0.10) * 100)}%)</label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.5"
                        step="0.01"
                        value={newChannel.music_preference.volume ?? 0.10}
                        onChange={e => setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, volume: parseFloat(e.target.value) } })}
                        className="w-full accent-[#00c2ff]"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 6: SOUS-TITRES & KARAOKÉ ASS */}
                {wizardStep === 6 && (
                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-white">6. Personnalisation Avancée des Sous-Titres</h3>
                    <div className="-mt-4 flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] text-slate-400">
                        Le style ci-dessous est gratuit. Le texte, lui, dépend de la transcription choisie à l'envoi de chaque vidéo.
                      </p>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[11px] font-extrabold whitespace-nowrap">
                        <span className="material-symbols-outlined text-[14px]">bolt</span>
                        Transcription IA : {TRANSCRIPTION_CREDITS_PER_SEC} crédits/sec d'audio
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px] gap-8 items-start">
                      {/* Settings column — split into CapCut-style toggle sections instead
                          of one long scroll, so the preview stays reachable without
                          hunting through every control at once. */}
                      <div className="space-y-4 min-w-0">
                        <div className="flex w-full bg-[var(--bg-surface-alt)] rounded-xl p-1 mb-1 overflow-x-auto">
                          {[
                            { id: 'presets', label: 'Préréglages', icon: 'style' },
                            { id: 'text', label: 'Police & Couleurs', icon: 'text_fields' },
                            { id: 'format', label: 'Mise en Forme', icon: 'tune' },
                            { id: 'background', label: 'Arrière-plan', icon: 'crop_square' },
                            { id: 'shadow', label: 'Ombre', icon: 'flare' },
                          ].map(tab => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setSubtitleTab(tab.id)}
                              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                                subtitleTab === tab.id ? 'bg-[#00c2ff] text-slate-950' : 'text-slate-300 hover:bg-[var(--border-soft)]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        {/* Presets Grid — CapCut-style: a square tile rendering the actual
                            style ("ABC123") so you pick by look, with the name below it. */}
                        {subtitleTab === 'presets' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-2">Presets de style sous-titre recommandés</label>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {SUBTITLE_PRESETS.map(preset => {
                              const isActive = newChannel.subtitle_style.font === preset.font
                                && newChannel.subtitle_style.color === preset.color
                                && newChannel.subtitle_style.size === preset.size;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => {
                                    setNewChannel(prev => ({
                                      ...prev,
                                      subtitle_style: {
                                        ...prev.subtitle_style,
                                        font: preset.font,
                                        size: preset.size,
                                        color: preset.color,
                                        outline_color: preset.outline_color,
                                        outline_width: preset.outline_width,
                                        box_color: preset.box_color
                                      }
                                    }));
                                  }}
                                  className="group text-center"
                                  title={preset.name}
                                >
                                  <div
                                    className={`aspect-square rounded-xl flex items-center justify-center overflow-hidden bg-[#12161f] border-2 transition-all ${
                                      isActive ? 'border-[#00c2ff] shadow-lg shadow-[#00c2ff]/20' : 'border-[var(--border)] group-hover:border-slate-500'
                                    }`}
                                    style={{
                                      backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.06), transparent 70%)'
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontFamily: preset.font,
                                        color: preset.color,
                                        WebkitTextStroke: `${Math.min(1.5, (preset.outline_width || 3) / 2.5)}px ${preset.outline_color || '#000000'}`,
                                        paintOrder: 'stroke fill',
                                        fontSize: '15px',
                                        ...(preset.box_color && preset.box_color !== 'transparent' ? {
                                          backgroundColor: preset.box_color,
                                          padding: '3px 6px',
                                          borderRadius: '4px'
                                        } : {})
                                      }}
                                      className="font-black"
                                    >
                                      ABC123
                                    </span>
                                  </div>
                                  <div className={`text-[10px] font-semibold mt-1.5 truncate ${isActive ? 'text-[#00c2ff]' : 'text-slate-300'}`}>
                                    {preset.name}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        )}

                        {/* Custom Controls */}
                        {subtitleTab === 'text' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-2">Police (Font)</label>
                            <button
                              type="button"
                              onClick={() => { setFontSearchQuery(''); setFontPickerOpen(true); }}
                              className="w-full flex items-center justify-between bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-left hover:border-[#00c2ff] transition-colors"
                            >
                              <span style={{ fontFamily: newChannel.subtitle_style.font }} className="text-sm text-white truncate">
                                {SUBTITLE_FONTS.find(f => f.value === newChannel.subtitle_style.font)?.label || newChannel.subtitle_style.font}
                              </span>
                              <span className="material-symbols-outlined text-[18px] text-slate-400 flex-shrink-0">expand_more</span>
                            </button>
                            <p className="text-[10px] text-slate-500 mt-1.5">{SUBTITLE_FONTS.length} polices réellement installées sur le serveur de rendu — l'aperçu est fidèle au rendu final.</p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-2">Taille du Texte ({newChannel.subtitle_style.size}px)</label>
                            <input
                              type="range"
                              min="28"
                              max="64"
                              value={newChannel.subtitle_style.size}
                              onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, size: parseInt(e.target.value) || 44 } })}
                              className="w-full accent-[#00c2ff] mt-3"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-2">Couleur du Texte</label>
                            <ColorPickerButton
                              value={newChannel.subtitle_style.base_color || '#FFFFFF'}
                              onChange={hex => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, base_color: hex } })}
                              label="Couleur du texte (au repos)"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-2">Couleur du Mot Actif (surbrillance)</label>
                            <ColorPickerButton
                              value={newChannel.subtitle_style.color || '#FFD700'}
                              onChange={hex => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, color: hex } })}
                              label="Couleur de surbrillance"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-2">Couleur du Contour</label>
                            <ColorPickerButton
                              allowNone
                              value={(newChannel.subtitle_style.outline_width ?? 3) === 0 ? 'transparent' : (newChannel.subtitle_style.outline_color || '#000000')}
                              onChange={hex => {
                                if (hex === 'transparent') {
                                  setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, outline_width: 0 } });
                                } else {
                                  setNewChannel({
                                    ...newChannel,
                                    subtitle_style: {
                                      ...newChannel.subtitle_style,
                                      outline_color: hex,
                                      outline_width: (newChannel.subtitle_style.outline_width ?? 3) === 0 ? 3 : (newChannel.subtitle_style.outline_width ?? 3)
                                    }
                                  });
                                }
                              }}
                              label="Couleur du contour"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Choisis « Aucune couleur » pour un texte simple sans contour.</p>
                          </div>

                          {(newChannel.subtitle_style.outline_width ?? 3) > 0 && (
                            <div>
                              <label className="block text-xs font-bold text-slate-300 mb-2">Épaisseur du Contour ({newChannel.subtitle_style.outline_width ?? 3}px)</label>
                              <input
                                type="range"
                                min="1"
                                max="8"
                                value={newChannel.subtitle_style.outline_width ?? 3}
                                onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, outline_width: parseInt(e.target.value) } })}
                                className="w-full accent-[#00c2ff] mt-3"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-2">Longueur des sous-titres ({newChannel.subtitle_style.words_per_line || 6} mots)</label>
                            <input
                              type="range"
                              min="1"
                              max="14"
                              value={newChannel.subtitle_style.words_per_line || 6}
                              onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, words_per_line: parseInt(e.target.value) || 6 } })}
                              className="w-full accent-[#00c2ff] mt-3"
                            />
                            <p className="text-[11px] text-slate-500 mt-1">Nombre de mots affichés en même temps à l'écran.</p>
                          </div>

                        </div>
                        )}

                        {/* Mise en forme du texte */}
                        {subtitleTab === 'format' && (
                        <div className="space-y-4">
                          <label className="block text-xs font-bold text-[#00c2ff]">Mise en Forme du Texte</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Style</label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, bold: !newChannel.subtitle_style.bold } })}
                                  className={`flex-1 py-2.5 rounded-xl text-sm font-black border transition-colors ${newChannel.subtitle_style.bold ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'}`}
                                >
                                  B
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, italic: !newChannel.subtitle_style.italic } })}
                                  className={`flex-1 py-2.5 rounded-xl text-sm italic font-bold border transition-colors ${newChannel.subtitle_style.italic ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'}`}
                                >
                                  I
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Casse</label>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { id: 'none', label: 'Aa' },
                                  { id: 'upper', label: 'AA' },
                                  { id: 'lower', label: 'aa' },
                                ].map(({ id, label }) => (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, text_case: id } })}
                                    className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${(newChannel.subtitle_style.text_case || 'none') === id ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'}`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Alignement</label>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { id: 'left', icon: 'format_align_left' },
                                  { id: 'center', icon: 'format_align_center' },
                                  { id: 'right', icon: 'format_align_right' },
                                ].map(({ id, icon }) => (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, align: id } })}
                                    className={`py-2.5 rounded-xl border transition-colors flex items-center justify-center ${(newChannel.subtitle_style.align || 'center') === id ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'}`}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Position</label>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { id: 'top', icon: 'vertical_align_top' },
                                  { id: 'center', icon: 'vertical_align_center' },
                                  { id: 'bottom', icon: 'vertical_align_bottom' },
                                ].map(({ id, icon }) => (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, position: id } })}
                                    className={`py-2.5 rounded-xl border transition-colors flex items-center justify-center ${(newChannel.subtitle_style.position || 'bottom') === id ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'}`}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Mode de surbrillance</label>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { id: 'word', label: 'Mot actif' },
                                  { id: 'line', label: 'Phrase' },
                                  { id: 'none', label: 'Aucune' },
                                ].map(({ id, label }) => (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, highlight_mode: id, karaoke: id === 'word' } })}
                                    className={`py-2 rounded-xl text-[10px] font-bold border transition-colors ${(newChannel.subtitle_style.highlight_mode || 'word') === id ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'}`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1.5">« Mot actif » colore le mot en cours de lecture ; « Phrase » colore toute la ligne ; « Aucune » garde une couleur neutre.</p>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Espacement des lettres ({newChannel.subtitle_style.letter_spacing || 0}px)</label>
                              <input
                                type="range"
                                min="-2"
                                max="20"
                                value={newChannel.subtitle_style.letter_spacing || 0}
                                onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, letter_spacing: parseInt(e.target.value) || 0 } })}
                                className="w-full accent-[#00c2ff] mt-3"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Opacité ({newChannel.subtitle_style.opacity ?? 100}%)</label>
                              <input
                                type="range"
                                min="10"
                                max="100"
                                value={newChannel.subtitle_style.opacity ?? 100}
                                onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, opacity: parseInt(e.target.value) ?? 100 } })}
                                className="w-full accent-[#00c2ff] mt-3"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Rotation ({newChannel.subtitle_style.rotation || 0}°)</label>
                              <input
                                type="range"
                                min="-45"
                                max="45"
                                value={newChannel.subtitle_style.rotation || 0}
                                onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, rotation: parseInt(e.target.value) || 0 } })}
                                className="w-full accent-[#00c2ff] mt-3"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-300 mb-2">Décalage X ({newChannel.subtitle_style.x_offset || 0}px)</label>
                                <input
                                  type="range"
                                  min="-400"
                                  max="400"
                                  value={newChannel.subtitle_style.x_offset || 0}
                                  onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, x_offset: parseInt(e.target.value) || 0 } })}
                                  className="w-full accent-[#00c2ff] mt-3"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-300 mb-2">Décalage Y ({newChannel.subtitle_style.y_offset || 0}px)</label>
                                <input
                                  type="range"
                                  min="-400"
                                  max="400"
                                  value={newChannel.subtitle_style.y_offset || 0}
                                  onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, y_offset: parseInt(e.target.value) || 0 } })}
                                  className="w-full accent-[#00c2ff] mt-3"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        )}

                        {/* Arrière-plan (boîte) */}
                        {subtitleTab === 'background' && (
                        <div className="space-y-4">
                          <label className="block text-xs font-bold text-[#00c2ff]">Arrière-plan (rectangle derrière le texte)</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Couleur</label>
                              <ColorPickerButton
                                allowNone
                                value={newChannel.subtitle_style.box_color}
                                onChange={hex => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, box_color: hex } })}
                                label="Couleur de fond"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-2">Épaisseur de la bulle ({newChannel.subtitle_style.box_padding ?? 10}px)</label>
                              <input
                                type="range"
                                min="0"
                                max="40"
                                value={newChannel.subtitle_style.box_padding ?? 10}
                                onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, box_padding: parseInt(e.target.value) || 0 } })}
                                className="w-full accent-[#00c2ff] mt-3"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500">Le moteur de rendu vidéo dessine un rectangle plein autour du texte — les coins arrondis ne s'appliquent qu'à cet aperçu, pas encore au rendu final.</p>
                        </div>
                        )}

                        {/* Ombre */}
                        {subtitleTab === 'shadow' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="shadow-toggle"
                              checked={!!newChannel.subtitle_style.shadow}
                              onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, shadow: e.target.checked } })}
                              className="w-4 h-4 accent-[#00c2ff]"
                            />
                            <label htmlFor="shadow-toggle" className="text-xs font-bold text-[#00c2ff]">Ombre portée</label>
                          </div>
                          {newChannel.subtitle_style.shadow && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-300 mb-2">Couleur de l'ombre</label>
                                <ColorPickerButton
                                  value={newChannel.subtitle_style.shadow_color || '#000000'}
                                  onChange={hex => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, shadow_color: hex } })}
                                  label="Couleur de l'ombre"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-300 mb-2">Distance ({newChannel.subtitle_style.shadow_distance ?? 3}px)</label>
                                <input
                                  type="range"
                                  min="0"
                                  max="15"
                                  value={newChannel.subtitle_style.shadow_distance ?? 3}
                                  onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, shadow_distance: parseInt(e.target.value) || 0 } })}
                                  className="w-full accent-[#00c2ff] mt-3"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        )}
                      </div>

                      {/* Preview column — sticks in place so it stays visible while the
                          settings column (which can run long) scrolls under it. */}
                      <div className="lg:sticky lg:top-4">
                        <label className="block text-xs font-bold text-slate-300 mb-2">Aperçu en direct</label>
                        <div ref={wizardSubtitlePreviewRef} className="w-full aspect-video rounded-2xl bg-gradient-to-b from-slate-900 to-black border border-[var(--border)] relative overflow-hidden px-6">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,194,255,0.08),transparent_70%)]"></div>
                          <div className={`absolute inset-x-6 z-10 flex ${subtitleAlignClass(newChannel.subtitle_style.align)} ${subtitlePositionClass(newChannel.subtitle_style.position)}`}>
                            <div
                              style={{
                                backgroundColor: newChannel.subtitle_style.box_color && newChannel.subtitle_style.box_color !== 'transparent' ? newChannel.subtitle_style.box_color : 'transparent',
                                padding: `${Math.max(2, (newChannel.subtitle_style.box_padding ?? 10) * 0.6)}px ${Math.max(4, (newChannel.subtitle_style.box_padding ?? 10) * 0.9)}px`,
                                borderRadius: '10px',
                                opacity: (newChannel.subtitle_style.opacity ?? 100) / 100,
                                transform: `translateX(${(newChannel.subtitle_style.x_offset || 0) * wizardSubtitlePreviewScale}px) translateY(${(newChannel.subtitle_style.y_offset || 0) * wizardSubtitlePreviewScale}px) rotate(${newChannel.subtitle_style.rotation || 0}deg)`
                              }}
                              className="flex flex-wrap justify-center items-center gap-2 text-center"
                            >
                              {sampleWords.map((wordObj, i) => {
                                const highlightMode = newChannel.subtitle_style.highlight_mode || (newChannel.subtitle_style.karaoke === false ? 'line' : 'word');
                                const isColored = highlightMode === 'line' || (highlightMode === 'word' && wordObj.highlight);
                                const displayText = applySubtitleCase(wordObj.text, newChannel.subtitle_style.text_case);
                                const hasBox = newChannel.subtitle_style.box_color && newChannel.subtitle_style.box_color !== 'transparent';
                                const outlinePx = hasBox ? 0 : (newChannel.subtitle_style.outline_width ?? 3) * wizardSubtitlePreviewScale;
                                return (
                                  <span
                                    key={i}
                                    style={{
                                      fontFamily: newChannel.subtitle_style.font,
                                      fontSize: `${(newChannel.subtitle_style.size || 44) * wizardSubtitlePreviewScale}px`,
                                      fontWeight: newChannel.subtitle_style.bold ? '900' : '700',
                                      fontStyle: newChannel.subtitle_style.italic ? 'italic' : 'normal',
                                      letterSpacing: `${(newChannel.subtitle_style.letter_spacing || 0) * wizardSubtitlePreviewScale}px`,
                                      color: isColored ? (newChannel.subtitle_style.color || '#FFD700') : (newChannel.subtitle_style.base_color || '#FFFFFF'),
                                      WebkitTextStroke: outlinePx > 0 ? `${outlinePx}px ${newChannel.subtitle_style.outline_color || '#000000'}` : 'none',
                                      paintOrder: 'stroke fill',
                                      textShadow: newChannel.subtitle_style.shadow
                                        ? `${(newChannel.subtitle_style.shadow_distance ?? 3)}px ${(newChannel.subtitle_style.shadow_distance ?? 3)}px 4px ${newChannel.subtitle_style.shadow_color || '#000000'}`
                                        : 'none'
                                    }}
                                    className="inline-block"
                                  >
                                    {displayText}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 7: EFFETS VISUELS — réglages + un aperçu dédié aux effets seuls
                    (couleur/texture sur une vraie image), distinct de l'Aperçu Final complet
                    de l'étape 8 qui montre tous les réglages ensemble (sous-titres, logo...). */}
                {wizardStep === 7 && (() => {
                  const colorGrade = newChannel.effects_config.color_grade || 'warm';
                  const overlayEffects = newChannel.effects_config.overlay_effects || ['grain'];
                  const toggleOverlayEffect = (id) => {
                    const next = overlayEffects.includes(id) ? overlayEffects.filter(e => e !== id) : [...overlayEffects, id];
                    setNewChannel({ ...newChannel, effects_config: { ...newChannel.effects_config, overlay_effects: next } });
                  };
                  const hasGrain = overlayEffects.includes('grain') || overlayEffects.includes('white_noise');
                  const hasVignette = overlayEffects.includes('vignette');
                  const grainIntensity = (newChannel.effects_config.grain_intensity ?? 50) / 100;
                  const vignetteIntensity = (newChannel.effects_config.vignette_intensity ?? 50) / 100;
                  const hasChromaticAberration = overlayEffects.includes('chromatic_aberration');
                  const hasOldFilm = overlayEffects.includes('old_film');
                  const hasFlicker = overlayEffects.includes('flicker');
                  const hasSoftFocus = overlayEffects.includes('soft_focus');
                  const hasSharpen = overlayEffects.includes('sharpen');

                  const colorGradeFilter = ({
                    warm: 'saturate(1.25) sepia(0.12) brightness(1.05)',
                    vintage: 'saturate(0.75) sepia(0.2) contrast(1.05)',
                    dramatic: 'contrast(1.3) saturate(0.85)',
                    cool: 'saturate(1.1) hue-rotate(-8deg) brightness(0.98)',
                    noir: 'grayscale(1) contrast(1.25)',
                    sepia: 'sepia(0.75) contrast(1.05)',
                    vibrant: 'saturate(1.6) contrast(1.1)',
                    faded: 'contrast(0.82) brightness(1.08) saturate(0.85)',
                    cinematic: 'saturate(1.1) contrast(1.12) hue-rotate(-4deg)',
                    none: 'none',
                  })[colorGrade] || 'none';

                  const previewImgFilter = [
                    colorGradeFilter !== 'none' ? colorGradeFilter : '',
                    hasSoftFocus ? 'blur(1.2px)' : '',
                    hasSharpen ? 'contrast(1.08) saturate(1.08)' : '',
                  ].filter(Boolean).join(' ') || 'none';

                  // Falls back to one of our own bundled stock photos when the
                  // client hasn't uploaded a library yet — better than a blank
                  // "import your images first" placeholder with no visual at all.
                  const previewImgSrc = localImageFiles.length > 0
                    ? URL.createObjectURL(localImageFiles[0])
                    : (wizardMode === 'edit' && editingChannelId
                      ? `${API_BASE}/channels/${editingChannelId}/library-preview`
                      : STABLE_EFFECT_PREVIEW_IMAGES[0]);
                  const isStablePreview = localImageFiles.length === 0 && !(wizardMode === 'edit' && editingChannelId);

                  return (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-bold text-white">7. Effets Visuels</h3>
                        <p className="text-xs text-slate-400 mt-1">Appliqués sur l'ensemble de la vidéo, en plus des transitions et du zoom automatiques déjà actifs.</p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
                        <div className="space-y-5 min-w-0">
                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-2">Étalonnage des couleurs</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: 'warm', label: 'Chaud' },
                                { id: 'vintage', label: 'Vintage' },
                                { id: 'dramatic', label: 'Dramatique' },
                                { id: 'cool', label: 'Froid' },
                                { id: 'noir', label: 'Noir & Blanc' },
                                { id: 'sepia', label: 'Sépia' },
                                { id: 'vibrant', label: 'Vibrant' },
                                { id: 'faded', label: 'Délavé' },
                                { id: 'cinematic', label: 'Cinéma' },
                              ].map(({ id, label }) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setNewChannel({ ...newChannel, effects_config: { ...newChannel.effects_config, color_grade: id } })}
                                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                    colorGrade === id
                                      ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]'
                                      : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-2">Texture / Effets superposés — combinables entre eux</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {[
                                { id: 'grain', label: 'Grain léger' },
                                { id: 'white_noise', label: 'Bruit blanc' },
                                { id: 'vignette', label: 'Vignette' },
                                { id: 'chromatic_aberration', label: 'Aberration chromatique' },
                                { id: 'old_film', label: 'Vieux film' },
                                { id: 'flicker', label: 'Scintillement' },
                                { id: 'soft_focus', label: 'Flou artistique' },
                                { id: 'sharpen', label: 'Netteté HD' },
                              ].map(({ id, label }) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => toggleOverlayEffect(id)}
                                  aria-pressed={overlayEffects.includes(id)}
                                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                                    overlayEffects.includes(id)
                                      ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]'
                                      : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'
                                  }`}
                                >
                                  {overlayEffects.includes(id) && <span className="material-symbols-outlined text-[14px]">check</span>}
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {(hasGrain || hasVignette) && (
                            <div className="pt-2 border-t border-[var(--border-soft)] space-y-4">
                              <label className="block text-xs font-bold text-[#00c2ff]">Intensité</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {hasGrain && (
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-300 mb-2">
                                      Grain / Bruit ({newChannel.effects_config.grain_intensity ?? 50}%)
                                    </label>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={newChannel.effects_config.grain_intensity ?? 50}
                                      onChange={e => setNewChannel({ ...newChannel, effects_config: { ...newChannel.effects_config, grain_intensity: parseInt(e.target.value) } })}
                                      className="w-full accent-[#00c2ff]"
                                    />
                                  </div>
                                )}
                                {hasVignette && (
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-300 mb-2">
                                      Assombrissement des bords ({newChannel.effects_config.vignette_intensity ?? 50}%)
                                    </label>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={newChannel.effects_config.vignette_intensity ?? 50}
                                      onChange={e => setNewChannel({ ...newChannel, effects_config: { ...newChannel.effects_config, vignette_intensity: parseInt(e.target.value) } })}
                                      className="w-full accent-[#00c2ff]"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        </div>

                        <div className="lg:sticky lg:top-4">
                          <label className="block text-xs font-bold text-slate-300 mb-2">Aperçu des effets</label>
                          <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-[var(--border)] bg-[var(--bg-input-alt)]">
                            {previewImgSrc ? (
                              // A real project image (library-preview) can 404 when the channel
                              // has no uploaded library yet (e.g. AI-generated-only channels) —
                              // fall back to the bundled demo image instead of hiding the whole
                              // preview, so the effect is always visible.
                              <img src={previewImgSrc} alt="Aperçu des effets" className="w-full h-full object-cover" style={{ filter: previewImgFilter }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = STABLE_EFFECT_PREVIEW_IMAGES[0]; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-center px-6">
                                <p className="text-xs text-slate-500">Importe un dossier d'images à l'étape "Visuels" pour voir l'aperçu sur une vraie image de ta chaîne.</p>
                              </div>
                            )}
                            {isStablePreview && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/50 text-[9px] font-bold text-slate-300 backdrop-blur-sm">Image de démonstration</span>
                            )}
                            {hasChromaticAberration && (
                              <>
                                <img src={previewImgSrc} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-60" style={{ filter: 'brightness(0.6) sepia(1) saturate(6) hue-rotate(-50deg)', transform: 'translateX(-2px)' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = STABLE_EFFECT_PREVIEW_IMAGES[0]; }} />
                                <img src={previewImgSrc} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-60" style={{ filter: 'brightness(0.6) sepia(1) saturate(6) hue-rotate(140deg)', transform: 'translateX(2px)' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = STABLE_EFFECT_PREVIEW_IMAGES[0]; }} />
                              </>
                            )}
                            {(hasGrain || hasOldFilm) && (
                              <div
                                className="absolute inset-0 mix-blend-overlay"
                                style={{
                                  opacity: hasOldFilm ? 0.4 : (overlayEffects.includes('white_noise') && !overlayEffects.includes('grain') ? 0.6 : 0.3) * grainIntensity,
                                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
                                }}
                              />
                            )}
                            {(hasVignette || hasOldFilm) && (
                              <div className="absolute inset-0" style={{ boxShadow: hasOldFilm ? 'inset 0 0 50px 15px rgba(0,0,0,0.75)' : `inset 0 0 ${60 * vignetteIntensity}px ${20 * vignetteIntensity}px rgba(0,0,0,0.8)` }} />
                            )}
                            {hasOldFilm && (
                              <div className="absolute inset-0" style={{ backgroundColor: 'rgba(120,90,40,0.15)', mixBlendMode: 'multiply' }} />
                            )}
                            {hasFlicker && (
                              <div className="absolute inset-0 bg-white animate-pulse" style={{ opacity: 0.06 }} />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2">Aperçu approximatif — le rendu final vidéo peut légèrement varier.</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* STEP 8: PUBLICATION YOUTUBE */}
                {wizardStep === 8 && (() => {
                  const timeMode = newChannel.publish_time_mode || 'range';
                  const timeModeToggle = (
                    <div className="flex items-center gap-1 bg-[var(--bg-input-alt)] border border-[var(--border)] rounded-lg p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setNewChannel({ ...newChannel, publish_time_mode: 'fixed' })}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${timeMode === 'fixed' ? 'bg-[#00c2ff] text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      >
                        Heure fixe
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewChannel({ ...newChannel, publish_time_mode: 'range' })}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${timeMode === 'range' ? 'bg-[#00c2ff] text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      >
                        Plage horaire
                      </button>
                    </div>
                  );
                  const timeControls = (
                    <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 flex-wrap">
                      {timeModeToggle}
                      <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">schedule</span>
                      {timeMode === 'fixed' ? (
                        <>
                          <span className="text-[11px] text-slate-400 shrink-0">Heure :</span>
                          <HourDropdown
                            value={newChannel.publish_schedule_hour ?? 8}
                            onChange={h => setNewChannel({ ...newChannel, publish_schedule_hour: h })}
                          />
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] text-slate-400 shrink-0">Plage :</span>
                          <HourDropdown
                            value={newChannel.automation_window_start_hour ?? 7}
                            onChange={h => setNewChannel({ ...newChannel, automation_window_start_hour: h })}
                          />
                          <span className="text-[11px] text-slate-500">à</span>
                          <HourDropdown
                            value={newChannel.automation_window_end_hour ?? 11}
                            onChange={h => setNewChannel({ ...newChannel, automation_window_end_hour: h })}
                          />
                        </>
                      )}
                    </div>
                  );
                  const weekdaySelector = (
                    <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">event_repeat</span>
                        <span className="text-[11px] text-slate-400">Jours de publication</span>
                      </div>
                      <div className="flex gap-1.5">
                        {[
                          { id: 0, label: 'L' }, { id: 1, label: 'M' }, { id: 2, label: 'M' },
                          { id: 3, label: 'J' }, { id: 4, label: 'V' }, { id: 5, label: 'S' }, { id: 6, label: 'D' },
                        ].map(({ id, label }) => {
                          const activeDays = newChannel.active_days;
                          const isOn = !activeDays || activeDays.length === 0 || activeDays.includes(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                const current = (activeDays && activeDays.length > 0) ? activeDays : [0, 1, 2, 3, 4, 5, 6];
                                const next = current.includes(id) ? current.filter(d => d !== id) : [...current, id].sort();
                                setNewChannel({ ...newChannel, active_days: next.length === 7 ? null : next });
                              }}
                              className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
                                isOn ? 'bg-[#00c2ff] text-slate-950 border-[#00c2ff]' : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                  const timezonePicker = (
                    <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 relative">
                      <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">public</span>
                      <span className="text-[11px] text-slate-400 shrink-0">Fuseau horaire :</span>
                      <button
                        type="button"
                        onClick={() => { setTimezoneMenuOpen(o => !o); setTimezoneSearch(''); }}
                        className="flex-1 min-w-0 flex items-center justify-between gap-2 bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-slate-500 rounded-lg px-2.5 py-1.5 text-[11px] text-white text-left transition-colors"
                      >
                        <span className="truncate">{newChannel.timezone || 'Africa/Douala'}</span>
                        <span className={`material-symbols-outlined text-[15px] text-slate-400 shrink-0 transition-transform ${timezoneMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
                      </button>
                      {timezoneMenuOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-50 overflow-hidden">
                          <div className="p-2 border-b border-[var(--border-dropdown)]">
                            <input
                              autoFocus
                              value={timezoneSearch}
                              onChange={e => setTimezoneSearch(e.target.value)}
                              placeholder="Rechercher (ex: Douala, Paris...)"
                              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-[#00c2ff] outline-none"
                            />
                          </div>
                          <div className="max-h-52 overflow-y-auto py-1">
                            {TIMEZONE_OPTIONS
                              .filter(tz => tz.toLowerCase().includes(timezoneSearch.toLowerCase()))
                              .slice(0, 200)
                              .map(tz => (
                                <button
                                  key={tz}
                                  type="button"
                                  onClick={() => { setNewChannel({ ...newChannel, timezone: tz }); setTimezoneMenuOpen(false); }}
                                  className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between gap-2 ${
                                    tz === (newChannel.timezone || 'Africa/Douala') ? 'text-[#00c2ff] font-bold' : 'text-slate-300'
                                  }`}
                                >
                                  <span className="truncate">{tz}</span>
                                  {tz === (newChannel.timezone || 'Africa/Douala') && <span className="material-symbols-outlined text-[14px] shrink-0">check</span>}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                  return (
                    <div className="space-y-6">
                      <h3 className="text-base font-bold text-white">8. Publication YouTube</h3>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-2">Publication YouTube</label>
                        <p className="text-[11px] text-slate-500 mb-2">Indépendant du mode de génération du script — décide ce qui arrive à une vidéo une fois qu'elle est prête.</p>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)] text-slate-400 text-[10px] font-bold mb-3">
                          <span className="material-symbols-outlined text-[13px] text-emerald-400">check_circle</span>
                          Gratuit pour l'instant — pourra devenir payant à l'avenir
                        </div>
                        <ModeDropdown
                          value={newChannel.publish_mode || 'manual'}
                          onChange={v => setNewChannel({ ...newChannel, publish_mode: v })}
                          options={[
                            { value: 'manual', icon: 'download', label: 'Manuelle', desc: 'Tu télécharges la vidéo, ou tu cliques « Publier » quand tu veux' },
                            { value: 'scheduled', icon: 'schedule', label: 'Programmée', desc: 'Une seule vidéo, publiée un nombre de jours donné après le rendu' },
                            { value: 'auto', icon: 'bolt', label: 'Automatique', desc: 'Planning récurrent — les jours et l\'heure que tu choisis' },
                          ]}
                        />
                        {newChannel.publish_mode === 'scheduled' && (
                          <div className="mt-3 space-y-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">Combien de jours après le rendu</label>
                              <select
                                value={newChannel.publish_schedule_day_offset ?? 1}
                                onChange={e => setNewChannel({ ...newChannel, publish_schedule_day_offset: parseInt(e.target.value) })}
                                className="bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                              >
                                <option value={0}>Le jour même</option>
                                <option value={1}>Le lendemain</option>
                                <option value={2}>Dans 2 jours</option>
                                <option value={3}>Dans 3 jours</option>
                              </select>
                            </div>
                            {timeControls}
                            {timezonePicker}
                          </div>
                        )}
                        {newChannel.publish_mode === 'auto' && (
                          <div className="mt-3 space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                              {timeControls}
                              {weekdaySelector}
                            </div>
                            {timezonePicker}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* STEP 9: APERÇU FINAL DU DESIGN VIDÉO (LIVE 16:9 LANDSCAPE PREVIEW) */}
                {wizardStep === 9 && (() => {
                  const userImagePreview = localImageFiles.length > 0 ? URL.createObjectURL(localImageFiles[0]) : null;
                  const stepOverlayEffects = newChannel.effects_config.overlay_effects || ['grain'];
                  const stepHasGrain = stepOverlayEffects.includes('grain') || stepOverlayEffects.includes('white_noise');
                  const stepHasVignette = stepOverlayEffects.includes('vignette');
                  const stepGrainIntensity = (newChannel.effects_config.grain_intensity ?? 50) / 100;
                  const stepVignetteIntensity = (newChannel.effects_config.vignette_intensity ?? 50) / 100;
                  const musicLabel = musicFiles[0]?.name
                    || newChannel.music_preference?.tracks?.[0]?.split('/').pop()?.replace(/^[0-9a-f]{8}_/, '')
                    || (newChannel.music_preference?.mode === 'ai_generate' ? 'Musique générée par IA' : null);
                  const hasThumbnailStyle = !!newChannel.thumbnail_style?.style_prompt;
                  // Chronological pipeline order (1. Identité/logo → 2-3. Script/Voix Off →
                  // 4. Visuels → 5. Musique → 6. Sous-titres → 7. Effets). The thumbnail isn't
                  // listed here — it's generated separately at publish time, not a layer
                  // composited into the video itself.
                  const recapItemsById = {
                    logo: { id: 'logo', label: 'Logo de la chaîne', icon: 'workspace_premium', available: !!resolvedLogoUrl },
                    // A channel always has a voice — either the one explicitly picked, or the
                    // platform default the creator never bothered changing — so this is always on.
                    voiceover: { id: 'voiceover', label: 'Voix Off', icon: 'mic', available: true },
                    visual: { id: 'visual', label: 'Visuel de fond', icon: 'image', available: !!(userImagePreview || (wizardMode === 'edit' && activeChannel)) },
                    music: { id: 'music', label: 'Musique de fond', icon: 'music_note', available: !!musicLabel },
                    subtitles: { id: 'subtitles', label: 'Sous-titres', icon: 'subtitles', available: true },
                    effects: { id: 'effects', label: 'Effets visuels', icon: 'auto_awesome', available: stepHasGrain || stepHasVignette || (newChannel.effects_config.color_grade && newChannel.effects_config.color_grade !== 'none') },
                    watermark: { id: 'watermark', label: 'Filigrane KappGen', icon: 'branding_watermark', available: true },
                  };
                  // Persisted per-channel so a creator's chosen stacking order survives
                  // leaving and reopening the wizard — defaults to the original
                  // chronological order for channels that never touched it.
                  const DEFAULT_LAYER_ORDER = ['logo', 'voiceover', 'visual', 'music', 'subtitles', 'effects', 'watermark'];
                  const savedLayerOrder = newChannel.effects_config.layer_order;
                  const layerOrder = Array.isArray(savedLayerOrder) && savedLayerOrder.length === DEFAULT_LAYER_ORDER.length && DEFAULT_LAYER_ORDER.every(id => savedLayerOrder.includes(id))
                    ? savedLayerOrder
                    : DEFAULT_LAYER_ORDER;
                  const recapItems = layerOrder.map(id => recapItemsById[id]);
                  const reorderLayers = (draggedId, targetId) => {
                    if (draggedId === targetId) return;
                    const order = [...layerOrder];
                    const from = order.indexOf(draggedId);
                    const to = order.indexOf(targetId);
                    if (from === -1 || to === -1) return;
                    order.splice(from, 1);
                    order.splice(to, 0, draggedId);
                    setNewChannel({ ...newChannel, effects_config: { ...newChannel.effects_config, layer_order: order } });
                  };
                  // Preview-only stacking order (z-index) for the layers that actually
                  // paint something in the mockup below — drives visually what "arrière-plan
                  // → premier plan" in the list means, in real time as you drag. 'visual'
                  // (the background image) and 'voiceover' (audio, nothing to draw) are
                  // skipped since they have no z-order of their own to assign.
                  const zForLayer = (id) => (layerOrder.indexOf(id) + 1) * 10;
                  // Logo/sous-titres/effets/musique are real, saved settings — toggling them
                  // here actually edits `newChannel` (persisted on save), same as any other
                  // field in the wizard. "visual" and "voiceover" have no real off-switch (a
                  // video always needs a background and a voice track), so they stay
                  // read-only checks — just confirming that step was actually filled in.
                  const isRecapChecked = (id) => {
                    if (id === 'logo') return newChannel.branding.logo_enabled ?? true;
                    if (id === 'subtitles') return newChannel.subtitle_style.enabled ?? true;
                    if (id === 'effects') return newChannel.effects_config.enabled ?? true;
                    // Music defaults to off — it only counts as "on" once the creator
                    // actually picked a track/AI generation, same rule as the Musique step.
                    if (id === 'music') return newChannel.music_preference.enabled ?? false;
                    if (id === 'voiceover') return true;
                    if (id === 'watermark') return newChannel.effects_config.watermark_enabled ?? true;
                    // 'visual' has no real "disabled" setting to reflect (a video always
                    // has a background — library or AI-generated) — always on, same as
                    // voiceover, instead of an orphaned local toggle that could get stuck
                    // unchecked with no way for it to reflect the actual configuration.
                    return true;
                  };
                  const toggleRecap = (id) => {
                    if (id === 'logo') return setNewChannel({ ...newChannel, branding: { ...newChannel.branding, logo_enabled: !isRecapChecked('logo') } });
                    if (id === 'subtitles') return setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, enabled: !isRecapChecked('subtitles') } });
                    if (id === 'effects') return setNewChannel({ ...newChannel, effects_config: { ...newChannel.effects_config, enabled: !isRecapChecked('effects') } });
                    if (id === 'music') return setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, enabled: !isRecapChecked('music') } });
                    if (id === 'voiceover') return; // read-only — always on once a voice is picked, nothing to toggle
                    if (id === 'visual') return; // read-only — a video always has a background, nothing to toggle
                    if (id === 'watermark') {
                      if (!canRemoveWatermark) { showToast('Achète au moins un pack de crédits pour retirer le filigrane KappGen.', 'error'); return; }
                      return setNewChannel({ ...newChannel, effects_config: { ...newChannel.effects_config, watermark_enabled: !isRecapChecked('watermark') } });
                    }
                  };
                  return (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-base font-bold text-white">9. Aperçu Final du Layout & Design Vidéo</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Voici le rendu final simulé, au format vidéo longue durée YouTube (16:9).</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-8 items-center">
                        {/* Layers — displayed front-to-back (top row = what's drawn on top,
                            same convention as Photoshop/Figma layer panels), even though the
                            underlying persisted `layerOrder` stays back-to-front (index 0 =
                            back) to match zForLayer/the backend compositing order below —
                            dragging is id-based (reorderLayers), so this display reversal
                            doesn't need any special-casing there.
                            Decocher un calque le masque dans l'aperçu à droite, sans rien
                            changer à la configuration réelle de la chaîne. */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-300 mb-3">Calques (premier plan → arrière-plan)</label>
                          <div className="relative pl-2">
                            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-[var(--border)]"></div>
                            {[...recapItems].reverse().map(({ id, label, icon, available }, idx) => (
                              <div
                                key={id}
                                draggable
                                onDragStart={(e) => { setDraggedLayerId(id); e.dataTransfer.effectAllowed = 'move'; }}
                                onDragEnd={() => setDraggedLayerId(null)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (draggedLayerId) reorderLayers(draggedLayerId, id); setDraggedLayerId(null); }}
                                className={`relative z-10 flex items-center gap-1 mb-1.5 transition-opacity ${draggedLayerId === id ? 'opacity-40' : ''}`}
                              >
                                <span
                                  title="Glisser pour réordonner"
                                  className="material-symbols-outlined text-[16px] shrink-0 text-slate-600 cursor-grab active:cursor-grabbing"
                                >
                                  drag_indicator
                                </span>
                                <button
                                  type="button"
                                  disabled={!available}
                                  onClick={() => toggleRecap(id)}
                                  className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2.5 text-left ${
                                    !available
                                      ? 'bg-[var(--bg-surface-alt)]/50 border-[var(--border)]/50 text-slate-600 cursor-not-allowed'
                                      : isRecapChecked(id)
                                        ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                                        : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-500 hover:border-slate-500'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px] shrink-0">{icon}</span>
                                  <span className="flex-1 truncate">{label}</span>
                                  {id === 'watermark' && !canRemoveWatermark && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/25 text-amber-300 text-[8px] font-bold uppercase tracking-wide shrink-0">Premium</span>
                                  )}
                                  <span className="material-symbols-outlined text-[16px] shrink-0">{available && isRecapChecked(id) ? 'check_box' : 'check_box_outline_blank'}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Live 16:9 Landscape Video Mockup Preview */}
                        <div className="flex justify-center">
                        <div ref={mockupSubtitlePreviewRef} className="w-full max-w-[640px] aspect-[16/9] bg-slate-950 rounded-2xl border-4 border-[var(--border)] relative overflow-hidden shadow-2xl flex flex-col justify-between p-5">

                          {/* Background Scene Visual — a freshly picked file from this wizard
                              session takes priority; otherwise fall back to a real random image
                              already stored server-side for this channel (not a generic stock photo);
                              and if that 404s (or the channel is AI-generated-only, so there's no
                              library preview at all), fall back to the same bundled demo image used
                              in the Effets step, so this mockup never renders as a flat black box. */}
                          <div className="absolute inset-0">
                            {!isRecapChecked('visual') ? null : userImagePreview ? (
                              <img
                                src={userImagePreview}
                                alt="Aperçu visuel de la vidéo"
                                className="w-full h-full object-cover opacity-85"
                              />
                            ) : resolveEnabledImageSources(newChannel.image_style).includes('library') && wizardMode === 'edit' && activeChannel ? (
                              <img
                                key={activeChannel.id}
                                src={`${API_BASE}/channels/${activeChannel.id}/library-preview`}
                                alt="Aperçu visuel de la vidéo"
                                className="w-full h-full object-cover opacity-85"
                                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = STABLE_EFFECT_PREVIEW_IMAGES[0]; }}
                              />
                            ) : (
                              <img
                                src={STABLE_EFFECT_PREVIEW_IMAGES[0]}
                                alt="Aperçu visuel de la vidéo"
                                className="w-full h-full object-cover opacity-85"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30"></div>
                          </div>

                          {isRecapChecked('effects') && stepHasGrain && (
                            <div
                              className="absolute inset-0 mix-blend-overlay"
                              style={{
                                zIndex: zForLayer('effects'),
                                opacity: (stepOverlayEffects.includes('white_noise') && !stepOverlayEffects.includes('grain') ? 0.6 : 0.3) * stepGrainIntensity,
                                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
                              }}
                            />
                          )}
                          {isRecapChecked('effects') && stepHasVignette && (
                            <div className="absolute inset-0" style={{ zIndex: zForLayer('effects'), boxShadow: `inset 0 0 ${60 * stepVignetteIntensity}px ${20 * stepVignetteIntensity}px rgba(0,0,0,0.8)` }} />
                          )}

                          {/* KappGen watermark — centered, low opacity, matches exactly what's
                              burned into the real render when enabled (see WATERMARK_PATH in
                              backend/src/pipeline/assembler.py — the horizontal white logo, not
                              the square app icon). Stacking order (z-index) follows the
                              "Calques" drag order on the left, same as every other layer below. */}
                          {isRecapChecked('watermark') && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: zForLayer('watermark') }}>
                              <img
                                src="/assets/logo/logo-kappgen-horizontale-blanc.png"
                                alt="Filigrane KappGen"
                                style={{ width: `${900 * mockupSubtitlePreviewScale}px`, opacity: 0.22 }}
                                className="object-contain"
                              />
                            </div>
                          )}

                          {/* Top-right logo — matches exactly what's burned into the real render. */}
                          <div className="relative flex justify-end items-start" style={{ zIndex: zForLayer('logo') }}>
                            {isRecapChecked('logo') && resolvedLogoUrl && (
                              <img
                                src={resolvedLogoUrl}
                                alt="Logo"
                                style={(() => {
                                  // Matches the real render exactly: assembler.py scales the logo
                                  // to logo_size_percent% of the 1920px-wide output frame — this
                                  // used to be a disconnected hardcoded 160px, which is why the
                                  // preview looked smaller than what actually gets burned in.
                                  const sizePx = 1920 * ((newChannel.branding.logo_size_percent ?? 14) / 100) * mockupSubtitlePreviewScale;
                                  return { width: `${sizePx}px`, height: `${sizePx}px`, ...shapeClipStyle(newChannel.branding.logo_shape) };
                                })()}
                                className="object-cover shadow-lg"
                              />
                            )}
                          </div>

                          {/* Extra sticker overlays (Abonne-toi, cloche, mascotte...) —
                              same corner/size system as the logo, composited alongside
                              it in the real render (see assembler.py's image_overlays
                              list, which appends the logo then every branding.overlays
                              item). This preview used to only ever draw the logo, so an
                              incrustation added in step 1 was invisible here even though
                              it was really being burned into the video. */}
                          {(newChannel.branding.overlays || []).filter(o => o.enabled ?? true).map(ov => (
                            <img
                              key={ov.id}
                              src={getVideoUrl(ov.image_path)}
                              alt=""
                              className="absolute object-contain drop-shadow-lg"
                              style={{
                                width: `${ov.size_percent || 12}%`,
                                zIndex: zForLayer('logo'),
                                ...overlayPositionStyle(
                                  ov.x_percent ?? presetXY(ov.corner, ov.size_percent ?? 12).x,
                                  ov.y_percent ?? presetXY(ov.corner, ov.size_percent ?? 12).y
                                ),
                                ...shapeClipStyle(ov.shape),
                              }}
                            />
                          ))}

                          {/* Bottom-left music cue — informational only, not burned into the real render. */}
                          {isRecapChecked('music') && musicLabel && (
                            <div className="relative flex items-center gap-1.5 text-[10px] font-bold text-white/90 bg-black/50 backdrop-blur-sm px-2.5 py-1.5 rounded-lg w-fit" style={{ zIndex: zForLayer('music') }}>
                              <span className="material-symbols-outlined text-[14px]">music_note</span>
                              <span className="truncate max-w-[160px]">{musicLabel}</span>
                            </div>
                          )}

                          {/* Animated subtitle at the exact configured vertical position */}
                          {isRecapChecked('subtitles') && (
                          <div className={`absolute inset-x-5 flex justify-center ${subtitlePositionClass(newChannel.subtitle_style.position)}`} style={{ zIndex: zForLayer('subtitles') }}>
                            <div
                              style={{
                                backgroundColor: newChannel.subtitle_style.box_color || 'transparent',
                                padding: '8px 12px',
                                borderRadius: '10px'
                              }}
                              className="flex flex-wrap justify-center items-center gap-1.5 text-center"
                            >
                              {sampleWords.map((wordObj, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontFamily: newChannel.subtitle_style.font,
                                    fontSize: `${(newChannel.subtitle_style.size || 44) * mockupSubtitlePreviewScale}px`,
                                    fontWeight: '900',
                                    color: wordObj.highlight ? (newChannel.subtitle_style.color || '#FFD700') : '#FFFFFF',
                                    textShadow: wordObj.highlight
                                      ? `0 0 12px ${newChannel.subtitle_style.color || '#FFD700'}, 0 2px 4px rgba(0,0,0,0.9)`
                                      : '0 2px 4px rgba(0,0,0,0.9)',
                                    transform: wordObj.highlight ? 'scale(1.08)' : 'scale(1)',
                                    transition: 'all 0.15s ease-in-out'
                                  }}
                                  className="inline-block"
                                >
                                  {applySubtitleCase(wordObj.text, newChannel.subtitle_style.text_case)}
                                </span>
                              ))}
                            </div>
                          </div>
                          )}

                        </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Wizard Footer Navigation — flex-wrap so the button group (up to 3
                    buttons in edit mode: Retour / Enregistrer et quitter / Suivant)
                    drops to its own line instead of overflowing on narrow screens. */}
                <div className="flex flex-wrap justify-between items-center gap-3 pt-6 border-t border-[var(--border-soft)]">
                  {wizardStep > 1 ? (
                    <button
                      onClick={() => setWizardStep(wizardStep - 1)}
                      className="px-6 py-2.5 rounded-xl bg-[var(--bg-surface-alt)] text-white font-bold text-xs hover:bg-[var(--border-soft)] transition-colors"
                    >
                      Retour
                    </button>
                  ) : <div></div>}

                  <div className="flex flex-wrap items-center gap-3">
                    {/* In edit mode the pipeline already exists — no need to click through
                        every step just to save a change made on this one. Create mode keeps
                        the guided step-by-step flow since nothing's configured yet. */}
                    {wizardMode === 'edit' && wizardStep < 9 && (
                      <button
                        onClick={handleSaveChannel}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-md disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[18px]">check</span>
                        {loading ? "Enregistrement..." : "Enregistrer et quitter"}
                      </button>
                    )}

                    {wizardStep < 9 ? (
                    <button
                      onClick={() => {
                        const needsLibrary = resolveEnabledImageSources(newChannel.image_style).includes('library');
                        const stored = Number(newChannel.image_style.library_image_count || 0) > 0
                          && String(newChannel.image_style.library_path || '').startsWith('channels/');
                        const ready = libraryUploadStatus === 'success' && (stagedLibraryToken || wizardMode === 'edit');
                        if (wizardStep === 4 && needsLibrary && !stored && !ready) {
                          showToast(
                            ['analyzing', 'uploading', 'validating'].includes(libraryUploadStatus)
                              ? "L’importation est en cours. Attendez 100 % avant de continuer."
                              : "Importez et validez un dossier d’images avant de continuer.",
                            'error'
                          );
                          return;
                        }
                        setWizardStep(wizardStep + 1);
                      }}
                      disabled={wizardStep === 4 && ['analyzing', 'uploading', 'validating'].includes(libraryUploadStatus)}
                      className="px-6 py-2.5 rounded-xl bg-[#00c2ff] text-slate-950 font-bold text-xs hover:bg-[#38d0ff] transition-all flex items-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {wizardStep === 4 && ['analyzing', 'uploading', 'validating'].includes(libraryUploadStatus)
                        ? `Importation ${libraryUploadProgress}%`
                        : 'Suivant'}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveChannel}
                      disabled={loading}
                      className="px-8 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      <span className="material-symbols-outlined text-[18px]">check</span>
                      {loading ? "Enregistrement..." : (wizardMode === 'edit' ? "Enregistrer les modifications" : "Créer le Pipeline")}
                    </button>
                  )}
                  </div>
                </div>
              </div>
            )}
      {/* SETTINGS — dedicated page (view === 'settings'), not a popup */}
      {view === 'settings' && currentUser && (
        <div className="max-w-[980px] mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#00c2ff] text-slate-950 flex items-center justify-center font-extrabold text-xl shadow-md flex-shrink-0">
              {currentUser.picture_url ? (
                <img src={currentUser.picture_url} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                currentUser.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">{currentUser.name}</h2>
              <p className="text-xs text-slate-400">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Settings side nav */}
            <div className="w-full md:w-[220px] flex-shrink-0 bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-3 space-y-1 md:sticky md:top-8">
              {[
                { id: 'profile', label: 'Profil', icon: 'person' },
                { id: 'appearance', label: 'Apparence', icon: 'palette' },
                { id: 'security', label: 'Sécurité', icon: 'lock' },
                { id: 'izivoice', label: 'Izivoice', icon: 'record_voice_over' },
                { id: 'api', label: 'Clés API', icon: 'key' },
                { id: 'billing', label: 'Abonnement', icon: 'workspace_premium' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    settingsTab === tab.id ? 'bg-[#00c2ff]/10 text-[#00c2ff]' : 'text-slate-400 hover:bg-[var(--bg-surface-alt)] hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
              <div className="pt-2 mt-2 border-t border-[var(--border-soft)]">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 text-rose-400 hover:bg-rose-950/50 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  Déconnexion
                </button>
              </div>
            </div>

            {/* Settings content */}
            <div className="flex-1 min-w-0 bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-6 space-y-5">
              {settingsTab === 'appearance' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Apparence</h3>
                    <p className="text-xs text-slate-400 mt-1">Choisis le thème de l'interface, ou laisse-le suivre le réglage de ton appareil.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: 'Clair', icon: 'light_mode' },
                      { id: 'dark', label: 'Sombre', icon: 'dark_mode' },
                      { id: 'auto', label: 'Automatique', icon: 'brightness_auto' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setThemePreference(opt.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          themePreference === opt.id
                            ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]'
                            : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px]">{opt.icon}</span>
                        <span className="text-xs font-bold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  {themePreference === 'auto' && (
                    <p className="text-[11px] text-slate-500">
                      Suit actuellement le réglage de ton appareil : {resolveEffectiveTheme('auto') === 'light' ? 'clair' : 'sombre'}.
                    </p>
                  )}
                </div>
              )}
              {settingsTab === 'profile' && (
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#00c2ff] text-slate-950 flex items-center justify-center font-extrabold text-2xl shadow-md flex-shrink-0">
                        {currentUser.picture_url ? (
                          <img src={currentUser.picture_url} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          currentUser.name.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {currentUser.auth_provider === 'google'
                          ? "Photo synchronisée depuis votre compte Google."
                          : "Connectez-vous avec Google pour une photo de profil automatique."}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Nom complet</label>
                      <input
                        value={profileForm.name}
                        onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Adresse Email</label>
                      <input
                        value={currentUser.email}
                        disabled
                        className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-3 text-xs text-slate-500 outline-none cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Numéro de téléphone</label>
                      <input
                        value={profileForm.phone}
                        onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="+33 6 12 34 56 78"
                        className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Langue de l'application</label>
                      <select
                        value={profileForm.locale}
                        onChange={e => setProfileForm({ ...profileForm, locale: e.target.value })}
                        className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none"
                      >
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">Détermine la langue des emails que KappGen vous envoie (bienvenue, récupération, factures).</p>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="py-2.5 px-5 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl hover:bg-[#38d0ff] transition-all"
                    >
                      Enregistrer les modifications
                    </button>
                  </form>
                )}

                {settingsTab === 'security' && (
                  <div className="space-y-5">
                    {currentUser.auth_provider === 'google' ? (
                      <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-start gap-3">
                        <span className="material-symbols-outlined text-[#00c2ff] text-[20px]">verified_user</span>
                        <div>
                          <p className="text-xs font-bold text-white">Connecté via Google</p>
                          <p className="text-[11px] text-slate-400 mt-1">Votre mot de passe est géré par Google. La double authentification et la sécurité du compte se configurent directement dans les paramètres de votre compte Google.</p>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleChangePasswordSettings} className="space-y-4">
                        <h4 className="text-xs font-bold text-white">Changer le mot de passe</h4>
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1">Mot de passe actuel</label>
                          <input
                            type="password"
                            required
                            value={passwordForm.oldPassword}
                            onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                            className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1">Nouveau mot de passe</label>
                          <div className="relative">
                            <input
                              type={showSettingsPassword ? "text" : "password"}
                              required
                              minLength={4}
                              value={passwordForm.newPassword}
                              onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-3 pr-10 text-xs text-white focus:border-[#00c2ff] outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSettingsPassword(!showSettingsPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                              tabIndex={-1}
                            >
                              <span className="material-symbols-outlined text-[18px]">{showSettingsPassword ? "visibility_off" : "visibility"}</span>
                            </button>
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="py-2.5 px-5 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl hover:bg-[#38d0ff] transition-all"
                        >
                          Mettre à jour le mot de passe
                        </button>
                      </form>
                    )}

                    <div className="pt-5 border-t border-[var(--border-soft)]">
                      <h4 className="text-xs font-bold text-white mb-1">Authentification à deux facteurs</h4>
                      <p className="text-[11px] text-slate-400 mb-3">
                        {currentUser.auth_provider === 'google'
                          ? "Activez la validation en 2 étapes depuis votre compte Google — elle protège aussi votre connexion à KappGen."
                          : "Bientôt disponible pour les comptes email/mot de passe."}
                      </p>
                      {currentUser.auth_provider === 'google' && (
                        <a
                          href="https://myaccount.google.com/security"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00c2ff] hover:underline"
                        >
                          Gérer la sécurité Google <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {settingsTab === 'api' && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-xs font-bold text-white mb-1">Clés API</h4>
                      <p className="text-[11px] text-slate-400">Utilisez une clé API pour intégrer KappGen à vos propres outils (génération programmatique de vidéos).</p>
                    </div>

                    {justCreatedApiKey && (
                      <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-3 space-y-2">
                        <p className="text-[11px] text-emerald-300 font-bold">Copiez cette clé maintenant — elle ne sera plus jamais affichée.</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-[11px] font-mono text-white bg-black/40 rounded-lg p-2 overflow-x-auto whitespace-nowrap">{justCreatedApiKey.key}</code>
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(justCreatedApiKey.key); showToast("Clé copiée.", "success"); }}
                            className="p-2 bg-[var(--bg-surface-alt)] hover:bg-[var(--border-soft)] rounded-lg text-white flex-shrink-0"
                          >
                            <span className="material-symbols-outlined text-[16px]">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        value={newApiKeyName}
                        onChange={e => setNewApiKeyName(e.target.value)}
                        placeholder="Nom de la clé (ex: Zapier, Script perso...)"
                        className="flex-1 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-white focus:border-[#00c2ff] outline-none"
                      />
                      <button
                        onClick={handleCreateApiKey}
                        className="py-2.5 px-4 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl hover:bg-[#38d0ff] transition-all flex items-center gap-1.5 flex-shrink-0"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span> Créer
                      </button>
                    </div>

                    <div className="space-y-2">
                      {apiKeys.length === 0 ? (
                        <p className="text-[11px] text-slate-500 text-center py-6">Aucune clé API créée pour le moment.</p>
                      ) : (
                        apiKeys.map(key => (
                          <div key={key.id} className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3">
                            <div>
                              <p className="text-xs font-bold text-white">{key.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{key.key_prefix}••••••••••••••••••••</p>
                            </div>
                            <button
                              onClick={() => handleRevokeApiKey(key.id)}
                              className="text-rose-400 hover:text-rose-300 p-1.5"
                              title="Révoquer"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {settingsTab === 'izivoice' && (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[#59d8ff]">record_voice_over</span>
                        <h4 className="text-sm font-extrabold text-white">Synchronisation Izivoice</h4>
                      </div>
                      <p className="text-[11px] leading-5 text-slate-400">
                        Sans connexion, KappGen utilise automatiquement son propre moteur Izivoice. En connectant ta clé, tu retrouves dans KappGen tes voix, tes clones et les ressources liées à ton compte Izivoice.
                      </p>
                    </div>

                    {izivoiceConnection.connected ? (
                      <div className="bg-emerald-950/25 border border-emerald-700/40 rounded-2xl p-4 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3">
                            <span className="material-symbols-outlined text-emerald-400">cloud_done</span>
                            <div>
                              <p className="text-xs font-bold text-white">Compte Izivoice connecté</p>
                              <p className="text-[10px] text-emerald-300 mt-1 font-mono">{izivoiceConnection.key_prefix}</p>
                              <p className="text-[10px] text-slate-400 mt-2">Les prochaines générations utilisent ton compte et tes propres voix.</p>
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-[9px] font-bold uppercase tracking-wider">Synchronisé</span>
                        </div>
                        <button type="button" onClick={handleDisconnectIzivoice} className="text-[11px] font-bold text-rose-400 hover:text-rose-300">Déconnecter mon compte Izivoice</button>
                      </div>
                    ) : (
                      <form onSubmit={handleConnectIzivoice} className="bg-[var(--bg-input)] border border-[var(--border-soft)] rounded-2xl p-4 space-y-4">
                        <div className="flex gap-3">
                          <span className="material-symbols-outlined text-[#00c2ff]">hub</span>
                          <div>
                            <p className="text-xs font-bold text-white">Moteur KappGen actif</p>
                            <p className="text-[10px] text-slate-400 mt-1">Tu peux créer tes vidéos normalement. La connexion Izivoice ajoute la synchronisation de ton espace personnel.</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-2">Clé API Izivoice</label>
                          <input type="password" autoComplete="off" value={izivoiceApiKey} onChange={e => setIzivoiceApiKey(e.target.value)} placeholder="Colle ta clé API Izivoice" className="w-full bg-[var(--bg-deep)] border border-[var(--border)] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none" />
                          <p className="text-[9px] leading-4 text-slate-500 mt-2">La clé est vérifiée auprès d’Izivoice, chiffrée côté serveur et n’est jamais réaffichée.</p>
                        </div>
                        <button type="submit" disabled={izivoiceConnecting || !izivoiceApiKey.trim()} className="w-full py-3 bg-gradient-to-r from-[#65e0ff] to-[#1a9cff] text-[var(--bg-deep)] font-extrabold text-xs rounded-xl disabled:opacity-50">
                          {izivoiceConnecting ? 'Vérification…' : 'Connecter et synchroniser'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {settingsTab === 'billing' && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-xs font-bold text-white mb-1">Abonnement</h4>
                      <p className="text-[11px] text-slate-400">Génère plus de vidéos et retire le filigrane KappGen avec un abonnement actif.</p>
                    </div>

                    {billingVerifyStatus === 'pending' && (
                      <div className="bg-[#00c2ff]/10 border border-[#00c2ff]/30 rounded-2xl p-4 flex items-center gap-2 text-xs text-[#38d0ff]">
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        Vérification du paiement en cours...
                      </div>
                    )}
                    {billingVerifyStatus === 'failed' && (
                      <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 text-xs text-amber-300">
                        Paiement pas encore confirmé — si tu viens de payer, ça peut prendre quelques minutes. Recharge cette page dans un instant.
                      </div>
                    )}

                    {billingSubscription?.active ? (
                      <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-4 flex items-center gap-3">
                        <span className="material-symbols-outlined text-emerald-400">workspace_premium</span>
                        <div>
                          <div className="text-xs font-bold text-emerald-300">Abonnement actif — {billingSubscription.subscription.plan_name || 'Offre personnalisée'}</div>
                          <div className="text-[11px] text-emerald-500/80">Valable jusqu'au {new Date(billingSubscription.subscription.expires_at).toLocaleDateString('fr-FR')}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-2xl p-4 text-[11px] text-slate-400">
                        Aucun abonnement actif — {currentUser.free_video_quota_granted - currentUser.free_videos_used > 0
                          ? `il te reste ${currentUser.free_video_quota_granted - currentUser.free_videos_used} vidéo(s) gratuite(s).`
                          : "ton quota gratuit est épuisé."}
                      </div>
                    )}

                    {billingLoading ? (
                      <p className="text-xs text-slate-500">Chargement des offres...</p>
                    ) : billingPlans.length === 0 ? (
                      <p className="text-xs text-slate-500">Aucune offre disponible pour le moment.</p>
                    ) : (() => {
                      const sortedPlans = [...billingPlans].sort((a, b) => a.price_fcfa - b.price_fcfa);
                      const currentPlanName = billingSubscription?.active ? billingSubscription.subscription.plan_name : null;
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
                          {sortedPlans.map(p => {
                            const details = PLAN_DETAILS[p.name] || { tagline: '', features: [] };
                            const isCurrent = currentPlanName === p.name;
                            return (
                              <div
                                key={p.id}
                                className={`relative flex flex-col rounded-2xl p-5 space-y-4 border ${
                                  details.featured
                                    ? 'bg-gradient-to-b from-[#00c2ff]/10 to-[var(--bg-surface)] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10'
                                    : 'bg-[var(--bg-surface)] border-[var(--border-soft)]'
                                }`}
                              >
                                {(details.featured || details.badgeText) && (
                                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap ${details.featured ? 'bg-gradient-to-r from-[#00c2ff] to-[#0088ff] text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
                                    <span className="material-symbols-outlined text-[13px]">bolt</span> {details.badgeText || 'Recommandée'}
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-extrabold text-white">{p.name}</div>
                                  <p className="text-[11px] text-slate-400 mt-1 min-h-[28px]">{details.tagline}</p>
                                </div>
                                <div>
                                  {p.original_price_fcfa && (
                                    <div className="text-[11px] text-slate-500 line-through">{p.original_price_fcfa.toLocaleString()} FCFA</div>
                                  )}
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-extrabold text-white">{p.price_fcfa.toLocaleString()}</span>
                                    <span className="text-xs font-bold text-slate-400">FCFA</span>
                                  </div>
                                  {p.credits ? (
                                    <div className="text-[11px] text-[#00c2ff] font-bold mt-0.5">{p.credits.toLocaleString()} crédits</div>
                                  ) : null}
                                  <div className="text-[11px] text-slate-500">{p.credits ? 'crédits à vie' : `/ ${p.duration_days} jours`}</div>
                                </div>
                                <ul className="space-y-1.5 flex-1">
                                  {details.features.map(f => (
                                    <li key={f.text} className={`flex items-start gap-1.5 text-[11px] ${f.included ? 'text-slate-300' : 'text-slate-500'}`}>
                                      <span className={`material-symbols-outlined text-[14px] shrink-0 mt-0.5 ${f.included ? 'text-emerald-400' : 'text-red-400'}`}>{f.included ? 'check' : 'close'}</span>
                                      {f.text}
                                    </li>
                                  ))}
                                </ul>
                                {isCurrent ? (
                                  <div className="py-2 text-center bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 rounded-xl font-bold text-[11px]">
                                    Offre actuelle
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setPaymentPlan(p)}
                                    disabled={checkoutPlanId === p.id}
                                    className={`py-2.5 rounded-xl font-bold text-[11px] disabled:opacity-50 ${details.featured ? 'bg-gradient-to-r from-[#00c2ff] to-[#0088ff] text-slate-950' : 'bg-[#00c2ff] text-slate-950'}`}
                                  >
                                    Recharger
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
      )}

      {/* ADMIN DASHBOARD — dedicated page (view === 'admin'), server-side gated on is_admin */}
      {view === 'admin' && currentUser?.is_admin && (
        <div className="max-w-[1200px] mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00c2ff]">
                {{ overview: 'dashboard', users: 'group', plans: 'sell', videos: 'movie', library: 'diversity_3', transactions: 'payments' }[adminTab]}
              </span>
              {{ overview: "Vue d'ensemble", users: 'Utilisateurs', videos: 'Vidéos', library: 'Bibliothèque collaborative', transactions: 'Transactions', costs: 'Coûts', resources: 'Ressources' }[adminTab]}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {{
                overview: 'Tableau de bord administrateur KappGen.',
                users: 'Gère les comptes, quotas et abonnements des créateurs.',
                plans: "Configure les offres d'abonnement proposées à la vente.",
                videos: 'Toutes les vidéos générées sur la plateforme.',
                library: "Dossiers d'images partagés par les créateurs — valide ou signale pour construire la bibliothèque de chaque niche.",
                transactions: 'Historique des paiements Maketou et Tara Money.',
              }[adminTab]}
            </p>
          </div>

          {adminTab === 'overview' && (
            <div className="space-y-6">
              {adminStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Utilisateurs', value: adminStats.total_users, icon: 'group' },
                    { label: 'Abonnements actifs', value: adminStats.active_subscriptions, icon: 'workspace_premium' },
                    { label: 'Revenu total', value: `${adminStats.total_revenue_fcfa.toLocaleString()} FCFA`, icon: 'payments' },
                    { label: 'Vidéos aujourd\'hui', value: `${adminStats.videos_today} / ${adminStats.total_videos}`, icon: 'movie' },
                  ].map(s => (
                    <div key={s.label} className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-4">
                      <span className="material-symbols-outlined text-[#00c2ff] text-[20px]">{s.icon}</span>
                      <div className="text-xl font-extrabold text-white mt-2">{s.value}</div>
                      <div className="text-[11px] text-slate-400">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-5">
                  <div className="text-sm font-bold text-white mb-1">Activité des 28 derniers jours</div>
                  <div className="text-[11px] text-slate-500 mb-4">Nouveaux utilisateurs et vidéos générées, par jour.</div>
                  {adminActivity ? (
                    <AdminActivityChart series={adminActivity.series} />
                  ) : (
                    <p className="text-xs text-slate-500 py-10 text-center">Chargement...</p>
                  )}
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-5 space-y-5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Temps réel
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-white">{adminActivity?.users_total ?? '—'}</div>
                    <div className="text-[11px] text-slate-400">Utilisateurs inscrits</div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-white">{adminActivity?.videos_last_48h ?? '—'}</div>
                    <div className="text-[11px] text-slate-400">Vidéos générées · dernières 48h</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {adminTab === 'users' && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[var(--border-soft)]">
                <input
                  value={adminSearch}
                  onChange={e => setAdminSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchAdminData()}
                  placeholder="Rechercher par email..."
                  className="w-full max-w-xs bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-[var(--border-soft)]">
                      <th className="px-4 py-2.5 font-bold">Email</th>
                      <th className="px-4 py-2.5 font-bold">Inscrit le</th>
                      <th className="px-4 py-2.5 font-bold">Chaînes</th>
                      <th className="px-4 py-2.5 font-bold">Vidéos</th>
                      <th className="px-4 py-2.5 font-bold">Crédits</th>
                      <th className="px-4 py-2.5 font-bold">Abonnement</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsersLoading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Chargement...</td></tr>
                    ) : adminUsers.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Aucun utilisateur.</td></tr>
                    ) : adminUsers.map(u => (
                      <tr key={u.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-alt)]/60">
                        <td className="px-4 py-2.5 text-white font-medium">{u.email}{u.is_admin && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-[#00c2ff]/15 text-[#00c2ff] font-bold">ADMIN</span>}</td>
                        <td className="px-4 py-2.5 text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="px-4 py-2.5 text-slate-300">{u.channel_count}</td>
                        <td className="px-4 py-2.5 text-slate-300">{u.video_count}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => { openAdminUser(u.id); setAdminCreditForm({ amount: '', note: '' }); }}
                            title="Gérer les crédits de cet utilisateur"
                            className="text-[#00c2ff] font-bold hover:underline"
                          >
                            {(u.credit_balance ?? 0).toLocaleString()}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          {u.has_active_subscription ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 text-[10px] font-bold">Actif</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-alt)] text-slate-500 text-[10px] font-bold">Aucun</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => { openAdminUser(u.id); setAdminGrantForm({ plan_id: '', duration_days: 30, note: '' }); }} className="text-[#00c2ff] font-bold hover:underline">Gérer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'videos' && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[var(--border-soft)]">
                <input
                  value={adminVideoSearch}
                  onChange={e => setAdminVideoSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchAdminVideos()}
                  placeholder="Rechercher par titre, chaîne ou email..."
                  className="w-full max-w-xs bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-[var(--border-soft)]">
                      <th className="px-4 py-2.5 font-bold">Titre</th>
                      <th className="px-4 py-2.5 font-bold">Chaîne</th>
                      <th className="px-4 py-2.5 font-bold">Propriétaire</th>
                      <th className="px-4 py-2.5 font-bold">Statut</th>
                      <th className="px-4 py-2.5 font-bold">Coût (crédits)</th>
                      <th className="px-4 py-2.5 font-bold">Créée le</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminVideosLoading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Chargement...</td></tr>
                    ) : adminVideos.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Aucune vidéo.</td></tr>
                    ) : adminVideos.map(v => (
                      <tr key={v.id} onClick={() => openAdminVideoDetail(v.id)} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-alt)]/60 cursor-pointer">
                        <td className="px-4 py-2.5 max-w-[280px] truncate">
                          <button className="text-white font-medium hover:text-[#00c2ff] hover:underline text-left">
                            {v.display_title || v.title || '(sans titre)'}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{v.channel_name || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-400">{v.owner_email || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.status === 'done' ? 'bg-emerald-950/60 text-emerald-400' :
                            v.status === 'failed' ? 'bg-rose-950/60 text-rose-400' :
                            'bg-[var(--bg-surface-alt)] text-slate-400'
                          }`}>{v.status}</span>
                        </td>
                        <td className="px-4 py-2.5 text-[#00c2ff] font-bold">{(v.total_credits ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-slate-400">{v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={event => { event.stopPropagation(); deleteAdminVideo(v.id); }} className="text-rose-400 font-bold hover:underline">Supprimer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'library' && (() => {
            const filterText = adminLibraryNicheFilter.trim().toLowerCase();
            const allNiches = adminLibraryOverview.niches;
            const niche = adminLibraryDrillNiche ? allNiches.find(n => n.niche === adminLibraryDrillNiche) : null;
            const user = niche && adminLibraryDrillUserKey ? niche.users.find(u => `${niche.niche}::${u.user_id || 'unknown'}` === adminLibraryDrillUserKey) : null;
            const folder = adminLibraryDrillFolder;

            const ViewToggle = () => (
              <div className="flex items-center gap-1 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-1 shrink-0">
                {[{ key: 'grid', icon: 'grid_view' }, { key: 'list', icon: 'view_list' }].map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setAdminLibraryViewMode(m.key)}
                    title={m.key === 'grid' ? 'Vue en grille' : 'Vue en liste'}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${adminLibraryViewMode === m.key ? 'bg-[#00c2ff] text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{m.icon}</span>
                  </button>
                ))}
              </div>
            );

            const Breadcrumb = () => (
              <div className="flex items-center gap-1.5 text-xs font-bold flex-wrap">
                <button
                  onClick={() => { setAdminLibraryDrillNiche(null); setAdminLibraryDrillUserKey(null); setAdminLibraryDrillFolder(null); }}
                  className={!niche ? 'text-white' : 'text-slate-400 hover:text-white'}
                >
                  Bibliothèque
                </button>
                {niche && (
                  <>
                    <span className="material-symbols-outlined text-[14px] text-slate-600">chevron_right</span>
                    <button
                      onClick={() => { setAdminLibraryDrillUserKey(null); setAdminLibraryDrillFolder(null); }}
                      className={!user ? 'text-white' : 'text-slate-400 hover:text-white'}
                    >
                      {niche.niche}
                    </button>
                  </>
                )}
                {user && (
                  <>
                    <span className="material-symbols-outlined text-[14px] text-slate-600">chevron_right</span>
                    <button onClick={() => setAdminLibraryDrillFolder(null)} className={!folder ? 'text-white' : 'text-slate-400 hover:text-white'}>{user.user_email || '—'}</button>
                  </>
                )}
                {folder && <><span className="material-symbols-outlined text-[14px] text-slate-600">chevron_right</span><span className="text-white">{folder.channel_name}</span></>}
              </div>
            );

            const StatusBadge = ({ status }) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                status === 'approved' ? 'bg-emerald-950/60 text-emerald-400'
                : status === 'flagged' ? 'bg-rose-950/60 text-rose-400'
                : status === 'pending' ? 'bg-amber-950/60 text-amber-400'
                : 'bg-[var(--bg-surface-alt)] text-slate-500'
              }`}>
                {status === 'approved' ? 'Validé' : status === 'flagged' ? 'Signalé' : status === 'pending' ? 'En attente' : 'Non partagé'}
              </span>
            );

            let content;
            if (!niche) {
              // LEVEL 1 — every known niche, always shown even empty.
              const list = allNiches.filter(n => !filterText || n.niche.toLowerCase().includes(filterText));
              content = list.length === 0 ? (
                <p className="px-4 py-10 text-center text-slate-500 text-xs">Aucune niche ne correspond à ce filtre.</p>
              ) : adminLibraryViewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
                  {list.map(n => (
                    <button
                      key={n.niche}
                      onClick={() => setAdminLibraryDrillNiche(n.niche)}
                      className="flex flex-col items-start gap-2 p-4 bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[#00c2ff]/50 rounded-2xl transition-all text-left"
                    >
                      <span className="material-symbols-outlined text-[26px] text-[#00c2ff]">folder</span>
                      <span className="text-xs font-bold text-white line-clamp-2">{n.niche}</span>
                      <span className="text-[10px] text-slate-500">{n.users.length} utilisateur{n.users.length > 1 ? 's' : ''} · {n.total_images} image{n.total_images > 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-soft)]/50">
                  {list.map(n => (
                    <button
                      key={n.niche}
                      onClick={() => setAdminLibraryDrillNiche(n.niche)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#00c2ff]">folder</span>
                      <span className="text-sm font-bold text-white flex-1">{n.niche}</span>
                      <span className="text-[11px] text-slate-500">{n.users.length} utilisateur{n.users.length > 1 ? 's' : ''} · {n.total_images} image{n.total_images > 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
              );
            } else if (!user) {
              // LEVEL 2 — users who have images in this niche.
              const list = niche.users;
              content = list.length === 0 ? (
                <p className="px-4 py-10 text-center text-slate-500 text-xs">Aucune image dans cette niche pour l'instant.</p>
              ) : adminLibraryViewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
                  {list.map(u => (
                    <button
                      key={u.user_id || 'unknown'}
                      onClick={() => setAdminLibraryDrillUserKey(`${niche.niche}::${u.user_id || 'unknown'}`)}
                      className="flex flex-col items-start gap-2 p-4 bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[#00c2ff]/50 rounded-2xl transition-all text-left"
                    >
                      <span className="material-symbols-outlined text-[26px] text-slate-400">person</span>
                      <span className="text-xs font-bold text-white truncate w-full">{u.user_email || '—'}</span>
                      <span className="text-[10px] text-slate-500">{u.folders.length} chaîne{u.folders.length > 1 ? 's' : ''} · {u.total_images} image{u.total_images > 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-soft)]/50">
                  {list.map(u => (
                    <button
                      key={u.user_id || 'unknown'}
                      onClick={() => setAdminLibraryDrillUserKey(`${niche.niche}::${u.user_id || 'unknown'}`)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-slate-400">person</span>
                      <span className="text-sm font-bold text-white flex-1">{u.user_email || '—'}</span>
                      <span className="text-[11px] text-slate-500">{u.folders.length} chaîne{u.folders.length > 1 ? 's' : ''} · {u.total_images} image{u.total_images > 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
              );
            } else if (!folder) {
              // LEVEL 3 — folders. Images stay at the next hierarchy level.
              const list = user.folders;
              // Browsing/deleting images works for ANY channel (shared or
              // not) — only the approve/flag/share-toggle actions differ
              // based on whether a CommunityLibraryFolder already exists.
              const FolderActions = ({ uf, sharedFolder }) => (
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap" onClick={e => e.stopPropagation()}>
                  {sharedFolder ? (
                    <>
                      {uf.share_status !== 'approved' && (
                        <button onClick={() => setAdminLibraryFolderStatus(sharedFolder, 'approved')} className="text-emerald-400 font-bold text-[11px] hover:underline">Valider</button>
                      )}
                      {uf.share_status !== 'flagged' && (
                        <button onClick={() => setAdminLibraryFolderStatus(sharedFolder, 'flagged')} className="text-rose-400 font-bold text-[11px] hover:underline">Signaler</button>
                      )}
                      <button onClick={() => unshareChannelLibrary(uf.channel_id)} className="text-slate-400 font-bold text-[11px] hover:underline">Retirer du partage</button>
                    </>
                  ) : (
                    <button onClick={() => forceShareChannelLibrary(uf.channel_id, 'approved')} className="text-[#00c2ff] font-bold text-[11px] hover:underline">
                      Partager quand même
                    </button>
                  )}
                  <button onClick={() => mergeAdminLibraryFolder(uf, niche.niche)} className="text-slate-400 font-bold text-[11px] hover:underline">
                    Fusionner avec…
                  </button>
                </div>
              );
              content = (
                <div className="p-4 space-y-3">
                  <p className="text-[10px] text-slate-500 -mt-1">
                    Le statut "Non partagé" reflète le choix du créateur — tu peux quand même parcourir ses images et forcer le partage si tu juges que ça convient à la niche.
                  </p>
                  <div className={adminLibraryViewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3' : 'divide-y divide-[var(--border-soft)]/50 -mx-4'}>
                    {list.map(uf => {
                      const sharedFolder = uf.community_folder_id ? { id: uf.community_folder_id } : null;
                      return adminLibraryViewMode === 'grid' ? (
                        <div key={uf.channel_id} className="flex flex-col gap-2 p-4 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-2xl">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => openAdminLibraryFolder(uf, niche.niche)}
                              className="flex items-center gap-2 min-w-0 text-left"
                            >
                              <span className="material-symbols-outlined text-[18px] text-slate-500 shrink-0">videocam</span>
                              <span className="text-xs font-bold text-white truncate">{uf.channel_name || '—'}</span>
                            </button>
                            <StatusBadge status={uf.share_status} />
                          </div>
                          <span className="text-[10px] text-slate-500">{uf.image_count} image{uf.image_count > 1 ? 's' : ''}</span>
                          <FolderActions uf={uf} sharedFolder={sharedFolder} />
                        </div>
                      ) : (
                        <div key={uf.channel_id} className="px-4 py-3 flex items-center gap-2.5">
                          <button
                            onClick={() => openAdminLibraryFolder(uf, niche.niche)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          >
                            <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">videocam</span>
                            <span className="text-xs font-bold text-white truncate">{uf.channel_name || '—'}</span>
                            <span className="text-[10px] text-slate-500 shrink-0">{uf.image_count} image{uf.image_count > 1 ? 's' : ''}</span>
                          </button>
                          <StatusBadge status={uf.share_status} />
                          <FolderActions uf={uf} sharedFolder={sharedFolder} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            } else {
              // LEVEL 4 — selectable, infinitely scrolling image grid.
              const selected = new Set(adminLibrarySelectedImages);
              const toggleImage = name => setAdminLibrarySelectedImages(items => items.includes(name) ? items.filter(item => item !== name) : [...items, name]);
              content = <div className="p-4 space-y-4">
                <div className="sticky top-0 z-20 flex items-center gap-3 flex-wrap bg-[var(--bg-surface)]/95 backdrop-blur border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg">
                  <span className="text-xs font-bold text-white">{adminLibraryImageTotal.toLocaleString('fr-FR')} images</span>
                  <span className="text-[11px] text-[#00c2ff]">{adminLibrarySelectedImages.length} sélectionnée{adminLibrarySelectedImages.length > 1 ? 's' : ''}</span>
                  <button type="button" onClick={() => setAdminLibrarySelectedImages(adminLibrarySelectedImages.length === adminLibraryImages.length ? [] : [...adminLibraryImages])} className="text-[11px] font-bold text-slate-300 hover:text-white">{adminLibrarySelectedImages.length === adminLibraryImages.length && adminLibraryImages.length ? 'Tout désélectionner' : 'Sélectionner les images chargées'}</button>
                  {adminLibrarySelectedImages.length > 0 && <button type="button" onClick={() => openAdminLibraryMove(folder, niche.niche)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#00c2ff] text-slate-950 text-[11px] font-extrabold"><span className="material-symbols-outlined text-[15px]">drive_file_move</span>Déplacer vers…</button>}
                  <button type="button" disabled={adminLibrarySelectedImages.length !== 1} onClick={() => { const index = adminLibraryImages.indexOf(adminLibrarySelectedImages[0]); setAdminLibraryLightboxIndex(index); setAdminLibraryLightboxZoom(1); }} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)] text-white text-[11px] font-bold disabled:opacity-35"><span className="material-symbols-outlined text-[15px]">open_in_full</span>Agrandir</button>
                  <label className="ml-auto flex items-center gap-2 text-[10px] text-slate-400">Taille<input type="range" min="3" max="10" value={adminLibraryGridColumns} onChange={e => setAdminLibraryGridColumns(Number(e.target.value))} className="w-28 accent-[#00c2ff]" /></label>
                </div>
                {adminLibraryImages.length === 0 && adminLibraryImageTotal === 0 ? <p className="py-16 text-center text-xs text-slate-500">Ce dossier ne contient aucune image.</p> : <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${adminLibraryGridColumns}, minmax(0, 1fr))` }}>
                  {adminLibraryImages.map((name, imageIndex) => <div key={name} className={`relative group min-w-0 rounded-lg overflow-hidden border-2 transition-colors ${selected.has(name) ? 'border-[#00c2ff] ring-2 ring-[#00c2ff]/30' : 'border-[var(--border)] hover:border-slate-400'}`}>
                    <button type="button" onClick={() => toggleImage(name)} onDoubleClick={() => { setAdminLibraryLightboxIndex(imageIndex); setAdminLibraryLightboxZoom(1); }} className="block w-full text-left">
                      <img src={`${API_BASE}/admin/channel-library/${folder.channel_id}/images/${encodeURIComponent(name)}`} alt={name} className="w-full aspect-video object-cover" loading="lazy" />
                      <span className={`absolute top-1.5 left-1.5 w-[18px] h-[18px] rounded flex items-center justify-center border ${selected.has(name) ? 'bg-[#00c2ff] border-[#00c2ff] text-slate-950' : 'bg-slate-950/70 border-white/50 text-transparent'}`}><span className="material-symbols-outlined text-[12px]">check</span></span>
                      <span className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/90 to-transparent text-[9px] text-white truncate text-left">{name}</span>
                    </button>
                    <button type="button" title="Supprimer cette image" onClick={() => deleteAdminLibraryImage(folder.channel_id, name)} className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-slate-950/80 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"><span className="material-symbols-outlined text-[12px]">delete</span></button>
                  </div>)}
                </div>}
                {adminLibraryImagesHasMore && <div ref={adminLibraryLoadMoreRef} className="flex justify-center py-6 text-xs text-slate-400"><span className={`material-symbols-outlined text-[18px] mr-2 ${adminLibraryImagesLoadingMore ? 'animate-spin' : ''}`}>progress_activity</span>{adminLibraryImagesLoadingMore ? 'Chargement…' : `Continuez à défiler · ${adminLibraryImages.length} / ${adminLibraryImageTotal}`}</div>}
              </div>;
            }

            return (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between gap-3 flex-wrap">
                <Breadcrumb />
                <div className="flex items-center gap-3 flex-wrap">
                  {!niche && (
                    <input
                      value={adminLibraryNicheFilter}
                      onChange={e => setAdminLibraryNicheFilter(e.target.value)}
                      placeholder="Filtrer par niche..."
                      className="bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                    />
                  )}
                  <span className="text-[11px] font-bold text-[#00c2ff] shrink-0">
                    {adminLibraryOverview.total_images.toLocaleString('fr-FR')} image{adminLibraryOverview.total_images > 1 ? 's' : ''} au total
                  </span>
                  {!folder && <ViewToggle />}
                </div>
              </div>
              {adminLibraryLoading ? (
                <p className="px-4 py-10 text-center text-slate-500 text-xs">Chargement…</p>
              ) : content}
            </div>
            );
          })()}

          {adminLibraryMoveFolder && (
            <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !adminLibraryMoveBusy && setAdminLibraryMoveFolder(null)}>
              <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#00c2ff] text-[24px]">drive_file_move</span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-white">
                      {adminLibraryMoveFolder.wholeFolder ? 'Fusionner ce dossier avec une niche' : 'Déplacer les images sélectionnées'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {adminLibraryMoveFolder.wholeFolder
                        ? <>Toutes les images du dossier « {adminLibraryMoveFolder.channel_name} » rejoindront le pool de la niche choisie — aucun fichier n'est déplacé ni copié, seul leur classement change.</>
                        : <>{adminLibrarySelectedImages.length} image{adminLibrarySelectedImages.length > 1 ? 's' : ''} du dossier « {adminLibraryMoveFolder.channel_name} » garderont leur nom. Seul leur classement dans la bibliothèque collaborative changera.</>}
                    </p>
                  </div>
                </div>
                <label className="block text-[11px] font-bold text-slate-300 mt-5 mb-2">Niche de destination</label>
                <select
                  value={adminLibraryMoveNiche}
                  onChange={e => setAdminLibraryMoveNiche(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-3 text-xs text-white focus:border-[#00c2ff] outline-none"
                >
                  {NICHE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <div className="flex justify-end gap-2 mt-5">
                  <button type="button" onClick={() => setAdminLibraryMoveFolder(null)} disabled={adminLibraryMoveBusy} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-[var(--bg-hover)] disabled:opacity-50">Annuler</button>
                  <button
                    type="button"
                    onClick={moveAdminLibraryFolder}
                    disabled={adminLibraryMoveBusy || !adminLibraryMoveNiche || adminLibraryMoveNiche === adminLibraryMoveFolder.current_niche}
                    className="px-4 py-2.5 rounded-xl bg-[#00c2ff] text-slate-950 text-xs font-extrabold disabled:opacity-40"
                  >
                    {adminLibraryMoveBusy ? 'Traitement…' : adminLibraryMoveFolder.wholeFolder ? 'Fusionner le dossier' : 'Déplacer les images'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {adminLibraryLightboxIndex != null && adminLibraryImages[adminLibraryLightboxIndex] && (
            <div className="fixed inset-0 z-[130] bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label="Visionneuse de la bibliothèque">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{adminLibraryImages[adminLibraryLightboxIndex]}</p>
                  <p className="text-[10px] text-slate-500">{adminLibraryLightboxIndex + 1} / {adminLibraryImageTotal} · ← → naviguer · + − zoomer · Échap fermer</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={() => setAdminLibraryLightboxZoom(zoom => Math.max(0.5, zoom - 0.25))} className="w-9 h-9 rounded-lg bg-white/10 text-white font-bold">−</button>
                  <span className="w-12 text-center text-[11px] text-slate-300">{Math.round(adminLibraryLightboxZoom * 100)}%</span>
                  <button type="button" onClick={() => setAdminLibraryLightboxZoom(zoom => Math.min(3, zoom + 0.25))} className="w-9 h-9 rounded-lg bg-white/10 text-white font-bold">＋</button>
                  <a
                    href={`${API_BASE}/admin/channel-library/${adminLibraryExpandedId}/images/${encodeURIComponent(adminLibraryImages[adminLibraryLightboxIndex])}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-3 rounded-lg bg-white/10 text-white text-[11px] font-bold flex items-center gap-1.5"
                  ><span className="material-symbols-outlined text-[15px]">open_in_new</span>Original</a>
                  <button type="button" onClick={() => setAdminLibraryLightboxIndex(null)} className="w-9 h-9 rounded-lg bg-white/10 text-white"><span className="material-symbols-outlined text-[18px]">close</span></button>
                </div>
              </div>
              <div className="flex-1 min-h-0 flex items-center gap-3 px-3 overflow-hidden">
                <button type="button" aria-label="Image précédente" disabled={adminLibraryLightboxIndex === 0} onClick={() => setAdminLibraryLightboxIndex(index => Math.max(0, index - 1))} className="w-11 h-11 rounded-full bg-white/10 text-white disabled:opacity-20 shrink-0"><span className="material-symbols-outlined">chevron_left</span></button>
                <div className="flex-1 h-full overflow-auto flex items-center justify-center p-5">
                  <img
                    src={`${API_BASE}/admin/channel-library/${adminLibraryExpandedId}/images/${encodeURIComponent(adminLibraryImages[adminLibraryLightboxIndex])}`}
                    alt={adminLibraryImages[adminLibraryLightboxIndex]}
                    className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-150 origin-center"
                    style={{ transform: `scale(${adminLibraryLightboxZoom})` }}
                  />
                </div>
                <button type="button" aria-label="Image suivante" disabled={adminLibraryLightboxIndex >= adminLibraryImages.length - 1} onClick={() => setAdminLibraryLightboxIndex(index => Math.min(adminLibraryImages.length - 1, index + 1))} className="w-11 h-11 rounded-full bg-white/10 text-white disabled:opacity-20 shrink-0"><span className="material-symbols-outlined">chevron_right</span></button>
              </div>
              <div className="h-20 border-t border-white/10 flex items-center justify-center gap-2 px-4 overflow-x-auto">
                {adminLibraryImages.slice(Math.max(0, adminLibraryLightboxIndex - 4), adminLibraryLightboxIndex + 5).map(name => {
                  const index = adminLibraryImages.indexOf(name);
                  return <button key={name} type="button" onClick={() => { setAdminLibraryLightboxIndex(index); setAdminLibraryLightboxZoom(1); }} className={`w-20 h-12 rounded-md overflow-hidden border-2 shrink-0 ${index === adminLibraryLightboxIndex ? 'border-[#00c2ff]' : 'border-transparent opacity-60 hover:opacity-100'}`}><img src={`${API_BASE}/admin/channel-library/${adminLibraryExpandedId}/images/${encodeURIComponent(name)}`} alt="" className="w-full h-full object-cover" /></button>;
                })}
              </div>
            </div>
          )}

          {adminTab === 'transactions' && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-[var(--border-soft)]">
                      <th className="px-4 py-2.5 font-bold">Utilisateur</th>
                      <th className="px-4 py-2.5 font-bold">Offre</th>
                      <th className="px-4 py-2.5 font-bold">Montant</th>
                      <th className="px-4 py-2.5 font-bold">Fournisseur</th>
                      <th className="px-4 py-2.5 font-bold">Statut</th>
                      <th className="px-4 py-2.5 font-bold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminOrdersLoading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Chargement...</td></tr>
                    ) : adminOrders.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucune transaction.</td></tr>
                    ) : adminOrders.map(o => (
                      <tr key={o.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-alt)]/60">
                        <td className="px-4 py-2.5 text-white font-medium">{o.user_email || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-300">{o.plan_name || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-300">{o.amount_fcfa.toLocaleString()} FCFA</td>
                        <td className="px-4 py-2.5 text-slate-400 capitalize">{o.provider}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.status === 'success' ? 'bg-emerald-950/60 text-emerald-400' :
                            o.status === 'failed' ? 'bg-rose-950/60 text-rose-400' :
                            o.status === 'flagged_underpaid' ? 'bg-amber-950/60 text-amber-400' :
                            'bg-[var(--bg-surface-alt)] text-slate-400'
                          }`}>{o.status}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">{o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'costs' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500 max-w-lg">
                  Coûts estimés à partir du nombre de tokens/caractères/images réellement consommés par chaque appel, selon la grille tarifaire publiée des fournisseurs — pas un solde de compte en direct (Anthropic, notamment, n'expose aucune API de solde).
                </p>
                <select
                  value={adminCostsDays}
                  onChange={e => setAdminCostsDays(Number(e.target.value))}
                  className="bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:outline-none flex-shrink-0"
                >
                  <option value={7}>7 derniers jours</option>
                  <option value={30}>30 derniers jours</option>
                  <option value={90}>90 derniers jours</option>
                  <option value={365}>12 derniers mois</option>
                </select>
              </div>

              {adminCostsLoading || !adminCosts ? (
                <div className="text-center text-slate-500 text-xs py-10">Chargement...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Coût total estimé</div>
                      <div className="text-2xl font-extrabold text-white">${adminCosts.total_cost_usd.toFixed(2)}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{adminCosts.total_calls} appel(s) sur {adminCosts.days} jour(s)</div>
                    </div>
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Coût moyen / appel</div>
                      <div className="text-2xl font-extrabold text-white">
                        ${adminCosts.total_calls ? (adminCosts.total_cost_usd / adminCosts.total_calls).toFixed(4) : '0.0000'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-5">
                      <div className="text-xs font-bold text-white mb-3">Par fournisseur</div>
                      {Object.keys(adminCosts.by_provider).length === 0 ? (
                        <p className="text-xs text-slate-500">Aucune donnée pour cette période.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {Object.entries(adminCosts.by_provider).sort((a, b) => b[1].cost_usd - a[1].cost_usd).map(([provider, v]) => (
                            <div key={provider} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300 capitalize">{provider.replace(/_/g, ' ')}</span>
                              <span className="text-slate-500">{v.calls} appel(s)</span>
                              <span className="text-white font-bold">${v.cost_usd.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-5">
                      <div className="text-xs font-bold text-white mb-3">Par fonctionnalité</div>
                      {Object.keys(adminCosts.by_operation).length === 0 ? (
                        <p className="text-xs text-slate-500">Aucune donnée pour cette période.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {Object.entries(adminCosts.by_operation).sort((a, b) => b[1].cost_usd - a[1].cost_usd).map(([op, v]) => (
                            <div key={op} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300 capitalize">{op.replace(/_/g, ' ')}</span>
                              <span className="text-slate-500">{v.calls} appel(s)</span>
                              <span className="text-white font-bold">${v.cost_usd.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-5">
                    <div className="text-xs font-bold text-white mb-3">Vidéos les plus coûteuses</div>
                    {adminCosts.top_videos.length === 0 ? (
                      <p className="text-xs text-slate-500">Aucune donnée pour cette période.</p>
                    ) : (
                      <div className="space-y-2">
                        {adminCosts.top_videos.map(v => (
                          <div key={v.video_id} className="flex items-center justify-between text-xs border-b border-[var(--border-subtle)] last:border-0 pb-2 last:pb-0">
                            <span className="text-slate-300 truncate flex-1 mr-3">{v.title || v.video_id}</span>
                            <span className="text-white font-bold">${v.cost_usd.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {adminTab === 'resources' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500 max-w-xl">
                  Vérification en direct que chaque clé fonctionne — pas un solde de compte en temps réel. La plupart des fournisseurs (Anthropic, Izivoice, fal.ai) n'exposent aucune API de solde ; seul OpenRouter en renvoie un vrai.
                </p>
                <button
                  onClick={fetchAdminProviders}
                  disabled={adminProvidersLoading}
                  className="shrink-0 px-4 py-2 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  <span className={`material-symbols-outlined text-[16px] ${adminProvidersLoading ? 'animate-spin' : ''}`}>{adminProvidersLoading ? 'progress_activity' : 'refresh'}</span>
                  {adminProvidersLoading ? 'Vérification…' : 'Revérifier'}
                </button>
              </div>

              {!adminProviders ? (
                <div className="text-center text-slate-500 text-xs py-10">Chargement...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {adminProviders.map(p => {
                    const dotColor = p.status === 'ok' ? 'bg-emerald-500' : p.status === 'error' ? 'bg-red-500' : p.status === 'unknown' ? 'bg-amber-500' : 'bg-slate-600';
                    const statusLabel = { ok: 'Actif', error: 'Erreur', unknown: 'Non vérifiable', not_configured: 'Non configuré' }[p.status] || p.status;
                    return (
                      <div key={p.id} className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-5">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                            <span className="text-sm font-bold text-white">{p.label}</span>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            p.status === 'ok' ? 'bg-emerald-950/60 text-emerald-400' :
                            p.status === 'error' ? 'bg-rose-950/60 text-rose-400' :
                            p.status === 'unknown' ? 'bg-amber-950/60 text-amber-400' :
                            'bg-[var(--bg-surface-alt)] text-slate-500'
                          }`}>{statusLabel}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{p.detail}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-6 border-t border-[var(--border-soft)] space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-white">Génération des miniatures</h4>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xl">
                    Bascule entre 100% gratuit (Hugging Face uniquement, aucun crédit ni fournisseur payant jamais utilisé) et le mode gratuit-puis-payant (fal.ai puis Izivoice en repli si HF échoue, ce qui coûte des crédits).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setThumbnailProviderMode('free_only')}
                    disabled={thumbnailProviderModeSaving}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-50 ${
                      thumbnailProviderMode === 'free_only'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-600/60'
                        : 'bg-[var(--bg-surface-alt)] text-slate-400 border-[var(--border)] hover:border-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">energy_savings_leaf</span>
                    100% gratuit
                  </button>
                  <button
                    type="button"
                    onClick={() => setThumbnailProviderMode('free_then_paid')}
                    disabled={thumbnailProviderModeSaving}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-50 ${
                      thumbnailProviderMode === 'free_then_paid'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-600/60'
                        : 'bg-[var(--bg-surface-alt)] text-slate-400 border-[var(--border)] hover:border-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">payments</span>
                    Gratuit puis payant
                  </button>
                  {thumbnailProviderModeSaving && <span className="material-symbols-outlined text-[16px] text-slate-500 animate-spin">progress_activity</span>}
                </div>
              </div>

              <div className="pt-6 border-t border-[var(--border-soft)] space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Comptes Hugging Face (gratuit)</h4>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xl">
                    FLUX.1-schnell (open source) via nscale — essayé en premier, avant tout fournisseur payant. Ajoute des comptes au fil du temps pour cumuler plus de quota gratuit.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={hfAccountForm.token}
                    onChange={e => setHfAccountForm({ ...hfAccountForm, token: e.target.value })}
                    placeholder="hf_..."
                    className="flex-1 min-w-0 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none font-mono"
                  />
                  <input
                    value={hfAccountForm.label}
                    onChange={e => setHfAccountForm({ ...hfAccountForm, label: e.target.value })}
                    placeholder="Étiquette (optionnel)"
                    className="sm:w-48 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                  />
                  <button
                    onClick={addHfAccount}
                    disabled={hfAccountBusy}
                    className="shrink-0 px-4 py-2 rounded-xl bg-[#00c2ff] text-slate-950 font-bold text-xs disabled:opacity-50"
                  >
                    {hfAccountBusy ? 'Ajout...' : '+ Ajouter'}
                  </button>
                </div>

                {hfAccountsLoading ? (
                  <p className="text-xs text-slate-500">Chargement...</p>
                ) : hfAccounts.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucun compte Hugging Face enregistré.</p>
                ) : (
                  <div className="space-y-2">
                    {hfAccounts.map(a => {
                      const dotColor = a.status === 'active' ? 'bg-emerald-500' : a.status === 'quota_exhausted' ? 'bg-amber-500' : 'bg-red-500';
                      const statusLabel = { active: 'Actif', quota_exhausted: 'Quota épuisé', invalid: 'Invalide' }[a.status] || a.status;
                      const statusClass = a.status === 'active' ? 'bg-emerald-950/60 text-emerald-400' : a.status === 'quota_exhausted' ? 'bg-amber-950/60 text-amber-400' : 'bg-rose-950/60 text-rose-400';
                      return (
                        <div key={a.id} className={`flex items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-xl p-3 ${!a.is_enabled ? 'opacity-50' : ''}`}>
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                          <div className="min-w-0 flex-1">
                            {editingHfLabelId === a.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  autoFocus
                                  value={editingHfLabelValue}
                                  onChange={e => setEditingHfLabelValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') renameHfAccount(a.id); if (e.key === 'Escape') setEditingHfLabelId(null); }}
                                  placeholder="Étiquette"
                                  className="min-w-0 flex-1 bg-[var(--bg-surface-alt)] border border-[#00c2ff] rounded-lg px-2 py-1 text-xs text-white outline-none"
                                />
                                <button onClick={() => renameHfAccount(a.id)} title="Enregistrer" className="shrink-0 p-1 rounded-lg text-emerald-400 hover:bg-[var(--bg-surface-alt)]">
                                  <span className="material-symbols-outlined text-[16px]">check</span>
                                </button>
                                <button onClick={() => setEditingHfLabelId(null)} title="Annuler" className="shrink-0 p-1 rounded-lg text-slate-400 hover:bg-[var(--bg-surface-alt)]">
                                  <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-white truncate">{a.label || a.token_preview}</div>
                            )}
                            <div className="text-[10px] text-slate-500 font-mono truncate">{a.token_preview}{a.last_error ? ` — ${a.last_error.slice(0, 80)}` : ''}</div>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusClass}`}>{statusLabel}</span>
                          {editingHfLabelId !== a.id && (
                            <button
                              onClick={() => { setEditingHfLabelId(a.id); setEditingHfLabelValue(a.label || ''); }}
                              title="Renommer"
                              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--bg-surface-alt)]"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                          )}
                          <button
                            onClick={() => checkHfAccount(a.id)}
                            disabled={hfAccountChecking === a.id}
                            title="Revérifier"
                            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--bg-surface-alt)] disabled:opacity-50"
                          >
                            <span className={`material-symbols-outlined text-[16px] ${hfAccountChecking === a.id ? 'animate-spin' : ''}`}>{hfAccountChecking === a.id ? 'progress_activity' : 'refresh'}</span>
                          </button>
                          <button
                            onClick={() => toggleHfAccount(a.id, !a.is_enabled)}
                            title={a.is_enabled ? 'Désactiver' : 'Activer'}
                            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--bg-surface-alt)]"
                          >
                            <span className="material-symbols-outlined text-[16px]">{a.is_enabled ? 'toggle_on' : 'toggle_off'}</span>
                          </button>
                          <button
                            onClick={() => deleteHfAccount(a.id)}
                            title="Retirer"
                            className="shrink-0 p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADMIN — user detail / grant-subscription drawer */}
      {adminSelectedUser && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[70] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 max-w-[480px] w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white">{adminSelectedUser.email}</h3>
                <p className="text-[11px] text-slate-500">{adminSelectedUser.channels?.length || 0} chaîne(s) · {adminSelectedUser.free_videos_used}/{adminSelectedUser.free_video_quota_granted} vidéos gratuites utilisées</p>
              </div>
              <button onClick={() => setAdminSelectedUser(null)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Solde de crédits</div>
                <div className="text-sm font-bold text-[#00c2ff]">{(adminSelectedUser.credit_balance ?? 0).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={adminCreditForm.amount}
                  onChange={e => setAdminCreditForm({ ...adminCreditForm, amount: e.target.value })}
                  placeholder="Montant"
                  className="flex-1 min-w-0 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                />
                <input
                  value={adminCreditForm.note}
                  onChange={e => setAdminCreditForm({ ...adminCreditForm, note: e.target.value })}
                  placeholder="Note (optionnel)"
                  className="flex-[1.5] min-w-0 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => adjustAdminCredits('grant')}
                  disabled={adminCreditBusy}
                  className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  + Ajouter
                </button>
                <button
                  onClick={() => adjustAdminCredits('revoke')}
                  disabled={adminCreditBusy}
                  className="flex-1 py-2 bg-rose-950/60 border border-rose-800 text-rose-300 font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  − Retirer
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Historique d'abonnement</div>
              {(adminSelectedUser.subscriptions || []).length === 0 ? (
                <p className="text-xs text-slate-500">Aucun abonnement.</p>
              ) : adminSelectedUser.subscriptions.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[11px]">
                  <div>
                    <span className={`font-bold ${s.status === 'active' ? 'text-emerald-400' : 'text-slate-500'}`}>{s.status}</span>
                    <span className="text-slate-400 ml-2">{s.plan_name || 'Octroi personnalisé'} — jusqu'au {new Date(s.expires_at).toLocaleDateString('fr-FR')}</span>
                    {s.note && <div className="text-slate-500 mt-0.5">{s.note}</div>}
                  </div>
                  {s.status === 'active' && (
                    <button onClick={() => revokeAdminSubscription(adminSelectedUser.id)} className="text-rose-400 font-bold shrink-0 ml-2">Révoquer</button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Accorder un abonnement</div>
              <select
                value={adminGrantForm.plan_id}
                onChange={e => setAdminGrantForm({ ...adminGrantForm, plan_id: e.target.value })}
                className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
              >
                <option value="">Octroi personnalisé (gratuit, durée libre)</option>
                {adminPlans.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.price_fcfa.toLocaleString()} FCFA / {p.duration_days}j</option>
                ))}
              </select>
              {!adminGrantForm.plan_id && (
                <input
                  type="number"
                  value={adminGrantForm.duration_days}
                  onChange={e => setAdminGrantForm({ ...adminGrantForm, duration_days: e.target.value })}
                  placeholder="Durée en jours"
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                />
              )}
              <input
                value={adminGrantForm.note}
                onChange={e => setAdminGrantForm({ ...adminGrantForm, note: e.target.value })}
                placeholder="Note (ex: partenaire, geste commercial...)"
                className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
              />
              <button
                onClick={grantAdminSubscription}
                disabled={adminGranting}
                className="w-full py-2.5 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50"
              >
                {adminGranting ? 'Octroi...' : 'Accorder l\'abonnement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN — video technical detail popup: preview, voice/script/subtitles/
          music actually used, itemized credit cost — opened from the video
          title in the Vidéos tab. */}
      {adminVideoDetail && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[70] flex items-center justify-center p-6" onClick={() => setAdminVideoDetail(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 max-w-[640px] w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{adminVideoDetail.display_title || adminVideoDetail.title || '(sans titre)'}</h3>
                <p className="text-[11px] text-slate-500">{adminVideoDetail.channel_name || '—'} · {adminVideoDetail.owner_email || '—'}</p>
              </div>
              <button onClick={() => setAdminVideoDetail(null)} className="text-slate-400 hover:text-white shrink-0">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {adminVideoDetailLoading ? (
              <p className="text-xs text-slate-500 py-6 text-center">Chargement...</p>
            ) : (
              <>
                {adminVideoDetail.output_path && (
                  <video
                    controls
                    src={getVideoUrl(adminVideoDetail.output_path)}
                    className="w-full rounded-2xl bg-black max-h-[320px]"
                  />
                )}

                {['queued', 'rendering'].includes(adminVideoDetail.status) && (
                  <div className="bg-[var(--bg-input)] border border-[#00c2ff]/30 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold text-[#00c2ff] uppercase tracking-wider">Rendu en cours</div>
                        <div className="text-xs text-white mt-0.5">{adminVideoDetail.progress_stage || (adminVideoDetail.status === 'queued' ? 'En attente du moteur de rendu' : 'Traitement en cours')}</div>
                      </div>
                      <div className="text-sm font-extrabold text-[#00c2ff]">{adminVideoDetail.progress_percent || 0}%</div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-[#00c2ff] transition-all duration-500" style={{ width: `${Math.max(2, adminVideoDetail.progress_percent || 0)}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-500">Actualisation automatique toutes les deux secondes.</div>
                  </div>
                )}

                {adminVideoDetail.status === 'failed' && (
                  <div className="bg-rose-950/30 border border-rose-800/60 rounded-2xl p-4 space-y-3">
                    <div>
                      <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Échec du rendu</div>
                      <div className="text-xs text-rose-200 mt-1 whitespace-pre-wrap">{adminVideoDetail.error_message || 'Aucun détail technique disponible.'}</div>
                    </div>
                    <button onClick={retryAdminVideo} disabled={adminVideoRetrying} className="w-full py-2.5 rounded-xl bg-rose-500 text-white text-xs font-bold disabled:opacity-50">
                      {adminVideoRetrying ? 'Relance…' : 'Relancer la vidéo'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Statut</div>
                    <div className="text-xs font-bold text-white">{adminVideoDetail.status}</div>
                  </div>
                  <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Coût total</div>
                    <div className="text-xs font-bold text-[#00c2ff]">{(adminVideoDetail.total_credits ?? 0).toLocaleString()} crédits</div>
                  </div>
                  <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Voix</div>
                    <div className="text-xs font-bold text-white truncate">{adminVideoDetail.voice_name || adminVideoDetail.voice_id || '—'}</div>
                  </div>
                  <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Musique</div>
                    <div className="text-xs font-bold text-white truncate">
                      {adminVideoDetail.music_preference?.enabled
                        ? (adminVideoDetail.music_preference.mode === 'ai_generate' ? 'Générée par IA' : (adminVideoDetail.music_preference.tracks?.[0]?.split('/').pop() || 'Piste importée'))
                        : 'Désactivée'}
                    </div>
                  </div>
                  <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 col-span-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sous-titres</div>
                    <div className="text-xs font-bold text-white">
                      {adminVideoDetail.subtitle_style?.enabled === false
                        ? 'Désactivés'
                        : `${adminVideoDetail.subtitle_style?.font || 'Police par défaut'} · ${adminVideoDetail.subtitle_style?.position || 'centre'}`}
                    </div>
                  </div>
                </div>

                {adminVideoDetail.script_text && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Script</div>
                    <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-slate-300 max-h-[160px] overflow-y-auto whitespace-pre-wrap">
                      {adminVideoDetail.script_text}
                    </div>
                  </div>
                )}

                {adminVideoDetail.cost_items?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Détail des coûts</div>
                    <div className="space-y-1">
                      {adminVideoDetail.cost_items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5">
                          <span className="text-slate-400 truncate">{item.description}</span>
                          <span className="text-[#00c2ff] font-bold shrink-0 ml-2">{item.credits.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

          </div>
        </div>
      </main>

      {/* NOUVELLE VIDÉO MAIN ACTION MODAL */}
      {showSubmitModal && activeChannel && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className={`bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl w-full max-h-[90vh] shadow-2xl flex flex-col ${submitStep === 2 ? 'max-w-[980px]' : 'max-w-[620px]'}`}>
            <div className="flex justify-between items-center border-b border-[var(--border-soft)] px-8 pt-8 pb-4 shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#00c2ff]">movie_filter</span>
                  {submitStep === 1 ? 'Générer une Nouvelle Vidéo' : 'Aperçu avant lancement'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {submitStep === 1 ? 'Choisissez le contenu pour lancer le montage.' : 'Vérifiez que tout est correct avant de lancer le montage.'}
                </p>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-slate-400 hover:text-white p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto px-8 py-6 space-y-6">
            {/* Active Channel (read-only — already chosen before opening this modal) */}
            <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-2xl p-3">
              <div className="text-sm font-bold text-white truncate">{activeChannel.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{activeChannel.niche}</div>
            </div>

            {submitStep === 1 ? (
              <>
                {/* Input Mode Selector */}
                <div className="grid grid-cols-2 gap-3 bg-[var(--bg-input)] p-1.5 rounded-xl border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setSubmitMode('text')}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                      submitMode === 'text' ? 'bg-[#00c2ff] text-slate-950 shadow-md' : 'text-slate-400'
                    }`}
                  >
                    Texte Script (IA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmitMode('audio_upload')}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                      submitMode === 'audio_upload' ? 'bg-[#00c2ff] text-slate-950 shadow-md' : 'text-slate-400'
                    }`}
                  >
                    Fichiers Audio Importés
                  </button>
                </div>

                {/* La voix est un réglage de chaîne (configuré une fois dans les
                    paramètres) — plus de sélecteur/sliders ici, juste un rappel
                    de la voix déjà active pour ne jamais la changer par accident
                    à chaque vidéo. */}
                {submitMode === 'text' && (
                  <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5">
                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff] shrink-0">graphic_eq</span>
                    <span className="text-[11px] text-slate-400">Voix de la chaîne :</span>
                    <span className="text-xs font-bold text-white truncate">{activeChannel.voice_name || availableVoices.find(v => v.id === activeChannel.voice_id)?.name || 'Non configurée'}</span>
                    <button
                      type="button"
                      onClick={() => { setShowSubmitModal(false); openEditWizard(activeChannel, null, 1); }}
                      className="ml-auto shrink-0 text-[11px] font-bold text-[#56d9ff] hover:underline"
                    >
                      Modifier
                    </button>
                  </div>
                )}

                {/* Content Input Area */}
                {submitMode === 'text' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">Texte du Script</label>
                    <textarea
                      rows="5"
                      value={singleScriptText}
                      onChange={e => setSingleScriptText(e.target.value)}
                      className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-2xl p-4 text-xs text-white focus:border-[#00c2ff] outline-none placeholder-slate-500"
                      placeholder="Collez ici le texte de votre vidéo. L'IA générera la voix off et calera les sous-titres karaoké..."
                    />
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      isDragging ? 'border-[#00c2ff] bg-[#00c2ff]/10' : 'border-[var(--border)] hover:border-slate-400 bg-[var(--bg-input)]'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="audio/*"
                      onChange={e => setAudioFilesList(prev => [...prev, ...Array.from(e.target.files)])}
                      className="hidden"
                    />
                    <span className="material-symbols-outlined text-slate-400 text-[42px] mb-2">cloud_upload</span>
                    <div className="text-xs font-bold text-white">Glisser-déposer vos fichiers audio (.mp3, .wav)</div>
                    <div className="text-[11px] text-slate-400 mt-1">ou cliquez pour choisir des fichiers</div>
                    {audioFilesList.length > 0 && (
                      <div className="mt-4 space-y-1">
                        {audioFilesList.map((f, i) => <AudioFilePreview key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => setAudioFilesList(prev => prev.filter((_, idx) => idx !== i))} />)}
                      </div>
                    )}
                  </div>
                )}

              </>
            ) : (
              <>
                {/* Confirmation / preview summary before launching the render — two columns
                    on this wider step so the settings recap and the visual/script preview
                    sit side by side instead of stacking into one long scroll. */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {submitMode === 'text' && (
                    <div className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3">
                      <span className="text-xs text-slate-400">Voix off</span>
                      <span className="text-xs font-bold text-white">{availableVoices.find(v => v.id === selectedVoice)?.name || selectedVoice}</span>
                    </div>
                  )}
                  {/* Same recap/toggle principle as the pipeline's Aperçu Final — these
                      toggle the channel's real, saved settings immediately, not just this
                      one video, so the state matches whichever screen the client checks. */}
                  <div className="space-y-1.5">
                    {[
                      { id: 'logo', label: 'Logo de la chaîne', icon: 'workspace_premium', group: 'branding', field: 'logo_enabled', checked: activeChannel.branding?.logo_enabled ?? true },
                      { id: 'subtitles', label: 'Sous-titres', icon: 'subtitles', group: 'subtitle_style', field: 'enabled', checked: activeChannel.subtitle_style?.enabled ?? true },
                      { id: 'effects', label: 'Effets visuels', icon: 'auto_awesome', group: 'effects_config', field: 'enabled', checked: activeChannel.effects_config?.enabled ?? true },
                      // No real "disabled" setting exists for the background visual — a
                      // video always has one (library or AI-generated) — so it's shown
                      // as permanently on, same as voiceover, rather than an orphaned
                      // local toggle with nothing real to reflect.
                      { id: 'visual', label: 'Visuel de fond', icon: 'image', checked: true, readOnly: true },
                      { id: 'music', label: 'Musique de fond', icon: 'music_note', group: 'music_preference', field: 'enabled', checked: activeChannel.music_preference?.enabled ?? true },
                    ].map(({ id, label, icon, group, field, checked, readOnly }) => (
                      <button
                        key={id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => group && toggleActiveChannelFlag(group, field)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2.5 text-left ${readOnly ? 'cursor-default' : ''} ${
                          checked
                            ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                            : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-500 hover:border-slate-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] shrink-0">{icon}</span>
                        <span className="flex-1 truncate">{label}</span>
                        <span className="material-symbols-outlined text-[16px] shrink-0">{checked ? 'check_box' : 'check_box_outline_blank'}</span>
                      </button>
                    ))}
                  </div>

                  {(submitMode === 'audio_upload' || submitMode === 'text') && (
                    <button
                      type="button"
                      onClick={() => setTranscribeAudio(prev => !prev)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2.5 text-left ${
                        transcribeAudio
                          ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                          : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-slate-500 hover:border-slate-500'
                      }`}
                      title={submitMode === 'text'
                        ? `Sans transcription, les sous-titres sont estimés en répartissant le script uniformément sur la durée — moins précis mais gratuit. Avec transcription : ${TRANSCRIPTION_CREDITS_PER_SEC} crédits par seconde d'audio (gratuit si tu utilises ta propre clé Izivoice).`
                        : `Sans transcription, les sous-titres utiliseront le titre du fichier au lieu du texte réel parlé. Avec transcription : ${TRANSCRIPTION_CREDITS_PER_SEC} crédits par seconde d'audio (gratuit si tu utilises ta propre clé Izivoice).`}
                    >
                      <span className="material-symbols-outlined text-[16px] shrink-0">record_voice_over</span>
                      <span className="flex-1 truncate">Transcrire pour des sous-titres précis (IA)</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[10px] font-extrabold whitespace-nowrap">
                        {TRANSCRIPTION_CREDITS_PER_SEC} crédits/sec
                      </span>
                      <span className="material-symbols-outlined text-[16px] shrink-0">{transcribeAudio ? 'check_box' : 'check_box_outline_blank'}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Real visual mockup of the final rendered frame: background style,
                      subtitle font/color/outline/position, and active effects — everything
                      exactly as configured on the channel, not just a text summary. */}
                  <div>
                    <div className="text-xs text-slate-400 mb-2">Aperçu visuel du rendu final</div>
                    <div ref={submitSubtitlePreviewRef} className="w-full aspect-video rounded-2xl overflow-hidden relative border border-[var(--border)] shadow-lg">
                      {resolveEnabledImageSources(activeChannel.image_style).includes('library') && (
                        <img
                          src={`${API_BASE}/channels/${activeChannel.id}/library-preview`}
                          alt="Image aléatoire de la bibliothèque"
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <div
                        className="absolute inset-0 opacity-60"
                        style={{
                          background: activeChannel.effects_config?.color_grade === 'warm'
                            ? 'linear-gradient(160deg, #3a2a1a 0%, #1a1208 60%, #0a0705 100%)'
                            : activeChannel.effects_config?.color_grade === 'cool'
                            ? 'linear-gradient(160deg, #0f2438 0%, #0a1826 60%, #050c12 100%)'
                            : 'linear-gradient(160deg, #232938 0%, #14171f 60%, #0a0b0f 100%)'
                        }}
                      />
                      {(activeChannel.effects_config?.enabled ?? true) && activeChannel.effects_config?.grain && (
                        <div
                          className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none"
                          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
                        />
                      )}
                      {(activeChannel.branding?.logo_enabled ?? true) && getChannelLogoUrl(activeChannel) !== "/assets/logo/logo-kappgen.png" && (
                        <div className="absolute top-3 right-3 z-20">
                          <img
                            src={getChannelLogoUrl(activeChannel)}
                            alt="Logo"
                            style={(() => {
                              const sizePx = 1920 * ((activeChannel.branding?.logo_size_percent ?? 14) / 100) * submitSubtitlePreviewScale;
                              return { width: `${sizePx}px`, height: `${sizePx}px`, ...shapeClipStyle(activeChannel.branding?.logo_shape) };
                            })()}
                            className="object-cover shadow-lg"
                          />
                        </div>
                      )}
                      {(activeChannel.subtitle_style?.enabled ?? true) && (
                      <div
                        className={`absolute inset-x-0 flex justify-center px-6 ${subtitlePositionClass(activeChannel.subtitle_style?.position)}`}
                      >
                        <div className="flex flex-wrap justify-center items-center gap-1.5 text-center">
                          {sampleWords.map((wordObj, i) => (
                            <span
                              key={i}
                              style={{
                                fontFamily: activeChannel.subtitle_style?.font || 'Arial',
                                fontSize: `${(activeChannel.subtitle_style?.size || 44) * submitSubtitlePreviewScale}px`,
                                fontWeight: '900',
                                color: (activeChannel.subtitle_style?.karaoke === false || wordObj.highlight) ? (activeChannel.subtitle_style?.color || '#FFD700') : (activeChannel.subtitle_style?.base_color || '#FFFFFF'),
                                WebkitTextStroke: (activeChannel.subtitle_style?.box_color && activeChannel.subtitle_style.box_color !== 'transparent')
                                  ? 'none'
                                  : `${(activeChannel.subtitle_style?.outline_width ?? 3) * submitSubtitlePreviewScale}px ${activeChannel.subtitle_style?.outline_color || '#000000'}`,
                                paintOrder: 'stroke fill',
                                textShadow: '0 2px 8px rgba(0,0,0,0.6)'
                              }}
                              className="inline-block"
                            >
                              {applySubtitleCase(wordObj.text, activeChannel.subtitle_style?.text_case)}
                            </span>
                          ))}
                        </div>
                      </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3">
                    <div className="text-xs text-slate-400 mb-2">{submitMode === 'text' ? 'Aperçu du script' : `Fichiers audio (${audioFilesList.length})`}</div>
                    {submitMode === 'text' ? (
                      <p className="text-xs text-white line-clamp-4">{singleScriptText}</p>
                    ) : (
                      // No full waveform player here — this audio becomes the video's own
                      // narration track, playable directly once the render is done; a
                      // second full-length player at this step just wastes space.
                      <div className="space-y-1.5">
                        {audioFilesList.map((f, i) => (
                          <div key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2.5 text-xs text-white bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">audiotrack</span>
                            <span className="flex-1 truncate">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-[#00c2ff]/10 border border-[#00c2ff]/30 rounded-xl p-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[#00c2ff] text-[18px]">info</span>
                    <p className="text-[11px] text-slate-300">Le montage utilisera les réglages déjà configurés pour <strong className="text-white">{activeChannel.name}</strong> (sous-titres, musique, visuels). Vous pourrez suivre l'avancement dans "Mes Vidéos".</p>
                  </div>
                </div>
                </div>
              </>
            )}
            </div>

            <div className="shrink-0 border-t border-[var(--border-soft)] px-8 py-5">
              {submitStep === 1 ? (
                <button
                  onClick={() => {
                    if (submitMode === 'text' && !singleScriptText.trim()) return showToast("Veuillez saisir le texte de votre script.", "error");
                    if (submitMode === 'audio_upload' && audioFilesList.length === 0) return showToast("Veuillez ajouter au moins un fichier audio.", "error");
                    setSubmitStep(2);
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-[#00c2ff] to-[#0088ff] text-slate-950 font-bold text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00c2ff]/25"
                >
                  Voir l'aperçu <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSubmitStep(1)}
                    disabled={loading}
                    className="flex-1 py-3 bg-[var(--bg-surface-alt)] text-white rounded-xl font-bold text-sm hover:bg-[var(--border-soft)] transition-colors border border-[var(--border)]"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={handleSubjectSubmit}
                    disabled={loading}
                    className="flex-1 py-3 bg-gradient-to-r from-[#00c2ff] to-[#0088ff] text-slate-950 font-bold text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00c2ff]/25"
                  >
                    <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                    {loading ? "Lancement..." : "Confirmer et Lancer"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIDEO PLAYER MODAL */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 max-w-[min(1200px,92vw)] w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Aperçu Vidéo Rendu</h3>
              <button onClick={() => setSelectedVideo(null)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="aspect-[16/9] max-h-[80vh] mx-auto rounded-2xl overflow-hidden border border-[var(--border-soft)]">
              <VideoPlayer
                src={getVideoUrl(selectedVideo.output_path)}
                className="w-full h-full"
                autoPlay
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => openStudio(selectedVideo)}
                className="flex-1 py-3 bg-[var(--bg-surface-alt)] text-white font-bold text-xs rounded-xl text-center hover:bg-[var(--border-soft)] transition-all flex items-center justify-center gap-2 border border-[var(--border)]"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span> Éditer
              </button>
              <button
                onClick={() => setDownloadModalVideo(selectedVideo)}
                className="flex-1 py-3 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl text-center hover:bg-[#38d0ff] transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">download</span> Télécharger MP4
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NICHECUT STUDIO — full scene-based editor (script/audio, scene timeline, per-scene edits) */}
      {studioVideo && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center px-5 py-3 border-b border-[var(--border-subtle)] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-[#00c2ff] shrink-0">auto_fix_high</span>
              {studioEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={studioTitleDraft}
                    onChange={(e) => setStudioTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveStudioTitle(); if (e.key === 'Escape') setStudioEditingTitle(false); }}
                    className="bg-[var(--bg-surface-alt)] border border-[#00c2ff] rounded-lg px-2.5 py-1 text-sm font-bold text-white outline-none w-[420px] max-w-[40vw]"
                  />
                  <button onClick={saveStudioTitle} disabled={studioSavingTitle} className="text-[#00c2ff] hover:text-[#38d0ff]">
                    <span className="material-symbols-outlined text-[20px]">{studioSavingTitle ? 'progress_activity' : 'check'}</span>
                  </button>
                  <button onClick={() => setStudioEditingTitle(false)} className="text-slate-500 hover:text-white">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setStudioTitleDraft(studioVideo.title || ''); setStudioEditingTitle(true); }}
                  className="text-sm font-bold text-white truncate max-w-[50vw] hover:text-[#38d0ff] flex items-center gap-1.5 group"
                  title="Cliquer pour modifier le titre"
                >
                  {studioVideo.title || (studioVideo.script_text || '').slice(0, 80) || 'Sans titre'}
                  <span className="material-symbols-outlined text-[14px] text-slate-600 group-hover:text-[#38d0ff]">edit</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {studioReassembling && (
                <span className="px-3 py-1.5 bg-[#00c2ff]/10 border border-[#00c2ff]/30 rounded-lg text-[11px] text-[#38d0ff] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  Réassemblage en cours...
                </span>
              )}
              <button onClick={closeStudio} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {studioLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">Chargement des scènes...</div>
          ) : studioScenes === null ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 px-10 text-center">
              Cette vidéo n'est plus éditable (fichiers sources purgés après 7 jours, ou vidéo antérieure à cette fonctionnalité).
            </div>
          ) : studioScenes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">Aucune scène trouvée.</div>
          ) : (
            <>
              {/* Body: voice-off/script (left) · video player (main) · scene editor (right) */}
              <div className="flex-1 flex min-h-0">
                {/* LEFT — voice-off picker + audio player + full-script editor */}
                <div className="w-72 shrink-0 border-r border-[var(--border-subtle)] flex flex-col min-h-0">
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)] shrink-0 space-y-3">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Voix off</div>
                      <button
                        onClick={() => setStudioVoiceMenuOpen(o => !o)}
                        className="w-full flex items-center justify-between gap-2 bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[#00c2ff]/50 rounded-xl px-3 py-2 text-left"
                      >
                        <span className="text-xs font-bold text-white truncate">
                          {availableVoices.find(v => v.id === studioVoiceDraft)?.name || studioVoiceDraft || 'Non définie'}
                        </span>
                        <span className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform ${studioVoiceMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
                      </button>
                      {studioVoiceMenuOpen && (
                        <div className="mt-1.5 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl max-h-56 overflow-y-auto">
                          {availableVoices.map(v => (
                            <button
                              key={v.id}
                              onClick={() => { setStudioVoiceDraft(v.id); setStudioVoiceMenuOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--border)] flex items-center justify-between gap-2 ${studioVoiceDraft === v.id ? 'text-[#38d0ff] font-bold' : 'text-slate-300'}`}
                            >
                              <span className="truncate">{v.name}</span>
                              {v.preview_url && (
                                <span
                                  className="material-symbols-outlined text-[14px] text-slate-500 hover:text-[#00c2ff] shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (studioPreviewPlayingId === v.id) {
                                      stopVoicePreview();
                                      setStudioPreviewPlayingId(null);
                                      return;
                                    }
                                    playVoicePreviewExclusive(v.preview_url, () => setStudioPreviewPlayingId(null));
                                    setStudioPreviewPlayingId(v.id);
                                  }}
                                >{studioPreviewPlayingId === v.id ? 'pause_circle' : 'play_circle'}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {studioVoiceDraft && studioVoiceDraft !== studioVideo.voice_id && (
                        <button
                          onClick={regenerateStudioWithVoice}
                          disabled={studioRegeneratingVoice}
                          className="mt-2 w-full py-2 bg-[#00c2ff] hover:bg-[#38d0ff] text-slate-950 rounded-lg font-bold text-[11px] disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">{studioRegeneratingVoice ? 'progress_activity' : 'record_voice_over'}</span>
                          {studioRegeneratingVoice ? 'Lancement…' : 'Régénérer avec cette voix'}
                        </button>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Audio</div>
                      <ServerAudioPreview src={`${API_BASE}/videos/${studioVideo.id}/audio`} name="Voix off" />
                    </div>
                  </div>
                  <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Script</div>
                      {!studioEditingFullScript ? (
                        <button
                          onClick={() => { setStudioFullScriptDraft(studioScenes.map(s => s.text || '').join('\n\n')); setStudioEditingFullScript(true); }}
                          className="text-[10px] font-bold text-[#00c2ff] hover:text-[#38d0ff] flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[13px]">edit_note</span>
                          Modifier tout
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setStudioEditingFullScript(false)} className="text-[10px] font-bold text-slate-500 hover:text-white">Annuler</button>
                          <button onClick={saveStudioFullScript} disabled={studioSavingFullScript} className="text-[10px] font-bold text-[#00c2ff] hover:text-[#38d0ff] disabled:opacity-50">
                            {studioSavingFullScript ? 'Enregistrement…' : 'Enregistrer'}
                          </button>
                        </div>
                      )}
                    </div>
                    {studioEditingFullScript ? (
                      <>
                        <textarea
                          value={studioFullScriptDraft}
                          onChange={(e) => setStudioFullScriptDraft(e.target.value)}
                          rows={20}
                          className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-3 text-[11px] leading-relaxed text-white focus:border-[#00c2ff] outline-none resize-none"
                        />
                        <p className="text-[10px] text-slate-500 mt-1.5">Garde une ligne vide entre chaque scène ({studioScenes.length} au total) — n'en ajoute ni n'en retire.</p>
                      </>
                    ) : (
                      <div className="space-y-2.5">
                        {studioScenes.map(scene => (
                          <p
                            key={scene.index}
                            onClick={() => selectStudioScene(scene, { seek: true })}
                            className={`text-[11px] leading-snug cursor-pointer rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                              studioSelectedIndex === scene.index ? 'bg-[#00c2ff]/15 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--bg-surface-alt)]'
                            }`}
                          >
                            {scene.text || <span className="italic text-slate-600">(scène {scene.index + 1})</span>}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* MAIN — real video playback, synced with the bottom timeline */}
                <div className="flex-1 flex items-center justify-center bg-black min-w-0">
                  <VideoPlayer
                    src={getVideoUrl(studioVideo.output_path)}
                    className="w-full h-full"
                    onTimeUpdate={setStudioPlaybackTime}
                    seekTo={studioSeekTo}
                    onPlayingChange={setStudioIsPlaying}
                  />
                </div>

                {/* RIGHT — precise script/image editing for the selected scene */}
                  {studioSelectedIndex !== null && (() => {
                    const scene = studioScenes.find(s => s.index === studioSelectedIndex);
                    if (!scene) return null;
                    return (
                      <div className="w-80 shrink-0 border-l border-[var(--border-subtle)] flex flex-col min-h-0">
                        <div className="px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scène {scene.index + 1}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{scene.duration.toFixed(1)}s</div>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Image de la scène</label>
                            <label className={`w-full py-2.5 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              studioReplacingIndex === scene.index
                                ? 'bg-[#00c2ff]/10 border-[#00c2ff]/30 text-[#55d8ff]'
                                : 'bg-[var(--bg-dropdown)] hover:bg-[var(--border)] border-[var(--border)] text-white'
                            }`}>
                              <span className={`material-symbols-outlined text-[16px] ${studioReplacingIndex === scene.index ? 'animate-spin' : ''}`}>
                                {studioReplacingIndex === scene.index ? 'progress_activity' : 'image'}
                              </span>
                              {studioReplacingIndex === scene.index ? 'Remplacement…' : `Changer l’image de la scène ${scene.index + 1}`}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                disabled={studioReplacingIndex !== null || studioReassembling}
                                onChange={(e) => e.target.files[0] && replaceSceneImage(scene.index, e.target.files[0])}
                              />
                            </label>
                            <p className="text-[10px] text-slate-500 mt-1.5">Seule cette scène sera reconstruite avec la nouvelle image.</p>
                          </div>

                          {!scene.editable_text ? (
                            <p className="text-[11px] text-slate-500">Cette scène n'a pas de sous-titres modifiables (vidéo antérieure à cette fonctionnalité) — seul le remplacement d'image est disponible.</p>
                          ) : (
                            <>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Script de la scène</label>
                                <textarea
                                  rows={6}
                                  value={studioSubtitleDraft}
                                  onChange={(e) => setStudioSubtitleDraft(e.target.value)}
                                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none resize-none"
                                />
                                <p className="text-[10px] text-slate-500 mt-1.5">Modifie uniquement cette section. Les autres scènes et leurs images ne sont pas régénérées.</p>
                              </div>

                              <div className="space-y-2">
                                {!studioConfirmRegen ? (
                                  <button
                                    onClick={() => setStudioConfirmRegen(true)}
                                    disabled={studioRegeneratingAudio || !studioSubtitleDraft.trim() || studioSubtitleDraft.trim() === scene.text}
                                    className="w-full py-2.5 bg-[#00c2ff] hover:bg-[#38d0ff] text-slate-950 rounded-xl font-extrabold text-xs transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">record_voice_over</span>
                                    Enregistrer le script et la voix
                                  </button>
                                ) : (
                                  <div className="bg-[#00c2ff]/5 border border-[#00c2ff]/30 rounded-xl p-3 space-y-2">
                                    <p className="text-[11px] text-slate-300">KappGen AI régénérera uniquement la voix de la scène {scene.index + 1} et ajustera sa durée. Confirmer ?</p>
                                    <div className="flex gap-2">
                                      <button onClick={() => setStudioConfirmRegen(false)} className="flex-1 py-1.5 bg-[var(--bg-dropdown)] text-white rounded-lg text-[11px] font-bold">Annuler</button>
                                      <button onClick={() => regenerateSceneAudio(scene.index)} disabled={studioRegeneratingAudio} className="flex-1 py-1.5 bg-[#00c2ff] text-slate-950 rounded-lg text-[11px] font-bold disabled:opacity-50">
                                        {studioRegeneratingAudio ? 'Régénération...' : 'Confirmer'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                                <button
                                  onClick={() => saveSceneSubtitle(scene.index)}
                                  disabled={studioSavingSubtitle || !studioSubtitleDraft.trim() || studioSubtitleDraft.trim() === scene.text}
                                  className="w-full py-2 bg-[var(--bg-dropdown)] hover:bg-[var(--border)] text-slate-300 rounded-xl font-bold text-[11px] transition-all border border-[var(--border)] disabled:opacity-40 flex items-center justify-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-[14px]">subtitles</span>
                                  {studioSavingSubtitle ? 'Enregistrement…' : 'Modifier seulement le sous-titre'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* BOTTOM — scene timeline strip, playhead-synced with the video above */}
                <div className="h-28 shrink-0 border-t border-[var(--border-subtle)] px-4 py-2.5 overflow-x-auto">
                  <div className="flex gap-2 h-full">
                    {studioScenes.map(scene => {
                      const isPlayingHere = studioPlaybackTime >= scene.start && studioPlaybackTime < scene.end;
                      const isActive = studioSelectedIndex === scene.index || (studioIsPlaying && isPlayingHere);
                      return (
                        <button
                          key={scene.index}
                          onClick={() => selectStudioScene(scene, { seek: true })}
                          className={`relative h-full aspect-video shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                            isActive ? 'border-[#00c2ff]' : 'border-transparent hover:border-[var(--border)]'
                          }`}
                          title={studioIsPlaying ? 'Mets la vidéo en pause pour éditer cette image' : `Éditer l'image de la scène ${scene.index + 1}`}
                        >
                          <img src={`${API_BASE}${scene.image_url}?v=${scene.image_version || 0}`} alt={`Scène ${scene.index + 1}`} className="w-full h-full object-cover" />
                          {isPlayingHere && studioIsPlaying && (
                            <div className="absolute inset-x-0 top-0 h-0.5 bg-[#00c2ff]" style={{ width: `${((studioPlaybackTime - scene.start) / (scene.end - scene.start)) * 100}%` }} />
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 text-[9px] text-slate-200 text-left">
                            {scene.index + 1} · {scene.duration.toFixed(1)}s
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-6 max-w-[380px] w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Nouveau dossier</h3>
              <button onClick={() => { setShowNewFolderModal(false); setNewFolderName(''); }} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createFolder(); }}
              placeholder="Nom du dossier"
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00c2ff]"
            />
            <button
              onClick={createFolder}
              disabled={!newFolderName.trim() || creatingFolder}
              className="w-full py-2.5 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl hover:bg-[#38d0ff] transition-all disabled:opacity-50"
            >
              {creatingFolder ? 'Création...' : 'Créer le dossier'}
            </button>
          </div>
        </div>
      )}

      {/* DOWNLOAD QUALITY MODAL */}
      {showVoiceLibrary && (
        <VoiceLibraryModal
          voices={availableVoices}
          selectedId={newChannel.voice_id || selectedVoice}
          savedIds={savedVoiceIds}
          clonedIds={clonedVoiceIds}
          searchQuery={voiceSearchQuery}
          onSearchChange={setVoiceSearchQuery}
          searching={voiceSearching}
          onSelect={(voice) => setNewChannel(prev => ({ ...prev, voice_id: voice.id, voice_name: voice.name }))}
          onToggleSave={toggleSavedVoice}
          onClose={() => setShowVoiceLibrary(false)}
          onOpenCloner={() => setShowVoiceCloner(true)}
          onAddVoiceById={handleAddVoiceById}
          cloningEnabled={wizardMode === 'edit' && !!editingChannelId}
          onLoadMore={loadMoreVoices}
          loadingMore={loadingMoreVoices}
          hasMore={catalogHasMore}
        />
      )}

      {showVoiceCloner && (
        <VoiceCloneModal
          onClose={() => setShowVoiceCloner(false)}
          onSubmit={handleCloneVoice}
          submitting={cloningVoice}
        />
      )}

      {showIzivoiceKeyModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 max-w-[440px] w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Connecter ta clé Izivoice</h3>
              <button onClick={() => setShowIzivoiceKeyModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Colle ta clé API Izivoice personnelle pour retrouver ici tes voix clonées et ton historique de doublage — au lieu d'utiliser le compte partagé KappGen.
            </p>
            {izivoiceStatus?.connected && (
              <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl px-3 py-2 text-[11px] text-emerald-300">
                Clé actuellement connectée : {izivoiceStatus.key_prefix}
              </div>
            )}
            <input
              type="password"
              value={izivoiceKeyDraft}
              onChange={e => setIzivoiceKeyDraft(e.target.value)}
              placeholder="Clé API Izivoice"
              className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#00c2ff] outline-none"
            />
            <div className="flex gap-3">
              {izivoiceStatus?.connected && (
                <button onClick={handleDisconnectIzivoiceKey} className="flex-1 py-2.5 bg-rose-500/10 text-rose-400 rounded-xl font-bold text-xs hover:bg-rose-500/20 border border-rose-500/30">
                  Déconnecter
                </button>
              )}
              <button
                onClick={handleConnectIzivoiceKey}
                disabled={savingIzivoiceKey || !izivoiceKeyDraft.trim()}
                className="flex-1 py-2.5 bg-[#00c2ff] text-slate-950 rounded-xl font-bold text-xs hover:bg-[#38d0ff] disabled:opacity-50"
              >
                {savingIzivoiceKey ? 'Connexion…' : 'Connecter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renameModalVideo && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 max-w-[480px] w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#00c2ff]">drive_file_rename_outline</span> Renommer la vidéo
              </h3>
              <button onClick={closeRenameModal} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Tape ton propre titre, ou laisse l'IA t'en proposer un basé sur le script.
            </p>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Titre</label>
                <span className={`text-[10px] font-mono ${renameTitleDraft.length > 100 ? 'text-rose-400' : 'text-slate-500'}`}>{renameTitleDraft.length}/100</span>
              </div>
              <input
                value={renameTitleDraft}
                onChange={e => setRenameTitleDraft(e.target.value.slice(0, 100))}
                maxLength={100}
                autoFocus
                className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#00c2ff] outline-none"
                placeholder="Titre de la vidéo (100 caractères max)"
              />
            </div>
            <button
              onClick={regenerateTitleInModal}
              disabled={regeneratingTitleId === renameModalVideo.id}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#00c2ff]/10 text-[#00c2ff] rounded-xl font-bold text-xs hover:bg-[#00c2ff]/20 transition-colors disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${regeneratingTitleId === renameModalVideo.id ? 'animate-spin' : ''}`}>{regeneratingTitleId === renameModalVideo.id ? 'progress_activity' : 'auto_awesome'}</span>
              {regeneratingTitleId === renameModalVideo.id ? 'Génération…' : "Générer un titre avec l'IA"}
            </button>
            <div className="flex gap-3">
              <button
                onClick={closeRenameModal}
                disabled={renameSaving}
                className="flex-1 py-2.5 bg-[var(--bg-surface-alt)] text-slate-300 rounded-xl font-bold text-xs hover:bg-[var(--border-soft)] transition-colors border border-[var(--border)] disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={saveRenameTitle}
                disabled={renameSaving || !renameTitleDraft.trim()}
                className="flex-1 py-2.5 bg-[#00c2ff] text-slate-950 rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-50"
              >
                {renameSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {thumbnailModalVideo && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 max-w-[640px] w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#00c2ff]">photo_camera</span> Miniature
              </h3>
              <button onClick={() => setThumbnailModalVideo(null)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-input)]">
              <img
                src={getVideoThumbnailUrl(thumbnailModalVideo, thumbnailBust[thumbnailModalVideo.id])}
                alt="Miniature"
                className="w-full aspect-video object-cover"
              />
            </div>
            <button
              onClick={(e) => handleRegenerateCardThumbnail(thumbnailModalVideo, e)}
              disabled={regeneratingCardThumbnailIds.has(thumbnailModalVideo.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#00c2ff] text-slate-950 rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${regeneratingCardThumbnailIds.has(thumbnailModalVideo.id) ? 'animate-spin' : ''}`}>{regeneratingCardThumbnailIds.has(thumbnailModalVideo.id) ? 'progress_activity' : 'refresh'}</span>
              {regeneratingCardThumbnailIds.has(thumbnailModalVideo.id) ? 'Régénération…' : 'Régénérer la miniature'}
            </button>
          </div>
        </div>
      )}

      {publishReviewVideo && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 max-w-[520px] w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <YouTubeIcon className="w-5 h-3.5" /> Publier sur YouTube
              </h3>
              <button
                onClick={() => { if (!publishingVideoId) setPublishReviewVideo(null); }}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              L'IA a déjà préparé un titre et une description prêts à publier — relis-les et modifie-les si besoin avant de mettre la vidéo en ligne.
            </p>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Titre YouTube</label>
                <span className={`text-[10px] font-mono ${publishTitleDraft.length > 100 ? 'text-rose-400' : 'text-slate-500'}`}>{publishTitleDraft.length}/100</span>
              </div>
              <input
                value={publishTitleDraft}
                onChange={e => setPublishTitleDraft(e.target.value.slice(0, 100))}
                maxLength={100}
                className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#00c2ff] outline-none"
                placeholder="Titre de la vidéo (100 caractères max)"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Description</label>
              <textarea
                value={publishDescriptionDraft}
                onChange={e => setPublishDescriptionDraft(e.target.value)}
                className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-xs text-white focus:border-[#00c2ff] outline-none min-h-[140px]"
                placeholder="Description de la vidéo..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPublishReviewVideo(null)}
                disabled={!!publishingVideoId}
                className="flex-1 py-2.5 bg-[var(--bg-surface-alt)] text-slate-300 rounded-xl font-bold text-xs hover:bg-[var(--border-soft)] transition-colors border border-[var(--border)] disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmPublishYouTube}
                disabled={!!publishingVideoId || !publishTitleDraft.trim()}
                className="flex-1 py-2.5 bg-[#00c2ff] text-slate-950 rounded-xl font-bold text-xs hover:bg-[#38d0ff] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {publishingVideoId ? (
                  <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Publication…</>
                ) : (
                  <><YouTubeIcon className="w-4 h-3" /> Publier</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {downloadModalVideo && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 max-w-[420px] w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Télécharger la vidéo</h3>
              <button
                onClick={() => { if (!downloadingQuality) setDownloadModalVideo(null); }}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">Format MP4. Choisissez la qualité d'export — la miniature se télécharge automatiquement avec la vidéo.</p>

            <div className="space-y-2.5">
              {[
                { key: 'sd', label: 'SD', detail: '854×480 — fichier léger, partage rapide' },
                { key: 'hd', label: 'HD', detail: '1920×1080 — qualité native du rendu' },
              ].map(opt => (
                <button
                  key={opt.key}
                  disabled={!!downloadingQuality}
                  onClick={() => runDownload(downloadModalVideo, opt.key)}
                  className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-alt)] hover:bg-[var(--border-soft)] border border-[var(--border)] rounded-2xl transition-all disabled:opacity-50 text-left"
                >
                  <div>
                    <div className="text-xs font-bold text-white">{opt.label}</div>
                    <div className="text-[11px] text-slate-400">{opt.detail}</div>
                  </div>
                  {downloadingQuality === opt.key ? (
                    <span className="material-symbols-outlined text-[18px] text-[#00c2ff] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px] text-[#00c2ff]">download</span>
                  )}
                </button>
              ))}
              <button
                disabled={!!downloadingQuality}
                onClick={() => runThumbnailDownload(downloadModalVideo)}
                className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-alt)] hover:bg-[var(--border-soft)] border border-dashed border-[var(--border)] rounded-2xl transition-all disabled:opacity-50 text-left"
              >
                <div>
                  <div className="text-xs font-bold text-white">Miniature seule</div>
                  <div className="text-[11px] text-slate-400">JPG — pour publier manuellement ailleurs</div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-[#00c2ff]">image</span>
              </button>
            </div>
          </div>
        </div>
      )}

      </>)}

      {/* FULL-PAGE AUTHENTICATION */}
      {(showAuthModal || isAuthRoute) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg-page)] text-white">
          <div className="absolute inset-0 bg-[url('/assets/backgrounds/nichecut-abstract-tech.webp')] bg-cover bg-center opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-page)] via-[var(--bg-page)]/90 to-[var(--bg-page)]/70" />
          <div className="relative min-h-screen grid lg:grid-cols-[1.05fr_.95fr]">
            <section className="hidden lg:flex min-h-screen flex-col justify-between px-12 xl:px-20 py-10">
              <div className="flex items-center justify-between">
                <a href={MARKETING_ORIGIN} className="flex items-center gap-3 text-white no-underline">
                  <img src="/assets/logo/logo-kappgen.png" alt="KappGen" className="w-10 h-10 object-contain" />
                  <span className="text-xl font-extrabold tracking-tight">KappGen</span>
                </a>
                <a href={MARKETING_ORIGIN} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold tracking-[.14em] text-slate-300 no-underline hover:border-[#00c2ff]/40 hover:text-white transition-all">
                  <span className="material-symbols-outlined text-[15px]">arrow_back</span> RETOUR AU SITE
                </a>
              </div>

              <div className="max-w-[650px] py-16">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00c2ff]/20 bg-[#00c2ff]/5 px-3 py-2 text-[10px] font-bold tracking-[.14em] text-[#65dcff] mb-7">
                  <span className="material-symbols-outlined text-[15px]">smart_toy</span> KAPPGEN AI · ACTIF 24 H/24
                </div>
                <h1 className="text-[clamp(3.2rem,5.6vw,6.2rem)] leading-[.96] tracking-[-.06em] font-extrabold m-0">
                  Tu dors.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#67e1ff] via-[#22bfff] to-[#8484ff]">Ta chaîne avance.</span>
                </h1>
                <p className="mt-7 max-w-xl text-base xl:text-lg leading-8 text-slate-400">
                  Configure le style de ta chaîne une fois. Nous avons travaillé KappGen AI à partir des réalités du terrain YouTube pour créer des vidéos originales, authentiques et pensées pour respecter les règles de la plateforme.
                </p>
                <div className="mt-9 grid sm:grid-cols-3 gap-2 max-w-2xl">
                  {[
                    ['lightbulb', 'Idées trouvées'],
                    ['movie_edit', 'Vidéos créées'],
                    ['publish', 'YouTube publié'],
                  ].map(([icon, label]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[.035] px-4 py-4 text-xs font-bold text-slate-300 flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-[#38d0ff]">{icon}</span>{label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="material-symbols-outlined text-[15px] text-emerald-400">verified_user</span>
                © {new Date().getFullYear()} KappGen · Connexion sécurisée
              </div>
            </section>

            <section className="min-h-screen flex items-center justify-center px-5 py-10 sm:px-10">
              <div className="w-full max-w-[470px]">
                <div className="lg:hidden flex items-center justify-between mb-8">
                  <a href={MARKETING_ORIGIN} className="flex items-center gap-2 text-white no-underline font-extrabold">
                    <img src="/assets/logo/logo-kappgen.png" alt="KappGen" className="w-9 h-9 object-contain" /> KappGen
                  </a>
                  <a href={MARKETING_ORIGIN} className="text-xs text-slate-400 no-underline">Retour au site</a>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[var(--bg-surface)]/95 backdrop-blur-xl p-6 sm:p-9 shadow-[0_35px_100px_rgba(0,0,0,.24)]">
                  <div className="mb-7">
                    <p className="text-[10px] font-bold tracking-[.16em] text-[#44d2ff] uppercase mb-3">
                      {authTab === 'register' ? 'Créer ton espace' : authTab === 'forgot' ? 'Récupérer ton accès' : 'Content de te revoir'}
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-.04em] m-0">
                      {authTab === 'register' ? 'Lance KappGen AI.' : authTab === 'forgot' ? 'Nouveau mot de passe.' : 'Content de te revoir.'}
                    </h2>
                    <p className="text-sm text-slate-400 mt-3 mb-0">
                      {authTab === 'register' ? 'Configure ta première chaîne, puis va vivre. KappGen reste au travail.' : authTab === 'forgot' ? 'Choisis un nouveau mot de passe pour ton compte.' : 'KappGen AI a continué pendant ton absence.'}
                    </p>
                  </div>

                  {authTab !== 'forgot' && (
                    <div className="grid grid-cols-2 bg-[var(--bg-deep)] p-1 rounded-xl border border-white/10 mb-6">
                      <button type="button" onClick={() => navigate('/login', { replace: true, state: location.state })} className={`py-2.5 text-xs font-bold rounded-lg transition-all ${authTab === 'login' ? 'bg-[var(--bg-hover)] text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>Connexion</button>
                      <button type="button" onClick={() => navigate('/signup', { replace: true, state: location.state })} className={`py-2.5 text-xs font-bold rounded-lg transition-all ${authTab === 'register' ? 'bg-[var(--bg-hover)] text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>Inscription</button>
                    </div>
                  )}

                  {authTab === 'forgot' ? (
                    <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-2">Adresse email</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-slate-500">mail</span>
                          <input type="email" required disabled={forgotStep === 'verify'} value={forgotForm.email} onChange={e => setForgotForm({ ...forgotForm, email: e.target.value })} className="w-full bg-[var(--bg-deep)] border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white focus:border-[#00c2ff] outline-none disabled:text-slate-500" placeholder="nom@exemple.com" />
                        </div>
                      </div>
                      {forgotStep === 'verify' && <>
                        <div>
                          <div className="flex items-center justify-between mb-2"><label className="block text-[11px] font-bold text-slate-300">Code reçu par email</label><button type="button" onClick={() => { setForgotStep('request'); setResetCode(''); }} className="text-[10px] text-[#42d2ff] hover:underline">Modifier l’email</button></div>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-slate-500">pin</span>
                            <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full bg-[var(--bg-deep)] border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-lg tracking-[.45em] font-bold text-white focus:border-[#00c2ff] outline-none" placeholder="000000" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-2">Nouveau mot de passe</label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-slate-500">lock</span>
                            <input type={showAuthPassword ? 'text' : 'password'} required minLength={8} value={forgotForm.newPassword} onChange={e => setForgotForm({ ...forgotForm, newPassword: e.target.value })} className="w-full bg-[var(--bg-deep)] border border-white/10 rounded-xl pl-12 pr-12 py-3.5 text-sm text-white focus:border-[#00c2ff] outline-none" placeholder="8 caractères minimum" />
                            <button type="button" onClick={() => setShowAuthPassword(!showAuthPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" tabIndex={-1}><span className="material-symbols-outlined text-[18px]">{showAuthPassword ? 'visibility_off' : 'visibility'}</span></button>
                          </div>
                        </div>
                      </>}
                      <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-[#65e0ff] to-[#1a9cff] text-[var(--bg-deep)] font-extrabold text-xs rounded-xl hover:brightness-110 transition-all disabled:opacity-50">{loading ? 'Chargement...' : forgotStep === 'request' ? 'Recevoir mon code' : 'Réinitialiser le mot de passe'}</button>
                      <button type="button" onClick={() => { setForgotStep('request'); setResetCode(''); setAuthTab('login'); }} className="w-full text-center text-xs text-slate-400 hover:text-white font-medium">← Retour à la connexion</button>
                    </form>
                  ) : (
                    <>
                      <form onSubmit={handleAuthSubmit} className="space-y-5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-2">Adresse email</label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-slate-500">mail</span>
                            <input type="email" required value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} className="w-full bg-[var(--bg-deep)] border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white focus:border-[#00c2ff] outline-none placeholder-slate-500" placeholder="nom@exemple.com" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-[11px] font-bold text-slate-300">Mot de passe</label>
                            {authTab === 'login' && <button type="button" onClick={() => { setForgotForm({ email: authForm.email, newPassword: '' }); setForgotStep('request'); setResetCode(''); setAuthTab('forgot'); }} className="text-[10px] text-[#42d2ff] hover:underline font-bold">Mot de passe oublié ?</button>}
                          </div>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-slate-500">lock</span>
                            <input type={showAuthPassword ? 'text' : 'password'} required minLength={authTab === 'register' ? 8 : undefined} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} className="w-full bg-[var(--bg-deep)] border border-white/10 rounded-xl pl-12 pr-12 py-3.5 text-sm text-white focus:border-[#00c2ff] outline-none" placeholder="••••••••" />
                            <button type="button" onClick={() => setShowAuthPassword(!showAuthPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" tabIndex={-1}><span className="material-symbols-outlined text-[18px]">{showAuthPassword ? 'visibility_off' : 'visibility'}</span></button>
                          </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-[#65e0ff] to-[#1a9cff] text-[var(--bg-deep)] font-extrabold text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#00c2ff]/10 disabled:opacity-50 flex items-center justify-center gap-2">
                          {loading ? 'Chargement...' : authTab === 'register' ? 'Reprendre mon temps' : 'Se connecter'} <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
                        </button>
                      </form>

                      <div className="flex items-center gap-3 my-6"><div className="h-px bg-white/10 flex-1" /><span className="text-[9px] text-slate-600 font-bold tracking-widest">OU CONTINUER AVEC</span><div className="h-px bg-white/10 flex-1" /></div>
                      {GOOGLE_CLIENT_ID ? <div ref={googleButtonRef} className="w-full max-w-full flex justify-center items-center min-h-[44px] overflow-hidden rounded-xl" /> : <div className="w-full py-3 bg-[var(--bg-deep)] text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center border border-white/10">Connexion Google indisponible</div>}

                      <p className="text-center text-xs text-slate-500 mt-6 mb-0">
                        {authTab === 'login' ? 'Pas encore de compte ?' : 'Tu as déjà un compte ?'}{' '}
                        <button type="button" onClick={() => navigate(authTab === 'login' ? '/signup' : '/login', { replace: true, state: location.state })} className="text-[#55d8ff] font-bold hover:underline">{authTab === 'login' ? 'Commencer à vivre autrement' : 'Se connecter'}</button>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}


      {showPricingModal && (
        <PricingModal
          onClose={() => setShowPricingModal(false)}
          plans={billingPlans}
          subscription={billingSubscription}
          checkoutPlanId={checkoutPlanId}
          onSelectPlan={setPaymentPlan}
          loading={billingLoading}
        />
      )}

      {paymentPlan && (
        <PaymentModal
          plan={paymentPlan}
          onClose={() => setPaymentPlan(null)}
          onCheckout={startCheckout}
          checkingOut={checkoutPlanId === paymentPlan.id}
        />
      )}

      {/* CHANNEL PICKER MODAL (when Nouvelle Vidéo clicked without active channel preset) */}
      {showChannelPickerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-8 max-w-[480px] w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-[var(--border-soft)] pb-4">
              <h3 className="text-base font-extrabold text-white">Choisir une chaîne pour la vidéo</h3>
              <button onClick={() => setShowChannelPickerModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {productChannels.map(chan => (
                <div
                  key={chan.id}
                  onClick={() => {
                    setShowChannelPickerModal(false);
                    startNewVideoFor(chan);
                  }}
                  className="p-4 bg-[var(--bg-surface-alt)] hover:bg-[var(--border-soft)] border border-[var(--border)] rounded-2xl cursor-pointer flex items-center gap-4 transition-all"
                >
                  <img
                    src={getChannelLogoUrl(chan)}
                    alt=""
                    className="w-10 h-10 rounded-xl object-cover shrink-0 bg-[var(--bg-surface-alt)]"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white">{chan.name}</h4>
                    <p className="text-xs text-slate-400">{chan.niche}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCRIPT STRUCTURE MODAL — pulled out of the wizard step into a popup so
          configuring the auto-script structure doesn't force scrolling through
          a long inline form. */}
      {showScriptStructureModal && (() => {
        const structure = newChannel.script_structure || defaultChannelForm.script_structure;
        const updateStructure = (patch) => setNewChannel({ ...newChannel, script_structure: { ...structure, ...patch } });
        const parts = structure.parts || [];
        const updatePart = (idx, patch) => {
          const next = parts.map((p, i) => i === idx ? { ...p, ...patch } : p);
          updateStructure({ parts: next });
        };
        const addPart = () => updateStructure({ parts: [...parts, { name: `part_${parts.length + 1}`, word_count: 300, guidance: '' }] });
        const removePart = (idx) => updateStructure({ parts: parts.filter((_, i) => i !== idx) });
        // Swaps each part's guidance to match the newly selected script
        // language, re-matched by part name so custom part names/word counts
        // are untouched. Only English/Français have translated guidance text
        // (see SCRIPT_STRUCTURE_DEFAULTS) — any other language keeps whatever
        // guidance was already there, since Claude understands meta-instructions
        // in any language regardless of the script's own output language.
        const applyLanguageToParts = (languageValue) => {
          const translated = SCRIPT_STRUCTURE_DEFAULTS[languageValue]?.parts;
          if (!translated) return parts;
          return parts.map(p => {
            const match = translated.find(tp => tp.name === p.name);
            return match ? { ...p, guidance: match.guidance } : p;
          });
        };
        const totalWords = parts.reduce((sum, p) => sum + (Number(p.word_count) || 0), 0);
        const rulesText = (structure.formatting_rules || []).join('\n');

        // Lets the creator paste one full block of instructions/script text
        // instead of filling each part by hand — the AI splits it across the
        // existing parts (matched by name) and we apply the resulting
        // guidance in one shot.
        const analyzePastedText = async () => {
          if (!scriptStructurePasteText.trim() || parts.length === 0) return;
          setScriptStructureAnalyzing(true);
          setScriptStructureAnalyzeError('');
          try {
            const res = await authFetch(`${API_BASE}/channels/analyze-script-structure`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: scriptStructurePasteText, parts }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.detail || "L'analyse a échoué.");
            updateStructure({ parts: body.parts });
          } catch (err) {
            setScriptStructureAnalyzeError(err.message || "L'analyse a échoué, réessaie.");
          } finally {
            setScriptStructureAnalyzing(false);
          }
        };

        return (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[120] flex items-center justify-center p-4 sm:p-6" onClick={() => setShowScriptStructureModal(false)}>
            <div className="bg-[#111822] border border-[#293548] rounded-3xl w-full max-w-7xl shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
              <div className="p-6 sm:p-8 border-b border-[var(--border-soft)] flex items-start justify-between gap-4 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2 text-[#59d8ff] mb-1">
                    <span className="material-symbols-outlined text-[20px]">description</span>
                    <span className="text-[10px] font-bold uppercase tracking-[.16em]">Génération automatique</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-white">Structure du script auto-généré</h3>
                  <p className="text-xs text-slate-400 mt-1">~{totalWords} mots au total, répartis sur {parts.length} parties.</p>
                </div>
                <button onClick={() => setShowScriptStructureModal(false)} className="text-slate-400 hover:text-white p-1 shrink-0">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="overflow-y-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="flex flex-col space-y-4 min-h-[520px]">
                <div className="flex items-center gap-2 text-[#59d8ff]">
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  <label className="text-[13px] font-bold text-white">Import automatique depuis un texte complet</label>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Colle ici tes instructions ou ton script complet — l'IA l'analysera et répartira le contenu dans les parties à droite ({parts.length} partie{parts.length > 1 ? 's' : ''} : {parts.map(p => p.name).filter(Boolean).join(', ') || '—'}), pour t'éviter de tout recopier à la main.
                </p>
                <textarea
                  value={scriptStructurePasteText}
                  onChange={e => setScriptStructurePasteText(e.target.value)}
                  placeholder="Colle ici le texte complet (script, notes, brief...)"
                  className="w-full flex-1 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white leading-relaxed focus:border-[#00c2ff] outline-none min-h-[420px] resize-none"
                />
                {scriptStructureAnalyzeError && (
                  <p className="text-[11px] text-red-400">{scriptStructureAnalyzeError}</p>
                )}
                <button
                  type="button"
                  onClick={analyzePastedText}
                  disabled={scriptStructureAnalyzing || !scriptStructurePasteText.trim() || parts.length === 0}
                  className="w-full py-3 bg-[#00c2ff]/10 border border-[#00c2ff]/40 text-[#59d8ff] font-bold text-sm rounded-xl hover:bg-[#00c2ff]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-shrink-0"
                >
                  {scriptStructureAnalyzing ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                      Analyser et remplir les parties
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col space-y-5 lg:border-l lg:border-[var(--border-soft)] lg:pl-10">
                <p className="text-[10px] text-slate-500 -mb-1">Renseigne l'un ou l'autre pour la longueur — les parties ci-dessous sont réparties automatiquement au prorata pour atteindre ce total.</p>
                <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Langue du script</label>
                  <button
                    type="button"
                    onClick={() => { setLanguageSearch(''); setShowLanguageModal(o => !o); }}
                    className={`w-full bg-[var(--bg-surface-alt)] border rounded-lg px-3 py-2.5 text-xs text-white transition-colors flex items-center justify-between gap-3 ${showLanguageModal ? 'border-[#00c2ff]' : 'border-[var(--border)] hover:border-[#00c2ff]/60'}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[17px] text-[#00c2ff]">language</span>
                      <span className="truncate">{SCRIPT_LANGUAGES.find(lang => lang.value === (structure.language || 'English'))?.label || structure.language || 'English'}</span>
                    </span>
                    <span className={`material-symbols-outlined text-[18px] text-slate-500 transition-transform ${showLanguageModal ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {showLanguageModal && (() => {
                    const query = languageSearch.trim().toLocaleLowerCase();
                    const filteredLanguages = SCRIPT_LANGUAGES.filter(lang =>
                      !query || `${lang.label} ${lang.value} ${lang.code}`.toLocaleLowerCase().includes(query)
                    );
                    const selectedLanguage = structure.language || 'English';
                    return (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--bg-dropdown)] border border-[var(--border-dropdown)] rounded-xl shadow-2xl z-30 overflow-hidden">
                        <div className="p-2 border-b border-[var(--border-dropdown)]">
                          <input
                            autoFocus
                            value={languageSearch}
                            onChange={e => setLanguageSearch(e.target.value)}
                            placeholder="Rechercher : français, Hindi, العربية…"
                            className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-[#00c2ff] outline-none"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto py-1">
                          {filteredLanguages.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-6">Aucune langue trouvée.</p>
                          ) : filteredLanguages.map(lang => {
                            const active = selectedLanguage === lang.value;
                            return (
                              <button
                                key={lang.code}
                                type="button"
                                onClick={() => {
                                  // Changes the language the AI writes the script IN, and — when a
                                  // translated set exists for it (English/Français) — also swaps the
                                  // part guidance shown below to match, so the two never drift apart.
                                  updateStructure({ language: lang.value, parts: applyLanguageToParts(lang.value) });
                                  setShowLanguageModal(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between gap-2 ${active ? 'text-[#00c2ff] font-bold' : 'text-slate-300'}`}
                              >
                                <span className="truncate">{lang.label}{lang.label !== lang.value ? ` — ${lang.value}` : ''}</span>
                                {active && <span className="material-symbols-outlined text-[14px] shrink-0">check</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Longueur (caractères)</label>
                  <input
                    type="number"
                    min="0"
                    value={wordsToChars(totalWords)}
                    onChange={e => updateStructure({ parts: redistributePartsToTotal(parts, charsToWords(parseInt(e.target.value) || 0)) })}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg px-3 py-2.5 pr-20 text-xs text-white focus:border-[#00c2ff] outline-none"
                  />
                  <span className="absolute right-3 bottom-2.5 text-[10px] text-slate-500 font-bold">caractères</span>
                </div>
                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Longueur (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={Math.round(wordsToMinutes(totalWords) * 10) / 10}
                    onChange={e => updateStructure({ parts: redistributePartsToTotal(parts, minutesToWords(parseFloat(e.target.value) || 0)) })}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg px-3 py-2.5 pr-16 text-xs text-white focus:border-[#00c2ff] outline-none"
                  />
                  <span className="absolute right-3 bottom-2.5 text-[10px] text-slate-500 font-bold">minutes</span>
                </div>
                </div>

                {/* Cost preview — what generating a script of this length will actually
                    charge (real Claude API spend, marked up), so the creator knows the
                    price before they commit instead of finding out after generation. */}
                <div className="flex items-center gap-2.5 bg-[#00c2ff]/[0.06] border border-[#00c2ff]/25 rounded-xl px-3.5 py-2.5">
                  <span className="material-symbols-outlined text-[#59d8ff] text-[18px] shrink-0">toll</span>
                  {scriptCostLoading || !scriptCostEstimate ? (
                    <span className="text-[11px] text-slate-400">Estimation du coût...</span>
                  ) : (
                    <span className="text-[11px] text-slate-300">
                      Coût de génération : <span className="font-bold text-white">{scriptCostEstimate.credits.toLocaleString()} crédits</span>
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-300">Parties du script</label>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold pr-11">Mots</span>
                  </div>
                  {parts.map((part, idx) => (
                    <div key={idx} className="border border-[var(--border)] rounded-xl p-4 space-y-3 bg-[var(--bg-surface-alt)]">
                      <div className="flex items-center gap-2">
                        <input
                          value={part.name || ''}
                          onChange={e => updatePart(idx, { name: e.target.value })}
                          className="flex-1 bg-[var(--bg-input-alt)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                          placeholder="Nom de la partie (interne)"
                        />
                        <input
                          type="number"
                          min="20"
                          value={part.word_count ?? 300}
                          onChange={e => updatePart(idx, { word_count: parseInt(e.target.value) || 0 })}
                          className="w-24 bg-[var(--bg-input-alt)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                          placeholder="Mots"
                        />
                        <button type="button" onClick={() => removePart(idx)} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10">
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                      <textarea
                        value={part.guidance || ''}
                        onChange={e => updatePart(idx, { guidance: e.target.value })}
                        className="w-full bg-[var(--bg-input-alt)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-white leading-relaxed focus:border-[#00c2ff] outline-none min-h-[70px]"
                        placeholder="Ce que cette partie doit couvrir..."
                      />
                    </div>
                  ))}
                  <button type="button" onClick={addPart} className="text-xs font-bold text-[#00c2ff] hover:underline">
                    + Ajouter une partie
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Règles de formatage (une par ligne)</label>
                  <textarea
                    value={rulesText}
                    onChange={e => updateStructure({ formatting_rules: e.target.value.split('\n').map(r => r.trim()).filter(Boolean) })}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-xs text-white leading-relaxed focus:border-[#00c2ff] outline-none min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Style d'appel à l'action</label>
                  <textarea
                    value={structure.cta_style || ''}
                    onChange={e => updateStructure({ cta_style: e.target.value })}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-xs text-white leading-relaxed focus:border-[#00c2ff] outline-none min-h-[70px]"
                  />
                </div>
              </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-[var(--border-soft)] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowScriptStructureModal(false)}
                  className="w-full py-3 bg-[#00c2ff] text-slate-950 font-bold text-sm rounded-xl hover:bg-[#38d0ff] transition-all"
                >
                  Terminé
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* COST RECAP — shown right after a video finishes rendering, itemizing
          exactly what it cost in credits (transcription, images, base render
          fee...) so a creator never wonders why their balance moved. */}
      {costRecap && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[130] flex items-center justify-center p-6" onClick={() => setCostRecap(null)}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-[#59d8ff]">
                <span className="material-symbols-outlined text-[20px]">toll</span>
                <span className="text-[10px] font-bold uppercase tracking-[.16em]">Coût de la vidéo</span>
              </div>
              <button onClick={() => setCostRecap(null)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-sm font-bold text-white truncate">{costRecap.videoTitle}</p>
            <div className="space-y-1.5">
              {costRecap.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-slate-400 truncate">{item.description}</span>
                  <span className="text-slate-300 font-bold shrink-0">{item.credits.toLocaleString()} cr.</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-soft)]">
              <span className="text-xs font-bold text-slate-300">Total</span>
              <span className="text-base font-extrabold text-white">{costRecap.total_credits.toLocaleString()} crédits</span>
            </div>
            <button onClick={() => setCostRecap(null)} className="w-full py-2.5 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl">
              Compris
            </button>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION — rendered via a portal straight onto <body>,
          not wherever this component happens to sit in the tree. Any
          transformed/scaled ancestor (e.g. a modal's open/close animation)
          turns `position: fixed` into "relative to that ancestor" instead of
          the viewport, which is what put this in a random corner instead of
          its intended spot. Top-center also keeps it clear of the sidebar. */}
      {toast && createPortal(
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border max-w-md ${
            toast.type === 'error'
              ? 'bg-rose-950 border-rose-800 text-rose-200'
              : 'bg-emerald-950 border-emerald-800 text-emerald-200'
          }`}>
            <span className="material-symbols-outlined text-[20px]">
              {toast.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {fontPickerOpen && (() => {
        const query = fontSearchQuery.trim().toLowerCase();
        const filtered = SUBTITLE_FONTS.filter(f => !query || f.label.toLowerCase().includes(query) || f.group.toLowerCase().includes(query));
        const groups = [];
        for (const f of filtered) {
          const lastGroup = groups[groups.length - 1];
          if (lastGroup && lastGroup.name === f.group) lastGroup.fonts.push(f);
          else groups.push({ name: f.group, fonts: [f] });
        }
        return (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[110] flex items-center justify-center p-6" onClick={() => setFontPickerOpen(false)}>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-[var(--border-soft)] space-y-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">Choisir une police</h3>
                  <button onClick={() => setFontPickerOpen(false)} className="text-slate-400 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">search</span>
                  <input
                    autoFocus
                    value={fontSearchQuery}
                    onChange={e => setFontSearchQuery(e.target.value)}
                    placeholder="Rechercher une police..."
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-[#00c2ff] outline-none"
                  />
                </div>
              </div>
              <div className="overflow-y-auto p-3 space-y-4">
                {filtered.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-8">Aucune police ne correspond à "{fontSearchQuery}".</p>
                )}
                {groups.map(group => (
                  <div key={group.name}>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1.5">{group.name}</div>
                    <div className="space-y-1">
                      {group.fonts.map(f => {
                        const isActive = newChannel.subtitle_style.font === f.value;
                        return (
                          <button
                            key={f.value}
                            type="button"
                            onClick={() => {
                              setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, font: f.value } });
                              setFontPickerOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                              isActive ? 'bg-[#00c2ff]/10 border border-[#00c2ff]' : 'hover:bg-[var(--bg-surface-alt)] border border-transparent'
                            }`}
                          >
                            <span style={{ fontFamily: f.value }} className={`text-base ${isActive ? 'text-[#00c2ff]' : 'text-white'}`}>
                              {f.label}
                            </span>
                            {isActive && <span className="material-symbols-outlined text-[18px] text-[#00c2ff]">check</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-3xl p-7 max-w-[420px] w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${confirmDialog.danger ? 'bg-rose-950 text-rose-300' : 'bg-[var(--bg-surface-alt)] text-[#00c2ff]'}`}>
                <span className="material-symbols-outlined text-[20px]">{confirmDialog.danger ? 'warning' : 'help'}</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">{confirmDialog.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => resolveConfirm(false)}
                className="px-4 py-2.5 bg-[var(--bg-surface-alt)] text-slate-300 border border-[var(--border)] rounded-xl font-bold text-xs hover:bg-[var(--border-soft)] transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => resolveConfirm(true)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  confirmDialog.danger
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'bg-[#00c2ff] text-slate-950 hover:bg-[#38d0ff]'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
