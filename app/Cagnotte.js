import { BABY } from "../lib/site";

// For guests who'd rather contribute to something bigger than pick an item:
// a link out to the onparticipe.fr money pot. Nothing to reserve, no name to
// give here — the cagnotte site handles all of that on its side.
export default function Cagnotte({ cagnotte }) {
  if (!cagnotte) return null;
  return (
    <section className="cagnotte" aria-labelledby="cagnotte-title">
      <h2 id="cagnotte-title" className="cagnotte-title">
        La cagnotte de {BABY.name}
      </h2>
      <p className="cagnotte-text">
        Vous préférez ne pas choisir un cadeau précis&nbsp;? Vous pouvez aussi
        participer, du montant de votre choix, à la cagnotte en ligne.
      </p>
      <a className="cagnotte-button" href={cagnotte.url} target="_blank" rel="noopener noreferrer">
        Participer à la cagnotte
      </a>
      <p className="cagnotte-note">S'ouvre sur le site {cagnotte.host}</p>
    </section>
  );
}
