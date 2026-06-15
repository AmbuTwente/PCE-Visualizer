# PCE-Visualizer

> [!NOTE]
> Deze repository is geen onderdeel van de officiële scope of het onderzoeksrapport van het PCE-project.
> Het is een intern hulpmiddel dat wij zelf hebben gebouwd om onze Bicep-infrastructuur beter te kunnen uitleggen aan elkaar.

## Wat is dit?

PCE-Visualizer is een fork van het open-source project [bicep-visualizer](https://github.com/aipx-proto/bicep-visualizer), dat oorspronkelijk door Microsoft is gemaakt en beschikbaar is onder de [MIT-licentie](THIRD_PARTY_NOTICES.md).

De visualisatie die je ziet is dezelfde weergave als die de officiële Bicep-extensie in Visual Studio Code toont wanneer je een `.bicep`-bestand opent. Wij hebben die engine hergebruikt om onze eigen modules te tekenen.

## Waarvoor hebben wij het gebruikt?

Tijdens het project werden er steeds meer Bicep-modules aangemaakt in de [PCE-PoC](https://github.com/yieldersaxion2026/PCE-PoC) repository. Om intern beter te kunnen uitleggen welke Azure-resources onze pipeline zou gaan deployen — en hoe die met elkaar samenhangen — hebben wij deze visualizer opgezet.

Het was een *what-if*-weergave: wat zou er daadwerkelijk in Azure komen te staan als we deze modules zouden uitrollen?

## Hoe werkt het technisch?

1. Een GitHub Actions-workflow haalt dagelijks de [PCE-PoC](https://github.com/yieldersaxion2026/PCE-PoC) repository op.
2. Een script leest alle `.bicep`-bestanden in de `modules/`-map en bouwt daar een JSON-bestand van met alle resources en hun relaties.
3. Dat JSON-bestand wordt via TypeScript/Vite gebouwd naar een statische website en gepubliceerd op [pce-poc.b-cdn.net](https://pce-poc.b-cdn.net/).

Er staat geen Bicep-code in deze repository zelf — die wordt alleen tijdelijk ingelezen tijdens de CI-run.

## Status

Dit is een intern fork voor eigen gebruik. Na afloop van het PCE-project wordt deze pipeline niet meer actief onderhouden.

De volledige licentie van de overgenomen visualisatie-engine staat in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
