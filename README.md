
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandi

- **Build**: `npm run build` — compila TypeScript nella cartella `dist/`
- **Dev (watch)**: `npm run local` — modalità watch con `tsc-watch`, riavvia `dist/index.js` ad ogni modifica
- **Job produzione**: `npm run job` — compila e avvia tramite PM2 con cron definito dalla variabile `CRON_EXPRESSION_JOB`
- Nessun test suite configurato.

## Panoramica dell'Architettura

ReportBuilder è un **batch job Node.js/TypeScript** che genera report PDF su persone fisiche e aziende italiane, integrando i dati dell'API Cerved con i record di incarico (entrust) su PostgreSQL.

### Entry Point e Flusso del Job (`src/index.ts`)
1. Connessione a MongoDB (logging/cache), PostgreSQL (dati incarichi) e SFTP (consegna file)
2. Recupero "richieste di controllo" (state=`new_entrust`) → generazione report
3. Recupero "richieste standard" (state=`completed`, assegnazione chiusa) → generazione report
4. Generazione export Excel massivi raggruppati per entrust_id → trasferimento SFTP
5. Log del ciclo di vita dell'esecuzione su MongoDB (`ExecutionJob`)

### Struttura a Livelli

| Livello | Percorso | Ruolo |
|---|---|---|
| Services | `src/services/` | Orchestrano il recupero dati e la conversione per tipo di soggetto |
| Converters | `src/converter/` | Mappano i dati grezzi Cerved/DB sui modelli di dominio |
| Templates | `src/templates/*.hbs` | Template HTML Handlebars renderizzati in PDF |
| Database | `src/database/` | Sequelize (PostgreSQL) + Mongoose (MongoDB) |
| Utilities | `src/utils.ts` | Generazione PDF, operazioni SFTP, chiamate API Cerved, helper template |

### Dispatch per Tipo di Report
I report vengono instradati tramite `campaign_kind_id` dalla tabella PostgreSQL `campaign_kinds`:
- **Persona Fisica**: ID 683, 696, 707, 709, 711, 713, 715, 718, 811
- **Persona Giuridica**: ID 698, 699, 708, 784, 785, 786, 792G, 801, 819
- **Eredi**: servizio dedicato (`src/services/eredi.service.ts`)

### Integrazioni Esterne
- **API Cerved** (`api.cerved.com`): acquisto dati creditizi — le risposte sono cachate su MongoDB per evitare chiamate ripetute
- **API DIBA** (`192.168.172.13`): intelligence conti bancari per la chiusura degli incarichi
- **SFTP** (`192.168.28.10`): consegna finale PDF/Excel in `/opt/enbilab/webapps/ciro_web/shared/private/system/attachments/files/<entrust_id>/`
- **Email** (Aruba SMTPS): notifiche via `src/connection/sendEmail.ts`

### Schema dei Database
- **PostgreSQL** (`ciro_web_production`): `entrusts`, `entrust_requests`, `entrust_assignments`, `campaign_kinds`, `investigated_subjects`, `investigation_records`
- **MongoDB** (`az`): `executions` (TTL), `errors`, `mainDocuments`, `productPurchases`, `prospectHistory`, `realEstateDatabase`

### Generazione PDF e Template Handlebars

I file `.hbs` in `src/templates/` sono template **Handlebars**: HTML con segnaposto dinamici che vengono popolati con i dati del report prima della conversione in PDF.

**Flusso completo:**
```
Dati (Cerved API + PostgreSQL)
        ↓
Interpolazione Handlebars (.hbs → HTML)
        ↓
html-pdf-node / Puppeteer (headless Chrome)
        ↓
PDF finale → SFTP
```

**Template disponibili** (uno per tipo di report):
| File | Tipo report |
|---|---|
| `cribis_Search_Persona_Fisica.hbs` | Persona Fisica (Search) |
| `cribis_Search_Persona_Giuridica_Corporate.hbs` | Persona Giuridica (Search) |
| `cribis_Money_Light_Persona_Giuridica_Corporate.hbs` | Money Light |
| `cribis_Money_Plus_Persona_Giuridica_Corporate.hbs` | Money Plus |
| `prospetto_Storico.hbs` | Storico incarichi |
| `cribis_Eredi.hbs` | Eredi/Successioni |

**Helper custom** registrati in `src/utils.ts` e utilizzabili nei template:
- `eq`, `ne`, `lt`, `gt` — confronti logici
- `math` — operazioni aritmetiche
- `json` — serializzazione oggetti per debug

Il cliente 4902 usa margini PDF personalizzati — vedere `generatePDF` in `src/utils.ts`.

### Macchina a Stati
Le assegnazioni passano per: `new_entrust` → `preparation` → `closed` → `validated`. Lo stato su PostgreSQL viene aggiornato dopo il successo del caricamento SFTP.

### Configurazione
Tutte le credenziali e i percorsi si trovano nel file `.env` (non versionato). Variabili chiave: `CERVED_*`, `DB_*`, `MONGO_*`, `SFTP_*`, `SMTP_*`, `DIBA_*`, `CRON_EXPRESSION_JOB`, e variabili di percorso template come `HTML_TEMPLATE_PATH`.
