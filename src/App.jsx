import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

const getOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '');
const isLocalhost = getOrigin().includes('localhost') || getOrigin().includes('127.0.0.1');

let rawApiBase = import.meta.env.VITE_API_BASE || (isLocalhost ? `${getOrigin()}/api` : "https://api-nichecut.tools-cl.com/api");
if (rawApiBase.startsWith("http://api-nichecut.tools-cl.com")) {
  rawApiBase = rawApiBase.replace("http://", "https://");
}
const API_BASE = rawApiBase;

let rawStorageBase = import.meta.env.VITE_STORAGE_BASE || (isLocalhost ? `${getOrigin()}/storage` : "https://api-nichecut.tools-cl.com/storage");
if (rawStorageBase.startsWith("http://api-nichecut.tools-cl.com")) {
  rawStorageBase = rawStorageBase.replace("http://", "https://");
}
const STORAGE_BASE = rawStorageBase;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// Human-readable URL slug derived from a channel name, e.g. "Riviere de Grace" -> "riviere-de-grace".
// Purely a display/routing convenience — the channel's real id is still what's sent to the API.
const slugifyChannelName = (name) =>
  (name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'chaine';

const getVideoUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.replace(/^(\.nichecut-storage\/|storage\/|\/)+/, '');
  return `${STORAGE_BASE}/${cleanPath}`;
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
const VOICE_MODELS = [
  { id: 'fr-FR-Thomas', name: 'Thomas — Voix Stoïque & Profonde', lang: 'fr-FR', desc: 'Idéal pour philosophie, citations et stoïcisme' },
  { id: 'fr-FR-Elodie', name: 'Élodie — Narrative Éléganter', lang: 'fr-FR', desc: 'Idéal pour récits historiques et contes' },
  { id: 'fr-FR-Nicolas', name: 'Nicolas — Voix Grave & Envoûtante', lang: 'fr-FR', desc: 'Idéal pour spiritualité et méditations guidées' },
  { id: 'fr-FR-Claire', name: 'Claire — Douce & Inspirante', lang: 'fr-FR', desc: 'Idéal pour développement personnel' }
];

// Custom video player styled to match the app's dark/cyan design, replacing native browser controls.
function VideoPlayer({ src, autoPlay, className }) {
  const videoRef = useRef(null);
  const seekBarRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(!!autoPlay);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const togglePlay = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); } else { v.pause(); setIsPlaying(false); }
  };

  const seekToClientX = (clientX) => {
    const v = videoRef.current;
    const bar = seekBarRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const t = pct * duration;
    v.currentTime = t;
    setCurrentTime(t);
    setProgress(pct * 100);
  };

  // Native onClick only fires on mouse-up-without-move, so dragging the
  // thumb previously did nothing until release — felt "stuck". Track the
  // drag on window so it keeps following the cursor outside the bar too.
  const startScrub = (e) => {
    e.stopPropagation();
    setIsScrubbing(true);
    seekToClientX(e.clientX);
  };

  useEffect(() => {
    if (!isScrubbing) return;
    const onMove = (e) => seekToClientX(e.clientX);
    const onUp = () => setIsScrubbing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrubbing, duration]);

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

  return (
    <div className={`relative bg-black ${className || ''}`} onClick={(e) => e.stopPropagation()}>
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        onClick={togglePlay}
        onTimeUpdate={(e) => { setCurrentTime(e.target.currentTime); setProgress(e.target.duration ? (e.target.currentTime / e.target.duration) * 100 : 0); }}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Custom controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pt-8 pb-2 pointer-events-none">
        <div className="pointer-events-auto">
          <div
            ref={seekBarRef}
            onMouseDown={startScrub}
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-2 group/seek select-none"
          >
            <div className={`h-full bg-[#00c2ff] rounded-full relative ${isScrubbing ? '' : 'transition-[width]'}`} style={{ width: `${progress}%` }}>
              <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#00c2ff] rounded-full shadow-md transition-opacity ${isScrubbing ? 'opacity-100' : 'opacity-0 group-hover/seek:opacity-100'}`}></div>
            </div>
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
        className="flex items-center gap-2 bg-[#1b2230] border border-[#2b374d] hover:border-[#00c2ff] rounded-xl px-2.5 py-2 transition-colors"
      >
        <span
          className="w-6 h-6 rounded-lg border border-white/20 flex-shrink-0"
          style={isNone ? { backgroundImage: 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)' } : { backgroundColor: value || '#FFFFFF' }}
        />
        <span className="text-xs font-mono text-slate-300">{isNone ? 'Aucune' : (value || '#FFFFFF').toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 mt-2 w-56 bg-[#1f2838] border border-[#2d3a52] rounded-xl shadow-2xl p-3 space-y-3">
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
              className="flex-1 min-w-0 bg-[#1b2230] border border-[#2b374d] rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:border-[#00c2ff] outline-none"
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
    <div className="rounded-xl border border-[#2b374d] bg-[#11151c] p-3" onClick={(event) => event.stopPropagation()}>
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
            className="shrink-0 w-7 h-7 rounded-full bg-[#1b2230] hover:bg-rose-950 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors"
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
    <div className="rounded-xl border border-[#2b374d] bg-[#11151c] p-3" onClick={(event) => event.stopPropagation()}>
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
            className="shrink-0 w-7 h-7 rounded-full bg-[#1b2230] hover:bg-rose-950 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Renders a channel's logo as a rounded-square avatar, or the NicheCut icon
// if no logo is set. Falls back to the NicheCut icon automatically if the
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
async function readImagesFromDirHandle(dirHandle) {
  const files = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file" && /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(entry.name)) {
      const file = await entry.getFile();
      files.push(file);
    }
  }
  return files;
}

function ChannelAvatar({ channel, logoUrl, sizeClass = "w-12 h-12", roundedClass = "rounded-xl", textClass = "text-lg" }) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) {
    return (
      <div className={`${sizeClass} ${roundedClass} bg-gradient-to-tr from-[#004c66] to-[#007f99] flex items-center justify-center flex-shrink-0 border border-[#00c2ff]/30 shadow-md p-2`}>
        <img src="/assets/logo/logo-nichecut.png" alt="NicheCut" className="w-full h-full object-contain" />
      </div>
    );
  }
  return (
    <img
      src={logoUrl}
      alt={channel?.name}
      onError={() => setFailed(true)}
      className={`${sizeClass} ${roundedClass} object-cover border border-[#2b374d] flex-shrink-0 shadow-md`}
    />
  );
}

