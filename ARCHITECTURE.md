# IPL Forecast Engine — Architecture

## System Overview

```mermaid
graph TB
    subgraph Frontend["Next.js Frontend (localhost:3000)"]
        Landing["/ Landing Page"]
        Dashboard["/dashboard Model Comparison"]
        Predict["/predict Match Predictor"]
        Simulate["/simulate Season Simulator"]
        SeasonPredict["/season-predict Season Projection"]
        Setup["/setup Training Pipeline"]
        Methodology["/methodology Technical Docs"]
    end

    subgraph Backend["FastAPI Backend (localhost:8000)"]
        API["api.py Routes"]
        subgraph Pipeline["ML Pipeline"]
            Clean["clean.py Data Cleaning"]
            Features["features.py Feature Engineering"]
            Elo["elo.py ELO Ratings"]
            Train["train.py Model Training"]
            Explain["explain.py SHAP Analysis"]
            SimulateModule["simulate.py Season Simulation"]
        end
    end

    subgraph Storage["Data & Artifacts"]
        RawData["data/raw/IPL.csv"]
        Processed["data/processed/"]
        Models["models/ *.joblib"]
        Reports["reports/ *.json"]
    end

    Frontend -->|HTTP / CORS| API
    API --> Pipeline
    Pipeline --> Storage
    API --> Storage
```

---

## Data Pipeline

```mermaid
flowchart LR
    A["IPL.csv<br/>Ball-by-ball data"] --> B["clean.py<br/>Remove leaked columns<br/>Rename teams<br/>Filter incomplete matches"]
    B --> C["Cleaned Dataset<br/>data/processed/cleaned_dataset.csv"]
    C --> D["aggregate_innings()<br/>Roll up ball-by-ball → innings level"]
    D --> E["build_match_features()<br/>Merge innings → match level<br/>Set team1/team2 consistently"]
    E --> F["compute_elo_ratings()<br/>Iterative ELO after each match"]
    F --> G["Feature Engineering<br/>Recent form (3/5/10 matches)<br/>Venue stats<br/>Head-to-head<br/>Batting/bowling strength<br/>Momentum<br/>NRR proxy"]
    G --> H["Engineered Features<br/>data/processed/engineered_match_features.csv"]
    H --> I["Time-Based Split<br/>2007/08–2024 Train<br/>2025 Val<br/>2026 Test"]
    I --> J["Train 4 Models<br/>LogisticRegression<br/>RandomForest<br/>XGBoost<br/>CatBoost"]
    J --> K["Select Best<br/>(Random Forest)"]
    K --> L["Save Artifacts<br/>models/best_model.joblib<br/>models/preprocessing_pipeline.joblib"]
    K --> M["SHAP Explanations<br/>reports/feature_importance.json"]
```

---

## Match Prediction Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Next.js Frontend
    participant Backend as FastAPI
    participant Model as Random Forest

    User->>Frontend: Select teams, venue, toss details
    Frontend->>Backend: POST /predict-match
    Backend->>Backend: build_prediction_features()
    Backend->>Model: preprocessor.transform() + predict_proba()
    Model-->>Backend: [team1_prob, team2_prob]
    Backend->>Backend: SHAP explain_prediction()
    Backend-->>Frontend: { probabilities, top_factors, confidence }
    Frontend-->>User: Animated win bars + SHAP chart
```

---

## Season Simulation Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Next.js Frontend
    participant Backend as FastAPI
    participant Sim as Simulator

    User->>Frontend: Click "Run Simulation"
    Frontend->>Backend: POST /simulate-season

    Backend->>Sim: generate_demo_fixture()<br/>Round-robin match list
    Sim->>Sim: Precompute base probabilities<br/>for each unique (t1,t2,venue)
    loop For each of N simulations
        Sim->>Sim: Reset points & ELO
        loop For each fixture
            Sim->>Sim: Adjust proba by ELO difference
            Sim->>Sim: Random outcome, update points + ELO
        end
        Sim->>Sim: Record winner, top 4, points
    end
    Sim-->>Backend: Aggregate title/top4/points tables
    Backend-->>Frontend: { title_probabilities, avg_points, ... }
    Frontend-->>User: Animated horizontal bar chart + tables
```

---

## Season Projection Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Next.js Frontend
    participant Backend as FastAPI
    participant Engine as Projection Engine

    User->>Frontend: Enter year + select focus team
    Frontend->>Backend: POST /predict-season

    Backend->>Engine: project_team_strengths()<br/>ELO decay × 0.85
    Backend->>Engine: Build future fixture list<br/>Double round-robin
    Engine->>Engine: Precompute match probability matrix<br/>N² calls to model (neutral ELO)
    loop For each of N simulations
        Engine->>Engine: Simulate with ELO-adjusted probabilities
    end
    Engine-->>Backend: Title/Top4/Pts aggregates
    Backend-->>Frontend: Focus team stats + full tables
    Frontend-->>User: Focus team card + sorted probability bars
```

---

## Frontend Component Tree

```mermaid
graph TD
    Layout["layout.tsx<br/>Nav + Theme + Fonts"]
    Layout --> Landing["page.tsx<br/>Animated counters + feature cards"]
    Layout --> Dashboard["dashboard/page.tsx<br/>Model leaderboard<br/>ROC + Calibration curves<br/>Feature importance"]
    Layout --> Predict["predict/page.tsx<br/>Match form +<br/>Win probability bars +<br/>SHAP horizontal chart"]
    Layout --> Simulate["simulate/page.tsx<br/>Settings panel +<br/>Title probability bars +<br/>Top 4 chart + Points table"]
    Layout --> SeasonPredict["season-predict/page.tsx<br/>Projection form +<br/>Focus team card +<br/>Title/Top4 bars + Points table"]
    Layout --> Setup["setup/page.tsx<br/>Train button + status"]
    Layout --> Methodology["methodology/page.tsx<br/>Technical explanation"]
```

---

## Feature Engineering Groups

```mermaid
mindmap
  root((Features))
    Recent Form
      team1_last3_win_rate
      team1_last5_win_rate
      team1_last10_win_rate
      weighted_recent_form
    Venue
      team1_venue_win_rate
      avg_first_innings_venue
      chasing_win_rate_venue
    Head-to-Head
      h2h_team1_win_rate
      h2h_total_matches
    Batting Strength
      recent_avg_runs
      powerplay_avg
      death_overs_avg
      boundary_rate
    Bowling Strength
      recent_economy
      powerplay_wickets
      death_overs_economy
    Context
      toss_winner_is_team1
      toss_decision_bat
      is_playoff
      team1_is_home
    Momentum
      batting_momentum
      nrr_proxy
    Rating
      elo_team1
      elo_team2
      elo_diff
```

---

## Request / Response Flow

```mermaid
flowchart LR
    A["Browser"] -->|"fetch()"| B["Next.js API Client<br/>lib/api.ts"]
    B -->|"HTTP POST/GET"| C["FastAPI Router<br/>python_service/api.py"]
    C --> D["Pipeline Module"]
    D -->|"joblib.load()"| E["Trained Model<br/>models/best_model.joblib"]
    D -->|"pandas"| F["Preprocessing Pipeline<br/>models/preprocessing_pipeline.joblib"]
    E --> G["JSON Response"]
    F --> G
    G -->|"200 OK"| B
    B -->|"Typed response"| A
```
