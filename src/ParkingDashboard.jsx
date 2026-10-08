import { useEffect, useState } from 'react'
import {
  getActiveReservations,
  getReservationHistory,
  reserveSeat as createReservation,
  unreserveSeat as releaseReservation,
} from './reservationsApi.js'

const fourWheelRows = [
  { tower: 'Tower 1', rows: [
    ['308', '110', '216', '431', '127A', '131', '170A', '180', '534', '529', '440'],
    ['309', '103', '217', '124A', '128', '131A', '176', '180A', '535', '530', ''],
    ['310', '101', '218', '125', '128A', '132', '176A', '181', '536', '531', ''],
    ['311', '102', '219', '125A', '129', '133', '177', '183A', '537', '444', ''],
    ['312', '103', '220', '126', '129A', '174', '177A', '214', '', '445', ''],
    ['', '104', '106', '128A', '130', '174A', '197', '214A', '527', '446', ''],
    ['', '105', '107', '127', '130A', '175', '197A', '215', '528', '447', ''],
  ] },
  { tower: 'Tower 5', rows: [
    ['1054', '1015', '1107', '1115', '1196A', '1192A', '1176', '1034', '1088', '', ''],
    ['1054A', '1016', '1108', '1191', '1195', '1177', '1034A', '1089', '', '', ''],
    ['1055', '1017', '1109', '1191A', '1195A', '1178', '1035', '1090', '', '', ''],
    ['1052', '1018', '1110', '1196', '1154', '1179', '1036', '1091', '', '', ''],
    ['1052A', '1019', '1111', '1196A', '1154A', '1180', '1037', '', '', '', ''],
    ['1053', '1020', '1112', '1197', '1153', '1181', '1038', '', '', '', ''],
    ['1053A', '1105', '1113', '1197A', '1153A', '1182', '1039', '', '', '', ''],
    ['1054', '1106', '1114', '1198', '1152', '1082', '1087', '', '', '', ''],
  ] },
]

const twoWheelRows = [
  { tower: 'Tower 1', rows: [['181A', '111', ''], ['182A', '112', ''], ['245A', '113', ''], ['246A', '114', ''], ['247A', '115', '']] },
  { tower: 'Tower 5', rows: [['1010', '1017', '101'], ['1011', '1074', '105'], ['1012', '1075', '106'], ['1013', '', '107'], ['1014', '', '108'], ['1015', '', '109']] },
]

function getSeatIds(groups, vehicleType) {
  return groups.flatMap(({ tower, rows }) => rows.flatMap((row, rowIndex) => row.flatMap((slot, columnIndex) => {
    if (!slot) return []
    const level = vehicleType === 'Four-wheeler'
      ? (columnIndex < 2 ? 'Ground' : columnIndex < 8 ? 'Basement 1' : 'Basement 2')
      : (columnIndex < 2 ? 'Basement 1' : 'Basement 2')
    return [`${vehicleType}|${tower}|${level}|${rowIndex}|${columnIndex}|${slot}`]
  })))
}

const PARKING_SEAT_IDS = new Set([
  ...getSeatIds(fourWheelRows, 'Four-wheeler'),
  ...getSeatIds(twoWheelRows, 'Two-wheeler'),
])
const TOTAL_SEAT_COUNT = PARKING_SEAT_IDS.size

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function ParkingRows({ groups, vehicleType, reservations, userEmail, onSelectSlot }) {
  return groups.flatMap(({ tower, rows }) => rows.map((row, rowIndex) => (
    <tr key={`${vehicleType}-${tower}-${rowIndex}`}>
      {rowIndex === 0 && <td className="tower-cell" rowSpan={rows.length}>{tower}</td>}
      {row.map((slot, columnIndex) => {
        const level = vehicleType === 'Four-wheeler'
          ? (columnIndex < 2 ? 'Ground' : columnIndex < 8 ? 'Basement 1' : 'Basement 2')
          : (columnIndex < 2 ? 'Basement 1' : 'Basement 2')
        const basementTwo = vehicleType === 'Four-wheeler' ? columnIndex >= 8 : columnIndex === 2
        const seatId = `${vehicleType}|${tower}|${level}|${rowIndex}|${columnIndex}|${slot}`
        const reservation = reservations.find((item) => item.seat_id === seatId)
        const isMine = Boolean(reservation?.reserved_by_me)
        return <td key={`${rowIndex}-${columnIndex}`} className={basementTwo ? 'bg-b2' : ''}>
          {slot && <button className={`slot-button${reservation ? ' is-reserved' : ''}${isMine ? ' is-mine' : ''}`} onClick={() => onSelectSlot({ seatId, slot, tower, level, vehicleType, reservation, reservationId: reservation?.id, isReserved: Boolean(reservation), isMine })} disabled={!userEmail} aria-label={`Parking slot ${slot}, ${tower}, ${level}${reservation ? isMine ? ', reserved by you' : ', reserved' : ', available'}`}>
            {slot}{reservation && <span className="seat-indicator" aria-hidden="true">{isMine ? ' · yours' : ' · reserved'}</span>}
          </button>}
        </td>
      })}
    </tr>
  )))
}

