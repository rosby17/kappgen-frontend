import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  AudioLines,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Clapperboard,
  Clock3,
  Download,
  Film,
  History,
  LoaderCircle,
  MessageSquare,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Subtitles,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import "./FacecamStudio.css";
import Workshop from "./Workshop";

import { DEFAULT_SETTINGS } from './settings';

const STATUS = {
  queued: "En attente",
  rendering: "Montage en cours",
  review: "À valider",
  done: "Prête à exporter",
  failed: "À reprendre",
  cancelled: "Arrêtée",
};
const TOOLS = [
  ["cuts", Scissors, "Coupes"],
  ["captions", Subtitles, "Texte"],
  ["visuals", Sparkles, "Habillage"],
  ["brand", Palette, "Charte"],
  ["notes", MessageSquare, "Retours"],
  ["versions", History, "Versions"],
];
const STAGES = [
  ["transcription", "Transcrire"],
  ["cuts", "Monter"],
  ["verification", "Vérifier"],
  ["broll_and_cards", "Habiller"],
  ["final_mux", "Exporter"],
];
const timecode = (value = 0) => {
  const n = Math.max(0, Number(value) || 0);
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}.${Math.floor((n % 1) * 10)}`;
};
const when = (value) =>
  value
    ? new Date(
        value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value)
          ? value
          : `${value}Z`,
      ).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    : "";
const effectiveCut = (cut, settings) =>
  cut.enabled &&
  (cut.kind === "silence"
    ? settings.silences
    : cut.kind === "manual" || settings.mistakes);
function removedDuration(cuts, settings) {
  let end = 0;
  let total = 0;
  for (const c of [...cuts]
    .filter((c) => effectiveCut(c, settings))
    .sort((a, b) => a.start - b.start)) {
    total += Math.max(0, c.end - Math.max(end, c.start));
    end = Math.max(end, c.end);
  }
  return total;
}
function Toggle({ label, checked, onChange, disabled }) {
  return (
    <div className="fc-choice">
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        {label}
      </label>
    </div>
  );
}
function Empty({ icon: Icon = Film, children }) {
  return (
    <div className="fc-empty">
      <Icon size={26} />
      <p>{children}</p>
    </div>
  );
}
export function FacecamGallery({ videos = [], onOpen, thumbnail }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = videos.filter(
    (v) =>
      (!query || (v.title || "").toLowerCase().includes(query.toLowerCase())) &&
      (filter === "all" || v.status === filter),
  );
  return (
    <div className="fc">
      <div className="fc-row fc-between fc-wrap" style={{ marginBottom: 16 }}>
        <h2>
          Mes montages <span className="fc-muted">· {videos.length}</span>
        </h2>
        <div className="fc-row">
          <label className="fc-row">
            <Search size={15} />
            <input
              aria-label="Rechercher un montage"
              placeholder="Rechercher…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="État des montages"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="all">Tous les états</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      {filtered.length ? (
        <div className="fc-project-grid">
          {filtered.map((v) => (
            <button
              key={v.id}
              className="fc-project-card"
              onClick={() => onOpen(v)}
            >
              <div className="fc-project-poster">
                {v.output_path && thumbnail ? (
                  <img
                    src={thumbnail(v)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.hidden = true;
                    }}
                  />
                ) : (
                  <Clapperboard size={34} strokeWidth={1} />
                )}
                <span className="fc-pill" data-status={v.status}>
                  {STATUS[v.status] || v.status}
                </span>
              </div>
              <div className="fc-project-info">
                <h3>{v.title || "Montage sans titre"}</h3>
                <div className="fc-row fc-between fc-muted">
                  <span>{when(v.created_at)}</span>
                  <span>
                    {v.duration_seconds
                      ? timecode(v.duration_seconds)
                      : v.status === "review"
                        ? "Ouvrir les propositions"
                        : "Ouvrir le studio"}{" "}
                    →
                  </span>
                </div>
                {v.status === "rendering" && (
                  <div className="fc-progress">
                    <span style={{ width: `${v.progress_percent || 3}%` }} />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty>
          {query || filter !== "all"
            ? "Aucun montage ne correspond à cette recherche."
            : "Tes montages apparaîtront ici. Commence par importer tes rushs."}
        </Empty>
      )}
    </div>
  );
}

export function FacecamHome({
  channels,
  channelId,
  setChannelId,
  title,
  setTitle,
  files,
  setFiles,
  cloudLink,
  setCloudLink,
  onCreateChannel,
  onSubmit,
  uploading,
  error,
  videos,
  onOpen,
  onViewVideos,
  thumbnail,
  settings,
  setSettings,
}) {
  const [over, setOver] = useState(false);
  const addFiles = (incoming) =>
    setFiles((prev) => [
      ...prev,
      ...Array.from(incoming).filter((f) =>
        /\.(mp4|mov|mkv|webm)$/i.test(f.name),
      ),
    ]);
  const move = (i, delta) =>
    setFiles((prev) => {
      const next = [...prev];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });
  return (
    <div className="fc fc-home">
      <div className="fc-home-header fc-row fc-between fc-wrap">
        <div>
          <div className="fc-eyebrow">KappGen / Facecam</div>
          <h1>
            Ta présence.
            <br />
            Un montage à ton image.
          </h1>
          <p className="fc-muted">
            Des rushs aux dernières retouches. Un studio pour donner du rythme à
            tes idées et garder la main sur chaque détail.
          </p>
        </div>
        <div className="fc-stats">
          <div className="fc-stat">
            <strong>
              {videos.filter((v) => v.status === "review").length}
            </strong>
            <span>à valider</span>
          </div>
          <div className="fc-stat">
            <strong>{videos.filter((v) => v.status === "done").length}</strong>
            <span>prêts à exporter</span>
          </div>
        </div>
      </div>
      <div className="fc-import-grid">
        <section className="fc-panel fc-stack fc-import-form">
          <div className="fc-row fc-between">
            <h2>Nouveau montage</h2>
            <span className="fc-pill">01 / Importer</span>
          </div>
          <div className="fc-row">
            <label style={{ flex: 1 }}>
              Chaîne
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                disabled={uploading}
              >
                <option value="">Choisir une chaîne</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="fc-btn"
              onClick={onCreateChannel}
              style={{ alignSelf: "end" }}
            >
              <Plus size={15} />
              Créer
            </button>
          </div>
          <label>
            Titre du montage
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ma prochaine vidéo"
              maxLength={100}
              disabled={uploading}
            />
          </label>
          <div
            className="fc-drop"
            data-over={over}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (!uploading) addFiles(e.dataTransfer.files);
            }}
          >
            <Upload size={25} />
            <strong>Dépose tes rushs ici</strong>
            <span className="fc-muted">
              ou clique pour choisir · MP4, MOV, MKV, WEBM
            </span>
            <input
              aria-label="Importer les rushs vidéo"
              type="file"
              accept=".mp4,.mov,.mkv,.webm"
              multiple
              disabled={uploading}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {files.length > 0 && (
            <div>
              {files.map((f, i) => (
                <div className="fc-file" key={`${f.name}-${i}`}>
                  <span className="fc-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="fc-file-name">{f.name}</span>
                  <span className="fc-muted">
                    {Math.round(f.size / 1024 / 1024)} Mo
                  </span>
                  <button
                    className="fc-icon"
                    aria-label={`Monter ${f.name}`}
                    disabled={i === 0 || uploading}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="fc-icon"
                    aria-label={`Descendre ${f.name}`}
                    disabled={i === files.length - 1 || uploading}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    className="fc-icon"
                    aria-label={`Retirer ${f.name}`}
                    disabled={uploading}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <p className="fc-muted" style={{ fontSize: 11, marginTop: 8 }}>
                Les rushs seront assemblés dans cet ordre.
              </p>
            </div>
          )}
          <details>
            <summary className="fc-muted" style={{ cursor: "pointer" }}>
              Importer depuis un lien Drive ou Dropbox
            </summary>
            <label style={{ marginTop: 10 }}>
              Lien public
              <input
                type="url"
                placeholder="https://drive.google.com/…"
                value={cloudLink}
                onChange={(e) => setCloudLink(e.target.value)}
                disabled={uploading}
              />
            </label>
            {files.length > 0 && cloudLink && (
              <p className="fc-muted">
                Les fichiers sélectionnés seront utilisés en priorité.
              </p>
            )}
          </details>
          {error && (
            <p className="fc-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="fc-btn fc-primary"
            onClick={onSubmit}
            disabled={
              uploading || !channelId || (!files.length && !cloudLink.trim())
            }
          >
            {uploading ? <LoaderCircle size={17} /> : <Sparkles size={17} />}
            {uploading
              ? "Importation des rushs…"
              : settings.review_before_render
                ? "Préparer mon montage"
                : "Lancer le montage"}
          </button>
          <div>
            <Toggle
              label="Valider les coupes avant le rendu"
              checked={settings.review_before_render}
              onChange={(v) =>
                setSettings({ ...settings, review_before_render: v })
              }
              disabled={uploading}
            />
            <Toggle
              label="Sous-titres à mes couleurs"
              checked={settings.captions}
              onChange={(v) => setSettings({ ...settings, captions: v })}
              disabled={uploading}
            />
            <Toggle
              label="Cartes de titre animées"
              checked={settings.motion}
              onChange={(v) => setSettings({ ...settings, motion: v })}
              disabled={uploading}
            />
            <Toggle
              label="Rechercher des illustrations B-roll"
              checked={settings.broll}
              onChange={(v) => setSettings({ ...settings, broll: v })}
              disabled={uploading}
            />
          </div>
          <p className="fc-muted" style={{ fontSize: 11 }}>
            Le rendu coûte 3 000 crédits, hors appels IA et illustrations
            éventuelles. Tes rushs restent la source de chaque nouvelle version.
          </p>
        </section>
        <Workshop videos={videos} onOpen={onOpen} />
      </div>
      <div className="fc-row fc-between fc-panel"><div><h2>Mes vidéos</h2><p className="fc-muted">Retrouve tes projets, leurs propositions et leurs exports.</p></div><button type="button" className="fc-btn fc-primary" onClick={onViewVideos}>Voir mes vidéos <span className="material-symbols-outlined">arrow_forward</span></button></div>
    </div>
  );
}

export default function FacecamStudio({
  videoId,
  apiBase,
  authFetch,
  onBack,
  onChanged,
}) {
  const fetchRef = useRef(authFetch);
  fetchRef.current = authFetch;
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const [tab, setTab] = useState("cuts");
  const [version, setVersion] = useState("source");
  const [snapshot, setSnapshot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [time, setTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [manual, setManual] = useState({ start: "", end: "" });
  const [newVisual, setNewVisual] = useState({
    kind: "card",
    text: "",
    start: 0,
    duration: 3,
  });
  const player = useRef(null);
  const alive = useRef(true);
  const first = useRef(true);
  const root = `${apiBase}/videos/${videoId}/facecam`;
  const request = useCallback(async (url, options) => {
    const response = await fetchRef.current(url, options);
    const json = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        typeof json.detail === "string"
          ? json.detail
          : "Impossible de terminer cette opération.",
      );
    return json;
  }, []);
  const refresh = useCallback(
    async (force = false) => {
      const next = await request(root);
      if (!alive.current) return next;
      setData(next);
      if (force || !dirtyRef.current)
        setEdit(next.project?.revision ? structuredClone(next.project) : null);
      if (first.current) {
        first.current = false;
        if (next.versions.length && next.video.status === "done")
          setVersion(next.versions.at(-1).id);
      }
      return next;
    },
    [root, request],
  );
  useEffect(() => {
    alive.current = true;
    refresh().catch((e) => setError(e.message));
    const timer = setInterval(
      () =>
        refresh().catch((e) => {
          if (alive.current) setError(e.message);
        }),
      5000,
    );
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setTime(0);
    setMediaDuration(0);
    if (version !== "source")
      request(`${root}/versions/${version}`)
        .then((v) => {
          if (!cancelled) setSnapshot(v);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    return () => {
      cancelled = true;
    };
  }, [version, root, request]);
  useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const video = data?.video;
  const running = ["queued", "rendering"].includes(video?.status);
  const locked = busy || running || !edit;
  const settings = edit?.settings || data?.settings || DEFAULT_SETTINGS;
  const words =
    version === "source"
      ? data?.transcript?.words || []
      : snapshot?.words || [];
  const total =
    version === "source"
      ? data?.transcript?.duration || mediaDuration
      : data?.versions.find((v) => v.id === version)?.duration || mediaDuration;
  const activeCuts = edit?.cuts || [];
  const update = (fn) => {
    setEdit((prev) => fn(structuredClone(prev)));
    setDirty(true);
    dirtyRef.current = true;
    setNotice("");
  };
  const changeSetting = (key, value) =>
    update((p) => {
      p.settings[key] = value;
      return p;
    });
  const seek = (t) => {
    if (player.current) {
      player.current.currentTime = Math.max(0, Math.min(Number(t), total || 0));
      setTime(player.current.currentTime);
    }
  };
  const action = async (fn) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message || "Une erreur est survenue.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const save = async () => {
    if (!edit || !dirtyRef.current) return edit;
    const saved = await request(root, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revision: edit.revision,
        settings: edit.settings,
        cuts: edit.cuts.map(({ id, enabled }) => ({ id, enabled })),
        overlays: edit.overlays.map(
          ({ id, enabled, text, start, duration }) => ({
            id,
            enabled,
            text,
            start,
            duration,
          }),
        ),
        manual_cuts: edit.manual_cuts || [],
        new_overlays: edit.new_overlays || [],
      }),
    });
    setEdit(saved);
    setDirty(false);
    dirtyRef.current = false;
    setNotice("Modifications enregistrées.");
    return saved;
  };
  const renderVersion = (quality) =>
    action(async () => {
      const saved = await save();
      await request(`${root}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: saved.revision, quality }),
      });
      await refresh(true);
      changedRef.current?.();
      setNotice(
        quality === "master"
          ? "Export final lancé."
          : "Rendu de l’aperçu lancé.",
      );
    });
  const download = (url, name) =>
    action(async () => {
      const response = await fetchRef.current(url);
      if (!response.ok) {
        const info = await response.json().catch(() => ({}));
        throw new Error(info.detail || "Téléchargement indisponible.");
      }
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
  const leave = () => {
    if (
      !dirty ||
      window.confirm("Quitter sans enregistrer les modifications ?")
    )
      onBack();
  };
  if (!data)
    return (
      <div className="fc fc-home">
        <button className="fc-btn" onClick={onBack}>
          <ArrowLeft size={15} />
          Retour
        </button>
        {error ? (
          <p className="fc-error" role="alert" style={{ marginTop: 20 }}>
            {error}
          </p>
        ) : (
          <Empty icon={LoaderCircle}>Ouverture du studio…</Empty>
        )}
      </div>
    );
  const appliedOverlays =
    version === "source" ? edit?.overlays || [] : snapshot?.overlays || [];
  const stageIndex = STAGES.findIndex(([key]) =>
    video.progress_stage?.startsWith(key),
  );
  return (
    <div className="fc fc-editor">
      <header className="fc-editor-header">
        <div className="fc-row">
          <button
            className="fc-icon"
            onClick={leave}
            aria-label="Retour aux montages"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="fc-eyebrow" style={{ marginBottom: 5 }}>
              Facecam studio
            </div>
            <h1 className="fc-editor-title">{video.title || "Mon montage"}</h1>
          </div>
          <span className="fc-pill" data-status={video.status}>
            {STATUS[video.status]}
          </span>
        </div>
        <div className="fc-row fc-wrap">
          <button
            className="fc-btn fc-quiet"
            disabled={locked || dirty}
            title="Annuler la dernière modification enregistrée"
            onClick={() =>
              action(async () => {
                await request(`${root}/undo`, { method: "POST" });
                await refresh(true);
                setNotice("Dernière modification annulée.");
              })
            }
          >
            <Undo2 size={15} />
            Annuler
          </button>
          <button
            className="fc-btn"
            disabled={locked || !dirty}
            onClick={() => action(save)}
          >
            <Save size={15} />
            {dirty ? "Enregistrer" : "Enregistré"}
          </button>
          <button
            className="fc-btn"
            disabled={locked}
            onClick={() => renderVersion("draft")}
          >
            <CirclePlay size={15} />
            Aperçu
          </button>
          <button
            className="fc-btn fc-primary"
            disabled={locked}
            onClick={() => renderVersion("master")}
          >
            <Download size={15} />
            Exporter
          </button>
        </div>
      </header>
      {error && (
        <div className="fc-error" role="alert" style={{ margin: "12px 22px" }}>
          {error}
          <button
            className="fc-icon"
            onClick={() => setError("")}
            aria-label="Fermer l’erreur"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {notice && (
        <p role="status" style={{ color: "#34d399", padding: "12px 22px" }}>
          {notice}
        </p>
      )}
      <div className="fc-editor-grid">
        <nav className="fc-tools" role="tablist" aria-label="Outils de montage">
          {TOOLS.map(([id, Icon, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              aria-controls="fc-inspector"
              className="fc-tool"
              onClick={() => {
                setTab(id);
                if (window.matchMedia('(max-width: 900px)').matches) {
                  requestAnimationFrame(() => document.getElementById('fc-inspector')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }
              }}
            >
              <Icon size={21} strokeWidth={1.6} />
              {label}
            </button>
          ))}
        </nav>
        <main className="fc-workspace">
          <div className="fc-row fc-between fc-wrap">
            <div className="fc-row">
              <Film size={15} />
              <select
                aria-label="Version affichée"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                style={{ width: 190 }}
              >
                <option value="source">Rushs originaux</option>
                {data.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.number} ·{" "}
                    {v.quality === "master" ? "Finale" : "Aperçu"}
                  </option>
                ))}
              </select>
            </div>
            <span className="fc-muted" style={{ fontSize: 11 }}>
              {version === "source"
                ? "Timecodes des rushs originaux"
                : "Rendu vérifié"}
            </span>
          </div>
          <div className="fc-preview">
            {version !== "source" || data.source_available ? (
              <video
                key={version}
                ref={player}
                src={`${root}/media/${version}`}
                crossOrigin="use-credentials"
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) =>
                  setMediaDuration(e.currentTarget.duration)
                }
                onError={() =>
                  setError(
                    "Impossible de lire ce fichier. Vérifie sa disponibilité ou télécharge la version.",
                  )
                }
              />
            ) : (
              <div className="fc-preview-empty">
                <Film size={36} />
                <h2>Les rushs ne sont plus disponibles</h2>
                <p className="fc-muted">
                  Les versions conservées restent accessibles dans le sélecteur.
                </p>
              </div>
            )}
          </div>
          <div className="fc-row fc-between">
            <span className="fc-time">
              {timecode(time)}{" "}
              <span className="fc-muted">/ {timecode(total)}</span>
            </span>
            <div className="fc-row">
              <button
                className="fc-icon"
                aria-label="Reculer de 0,1 seconde"
                onClick={() => seek(time - 0.1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="fc-muted" style={{ fontSize: 10 }}>
                0,1 s
              </span>
              <button
                className="fc-icon"
                aria-label="Avancer de 0,1 seconde"
                onClick={() => seek(time + 0.1)}
              >
                <ChevronRight size={18} />
              </button>
              <select
                aria-label="Vitesse de lecture"
                defaultValue="1"
                onChange={(e) => {
                  if (player.current)
                    player.current.playbackRate = Number(e.target.value);
                }}
                style={{ width: 80 }}
              >
                {[0.5, 1, 1.5, 2].map((n) => (
                  <option value={n} key={n}>
                    {n}×
                  </option>
                ))}
              </select>
            </div>
          </div>
          <section className="fc-timeline">
            <div className="fc-row fc-between">
              <span className="fc-row">
                <AudioLines size={15} />
                Timeline
              </span>
              <span className="fc-muted fc-time">
                {version === "source"
                  ? `${timecode(removedDuration(activeCuts, settings))} de coupes sélectionnées`
                  : `${snapshot?.overlays?.length || 0} habillages`}
              </span>
            </div>
            <input
              aria-label="Position de lecture"
              type="range"
              min="0"
              max={total || 1}
              step="0.01"
              value={Math.min(time, total || 1)}
              onChange={(e) => seek(e.target.value)}
            />
            <div className="fc-track">
              {version === "source" &&
                activeCuts
                  .filter((c) => effectiveCut(c, settings))
                  .map((c) => (
                    <button
                      key={c.id}
                      data-kind="cut"
                      title={`${c.reason} · ${timecode(c.start)}`}
                      aria-label={`Écouter la coupe à ${timecode(c.start)}`}
                      onClick={() => seek(c.start)}
                      style={{
                        left: `${(c.start / (total || 1)) * 100}%`,
                        width: `${((c.end - c.start) / (total || 1)) * 100}%`,
                      }}
                    />
                  ))}
              <div
                className="fc-track-marker"
                style={{ left: `${(time / (total || 1)) * 100}%` }}
              />
            </div>
            <div className="fc-track">
              {appliedOverlays
                .filter(
                  (o) =>
                    o.enabled &&
                    (version !== "source" ||
                      settings[o.kind === "card" ? "motion" : "broll"]),
                )
                .map((o) => (
                  <button
                    key={o.id}
                    data-kind={o.kind}
                    title={o.text}
                    aria-label={`Lire ${o.text}`}
                    onClick={() => seek(o.output_start ?? o.start)}
                    style={{
                      left: `${((o.output_start ?? o.start) / (total || 1)) * 100}%`,
                      width: `${(o.duration / (total || 1)) * 100}%`,
                    }}
                  />
                ))}
            </div>
            <div
              className="fc-row fc-muted"
              style={{ fontSize: 10, marginTop: 9 }}
            >
              <span style={{ color: "#fb7185" }}>● Coupes</span>
              <span style={{ color: "#a78bfa" }}>● Titres</span>
              <span style={{ color: "#34d399" }}>● B-roll</span>
            </div>
          </section>
          {version === "source" && (
            <p className="fc-muted" style={{ fontSize: 11 }}>
              Les rushs montrent l’enregistrement original. Lance un aperçu pour
              voir tes coupes, tes sous-titres et ton habillage appliqués.
            </p>
          )}
          <div className="fc-steps">
            {STAGES.map(([id, label], i) => (
              <div
                className="fc-step"
                key={id}
                data-done={
                  video.status === "done" ||
                  i < stageIndex ||
                  (video.status === "review" && i < 2)
                }
                data-active={running && i === stageIndex}
              >
                {label}
              </div>
            ))}
          </div>
          {running && (
            <div className="fc-row fc-between">
              <p className="fc-muted">
                {video.progress_stage || "Préparation…"} ·{" "}
                {video.progress_percent || 0}%
              </p>
              <button
                className="fc-btn"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    await request(`${apiBase}/videos/${videoId}/cancel`, {
                      method: "POST",
                    });
                    await refresh();
                    changedRef.current?.();
                  })
                }
              >
                Arrêter
              </button>
            </div>
          )}
          {["failed", "cancelled"].includes(video.status) && (
            <div className="fc-stack">
              <p className="fc-error">
                {video.error_message ||
                  "Le montage a été arrêté. Tu peux le reprendre."}
              </p>
              {!edit && (
                <button
                  className="fc-btn"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await request(`${apiBase}/videos/${videoId}/retry`, {
                        method: "POST",
                      });
                      await refresh();
                    })
                  }
                >
                  <RefreshCw size={15} />
                  Relancer l’analyse
                </button>
              )}
            </div>
          )}
          <p className="fc-muted" style={{ fontSize: 11 }}>
            Chaque rendu : {data.render_credits?.toLocaleString("fr-FR")}{" "}
            crédits, hors illustrations éventuelles. Export final : qualité
            supérieure et normalisation audio.
          </p>
        </main>
        <aside id="fc-inspector" className="fc-inspector" role="tabpanel">
          <div className="fc-inspector-header">
            <h2>
              {
                {
                  cuts: "Le bon rythme",
                  captions: "Ta voix, en texte",
                  visuals: "Donner à voir",
                  brand: "Ta signature",
                  notes: "Les dernières retouches",
                  versions: "Chaque version compte",
                }[tab]
              }
            </h2>
            <p className="fc-muted">
              {
                {
                  cuts: "Choisis ce qui reste. Chaque décision est réversible.",
                  captions: "Clique sur un mot pour retrouver le passage.",
                  visuals:
                    "Des titres et des illustrations au service de ton propos.",
                  brand: "Une identité cohérente, de ta chaîne à ton export.",
                  notes: "Des retours précis, attachés à la version affichée.",
                  versions: "Compare, télécharge et retrouve tes décisions.",
                }[tab]
              }
            </p>
          </div>
          {tab === "cuts" && (
            <div className="fc-stack">
              <div>
                <Toggle
                  label="Raccourcir les silences"
                  checked={settings.silences}
                  disabled={locked}
                  onChange={(v) => changeSetting("silences", v)}
                />
                <Toggle
                  label="Retirer répétitions et reprises"
                  checked={settings.mistakes}
                  disabled={locked}
                  onChange={(v) => changeSetting("mistakes", v)}
                />
              </div>
              {version !== "source" && (
                <button className="fc-btn" onClick={() => setVersion("source")}>
                  Revenir aux rushs pour relire les coupes
                </button>
              )}
              <div className="fc-row fc-between">
                <h3>{activeCuts.length} propositions</h3>
                <button
                  className="fc-cut-time"
                  disabled={locked}
                  onClick={() =>
                    update((p) => {
                      p.cuts.forEach((c) => (c.enabled = false));
                      return p;
                    })
                  }
                >
                  Tout conserver
                </button>
              </div>
              <div>
                {activeCuts.length ? (
                  activeCuts.map((c) => (
                    <div className="fc-cut" key={c.id}>
                      <div className="fc-row fc-between">
                        <label className="fc-row">
                          <input
                            type="checkbox"
                            checked={c.enabled}
                            disabled={locked}
                            onChange={(e) =>
                              update((p) => {
                                p.cuts.find((x) => x.id === c.id).enabled =
                                  e.target.checked;
                                return p;
                              })
                            }
                          />
                          {c.reason}
                        </label>
                        <button
                          className="fc-cut-time"
                          disabled={version !== "source"}
                          onClick={() => seek(Math.max(0, c.start - 0.5))}
                        >
                          {timecode(c.start)}
                        </button>
                      </div>
                      <p className="fc-muted">
                        {c.text || "Silence"} · {(c.end - c.start).toFixed(1)} s
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty icon={Scissors}>
                    {running
                      ? "Les propositions apparaîtront après l’analyse."
                      : "Aucune coupe proposée."}
                  </Empty>
                )}
              </div>
              <details>
                <summary style={{ cursor: "pointer" }}>
                  Ajouter une coupe manuelle
                </summary>
                <div className="fc-stack" style={{ marginTop: 12 }}>
                  <div className="fc-row">
                    <label>
                      Début (s)
                      <input
                        type="number"
                        min="0"
                        step=".01"
                        value={manual.start}
                        onChange={(e) =>
                          setManual({ ...manual, start: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Fin (s)
                      <input
                        type="number"
                        min="0"
                        step=".01"
                        value={manual.end}
                        onChange={(e) =>
                          setManual({ ...manual, end: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <button
                    className="fc-btn"
                    disabled={
                      locked ||
                      manual.start === "" ||
                      Number(manual.end) <= Number(manual.start) ||
                      Number(manual.end) > edit?.duration
                    }
                    onClick={() => {
                      update((p) => {
                        p.manual_cuts = [
                          ...(p.manual_cuts || []),
                          {
                            start: Number(manual.start),
                            end: Number(manual.end),
                          },
                        ];
                        return p;
                      });
                      setManual({ start: "", end: "" });
                    }}
                  >
                    Ajouter à mes décisions
                  </button>
                  {edit?.manual_cuts?.map((c, i) => (
                    <div className="fc-row fc-between" key={i}>
                      <span>
                        {timecode(c.start)} → {timecode(c.end)}
                      </span>
                      <button
                        className="fc-icon"
                        aria-label="Retirer cette coupe manuelle"
                        onClick={() =>
                          update((p) => {
                            p.manual_cuts.splice(i, 1);
                            return p;
                          })
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
          {tab === "captions" && (
            <div className="fc-stack">
              <Toggle
                label="Afficher les sous-titres"
                checked={settings.captions}
                disabled={locked}
                onChange={(v) => changeSetting("captions", v)}
              />
              <div className="fc-row">
                <label style={{ flex: 1 }}>
                  Position
                  <select
                    value={settings.caption_position}
                    disabled={locked}
                    onChange={(e) =>
                      changeSetting("caption_position", e.target.value)
                    }
                  >
                    <option value="bottom">En bas</option>
                    <option value="center">Au centre</option>
                    <option value="top">En haut</option>
                  </select>
                </label>
                <label style={{ width: 85 }}>
                  Mots / ligne
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={settings.words_per_line}
                    disabled={locked}
                    onChange={(e) =>
                      changeSetting(
                        "words_per_line",
                        Math.max(2, Math.min(10, Number(e.target.value))),
                      )
                    }
                  />
                </label>
              </div>
              <input
                aria-label="Rechercher dans la transcription"
                placeholder="Rechercher un mot…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div>
                {words.length ? (
                  words
                    .filter(
                      (w) =>
                        !search ||
                        w.text.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((w, i) => (
                      <button
                        className="fc-word"
                        key={`${w.start}-${i}`}
                        data-active={time >= w.start && time < w.end}
                        data-cut={
                          version === "source" &&
                          activeCuts.some(
                            (c) =>
                              effectiveCut(c, settings) &&
                              w.start >= c.start &&
                              w.end <= c.end,
                          )
                        }
                        onClick={() => seek(w.start)}
                        title={timecode(w.start)}
                      >
                        {w.text}{" "}
                      </button>
                    ))
                ) : (
                  <Empty icon={Subtitles}>
                    La transcription apparaîtra ici.
                  </Empty>
                )}
              </div>
              <div className="fc-row">
                <button
                  className="fc-btn"
                  disabled={!words.length || busy}
                  onClick={() =>
                    download(
                      `${root}/export/srt?version=${version}`,
                      "sous-titres.srt",
                    )
                  }
                >
                  <Download size={14} />
                  SRT
                </button>
                <button
                  className="fc-btn"
                  disabled={!words.length || busy}
                  onClick={() =>
                    download(
                      `${root}/export/txt?version=${version}`,
                      "transcription.txt",
                    )
                  }
                >
                  Texte
                </button>
              </div>
            </div>
          )}
          {tab === "visuals" && (
            <div className="fc-stack">
              <label>
                Système de montage
                <select value={settings.editing_style} disabled={locked} onChange={(e) => changeSetting("editing_style", e.target.value)} style={{ marginTop: 8 }}>
                  <option value="kappgen">Signature KappGen</option><option value="vox">Explainer éditorial</option><option value="kallaway">Creator premium</option><option value="keynote">Produit minimal</option><option value="atlas">Documentaire</option><option value="terminal">Tech rapide</option><option value="data">Data story</option><option value="optimist">Tech optimiste</option>
                </select>
              </label>
              <Toggle
                label="Cartes de titre"
                checked={settings.motion}
                disabled={locked}
                onChange={(v) => changeSetting("motion", v)}
              />
              <div className="fc-style-grid">
                {[
                  ["minimal", "Épuré"],
                  ["bold", "Impact"],
                  ["editorial", "Éditorial"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className="fc-style"
                    aria-pressed={settings.card_style === id}
                    disabled={locked}
                    onClick={() => changeSetting("card_style", id)}
                  >
                    <span
                      style={
                        id === "bold"
                          ? {
                              background: settings.accent_color,
                              color: "#08111d",
                            }
                          : {}
                      }
                    >
                      <b
                        style={{
                          borderLeft:
                            id === "editorial"
                              ? `3px solid ${settings.accent_color}`
                              : 0,
                          paddingLeft: 5,
                          fontSize: id === "bold" ? 23 : 16,
                        }}
                      >
                        Aa
                      </b>
                    </span>
                    <small>{label}</small>
                  </button>
                ))}
              </div>
              <p className="fc-muted" style={{ fontSize: 11 }}>Les cartes de titre et les sous-titres utilisent ce préréglage avec ta charte. Enregistre puis exporte une nouvelle version pour appliquer le changement.</p>
              <Toggle
                label="Illustrations B-roll"
                checked={settings.broll}
                disabled={locked}
                onChange={(v) => changeSetting("broll", v)}
              />
              <p className="fc-muted" style={{ fontSize: 11 }}>
                Les recherches B-roll utilisent la bibliothèque et les
                fournisseurs disponibles. Une illustration introuvable sera
                signalée dans le rapport.
              </p>
              {edit?.overlays.map((o) => (
                <div className="fc-cut fc-stack" key={o.id}>
                  <div className="fc-row fc-between">
                    <label className="fc-row">
                      <input
                        type="checkbox"
                        checked={o.enabled}
                        disabled={locked}
                        onChange={(e) =>
                          update((p) => {
                            p.overlays.find((x) => x.id === o.id).enabled =
                              e.target.checked;
                            return p;
                          })
                        }
                      />
                      {o.kind === "card" ? "Titre" : "B-roll"}
                    </label>
                    <button
                      className="fc-cut-time"
                      disabled={version !== "source"}
                      onClick={() => seek(o.start)}
                    >
                      {timecode(o.start)}
                    </button>
                  </div>
                  <input
                    aria-label={
                      o.kind === "card"
                        ? "Texte de la carte"
                        : "Recherche B-roll"
                    }
                    value={o.text}
                    maxLength={160}
                    disabled={locked}
                    onChange={(e) =>
                      update((p) => {
                        p.overlays.find((x) => x.id === o.id).text =
                          e.target.value;
                        return p;
                      })
                    }
                  />
                  <div className="fc-row">
                    <label>
                      Début (s)
                      <input
                        type="number"
                        min="0"
                        step=".1"
                        value={o.start}
                        disabled={locked}
                        onChange={(e) =>
                          update((p) => {
                            p.overlays.find((x) => x.id === o.id).start =
                              Number(e.target.value);
                            return p;
                          })
                        }
                      />
                    </label>
                    <label>
                      Durée (s)
                      <input
                        type="number"
                        min=".5"
                        max="10"
                        step=".1"
                        value={o.duration}
                        disabled={locked}
                        onChange={(e) =>
                          update((p) => {
                            p.overlays.find((x) => x.id === o.id).duration =
                              Number(e.target.value);
                            return p;
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
              <details>
                <summary style={{ cursor: "pointer" }}>
                  Ajouter un habillage
                </summary>
                <div className="fc-stack" style={{ marginTop: 12 }}>
                  <select
                    aria-label="Type d’habillage"
                    value={newVisual.kind}
                    onChange={(e) =>
                      setNewVisual({ ...newVisual, kind: e.target.value })
                    }
                  >
                    <option value="card">Carte de titre</option>
                    <option value="broll">Recherche B-roll</option>
                  </select>
                  <input
                    aria-label="Texte du nouvel habillage"
                    placeholder="Ton titre ou ta recherche"
                    value={newVisual.text}
                    maxLength={160}
                    onChange={(e) =>
                      setNewVisual({ ...newVisual, text: e.target.value })
                    }
                  />
                  <div className="fc-row">
                    <label>
                      Début (s)
                      <input
                        type="number"
                        min="0"
                        step=".1"
                        value={newVisual.start}
                        onChange={(e) =>
                          setNewVisual({
                            ...newVisual,
                            start: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Durée (s)
                      <input
                        type="number"
                        min=".5"
                        max="10"
                        step=".1"
                        value={newVisual.duration}
                        onChange={(e) =>
                          setNewVisual({
                            ...newVisual,
                            duration: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <button
                    className="fc-btn"
                    disabled={locked || !newVisual.text.trim()}
                    onClick={() => {
                      update((p) => {
                        p.new_overlays = [...(p.new_overlays || []), newVisual];
                        return p;
                      });
                      setNewVisual({ ...newVisual, text: "" });
                    }}
                  >
                    Ajouter au montage
                  </button>
                  {edit?.new_overlays?.map((o, i) => (
                    <div className="fc-row fc-between" key={i}>
                      <span>
                        {o.text} · {timecode(o.start)}
                      </span>
                      <button
                        className="fc-icon"
                        aria-label="Retirer le nouvel habillage"
                        onClick={() =>
                          update((p) => {
                            p.new_overlays.splice(i, 1);
                            return p;
                          })
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
          {tab === "brand" && (
            <div className="fc-stack">
              <div
                className="fc-brand-sample"
                style={{ fontFamily: settings.font_family }}
              >
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: 2,
                    marginBottom: 10,
                    color: settings.accent_color,
                  }}
                >
                  TA SIGNATURE
                </span>
                <strong>
                  Les idées méritent
                  <br />
                  d’être vues.
                </strong>
                <span style={{ color: settings.accent_color, marginTop: 16 }}>
                  Et ta voix, entendue.
                </span>
              </div>
              <p className="fc-muted" style={{ fontSize: 11 }}>
                Aperçu de style. Le logo configuré sur ta chaîne est repris au
                rendu ; ces réglages s’appliquent à ce montage.
              </p>
              <label>
                Couleur signature
                <div className="fc-row" style={{ marginTop: 8 }}>
                  <input
                    type="color"
                    value={settings.accent_color}
                    disabled={locked}
                    onChange={(e) =>
                      changeSetting("accent_color", e.target.value)
                    }
                    style={{
                      width: 42,
                      height: 36,
                      border: 0,
                      background: "none",
                    }}
                  />
                  <span>{settings.accent_color.toUpperCase()}</span>
                </div>
              </label>
              <label>
                Typographie
                <select
                  value={settings.font_family}
                  disabled={locked}
                  onChange={(e) => changeSetting("font_family", e.target.value)}
                >
                  {[
                    "DejaVu Sans",
                    "Arial",
                    "Inter",
                    "Montserrat",
                    "Roboto",
                    "Poppins",
                  ].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                Format de sortie
                <select
                  value={settings.format}
                  disabled={locked}
                  onChange={(e) => changeSetting("format", e.target.value)}
                >
                  <option value="original">Original</option>
                  <option value="vertical">Vertical · 9:16</option>
                  <option value="square">Carré · 1:1</option>
                  <option value="landscape">Horizontal · 16:9</option>
                </select>
              </label>
              <p className="fc-muted" style={{ fontSize: 11 }}>
                L’image reste entière. Des marges noires sont ajoutées si le
                format diffère de celui des rushs.
              </p>
            </div>
          )}
          {tab === "notes" && (
            <div className="fc-stack">
              <span className="fc-pill">
                {version === "source"
                  ? "Rushs originaux"
                  : `Version ${data.versions.find((v) => v.id === version)?.number}`}
              </span>
              <label>
                Retour à {timecode(time)}
                <textarea
                  placeholder="Ce passage mérite une retouche…"
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <button
                className="fc-btn"
                disabled={busy || !note.trim() || !edit}
                onClick={() =>
                  action(async () => {
                    await request(`${root}/notes`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ version, time, text: note }),
                    });
                    setNote("");
                    await refresh();
                  })
                }
              >
                <Plus size={15} />
                Ajouter à ce timecode
              </button>
              {data.notes
                .filter((n) => n.version === version)
                .map((n) => (
                  <div
                    className="fc-note"
                    key={n.id}
                    data-resolved={n.resolved}
                  >
                    <div className="fc-row fc-between">
                      <button
                        className="fc-cut-time"
                        onClick={() => seek(n.time)}
                      >
                        {timecode(n.time)}
                      </button>
                      <button
                        className="fc-icon"
                        disabled={busy}
                        aria-label={
                          n.resolved
                            ? "Rouvrir le retour"
                            : "Marquer comme traité"
                        }
                        onClick={() =>
                          action(async () => {
                            await request(`${root}/notes/${n.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ resolved: !n.resolved }),
                            });
                            await refresh();
                          })
                        }
                      >
                        {n.resolved ? (
                          <CheckCheck size={16} />
                        ) : (
                          <Check size={16} />
                        )}
                      </button>
                    </div>
                    <p>{n.text}</p>
                  </div>
                ))}
            </div>
          )}
          {tab === "versions" && (
            <div className="fc-stack">
              {data.versions.length ? (
                [...data.versions].reverse().map((v) => (
                  <div className="fc-note fc-stack" key={v.id}>
                    <div className="fc-row fc-between">
                      <h3>Version {v.number}</h3>
                      <span className="fc-pill">
                        {v.quality === "master" ? "Finale" : "Aperçu"}
                      </span>
                    </div>
                    <p className="fc-muted" style={{ fontSize: 11 }}>
                      {when(v.created_at)} · {v.width} × {v.height} ·{" "}
                      {timecode(v.duration)} ·{" "}
                      {(v.size / 1024 / 1024).toFixed(1)} Mo
                    </p>
                    {edit && v.revision < edit.revision && (
                      <span style={{ color: "#fbbf24", fontSize: 11 }}>
                        Des modifications plus récentes existent
                      </span>
                    )}
                    <div className="fc-row">
                      <button
                        className="fc-btn"
                        onClick={() => setVersion(v.id)}
                      >
                        <CirclePlay size={14} />
                        Voir
                      </button>
                      <button
                        className="fc-btn"
                        disabled={busy}
                        onClick={() =>
                          download(
                            `${root}/media/${v.id}?download=true`,
                            `${video.title || "facecam"}-${v.id}.mp4`,
                          )
                        }
                      >
                        <Download size={14} />
                        MP4
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty icon={History}>
                  Valide ton montage pour créer la première version.
                </Empty>
              )}
              <button
                className="fc-btn"
                disabled={!edit || busy}
                onClick={() =>
                  download(
                    `${root}/export/json?version=${version}`,
                    "decisions-montage.json",
                  )
                }
              >
                <Download size={14} />
                Exporter les décisions
              </button>
              {(version === "source"
                ? data.verification
                : snapshot?.verification) && (
                <Verification
                  report={
                    version === "source"
                      ? data.verification
                      : snapshot?.verification
                  }
                />
              )}
              <h3>Activité du montage</h3>
              {[...(data.project.activity || [])].reverse().map((a, i) => (
                <div className="fc-row" key={i}>
                  <Clock3 size={13} className="fc-muted" />
                  <p style={{ fontSize: 11 }}>
                    {a.message} <span className="fc-muted">· {when(a.at)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
function Verification({ report }) {
  return (
    <div className="fc-note fc-stack">
      <h3 className="fc-row">
        <ShieldCheck size={16} />
        {report.passed ? "Vérification réussie" : "Points à corriger"}
      </h3>
      {report.failures?.map((w, i) => (
        <p className="fc-error" key={i}>
          {w}
        </p>
      ))}
      {report.warnings?.map((w, i) => (
        <p className="fc-muted" style={{ fontSize: 11 }} key={i}>
          {w}
        </p>
      ))}
      {!report.warnings?.length && !report.failures?.length && (
        <p className="fc-muted">
          Les coupes et la durée du rendu ont été contrôlées.
        </p>
      )}
    </div>
  );
}