function SkeletonGrid({ count = 6, cardClassName = "min-h-[220px]" }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`bg-[#161b22] border border-[#263042] rounded-2xl p-5 animate-pulse ${cardClassName}`}>
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#232c3a]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 bg-[#232c3a] rounded" />
              <div className="h-2.5 w-1/3 bg-[#232c3a] rounded" />
            </div>
          </div>
          <div className="h-2.5 w-full bg-[#232c3a] rounded mb-2" />
          <div className="h-2.5 w-5/6 bg-[#232c3a] rounded mb-4" />
          <div className="h-8 w-full bg-[#232c3a] rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function viewFromPath(path) {
  if (path === '/channels') return 'channels';
  if (path === '/videos') return 'videos';
  if (path === '/channels/new') return 'wizard';
  if (/^\/channels\/[^/]+\/edit$/.test(path)) return 'wizard';
  if (/^\/channels\/[^/]+$/.test(path)) return 'channel_detail';
  return 'home';
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [channels, setChannels] = useState([]);
  const [nicheOptions, setNicheOptions] = useState(NICHE_OPTIONS);
  const [activeChannel, setActiveChannel] = useState(null);
  const [channelVideos, setChannelVideos] = useState([]);
  const [allVideos, setAllVideos] = useState([]);
  const [view, setView] = useState(() => viewFromPath(window.location.pathname)); // 'home', 'channels', 'videos', 'channel_detail', 'wizard'
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [channelsLoadError, setChannelsLoadError] = useState('');
  const [videosLoadError, setVideosLoadError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  // Modals & Menu Popups
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChannelPickerModal, setShowChannelPickerModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openChannelMenuId, setOpenChannelMenuId] = useState(null);
  const [openVideoMenuId, setOpenVideoMenuId] = useState(null);
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
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [forgotForm, setForgotForm] = useState({ email: '', newPassword: '' });
  const [settingsTab, setSettingsTab] = useState('profile'); // 'profile' | 'security' | 'api'
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '' });
  const [showSettingsPassword, setShowSettingsPassword] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [justCreatedApiKey, setJustCreatedApiKey] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');


  // Submission Form State (Nouvelle Vidéo)
  const [submitMode, setSubmitMode] = useState('text'); // 'text' | 'audio_upload'
  const [singleScriptText, setSingleScriptText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('fr-FR-Thomas');
  const [audioFilesList, setAudioFilesList] = useState([]);
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
  const [wizardMode, setWizardMode] = useState('create');
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
      const res = await fetch(`${API_BASE}/channels/preview-ai-music`, { method: 'POST', body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Génération impossible.");
      }
      const blob = await res.blob();
      setAiMusicPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      showToast(err.message || "Erreur lors de la génération de la musique.", "error");
    } finally {
      setAiMusicGenerating(false);
    }
  };

  const handleMusicFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) setMusicFiles(prev => [...prev, ...files]);
  };

  const uploadChannelMusic = async (channelId) => {
    if (!musicFiles.length) return;
    const formData = new FormData();
    musicFiles.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_BASE}/channels/${channelId}/music`, { method: 'POST', body: formData });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail || "Impossible d'importer les musiques.");
    }
    return res.json();
  };

  const handleDeleteMusicTrack = async (trackPath) => {
    if (!editingChannelId) return;
    try {
      const res = await fetch(`${API_BASE}/channels/${editingChannelId}/music?track_path=${encodeURIComponent(trackPath)}`, { method: 'DELETE' });
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
      const res = await fetch(`${API_BASE}/channels/analyze-style-image`, { method: 'POST', body: formData });
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
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const logoInputRef = useRef(null);

  // Local Image Folder Upload State for Wizard Step 5
  const [localImageFiles, setLocalImageFiles] = useState([]);
  const [libraryUploadStatus, setLibraryUploadStatus] = useState(null); // null | 'analyzing' | 'uploading' | 'validating' | 'success' | 'error'
  const [libraryUploadProgress, setLibraryUploadProgress] = useState(0);
  const [libraryUploadMessage, setLibraryUploadMessage] = useState('');
  const [stagedLibraryToken, setStagedLibraryToken] = useState(null);
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const [isFolderDragging, setIsFolderDragging] = useState(false);
  const wizardFolderInputRef = useRef(null);
  const channelSyncInputRef = useRef(null);
  const libraryUploadXhrRef = useRef(null);

  const defaultChannelForm = {
    name: '',
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
    },
    music_preference: {
      enabled: true,
      mode: 'library',
      track_id_or_style: 'ambient',
      volume: 0.10
    },
    image_style: {
      source: 'library',
      style_prompt: 'cinematic dramatic lighting, high detail, stoic sculpture style, dark moody atmosphere',
      library_path: '',
      library_image_count: 0
    },
    effects_config: {
      enabled: true,
      grain: true,
      overlay_effect: 'grain',
      overlay_effects: ['grain'],
      color_grade: 'warm',
      grain_intensity: 50,
      vignette_intensity: 50,
      zoom_min_pct: 1.0,
      zoom_max_pct: 1.15
    }
  };
  const [newChannel, setNewChannel] = useState(defaultChannelForm);

  const fetchChannels = async () => {
    try {
      const url = currentUser
        ? `${API_BASE}/channels?user_id=${encodeURIComponent(currentUser.id)}`
        : `${API_BASE}/channels`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Réponse API invalide');
      setChannels(data);
      setChannelsLoadError('');
    } catch (e) {
      console.error("API error loading channels:", e);
      setChannelsLoadError("Impossible de charger vos chaînes. Vérifiez que l’API NicheCut est accessible.");
    } finally {
      setChannelsLoaded(true);
    }
  };

  const fetchNicheOptions = async () => {
    try {
      const res = await fetch(`${API_BASE}/channels/niches`);
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
    try {
      const url = currentUser
        ? `${API_BASE}/videos?user_id=${encodeURIComponent(currentUser.id)}`
        : `${API_BASE}/videos`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Réponse API invalide');
      setAllVideos(data);
      setVideosLoadError('');
    } catch (e) {
      console.error("API error loading videos:", e);
      setVideosLoadError("Impossible de charger vos vidéos. Vérifiez que l’API NicheCut est accessible.");
    } finally {
      setVideosLoaded(true);
    }
  };

  const fetchChannelVideos = async (channelId) => {
    try {
      const res = await fetch(`${API_BASE}/videos/channel/${channelId}`);
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
      case 'home':
      default: return '/home';
    }
  };

  // state -> URL
  useEffect(() => {
    if (showAuthModal) return; // auth modal owns the URL while open (see next effect)
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
  }, [view, activeChannel, wizardMode, editingChannelId, showAuthModal]);

  // auth modal <-> /login, /signin
  useEffect(() => {
    if (showAuthModal) {
      const authPath = authTab === 'register' ? '/signin' : '/login';
      if (location.pathname !== authPath) navigate(authPath);
    } else if (location.pathname === '/login' || location.pathname === '/signin') {
      navigate(pathForState());
    }
  }, [showAuthModal, authTab]);

  // URL -> state (initial load, refresh, direct link, back/forward)
  useEffect(() => {
    urlHydratedRef.current = true;
    const path = location.pathname;
    if (path === '/login') { setShowAuthModal(true); setAuthTab('login'); return; }
    if (path === '/signin') { setShowAuthModal(true); setAuthTab('register'); return; }
    if (path === '/channels') { setView('channels'); return; }
    if (path === '/videos') { setView('videos'); return; }
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
          openEditWizard(chan);
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
    const interval = setInterval(() => {
      fetchChannels();
      fetchAllVideos();
      if (activeChannel) {
        fetchChannelVideos(activeChannel.id);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [activeChannel, currentUser?.id]);

  // Mandatory auth gate: an unauthenticated visitor always sees the login/signup
  // modal, with no way to dismiss it, instead of the dashboard behind it.
  useEffect(() => {
    if (!currentUser) setShowAuthModal(true);
  }, [currentUser]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const endpoint = authTab === 'register' ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      if (res.ok) {
        const data = await res.json();
        const loggedUser = data.user || data;
        setCurrentUser(loggedUser);
        localStorage.setItem("nichecut_user", JSON.stringify(loggedUser));
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
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotForm.email, new_password: forgotForm.newPassword })
      });
      if (res.ok) {
        showToast("Mot de passe réinitialisé. Connectez-vous avec le nouveau.", "success");
        setAuthForm({ email: forgotForm.email, password: '' });
        setForgotForm({ email: '', newPassword: '' });
        setAuthTab('login');
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
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      if (res.ok) {
        const loggedUser = await res.json();
        setCurrentUser(loggedUser);
        localStorage.setItem("nichecut_user", JSON.stringify(loggedUser));
        setShowAuthModal(false);
        showToast(`Bienvenue, ${loggedUser.name} !`, "success");
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
    if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    if (googleButtonRef.current) {
      googleButtonRef.current.innerHTML = "";
      // Google's renderButton `width` is a fixed pixel value, not responsive —
      // a hardcoded 376 overflowed the modal on narrow (mobile) viewports.
      // Measure the actual container instead, capped at Google's own max (400).
      const containerWidth = Math.min(400, Math.floor(googleButtonRef.current.getBoundingClientRect().width) || 300);
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: containerWidth,
        text: "continue_with",
        locale: "fr",
      });
    }
  }, [showAuthModal, authTab]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("nichecut_user");
    sessionStorage.removeItem('nichecut_view');
    sessionStorage.removeItem('nichecut_active_channel_id');
    setActiveChannel(null);
    setWizardMode('create');
    setEditingChannelId(null);
    setShowProfileModal(false);
    setView('home');
    setAuthTab('login');
    setShowAuthModal(true);
  };

  useEffect(() => {
    if (showProfileModal && currentUser) {
      setProfileForm({ name: currentUser.name || '', phone: currentUser.phone || '' });
      setSettingsTab('profile');
      setJustCreatedApiKey(null);
      fetchApiKeys();
    }
  }, [showProfileModal, currentUser]);

  const fetchApiKeys = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api-keys?user_id=${currentUser.id}`);
      if (res.ok) setApiKeys(await res.json());
    } catch (e) {
      console.error("Erreur chargement clés API:", e);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/auth/me/${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileForm.name, phone: profileForm.phone })
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
      const res = await fetch(`${API_BASE}/auth/change-password`, {
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
      const res = await fetch(`${API_BASE}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, name: newApiKeyName.trim() || 'Clé API' })
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
      await fetch(`${API_BASE}/api-keys/${keyId}`, { method: 'DELETE' });
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
  const loadDraft = (id) => {
    try {
      const raw = sessionStorage.getItem(draftKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const clearDraft = (id) => { try { sessionStorage.removeItem(draftKey(id)); } catch {} };

  useEffect(() => {
    if (view !== 'wizard') return;
    try { sessionStorage.setItem(draftKey(editingChannelId), JSON.stringify(newChannel)); } catch {}
  }, [newChannel, view, editingChannelId]);

  const openCreateWizard = () => {
    resetWizardState();
    const draft = loadDraft(null);
    if (draft) setNewChannel(draft);
    setView('wizard');
  };

  const openNewVideoFlow = () => {
    if (channels.length === 0) {
      openCreateWizard();
    } else if (channels.length === 1) {
      setActiveChannel(channels[0]);
      setShowSubmitModal(true);
    } else {
      setShowChannelPickerModal(true);
    }
  };

  const openEditWizard = (channel, e, startStep = 1) => {
    if (e) e.stopPropagation();
    setOpenChannelMenuId(null);
    setWizardMode('edit');
    setEditingChannelId(channel.id);
    setNewChannel({
      name: channel.name || '',
      niche: channel.niche || 'Philosophie & Stoïcisme',
      subtitle_style: { ...defaultChannelForm.subtitle_style, ...(channel.subtitle_style || {}) },
      branding: { ...defaultChannelForm.branding, ...(channel.branding || {}) },
      music_preference: { ...defaultChannelForm.music_preference, ...(channel.music_preference || {}) },
      image_style: { ...defaultChannelForm.image_style, ...(channel.image_style || {}) },
      effects_config: {
        ...defaultChannelForm.effects_config,
        ...(channel.effects_config || {}),
        // Channels saved before overlay effects were multi-select only have the old
        // single-choice string — expand it into the new array the first time it's opened.
        overlay_effects: channel.effects_config?.overlay_effects || ({
          none: [], grain: ['grain'], white_noise: ['white_noise'],
          vignette: ['vignette'], grain_vignette: ['grain', 'vignette'],
        })[channel.effects_config?.overlay_effect || 'grain'] || ['grain'],
      }
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
    setLogoPreviewUrl(channel.branding?.logo_path ? `${STORAGE_BASE}/${channel.branding.logo_path}` : null);
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

  const uploadLibraryWithProgress = (files, folderName) => {
    if (libraryUploadXhrRef.current) libraryUploadXhrRef.current.abort();
    setLibraryUploadStatus('analyzing');
    setLibraryUploadProgress(2);
    setLibraryUploadMessage(`Analyse de ${files.length} images…`);
    setStagedLibraryToken(null);

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    const isDirectUpload = wizardMode === 'edit' && editingChannelId;
    const url = isDirectUpload
      ? `${API_BASE}/channels/${editingChannelId}/library-images`
      : `${API_BASE}/channels/library-images/staging`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      libraryUploadXhrRef.current = xhr;
      xhr.open('POST', url);
      xhr.upload.onloadstart = () => {
        setLibraryUploadStatus('uploading');
        setLibraryUploadProgress(5);
        setLibraryUploadMessage('Importation vers le serveur…');
      };
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.min(92, Math.round(5 + (event.loaded / event.total) * 87));
        setLibraryUploadProgress(percent);
        setLibraryUploadMessage(`Importation : ${event.loaded.toLocaleString('fr-FR')} / ${event.total.toLocaleString('fr-FR')} octets`);
      };
      xhr.upload.onload = () => {
        setLibraryUploadStatus('validating');
        setLibraryUploadProgress(95);
        setLibraryUploadMessage('Validation des images sur le serveur…');
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
        resolve(data);
      };
      xhr.send(formData);
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
      f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f.name)
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
      f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f.name)
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
    await fetch(`${API_BASE}/channels/${channelId}/logo`, { method: 'POST', body: formData });
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
      const res = await fetch(`${API_BASE}/channels/${activeChannel.id}`, {
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

  const handleSaveChannel = async () => {
    if (!newChannel.name) return showToast("Veuillez saisir un nom de chaîne.", "error");
    const needsLibrary = newChannel.image_style.source === 'library' || newChannel.image_style.source === 'hybrid';
    const uploadReady = libraryUploadStatus === 'success';
    const hasStoredLibrary = Number(newChannel.image_style.library_image_count || 0) > 0
      && String(newChannel.image_style.library_path || '').startsWith('channels/');
    if (needsLibrary && !hasStoredLibrary && !(uploadReady && stagedLibraryToken)) {
      setWizardStep(4);
      return showToast("Importez un dossier d’images : aucune bibliothèque n’est enregistrée sur le serveur.", "error");
    }
    if (needsLibrary && ['analyzing', 'uploading', 'validating'].includes(libraryUploadStatus)) {
      setWizardStep(4);
      return showToast("Attendez que l’importation des images atteigne 100 %.", "error");
    }
    try {
      setLoading(true);
      let saved;
      if (wizardMode === 'edit' && editingChannelId) {
        const res = await fetch(`${API_BASE}/channels/${editingChannelId}`, {
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
        const url = currentUser ? `${API_BASE}/channels?user_id=${currentUser.id}` : `${API_BASE}/channels`;
        const res = await fetch(url, {
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
        const attachRes = await fetch(`${API_BASE}/channels/${saved.id}/library-images/staging`, { method: 'POST', body: attachForm });
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
    } catch (e) {
      showToast("Erreur lors de l'enregistrement de la chaîne: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const getChannelLogoUrl = (channel) => channel?.branding?.logo_path ? getVideoUrl(channel.branding.logo_path) : "/assets/logo/logo-nichecut.png";

  const getChannelStatusInfo = (channel) => {
    const rendering = channel.rendering_count || 0;
    const queued = channel.queued_count || 0;
    const done = channel.done_count || 0;
    const failed = channel.failed_count || 0;
    if (rendering > 0) return { label: 'Génération en cours', className: 'bg-blue-950/80 text-blue-300 border border-blue-700/60 animate-pulse' };
    if (queued > 0) return { label: 'En file', className: 'bg-amber-950/80 text-amber-300 border border-amber-700/60' };
    if (done > 0) return { label: 'Prête', className: 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60' };
    if (failed > 0) return { label: 'Échec de rendu', className: 'bg-rose-950/80 text-rose-300 border border-rose-700/60' };
    return { label: 'Configurée', className: 'bg-slate-800/80 text-slate-300 border border-slate-700/60' };
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
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/videos`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setSingleScriptText('');
        setAudioFilesList([]);
        setShowSubmitModal(false);
        fetchChannelVideos(activeChannel.id);
        fetchChannels();
        fetchAllVideos();
        showToast("Vidéo soumise avec succès — le montage et le rendu sont lancés.", "success");
      } else {
        const err = await res.json();
        showToast(err.detail || "Erreur lors de l'envoi.", "error");
      }
    } catch (e) {
      showToast("Erreur réseau: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRetryVideo = async (videoId) => {
    try {
      await fetch(`${API_BASE}/videos/${videoId}/retry`, { method: 'POST' });
      if (activeChannel) fetchChannelVideos(activeChannel.id);
      fetchAllVideos();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteVideo = async (videoId, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    const ok = await askConfirm("Cette action est définitive et supprimera le fichier rendu.", { title: "Supprimer cette vidéo ?", danger: true });
    if (!ok) return;
    try {
      await fetch(`${API_BASE}/videos/${videoId}`, { method: 'DELETE' });
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

  const runDownload = async (vid, quality) => {
    setDownloadingQuality(quality);
    try {
      const url = quality === 'hd'
        ? getVideoUrl(vid.output_path)
        : `${API_BASE}/videos/${vid.id}/download?quality=${quality}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `nichecut-${(vid.script_text || 'video').slice(0, 40).replace(/[^a-z0-9]+/gi, '-')}-${quality}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objectUrl);
      setDownloadModalVideo(null);
    } catch (err) {
      console.error("Erreur de téléchargement:", err);
      showToast("Le téléchargement a échoué. Réessayez.", "error");
    } finally {
      setDownloadingQuality(null);
    }
  };

  const [reusingAudioId, setReusingAudioId] = useState(null);

  const handleReuseAudio = async (vid, e) => {
    if (e) e.stopPropagation();
    setOpenVideoMenuId(null);
    if (!vid.output_path) return;
    setReusingAudioId(vid.id);
    try {
      const res = await fetch(`${API_BASE}/videos/${vid.id}/audio`);
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
    setEditingTitleValue(vid.script_text || "");
    setEditingTitleId(vid.id);
  };

  const commitTitleEdit = async (vid) => {
    const trimmed = editingTitleValue.trim();
    setEditingTitleId(null);
    if (!trimmed || trimmed === vid.script_text) return;
    try {
      const res = await fetch(`${API_BASE}/videos/${vid.id}`, {
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
      await fetch(`${API_BASE}/channels/${channelId}`, { method: 'DELETE' });
      fetchChannels();
      if (activeChannel && activeChannel.id === channelId) {
        setActiveChannel(null);
        setView('channels');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.niche.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalQueued = channels.reduce((acc, c) => acc + (c.queued_count || 0) + (c.rendering_count || 0), 0);
  const totalCompleted = channels.reduce((acc, c) => acc + (c.done_count || 0), 0);

  // Sample sentence for karaoke animation preview
  const sampleWords = [
    { text: "Le", highlight: previewWordIndex === 0 },
    { text: "calme", highlight: previewWordIndex === 1 },
    { text: "intérieur", highlight: previewWordIndex === 2 },
    { text: "dépend", highlight: previewWordIndex === 3 },
    { text: "de votre", highlight: previewWordIndex === 4 },
    { text: "esprit", highlight: previewWordIndex === 5 },
  ];

  return (
    <div className="font-body-md antialiased overflow-hidden flex h-screen bg-[#0f1217] text-[#e5e8f0]">

      {/* MOBILE TOP BAR — the desktop sidenav + header below are both `hidden`
          under md, so mobile needs its own always-visible bar with a hamburger
          to reach navigation at all. */}
      <div className="flex md:hidden items-center justify-between px-4 h-14 fixed top-0 left-0 right-0 z-40 bg-[#141923] border-b border-[#263042]">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:bg-[#1f2838] hover:text-white -ml-1.5"
          aria-label="Ouvrir le menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
        <div className="flex items-center gap-2" onClick={() => setView('home')}>
          <img src="/assets/logo/logo-nichecut.png" alt="NicheCut" className="w-7 h-7 rounded-lg object-cover" />
          <span className="font-title-sm text-sm font-black text-white tracking-wide">NicheCut</span>
        </div>
        {currentUser ? (
          <button onClick={() => setShowProfileModal(true)} className="w-8 h-8 rounded-full overflow-hidden border border-[#2b374d] flex-shrink-0">
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
          <nav className="relative w-[260px] max-w-[80vw] h-full bg-[#141923] border-r border-[#263042] py-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="px-6 mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/assets/logo/logo-nichecut.png" alt="NicheCut" className="w-9 h-9 rounded-xl shadow-lg shadow-[#00c2ff]/20 object-cover" />
                  <div>
                    <div className="font-title-sm text-base font-black text-white tracking-wide">NicheCut</div>
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
                        : 'text-slate-300 hover:bg-[#1f2838] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-3">
              {currentUser ? (
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-[#1f2838] hover:text-white"
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
      <nav className="hidden md:flex flex-col bg-[#141923] text-primary font-label-bold text-label-bold fixed left-0 top-0 h-screen w-[240px] z-40 border-r border-[#263042] py-6 justify-between">

        <div>
          {/* Brand Logo Header */}
          <div className="px-6 mb-8 flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
            <img src="/assets/logo/logo-nichecut.png" alt="NicheCut" className="w-9 h-9 rounded-xl shadow-lg shadow-[#00c2ff]/20 object-cover" />
            <div>
              <div className="font-title-sm text-base font-black text-white tracking-wide">NicheCut</div>
              <div className="text-slate-400 text-xs font-normal">Video Automation</div>
            </div>
          </div>

          {/* Navigation Links - Single Active Item Highlighted */}
          <div className="px-3 space-y-1.5">
            <button 
              onClick={() => setView('home')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 cursor-pointer rounded-xl transition-all font-medium text-sm ${
                (view === 'home' || view === 'dashboard') 
                  ? 'bg-gradient-to-r from-[#00c2ff] to-[#0099ff] text-slate-950 font-bold shadow-md shadow-[#00c2ff]/20' 
                  : 'text-slate-300 hover:bg-[#1f2838] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: (view === 'home' || view === 'dashboard') ? "'FILL' 1" : "'FILL' 0" }}>home</span>
              Home
            </button>

            <button
              onClick={() => setView('channels')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 cursor-pointer rounded-xl transition-all font-medium text-sm ${
                (view === 'channels' || view === 'channel_detail') 
                  ? 'bg-gradient-to-r from-[#00c2ff] to-[#0099ff] text-slate-950 font-bold shadow-md shadow-[#00c2ff]/20' 
                  : 'text-slate-300 hover:bg-[#1f2838] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: (view === 'channels' || view === 'channel_detail') ? "'FILL' 1" : "'FILL' 0" }}>subscriptions</span>
              Mes Chaînes
            </button>

            <button
              onClick={() => setView('videos')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 cursor-pointer rounded-xl transition-all font-medium text-sm ${
                view === 'videos' 
                  ? 'bg-gradient-to-r from-[#00c2ff] to-[#0099ff] text-slate-950 font-bold shadow-md shadow-[#00c2ff]/20' 
                  : 'text-slate-300 hover:bg-[#1f2838] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: view === 'videos' ? "'FILL' 1" : "'FILL' 0" }}>movie</span>
              Mes Vidéos
            </button>
          </div>
        </div>

      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col md:ml-[240px] h-screen overflow-hidden bg-[#0f1217]">
        
        {/* Top Header Bar */}
        <div className="hidden md:flex justify-between items-center px-8 py-5 border-b border-[#202938] bg-[#141923]/60 backdrop-blur-md">
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {view === 'home' && 'Tableau de Bord'}
            {view === 'channels' && 'Vos Pipelines de Chaînes'}
            {view === 'videos' && 'Bibliothèque de Vidéos'}
            {view === 'wizard' && (wizardMode === 'edit' ? 'Modifier le Pipeline' : 'Assistant de Création de Chaîne')}
            {view === 'channel_detail' && (activeChannel ? `Chaîne: ${activeChannel.name}` : 'Détail Chaîne')}
          </h1>

          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="relative focus-glow rounded-xl">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: '18px' }}>search</span>
              <input 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-[#1b2230] border border-[#2b374d] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none w-60 transition-all" 
                placeholder="Rechercher une chaîne..." 
                type="text"
              />
            </div>

            {/* Profile widget — top right */}
            {currentUser ? (
              <div
                onClick={() => setShowProfileModal(true)}
                className="w-9 h-9 rounded-full cursor-pointer transition-all shadow-sm ring-2 ring-transparent hover:ring-[#00c2ff]/50 flex-shrink-0 overflow-hidden"
                title="Paramètres"
              >
                {currentUser.picture_url ? (
                  <img src={currentUser.picture_url} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-[#00c2ff] text-slate-950 flex items-center justify-center font-bold text-sm">
                    {currentUser.name.slice(0, 1).toUpperCase()}
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
                {/* Stats Row Bento Cards */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-[#161b22] border border-[#263042] rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#00c2ff]/5 rounded-full blur-xl group-hover:bg-[#00c2ff]/10 transition-all"></div>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chaînes Actives</h3>
                      <div className="p-2 rounded-xl bg-[#00c2ff]/10 text-[#00c2ff]">
                        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>cell_tower</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-4xl font-extrabold text-white">{channels.length}</span>
                      <span className="text-xs font-bold text-[#00c2ff] bg-[#00c2ff]/10 px-2.5 py-1 rounded-lg">Configurées</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#202938] mt-4 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#00c2ff] to-[#0088ff] w-full rounded-full"></div>
                    </div>
                  </div>

                  <div className="bg-[#161b22] border border-[#263042] rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vidéos en Attente</h3>
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>hourglass_empty</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-4xl font-extrabold text-white">{totalQueued}</span>
                      <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">En cours de rendu...</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#202938] mt-4 rounded-full overflow-hidden flex">
                      <div className="h-full bg-amber-400 w-2/3 animate-pulse"></div>
                    </div>
                  </div>

                  <div className="bg-[#161b22] border border-[#263042] rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vidéos Terminées</h3>
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-4xl font-extrabold text-white">{totalCompleted}</span>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">Prêtes à publier</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#202938] mt-4 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 w-full rounded-full"></div>
                    </div>
                  </div>
                </section>

                {/* Quick Launch Banner */}
                <section className="bg-gradient-to-r from-[#161b22] via-[#1a2332] to-[#161b22] border border-[#263042] rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#00c2ff]">auto_awesome</span>
                      Générateur de Vidéo Automatisé
                    </h3>
                    <p className="text-sm text-slate-400">
                      Générez une vidéo YouTube longue durée (16:9) complète avec sous-titres karaoké, voix off IA et montage visuel en 1 clic.
                    </p>
                  </div>
                  <button
                    onClick={openNewVideoFlow}
                    className="px-6 py-3 bg-[#00c2ff] hover:bg-[#38d0ff] text-slate-950 font-bold text-sm rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-[#00c2ff]/20 flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[20px]">videocam</span>
                    Lancer une Génération
                  </button>
                </section>

                {/* Pipelines Preview in Home */}
                <section>
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-bold text-white">Aperçu des Chaînes</h3>
                    <button onClick={() => setView('channels')} className="text-xs font-bold text-[#00c2ff] hover:underline flex items-center gap-1">
                      Voir toutes les chaînes ({channels.length}) <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>

                  {channels.length === 0 ? (
                    <div className="bg-[#161b22] border border-[#263042] rounded-2xl p-10 text-center">
                      <span className="material-symbols-outlined text-[48px] text-slate-500 mb-3">subscriptions</span>
                      <h4 className="text-base font-bold text-white mb-1">Aucune chaîne configurée</h4>
                      <p className="text-xs text-slate-400 mb-5">Créez votre première chaîne pour automatiser le montage.</p>
                      <button onClick={openCreateWizard} className="px-5 py-2.5 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl">
                        + Créer une chaîne
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {channels.slice(0, 3).map(chan => {
                        const statusInfo = getChannelStatusInfo(chan);
                        return (
                          <div 
                            key={chan.id} 
                            onClick={() => { setActiveChannel(chan); fetchChannelVideos(chan.id); setView('channel_detail'); }}
                            className="bg-[#161b22] border border-[#263042] hover:border-[#00c2ff]/40 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 shadow-md space-y-4"
                          >
                            <div className="flex items-center gap-3">
                              <ChannelAvatar channel={chan} logoUrl={getChannelLogoUrl(chan)} sizeClass="w-12 h-12" roundedClass="rounded-xl" textClass="text-lg" />
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-white text-sm truncate">{chan.name}</h4>
                                <span className="text-xs text-slate-400 block truncate">{chan.niche}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#202938]">
                              <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase ${statusInfo.className}`}>
                                {statusInfo.label}
                              </span>
                              <span className="text-slate-400 font-mono">{chan.done_count || 0} vidéos prêtes</span>
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
                  <div className="bg-[#161b22] border border-[#263042] rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-[54px] text-slate-500 mb-4">video_settings</span>
                    <h3 className="text-lg font-bold text-white mb-2">Aucune chaîne trouvée</h3>
                    <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                      Configurez votre premier pipeline vidéo (sous-titres karaoké, logo, musique de fond, images) et générez sans limite.
                    </p>
                    <button 
                      onClick={openCreateWizard}
                      className="bg-[#00c2ff] text-slate-950 px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#38d0ff] transition-all shadow-lg inline-flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined">add</span> Créer un Pipeline de Chaîne
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredChannels.map(chan => {
                      const logoUrl = getChannelLogoUrl(chan);
                      const statusInfo = getChannelStatusInfo(chan);
                      const isMenuOpen = openChannelMenuId === chan.id;

                      return (
                        <div
                          key={chan.id}
                          onClick={() => { setActiveChannel(chan); fetchChannelVideos(chan.id); setView('channel_detail'); }}
                          className="bg-[#161b22] hover:bg-[#1c232e] border border-[#263042] hover:border-[#00c2ff]/40 rounded-2xl p-5 transition-all cursor-pointer group flex flex-col justify-between min-h-[220px] shadow-lg relative card-warm-hover channel-menu-container"
                        >
                          {/* Card Header & 3-Dots Action Button */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <ChannelAvatar channel={chan} logoUrl={logoUrl} sizeClass="w-12 h-12" roundedClass="rounded-xl" textClass="text-lg" />
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
                                <div className="absolute right-0 top-10 w-48 bg-[#1f2838] border border-[#2d3a52] rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in duration-150">
                                  <button
                                    onClick={(e) => openEditWizard(chan, e)}
                                    className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[#2c394e] hover:text-white flex items-center gap-2 font-medium"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">edit</span>
                                    Modifier la chaîne
                                  </button>
                                  <div className="h-[1px] bg-[#2d3a52] my-1"></div>
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
                            <span className={`inline-block px-3 py-1 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </div>

                          {/* Counters Grid */}
                          <div className="grid grid-cols-2 gap-2 mt-4">
                            <div className="bg-[#11151c] p-2.5 rounded-xl border border-[#202938]">
                              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">En File</div>
                              <div className="text-base text-[#00c2ff] font-extrabold mt-0.5">{(chan.queued_count || 0) + (chan.rendering_count || 0)}</div>
                            </div>
                            <div className="bg-[#11151c] p-2.5 rounded-xl border border-[#202938]">
                              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Vidéos Prêtes</div>
                              <div className="text-base text-white font-extrabold mt-0.5">{chan.done_count || 0}</div>
                            </div>
                          </div>

                        </div>
                      );
                    })}

                    {/* Add Channel Card — single entry point to create a channel */}
                    <button
                      onClick={openCreateWizard}
                      className="rounded-2xl p-5 border-2 border-dashed border-[#2b374d] hover:border-[#00c2ff] hover:bg-[#161b22] transition-all flex flex-col items-center justify-center gap-3 min-h-[220px] text-slate-400 hover:text-[#00c2ff] group"
                    >
                      <div className="w-14 h-14 rounded-full bg-[#1b2230] group-hover:bg-[#00c2ff]/10 flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[28px]">add</span>
                      </div>
                      <span className="font-bold text-sm">Ajouter une Chaîne</span>
                    </button>
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
                      className="bg-[#1b2230] border border-[#2b374d] rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="all">Toutes les chaînes ({channels.length})</option>
                      {channels.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={openNewVideoFlow}
                      className="px-4 py-2 bg-[#00c2ff] hover:bg-[#38d0ff] text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md shadow-[#00c2ff]/20 flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Nouvelle Vidéo
                    </button>
                  </div>
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
                ) : allVideos.length === 0 ? (
                  <div className="bg-[#161b22] border border-[#263042] rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-[54px] text-slate-500 mb-3">movie</span>
                    <h3 className="text-base font-bold text-white mb-1">Aucune vidéo dans l'historique</h3>
                    <p className="text-xs text-slate-400 mb-5">Lancez votre première génération de vidéo.</p>
                    <button
                      onClick={openNewVideoFlow}
                      className="px-5 py-2.5 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl"
                    >
                      + Nouvelle Vidéo
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {allVideos
                      .filter(v => videoFilterChannelId === 'all' || v.channel_id === videoFilterChannelId)
                      .map(vid => {
                        const channelObj = channels.find(c => c.id === vid.channel_id);
                        return (
                          <div
                            key={vid.id}
                            className="bg-[#161b22] hover:bg-[#1c232e] border border-[#263042] hover:border-[#00c2ff]/40 rounded-2xl p-4 transition-all group flex flex-col justify-between shadow-lg relative card-warm-hover video-menu-container"
                          >
                            {/* Video Poster Frame — click opens the big preview player directly */}
                            <div
                              onClick={() => vid.status === 'done' && setSelectedVideo(vid)}
                              className={`aspect-[16/9] bg-slate-950 rounded-xl relative overflow-hidden border border-[#2b374d] flex items-center justify-center ${vid.status === 'done' ? 'cursor-pointer group' : ''}`}
                            >
                              {vid.status === 'done' && vid.output_path ? (
                                <>
                                  <video
                                    src={getVideoUrl(vid.output_path)}
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
                                </>
                              ) : vid.status === 'rendering' ? (
                                <div className="p-4 text-center space-y-2 w-full max-w-[220px]">
                                  <span className="material-symbols-outlined text-[36px] text-blue-400 animate-spin">progress_activity</span>
                                  <div className="text-[11px] font-bold text-blue-300">{vid.progress_stage || 'Rendu en cours…'}</div>
                                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div className="h-full bg-[#00c2ff] transition-all duration-700" style={{ width: `${vid.progress_percent || 2}%` }} />
                                  </div>
                                  <div className="text-[10px] font-mono text-blue-300">{vid.progress_percent || 2}%</div>
                                  {vid.started_at && (
                                    <div className="text-[10px] font-mono text-blue-400/80">{formatElapsed(vid.started_at)} écoulées</div>
                                  )}
                                </div>
                              ) : vid.status === 'failed' ? (
                                <div className="p-4 text-center space-y-2">
                                  <span className="material-symbols-outlined text-[36px] text-rose-400">warning</span>
                                  <div className="text-[11px] font-bold font-mono text-rose-300">Échec du rendu</div>
                                  <div className="text-[9px] text-rose-300/80 line-clamp-2" title={vid.error_message || ''}>
                                    {(vid.error_message || 'Erreur inconnue').split('\n')[0]}
                                  </div>
                                </div>
                              ) : (
                                <div className="p-4 text-center space-y-2">
                                  <span className="material-symbols-outlined text-[36px] text-amber-400">hourglass_empty</span>
                                  <div className="text-[11px] font-bold font-mono text-amber-300">En file d'attente</div>
                                </div>
                              )}

                              {/* Status Badge Top Left */}
                              <div className="absolute top-2 left-2 z-10">
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${
                                  vid.status === 'done' ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/80' :
                                  vid.status === 'rendering' ? 'bg-blue-950/90 text-blue-300 border border-blue-700/80 animate-pulse' :
                                  vid.status === 'failed' ? 'bg-rose-950/90 text-rose-300 border border-rose-700/80' :
                                  'bg-amber-950/90 text-amber-300 border border-amber-700/80'
                                }`}>
                                  {vid.status === 'done' ? 'Prête' : vid.status === 'rendering' ? 'Rendu...' : vid.status === 'failed' ? 'Échec' : 'En file'}
                                </span>
                              </div>
                            </div>

                            {/* Kebab Menu Top Right — rendered outside the poster frame so the
                                dropdown (incl. "Supprimer") is never clipped by its overflow-hidden */}
                            <div className="absolute top-6 right-6 z-20">
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenVideoMenuId(openVideoMenuId === vid.id ? null : vid.id); }}
                                className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors shadow-md"
                                title="Actions vidéo"
                              >
                                <span className="material-symbols-outlined text-[16px]">more_vert</span>
                              </button>
                              {openVideoMenuId === vid.id && (
                                <div className="absolute right-0 top-9 w-44 bg-[#1f2838] border border-[#2d3a52] rounded-xl shadow-2xl z-50 py-1.5">
                                  <button onClick={(e) => startEditingTitle(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[#2c394e] hover:text-white flex items-center gap-2 font-medium">
                                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">edit</span> Renommer
                                  </button>
                                  {vid.status === 'done' && (
                                    <button onClick={(e) => handleDownloadVideo(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[#2c394e] hover:text-white flex items-center gap-2 font-medium">
                                      <span className="material-symbols-outlined text-[16px] text-emerald-400">download</span> Télécharger
                                    </button>
                                  )}
                                  {vid.status === 'done' && (
                                    <button disabled={reusingAudioId === vid.id} onClick={(e) => handleReuseAudio(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[#2c394e] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                      <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">graphic_eq</span> {reusingAudioId === vid.id ? 'Récupération…' : "Réutiliser l'audio"}
                                    </button>
                                  )}
                                  <div className="h-[1px] bg-[#2d3a52] my-1"></div>
                                  <button onClick={(e) => handleDeleteVideo(vid.id, e)} className="w-full text-left px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-950/50 flex items-center gap-2 font-medium">
                                    <span className="material-symbols-outlined text-[16px]">delete</span> Supprimer
                                  </button>
                                </div>
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
                                    className="w-full bg-[#1b2230] border border-[#00c2ff] rounded-lg px-2 py-1 text-white text-xs font-semibold outline-none"
                                  />
                                ) : (
                                  <p
                                    onDoubleClick={(e) => startEditingTitle(vid, e)}
                                    className="text-white text-xs font-semibold line-clamp-2 cursor-text"
                                    title="Double-cliquez pour renommer"
                                  >
                                    {vid.script_text}
                                  </p>
                                )}
                                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                  {formatRelativeDate(vid.finished_at || vid.created_at)}
                                </p>
                              </div>

                              {/* Card Action Buttons */}
                              {vid.status === 'failed' && (
                                <div className="pt-2 border-t border-[#202938] flex items-center gap-2">
                                  <button
                                    onClick={() => handleRetryVideo(vid.id)}
                                    className="flex-1 py-1.5 bg-[#1f2838] text-white rounded-xl font-bold text-xs hover:bg-[#2b384e] transition-all flex items-center justify-center gap-1 border border-[#2b374d]"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">refresh</span> Relancer
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>
            )}

            {/* VIEW 4: CHANNEL DETAIL VIEW */}
            {view === 'channel_detail' && activeChannel && (
              <div className="space-y-8">
                <section className="bg-[#161b22] border border-[#263042] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                  <div className="flex items-center gap-5 min-w-0">
                    <ChannelAvatar channel={activeChannel} logoUrl={getChannelLogoUrl(activeChannel)} sizeClass="w-20 h-20" roundedClass="rounded-2xl" textClass="text-2xl" />
                    <div className="min-w-0">
                      <h1 className="text-2xl font-extrabold text-white truncate">{activeChannel.name}</h1>
                      <div className="flex items-center gap-3 text-slate-400 text-xs font-medium mt-1">
                        <span>Niche: <strong className="text-white">{activeChannel.niche}</strong></span>
                      </div>
                      {(() => {
                        const s = getChannelStatusInfo(activeChannel);
                        return <span className={`inline-block mt-2.5 px-3 py-1 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider ${s.className}`}>{s.label}</span>;
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
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
                                f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f.name)
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
                            title="Synchronise la bibliothèque avec ton dossier local, sans quitter la page"
                            className="px-4 py-2.5 bg-[#1b2230] text-white rounded-xl font-bold text-xs hover:bg-[#252f42] transition-colors flex items-center gap-2 border border-[#2b374d] disabled:opacity-60"
                          >
                            <span className={`material-symbols-outlined text-[18px] ${librarySyncing ? 'animate-spin' : ''}`}>{librarySyncing ? 'progress_activity' : 'sync'}</span>
                            {librarySyncing ? 'Synchronisation…' : 'Mettre à jour la bibliothèque'}
                          </button>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">
                            Dernière synchro : {formatSyncAgo(activeChannel.id, nowTick)}
                          </span>
                      </div>
                    )}
                    <button
                      onClick={(e) => openEditWizard(activeChannel, e)}
                      className="px-4 py-2.5 bg-[#1b2230] text-white rounded-xl font-bold text-xs hover:bg-[#252f42] transition-colors flex items-center gap-2 border border-[#2b374d]"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      Modifier le Pipeline
                    </button>
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      className="px-5 py-2.5 bg-[#00c2ff] text-slate-950 rounded-xl font-bold text-xs hover:bg-[#38d0ff] transition-all flex items-center gap-2 shadow-lg shadow-[#00c2ff]/20"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Nouvelle Vidéo
                    </button>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-lg font-bold text-white">Vidéos de la Chaîne ({channelVideos.length})</h3>
                  {channelVideos.length === 0 ? (
                    <div className="bg-[#161b22] border border-[#263042] rounded-2xl p-10 text-center">
                      <span className="material-symbols-outlined text-[40px] text-slate-500 mb-2">description</span>
                      <h4 className="text-base font-bold text-white mb-1">Aucune vidéo soumise</h4>
                      <p className="text-xs text-slate-400 mb-5">Soumettez votre premier sujet (texte de script ou fichiers audio).</p>
                      <button 
                        onClick={() => setShowSubmitModal(true)}
                        className="bg-[#00c2ff] text-slate-950 px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-[#38d0ff] transition-all"
                      >
                        Soumettre un sujet de vidéo
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {channelVideos.map(vid => (
                        <div
                          key={vid.id}
                          className="bg-[#161b22] hover:bg-[#1c232e] border border-[#263042] hover:border-[#00c2ff]/40 rounded-2xl p-4 transition-all group flex flex-col justify-between shadow-lg relative card-warm-hover video-menu-container"
                        >
                          {/* Thumbnail Poster — click opens the big preview player directly */}
                          <div
                            onClick={() => vid.status === 'done' && setSelectedVideo(vid)}
                            className={`aspect-[16/9] bg-slate-950 rounded-xl relative overflow-hidden border border-[#2b374d] flex items-center justify-center ${vid.status === 'done' ? 'cursor-pointer group' : ''}`}
                          >
                            {vid.status === 'done' && vid.output_path ? (
                              <>
                                <video
                                  src={getVideoUrl(vid.output_path)}
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
                              </>
                            ) : vid.status === 'rendering' ? (
                              <div className="p-4 text-center space-y-2 w-full max-w-[220px]">
                                <span className="material-symbols-outlined text-[36px] text-blue-400 animate-spin">progress_activity</span>
                                <div className="text-[11px] font-bold text-blue-300">{vid.progress_stage || 'Rendu en cours…'}</div>
                                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                  <div className="h-full bg-[#00c2ff] transition-all duration-700" style={{ width: `${vid.progress_percent || 2}%` }} />
                                </div>
                                <div className="text-[10px] font-mono text-blue-300">{vid.progress_percent || 2}%</div>
                                {vid.started_at && (
                                  <div className="text-[10px] font-mono text-blue-400/80">{formatElapsed(vid.started_at)} écoulées</div>
                                )}
                              </div>
                            ) : vid.status === 'failed' ? (
                              <div className="p-4 text-center space-y-2">
                                <span className="material-symbols-outlined text-[36px] text-rose-400">warning</span>
                                <div className="text-[11px] font-bold font-mono text-rose-300">Échec</div>
                                <div className="text-[9px] text-rose-300/80 line-clamp-2" title={vid.error_message || ''}>
                                  {(vid.error_message || 'Erreur inconnue').split('\n')[0]}
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 text-center space-y-2">
                                <span className="material-symbols-outlined text-[36px] text-amber-400">hourglass_empty</span>
                                <div className="text-[11px] font-bold font-mono text-amber-300">En file</div>
                              </div>
                            )}

                            {/* Status Badge */}
                            <div className="absolute top-2 left-2 z-10">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${
                                vid.status === 'done' ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/80' :
                                vid.status === 'rendering' ? 'bg-blue-950/90 text-blue-300 border border-blue-700/80 animate-pulse' :
                                vid.status === 'failed' ? 'bg-rose-950/90 text-rose-300 border border-rose-700/80' :
                                'bg-amber-950/90 text-amber-300 border border-amber-700/80'
                              }`}>
                                {vid.status === 'done' ? 'Prête' : vid.status === 'rendering' ? 'Rendu...' : vid.status === 'failed' ? 'Échec' : 'En file'}
                              </span>
                            </div>
                          </div>

                          {/* Kebab Menu — outside the poster's overflow-hidden so "Supprimer" is never clipped */}
                          <div className="absolute top-6 right-6 z-20">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenVideoMenuId(openVideoMenuId === vid.id ? null : vid.id); }}
                              className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors shadow-md"
                              title="Actions vidéo"
                            >
                              <span className="material-symbols-outlined text-[16px]">more_vert</span>
                            </button>
                            {openVideoMenuId === vid.id && (
                              <div className="absolute right-0 top-9 w-44 bg-[#1f2838] border border-[#2d3a52] rounded-xl shadow-2xl z-50 py-1.5">
                                <button onClick={(e) => startEditingTitle(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[#2c394e] hover:text-white flex items-center gap-2 font-medium">
                                  <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">edit</span> Renommer
                                </button>
                                {vid.status === 'done' && (
                                  <button onClick={(e) => handleDownloadVideo(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[#2c394e] hover:text-white flex items-center gap-2 font-medium">
                                    <span className="material-symbols-outlined text-[16px] text-emerald-400">download</span> Télécharger
                                  </button>
                                )}
                                {vid.status === 'done' && (
                                  <button disabled={reusingAudioId === vid.id} onClick={(e) => handleReuseAudio(vid, e)} className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-[#2c394e] hover:text-white flex items-center gap-2 font-medium disabled:opacity-50">
                                    <span className="material-symbols-outlined text-[16px] text-[#00c2ff]">graphic_eq</span> {reusingAudioId === vid.id ? 'Récupération…' : "Réutiliser l'audio"}
                                  </button>
                                )}
                                <div className="h-[1px] bg-[#2d3a52] my-1"></div>
                                <button onClick={(e) => handleDeleteVideo(vid.id, e)} className="w-full text-left px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-950/50 flex items-center gap-2 font-medium">
                                  <span className="material-symbols-outlined text-[16px]">delete</span> Supprimer
                                </button>
                              </div>
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
                                  className="w-full bg-[#1b2230] border border-[#00c2ff] rounded-lg px-2 py-1 text-white text-xs font-semibold outline-none"
                                />
                              ) : (
                                <p
                                  onDoubleClick={(e) => startEditingTitle(vid, e)}
                                  className="text-white text-xs font-semibold line-clamp-2 cursor-text"
                                  title="Double-cliquez pour renommer"
                                >
                                  {vid.script_text}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                {formatRelativeDate(vid.finished_at || vid.created_at)}
                              </p>
                            </div>

                            {vid.status === 'failed' && (
                              <div className="pt-2 border-t border-[#202938] flex items-center gap-2">
                                <button
                                  onClick={() => handleRetryVideo(vid.id)}
                                  className="flex-1 py-1.5 bg-[#1f2838] text-white rounded-xl font-bold text-xs hover:bg-[#2b384e] transition-all flex items-center justify-center gap-1 border border-[#2b374d]"
                                >
                                  <span className="material-symbols-outlined text-[16px]">refresh</span> Relancer
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* VIEW 5: CHANNEL WIZARD (CREATE / EDIT) */}
            {view === 'wizard' && (
              <div className="max-w-[1240px] mx-auto bg-[#161b22] border border-[#263042] rounded-3xl p-8 shadow-2xl space-y-8">
                {/* Wizard Header Stepper */}
                <div className="flex items-center justify-between border-b border-[#263042] pb-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-white">
                      {wizardMode === 'edit' ? 'Modifier le Pipeline de la Chaîne' : 'Configuration du Template de Montage de sa Chaîne'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Étape {wizardStep} sur 6</p>
                  </div>
                  <button
                    onClick={() => setView(wizardMode === 'edit' && editingChannelId ? 'channel_detail' : 'channels')}
                    className="text-slate-400 hover:text-white p-2"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Steps Timeline Indicator */}
                <div className="grid grid-cols-6 gap-2">
                  {['Identité', 'Sous-titres', 'Musique', 'Visuels', 'Effets', 'Aperçu Final'].map((label, idx) => {
                    const stepNum = idx + 1;
                    const isActive = wizardStep === stepNum;
                    const isPassed = wizardStep > stepNum;
                    return (
                      <button
                        key={stepNum}
                        onClick={() => setWizardStep(stepNum)}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                          isActive ? 'bg-[#00c2ff] text-slate-950 shadow-md' :
                          isPassed ? 'bg-[#00c2ff]/20 text-[#00c2ff] border border-[#00c2ff]/40' :
                          'bg-[#1b2230] text-slate-400'
                        }`}
                      >
                        {stepNum}. {label}
                      </button>
                    );
                  })}
                </div>

                {/* STEP 1: INFORMATIONS GÉNÉRALES & IDENTITÉ (LOGO & NOM) */}
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-white">1. Identité de la Chaîne</h3>
                    
                    <div className="flex items-start gap-5">
                      <div
                        onClick={() => logoInputRef.current && logoInputRef.current.click()}
                        className="w-28 h-28 rounded-full bg-[#1b2230] border-2 border-dashed border-[#2b374d] hover:border-[#00c2ff] cursor-pointer flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors group"
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
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-[#00c2ff] text-[32px]">add_a_photo</span>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/*"
                        onChange={handleLogoFileSelect}
                        className="hidden"
                      />

                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-300 mb-2">Nom de la chaîne YouTube</label>
                        <input
                          value={newChannel.name}
                          onChange={e => setNewChannel({ ...newChannel, name: e.target.value })}
                          className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl px-4 py-3 text-sm text-white focus:border-[#00c2ff] outline-none"
                          placeholder="Ex: Stoic Mind Daily"
                        />
                      </div>
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
                                : 'bg-[#1b2230] border-[#2b374d] text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <input
                        value={newChannel.niche}
                        onChange={e => setNewChannel({ ...newChannel, niche: e.target.value })}
                        className="w-full mt-2 bg-[#1b2230] border border-[#2b374d] rounded-xl px-3 py-2 text-xs text-white focus:border-[#00c2ff] outline-none"
                        placeholder="Écris ta propre niche..."
                      />
                    </div>

                  </div>
                )}

                {/* STEP 2: SOUS-TITRES & KARAOKÉ ASS */}
                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-white">2. Personnalisation Avancée des Sous-Titres</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px] gap-8 items-start">
                      {/* Settings column — split into CapCut-style toggle sections instead
                          of one long scroll, so the preview stays reachable without
                          hunting through every control at once. */}
                      <div className="space-y-4 min-w-0">
                        <div className="flex w-full bg-[#1b2230] rounded-xl p-1 mb-1 overflow-x-auto">
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
                                subtitleTab === tab.id ? 'bg-[#00c2ff] text-slate-950' : 'text-slate-300 hover:bg-[#252f42]'
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
                                      isActive ? 'border-[#00c2ff] shadow-lg shadow-[#00c2ff]/20' : 'border-[#2b374d] group-hover:border-slate-500'
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
                              className="w-full flex items-center justify-between bg-[#1b2230] border border-[#2b374d] rounded-xl px-4 py-2.5 text-left hover:border-[#00c2ff] transition-colors"
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
                            <label className="block text-xs font-bold text-slate-300 mb-2">Position</label>
                            <select
                              value={newChannel.subtitle_style.position}
                              onChange={e => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, position: e.target.value } })}
                              className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl px-4 py-2.5 text-xs text-white focus:border-[#00c2ff] outline-none"
                            >
                              <option value="bottom">Bas</option>
                              <option value="center">Centre</option>
                              <option value="top">Haut</option>
                            </select>
                          </div>

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
                                  className={`flex-1 py-2.5 rounded-xl text-sm font-black border transition-colors ${newChannel.subtitle_style.bold ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[#1b2230] border-[#2b374d] text-slate-300 hover:border-slate-500'}`}
                                >
                                  B
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, italic: !newChannel.subtitle_style.italic } })}
                                  className={`flex-1 py-2.5 rounded-xl text-sm italic font-bold border transition-colors ${newChannel.subtitle_style.italic ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[#1b2230] border-[#2b374d] text-slate-300 hover:border-slate-500'}`}
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
                                    className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${(newChannel.subtitle_style.text_case || 'none') === id ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[#1b2230] border-[#2b374d] text-slate-300 hover:border-slate-500'}`}
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
                                    className={`py-2.5 rounded-xl border transition-colors flex items-center justify-center ${(newChannel.subtitle_style.align || 'center') === id ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[#1b2230] border-[#2b374d] text-slate-300 hover:border-slate-500'}`}
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
                                    className={`py-2 rounded-xl text-[10px] font-bold border transition-colors ${(newChannel.subtitle_style.highlight_mode || 'word') === id ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]' : 'bg-[#1b2230] border-[#2b374d] text-slate-300 hover:border-slate-500'}`}
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
                        <div ref={wizardSubtitlePreviewRef} className="w-full aspect-video rounded-2xl bg-gradient-to-b from-slate-900 to-black border border-[#2b374d] relative overflow-hidden px-6">
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

                {/* STEP 3: MUSIQUE DE FOND & AUDIO */}
                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-white">3. Musique de Fond Ambiante & Auto-Ducking</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* OPTION A: MES PROPRES MUSIQUES */}
                      <div
                        onClick={() => setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, mode: 'library' } })}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer space-y-4 flex flex-col ${
                          (newChannel.music_preference.mode || 'library') === 'library'
                            ? 'bg-[#1b2230] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10'
                            : 'bg-[#141923] border-[#263042] hover:border-slate-500 opacity-60'
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
                          className="border-2 border-dashed border-[#2b374d] hover:border-[#00c2ff] rounded-xl p-4 text-center cursor-pointer transition-colors"
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

                      {/* OPTION B: GÉNÉRER AVEC L'IA */}
                      <div
                        onClick={() => setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, mode: 'ai_generate' } })}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer space-y-4 flex flex-col ${
                          newChannel.music_preference.mode === 'ai_generate'
                            ? 'bg-[#1b2230] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10'
                            : 'bg-[#141923] border-[#263042] hover:border-slate-500 opacity-60'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[#00c2ff] text-[24px]">auto_awesome</span>
                            <h4 className="font-bold text-white text-xs">Générer avec l'IA</h4>
                          </div>
                          <p className="text-[11px] text-slate-400">NicheCut écrit le prompt à partir de la niche (et du script), puis IziVoice génère la musique.</p>
                        </div>

                        <div onClick={(e) => e.stopPropagation()}>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">Prompt musical personnalisé (optionnel)</label>
                          <textarea
                            rows="2"
                            value={newChannel.music_preference.ai_prompt || ''}
                            onChange={e => setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, ai_prompt: e.target.value } })}
                            className="w-full bg-[#0f1217] border border-[#2b374d] rounded-xl p-2.5 text-[11px] text-white focus:border-[#00c2ff] outline-none placeholder-slate-500"
                            placeholder="Ex : piano doux, ambiance méditative, tempo lent... (laisse vide pour un prompt automatique)"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleGenerateMusicPreview(); }}
                          disabled={aiMusicGenerating}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00c2ff] text-slate-950 font-bold text-xs hover:bg-[#38d0ff] transition-all disabled:opacity-50"
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

                {/* STEP 4: VISUELS & SOURCES D'IMAGES (OPTION A & OPTION B COCHABLES) */}
                {wizardStep === 4 && (() => {
                  const isOptionAChecked = newChannel.image_style.source === 'library' || newChannel.image_style.source === 'hybrid';
                  const isOptionBChecked = newChannel.image_style.source === 'ai_generated' || newChannel.image_style.source === 'hybrid';

                  const toggleOptionA = () => {
                    let nextA = !isOptionAChecked;
                    let nextB = isOptionBChecked;
                    if (!nextA && !nextB) nextA = true;
                    let source = nextA && nextB ? 'hybrid' : nextA ? 'library' : 'ai_generated';
                    setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, source } });
                  };

                  const toggleOptionB = () => {
                    let nextA = isOptionAChecked;
                    let nextB = !isOptionBChecked;
                    if (!nextA && !nextB) nextB = true;
                    let source = nextA && nextB ? 'hybrid' : nextA ? 'library' : 'ai_generated';
                    setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, source } });
                  };

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
                              ? 'bg-[#1b2230] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10'
                              : 'bg-[#141923] border-[#263042] hover:border-slate-500 opacity-60'
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
                              isFolderDragging ? 'border-[#00c2ff] bg-[#00c2ff]/10' : 'border-[#2b374d] hover:border-[#00c2ff] bg-[#0f1217]/60'
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
                          </div>
                        </div>

                        {/* OPTION B: GÉNÉRATION IA AUTOMATIQUE */}
                        <div 
                          onClick={toggleOptionB}
                          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer space-y-4 flex flex-col justify-between ${
                            isOptionBChecked
                              ? 'bg-[#1b2230] border-[#00c2ff] shadow-lg shadow-[#00c2ff]/10'
                              : 'bg-[#141923] border-[#263042] hover:border-slate-500 opacity-60'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="material-symbols-outlined text-[#00c2ff] text-[24px]">auto_awesome</span>
                                <h4 className="font-bold text-white text-xs">Option B: Génération IA Automatique</h4>
                              </div>
                              <input 
                                type="checkbox"
                                checked={isOptionBChecked}
                                onChange={toggleOptionB}
                                className="w-5 h-5 accent-[#00c2ff] cursor-pointer rounded"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400">
                              L'IA génère automatiquement les visuels pour chaque scène, dans le style que tu décris ci-dessous.
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold text-slate-300">Décris le style visuel que tu veux</label>
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
                                  {styleAnalyzing ? 'Analyse...' : "Analyser une image de référence"}
                                </button>
                              </div>
                            </div>
                            <textarea
                              rows="2"
                              value={newChannel.image_style.style_prompt}
                              onChange={e => setNewChannel({ ...newChannel, image_style: { ...newChannel.image_style, style_prompt: e.target.value } })}
                              className="w-full bg-[#0f1217] border border-[#2b374d] rounded-xl p-2.5 text-[11px] text-white focus:border-[#00c2ff] outline-none placeholder-slate-500"
                              placeholder="Ex: cinematic lighting, stoic sculpture style, dark moody atmosphere..."
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
                                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#1b2230] text-slate-300 hover:bg-[#00c2ff]/10 hover:text-[#00c2ff] border border-[#2b374d] transition-colors"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1.5">Ce style guide chaque image générée — plus c'est précis, plus le résultat est cohérent d'une vidéo à l'autre.</p>
                          </div>
                        </div>

                      </div>

                      {isOptionAChecked && isOptionBChecked && (
                        <div className="bg-[#00c2ff]/10 border border-[#00c2ff]/30 p-3 rounded-xl flex items-center gap-2.5 text-xs text-[#00c2ff]">
                          <span className="material-symbols-outlined text-[20px]">info</span>
                          <span><strong>Mode Hybride activé !</strong> Le système utilisera vos images locales prioritaires et l'IA pour compléter les scènes manquantes.</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* STEP 5: EFFETS VISUELS — réglages + un aperçu dédié aux effets seuls
                    (couleur/texture sur une vraie image), distinct de l'Aperçu Final complet
                    de l'étape 6 qui montre tous les réglages ensemble (sous-titres, logo...). */}
                {wizardStep === 5 && (() => {
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

                  const previewImgSrc = localImageFiles.length > 0
                    ? URL.createObjectURL(localImageFiles[0])
                    : (wizardMode === 'edit' && activeChannel ? `${API_BASE}/channels/${activeChannel.id}/library-preview` : null);

                  const colorGradeFilter = ({
                    warm: 'saturate(1.25) sepia(0.12) brightness(1.05)',
                    vintage: 'saturate(0.75) sepia(0.2) contrast(1.05)',
                    dramatic: 'contrast(1.3) saturate(0.85)',
                    none: 'none',
                  })[colorGrade] || 'none';

                  return (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-bold text-white">5. Effets Visuels</h3>
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
                              ].map(({ id, label }) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setNewChannel({ ...newChannel, effects_config: { ...newChannel.effects_config, color_grade: id } })}
                                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                    colorGrade === id
                                      ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]'
                                      : 'bg-[#1b2230] border-[#2b374d] text-slate-300 hover:border-slate-500'
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
                              ].map(({ id, label }) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => toggleOverlayEffect(id)}
                                  aria-pressed={overlayEffects.includes(id)}
                                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                                    overlayEffects.includes(id)
                                      ? 'bg-[#00c2ff]/10 border-[#00c2ff] text-[#00c2ff]'
                                      : 'bg-[#1b2230] border-[#2b374d] text-slate-300 hover:border-slate-500'
                                  }`}
                                >
                                  {overlayEffects.includes(id) && <span className="material-symbols-outlined text-[14px]">check</span>}
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {(hasGrain || hasVignette) && (
                            <div className="pt-2 border-t border-[#263042] space-y-4">
                              <label className="block text-xs font-bold text-[#00c2ff]">Intensité</label>
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
                          )}
                        </div>

                        <div className="lg:sticky lg:top-4">
                          <label className="block text-xs font-bold text-slate-300 mb-2">Aperçu des effets</label>
                          <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-[#2b374d] bg-[#0f1217]">
                            {previewImgSrc ? (
                              <img src={previewImgSrc} alt="Aperçu des effets" className="w-full h-full object-cover" style={{ filter: colorGradeFilter }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-center px-6">
                                <p className="text-xs text-slate-500">Importe un dossier d'images à l'étape "Visuels" pour voir l'aperçu sur une vraie image de ta chaîne.</p>
                              </div>
                            )}
                            {hasGrain && (
                              <div
                                className="absolute inset-0 mix-blend-overlay"
                                style={{
                                  opacity: (overlayEffects.includes('white_noise') && !overlayEffects.includes('grain') ? 0.6 : 0.3) * grainIntensity,
                                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
                                }}
                              />
                            )}
                            {hasVignette && (
                              <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 ${60 * vignetteIntensity}px ${20 * vignetteIntensity}px rgba(0,0,0,0.8)` }} />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2">Aperçu approximatif — le rendu final vidéo peut légèrement varier.</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* STEP 6: APERÇU FINAL DU DESIGN VIDÉO (LIVE 16:9 LANDSCAPE PREVIEW) */}
                {wizardStep === 6 && (() => {
                  const userImagePreview = localImageFiles.length > 0 ? URL.createObjectURL(localImageFiles[0]) : null;
                  const stepOverlayEffects = newChannel.effects_config.overlay_effects || ['grain'];
                  const stepHasGrain = stepOverlayEffects.includes('grain') || stepOverlayEffects.includes('white_noise');
                  const stepHasVignette = stepOverlayEffects.includes('vignette');
                  const stepGrainIntensity = (newChannel.effects_config.grain_intensity ?? 50) / 100;
                  const stepVignetteIntensity = (newChannel.effects_config.vignette_intensity ?? 50) / 100;
                  const resolvedLogoUrl = logoPreviewUrl || (wizardMode === 'edit' && activeChannel && getChannelLogoUrl(activeChannel) !== "/assets/logo/logo-nichecut.png" ? getChannelLogoUrl(activeChannel) : null);
                  const musicLabel = musicFiles[0]?.name
                    || newChannel.music_preference?.tracks?.[0]?.split('/').pop()?.replace(/^[0-9a-f]{8}_/, '')
                    || (newChannel.music_preference?.mode === 'ai_generate' ? 'Musique générée par IA' : null);
                  const recapItems = [
                    { id: 'logo', label: 'Logo de la chaîne', icon: 'workspace_premium', available: !!resolvedLogoUrl },
                    { id: 'subtitles', label: 'Sous-titres', icon: 'subtitles', available: true },
                    { id: 'effects', label: 'Effets visuels', icon: 'auto_awesome', available: stepHasGrain || stepHasVignette || (newChannel.effects_config.color_grade && newChannel.effects_config.color_grade !== 'none') },
                    { id: 'visual', label: 'Visuel de fond', icon: 'image', available: !!(userImagePreview || (wizardMode === 'edit' && activeChannel)) },
                    { id: 'music', label: 'Musique de fond', icon: 'music_note', available: !!musicLabel },
                  ];
                  // Logo/sous-titres/effets/musique are real, saved settings — toggling them
                  // here actually edits `newChannel` (persisted on save), same as any other
                  // field in the wizard. Only "visual" has no real off-switch (a video always
                  // needs a background), so it stays a local, cosmetic preview-only toggle.
                  const isRecapChecked = (id) => {
                    if (id === 'logo') return newChannel.branding.logo_enabled ?? true;
                    if (id === 'subtitles') return newChannel.subtitle_style.enabled ?? true;
                    if (id === 'effects') return newChannel.effects_config.enabled ?? true;
                    if (id === 'music') return newChannel.music_preference.enabled ?? true;
                    return recapVisible.visual;
                  };
                  const toggleRecap = (id) => {
                    if (id === 'logo') return setNewChannel({ ...newChannel, branding: { ...newChannel.branding, logo_enabled: !isRecapChecked('logo') } });
                    if (id === 'subtitles') return setNewChannel({ ...newChannel, subtitle_style: { ...newChannel.subtitle_style, enabled: !isRecapChecked('subtitles') } });
                    if (id === 'effects') return setNewChannel({ ...newChannel, effects_config: { ...newChannel.effects_config, enabled: !isRecapChecked('effects') } });
                    if (id === 'music') return setNewChannel({ ...newChannel, music_preference: { ...newChannel.music_preference, enabled: !isRecapChecked('music') } });
                    setRecapVisible(prev => ({ ...prev, visual: !prev.visual }));
                  };
                  return (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-base font-bold text-white">6. Aperçu Final du Layout & Design Vidéo</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Voici le rendu final simulé, au format vidéo longue durée YouTube (16:9).</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-8 items-center">
                        {/* Layers — vertical, ordered back-to-front like the real composite.
                            Decocher un calque le masque dans l'aperçu à droite, sans rien
                            changer à la configuration réelle de la chaîne. */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-300 mb-3">Calques (arrière-plan → premier plan)</label>
                          <div className="relative pl-2">
                            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-[#2b374d]"></div>
                            {recapItems.map(({ id, label, icon, available }, idx) => (
                              <button
                                key={id}
                                type="button"
                                disabled={!available}
                                onClick={() => toggleRecap(id)}
                                className={`relative z-10 w-full mb-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2.5 text-left ${
                                  !available
                                    ? 'bg-[#1b2230]/50 border-[#2b374d]/50 text-slate-600 cursor-not-allowed'
                                    : isRecapChecked(id)
                                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                                      : 'bg-[#1b2230] border-[#2b374d] text-slate-500 hover:border-slate-500'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px] shrink-0">{icon}</span>
                                <span className="flex-1 truncate">{label}</span>
                                <span className="material-symbols-outlined text-[16px] shrink-0">{available && isRecapChecked(id) ? 'check_box' : 'check_box_outline_blank'}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Live 16:9 Landscape Video Mockup Preview */}
                        <div className="flex justify-center">
                        <div ref={mockupSubtitlePreviewRef} className="w-full max-w-[640px] aspect-[16/9] bg-slate-950 rounded-2xl border-4 border-[#2b374d] relative overflow-hidden shadow-2xl flex flex-col justify-between p-5">

                          {/* Background Scene Visual — a freshly picked file from this wizard
                              session takes priority; otherwise fall back to a real random image
                              already stored server-side for this channel (not a generic stock photo). */}
                          <div className="absolute inset-0">
                            {!isRecapChecked('visual') ? null : userImagePreview ? (
                              <img
                                src={userImagePreview}
                                alt="Aperçu visuel de la vidéo"
                                className="w-full h-full object-cover opacity-85"
                              />
                            ) : newChannel.image_style.source !== 'ai_generated' && wizardMode === 'edit' && activeChannel ? (
                              <img
                                key={activeChannel.id}
                                src={`${API_BASE}/channels/${activeChannel.id}/library-preview`}
                                alt="Aperçu visuel de la vidéo"
                                className="w-full h-full object-cover opacity-85"
                                onError={(event) => { event.currentTarget.style.display = 'none'; }}
                              />
                            ) : null}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30"></div>
                          </div>

                          {isRecapChecked('effects') && stepHasGrain && (
                            <div
                              className="absolute inset-0 mix-blend-overlay z-10"
                              style={{
                                opacity: (stepOverlayEffects.includes('white_noise') && !stepOverlayEffects.includes('grain') ? 0.6 : 0.3) * stepGrainIntensity,
                                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
                              }}
                            />
                          )}
                          {isRecapChecked('effects') && stepHasVignette && (
                            <div className="absolute inset-0 z-10" style={{ boxShadow: `inset 0 0 ${60 * stepVignetteIntensity}px ${20 * stepVignetteIntensity}px rgba(0,0,0,0.8)` }} />
                          )}

                          {/* Top-right logo — matches exactly what's burned into the real render. */}
                          <div className="relative z-20 flex justify-end items-start">
                            {isRecapChecked('logo') && resolvedLogoUrl && (
                              <img
                                src={resolvedLogoUrl}
                                alt="Logo"
                                style={{ width: `${160 * mockupSubtitlePreviewScale}px`, height: `${160 * mockupSubtitlePreviewScale}px` }}
                                className="object-cover shadow-lg"
                              />
                            )}
                          </div>

                          {/* Bottom-left music cue — informational only, not burned into the real render. */}
                          {isRecapChecked('music') && musicLabel && (
                            <div className="relative z-20 flex items-center gap-1.5 text-[10px] font-bold text-white/90 bg-black/50 backdrop-blur-sm px-2.5 py-1.5 rounded-lg w-fit">
                              <span className="material-symbols-outlined text-[14px]">music_note</span>
                              <span className="truncate max-w-[160px]">{musicLabel}</span>
                            </div>
                          )}

                          {/* Animated subtitle at the exact configured vertical position */}
                          {isRecapChecked('subtitles') && (
                          <div className={`absolute inset-x-5 z-20 flex justify-center ${subtitlePositionClass(newChannel.subtitle_style.position)}`}>
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

                {/* Wizard Footer Navigation */}
                <div className="flex justify-between items-center pt-6 border-t border-[#263042]">
                  {wizardStep > 1 ? (
                    <button
                      onClick={() => setWizardStep(wizardStep - 1)}
                      className="px-6 py-2.5 rounded-xl bg-[#1b2230] text-white font-bold text-xs hover:bg-[#252f42] transition-colors"
                    >
                      Retour
                    </button>
                  ) : <div></div>}

                  <div className="flex items-center gap-3">
                    {/* In edit mode the pipeline already exists — no need to click through
                        every step just to save a change made on this one. Create mode keeps
                        the guided step-by-step flow since nothing's configured yet. */}
                    {wizardMode === 'edit' && wizardStep < 6 && (
                      <button
                        onClick={handleSaveChannel}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-md disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[18px]">check</span>
                        {loading ? "Enregistrement..." : "Enregistrer et quitter"}
                      </button>
                    )}

                    {wizardStep < 6 ? (
                    <button
                      onClick={() => {
                        const needsLibrary = newChannel.image_style.source === 'library' || newChannel.image_style.source === 'hybrid';
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
          </div>
        </div>
      </main>

      {/* NOUVELLE VIDÉO MAIN ACTION MODAL */}
      {showSubmitModal && activeChannel && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-[#161b22] border border-[#263042] rounded-3xl p-8 max-w-[620px] w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-[#263042] pb-4">
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

            {/* Active Channel (read-only — already chosen before opening this modal) */}
            <div className="bg-[#11151c] border border-[#202938] rounded-2xl p-3">
              <div className="text-sm font-bold text-white truncate">{activeChannel.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{activeChannel.niche}</div>
            </div>

            {submitStep === 1 ? (
              <>
                {/* Input Mode Selector */}
                <div className="grid grid-cols-2 gap-3 bg-[#11151c] p-1.5 rounded-xl border border-[#202938]">
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

                {/* Voice Model Selection */}
                {submitMode === 'text' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">Modèle de Voix Off IA</label>
                    <select
                      value={selectedVoice}
                      onChange={e => setSelectedVoice(e.target.value)}
                      className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl px-4 py-2.5 text-xs text-white focus:border-[#00c2ff] outline-none"
                    >
                      {VOICE_MODELS.map(v => (
                        <option key={v.id} value={v.id}>{v.name} — {v.desc}</option>
                      ))}
                    </select>
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
                      className="w-full bg-[#1b2230] border border-[#2b374d] rounded-2xl p-4 text-xs text-white focus:border-[#00c2ff] outline-none placeholder-slate-500"
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
                      isDragging ? 'border-[#00c2ff] bg-[#00c2ff]/10' : 'border-[#2b374d] hover:border-slate-400 bg-[#11151c]'
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

                {/* Go to preview step */}
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
              </>
            ) : (
              <>
                {/* Confirmation / preview summary before launching the render */}
                <div className="space-y-3">
                  {submitMode === 'text' && (
                    <div className="flex items-center justify-between bg-[#11151c] border border-[#202938] rounded-xl p-3">
                      <span className="text-xs text-slate-400">Voix off</span>
                      <span className="text-xs font-bold text-white">{VOICE_MODELS.find(v => v.id === selectedVoice)?.name || selectedVoice}</span>
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
                      { id: 'visual', label: 'Visuel de fond', icon: 'image', checked: recapVisible.visual },
                      { id: 'music', label: 'Musique de fond', icon: 'music_note', group: 'music_preference', field: 'enabled', checked: activeChannel.music_preference?.enabled ?? true },
                    ].map(({ id, label, icon, group, field, checked }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => group ? toggleActiveChannelFlag(group, field) : setRecapVisible(prev => ({ ...prev, visual: !prev.visual }))}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2.5 text-left ${
                          checked
                            ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                            : 'bg-[#1b2230] border-[#2b374d] text-slate-500 hover:border-slate-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] shrink-0">{icon}</span>
                        <span className="flex-1 truncate">{label}</span>
                        <span className="material-symbols-outlined text-[16px] shrink-0">{checked ? 'check_box' : 'check_box_outline_blank'}</span>
                      </button>
                    ))}
                  </div>

                  {/* Real visual mockup of the final rendered frame: background style,
                      subtitle font/color/outline/position, and active effects — everything
                      exactly as configured on the channel, not just a text summary. */}
                  <div>
                    <div className="text-xs text-slate-400 mb-2">Aperçu visuel du rendu final</div>
                    <div ref={submitSubtitlePreviewRef} className="w-full aspect-video rounded-2xl overflow-hidden relative border border-[#2b374d] shadow-lg">
                      {recapVisible.visual && activeChannel.image_style?.source !== 'ai_generated' && (
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
                      {(activeChannel.branding?.logo_enabled ?? true) && getChannelLogoUrl(activeChannel) !== "/assets/logo/logo-nichecut.png" && (
                        <div className="absolute top-3 right-3 z-20">
                          <img
                            src={getChannelLogoUrl(activeChannel)}
                            alt="Logo"
                            style={{ width: `${160 * submitSubtitlePreviewScale}px`, height: `${160 * submitSubtitlePreviewScale}px` }}
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

                  <div className="bg-[#11151c] border border-[#202938] rounded-xl p-3">
                    <div className="text-xs text-slate-400 mb-2">{submitMode === 'text' ? 'Aperçu du script' : `Fichiers audio (${audioFilesList.length})`}</div>
                    {submitMode === 'text' ? (
                      <p className="text-xs text-white line-clamp-4">{singleScriptText}</p>
                    ) : (
                      // No full waveform player here — this audio becomes the video's own
                      // narration track, playable directly once the render is done; a
                      // second full-length player at this step just wastes space.
                      <div className="space-y-1.5">
                        {audioFilesList.map((f, i) => (
                          <div key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2.5 text-xs text-white bg-[#161b22] border border-[#202938] rounded-lg px-3 py-2">
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

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSubmitStep(1)}
                    disabled={loading}
                    className="flex-1 py-3 bg-[#1b2230] text-white rounded-xl font-bold text-sm hover:bg-[#252f42] transition-colors border border-[#2b374d]"
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
              </>
            )}
          </div>
        </div>
      )}

      {/* VIDEO PLAYER MODAL */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-[#161b22] border border-[#263042] rounded-3xl p-6 max-w-[min(1200px,92vw)] w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Aperçu Vidéo Rendu</h3>
              <button onClick={() => setSelectedVideo(null)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="aspect-[16/9] max-h-[80vh] mx-auto rounded-2xl overflow-hidden border border-[#263042]">
              <VideoPlayer
                src={getVideoUrl(selectedVideo.output_path)}
                className="w-full h-full"
                autoPlay
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setDownloadModalVideo(selectedVideo)}
                className="w-full py-3 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl text-center hover:bg-[#38d0ff] transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">download</span> Télécharger MP4
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOWNLOAD QUALITY MODAL */}
      {downloadModalVideo && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-[#161b22] border border-[#263042] rounded-3xl p-6 max-w-[420px] w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Télécharger la vidéo</h3>
              <button
                onClick={() => { if (!downloadingQuality) setDownloadModalVideo(null); }}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">Format MP4. Choisissez la qualité d'export.</p>

            <div className="space-y-2.5">
              {[
                { key: 'sd', label: 'SD', detail: '854×480 — fichier léger, partage rapide' },
                { key: 'hd', label: 'HD', detail: '1920×1080 — qualité native du rendu' },
              ].map(opt => (
                <button
                  key={opt.key}
                  disabled={!!downloadingQuality}
                  onClick={() => runDownload(downloadModalVideo, opt.key)}
                  className="w-full flex items-center justify-between p-3.5 bg-[#1b2230] hover:bg-[#252f42] border border-[#2b374d] rounded-2xl transition-all disabled:opacity-50 text-left"
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
            </div>
          </div>
        </div>
      )}

      {/* USER AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-[#161b22] border border-[#263042] rounded-3xl p-8 max-w-[440px] w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-extrabold text-white">
                {authTab === 'login' && 'Connexion'}
                {authTab === 'register' && 'Inscription'}
                {authTab === 'forgot' && 'Mot de passe oublié'}
              </h3>
              {currentUser && (
                <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>
            {!currentUser && (
              <p className="text-[11px] text-slate-500 -mt-3">Un compte est requis pour accéder au tableau de bord.</p>
            )}

            {authTab !== 'forgot' && (
              <div className="flex bg-[#1b2230] p-1 rounded-xl border border-[#2b374d]">
                <button
                  type="button"
                  onClick={() => setAuthTab('login')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    authTab === 'login' ? 'bg-[#00c2ff] text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('register')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    authTab === 'register' ? 'bg-[#00c2ff] text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Inscription
                </button>
              </div>
            )}

            {authTab === 'forgot' ? (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <p className="text-xs text-slate-400 -mt-2">
                  Saisissez votre email et un nouveau mot de passe pour réinitialiser votre accès.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Adresse Email</label>
                  <input
                    type="email"
                    required
                    value={forgotForm.email}
                    onChange={e => setForgotForm({ ...forgotForm, email: e.target.value })}
                    className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none"
                    placeholder="nom@exemple.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showAuthPassword ? "text" : "password"}
                      required
                      minLength={4}
                      value={forgotForm.newPassword}
                      onChange={e => setForgotForm({ ...forgotForm, newPassword: e.target.value })}
                      className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl p-3 pr-10 text-xs text-white focus:border-[#00c2ff] outline-none"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      tabIndex={-1}
                    >
                      <span className="material-symbols-outlined text-[18px]">{showAuthPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl hover:bg-[#38d0ff] transition-all mt-4"
                >
                  Réinitialiser le mot de passe
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('login')}
                  className="w-full text-center text-xs text-slate-400 hover:text-white font-medium"
                >
                  ← Retour à la connexion
                </button>
              </form>
            ) : (
              <>
                {GOOGLE_CLIENT_ID ? (
                  <div ref={googleButtonRef} className="w-full flex justify-center min-h-[44px]" />
                ) : (
                  <div className="w-full py-3 bg-[#1b2230] text-slate-500 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-[#2b374d]">
                    Connexion Google indisponible
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="h-px bg-[#263042] flex-1" />
                  <span className="text-[10px] text-slate-500 font-bold">OU</span>
                  <div className="h-px bg-[#263042] flex-1" />
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Adresse Email</label>
                    <input
                      type="email"
                      required
                      value={authForm.email}
                      onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                      className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none"
                      placeholder="nom@exemple.com"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-300">Mot de passe</label>
                      {authTab === 'login' && (
                        <button
                          type="button"
                          onClick={() => { setForgotForm({ email: authForm.email, newPassword: '' }); setAuthTab('forgot'); }}
                          className="text-[11px] text-[#00c2ff] hover:underline font-semibold"
                        >
                          Mot de passe oublié ?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showAuthPassword ? "text" : "password"}
                        required
                        value={authForm.password}
                        onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                        className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl p-3 pr-10 text-xs text-white focus:border-[#00c2ff] outline-none"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAuthPassword(!showAuthPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        tabIndex={-1}
                      >
                        <span className="material-symbols-outlined text-[18px]">{showAuthPassword ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#00c2ff] text-slate-950 font-bold text-xs rounded-xl hover:bg-[#38d0ff] transition-all mt-4"
                  >
                    {authTab === 'register' ? "Créer mon compte" : "Se connecter"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* USER PROFILE & SETTINGS MODAL (INTEGRATED PARAMÈTRES & PROFIL) */}
      {showProfileModal && currentUser && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-[#161b22] border border-[#263042] rounded-3xl max-w-[720px] w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex justify-between items-center border-b border-[#263042] p-6 pb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl overflow-hidden bg-[#00c2ff] text-slate-950 flex items-center justify-center font-extrabold text-lg shadow-md flex-shrink-0">
                  {currentUser.picture_url ? (
                    <img src={currentUser.picture_url} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    currentUser.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">Paramètres</h3>
                  <p className="text-xs text-slate-400">{currentUser.email}</p>
                </div>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Settings side nav */}
              <div className="w-[180px] border-r border-[#263042] p-3 space-y-1 flex-shrink-0">
                {[
                  { id: 'profile', label: 'Profil', icon: 'person' },
                  { id: 'security', label: 'Sécurité', icon: 'lock' },
                  { id: 'api', label: 'Clés API', icon: 'key' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                      settingsTab === tab.id ? 'bg-[#00c2ff]/10 text-[#00c2ff]' : 'text-slate-400 hover:bg-[#1b2230] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
                <div className="pt-2 mt-2 border-t border-[#263042]">
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
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                        className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Adresse Email</label>
                      <input
                        value={currentUser.email}
                        disabled
                        className="w-full bg-[#11151c] border border-[#2b374d] rounded-xl p-3 text-xs text-slate-500 outline-none cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Numéro de téléphone</label>
                      <input
                        value={profileForm.phone}
                        onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="+33 6 12 34 56 78"
                        className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none"
                      />
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
                      <div className="bg-[#11151c] border border-[#202938] rounded-xl p-4 flex items-start gap-3">
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
                            className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl p-3 text-xs text-white focus:border-[#00c2ff] outline-none"
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
                              className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl p-3 pr-10 text-xs text-white focus:border-[#00c2ff] outline-none"
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

                    <div className="pt-5 border-t border-[#263042]">
                      <h4 className="text-xs font-bold text-white mb-1">Authentification à deux facteurs</h4>
                      <p className="text-[11px] text-slate-400 mb-3">
                        {currentUser.auth_provider === 'google'
                          ? "Activez la validation en 2 étapes depuis votre compte Google — elle protège aussi votre connexion à NicheCut."
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
                      <p className="text-[11px] text-slate-400">Utilisez une clé API pour intégrer NicheCut à vos propres outils (génération programmatique de vidéos).</p>
                    </div>

                    {justCreatedApiKey && (
                      <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-3 space-y-2">
                        <p className="text-[11px] text-emerald-300 font-bold">Copiez cette clé maintenant — elle ne sera plus jamais affichée.</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-[11px] font-mono text-white bg-black/40 rounded-lg p-2 overflow-x-auto whitespace-nowrap">{justCreatedApiKey.key}</code>
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(justCreatedApiKey.key); showToast("Clé copiée.", "success"); }}
                            className="p-2 bg-[#1b2230] hover:bg-[#252f42] rounded-lg text-white flex-shrink-0"
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
                        className="flex-1 bg-[#1b2230] border border-[#2b374d] rounded-xl p-2.5 text-xs text-white focus:border-[#00c2ff] outline-none"
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
                          <div key={key.id} className="flex items-center justify-between bg-[#11151c] border border-[#202938] rounded-xl p-3">
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHANNEL PICKER MODAL (when Nouvelle Vidéo clicked without active channel preset) */}
      {showChannelPickerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-[#161b22] border border-[#263042] rounded-3xl p-8 max-w-[480px] w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-[#263042] pb-4">
              <h3 className="text-base font-extrabold text-white">Choisir une chaîne pour la vidéo</h3>
              <button onClick={() => setShowChannelPickerModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {channels.map(chan => (
                <div
                  key={chan.id}
                  onClick={() => {
                    setActiveChannel(chan);
                    setShowChannelPickerModal(false);
                    setShowSubmitModal(true);
                  }}
                  className="p-4 bg-[#1b2230] hover:bg-[#252f42] border border-[#2b374d] rounded-2xl cursor-pointer flex items-center gap-4 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#00c2ff] text-slate-950 flex items-center justify-center font-bold text-sm">
                    {chan.name.slice(0, 2).toUpperCase()}
                  </div>
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

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
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
        </div>
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
            <div className="bg-[#161b22] border border-[#263042] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-[#263042] space-y-3 flex-shrink-0">
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
                    className="w-full bg-[#1b2230] border border-[#2b374d] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-[#00c2ff] outline-none"
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
                              isActive ? 'bg-[#00c2ff]/10 border border-[#00c2ff]' : 'hover:bg-[#1b2230] border border-transparent'
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
          <div className="bg-[#161b22] border border-[#263042] rounded-3xl p-7 max-w-[420px] w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${confirmDialog.danger ? 'bg-rose-950 text-rose-300' : 'bg-[#1b2230] text-[#00c2ff]'}`}>
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
                className="px-4 py-2.5 bg-[#1b2230] text-slate-300 border border-[#2b374d] rounded-xl font-bold text-xs hover:bg-[#232c3a] transition-all"
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
