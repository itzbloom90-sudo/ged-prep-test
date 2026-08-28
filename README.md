# GED Prep-Test

An unofficial GED practice-exam simulator covering all four subjects: **Mathematical Reasoning** (in two parts — no-calculator and calculator-allowed), **Reasoning Through Language Arts**, **Science**, and **Social Studies**.

This is **not** an official GED product and is not affiliated with GED Testing Service. It's a study tool.

## Features
- Official-length timers per subject (Math 115 min, RLA 150 min, Science 90 min, Social Studies 70 min)
- Randomized question selection every attempt, pulled from a larger question bank
- Multiple choice and fill-in-the-blank question types
- Approximate scaled scoring (100–200 scale) with Passing / College Ready / College Ready + Credit thresholds
- Per-subject attempt history (pass/fail count, best score) stored locally in your browser
- Works fully offline — just open `index.html`, no build step, no server required

## Running it locally
Just open `index.html` in a browser. Everything runs client-side with vanilla HTML/CSS/JS — no dependencies, no build tools.

## Deploying to GitHub Pages
1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Set the source branch to `main` (or wherever you pushed) and the folder to `/ (root)`.
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## Data storage & "online" vs "offline" mode
By default, this app runs in **offline mode**: you create a local profile (just a name), and all attempt history is saved in your browser's `localStorage`. Nothing leaves your device, and no account is required.

**About Google sign-in:** a fully working "Sign in with Google" button requires you (the site owner) to register an OAuth Client ID with Google Cloud Console tied to your specific deployed domain — that's not something that can be pre-configured generically, since it's tied to *your* GitHub Pages URL. The current build does not include a live Google auth flow. If you want to add real cross-device sync via Google sign-in later:
1. Create a Google Cloud project and OAuth 2.0 Client ID (Google Identity Services).
2. Add your GitHub Pages domain to the authorized origins.
3. Add the Google Identity Services script and a sign-in button in `index.html`.
4. Replace the local `localStorage` read/writes in `js/app.js` with calls to a backend or a service like Firebase/Firestore, keyed by the signed-in Google user ID.

This is a real, non-trivial integration step — happy to help build it out once you have a Client ID and hosting domain finalized.

## About the scoring
The scaled score (100–200) is an **approximation** built for practice purposes — it is not GED Testing Service's actual scoring formula, which is not publicly disclosed in full detail. Treat scores here as a general signal of readiness, not a guarantee of your real GED result.

## Expanding the question bank
All questions live in `js/questions.js`, organized by subject/section key. Add more objects to any array to increase variety — the app automatically shuffles and randomly selects from whatever pool exists each time you start an exam.

## Disclaimer
GED® is a registered trademark of the American Council on Education. This project is an independent study tool and is not endorsed by, affiliated with, or sponsored by GED Testing Service or the American Council on Education.