function SlotDetailsModal({ slot, currentReservation, isSaving, error, onReserve, onUnreserve, onClose }) {
  if (!slot) return null

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="slot-modal" role="dialog" aria-modal="true" aria-labelledby="slot-modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        <div className="modal-icon">P</div>
        <p className="modal-kicker">PARKING SPACE</p>
        <h2 id="slot-modal-title">Slot {slot.slot}</h2>
        <p className={`reservation-status ${slot.isReserved ? slot.isMine ? 'status-mine' : 'status-taken' : 'status-open'}`}>
          {slot.isReserved ? slot.isMine ? 'Reserved by you' : 'Already reserved' : 'Available to reserve'}
        </p>
        <div className="modal-details">
          <div><span>Vehicle type</span><strong>{slot.vehicleType}</strong></div>
          <div><span>Tower</span><strong>{slot.tower}</strong></div>
          <div><span>Parking level</span><strong>{slot.level}</strong></div>
        </div>
        {slot.reservation && <div className="reservation-time">Reserved at <strong>{new Date(slot.reservation.reserved_at).toLocaleString()}</strong></div>}
        {currentReservation && currentReservation.seat_id !== slot.seatId && !slot.isReserved &&
          <p className="reservation-hint">You already reserved slot {currentReservation.seat_number}. Unreserve it before choosing another seat.</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!slot.isReserved && !currentReservation && <button className="modal-reserve" onClick={() => onReserve(slot)} disabled={isSaving}>{isSaving ? 'Reserving…' : 'Reserve this seat'}</button>}
        {slot.isMine && <button className="modal-unreserve" onClick={onUnreserve} disabled={isSaving}>{isSaving ? 'Updating…' : 'Unreserve this seat'}</button>}
        <button className="modal-done" onClick={onClose}>Done</button>
      </section>
    </div>
  )
}

