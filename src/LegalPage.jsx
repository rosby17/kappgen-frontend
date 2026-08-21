import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import './landing.css';
import './legal.css';

const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || 'https://app.kappgen.com';
const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const appUrl = (path = '/signup') => `${isLocal ? `${window.location.origin}/app` : APP_ORIGIN}${path}`;

const LAST_UPDATED = '20 août 2026';

const PRIVACY_SECTIONS = [
  {
    id: 'responsable', title: 'Responsable du traitement', body: (
      <p>KappGen (« nous ») est l'éditeur du service accessible sur <a href="https://kappgen.com">kappgen.com</a> et <a href="https://app.kappgen.com">app.kappgen.com</a>. Pour toute question relative à vos données personnelles, contactez-nous à <a href="mailto:contact@kappgen.com">contact@kappgen.com</a>.</p>
    )
  },
  {
    id: 'donnees', title: 'Données collectées', body: (
      <>
        <p>Nous collectons uniquement ce qui est nécessaire au fonctionnement du service :</p>
        <ul>
          <li><strong>Compte</strong> — nom, adresse email, mot de passe (chiffré), numéro de téléphone si vous le renseignez, photo de profil si vous vous connectez avec Google.</li>
          <li><strong>Contenu que vous fournissez</strong> — scripts texte, fichiers audio importés, images de votre bibliothèque, morceaux de musique, échantillons vocaux pour le clonage de voix (uniquement avec votre confirmation explicite de consentement).</li>
          <li><strong>Contenu généré</strong> — vidéos produites, sous-titres, voix off générées, miniatures, et la configuration de style de chaque chaîne que vous configurez.</li>
          <li><strong>Connexion à des services tiers</strong> — jetons d'autorisation YouTube, et le cas échéant votre propre clé API Izivoice si vous connectez votre compte personnel plutôt que d'utiliser le moteur vocal partagé.</li>
          <li><strong>Facturation</strong> — l'historique et le statut de vos abonnements. Les informations de paiement (carte, mobile money) sont traitées directement par notre prestataire de paiement ; nous ne les stockons jamais sur nos serveurs.</li>
        </ul>
      </>
    )
  },
  {
    id: 'youtube', title: 'Accès à votre compte YouTube', body: (
      <>
        <p>Si vous connectez une chaîne pour publier automatiquement, KappGen demande votre autorisation via Google OAuth pour obtenir un accès limité à la fonction de mise en ligne de vidéos de l'API YouTube Data. Nous n'accédons à rien d'autre sur votre compte Google.</p>
        <div className="legal-callout">
          <span className="legal-callout-label">Conformité API YouTube</span>
          <p>L'usage que fait KappGen des informations reçues des API YouTube respectera la <a href="https://developers.google.com/youtube/terms/api-services-terms-of-service#definitions" target="_blank" rel="noopener">Politique concernant les données des utilisateurs des services API de YouTube</a>, y compris les exigences de Limited Use. Pour comprendre comment Google traite vos données lorsque vous utilisez des applications tierces, consultez la <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">politique de confidentialité de Google</a>.</p>
        </div>
        <p>Vous pouvez révoquer cet accès à tout moment depuis les paramètres de votre chaîne dans KappGen, ou depuis la page <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Accès à des tiers</a> de votre compte Google.</p>
      </>
    )
  },
  {
    id: 'usage', title: 'Usage des données', body: (
      <>
        <ul>
          <li><strong>Générer vos vidéos</strong> — transformer vos scripts ou audios en voix off, images, sous-titres et montage final selon le style que vous avez configuré.</li>
          <li><strong>Publier en votre nom</strong> — uniquement si vous l'avez explicitement configuré, via l'autorisation YouTube décrite ci-dessus.</li>
          <li><strong>Faire fonctionner votre compte</strong> — authentification, facturation, support, notifications par email.</li>
          <li><strong>Sécuriser le service</strong> — détecter les abus, prévenir la fraude, faire respecter nos conditions d'utilisation.</li>
        </ul>
        <p className="legal-muted">Nous n'utilisons jamais le contenu de vos scripts ou vidéos pour entraîner des modèles d'intelligence artificielle, les nôtres ou ceux de nos prestataires.</p>
      </>
    )
  },
  {
    id: 'partage', title: 'Partage avec des tiers', body: (
      <>
        <p>Nous ne vendons aucune donnée. Certaines opérations sont sous-traitées à des prestataires spécialisés, strictement pour exécuter les fonctions ci-dessous :</p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead><tr><th>Prestataire</th><th>Rôle</th></tr></thead>
            <tbody>
              <tr><td>Anthropic</td><td>Génération des scripts et de la structure éditoriale à partir de vos consignes.</td></tr>
              <tr><td>Izivoice</td><td>Synthèse et clonage de voix off à partir du texte ou de l'audio fourni.</td></tr>
              <tr><td>Google / YouTube API</td><td>Publication de vos vidéos sur votre chaîne, avec votre autorisation.</td></tr>
              <tr><td>Brevo</td><td>Envoi des emails transactionnels (codes de récupération de compte, notifications).</td></tr>
              <tr><td>Prestataire de paiement</td><td>Traitement des abonnements et des transactions de paiement.</td></tr>
            </tbody>
          </table>
        </div>
        <p>Nous pouvons également divulguer des données si la loi l'exige, ou pour protéger nos droits, notre sécurité, ou celle de nos utilisateurs.</p>
      </>
    )
  },
  {
    id: 'conservation', title: 'Durée de conservation', body: (
      <p>Vos vidéos finales et les fichiers sources associés (voix off, images utilisées, configuration au moment du rendu) sont conservés tant que votre compte est actif, afin que vous puissiez régénérer ou modifier une vidéo sans repayer sa génération. Si vous supprimez votre compte, vos données sont effacées sous 30 jours, sauf obligation légale de conservation plus longue (facturation notamment).</p>
    )
  },
  {
    id: 'securite', title: 'Sécurité', body: (
      <p>Les mots de passe sont hachés, jamais stockés en clair. Les clés API que vous connectez sont chiffrées avant stockage. Les échanges entre votre navigateur et nos serveurs sont chiffrés en HTTPS. L'accès à l'infrastructure est limité aux personnes qui en ont strictement besoin pour faire fonctionner le service.</p>
    )
  },
  {
    id: 'droits', title: 'Vos droits', body: (
      <>
        <ul>
          <li><strong>Accéder</strong> à vos données ou en demander une copie.</li>
          <li><strong>Corriger</strong> les informations de votre profil, directement dans vos paramètres.</li>
          <li><strong>Supprimer</strong> votre compte et son contenu associé.</li>
          <li><strong>Retirer votre consentement</strong> pour la connexion YouTube ou le clonage vocal, à tout moment.</li>
        </ul>
        <p>Pour exercer ces droits, écrivez à <a href="mailto:contact@kappgen.com">contact@kappgen.com</a>. Nous répondons sous 30 jours.</p>
      </>
    )
  },
  {
    id: 'cookies', title: 'Cookies & stockage local', body: (
      <p>KappGen utilise le stockage local de votre navigateur pour garder votre session active et mémoriser vos préférences d'affichage (thème clair/sombre, par exemple) — pas de cookies publicitaires ni de traceurs tiers à des fins commerciales.</p>
    )
  },
  {
    id: 'transferts', title: 'Transferts internationaux', body: (
      <p>Certains de nos prestataires opèrent des serveurs situés hors de votre pays de résidence. Dans ce cas, nous nous assurons qu'un niveau de protection adapté encadre ce transfert, conformément aux garanties contractuelles de chaque prestataire.</p>
    )
  },
  {
    id: 'mineurs', title: 'Mineurs', body: (
      <p>KappGen n'est pas destiné aux personnes de moins de 16 ans. Nous ne collectons pas sciemment de données concernant des mineurs.</p>
    )
  },
  {
    id: 'modifications-privacy', title: 'Modifications', body: (
      <p>Nous pouvons mettre à jour cette politique pour refléter une évolution du service ou de la réglementation. Toute modification substantielle vous sera notifiée par email ou via un message dans l'application avant son entrée en vigueur.</p>
    )
  },
  {
    id: 'contact-privacy', title: 'Contact', body: (
      <p>Pour toute question sur cette politique ou vos données : <a href="mailto:contact@kappgen.com">contact@kappgen.com</a>.</p>
    )
  },
];

