import { useEffect, useState } from 'react';
import {
  ArrowRight, BadgeCheck, Captions, Check, ChevronRight, CirclePlay, Clapperboard,
  Clock3, Images, Layers3, Menu, Music2, Play, Sparkles,
  WandSparkles, X, Zap
} from 'lucide-react';
import './landing.css';

const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || 'https://appnichecut.tools-cl.com';
const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const appUrl = (path = '/signup') => `${isLocal ? `${window.location.origin}/app` : APP_ORIGIN}${path}`;

const features = [
  { icon: Captions, title: 'Sous-titres qui captent', text: 'Des sous-titres karaoké animés, synchronisés mot par mot et adaptés à votre identité.' },
  { icon: Images, title: 'Visuels automatisés', text: 'Importez votre bibliothèque ou laissez l’IA sélectionner les images qui servent chaque scène.' },
  { icon: Music2, title: 'Univers sonore cohérent', text: 'Voix off, musique et niveaux audio sont assemblés automatiquement pour un rendu prêt à publier.' },
  { icon: Layers3, title: 'Un pipeline par chaîne', text: 'Mémorisez vos réglages une fois. Chaque nouvelle vidéo reprend exactement votre style.' },
  { icon: CirclePlay, title: 'Pensé pour YouTube', text: 'Produisez au format 16:9, suivez vos rendus et connectez votre chaîne depuis un seul espace.' },
  { icon: Clock3, title: 'Des heures récupérées', text: 'Passez du script à la vidéo sans répéter les mêmes opérations de montage à chaque publication.' },
];

const steps = [
  ['01', 'Créez votre chaîne', 'Définissez votre niche, votre identité visuelle et vos préférences de montage.'],
  ['02', 'Ajoutez votre contenu', 'Collez un script ou importez un fichier audio prêt à être transformé.'],
  ['03', 'Lancez le pipeline', 'NicheCut assemble la voix, les images, les sous-titres, la musique et les effets.'],
  ['04', 'Récupérez votre vidéo', 'Prévisualisez, téléchargez puis publiez votre contenu sur YouTube.'],
];