function ParkingDashboard({ email, onLogout }) {
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [reservations, setReservations] = useState([])
  const [history, setHistory] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [actionError, setActionError] = useState('')
  const myReservation = reservations.find((reservation) => reservation.reserved_by_me) || null
  const takenSeatCount = reservations.filter((reservation) => PARKING_SEAT_IDS.has(reservation.seat_id)).length
  const availableSeatCount = TOTAL_SEAT_COUNT - takenSeatCount

  async function refreshData() {
    setApiError('')
    try {
      const [activeReservations, reservationHistory] = await Promise.all([
        getActiveReservations(email),
        getReservationHistory(email),
      ])
      setReservations(activeReservations)
      setHistory(reservationHistory)
    } catch (error) {
      setApiError(error.message || 'Unable to load reservation data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { refreshData() }, [email])

  async function handleReserve(slot) {
    if (myReservation || slot.isReserved || isSaving) return
    setActionError('')
    setIsSaving(true)
    try {
      const reservation = await createReservation({
        email,
        seat_id: slot.seatId,
        seat_number: slot.slot,
        tower: slot.tower,
        parking_level: slot.level,
        vehicle_type: slot.vehicleType,
      })
      setReservations((current) => [...current, { ...reservation, reserved_by_me: true }])
      setSelectedSlot((current) => current ? { ...current, reservation, reservationId: reservation.id, isReserved: true, isMine: true } : current)
      setHistory((current) => [reservation, ...current])
    } catch (error) {
      setActionError(error.message || 'Unable to reserve this seat.')
      await refreshData()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUnreserve() {
    if (!selectedSlot?.reservationId || isSaving) return
    setActionError('')
    setIsSaving(true)
    try {
      const released = await releaseReservation(selectedSlot.reservationId, email)
      setReservations((current) => current.filter((reservation) => reservation.id !== released.id))
      setHistory((current) => current.map((reservation) => reservation.id === released.id ? released : reservation))
      setSelectedSlot(null)
    } catch (error) {
      setActionError(error.message || 'Unable to unreserve this seat.')
      await refreshData()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <section className="dashboard" aria-labelledby="dashboard-title">
        <div className="dashboard-heading">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> LIVE AVAILABILITY
              <span className="availability-counts">
                {isLoading ? 'Checking seats…' : <><strong>{takenSeatCount}</strong> taken <span>·</span> <strong>{availableSeatCount}</strong> available</>}
              </span>
            </div>
            <h1 id="dashboard-title">Good parking<br /><span>starts here.</span></h1>
            <p className="intro">Here’s what’s open in your lot right now.</p>
          </div>
          <div className="availability-card"><strong>{myReservation ? '1' : '0'}</strong><span>{myReservation ? `Your seat: ${myReservation.seat_number}` : 'Your reserved seats'}</span><div className="availability-bar"><i /></div></div>
        </div>
        {apiError && <p className="error-message" role="alert">{apiError}</p>}

        <div className="parking-section table-card">
          <h2 className="parking-title">Four - Wheeler Parking Slot Details</h2>
          <div className="table-scroll"><table className="slot-table four-wheel-table">
            <thead><tr><th className="main-header" rowSpan="2">Tower</th><th className="main-header" colSpan="2">Ground</th><th className="main-header" colSpan="6">Basement 1</th><th className="main-header" colSpan="3">Basement 2</th></tr><tr>{['Ground', 'Ground', 'Basement 1', 'Basement 1', 'Basement 1', 'Basement 1', 'Basement 1', 'Basement 1', 'Basement 2', 'Basement 2', 'Basement 2'].map((level, index) => <th className="sub-header" key={index}>{level}</th>)}</tr></thead>
            <tbody><ParkingRows groups={fourWheelRows} vehicleType="Four-wheeler" reservations={reservations} userEmail={isLoading ? '' : email} onSelectSlot={setSelectedSlot} /></tbody>
          </table></div>
        </div>

        <div className="parking-section table-card">
          <h2 className="parking-title">Two - Wheeler Parking Slot Details</h2>
          <div className="table-scroll"><table className="slot-table two-wheel-table">
            <thead><tr><th className="main-header">Tower</th><th className="main-header" colSpan="2">Basement 1</th><th className="main-header">Basement 2</th></tr></thead>
            <tbody><ParkingRows groups={twoWheelRows} vehicleType="Two-wheeler" reservations={reservations} userEmail={isLoading ? '' : email} onSelectSlot={setSelectedSlot} /></tbody>
          </table></div>
        </div>

        <div className="parking-section table-card map-section">
          <h2 className="parking-title">Outside Parking Map View</h2>
          <div className="map-box">[ Map / Layout Placeholder Area ]</div>
        </div>
        {history.length > 0 && <div className="parking-section table-card history-section">
          <div className="table-heading"><div><h2>Reservation history</h2><p>Recent seats reserved with this email</p></div></div>
          <div className="table-scroll"><table className="history-table">
            <thead><tr><th>SEAT</th><th>VEHICLE</th><th>TOWER</th><th>LEVEL</th><th>RESERVED</th><th>UNRESERVED</th><th>DURATION</th></tr></thead>
            <tbody>{history.map((reservation) => <tr key={reservation.id}>
              <td className="spot-cell">{reservation.seat_number}</td><td>{reservation.vehicle_type}</td><td>{reservation.tower}</td><td>{reservation.parking_level}</td>
              <td className="muted-cell">{new Date(reservation.reserved_at).toLocaleString()}</td>
              <td className="muted-cell">{reservation.unreserved_at ? new Date(reservation.unreserved_at).toLocaleString() : 'Active'}</td>
              <td className="muted-cell">{reservation.duration_seconds == null ? 'In progress' : formatDuration(reservation.duration_seconds)}</td>
            </tr>)}</tbody>
          </table></div>
        </div>}
        <button className="back-button" onClick={onLogout}>← Use a different email</button>
      </section>
      <SlotDetailsModal
        slot={selectedSlot}
        currentReservation={myReservation}
        isSaving={isSaving}
        error={actionError}
        onReserve={handleReserve}
        onUnreserve={handleUnreserve}
        onClose={() => setSelectedSlot(null)}
      />
    </>
  )
}

export default ParkingDashboard