const TERMS_SECTIONS = [
  {
    id: 'objet', title: 'Objet du service', body: (
      <p>KappGen configure une fois le style de montage d'une chaîne (sous-titres, logo, musique, style d'images), puis génère automatiquement des vidéos longues à partir des scripts ou fichiers audio que vous soumettez. Le service inclut la génération de voix off, d'images, de sous-titres, et — si vous l'activez — la publication directe sur votre chaîne YouTube.</p>
    )
  },
  {
    id: 'compte', title: 'Votre compte', body: (
      <ul>
        <li><strong>Exactitude</strong> — vous garantissez que les informations fournies à l'inscription sont exactes et à jour.</li>
        <li><strong>Sécurité</strong> — vous êtes responsable de la confidentialité de votre mot de passe et de toute activité effectuée depuis votre compte.</li>
        <li><strong>Âge minimum</strong> — le service est réservé aux personnes de 16 ans et plus.</li>
        <li><strong>Un compte par personne</strong> — vous pouvez configurer plusieurs chaînes, mais un compte reste personnel et non transférable.</li>
      </ul>
    )
  },
  {
    id: 'contenu', title: 'Votre contenu', body: (
      <>
        <p>Vous restez propriétaire de tout ce que vous importez — scripts, fichiers audio, images, échantillons vocaux. En les soumettant, vous nous accordez uniquement le droit technique de les traiter pour générer votre vidéo. Nous ne revendiquons aucun droit de propriété sur votre contenu source.</p>
        <p>Vous garantissez détenir les droits nécessaires sur tout ce que vous importez, y compris pour le clonage vocal, où vous confirmez explicitement avoir le consentement de la personne dont la voix est clonée.</p>
      </>
    )
  },
  {
    id: 'generation', title: "Contenu généré par l'Agent", body: (
      <>
        <p>Les vidéos, voix off et images produites par KappGen sont générées automatiquement à partir de vos instructions. Vous êtes responsable de vérifier le résultat avant publication — KappGen ne garantit pas l'exactitude factuelle d'un script généré automatiquement.</p>
        <div className="legal-callout">
          <span className="legal-callout-label">Ce que nous ne garantissons pas</span>
          <p>La performance d'une vidéo (vues, monétisation, décisions de l'algorithme YouTube) dépend de facteurs hors de notre contrôle. Nous ne garantissons ni revenu, ni visibilité, ni absence de restriction imposée par YouTube sur un contenu généré.</p>
        </div>
      </>
    )
  },
  {
    id: 'youtube-terms', title: 'Publication sur YouTube', body: (
      <p>Si vous connectez une chaîne, vous autorisez KappGen à publier en votre nom via l'API YouTube Data, selon le mode que vous choisissez (manuel, automatique, ou programmé). Vous restez seul responsable du respect des règles de monétisation, de droits d'auteur et de communauté de YouTube sur votre chaîne. Vous pouvez révoquer cette autorisation à tout moment.</p>
    )
  },
  {
    id: 'usage-acceptable', title: 'Usage acceptable', body: (
      <>
        <p>Vous vous engagez à ne pas utiliser KappGen pour :</p>
        <ul>
          <li>Produire du contenu illégal, diffamatoire, ou qui enfreint les droits d'un tiers.</li>
          <li>Cloner une voix sans le consentement explicite de la personne concernée.</li>
          <li>Créer délibérément de la désinformation présentée comme factuelle.</li>
          <li>Contourner les limites techniques du service.</li>
        </ul>
        <p>Un manquement à ces règles peut entraîner la suspension ou la suppression de votre compte.</p>
      </>
    )
  },
  {
    id: 'abonnement', title: 'Abonnement & paiement', body: (
      <p>Certaines fonctionnalités (volume de vidéos, retrait du filigrane) nécessitent un abonnement payant. Les tarifs affichés au moment de la souscription s'appliquent ; nous vous informerons à l'avance de toute évolution tarifaire. Les paiements sont traités par notre prestataire de paiement tiers — nous ne stockons jamais vos coordonnées bancaires.</p>
    )
  },
  {
    id: 'propriete', title: 'Propriété intellectuelle', body: (
      <p>Le nom KappGen, son logo et l'interface du service nous appartiennent. Rien dans ces conditions ne vous cède de droit sur notre marque ou notre technologie, en dehors du droit d'utiliser le service tel que prévu ici.</p>
    )
  },
  {
    id: 'disponibilite', title: 'Disponibilité du service', body: (
      <p>Nous faisons notre possible pour maintenir KappGen disponible en continu, mais ne garantissons pas une disponibilité ininterrompue. Des interruptions peuvent survenir pour maintenance, mise à jour, ou en cas de panne d'un prestataire tiers.</p>
    )
  },
  {
    id: 'responsabilite', title: 'Limitation de responsabilité', body: (
      <p>Dans la limite permise par la loi, KappGen ne pourra être tenu responsable des pertes indirectes (perte de revenus, de vues, de monétisation YouTube) résultant de l'usage du service. Notre responsabilité totale, si elle est engagée, est limitée au montant payé au titre de votre abonnement au cours des douze derniers mois.</p>
    )
  },
  {
    id: 'resiliation', title: 'Résiliation', body: (
      <p>Vous pouvez fermer votre compte à tout moment depuis vos paramètres. Nous pouvons suspendre ou fermer un compte en cas de violation de ces conditions, avec notification préalable sauf urgence de sécurité.</p>
    )
  },
  {
    id: 'modifications-terms', title: 'Modifications', body: (
      <p>Nous pouvons modifier ces conditions pour refléter une évolution du service ou de la réglementation. Toute modification substantielle vous sera notifiée par email ou dans l'application avant son entrée en vigueur ; l'usage continu du service après cette date vaut acceptation.</p>
    )
  },
  {
    id: 'droit', title: 'Droit applicable', body: (
      <p>Ces conditions sont régies par le droit applicable au lieu d'établissement de KappGen. Tout litige sera soumis, à défaut de résolution amiable, aux tribunaux compétents de ce même lieu.</p>
    )
  },
  {
    id: 'contact-terms', title: 'Contact', body: (
      <p>Pour toute question sur ces conditions : <a href="mailto:contact@kappgen.com">contact@kappgen.com</a>.</p>
    )
  },
];

