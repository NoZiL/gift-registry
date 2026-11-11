import { BABY } from "../lib/site";

// The top of the page, drawn after the faire-part: the floral wreath framing
// her name, then the three numbers from the back of the card.
const STATS = [
  { icon: "/icon-weight.png", label: "Poids", value: BABY.weight, w: 201 },
  { icon: "/icon-length.png", label: "Taille", value: BABY.length, w: 121 },
  { icon: "/icon-time.png", label: "Heure de naissance", value: BABY.time, w: 158 },
];

export default function Hero() {
  return (
    <header className="hero">
      <div className="wreath">
        {/* Decorative: the text inside says everything the picture does. */}
        <img className="wreath-img" src="/wreath.webp" alt="" width="680" height="878" />
        <div className="wreath-text">
          <p className="wreath-welcome">bienvenue</p>
          <p className="wreath-name">{BABY.name}</p>
          <p className="wreath-date">{BABY.birthDate}</p>
        </div>
      </div>

      <ul className="stats">
        {STATS.map((s) => (
          <li key={s.label} className="stat">
            <img
              className="stat-icon"
              src={s.icon}
              alt=""
              width={Math.round((s.w * 44) / 158)}
              height="44"
            />
            <span className="visually-hidden">{s.label} : </span>
            <span className="stat-value">{s.value}</span>
          </li>
        ))}
      </ul>

      <p className="hero-message">{BABY.message}</p>
    </header>
  );
}