function ProductPreview() {
  return (
    <div className="product-preview" aria-label="Aperçu de l’interface NicheCut">
      <div className="preview-glow" />
      <div className="preview-window">
        <div className="preview-topbar">
          <div className="window-dots"><i /><i /><i /></div>
          <span>appnichecut.tools-cl.com/dashboard</span>
          <div className="preview-avatar">R</div>
        </div>
        <div className="preview-body">
          <aside className="preview-sidebar">
            <img src="/assets/logo/logo-nichecut.png" alt="" />
            <div className="preview-nav active"><Layers3 size={15} /> Vue d’ensemble</div>
            <div className="preview-nav"><CirclePlay size={15} /> Mes chaînes</div>
            <div className="preview-nav"><Clapperboard size={15} /> Mes vidéos</div>
          </aside>
          <div className="preview-content">
            <div className="preview-heading">
              <div><small>ESPACE DE PRODUCTION</small><strong>Bonjour Roosevelt 👋</strong></div>
              <button><Sparkles size={13} /> Nouvelle vidéo</button>
            </div>
            <div className="metric-grid">
              <div><span>Chaînes actives</span><b>03</b><em>+1 ce mois</em></div>
              <div><span>Vidéos générées</span><b>28</b><em>12 prêtes</em></div>
              <div><span>Temps économisé</span><b>46h</b><em>Ce mois-ci</em></div>
            </div>
            <div className="preview-panel">
              <div className="panel-title"><strong>Productions récentes</strong><span>Voir tout <ChevronRight size={13} /></span></div>
              {[
                ['Rivière de Grâce', 'Le secret des bâtisseurs...', 'Prête', '100%'],
                ['Sagesse Stoïcienne', '7 règles pour rester calme', 'Rendu', '68%'],
                ['Histoires du Monde', 'La cité oubliée du désert', 'File', '12%'],
              ].map(([channel, title, status, progress]) => (
                <div className="preview-row" key={title}>
                  <div className="thumb"><Play size={13} fill="currentColor" /></div>
                  <div className="row-copy"><b>{title}</b><span>{channel}</span></div>
                  <div className="row-progress"><i style={{ width: progress }} /></div>
                  <span className={`status ${status === 'Prête' ? 'ready' : ''}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    document.title = 'NicheCut — Automatisez le montage de vos vidéos YouTube';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = 'Transformez vos scripts et audios en vidéos YouTube prêtes à publier avec un pipeline de montage automatisé.';
  }, []);

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <a className="brand" href="#accueil" aria-label="NicheCut — Accueil"><img src="/assets/logo/logo-nichecut.png" alt="" /><span>NicheCut</span></a>
        <nav className={menuOpen ? 'open' : ''}>
          <a href="#fonctionnalites" onClick={() => setMenuOpen(false)}>Fonctionnalités</a>
          <a href="#fonctionnement" onClick={() => setMenuOpen(false)}>Comment ça marche</a>
          <a href="#tarifs" onClick={() => setMenuOpen(false)}>Tarifs</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
        </nav>
        <div className="header-actions"><a className="login-link" href={appUrl('/login')}>Se connecter</a><a className="button button-small" href={appUrl('/signup')}>Essayer NicheCut <ArrowRight size={15} /></a></div>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Ouvrir le menu">{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <main>
        <section className="hero" id="accueil">
          <div className="hero-grid" /><div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> Le studio vidéo des créateurs qui avancent vite</div>
            <h1>Votre contenu mérite mieux que des heures de <span>montage répétitif.</span></h1>
            <p>Transformez vos scripts et vos audios en vidéos YouTube cohérentes, sous-titrées et prêtes à publier — avec un pipeline conçu une fois, réutilisé à l’infini.</p>
            <div className="hero-actions">
              <a className="button button-primary" href={appUrl('/signup')}>Créer ma première vidéo <ArrowRight size={18} /></a>
              <a className="button button-ghost" href="#fonctionnement"><Play size={17} fill="currentColor" /> Voir comment ça marche</a>
            </div>
            <div className="hero-trust"><span><Check size={15} /> Configuration guidée</span><span><Check size={15} /> Sans logiciel de montage</span><span><Check size={15} /> Export YouTube 16:9</span></div>
          </div>
          <ProductPreview />
        </section>

        <section className="proof-strip"><span>DE L’IDÉE À LA VIDÉO, DANS UN SEUL FLUX</span><div><span>Script</span><ChevronRight /><span>Voix off</span><ChevronRight /><span>Visuels</span><ChevronRight /><span>Sous-titres</span><ChevronRight /><span>Vidéo finale</span></div></section>

        <section className="section features" id="fonctionnalites">
          <div className="section-intro"><div className="section-kicker">UN PIPELINE, TOUT VOTRE STYLE</div><h2>Automatisez le répétitif.<br /><span>Gardez votre signature.</span></h2><p>NicheCut ne remplace pas votre créativité. Il mémorise vos choix et exécute proprement chaque étape du montage.</p></div>
          <div className="feature-grid">{features.map(({ icon: Icon, title, text }, index) => <article className={index === 0 || index === 5 ? 'feature-card featured' : 'feature-card'} key={title}><div className="feature-icon"><Icon /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className="section workflow" id="fonctionnement">
          <div className="workflow-copy"><div className="section-kicker">SIMPLE PAR CONCEPTION</div><h2>Une méthode claire.<br />Quatre étapes.</h2><p>Vous restez concentré sur les idées et les histoires. NicheCut prend en charge la mécanique de production.</p><a className="text-link" href={appUrl('/signup')}>Démarrer maintenant <ArrowRight size={17} /></a></div>
          <div className="steps">{steps.map(([number, title, text]) => <article className="step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
        </section>

        <section className="section audience"><div className="audience-card"><div><div className="section-kicker">CONÇU POUR PRODUIRE RÉGULIÈREMENT</div><h2>Une chaîne reconnaissable.<br />À chaque publication.</h2><p>Que vous racontiez l’histoire, enseigniez la finance ou partagiez des récits spirituels, votre identité reste stable vidéo après vidéo.</p></div><div className="audience-list">{['Chaînes faceless & narration', 'Créateurs multi-chaînes', 'Agences de contenu', 'Experts & formateurs'].map((item) => <span key={item}><BadgeCheck /> {item}</span>)}</div></div></section>

        <section className="section pricing" id="tarifs">
          <div className="section-intro centered"><div className="section-kicker">ACCÈS ANTICIPÉ</div><h2>Commencez à construire<br /><span>votre machine à contenu.</span></h2><p>Les offres commerciales arrivent bientôt. Rejoignez l’accès anticipé et testez le pipeline NicheCut dès maintenant.</p></div>
          <div className="early-card"><div className="early-badge"><Zap size={16} fill="currentColor" /> ACCÈS FONDATEUR</div><h3>Testez NicheCut aujourd’hui</h3><p>Créez vos chaînes, configurez leur style et lancez vos premières productions automatisées.</p><ul><li><Check /> Pipelines de chaîne personnalisés</li><li><Check /> Scripts et imports audio</li><li><Check /> Bibliothèque de visuels</li><li><Check /> Suivi des rendus</li></ul><a className="button button-primary full" href={appUrl('/signup')}>Accéder à l’application <ArrowRight size={18} /></a><small>Aucune carte bancaire demandée pour l’accès actuel.</small></div>
        </section>

        <section className="section faq" id="faq"><div><div className="section-kicker">QUESTIONS FRÉQUENTES</div><h2>Avant de lancer<br />votre premier rendu.</h2></div><div className="faq-list">{[
          ['Dois-je savoir monter une vidéo ?', 'Non. Vous configurez votre rendu dans une interface guidée, puis NicheCut exécute le pipeline à votre place.'],
          ['Puis-je gérer plusieurs chaînes ?', 'Oui. Chaque chaîne possède son propre style de sous-titres, sa musique, ses visuels et ses réglages de marque.'],
          ['Quels contenus puis-je envoyer ?', 'Vous pouvez partir d’un texte à transformer en voix off ou importer directement vos fichiers audio.'],
          ['Où se trouve l’application ?', `L’espace de production est séparé de ce site et accessible sur ${APP_ORIGIN.replace('https://', '')}.`],
        ].map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>

        <section className="final-cta"><div className="cta-icon"><WandSparkles /></div><h2>Votre prochaine vidéo peut commencer maintenant.</h2><p>Configurez votre chaîne une fois. Produisez avec constance, encore et encore.</p><a className="button button-primary" href={appUrl('/signup')}>Ouvrir mon studio NicheCut <ArrowRight size={18} /></a></section>
      </main>

      <footer className="landing-footer"><a className="brand" href="#accueil"><img src="/assets/logo/logo-nichecut.png" alt="" /><span>NicheCut</span></a><p>Le pipeline vidéo automatisé pour les créateurs YouTube.</p><div><a href="#fonctionnalites">Fonctionnalités</a><a href="#faq">FAQ</a><a href={appUrl('/login')}>Connexion</a></div><span>© {new Date().getFullYear()} NicheCut. Tous droits réservés.</span></footer>
    </div>
  );
}
