import React, { useState } from 'react';

const stations = [
  ['graphic_eq', 'Transcription', /transcri/i],
  ['content_cut', 'Coupes', /silence|coup|mistake|reprise/i],
  ['verified', 'Vérification', /verif|vérif|contrôle/i],
  ['auto_awesome', 'Habillage', /broll|b-roll|card|habill|motion/i],
  ['movie', 'Export', /mux|render|rendu|export/i],
];
export default function Workshop({ videos = [], onOpen }) {
  const [paused, setPaused] = useState(false);
  const active = videos.filter(v => ['queued', 'rendering'].includes(v.status));
  const review = videos.filter(v => v.status === 'review');
  return <section className="fc-panel fc-workshop" data-paused={paused}>
    <div className="fc-row fc-between"><div><div className="fc-eyebrow">L’atelier KappGen</div><h2>De ta voix à ta vidéo.</h2></div>
      <button type="button" className="fc-btn fc-quiet" aria-label={paused ? 'Animer l’atelier' : 'Mettre l’animation en pause'} onClick={() => setPaused(!paused)}><span className="material-symbols-outlined">{paused ? 'play_arrow' : 'pause'}</span></button></div>
    <div className="fc-workshop-scene" aria-hidden="true"><div className="fc-workshop-orbit"/><div className="fc-workshop-core"><span className="material-symbols-outlined">movie_edit</span><strong>KappGen</strong></div></div>
    <div className="fc-workshop-stations">{stations.map(([icon, label, match]) => {
      const tasks = active.filter(v => v.status === 'rendering' && match.test(v.progress_stage || ''));
      return <div key={label} data-active={tasks.length > 0}><span className="material-symbols-outlined">{icon}</span><strong>{label}</strong><small>{tasks.length ? `${tasks.length} en cours` : 'En attente'}</small></div>;
    })}</div>
    <div className="fc-stack" style={{marginTop: 20}}>
      <p className="fc-muted">{active.length ? `${active.length} vidéo(s) en préparation` : review.length ? `${review.length} vidéo(s) à relire` : 'Prêt pour tes rushs. Ton prochain montage commence ici.'}</p>
      {[...active, ...review].slice(0, 3).map(v => <button type="button" className="fc-btn fc-row fc-between" key={v.id} onClick={() => onOpen(v)}><span className="fc-task-title">{v.title || 'Vidéo sans titre'}</span><span>{v.status === 'review' ? 'Relire' : v.status === 'queued' ? 'En file' : `${v.progress_percent || 0} %`}</span></button>)}
    </div>
  </section>;
}
