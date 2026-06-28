# IPL Forecast Engine

A portfolio-grade end-to-end machine learning system that predicts Indian Premier League match outcomes and simulates full seasons using Monte Carlo methods. Built with a Python ML pipeline, FastAPI backend, and Next.js frontend.

---

## Problem

Cricket match prediction is challenging due to:
- **Dynamic team compositions** — players change teams every season via auctions
- **Home/away asymmetry** — venues have unique pitch and weather characteristics
- **Non-stationary performance** — team form fluctuates across seasons
- **Data leakage risk** — using future information (e.g., match outcome) during feature engineering inflates accuracy
- **Small match count** — only ~70 matches per season, making traditional stats noisy

## Solution

A rigorous, time-aware ML pipeline that:

- **Respects temporality** — time-based train/val/test split (never random), rolling features computed from prior matches only
- **Eliminates leakage** — all aggregate features (recent form, venue record, head-to-head) are computed strictly from matches occurring *before* the target match
- **Combines signal sources** — rolling win rates + ELO ratings + venue stats + toss context + momentum indicators
- **Compares 4 models** — Logistic Regression (interpretable baseline), Random Forest (ensemble), XGBoost (gradient boosting), CatBoost (native categorical support)
- **Explains predictions** — SHAP values show *why* the model leans toward one team

---

## Key Features

| Feature | Description |
|---|---|
| **Match Predictor** | Real-time win probability with animated fill bars, confidence badges, and SHAP factor breakdown |
| **Season Simulator** | Monte Carlo simulation (1000+ runs) of a round-robin season using the trained model |
| **Season Projector** | Project team strengths forward using ELO decay, then simulate a future season |
| **Model Dashboard** | Side-by-side comparison of 4 models with ROC curves, calibration curves, and feature importance |
| **SHAP Explanations** | Per-prediction feature contributions mapped to plain-English labels |
| **Time-Based Splits** | 2007/08–2024 train, 2025 validation, 2026 test — no random shuffle |
| **Zero Data Leakage** | All rolling features use strictly prior matches only |

---

## Model Performance

| Model | AUC | Accuracy | F1 | Log Loss |
|---|---|---|---|---|
| **Random Forest** (best) | **0.613** | 0.435 | 0.562 | 0.725 |
| CatBoost | 0.589 | **0.551** | **0.587** | 0.778 |
| XGBoost | 0.556 | 0.536 | 0.568 | 0.827 |
| Logistic Regression | 0.530 | 0.435 | 0.494 | 0.739 |

**Train/Val/Test split:** 2007/08–2024 (1055 matches) / 2025 (69) / 2026 (23)

The modest AUC (~0.61) reflects the genuine difficulty of cricket prediction — the test set is a single future season with high variance. Random Forest was selected as the best model based on validation AUC.

---

## File Structure

```
IPL Forecast Engine/
├── app/                          # Next.js frontend (App Router)
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout with navigation
│   ├── dashboard/page.tsx        # Model comparison dashboard
│   ├── predict/page.tsx          # Match predictor with SHAP factors
│   ├── season-predict/page.tsx   # Future season projection
│   ├── simulate/page.tsx         # Monte Carlo season simulator
│   ├── setup/page.tsx            # Training trigger & pipeline status
│   ├── methodology/page.tsx      # Technical methodology explainer
│   └── globals.css               # Global styles & dark theme
│
├── python_service/               # Python ML backend
│   ├── api.py                    # FastAPI server (10 endpoints)
│   └── pipeline/
│       ├── clean.py              # Data cleaning & leakage removal
│       ├── features.py           # 85+ engineered features
│       ├── elo.py                # ELO rating system
│       ├── train.py              # 4-model training pipeline
│       ├── explain.py            # SHAP explainability
│       └── simulate.py           # Season simulation & projection
│
├── lib/                          # Shared TypeScript utilities
│   ├── api.ts                    # Python service client
│   ├── types.ts                  # API type definitions
│   └── utils.ts                  # Formatting helpers
│
├── components/                   # Shared UI components
│   └── ui/
│
├── data/                         # Data files
│   ├── raw/IPL.csv               # Source dataset
│   ├── processed/                # Cleaned & engineered data
│   └── sample_fixture.csv        # Example fixture file
│
├── models/                       # Trained model artifacts
│   ├── best_model.joblib         # Serialized Random Forest
│   ├── preprocessing_pipeline.joblib
│   └── feature_list.json
│
├── reports/                      # Training reports & SHAP
│
├── requirements.txt              # Python dependencies
├── package.json                  # Node.js dependencies
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── .env.example
```

