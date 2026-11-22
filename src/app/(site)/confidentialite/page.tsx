import type { Metadata } from "next";
import { PHONE_DISPLAY } from "@/lib/site";
import { whatsappLink } from "@/lib/catalog";
import { Container } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Quelles données MaelEnglish collecte, pourquoi, combien de temps, et comment exercer vos droits.",
  alternates: { canonical: "/confidentialite" },
};

/*
 * ⚠ Texts in [crochets] must be completed by the owner (legal entity, contact email).
 * Not legal advice: have it reviewed before publication.
 */
const UPDATED = "18 novembre 2026";
const ENTITY = "[Nom de la structure juridique, adresse — à compléter]";
const EMAIL = "[adresse email de contact — à compléter]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-extrabold text-brand-deep">{title}</h2>
      <div className="grid gap-3 text-ink/85 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold text-brand-deep sm:text-4xl">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : {UPDATED}</p>

      <div className="mt-8 grid gap-8 leading-relaxed">
        <Section title="Qui sommes-nous ?">
          <p>
            MaelEnglish est une plateforme d&apos;apprentissage de l&apos;anglais professionnel fondée par Ismaël Zerbo (« Coach Ish »). Le
            responsable du traitement des données est : {ENTITY}.
          </p>
          <p>
            Contact : {EMAIL} · WhatsApp{" "}
            <a href={whatsappLink()} className="font-semibold text-primary underline" target="_blank" rel="noopener">
              {PHONE_DISPLAY}
            </a>
            .
          </p>
        </Section>

        <Section title="Les données que nous collectons">
          <ul className="grid gap-1.5">
            <li>
              <strong>Compte</strong> : prénom, nom, nom d&apos;utilisateur, adresse email et/ou numéro WhatsApp, rôle, niveau d&apos;anglais.
              Votre mot de passe est stocké sous forme chiffrée (empreinte), jamais en clair.
            </li>
            <li>
              <strong>Apprentissage</strong> : cours suivis, leçons terminées, réponses et scores aux exercices et quiz, devoirs envoyés et
              corrections de votre coach, points d&apos;expérience (XP), série de jours, badges.
            </li>
            <li>
              <strong>Défis oraux et photo</strong> : les enregistrements de votre voix que vous envoyez pour les défis oraux, les messages
              vocaux et commentaires de votre coach en réponse, et votre photo de profil si vous en ajoutez une. Vos enregistrements sont
              privés : seuls vous, votre coach et les administrateurs peuvent les écouter.
            </li>
            <li>
              <strong>Sécurité et appareils</strong> : sessions de connexion, type d&apos;appareil, navigateur, système, adresse IP et date de
              dernière connexion, pour protéger votre compte et vous montrer vos appareils connectés.
            </li>
            <li>
              <strong>Dictionnaire et carnet</strong> : les mots que vous cherchez sont envoyés à un service de dictionnaire
              (dictionaryapi.dev), pour la traduction à un outil d&apos;IA (Anthropic) et, pour la prononciation, au service de voix
              de Microsoft (Azure AI Speech) — sans votre nom. Les mots que vous ajoutez à
              votre carnet (avec la phrase où vous les avez trouvés) sont enregistrés sur votre compte.
            </li>
            <li>
              <strong>Expression écrite</strong> : les textes que vous écrivez dans les activités d&apos;expression écrite sont transmis à un
              outil de correction par intelligence artificielle (Anthropic), qui prépare une correction pour votre coach ; c&apos;est votre
              coach qui vérifie et vous envoie le retour. Ces textes ne sont pas utilisés pour entraîner les modèles de ce prestataire.
            </li>
            <li>
              <strong>Conversations avec le partenaire IA (« Speaking Partner »)</strong> : pendant une conversation, votre voix est
              transmise en direct au service ElevenLabs, qui la transcrit et fait répondre l&apos;IA (modèle d&apos;Anthropic) ; ElevenLabs
              conserve la conversation selon ses propres règles. Nous enregistrons sur votre compte la transcription écrite, sa
              durée et le bilan (préparé par un outil d&apos;IA, Anthropic), que votre coach peut consulter. Nous ne gardons pas
              l&apos;enregistrement audio sur nos serveurs.
            </li>
            <li>
              <strong>Exercices de prononciation (« Répétez après Mael »)</strong> : nous n&apos;enregistrons pas votre voix sur nos serveurs.
              Pour vérifier ce que vous avez dit, l&apos;exercice utilise la reconnaissance vocale de votre navigateur : votre voix est alors
              envoyée au service de l&apos;éditeur du navigateur (par exemple Google pour Chrome, Apple pour Safari), qui la transcrit en
              texte ; une connexion internet est nécessaire. Ce traitement relève de la politique de confidentialité de cet éditeur. Nous
              recevons seulement le texte reconnu, qui sert à calculer votre score. Si votre navigateur n&apos;a pas la reconnaissance vocale,
              l&apos;enregistrement reste sur votre appareil et vous vous évaluez vous-même.
            </li>
          </ul>
          <p>Nous ne collectons pas de données de paiement sur la plateforme et n&apos;utilisons pas d&apos;outil publicitaire.</p>
        </Section>

        <Section title="Pourquoi nous les utilisons">
          <ul className="grid gap-1.5">
            <li>créer et sécuriser votre compte, vous permettre de vous connecter ;</li>
            <li>vous donner accès à vos cours, enregistrer votre progression et permettre à votre coach de corriger vos devoirs ;</li>
            <li>vous envoyer les messages liés au service : lien d&apos;activation ou de réinitialisation du mot de passe (par email), confirmation d&apos;inscription à un cours (par email ou WhatsApp) ;</li>
            <li>afficher le classement hebdomadaire d&apos;un cours, avec uniquement votre prénom et l&apos;initiale de votre nom ;</li>
            <li>améliorer nos contenus à partir de statistiques globales.</li>
          </ul>
          <p>Ces traitements sont nécessaires à l&apos;exécution du service de formation que vous avez demandé, ou reposent sur notre intérêt légitime à le sécuriser et l&apos;améliorer.</p>
        </Section>

        <Section title="Qui peut y accéder ?">
          <ul className="grid gap-1.5">
            <li>l&apos;équipe MaelEnglish : administrateurs, et les coachs et formateurs des cours auxquels vous êtes inscrit(e) ;</li>
            <li>
              nos prestataires techniques, uniquement pour faire fonctionner le service : hébergement de l&apos;application et de la base de
              données, stockage des fichiers audio et des photos (Cloudflare R2), correction des textes et bilans de conversation par IA (Anthropic), conversations vocales avec l&apos;IA (ElevenLabs), envoi d&apos;emails (Brevo), messages WhatsApp (Meta) ;
            </li>
            <li>les autres apprenants d&apos;un cours voient seulement votre prénom, l&apos;initiale de votre nom et vos XP de la semaine dans le classement.</li>
          </ul>
          <p>Nous ne vendons ni ne louons vos données.</p>
        </Section>

        <Section title="Cookies et stockage sur votre appareil">
          <p>
            Nous utilisons uniquement des cookies nécessaires : un cookie de session (pour rester connecté) et un identifiant d&apos;appareil.
            L&apos;application enregistre aussi sur votre appareil vos préférences (sons) et une copie des leçons déjà ouvertes, pour
            un usage hors ligne. Ces données sont effacées à la déconnexion. Aucun cookie publicitaire ni de mesure d&apos;audience tierce.
          </p>
        </Section>

        <Section title="Combien de temps nous les gardons">
          <p>
            Vos données sont conservées tant que votre compte est actif, puis [3 ans après votre dernière activité — durée à confirmer], sauf
            obligation légale. Les sessions de connexion expirent après 30 jours d&apos;inactivité, et les liens d&apos;activation et de
            réinitialisation après 7 jours et 1 heure.
          </p>
        </Section>

        <Section title="Vos droits">
          <p>
            Vous pouvez demander à accéder à vos données, les corriger, les supprimer ou vous opposer à certains traitements. Écrivez-nous
            à {EMAIL} ou sur WhatsApp ; nous répondons dans un délai d&apos;un mois. Vous pouvez aussi saisir la Commission de
            l&apos;Informatique et des Libertés (CIL) du Burkina Faso.
          </p>
        </Section>

        <Section title="Sécurité">
          <p>
            Connexions chiffrées (HTTPS), mots de passe chiffrés, sessions révocables depuis votre compte, limitation des tentatives de
            connexion, et accès de l&apos;équipe limité selon les rôles.
          </p>
        </Section>
      </div>
    </Container>
  );
}
