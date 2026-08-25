import { useEffect, useState } from 'react';
import {
  ArrowRight, BadgeCheck, Captions, Check, ChevronRight, CirclePlay, Clapperboard,
  Clock3, FileText, Image as ImageIcon, Images, Layers3, Menu, Mic, Music, Play,
  Scissors, Search, Sparkles, Type, Upload,
  WandSparkles, X, Zap
} from 'lucide-react';
import './landing.css';
import freedomSunrise from './assets/dashboard/freedom-sunrise.png';

const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || 'https://app.kappgen.com';
const API_DOCS_URL = import.meta.env.VITE_API_ORIGIN ? `${import.meta.env.VITE_API_ORIGIN}/docs` : 'https://api.kappgen.com/docs';
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.kappgen.com/api';
const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const appUrl = (path = '/signup') => `${isLocal ? `${window.location.origin}/app` : APP_ORIGIN}${path}`;

const features = [
  { icon: Sparkles, title: 'Il trouve les idées', text: 'KappGen AI analyse ta niche, détecte les sujets pertinents et choisit quoi produire pour ta chaîne.' },
  { icon: Captions, title: 'Il écrit et raconte', text: 'Il construit le script, génère la voix off et crée des sous-titres adaptés à ton audience.' },
  { icon: Images, title: 'Il monte la vidéo', text: 'Visuels, rythme, musique, effets et identité de marque sont assemblés sans intervention.' },
  { icon: Layers3, title: 'Il respecte ton style', text: 'KappGen AI fait ce que tu faisais manuellement avant, dans ton style. Tu gardes le contrôle si tu veux, ou tu le laisses gérer en automatique — zéro dérapage, tout reste flexible.' },
  { icon: CirclePlay, title: 'Il publie sur YouTube', text: 'Une fois la vidéo prête, KappGen AI la publie sur la bonne chaîne selon ton calendrier.' },
  { icon: Clock3, title: 'Il travaille pendant ton sommeil', text: 'Ta production continue en autonomie, même lorsque tu n’es pas devant ton ordinateur.' },
];

const pipelineSteps = [
  { icon: Search, title: 'Recherche d’idées', text: 'KappGen AI explore ta niche et repère les sujets qui ont des chances de performer.' },
  { icon: FileText, title: 'Rédaction du script', text: 'Il écrit le script complet, dans le ton et le style propres à ta chaîne.' },
  { icon: Mic, title: 'Voix off', text: 'Génération d’une voix off naturelle à partir du script.' },
  { icon: ImageIcon, title: 'Recherche d’images', text: 'Sélection des visuels qui correspondent à chaque séquence de la vidéo.' },
  { icon: Music, title: 'Musique de fond', text: 'Une musique adaptée est choisie pour habiller la vidéo sans couvrir la voix.' },
  { icon: Scissors, title: 'Montage', text: 'Assemblage du script, de la voix, des images et de la musique en une vidéo prête à l’emploi.' },
  { icon: Sparkles, title: 'Miniature', text: 'Création d’une miniature pensée pour donner envie de cliquer.' },
  { icon: Type, title: 'Titre et description', text: 'Rédaction du titre et de la description optimisés pour YouTube.' },
  { icon: Upload, title: 'Publication YouTube', text: 'La vidéo est programmée et publiée directement sur ta chaîne.' },
];

const steps = [
  ['01', 'Configure ta chaîne une fois', 'Définis sa niche, son ton, son identité visuelle, son rythme et sa fréquence de publication.'],
  ['02', 'Laisse KappGen AI prendre le relais', 'Connecte ta chaîne YouTube et définis une fois les règles à respecter.'],
  ['03', 'Va vivre. Ou va dormir.', 'KappGen AI cherche les idées, écrit, crée la voix, monte et prépare chaque nouvelle vidéo.'],
  ['04', 'Retrouve tes vidéos publiées', 'KappGen AI programme et publie sur ta chaîne. Tu gardes la visibilité, pas la charge de travail.'],
];

