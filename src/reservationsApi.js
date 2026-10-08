const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'
const inFlightGetRequests = new Map()

function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const requestKey = method === 'GET' ? `${path}:${JSON.stringify(headers)}` : null

  if (requestKey && inFlightGetRequests.has(requestKey)) {
    return inFlightGetRequests.get(requestKey)
  }

  const requestPromise = fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
  }).then(async (response) => {
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = Array.isArray(result.detail) ? result.detail[0]?.msg : result.detail
      throw new Error(detail || result.error || 'The reservation request failed.')
    }
    return result
  })

  if (!requestKey) return requestPromise

  const deduplicatedPromise = requestPromise.finally(() => {
    if (inFlightGetRequests.get(requestKey) === deduplicatedPromise) {
      inFlightGetRequests.delete(requestKey)
    }
  })
  inFlightGetRequests.set(requestKey, deduplicatedPromise)
  return deduplicatedPromise
}

export function getActiveReservations(email) {
  return request('/reservations/active', { headers: { 'X-User-Email': email } })
}

export function getReservationHistory(email) {
  return request('/reservations/history', { headers: { 'X-User-Email': email } })
}

export function reserveSeat(reservation) {
  return request('/reservations', {
    method: 'POST',
    body: JSON.stringify(reservation),
  })
}

export function unreserveSeat(reservationId, email) {
  return request(`/reservations/${reservationId}/unreserve`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}
