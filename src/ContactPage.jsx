import { useState } from 'react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import './landing.css';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`[KappGen] ${data.get('subject') || 'Demande de contact'}`);
    const body = encodeURIComponent(`Nom : ${data.get('name')}\nEmail : ${data.get('email')}\n\n${data.get('message')}`);
    window.location.href = `mailto:contact@kappgen.com?subject=${subject}&body=${body}`;
    setSent(true);
  };
  return <div className="landing-shell contact-page">
    <header className="landing-header"><a className="brand" href="/"><img src="/assets/logo/logo-kappgen.png" alt="" /><span>KappGen</span></a><a className="login-link" href="/">Retour à l’accueil</a></header>
    <main className="contact-main"><div className="section-kicker">CONTACT</div><h1>Parlons de ton projet.</h1><p className="contact-lead">Une question sur KappGen, tes vidéos ou ton offre ? Écris-nous, notre équipe te répondra.</p>
      <div className="contact-grid"><aside className="contact-card"><Mail size={24} /><h2>Notre adresse</h2><a href="mailto:contact@kappgen.com">contact@kappgen.com</a><p>Pour le support, les partenariats et les demandes commerciales.</p></aside>
        <form className="contact-form" onSubmit={submit}><label>Nom<input name="name" required /></label><label>Adresse e-mail<input type="email" name="email" required /></label><label>Sujet<input name="subject" required /></label><label>Message<textarea name="message" rows="6" required /></label><button className="button button-primary" type="submit">{sent ? 'Message préparé' : 'Préparer mon message'} <ArrowRight size={17} /></button>{sent && <p className="contact-success">Ton application e-mail va s’ouvrir pour envoyer le message.</p>}</form>
      </div><a className="text-link contact-back" href="/"><ArrowLeft size={16} /> Retour à KappGen</a>
    </main>
  </div>;
}
