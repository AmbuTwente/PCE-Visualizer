# PCE-Visualizer

> [!NOTE]
> Deze repository is geen onderdeel van de officiële scope of het onderzoeksrapport van het PCE-project.
> Het is een intern hulpmiddel dat wij zelf hebben opgezet om onze Bicep-infrastructuur beter te kunnen uitleggen aan elkaar.

## Wat is dit?

PCE-Visualizer is een fork van het open-source project [bicep-visualizer](https://github.com/aipx-proto/bicep-visualizer), beschikbaar onder de [MIT-licentie](THIRD_PARTY_NOTICES.md).

De visualisatie die je ziet lijkt op wat de Bicep-extensie in Visual Studio Code laat zien als je een `.bicep`-bestand opent. Wij hebben die visualisatie-engine hergebruikt om onze eigen modules in kaart te brengen.

## Waarvoor hebben wij het gebruikt?

Tijdens het project werden er steeds meer Bicep-modules aangemaakt in de [PCE-PoC](https://github.com/yieldersaxion2026/PCE-PoC) repository. Om intern beter uit te kunnen leggen welke Azure-resources onze pipeline zou gaan deployen en hoe die met elkaar samenhangen, hebben wij deze visualizer opgezet.

Het was eigenlijk een soort "wat als we dit uitrollen" overzicht: je ziet precies welke resources er in Azure zouden komen te staan en hoe ze aan elkaar gekoppeld zijn.

## Hoe werkt het?

1. Een GitHub Actions-workflow haalt dagelijks de [PCE-PoC](https://github.com/yieldersaxion2026/PCE-PoC) repository op.
2. Een script leest alle `.bicep`-bestanden in de `modules/`-map en bouwt daar een JSON-bestand van met alle resources en hun relaties.
3. Dat JSON-bestand wordt via TypeScript en Vite gebouwd naar een statische website en gepubliceerd op [pce-poc.b-cdn.net](https://pce-poc.b-cdn.net/).

Er staat geen Bicep-code in deze repository zelf. Die wordt alleen tijdelijk ingelezen tijdens de CI-run en daarna weggegooid.

## Status

Dit is een interne fork voor eigen gebruik. Na afloop van het PCE-project wordt deze pipeline niet meer actief onderhouden.

De volledige licentie van de overgenomen visualisatie-engine staat in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
