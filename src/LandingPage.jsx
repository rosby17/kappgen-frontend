import { useEffect, useState } from 'react';
import {
  ArrowRight, BadgeCheck, Captions, Check, ChevronRight, CirclePlay, Clapperboard,
  Clock3, Images, Layers3, Menu, Play, Sparkles,
  WandSparkles, X, Zap
} from 'lucide-react';
import './landing.css';

const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || 'https://appnichecut.tools-cl.com';
const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const appUrl = (path = '/signup') => `${isLocal ? `${window.location.origin}/app` : APP_ORIGIN}${path}`;

const features = [
  { icon: Sparkles, title: 'Il trouve les idées', text: 'L’Agent analyse ta niche, détecte les sujets pertinents et choisit quoi produire pour ta chaîne.' },
  { icon: Captions, title: 'Il écrit et raconte', text: 'Il construit le script, génère la voix off et crée des sous-titres adaptés à ton audience.' },
  { icon: Images, title: 'Il monte la vidéo', text: 'Visuels, rythme, musique, effets et identité de marque sont assemblés sans intervention.' },
  { icon: Layers3, title: 'Il respecte ton style', text: 'Tu configures chaque chaîne une seule fois. L’Agent applique ensuite tes règles à chaque vidéo.' },
  { icon: CirclePlay, title: 'Il publie sur YouTube', text: 'Une fois la vidéo prête, l’Agent la publie sur la bonne chaîne selon ton calendrier.' },
  { icon: Clock3, title: 'Il travaille pendant ton sommeil', text: 'Ta production continue en autonomie, même lorsque tu n’es pas devant ton ordinateur.' },
];

const steps = [
  ['01', 'Configure ta chaîne une fois', 'Définis sa niche, son ton, son identité visuelle, son rythme et sa fréquence de publication.'],
  ['02', 'Active l’Agent NicheCut', 'Connecte ta chaîne YouTube et donne à l’Agent les règles qu’il doit respecter.'],
  ['03', 'Va vivre. Ou va dormir.', 'L’Agent cherche les idées, écrit, crée la voix, monte et prépare chaque nouvelle vidéo.'],
  ['04', 'Retrouve tes vidéos publiées', 'NicheCut programme et publie sur ta chaîne. Tu gardes la visibilité, pas la charge de travail.'],
];

