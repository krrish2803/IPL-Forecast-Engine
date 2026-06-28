export interface ModelMetrics {
  model: string
  accuracy: number
  precision: number
  recall: number
  f1: number
  roc_auc: number
  log_loss: number
  calibration: CalibrationData
  confusion_matrix: ConfusionMatrix
  roc_curve: ROCCurve
}

export interface CalibrationData {
  calibration_x: number[]
  calibration_y: number[]
}

export interface ConfusionMatrix {
  true_neg: number
  false_pos: number
  false_neg: number
  true_pos: number
}

export interface ROCCurve {
  fpr: number[]
  tpr: number[]
  thresholds: number[]
}

export interface TrainingMetrics {
  best_model: string
  best_model_auc: number
  train_seasons: string[]
  val_seasons: string[]
  test_seasons: string[]
  train_size: number
  val_size: number
  test_size: number
  models: Record<string, ModelMetrics>
  test_metrics: Record<string, number>
}

export interface CleaningReport {
  rows_before: number
  rows_after: number
  rows_dropped: number
  duplicate_rows_removed: number
  team_renames_applied: Record<string, string>
  leakage_columns_dropped: Record<string, string>
  filter_reasons: Record<string, number>
  missing_value_summary: Record<string, number>
  unique_matches: number
  unique_teams: string[]
  seasons: string[]
  venues: string[]
}

export interface PredictRequest {
  team1: string
  team2: string
  venue: string
  toss_winner: string
  toss_decision: string
  season?: string
  stage?: string
}

export interface PredictResponse {
  team1_win_probability: number
  team2_win_probability: number
  confidence: number
  predicted_winner: string
  explanation: {
    predicted_winner: string
    confidence: number
    top_factors: { factor: string; direction: string; impact: number }[]
    readable: string
  }
}

export interface SimulateRequest {
  fixture_csv?: string
  use_demo: boolean
  n_simulations: number
}

export interface SimulateResponse {
  n_simulations: number
  title_probabilities: { team: string; probability: number }[]
  top4_probabilities: { team: string; probability: number }[]
  avg_points_table: { team: string; avg_points: number }[]
}

export interface FeatureImportance {
  feature: string
  importance: number
}

export interface TrainResponse {
  status: string
  duration_seconds: number
  best_model: string
  best_model_auc: number
  train_size: number
  val_size: number
  test_size: number
}
