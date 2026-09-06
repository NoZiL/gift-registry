"use client";

import { useEffect, useId, useState } from "react";

// The step-by-step guide at the top of the page. Most of the guests here have
// never used a registry site — several have never reserved anything online at
// all — so the steps name the buttons literally ("Je m'en occupe", "Annuler")
// and say what happens after each tap, rather than assuming the conventions.
//
// It opens by default: someone who needs it shouldn't have to find it first.
// Closing it is remembered, so a guest coming back to reserve a second gift
// isn't made to scroll past the whole thing again.
const STORAGE_KEY = "giftRegistry.howToClosed";

function readClosed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private browsing or storage blocked — the guide just opens every time.
    return false;
  }
}

function writeClosed(closed) {
  try {
    if (closed) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as above: the choice holds for this visit, it just won't stick.
  }
}

const STEPS = [
  {
    title: "Écrivez votre nom",
    body: (
      <>
        Dans l'encadré <b>Votre nom</b>, écrivez votre prénom — ou la façon dont
        la famille vous appelle, par exemple « Mamie Christiane » — puis touchez{" "}
        <b>Enregistrer</b>. C'est ce qui permet de savoir qui apporte quoi. Il
        n'y a ni compte à créer, ni mot de passe. Si vous avez reçu un lien
        personnel ou un QR code, votre nom est déjà écrit : vous n'avez rien à
        faire.
      </>
    ),
  },
  {
    title: "Parcourez la liste",
    body: (
      <>
        Les cadeaux sont rangés par catégorie. Touchez le titre d'une catégorie
        pour la replier ou la rouvrir. Quand il y a beaucoup de cadeaux, un
        encadré <b>Filtrer</b> apparaît au-dessus de la liste : il permet de
        n'afficher qu'une catégorie, ou seulement les cadeaux d'un certain prix.
        Vous n'êtes obligé de rien : sans filtre, toute la liste s'affiche.
      </>
    ),
  },
  {
    title: "Regardez l'article de plus près",
    body: (
      <>
        Touchez <b>Voir l'article ↗</b> (ou la photo à gauche) pour ouvrir la
        page du magasin dans un nouvel onglet : vous y verrez le modèle exact,
        les couleurs et le prix. Pour revenir à la liste, fermez cet onglet ou
        utilisez la flèche « retour » de votre téléphone.
      </>
    ),
  },
  {
    title: "Réservez ce que vous voulez offrir",
    body: (
      <>
        Touchez <b>Je m'en occupe</b> sur le cadeau choisi. Il disparaît alors de
        la liste des autres invités, pour que personne n'achète la même chose en
        double. Vous pouvez en réserver plusieurs.
      </>
    ),
  },
  {
    title: "Achetez-le où vous voulez",
    body: (
      <>
        Rien n'est acheté ni payé sur ce site : on ne vous demandera jamais de
        carte bancaire. Réserver veut simplement dire « c'est moi qui l'apporte ».
        Le lien n'est qu'une suggestion — vous pouvez acheter le même article
        ailleurs, ou en magasin, comme vous préférez.
      </>
    ),
  },
  {
    title: "Retrouvez vos réservations",
    body: (
      <>
        Une fois un cadeau réservé, l'encadré <b>Vos réservations</b> apparaît en
        haut de la page : il récapitule ce que vous apportez, avec le lien vers
        chaque article et le total. Il vous attend aussi quand vous revenez plus
        tard, sur le même téléphone.
      </>
    ),
  },
  {
    title: "Changé d'avis ?",
    body: (
      <>
        Dans <b>Vos réservations</b>, touchez <b>Annuler</b> à côté de l'article :
        il retourne aussitôt dans la liste et quelqu'un d'autre pourra le prendre.
        Aucun souci, et personne n'est prévenu.
      </>
    ),
  },
];

const NOTES = [
  <>
    Vos réservations sont retrouvées grâce à votre nom. Sur un autre téléphone ou
    un autre ordinateur, écrivez exactement le même nom (les majuscules et les
    accents n'ont pas d'importance) et vous les retrouverez.
  </>,
  <>
    Vous vous êtes trompé de nom ? Touchez <b>Modifier</b> à côté de votre nom
    pour le corriger.
  </>,
  <>
    La liste se met à jour toute seule : les cadeaux déjà réservés par quelqu'un
    d'autre n'apparaissent plus. Si elle vous semble vide ou étrange, actualisez
    la page.
  </>,
  <>
    Un doute, un problème, ou envie d'offrir quelque chose qui n'est pas dans la
    liste ? Appelez-nous, on s'en occupe avec vous.
  </>,
];

export default function HowTo() {
  // The server can't read localStorage, so the first render is the open one
  // and the effect closes it back for a guest who asked for that.
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  useEffect(() => {
    if (readClosed()) setOpen(false);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    writeClosed(!next);
  }

  return (
    <section className="howto">
      <button
        type="button"
        className="howto-header"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <span
          className={`group-caret${open ? "" : " group-caret-closed"}`}
          aria-hidden="true"
        >
          ▾
        </span>
        <span className="howto-title">Comment ça marche ? (à lire une fois)</span>
        <span className="howto-toggle">{open ? "Masquer" : "Afficher"}</span>
      </button>

      <div id={bodyId} hidden={!open}>
        <ol className="howto-steps">
          {STEPS.map((step) => (
            <li key={step.title} className="howto-step">
              <span className="howto-step-title">{step.title}</span>
              <span className="howto-step-body">{step.body}</span>
            </li>
          ))}
        </ol>

        <p className="howto-notes-title">Bon à savoir</p>
        <ul className="howto-notes">
          {NOTES.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