// Taglines/CTAs keyed by plan name — the checkable feature rows themselves
// come straight from /api/billing/plans (see buildPlanFeatureRows below) so
// this page can never drift out of sync with what the app actually enforces
// the way the old hardcoded Découverte/Créateur/Automatique/Scale list did.
const PLAN_COPY = {
  'Starter': { description: 'Pour tester la voix off sans engagement.', cta: 'Tester sans pression', featured: false },
  'Creator': { description: 'Pour créer régulièrement sans y penser.', cta: 'Créer à mon rythme', featured: false },
  'Standard': { description: 'Le meilleur rapport crédits / prix.', cta: 'Dormir l’esprit tranquille', featured: true },
  'Pro': { description: 'Pour un usage intensif et plusieurs chaînes.', cta: 'Libérer toute mon équipe', featured: false },
};

function buildPlanFeatureRows(plan) {
  const rows = [
    { text: 'Accès à la voix off', included: true },
    { text: plan.max_channels ? `${plan.max_channels} chaîne${plan.max_channels > 1 ? 's' : ''}` : 'Chaînes illimitées', included: true },
    { text: plan.max_video_duration_seconds ? `Vidéos jusqu’à ${Math.round(plan.max_video_duration_seconds / 60)} min` : 'Durée de vidéo illimitée', included: true },
    { text: 'Accès à la transcription automatique', included: !!plan.ai_transcription_enabled },
    { text: 'Accès à la génération d’images IA', included: !!plan.ai_images_enabled },
    { text: 'Accès au script automatique IA', included: !!plan.ai_script_enabled },
    { text: 'Accès à la publication automatique YouTube', included: !!plan.autopublish_enabled },
  ];
  return rows;
}

