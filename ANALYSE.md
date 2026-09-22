# Analyse en verbetering — Duizenden 3D

Datum: 22 september 2026. Onderzocht: broncode, grafische scène, worpsimulatie, scorefuncties, botselecties, bediening, PWA-cache en browsergedrag.

## Visuele herziening na feedback

### Definitieve vorm op basis van de aangeleverde foto

De gebruiker specificeerde vervolgens een bol die aan zes kanten is afgesneden, met zes even grote cirkelvlakken die elkaar net niet raken. De afgeronde kubus is daarom vervangen door een aparte geometriebouwer in `die-geometry.mjs`. De snijvlakken liggen op afstand h van het middelpunt; de bolstraal is 1,395h. De cirkelstraal is √(R² − h²). Omdat R kleiner is dan √2h raken aangrenzende cirkels elkaar niet. De platte cirkels en bolstroken hebben afzonderlijke oppervlaktenormalen, zodat de vorm ook in reflecties correct leesbaar blijft.

De nieuwe vorm heeft een helderder rood materiaal, warmer crèmekleurige ogen en ondiepere uitsparingen volgens de referentie. Desktop en touch hebben respectievelijk 60.672 en 33.984 driehoeken per steen. Aanvullende tests controleren alle zes cirkels, de afstand tussen aangrenzende snijvlakken, de bolstraal van iedere gebogen vertex, symmetrie en de richting van alle driehoeken. Gooien, geluid en de bestaande botsingsvorm zijn niet gewijzigd. De botsingsvorm blijft dus een benadering van het zichtbare model. Cacheversie v5 bevat ook de nieuwe geometriebibliotheek.

### Eerdere aanpassing

De eerste versie maakte de stenen te hoekig en voegde een storende houten balk dwars over het laken toe. Die balk is verwijderd. De randen van de stenen hebben nu een ruimere afrondingsradius (18% van de steengrootte in plaats van 7%). De vlaknormalen worden pas na het uitsnijden van de ogen gladgestreken; eerder ging die correctie verloren door het opnieuw berekenen van de normalen.

De ogen zijn dieper, de lakreflectie is terughoudender, het hout donkerder en het vilt heeft een fijnere zichtbare structuur in een warmere groentint. Zachtere VSM-schaduwen en meer omgevingslicht verminderen het harde computerrendereffect. De drie visuele versies zijn vergeleken met dezelfde camera en vaste steenposities. Alle zes browsercontroles zijn opnieuw geslaagd (44,6 seconden). Werpinstellingen en botsingsgeluid zijn ongewijzigd. De service-worker-cache is verhoogd naar v4.

De onzichtbare voorbegrenzing van de bestaande worpfysica blijft behouden, zodat het goedgekeurde werpgedrag niet verandert. Deze visuele herziening is dus geen herkalibratie van de botsingswereld.

## Beoordeling van het oorspronkelijke spel

Het spel heeft een sterke functionele basis. De uitkomst wordt afgelezen uit de oriëntatie van de fysieke dobbelstenen. De simulatie gebruikt vaste tijdstappen, interpolatie, contactmaterialen, slaapdetectie en een geometrisch symmetrische botsingsvorm. De logica ondersteunt lokale multiplayer en drie botniveaus; de expertvariant vergelijkt de verwachte waarde van doorgooien met pakken. Namen worden bij het genereren van scorebord en eindstand ontsmet met `escapeHtml`.

Het grootste verschil tussen de bestaande presentatie en een geloofwaardige echte dobbeltafel zat in materiaalrespons, geometrie, schaal van details en continuïteit van beweging. Meer polygonen leverden hier geen evenredig realistischer beeld op.

## Bevindingen en uitgevoerde wijzigingen

