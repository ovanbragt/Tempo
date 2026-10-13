# Tempo

Persoonlijke fitness-app voor kracht, hardlopen en zwemmen: schema's, trainingen loggen, progressie en een kalender.

- Web-app: open de site op je telefoon en kies "Zet op beginscherm".
- Gegevens worden alleen op de telefoon zelf bewaard (IndexedDB).
- Geen bouwstap nodig: gewone HTML, CSS en JavaScript.

## Mappen

- `index.html` – startpunt
- `css/app.css` – vormgeving
- `js/app.js` – schermen en navigatie
- `js/data.js` – de schema's (Dom tot Domloop 2027, Full Body A/B)
- `js/db.js` – opslag op de telefoon
- `js/dates.js` – datumhulpjes
- `js/log.js` – trainingen en metingen loggen
- `js/calendar.js` – kalender en verplaatsen
- `js/progress.js` – progressie en grafieken
- `js/fit.js` – Garmin .fit/.zip inlezen
- `js/generator.js` en `js/schemas.js` – nieuwe schema's maken
- `js/settings.js` – back-up en instellingen
- `sw.js` – zorgt dat de app ook offline werkt
- `manifest.webmanifest`, `icons/` – installeren op het beginscherm