const pricingPlans = [
  {
    name: 'Découverte', price: 'Gratuit', description: 'Découvre la qualité NicheCut avant de lancer ton Agent.',
    features: ['1 vidéo test', 'Export avec filigrane', 'Création assistée', 'Sans publication automatique'],
    cta: 'Tester NicheCut', featured: false,
  },
  {
    name: 'Créateur', price: '29 $', localPrice: '≈ 18 000 FCFA / mois', description: 'Pour créer régulièrement tout en gardant la validation finale.',
    features: ['1 chaîne YouTube', '20 vidéos assistées / mois', '10 à 15 min par vidéo', 'Identité visuelle personnalisée'],
    cta: 'Choisir Créateur', featured: false,
  },
  {
    name: 'Automatique', price: '69 $', localPrice: '≈ 42 000 FCFA / mois', description: 'L’expérience NicheCut complète : tu configures, l’Agent exécute.',
    features: ['1 chaîne YouTube', '12 vidéos autonomes / mois', 'Programmation automatique', 'Publication automatique YouTube'],
    cta: 'Activer mon Agent', featured: true,
  },
  {
    name: 'Scale', price: '149 $', localPrice: '≈ 90 000 FCFA / mois', description: 'Pour piloter plusieurs chaînes avec un volume de production élevé.',
    features: ['Jusqu’à 10 chaînes', 'Jusqu’à 300 vidéos / mois', 'Rendu prioritaire', 'Gestion multi-chaînes'],
    cta: 'Passer à Scale', featured: false,
  },
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
              <div><small>AGENT NICHECUT</small><strong>Ton pilote automatique est actif</strong></div>
              <button><Sparkles size={13} /> Agent en ligne</button>
            </div>
            <div className="metric-grid">
              <div><span>Chaînes automatisées</span><b>03</b><em>Toutes actives</em></div>
              <div><span>Vidéos publiées</span><b>28</b><em>100 % autonomes</em></div>
              <div><span>Temps récupéré</span><b>46h</b><em>Ce mois-ci</em></div>
            </div>
            <div className="preview-panel">
              <div className="panel-title"><strong>Activité autonome de l’Agent</strong><span>Voir tout <ChevronRight size={13} /></span></div>
              {[
                ['Rivière de Grâce', 'Le secret des bâtisseurs...', 'Publiée', '100%'],
                ['Sagesse Stoïcienne', '7 règles pour rester calme', 'Montage', '68%'],
                ['Histoires du Monde', 'La cité oubliée du désert', 'Script', '24%'],
              ].map(([channel, title, status, progress]) => (
                <div className="preview-row" key={title}>
                  <div className="thumb"><Play size={13} fill="currentColor" /></div>
                  <div className="row-copy"><b>{title}</b><span>{channel}</span></div>
                  <div className="row-progress"><i style={{ width: progress }} /></div>
                  <span className={`status ${status === 'Publiée' ? 'ready' : ''}`}>{status}</span>
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
    document.title = 'NicheCut — L’Agent autonome qui gère ta chaîne YouTube';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = 'Configure le style de ta chaîne une fois. L’Agent NicheCut trouve les idées, crée les vidéos et les publie sur YouTube pendant que tu dors.';
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
        <div className="header-actions"><a className="login-link" href={appUrl('/login')}>Se connecter</a><a className="button button-small" href={appUrl('/signup')}>Activer mon Agent <ArrowRight size={15} /></a></div>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Ouvrir le menu">{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <main>
        <section className="hero" id="accueil">
          <div className="hero-grid" /><div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
          <div className="hero-copy">
            <h1>Tu dors.<br /><span>NicheCut travaille pour toi sur YouTube.</span></h1>
            <p>L’Agent imagine, crée et publie des vidéos originales dans le style de ta chaîne. Nous l’avons travaillé à partir des réalités du terrain YouTube pour construire une audience durable, pas produire du contenu générique en masse.</p>
            <div className="hero-actions">
              <a className="button button-primary" href={appUrl('/signup')}>Automatiser ma chaîne <ArrowRight size={18} /></a>
              <a className="button button-ghost" href="#fonctionnement"><Play size={17} fill="currentColor" /> Découvrir l’Agent</a>
            </div>
            <div className="hero-trust"><span><Check size={15} /> De l’idée à la publication</span><span><Check size={15} /> Zéro montage manuel</span><span><Check size={15} /> Agent actif 24 h/24</span></div>
          </div>
          <ProductPreview />
        </section>

        <section className="proof-strip"><span>UNE CHAÎNE YOUTUBE EN PILOTE AUTOMATIQUE</span><div><span>Recherche d’idées</span><ChevronRight /><span>Script</span><ChevronRight /><span>Production</span><ChevronRight /><span>Publication</span></div></section>

        <section className="section features" id="fonctionnalites">
          <div className="section-intro"><div className="section-kicker">UN AGENT, TOUTE TA CHAÎNE</div><h2>Tu définis la direction.<br /><span>Il exécute tout le reste.</span></h2><p>NicheCut ne s’arrête pas au montage. Son Agent orchestre toute la chaîne de création, de la première idée jusqu’à la publication sur YouTube.</p></div>
          <div className="feature-grid">{features.map(({ icon: Icon, title, text }, index) => <article className={index === 0 || index === 5 ? 'feature-card featured' : 'feature-card'} key={title}><div className="feature-icon"><Icon /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className="section workflow" id="fonctionnement">
          <div className="workflow-copy"><div className="section-kicker">CONFIGURE. ACTIVE. DORS.</div><h2>Une seule configuration.<br />Une production continue.</h2><p>Tu ne dois plus nourrir l’outil à chaque vidéo. Une fois activé, l’Agent pilote ton calendrier de contenu en autonomie.</p><a className="text-link" href={appUrl('/signup')}>Activer mon Agent <ArrowRight size={17} /></a></div>
          <div className="steps">{steps.map(([number, title, text]) => <article className="step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
        </section>

        <section className="section audience"><div className="audience-card"><div><div className="section-kicker">ENTRAÎNÉ POUR LA RÉALITÉ DE YOUTUBE</div><h2>Autonome ne veut pas dire générique.</h2><p>Nous maîtrisons les réalités du terrain YouTube et avons travaillé l’Agent autour de ce qui compte vraiment : originalité, rétention, identité éditoriale, droits et règles de monétisation. NicheCut ne produit pas à la chaîne ; il crée selon ton univers et applique ces exigences à chaque vidéo pour réduire les risques de démonétisation, de suppression ou de sanction.</p></div><div className="audience-list">{['Originalité à chaque vidéo', 'Rétention pensée dès le script', 'Identité de chaîne préservée', 'Règles YouTube intégrées'].map((item) => <span key={item}><BadgeCheck /> {item}</span>)}</div></div></section>

        <section className="section pricing" id="tarifs">
          <div className="section-intro centered"><div className="section-kicker">DES TARIFS QUI SUIVENT TON AMBITION</div><h2>Commence avec une vidéo.<br /><span>Puis automatise toute ta chaîne.</span></h2><p>Choisis le niveau d’autonomie et le volume adaptés à tes objectifs. Tu peux changer d’offre lorsque ta chaîne grandit.</p></div>
          <div className="pricing-grid">
            {pricingPlans.map((plan) => (
              <article className={`pricing-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>
                {plan.featured && <div className="pricing-badge"><Zap size={13} fill="currentColor" /> RECOMMANDÉE</div>}
                <div className="pricing-card-head"><h3>{plan.name}</h3><p>{plan.description}</p></div>
                <div className="pricing-price"><strong>{plan.price}</strong>{plan.price !== 'Gratuit' && <span>/ mois</span>}</div>
                {plan.localPrice && <div className="pricing-local">{plan.localPrice}</div>}
                <ul>{plan.features.map((feature) => <li key={feature}><Check /> {feature}</li>)}</ul>
                <a className={`button full ${plan.featured ? 'button-primary' : 'button-ghost'}`} href={appUrl('/signup')}>{plan.cta} <ArrowRight size={16} /></a>
              </article>
            ))}
          </div>
          <div className="network-plan">
            <div><div className="section-kicker">RÉSEAUX MULTICHAÎNES</div><h3>Une infrastructure adaptée à ton réseau.</h3><p>Plusieurs chaînes, accès équipe, volume personnalisé et accompagnement prioritaire.</p></div>
            <div className="network-price"><span>À partir de</span><strong>299 $</strong><small>/ mois · sur devis</small></div>
            <a className="button button-ghost" href="mailto:contact@nichecut.tools-cl.com?subject=Offre%20Réseau%20multichaîne">Nous contacter <ArrowRight size={16} /></a>
          </div>
          <p className="pricing-note">Les quotas correspondent aux générations incluses par cycle mensuel. Les besoins supérieurs peuvent être adaptés sur devis.</p>
        </section>

        <section className="section faq" id="faq"><div><div className="section-kicker">QUESTIONS FRÉQUENTES</div><h2>Avant d’activer<br />ton Agent.</h2></div><div className="faq-list">{[
          ['Dois-je fournir les idées ou les scripts ?', 'Non. En mode autonome, l’Agent recherche les sujets, choisit l’angle et rédige lui-même les scripts.'],
          ['Dois-je valider chaque vidéo ?', 'Non. Tu peux laisser l’Agent aller jusqu’à la publication automatique. Tu gardes néanmoins une vue complète sur son activité.'],
          ['Est-ce du contenu générique produit en masse ?', 'Non. Nous avons conçu l’Agent à partir des réalités du terrain YouTube : une chaîne doit être originale, cohérente, capable de retenir son audience et respecter les règles de la plateforme. Chaque vidéo possède donc son propre angle, son script et son rendu, tout en restant fidèle à l’identité de ta chaîne.'],
          ['Puis-je gérer plusieurs chaînes ?', 'Oui. Chaque chaîne possède son propre Agent, son style, sa niche et son calendrier de publication.'],
          ['Où se trouve l’application ?', `L’espace de production est séparé de ce site et accessible sur ${APP_ORIGIN.replace('https://', '')}.`],
        ].map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>

        <section className="final-cta"><div className="cta-icon"><WandSparkles /></div><h2>Configure ta chaîne. Puis oublie la création.</h2><p>L’Agent NicheCut travaille, produit et publie pendant que tu vis ta vie.</p><a className="button button-primary" href={appUrl('/signup')}>Activer mon Agent NicheCut <ArrowRight size={18} /></a></section>
      </main>

      <footer className="landing-footer"><a className="brand" href="#accueil"><img src="/assets/logo/logo-nichecut.png" alt="" /><span>NicheCut</span></a><p>L’Agent autonome qui gère ta chaîne YouTube de l’idée à la publication.</p><div><a href="#fonctionnalites">Fonctionnalités</a><a href="#faq">FAQ</a><a href={appUrl('/login')}>Connexion</a></div><span>© {new Date().getFullYear()} NicheCut. Tous droits réservés.</span></footer>
    </div>
  );
}
