import { Platform } from 'react-native'

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  `${Platform.OS === 'android' ? 'http://10.0.2.2' : 'http://127.0.0.1'}:8000/api/v1`

export interface Reservation {
  id: number
  seat_id: string
  seat_number: string
  tower: string
  parking_level: string
  vehicle_type: 'Four-wheeler' | 'Two-wheeler'
  reserved_at: string
  unreserved_at: string | null
  duration_seconds: number | null
  reserved_by_me?: boolean
}

export interface FillEstimate {
  seat_id: string
  typical_reserved_time: string
  reservations_in_period: number
  period_days: number
  time_zone: string
}

interface ApiErrorResponse {
  detail?: string | { msg?: string }[]
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch {
    throw new Error(
      `Can't reach the parking server at ${API_BASE_URL}. Check the server and mobile/.env API address.`,
    )
  }

  const result = (await response.json().catch(() => ({}))) as T & ApiErrorResponse
  if (!response.ok) {
    const detail = Array.isArray(result.detail) ? result.detail[0]?.msg : result.detail
    throw new Error(detail || 'The parking server could not complete the request.')
  }
  return result
}

export async function createOrGetUser(email: string): Promise<{ email: string }> {
  return request('/users', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function getActiveReservations(email: string): Promise<Reservation[]> {
  return request('/reservations/active', {
    headers: { 'X-User-Email': email },
  })
}

export async function getReservationHistory(email: string): Promise<Reservation[]> {
  return request('/reservations/history?limit=50', {
    headers: { 'X-User-Email': email },
  })
}

export async function getFillEstimates(timeZone: string): Promise<FillEstimate[]> {
  const query = new URLSearchParams({ time_zone: timeZone })
  return request(`/reservations/fill-estimates?${query.toString()}`)
}

export async function reserveSpot(
  spot: {
    email: string
    latitude: number
    longitude: number
    seat_id: string
    seat_number: string
    tower: string
    parking_level: string
    vehicle_type: 'Four-wheeler' | 'Two-wheeler'
  },
): Promise<Reservation> {
  return request('/reservations', {
    method: 'POST',
    body: JSON.stringify(spot),
  })
}

export async function releaseSpot(reservationId: number, email: string): Promise<Reservation> {
  return request(`/reservations/${reservationId}/unreserve`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function askAvailability(
  availableSpots: number,
  takenSpots: number,
): Promise<{ answer: string }> {
  return request('/assistant/availability', {
    method: 'POST',
    body: JSON.stringify({ available_spots: availableSpots, taken_spots: takenSpots }),
  })
}