---

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd ipl-forecast-engine

# Python backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Node.js frontend
npm install
```

### 2. Add Data (optional — required only for retraining)

Pre-trained model artifacts are already included, so the app works immediately. To retrain with your own data, place an IPL ball-by-ball CSV in `data/raw/`. The expected columns include:
`match_id`, `season`, `venue`, `innings`, `batting_team`, `bowling_team`, `runs`, `wickets`, `balls`, `extras`, `toss_winner`, `toss_decision`, `stage`, `match_won_by`, `date_parsed`

> **Note:** `data/raw/` is gitignored because the raw CSV exceeds GitHub's file size limit. The processed model artifacts (`models/*.joblib`) are tracked so the app works out of the box.

### 3. Start Backend

```bash
source venv/bin/activate
uvicorn python_service.api:app --reload --port 8000
```

### 4. Train Model

```bash
curl -X POST http://localhost:8000/train
# or click "Run Pipeline" on the Setup page
```

### 5. Start Frontend

```bash
npm run dev
# Open http://localhost:3000
```

### 6. Use the App

- **Dashboard** — View model comparison, ROC/calibration curves
- **Predict** — Select teams, venue, toss details → instant win probability + SHAP factors
- **Simulate** — Run 1000 Monte Carlo season simulations
- **Season Predict** — Project team strengths into a future season
- **Setup** — Retrain models with updated data

---

## Deploy to Netlify

The frontend can be deployed to Netlify with minimal configuration.

### Automatic Deploy (Git)

1. Push this repo to GitHub
2. In Netlify Dashboard → **Add new site** → **Import an existing project**
3. Connect your GitHub repo
4. Netlify auto-detects Next.js — build settings are pre-filled
5. Add environment variable:
   - `NEXT_PUBLIC_PYTHON_SERVICE_URL` — URL of your deployed FastAPI backend (e.g., `https://your-api.onrender.com`)
6. Click **Deploy**

### Manual Deploy (CLI)

```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Deploy Backend to Render

1. Push the repo to GitHub
2. In Render Dashboard → **New +** → **Web Service**
3. Connect your GitHub repo
4. Fill in:

| Field | Value |
|---|---|
| Name | `ipl-forecast-engine-api` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn python_service.api:app --host 0.0.0.0 --port $PORT` |
| Plan | Free |

5. Click **Create Web Service**

Render auto-deploys on every push. Once deployed, copy the URL (e.g., `https://ipl-forecast-engine-api.onrender.com`) and set it as `NEXT_PUBLIC_PYTHON_SERVICE_URL` in your Netlify env vars.

> **Note:** On the free plan, the backend may spin down after inactivity. The first request after idle will take ~30s to cold-start.

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Backend health check |
| POST | `/train` | Run full training pipeline |
| GET | `/metrics` | Model evaluation metrics |
| GET | `/teams` | List all teams |
| GET | `/venues` | List all venues |
| POST | `/predict-match` | Predict a single match outcome |
| POST | `/simulate-season` | Run Monte Carlo season simulation |
| POST | `/predict-season` | Project & simulate a future season |
| GET | `/data-quality` | Cleaning & data quality report |
| GET | `/feature-importance` | Global SHAP feature importance |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed flow diagram.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, Recharts |
| **Backend** | FastAPI, Python 3.9+ |
| **ML Models** | scikit-learn Random Forest, XGBoost, CatBoost, Logistic Regression |
| **Explainability** | SHAP (TreeExplainer / LinearExplainer) |
| **Data** | Pandas, NumPy |
| **Serialization** | Joblib (models), JSON (reports) |

---

## License

[MIT](./LICENSE)
