import React, { useMemo, useState } from "react";

const STYLES = [
  { id: "kappgen", name: "Signature KappGen", use: "Ta charte, claire et directe", treatment: "minimal", colors: ["#07131f", "#00c2ff", "#e8f7ff"], cards: ["Titre", "Mot clé", "Citation"] },
  { id: "vox", name: "Explainer éditorial", use: "Récits, idées et explications", treatment: "editorial", colors: ["#efe9dc", "#17130e", "#37bdf8"], cards: ["Chapitre", "Archive", "Définition"] },
  { id: "kallaway", name: "Creator premium", use: "Tutoriels et vidéos ambitieuses", treatment: "bold", colors: ["#11121a", "#c5ff59", "#ffffff"], cards: ["Impact", "Liste", "Résultat"] },
  { id: "keynote", name: "Produit minimal", use: "Démos et annonces produit", treatment: "minimal", colors: ["#f4f5f7", "#15171b", "#5b80ff"], cards: ["Chiffre", "Étape", "Interface"] },
  { id: "atlas", name: "Documentaire", use: "Enquêtes et narration", treatment: "editorial", colors: ["#12100e", "#e0bd75", "#e8e0d0"], cards: ["Lieu", "Fait", "Chronologie"] },
  { id: "terminal", name: "Tech rapide", use: "Tutoriels développement", treatment: "bold", colors: ["#101313", "#67ff9f", "#e8ffe9"], cards: ["Commande", "Erreur", "Solution"] },
  { id: "data", name: "Data story", use: "Données et analyses", treatment: "editorial", colors: ["#f3f0e9", "#14213d", "#ef476f"], cards: ["Chiffre", "Graphique", "Conclusion"] },
  { id: "optimist", name: "Tech optimiste", use: "Idées, produits et futur", treatment: "minimal", colors: ["#f9f5ef", "#1a2930", "#ff6b4a"], cards: ["Promesse", "Exemple", "À retenir"] },
];
const FORMATS = [
  ["facecam", "Facecam plein cadre", "Ta présence porte le récit."],
  ["split", "Facecam + démonstration", "Tu parles, le visuel explique."],
  ["before-after", "Avant / après", "Comparer clairement une transformation."],
  ["tutorial", "Tutoriel guidé", "Étapes, captures et repères."],
];

function StylePreview({ style }) {
  return <div className="fc-library-preview" style={{ background: style.colors[0], color: style.colors[1] }}>
    <span style={{ color: style.colors[2] }}>KAPPGEN / FACE CAM</span><strong>Ton idée<br />prend forme.</strong><i style={{ background: style.colors[2] }} />
  </div>;
}

export default function FacecamLibrary({ settings, onSelectStyle, channels = [], library = [], onNewProject }) {
  const [tab, setTab] = useState("styles");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(settings.editing_style || "kappgen");
  const shown = useMemo(() => STYLES.filter(s => `${s.name} ${s.use} ${s.cards.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const choose = (style) => { setSelected(style.id); onSelectStyle({ editing_style: style.id, card_style: style.treatment }); };
  return <div className="fc fc-library">
    <header className="fc-library-head"><div><div className="fc-eyebrow">Bibliothèque Facecam</div><h1>Tout ce qui compose ta vidéo.</h1><p className="fc-muted">Choisis une structure, un style, des cartes et tes médias avant de monter.</p></div><button className="fc-btn fc-primary" type="button" onClick={onNewProject}><span className="material-symbols-outlined">add</span> Nouveau projet</button></header>
    <nav className="fc-library-tabs" aria-label="Bibliothèque Facecam">{[["styles","Styles de montage","palette"],["formats","Formats","view_quilt"],["assets","Mes médias","perm_media"],["brand","Ma charte","verified"]].map(([id,label,icon]) => <button type="button" key={id} data-active={tab === id} onClick={() => setTab(id)}><span className="material-symbols-outlined">{icon}</span>{label}</button>)}</nav>
    {tab === "styles" && <><div className="fc-library-toolbar"><label><span className="material-symbols-outlined">search</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un style, une carte…" /></label><p className="fc-muted">{STYLES.length} styles disponibles</p></div><div className="fc-library-grid">{shown.map(style => <article className="fc-style-card" data-selected={selected === style.id} key={style.id}><StylePreview style={style}/><div><h2>{style.name}</h2><p className="fc-muted">{style.use}</p><div className="fc-chip-row">{style.cards.map(card => <span key={card}>{card}</span>)}</div><button className="fc-btn" type="button" onClick={() => choose(style)}>{selected === style.id ? "Style sélectionné" : "Utiliser ce style"}</button></div></article>)}</div></>}
    {tab === "formats" && <div className="fc-library-grid fc-format-grid">{FORMATS.map(([id, name, desc]) => <button type="button" className="fc-format-card" key={id} onClick={() => onSelectStyle({ format_template: id })}><span className="material-symbols-outlined">{id === "facecam" ? "person" : id === "split" ? "splitscreen" : id === "before-after" ? "compare" : "checklist"}</span><h2>{name}</h2><p className="fc-muted">{desc}</p><small>Utiliser pour le projet <span className="material-symbols-outlined">arrow_forward</span></small></button>)}</div>}
    {tab === "assets" && <div className="fc-library-grid">{channels.map(channel => {
      const media = library.find(item => item.channel_id === channel.id) || {};
      const items = [["image", media.image_count || 0, "Images"], ["movie", media.broll_count || 0, "B-roll"], ["music_note", media.music_track_count || 0, "Musiques"]];
      return <article className="fc-format-card" key={channel.id}><span className="material-symbols-outlined">folder_open</span><h2>{channel.name}</h2><p className="fc-muted">Les ressources déjà disponibles pour cette chaîne.</p><div className="fc-media-counts">{items.map(([icon,count,label]) => <span key={label}><span className="material-symbols-outlined">{icon}</span><b>{count}</b> {label}</span>)}</div><small>Gérer dans la médiathèque <span className="material-symbols-outlined">arrow_forward</span></small></article>;
    })}{channels.length === 0 && <div className="fc-empty"><span className="material-symbols-outlined">perm_media</span><h2>Aucune chaîne Facecam</h2><p>Crée une chaîne pour y rassembler tes images, clips B-roll, musiques et logos.</p></div>}</div>}
    {tab === "brand" && <section className="fc-panel fc-stack"><div className="fc-eyebrow">Ta charte de montage</div><h2>Utilise les couleurs, la police et le logo de ta chaîne.</h2><p className="fc-muted">Le style donne la structure des cartes. Ta charte garde ta vidéo reconnaissable.</p><button className="fc-btn" type="button" onClick={() => choose(STYLES[0])}>Revenir à Signature KappGen</button></section>}
  </div>;
}