function ProductPreview() {
  return (
    <div className="product-preview" aria-label="Aperçu de l’interface KappGen">
      <div className="preview-glow" />
      <div className="preview-window">
        <div className="preview-topbar">
          <div className="window-dots"><i /><i /><i /></div>
          <span>app.kappgen.com/dashboard</span>
          <div className="preview-avatar">R</div>
        </div>
        <div className="preview-body">
          <aside className="preview-sidebar">
            <div className="preview-brand"><img src="/assets/logo/logo-kappgen.png" alt="" /><span><b>KappGen</b><small>Video Automation</small></span></div>
            <div className="preview-nav active"><Layers3 size={15} /> Home</div>
            <div className="preview-nav"><CirclePlay size={15} /> Mes chaînes</div>
            <div className="preview-nav"><Clapperboard size={15} /> Mes vidéos</div>
          </aside>
          <div className="preview-content">
            <div className="preview-current-heading">
              <small>TON ESPACE NICHECUT</small>
              <strong>Sors des écrans. KappGen reste au travail.</strong>
            </div>
            <div className="preview-freedom-card">
              <img src={freedomSunrise} alt="" />
              <div><strong>Tu vis. KappGen travaille.</strong><span>Ta chaîne continue pendant que tu profites de ton temps.</span><button>Voir mes chaînes</button></div>
            </div>
            <div className="preview-channels-current">
              <strong>Aperçu des chaînes</strong>
              <div className="preview-channel-card"><i>R</i><span><b>Rivière de Grâce</b><small>Prière</small></span><em>PRÊTE</em><small>2 vidéos prêtes</small></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  // The session cookie is scoped to .kappgen.com (see backend/src/utils/auth.py),
  // so it's sent here too even though this page lives on the root marketing
  // domain rather than app.kappgen.com — lets an already-logged-in visitor
  // skip straight to "Accéder à KappGen" instead of being shown login/signup.
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Fetched live instead of hardcoded — this page used to show a completely
  // different set of plans (Découverte/Créateur/Automatique/Scale, priced in
  // USD) than the app's real Starter/Creator/Standard/Pro credit packs, and
  // that copy silently drifted out of sync with what's actually enforced.
  const [pricingPlans, setPricingPlans] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/billing/plans`)
      .then(res => res.ok ? res.json() : [])
      .then(plans => setPricingPlans((plans || []).filter(p => p.credits).sort((a, b) => a.price_fcfa - b.price_fcfa)))
      .catch(() => setPricingPlans([]));
  }, []);
  useEffect(() => {
    document.title = 'KappGen — Tu vis. KappGen travaille.';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = 'Sors des écrans. KappGen AI trouve les idées, crée les vidéos et les publie sur YouTube pendant que tu vis, voyages ou dors.';
    fetch(`${API_BASE}/auth/session`, { credentials: 'include' })
      .then(res => setIsLoggedIn(res.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <a className="brand" href="#accueil" aria-label="KappGen — Accueil"><img src="/assets/logo/logo-kappgen.png" alt="" /><span>KappGen</span></a>
        <nav className={menuOpen ? 'open' : ''}>
          <a href="#pipeline" onClick={() => setMenuOpen(false)}>Fonctionnalités</a>
          <a href="#fonctionnement" onClick={() => setMenuOpen(false)}>Comment ça marche</a>
          <a href="#tarifs" onClick={() => setMenuOpen(false)}>Tarifs</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
        </nav>
        <div className="header-actions">
          {isLoggedIn ? (
            <a className="button button-small" href={appUrl('/dashboard')}>Accéder à KappGen <ArrowRight size={15} /></a>
          ) : (
            <>
              <a className="login-link" href={appUrl('/login')}>Se connecter</a>
              <a className="button button-small" href={appUrl('/signup')}>Reprendre mon temps <ArrowRight size={15} /></a>
            </>
          )}
        </div>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Ouvrir le menu">{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <main>
        <section className="hero" id="accueil">
          <div className="hero-grid" /><div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
          <div className="hero-copy">
            <h1>Tu dors.<br /><span>KappGen travaille pour toi sur YouTube.</span></h1>
            <p>Tu vis, tu voyages, tu dors. KappGen imagine, crée et publie des vidéos originales dans le style de ta chaîne, avec les réalités du terrain YouTube intégrées à chaque étape.</p>
            <div className="hero-actions">
              <a className="button button-primary" href={isLoggedIn ? appUrl('/dashboard') : appUrl('/signup')}>{isLoggedIn ? 'Accéder à KappGen' : 'Sors des écrans'} <ArrowRight size={18} /></a>
              <a className="button button-ghost" href="#fonctionnement"><Play size={17} fill="currentColor" /> Voir comment gagner du temps</a>
            </div>
            <div className="hero-trust"><span><Check size={15} /> De l’idée à la publication</span><span><Check size={15} /> Zéro montage manuel</span><span><Check size={15} /> KappGen actif 24 h/24</span></div>
          </div>
          <ProductPreview />
        </section>

        <section className="proof-strip"><span>TON RÉSEAU DE CHAÎNES AVANCE SANS STRESS</span><div>{['Idées', 'Script', 'Voix off', 'Images', 'Musique', 'Montage', 'Miniature', 'Titre & description', 'Publication'].map((label, index, arr) => (
          <span key={label} style={{ display: 'contents' }}>
            <span>{label}</span>
            {index < arr.length - 1 && <ChevronRight />}
          </span>
        ))}</div></section>

        <section className="section features" id="fonctionnement">
          <div className="section-intro"><div className="section-kicker">TOUTES TES CHAÎNES, GÉRÉES PAR KAPPGEN</div><h2>Tu définis la direction.<br /><span>KappGen exécute tout le reste.</span></h2><p>KappGen ne s’arrête pas au montage. Il orchestre toute la chaîne de création, de la première idée jusqu’à la publication sur YouTube — jusqu’à décider lui-même les jours où produire du contenu. Configure une fois, oublie ensuite.</p></div>
          <div className="feature-grid">{features.map(({ icon: Icon, title, text }, index) => <article className={index === 0 || index === 5 ? 'feature-card featured' : 'feature-card'} key={title}><div className="feature-icon"><Icon /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className="section pipeline" id="pipeline">
          <div className="section-intro"><div className="section-kicker">DE L’IDÉE À LA PUBLICATION</div><h2>Neuf étapes.<br /><span>Tu choisis lesquelles déléguer.</span></h2><p>Rien n’est tout-ou-rien. Chaque étape de production peut rester sous ton contrôle ou être confiée à KappGen AI — tu automatises exactement ce que tu veux, à ton rythme.</p></div>
          <div className="feature-grid pipeline-grid">
            {pipelineSteps.map(({ icon: Icon, title, text }, index) => (
              <article className="feature-card" key={title}>
                <div className="feature-icon"><Icon /></div>
                <span className="pipeline-badge">Étape {String(index + 1).padStart(2, '0')} · Optionnelle</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section workflow" id="etapes">
          <div className="workflow-copy"><div className="section-kicker">CONFIGURE. ACTIVE. VIS.</div><h2>Tu dors.<br /><span>Ta chaîne avance.</span></h2><p>Tu ne dois plus nourrir l’outil à chaque vidéo. Une fois activé, KappGen AI poursuit ton calendrier de contenu sans te ramener constamment devant un écran.</p><a className="text-link" href={appUrl('/signup')}>Va vivre. On s’occupe du reste. <ArrowRight size={17} /></a></div>
          <div className="steps">{steps.map(([number, title, text]) => <article className="step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
        </section>

        <section className="section audience"><div className="audience-card"><div><div className="section-kicker">ENTRAÎNÉ POUR LA RÉALITÉ DE YOUTUBE</div><h2>Autonome ne veut pas dire générique.</h2><p>Nous maîtrisons les réalités du terrain YouTube et avons conçu KappGen AI autour de ce qui compte vraiment : originalité, rétention, identité éditoriale, droits et règles de monétisation. KappGen AI ne produit pas à la chaîne ; il crée selon ton univers et applique ces exigences à chaque vidéo pour réduire les risques de démonétisation, de suppression ou de sanction.</p></div><div className="audience-list">{['Originalité à chaque vidéo', 'Rétention pensée dès le script', 'Identité de chaîne préservée', 'Règles YouTube intégrées'].map((item) => <span key={item}><BadgeCheck /> {item}</span>)}</div></div></section>

        <section className="section pricing" id="tarifs">
          <div className="section-intro centered"><div className="section-kicker">DES OFFRES POUR REPRENDRE TON TEMPS</div><h2>Commence avec une vidéo.<br /><span>Puis libère-toi des écrans.</span></h2><p>Choisis le rythme qui laisse ta chaîne avancer sans sacrifier tes journées, tes nuits ou tes vacances.</p></div>
          <div className="pricing-grid">
            {pricingPlans.map((plan) => {
              const copy = PLAN_COPY[plan.name] || { description: '', cta: 'Choisir cette offre', featured: false };
              return (
                <article className={`pricing-card ${copy.featured ? 'featured' : ''}`} key={plan.id}>
                  {copy.featured && <div className="pricing-badge"><Zap size={13} fill="currentColor" /> RECOMMANDÉE</div>}
                  <div className="pricing-card-head"><h3>{plan.name}</h3><p>{copy.description}</p></div>
                  <div className="pricing-price"><strong>{plan.price_fcfa.toLocaleString('fr-FR')}</strong><span>FCFA</span></div>
                  <div className="pricing-local">{plan.credits.toLocaleString('fr-FR')} crédits à vie</div>
                  <ul>{buildPlanFeatureRows(plan).map((row) => (
                    <li key={row.text} className={row.included ? '' : 'pricing-feature-excluded'}>
                      {row.included ? <Check /> : <X />} {row.text}
                    </li>
                  ))}</ul>
                  <a className={`button full ${copy.featured ? 'button-primary' : 'button-ghost'}`} href={appUrl('/signup')}>{copy.cta} <ArrowRight size={16} /></a>
                </article>
              );
            })}
          </div>
          <div className="network-plan">
            <div><div className="section-kicker">RÉSEAUX MULTICHAÎNES</div><h3>Une infrastructure adaptée à ton réseau.</h3><p>Plusieurs chaînes, accès équipe, volume personnalisé et accompagnement prioritaire.</p></div>
            <div className="network-price"><span>Tarif</span><strong>Sur devis</strong></div>
            <a className="button button-ghost" href="https://wa.me/237655306425?text=Bonjour%2C%20je%20suis%20int%C3%A9ress%C3%A9%20par%20l%27offre%20R%C3%A9seau%20multicha%C3%AEne%20KappGen." target="_blank" rel="noopener">Nous contacter <ArrowRight size={16} /></a>
          </div>
          <p className="pricing-note">Les quotas correspondent aux générations incluses par cycle mensuel. Les besoins supérieurs peuvent être adaptés sur devis.</p>
        </section>

        <section className="section faq" id="faq"><div><div className="section-kicker">QUESTIONS FRÉQUENTES</div><h2>Avant d’activer<br />KappGen.</h2></div><div className="faq-list">{[
          ['Dois-je fournir les idées ou les scripts ?', 'Non. En mode autonome, KappGen AI recherche les sujets, choisit l’angle et rédige lui-même les scripts.'],
          ['Dois-je valider chaque vidéo ?', 'Non. Tu peux laisser KappGen AI aller jusqu’à la publication automatique. Tu gardes néanmoins une vue complète sur son activité.'],
          ['Est-ce du contenu générique produit en masse ?', 'Non. Nous avons conçu KappGen AI à partir des réalités du terrain YouTube : une chaîne doit être originale, cohérente, capable de retenir son audience et respecter les règles de la plateforme. Chaque vidéo possède donc son propre angle, son script et son rendu, tout en restant fidèle à l’identité de ta chaîne.'],
          ['Puis-je gérer plusieurs chaînes ?', 'Oui. Chaque chaîne dispose de son propre style, sa niche et son calendrier de publication.'],
          ['Où se trouve l’application ?', `L’espace de production est séparé de ce site et accessible sur ${APP_ORIGIN.replace('https://', '')}.`],
        ].map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>

        <section className="final-cta"><div className="cta-icon"><WandSparkles /></div><h2>Tu vis. KappGen travaille.</h2><p>La création de contenu t’absorbe, t’enferme un peu plus chaque jour. Reprends le contrôle de ton temps — sans sacrifier un centime des revenus que tu as bâtis.</p><a className="button button-primary" href={isLoggedIn ? appUrl('/dashboard') : appUrl('/signup')}>{isLoggedIn ? 'Accéder à KappGen' : 'Je reprends mon temps'} <ArrowRight size={18} /></a></section>
      </main>

      <footer className="landing-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <a className="brand" href="#accueil"><img src="/assets/logo/logo-kappgen.png" alt="" /><span>KappGen</span></a>
            <p>L’assistant autonome qui gère ton réseau de chaînes YouTube, de l’idée à la publication.</p>
          </div>
          <div className="footer-col">
            <h4>Produit</h4>
            <a href="#pipeline">Fonctionnalités</a>
            <a href="#fonctionnement">Comment ça marche</a>
            <a href="#tarifs">Tarifs</a>
          </div>
          <div className="footer-col">
            <h4>Ressources</h4>
            <a href="#faq">FAQ</a>
            <a href={API_DOCS_URL} target="_blank" rel="noopener">Doc API</a>
            <a href="mailto:contact@kappgen.com">Contact</a>
          </div>
          <div className="footer-col">
            <h4>Légal</h4>
            <a href="/privacy">Politique de confidentialité</a>
            <a href="/terms">Conditions d’utilisation</a>
          </div>
        </div>
        <span>© {new Date().getFullYear()} KappGen. Tous droits réservés.</span>
      </footer>
    </div>
  );
}
