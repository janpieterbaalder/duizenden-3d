# Duizenden 3D 🎲

*Duizenden met Buist* — het klassieke dobbelspel (Farkle-variant) als 3D-webapp, met echte physics, slimme bots en hot-seat multiplayer. Volledig client-side: één HTML-bestand, geen build-stap, geen server nodig.

## Spelen

Open `index.html` in een moderne browser, of serveer de map lokaal:

```sh
npx serve .
# of
python3 -m http.server
```

Op telefoon/tablet: speel in liggende stand. Via HTTPS is het spel **installeerbaar als app** (PWA) en daarna offline speelbaar.

## Spelregels

- Gooi 6 dobbelstenen; de eerste speler tot **10.000 punten** wint.
- **Eén** = 100 punten, **vijf** = 50 punten.
- **Drie gelijke** = waarde × 100 (drie zessen = 600); **drie enen** = 1.000.
- **Straat** 1-2-3-4-5-6 in één worp = 1.000 punten.
- Minimaal **350 punten** per beurt om te mogen pakken.
- Geen score in een worp? *De tragiek!* — alle beurtpunten weg.
- Alle 6 bewaard? **En door!** — gooi opnieuw met alle 6.
- Zodra iemand 10.000 haalt, krijgt elke andere speler nog precies één laatste beurt; de hoogste score wint.

## Features

- 🎲 **Echte 3D-physics** — Three.js + cannon-es; de worp-uitkomst komt uit de fysica, geen vooraf bepaald resultaat. Worp-eerlijkheid en natuurlijk tuimelgedrag zijn gevalideerd met een headless physics-testharnas (chi²-toets over duizenden gesimuleerde worpen).
- 🎯 **Tragiek-kans indicator** — zie live het risico van je volgende worp.
- 🎬 **Cinematics** — camera-intro, stofwolkjes bij landing, pulserende selectie-ringen, screen-flash bij De Tragiek/En Door, combo-toasts voor straat en drie enen.
- 🤖 **Drie botniveaus** — Makkelijk (pakt zo snel mogelijk), Normaal (vuistregels), Expert (wiskundig optimaal via dynamic programming).
- 👥 **Hot-seat multiplayer** — 2 t/m 11 spelers met eigen namen.
- 📊 **Statistieken** — spellen, overwinningen, hoogste beurt/eindscore en tragieks, bewaard in `localStorage`.
- 🏆 **Eindstand-ranking**, voortgangsbalken naar 10.000 en score-animaties.
- ⌨️ **Sneltoetsen** (desktop): Spatie = gooien, Enter = pakken, Esc = sluiten.
- 📳 Trilfeedback op mobiel, realistische collision-audio (Web Audio) en CC0-samples van [Kenney.nl](https://kenney.nl) (zie `sounds/CREDITS.txt`).
- 📱 **PWA** — manifest + service worker: installeerbaar en offline speelbaar.

## Techniek

| Bestand | Inhoud |
| --- | --- |
| `index.html` | Volledige app: UI, spel-logica, bot-AI en 3D-renderer |
| `sw.js` | Service worker (cache-first, offline support) |
| `manifest.webmanifest` / `icon.svg` | PWA-installatie |
| `sounds/` | CC0-audiosamples |

De 3D-renderer (Three.js + cannon-es, geladen via unpkg-importmap) levert de worp-uitkomsten; de klassieke script-sectie blijft de bron van waarheid voor scores, selectie en bot-AI. De expert-bot gebruikt een vooraf berekende V-tabel (verwachte beurtwaarde per toestand) uit dynamic programming over alle mogelijke worpen.