| Onderdeel | Oorspronkelijke bevinding | Uitgevoerd |
| --- | --- | --- |
| Geometrie | Elke steen had 192 segmenten per vlak: 442.368 driehoeken, samen 2.654.208 vóór schaduwpasses. De bolbegrenzing rondde vooral hoeken af. | Afgeronde kubus met afgeronde randen én hoeken. 64 segmenten op desktop, 40 bij een grove aanwijsvoorziening. |
| Kunsthars en ogen | Bumpsterkte 0,16 tegenover een steengrootte van 0,36; de visuele reliëfwerking was buiten verhouding. | Subtiel reliëf, ondiepe geometrische pipuitsparingen, gecontroleerde clearcoat en ruwheid. De ogen blijven afleesbaar. |
| Vilt | Gekleurde ruis werd ook als hoogtemap gebruikt; de bumptextuur erfde de kleurcodering. | Losse kleur- en hoogtekaarten met fijne vezel-/weefstructuur. Hoogtekaarten worden als lineaire data behandeld. |
| Hout | Effen donkerbruine rail, zonder nerf. | Procedurele houtnerf, fijne reliëfvariatie en gematigde lakglans. Hout blijft een niet-metallisch materiaal. |
| Tafel | Onzichtbare fysieke voorwand bij z=0,55 veroorzaakte botsingen zonder zichtbaar object. | Messing randdetails en instanced stiksels. De aanvankelijk toegevoegde houten stop is na feedback verwijderd; de bestaande werpbegrenzing blijft behouden. |
| Licht | Centraal licht en beperkt omgevingslicht maakten materiaalverschillen minder leesbaar. | Schuin geplaatst warm hoofdlicht, hemisfeerinvulling, reflectieomgeving, aangepaste belichting en schaduwbias. |
| Bewaren | `moveToKept` verborg stenen onmiddellijk ondanks de aangekondigde animatie. | Korte optil-/wegpakbeweging. Het lichaam wordt vooraf uit de fysica verwijderd; de callback volgt na de animatie. |
| Effecten | Relatief nadrukkelijke stofwolken en zelfoplichtende selectie. | Veel subtieler stof en selectie, respect voor minder-bewegingvoorkeuren bij intro, wegpakken en confetti. |
| Geluid | Relatief lange, sterk laagdoorlaat-gefilterde ruis maakte alle botsingen dof. | Kortere materiaalafhankelijke aanslagen, volume op basis van inslagsterkte en stereopositie op basis van tafelpositie. |
| Batterij/GPU | Een stilstaand beeld werd iedere frame opnieuw getekend. | Hertekenen bij gewijzigde scène of actieve animatie; de fysica blijft alleen tijdens een worp actief. |
| Tabonderbreking | Een wandklokbudget liep door terwijl de browser de animatie onderbrak. | Worpbudget telt actieve simulatietijd; bij terugkeer wordt de klok ververst. Een verborgen tab forceert geen voortijdige uitslag. |
| Starten | Een spel kon starten vóórdat de 3D-renderer gereed was. | Gereedheidscontrole en zichtbare laadstatus. Gooien zonder beschikbare renderer wordt geblokkeerd. |
| Acties | De functies vertrouwden deels op uitgeschakelde knoppen. Rechtstreekse ongeldige acties konden toch doorlopen. | Extra controles op spelstatus, geldige selectie en minimumscore in gooien/pakken zelf. |
| Toetsenbord | Alleen gooien en pakken; geen directe steenselectie. Sneltoetsen bleven onder overlays actief. | Toetsen 1–6 selecteren stenen, focusmarkering en blokkeren van spelacties terwijl informatiepanelen openstaan. |
| Offline | Modules kwamen van een CDN en werden pas bij gebruik gecachet. Externe fonts bleven een laaddependency. | Versies vastgelegd in `vendor/`, met licenties; alle noodzakelijke spelbestanden in de app-shell. Lokale serif-fallbacks. |
| Cacheveiligheid | Activatie verwijderde alle andere caches op dezelfde oorsprong. | Alleen verouderde caches met de eigen `duizenden-`prefix worden verwijderd. |
| Documentatie | README en spelregeltekst beschreven de eindronde anders dan de implementatie. | Documentatie volgt nu expliciet de bestaande huisregel: de lopende ronde uitspelen, evenveel beurten voor iedereen. |
| Testharnas | De CLI-startcontrole bouwde handmatig een bestands-URL en werkte daardoor niet betrouwbaar op Windows. | `pathToFileURL` en controle op een positief worpaantal. |

## Meetbare geometriereductie

| | Voorheen | Nu desktop | Nu touch |
| --- | ---: | ---: | ---: |
| Driehoeken per steen | 442.368 | 49.152 | 19.200 |
| Zes stenen | 2.654.208 | 294.912 | 115.200 |
| Reductie | — | 88,9% | 95,7% |

Dit zijn berekende geometrieaantallen, geen gemeten FPS-winst. Schaduwpasses, resolutie, GPU en browser beïnvloeden de werkelijke prestaties. Stiksels gebruiken één instanced mesh.

## Validatie

### Score en bots