export default function LegalPage({ type }) {
  const isPrivacy = type === 'privacy';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const pageTitle = isPrivacy ? 'Politique de confidentialité' : "Conditions d'utilisation";
  const standfirst = isPrivacy
    ? "KappGen est un agent qui transforme un script ou un fichier audio en vidéo YouTube complète, et peut publier directement sur votre chaîne. Ce document explique quelles données nous traitons pour rendre ça possible, avec qui elles sont partagées, et comment vous gardez le contrôle."
    : "En créant un compte KappGen, vous acceptez les conditions ci-dessous. Elles régissent l'usage de l'Agent qui transforme vos scripts et fichiers audio en vidéos, et qui peut les publier sur votre chaîne YouTube.";

  useEffect(() => {
    document.title = `KappGen — ${pageTitle}`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = isPrivacy
      ? "Politique de confidentialité de KappGen : données collectées, accès YouTube, sous-traitants et droits des utilisateurs."
      : "Conditions d'utilisation de KappGen : usage du service, contenu généré, publication YouTube et responsabilités.";
  }, [isPrivacy, pageTitle]);

  return (
    <div className="landing-shell legal-shell">
      <header className="landing-header">
        <a className="brand" href="/" aria-label="KappGen — Accueil"><img src="/assets/logo/logo-kappgen.png" alt="" /><span>KappGen</span></a>
        <div className="header-actions"><a className="login-link" href={appUrl('/login')}>Se connecter</a><a className="button button-small" href={appUrl('/signup')}>Reprendre mon temps <ArrowRight size={15} /></a></div>
      </header>

      <main className="legal-main">
        <div className="legal-grid">
          <nav className="legal-toc" aria-label="Sommaire">
            <p className="legal-toc-label">Sommaire</p>
            <ol>
              {sections.map((s, i) => (
                <li key={s.id}><a href={`#${s.id}`}><span className="legal-num">{String(i + 1).padStart(2, '0')}</span>{s.title}</a></li>
              ))}
            </ol>
          </nav>

          <div className="legal-content">
            <div className="legal-masthead-meta">
              <span>{isPrivacy ? "Conditions d'utilisation" : 'Politique de confidentialité'} : <a href={isPrivacy ? '/terms' : '/privacy'}>{isPrivacy ? 'voir aussi →' : 'voir aussi →'}</a></span>
              <span>Dernière mise à jour — {LAST_UPDATED}</span>
            </div>
            <h1>{pageTitle}</h1>
            <p className="legal-standfirst">{standfirst}</p>

            {sections.map((s, i) => (
              <section className="legal-article" id={s.id} key={s.id}>
                <div className="legal-article-head">
                  <span className="legal-article-num">{String(i + 1).padStart(2, '0')}</span>
                  <h2>{s.title}</h2>
                </div>
                {s.body}
              </section>
            ))}
          </div>
        </div>
      </main>

      <footer className="landing-footer"><a className="brand" href="/"><img src="/assets/logo/logo-kappgen.png" alt="" /><span>KappGen</span></a><p>L’assistant autonome qui gère ton réseau de chaînes YouTube, de l’idée à la publication.</p><div><a href="/privacy">Confidentialité</a><a href="/terms">Conditions</a><a href={appUrl('/login')}>Connexion</a></div><span>© {new Date().getFullYear()} KappGen. Tous droits réservés.</span></footer>
    </div>
  );
}
