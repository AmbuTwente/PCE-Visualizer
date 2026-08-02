# PCE-Visualizer

> [!IMPORTANT]
> **Gearchiveerd.** Het PCE-project is afgerond. De dagelijkse pipeline is gestopt en de live-site op
> `pce-poc.b-cdn.net` bestaat niet meer. Wat de visualizer als laatste liet zien staat hieronder als
> vaste afbeelding, en de broncode blijft staan zodat je hem lokaal opnieuw kunt draaien.

> [!NOTE]
> Deze repository is geen onderdeel van de officiële scope of het onderzoeksrapport van het PCE-project.
> Het is een intern hulpmiddel dat wij zelf hebben opgezet om onze Bicep-infrastructuur beter te kunnen uitleggen aan elkaar.

## De laatste stand van zaken

Dit is de infrastructuur zoals de visualizer die op 2 augustus 2026 uit de Bicep-modules van
[PCE-PoC](https://github.com/ambutwente/PCE-PoC) heeft opgebouwd — 15 Azure-resources, verdeeld over 6 modules:

![Momentopname van de PCE-PoC infrastructuur: 6 Bicep-modules met daarin 15 Azure-resources en hun onderlinge afhankelijkheden](docs/graph-snapshot.svg)

Elk kader is één `.bicep`-module. De blokjes daarin zijn de resources die Azure zou aanmaken, en de pijlen
wijzen naar datgene waarvan een resource afhankelijk is. Een `[]` achter het type betekent dat de resource
in een `[for]`-lus zit en dus meerdere keren uitgerold wordt.

De afbeelding is een gewone SVG zonder scripts of externe verwijzingen: geen CDN, geen netwerkverkeer,
niets dat kan verlopen.

## Wat is dit?

PCE-Visualizer is een fork van het open-source project [bicep-visualizer](https://github.com/aipx-proto/bicep-visualizer), beschikbaar onder de [MIT-licentie](THIRD_PARTY_NOTICES.md).

De visualisatie die je ziet lijkt op wat de Bicep-extensie in Visual Studio Code laat zien als je een `.bicep`-bestand opent. Wij hebben die visualisatie-engine hergebruikt om onze eigen modules in kaart te brengen.

## Waarvoor hebben wij het gebruikt?

Tijdens het project werden er steeds meer Bicep-modules aangemaakt in de [PCE-PoC](https://github.com/ambutwente/PCE-PoC) repository. Om intern beter uit te kunnen leggen welke Azure-resources onze pipeline zou gaan deployen en hoe die met elkaar samenhangen, hebben wij deze visualizer opgezet.

Het was eigenlijk een soort "wat als we dit uitrollen" overzicht: je ziet precies welke resources er in Azure zouden komen te staan en hoe ze aan elkaar gekoppeld zijn.

## Hoe werkte het?

1. Een GitHub Actions-workflow haalde dagelijks de [PCE-PoC](https://github.com/ambutwente/PCE-PoC) repository op.
2. `scripts/generate-graph.mjs` las alle `.bicep`-bestanden in de `modules/`-map en bouwde daar een JSON-bestand van met alle resources en hun relaties.
3. Dat JSON-bestand werd via TypeScript en Vite gebouwd naar een statische website en op een CDN gezet.

Er staat geen Bicep-code in deze repository zelf. Die werd alleen tijdelijk ingelezen tijdens de CI-run en daarna weggegooid.

Stap 1 en 3 zijn bij het archiveren vervallen. Wat overblijft is de graaf zelf: het resultaat van stap 2 staat
nu als [`public/graph.json`](public/graph.json) in de repository. Daarmee draait de visualizer zonder toegang
tot PCE-PoC en zonder de tokens en CDN-secrets die de pipeline nodig had.

## Zelf bekijken

De interactieve versie draait gewoon lokaal, met zoomen, slepen en opnieuw uitlijnen:

```bash
npm ci
npm run dev      # http://localhost:5201
```

De statische afbeelding hierboven opnieuw genereren uit `public/graph.json`:

```bash
npm run snapshot
```

Dat schrijft `docs/graph-snapshot.svg`. Het script gebruikt dezelfde ELK-layout, hetzelfde donkere thema en
dezelfde Azure-iconen als de interactieve versie, en levert bij elke run hetzelfde bestand op.

Wil je de graaf opnieuw opbouwen uit een actuele kopie van de Bicep-modules, dan kan dat ook nog steeds:

```bash
MODULES_DIR=/pad/naar/PCE-PoC/modules npm run graph
```

## Wat is er bij het archiveren veranderd?

- De deploy-workflow naar het CDN is verwijderd; er wordt niets meer geüpload en er draait geen dagelijkse job meer.
- De CI-workflow start alleen nog handmatig (`workflow_dispatch`) en deployt niets.
- Alle dependencies zijn een laatste keer bijgewerkt, zodat de archiefversie met een actuele toolchain bouwt.
- `scripts/generate-graph.mjs` miste twee soorten afhankelijkheden: verwijzingen met een index
  (`nics[i].id`, zoals resources in een `[for]`-lus naar elkaar verwijzen) en `parent:`-relaties tussen een
  resource en zijn child. Die zijn toegevoegd, zodat de bevroren graaf klopt in plaats van een paar
  resources los te laten staan. Daardoor telt de graaf 9 in plaats van 7 verbindingen.

## Status

Dit was een interne fork voor eigen gebruik. Het project is afgerond en wordt niet meer onderhouden.

De volledige licentie van de overgenomen visualisatie-engine staat in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
