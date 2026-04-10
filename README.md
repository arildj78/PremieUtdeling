# Premieutdeling: Kontroll + Storskjerm

Dette prosjektet lar en kontroll-PC styre en live premieutdeling-visning som kan vises på en stor LED-skjerm over nettverket.

## Funksjoner

- Egen kontrollside: `/control`
- Egen storskjerm-side: `/display`
- Live oppdatering med Socket.IO
- Medaljeoppsett for gull, solv og bronse
- Markering av fullfort seremoni (dimmes i liste)
- Ca. 25 ferdiglagde seremonier (2015-2010)
- Para seremonier lagt forst for 2015
- Plass for arrangement-logo og klubb-logo

## Kom i gang

1. Installer Node.js (LTS).
2. I prosjektmappen, kjor:

```bash
npm install
npm start
```

3. Apne pa kontroll-PC:

- Kontroll: `http://localhost:3000/control`
- Display lokalt: `http://localhost:3000/display`

4. Pa LED-skjermmaskinen (samme nettverk), bruk kontroll-PC sin IP-adresse:

- `http://<KONTROLL-PC-IP>:3000/display`

Tips: Finn IP i PowerShell med `ipconfig`.

## Deploy via GitHub (Windows)

Denne losningen er klargjort for installasjon pa en ny PC via GitHub + PowerShell-script.

### 1) Forbered GitHub (pa denne maskinen)

Kjor i prosjektmappen:

```powershell
git init
git add .
git commit -m "Initial deploy-ready setup"
git branch -M main
git remote add origin https://github.com/<bruker>/<repo>.git
git push -u origin main
```

### 2) Installer pa ny PC

Forutsetninger:
- Git installert
- Node.js LTS installert

Kjor i PowerShell pa ny PC:

```powershell
Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/<bruker>/<repo>/main/scripts/install-from-github.ps1" -OutFile ".\install-from-github.ps1"
powershell -ExecutionPolicy Bypass -File ".\install-from-github.ps1" -RepoUrl "https://github.com/<bruker>/<repo>.git" -Branch "main" -InstallDir "$env:USERPROFILE\Premieutdeling" -OpenFirewall
```

Alternativt kan dere klone manuelt og sa kjore scriptet direkte fra repo:

```powershell
git clone https://github.com/<bruker>/<repo>.git "$env:USERPROFILE\Premieutdeling"
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Premieutdeling\scripts\install-from-github.ps1" -RepoUrl "https://github.com/<bruker>/<repo>.git" -Branch "main" -InstallDir "$env:USERPROFILE\Premieutdeling" -OpenFirewall
```

### 3) Start server pa ny PC

```powershell
Set-Location "$env:USERPROFILE\Premieutdeling"
npm start
```

Eller:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Premieutdeling\scripts\start-server.ps1"
```

### 4) Oppdatere fra GitHub senere

Kjor samme script igjen med samme parametre. Dersom mappen finnes fra for, gjor scriptet `git pull` + `npm ci`.

## Data du redigerer

Ekte meet-data som appen bruker lokalt ligger i:

- `public/data/ceremonies.json`

Eksempeldata (trygg a publisere) ligger i:

- `public/data/ceremonies.example.json`

For sikkerhet er disse stiene ignorert i git:

- `public/data/ceremonies.json`
- `swimmers/`
- `swim meet setup/`

Det betyr at ekte stevnedata og svommerdata ikke pushes til GitHub.

### Bruk eksempeldata vs ekte data

Ved ny installasjon vil scriptet automatisk opprette `public/data/ceremonies.json` fra eksempeldata hvis filen ikke finnes.

For a legge inn ekte data:

1. Legg den ekte filen i `public/data/ceremonies.json`.
2. Eventuelt generer den fra parseren lokalt med `node parse-data.js`.
3. Ikke commit `public/data/ceremonies.json` (den er ignorert).

### Viktige felter

- `clubs[]`: klubbnavn og `logoPath`
- `swimmers[]`: svommere med `birthYear`, `sex`, `events[]`, `clubId`, `para`
- `ceremonies[]`: seremonioversikt, status og medaljevinnere

## Logoer

- Klubb-logoer: legg filer i `public/logos/clubs/`
- Arrangement-logo: legg fil i `public/logos/event/arrangement.png`

`logoPath` i datafilen skal peke til web-sti, f.eks:

- `/logos/clubs/min-klubb.png`

## Tilpasning

Hvis dere har ferdige lister over svommere/klubber, lim dem inn i `public/data/ceremonies.json`.

Strukturen er allerede satt opp for:

- fodselsar: 2015, 2014, 2013, 2012, 2011, 2010
- stilart: Butterfly, Freestyle, Bryst, Rygg, Medley
- kjonn: jenter, gutter
- para-start i 2015
