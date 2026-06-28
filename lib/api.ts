const PYTHON_SERVICE_URL = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:8000'

async function fetchFromPython<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${PYTHON_SERVICE_URL}${endpoint}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

export async function trainModel(): Promise<import('./types').TrainResponse> {
  return fetchFromPython('/train', { method: 'POST' })
}

export async function getMetrics(): Promise<import('./types').TrainingMetrics> {
  return fetchFromPython('/metrics')
}

export async function getTeams(): Promise<{ teams: string[] }> {
  return fetchFromPython('/teams')
}

export async function getVenues(): Promise<{ venues: string[] }> {
  return fetchFromPython('/venues')
}

export async function predictMatch(data: import('./types').PredictRequest): Promise<import('./types').PredictResponse> {
  return fetchFromPython('/predict-match', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function simulateSeason(data: import('./types').SimulateRequest): Promise<import('./types').SimulateResponse> {
  return fetchFromPython('/simulate-season', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getDataQuality(): Promise<import('./types').CleaningReport> {
  return fetchFromPython('/data-quality')
}

export async function getFeatureImportance(): Promise<{ features: import('./types').FeatureImportance[] }> {
  return fetchFromPython('/feature-importance')
}
