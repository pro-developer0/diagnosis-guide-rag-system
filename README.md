# Diagnosis Guide

A diagnostic reference for healthcare staff. Ask a question in plain language and get a short answer drawn only
from 20 built-in disease files, with a link to the exact section it came from.

The library is fixed. Users cannot upload files, and search covers only the files listed below.

![An answer on type 2 diabetes criteria beside its source passages, with the cited passage highlighted](docs/screenshots/05-citation.png)

## Screenshots

**Start screen.** Ask in plain language, use a question starter, or pick a suggested question.

![Start screen with the disease library, question box and suggested questions](docs/screenshots/01-home.png)

**Choose what to search.** Limit a question to selected diseases.

![Disease library with only malaria, dengue and typhoid fever selected](docs/screenshots/03-library-scope.png)

**See what left the browser.** Open "Text sent to the AI service" under any answer to read the exact prompt.

![The exact prompt and passages sent to the AI service, shown under an answer](docs/screenshots/07-prompt-transparency.png)

**Read the full reference.** Open any disease, or the source of any passage, to read its whole file.

![Full reference file for type 2 diabetes open in a side panel](docs/screenshots/08-reference-reader.png)

**Dark theme and phone layout.** The app follows the device theme and adapts to small screens.

| Dark theme | Phone |
|---|---|
| ![Answer and source passages in the dark theme](docs/screenshots/06-answer-dark.png) | <img src="docs/screenshots/09-mobile.png" alt="Answer on a phone-sized screen" width="280"> |

## Diseases covered

| Category | Diseases |
|---|---|
| Cardiovascular | Hypertension, Acute Myocardial Infarction, Heart Failure |
| Endocrine | Type 2 Diabetes Mellitus, Hypothyroidism |
| Respiratory | Asthma, Chronic Obstructive Pulmonary Disease (COPD), Community-Acquired Pneumonia |
| Infectious | Tuberculosis, Malaria, Dengue, Typhoid Fever, Hepatitis B, HIV Infection |
| Renal and urinary | Chronic Kidney Disease, Urinary Tract Infection |
| Neurology and mental health | Acute Ischemic Stroke, Major Depressive Disorder |
| Blood and joints | Iron Deficiency Anemia, Rheumatoid Arthritis |

Each file has the same sections: overview, typical presentation, diagnostic criteria, confirmatory and
supporting tests, differential diagnosis, pitfalls and red flags, and the guideline it is based on.
The files are in `public/knowledge`.

## How it works

| Step | Where it happens |
|---|---|
| Load the reference files and the prebuilt search index | Browser |
| Find the passages that match a question | Browser |
| Write the answer from those passages | AI service, through `app/api/ask/route.ts` |

Each question and its matching passages are sent to the AI service. Users can open
"Text sent to the AI service" under any answer to see exactly what left the browser.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then add your API key
npm run dev                  # http://localhost:3100
```

On Windows PowerShell, use `npm.cmd` in place of `npm`.

## Settings

| Variable | Purpose |
|---|---|
| `LLM_API_KEY` | API key for the AI service (required for answers) |
| `LLM_MODEL` | Chat model. Defaults to `openai/gpt-oss-120b` |
| `LLM_API_URL` | Any OpenAI-compatible endpoint. Defaults to Groq |

## Change the library

Edit, add or remove `.md` files in `public/knowledge`, and keep `lib/catalog.ts` in step with them.
The prebuilt index (`public/knowledge/vectors.bin`) only matches the current files, so after a change each
browser builds its own index on its first visit. That first visit takes noticeably longer, then it is cached.

## Before clinical use

This project is a reference tool. It is not a certified medical device, it does not diagnose patients, and it
does not replace clinical judgment.

- **Content review:** The disease files are summaries of the named guidelines. They must be reviewed by qualified
  clinicians and kept up to date, because guideline thresholds change.
- **Patient data:** Do not enter identifiable patient information unless your organization has approved
  the AI service for it. To use an approved service, set `LLM_API_URL`.
- **Access control:** There is no login. Put the app behind your organization's authentication before
  exposing it to a network, and add rate limiting to `/api/ask`.