Drie geautomatiseerde tests zijn geslaagd. Naast concrete voorbeelden voor losse enen/vijven, trio's, straat en ongeldige selecties zijn alle **55.986 geordende worpen** met één tot zes stenen doorlopen. Iedere door de bot aangeboden bewaaroptie vormt een geldige selectie met dezelfde puntentelling. De test verifieert consistentie met de bestaande huisregels, niet dat deze huisregels de enige mogelijke Farkle-variant zijn. De volledige optimale beslisstrategie en de vooraf berekende V-tabel zijn niet opnieuw wiskundig afgeleid.

### Browser

Getest in lokaal Google Chrome:

- Echte worp, geldige fysieke uitslagen, toetsenbordselectie, wegpakanimatie, punten pakken en beurtwissel; geen JavaScriptfouten waargenomen in die flow.
- Een poging om onder 350 punten te pakken wijzigt score en beurt niet.
- De bestaande eindronde geeft iedereen evenveel beurten en toont de eindstand.
- Offline herladen, starten en gooien na installatie van de service worker.
- Landschapweergave op 844 × 390 met minder beweging.
- Een onderbroken tab met een wachttijd langer dan het oude achtsecondenbudget.

De eerste testuitvoering met geforceerde SwiftShader-softwareweergave had time-outs bij worpen. De zelfstandige controle en de vijf oorspronkelijke browsertests met de normale Chrome-instellingen slaagden vervolgens (39 seconden voor die vijf tests). Dit is geen prestatiegarantie voor apparaten zonder werkende grafische versnelling.

### Fysica

De fysicaparameters zijn behouden. Het bestaande hoofdloze harnas simuleerde 2.000 worpen / 12.000 stenen:

| Meetpunt | Resultaat |
| --- | ---: |
| Gemiddelde rusttijd | 2,23 s |
| Maximale rusttijd | 5,43 s |
| Worpen langer dan 4 s | 0,2% |
| Scheef bij eerste natuurlijke rust | 0,43% van de stenen |
| Worpen met kantel-/herworpinterventie | 2,6% |
| Nood-tween nodig | 0,00% |
| Minder dan 2,5 rad totale rotatie | 0,00% |
| Eindigend gestapeld | 0,02% van de stenen |
| Aantallen 1 t/m 6 | 2015 / 2036 / 2063 / 1985 / 1944 / 1957 |
| Chi² (5 vrijheidsgraden) | 5,3; onder de 5%-grens 11,07 |

Een voorafgaande kleine proef met 300 worpen gaf chi²=13,1, boven die grens. Dat is expliciet geen aanleiding geweest de fysica te veranderen of de steekproef opnieuw te laten lopen tot een gunstig resultaat. De grotere vooraf aangekondigde proef van 2.000 worpen geeft meer informatie. Geen van beide proeven bewijst perfecte eerlijkheid; incidentele statistische uitschieters horen bij willekeurige steekproeven.

## Grenzen van het resultaat

De presentatie is overtuigender als virtuele tafel, maar dit is geen fotorealistische scan van een bestaande tafel. Materialen zijn procedureel; er zijn geen gemeten reflectiedata of gefotografeerde materiaalsets gebruikt. De fysica heeft nog steeds stabiliserende torque, herworpen en een laatste rustcorrectie. De claim “volledig onbewerkte echte fysica” zou daarom te sterk zijn. De visuele afronding is een benadering van de bestaande afgeschuinde botsingsvorm.

Het spel gebruikt interne afstanden en massa's; die zijn niet opnieuw gekalibreerd op centimeterafmetingen en gemeten botsingen van echte dobbelstenen. Het toevoegen van zwaar scherptediepte- of bewegingsonscherpte-effect is bewust vermeden om ogen leesbaar en de mobiele belasting beperkt te houden.

De primaire spelcode staat nog grotendeels in één HTML-bestand. De materiaalmodule, reproduceerbare ontwikkeldependencies en tests maken verdere opsplitsing veiliger. Er is geen online multiplayer, cloudopslag of server toegevoegd. Het mobiele resultaat is in een browserviewport getest, niet op een fysieke iPhone of Android-telefoon; geluidsbeleving is niet op verschillende luidsprekers gevalideerd.

## Uitvoeren

Gebruik `npm ci`, daarna `npm start`, en open `http://localhost:8080`. Voor het spel zelf zijn geen externe services of runtime-installaties van npm-pakketten nodig als de bestanden al via een statische webserver worden aangeboden. De tests en ontwikkelserver gebruiken Node.js; de browsertests verwachten Google Chrome.
