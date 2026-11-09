// A subject's colour and picture, as the building blocks take them.
import { TONES, type IconName, type Tone } from "@study/ui";

/** The tone of a subject's stored colour; grey without one. */
export function toneOf(color: string | null | undefined): Tone {
  return (TONES as readonly string[]).includes(color ?? "") ? (color as Tone) : "grau";
}

const ICONS: [RegExp, IconName][] = [
  [/mathe|analysis|algebra|statistik|numerik|stochastik/i, "sigma"],
  [/regel|signal|elektro|schaltung|nachrichten|mess/i, "signal"],
  [/mechanik|statik|bau|festigkeit|tragwerk/i, "building"],
  [/werkstoff|material|kristall/i, "crystal"],
  [/thermo|wärme|energie|strömung|fluid/i, "flame"],
  [/konstruk|cad|zeichn|maschinenelement|geometr/i, "compass"],
  [/chemie|labor/i, "flask"],
  [/informatik|program|software|daten|algorithm|code/i, "code"],
  [/physik|quanten|optik/i, "atom"],
  [/bio|umwelt|ökolog/i, "leaf"],
  [/sprach|englisch|französisch|spanisch|wirtschaft|recht|bwl|vwl/i, "globe"],
  [/rechn|finanz|kosten/i, "calculator"],
];

/** A picture for a subject, guessed from its name. */
export function courseIcon(title: string): IconName {
  return ICONS.find(([pattern]) => pattern.test(title))?.[1] ?? "book";
}
