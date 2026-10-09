import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import * as SecureStore from 'expo-secure-store'
import {
  askAvailability,
  createOrGetUser,
  FillEstimate,
  getActiveReservations,
  getFillEstimates,
  getReservationHistory,
  releaseSpot,
  Reservation,
  reserveSpot,
} from '../lib/api'
import { PARKING_SPOTS, ParkingSpot } from '../lib/parking'

const EMAIL_KEY = 'parkside-user-email'
const COLORS = {
  ink: '#18312a',
  muted: '#6c7c75',
  green: '#1f7158',
  greenDark: '#155540',
  pale: '#e9f3ed',
  canvas: '#f5f7f4',
  white: '#ffffff',
  border: '#e3e9e4',
  amber: '#a66b20',
  amberPale: '#fff4df',
  red: '#a83f38',
  redPale: '#fceceb',
}

function humanTime(value: string): string {
  const [hour, minute] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function humanDate(value: string): string {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ParkingHomeScreen() {
  const [email, setEmail] = useState('')
  const [restoringEmail, setRestoringEmail] = useState(true)

  useEffect(() => {
    SecureStore.getItemAsync(EMAIL_KEY)
      .then((savedEmail) => setEmail(savedEmail || ''))
      .catch(() => setEmail(''))
      .finally(() => setRestoringEmail(false))
  }, [])

  async function handleLogin(enteredEmail: string) {
    const user = await createOrGetUser(enteredEmail.trim().toLowerCase())
    await SecureStore.setItemAsync(EMAIL_KEY, user.email)
    setEmail(user.email)
  }

  async function handleLogout() {
    await SecureStore.deleteItemAsync(EMAIL_KEY).catch(() => undefined)
    setEmail('')
  }

  if (restoringEmail) return <LoadingScreen label="Opening Parkside…" />
  return email
    ? <Dashboard email={email} onLogout={handleLogout} />
    : <LoginScreen onLogin={handleLogin} />
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>P</Text></View>
      <ActivityIndicator color={COLORS.green} style={{ marginTop: 18 }} />
      <Text style={styles.loadingText}>{label}</Text>
    </SafeAreaView>
  )
}

function LoginScreen({ onLogin }: { onLogin: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid work email address.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onLogin(normalizedEmail)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.loginPage}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.loginBrandRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>P</Text></View>
          <Text style={styles.brandName}>Parkside</Text>
        </View>
        <View style={styles.loginCard}>
          <View style={styles.eyebrow}><View style={styles.liveDot} /><Text style={styles.eyebrowText}>PARKING, MADE SIMPLE</Text></View>
          <Text style={styles.loginTitle}>A better place{ '\n' }to <Text style={styles.titleAccent}>park.</Text></Text>
          <Text style={styles.bodyText}>Sign in with your work email to see live parking availability.</Text>
          <Text style={styles.inputLabel}>Work email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#9ba9a1"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="go"
            onSubmitEditing={submit}
            style={styles.emailInput}
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton title={busy ? 'Connecting…' : 'Continue'} onPress={submit} disabled={busy} />
          <Text style={styles.loginFootnote}>Your email is saved securely on this device.</Text>
        </View>
        <Text style={styles.footerText}>© 2026 Parkside  ·  Find your space.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function PrimaryButton({ title, onPress, disabled = false }: {
  title: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primaryButton, (pressed || disabled) && styles.buttonPressed]}
    >
      {disabled && <ActivityIndicator color={COLORS.white} size="small" />}
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  )
}

function Dashboard({ email, onLogout }: { email: string; onLogout: () => Promise<void> }) {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [history, setHistory] = useState<Reservation[]>([])
  const [estimates, setEstimates] = useState<Record<string, FillEstimate>>({})
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [assistantAnswer, setAssistantAnswer] = useState('')
  const [assistantError, setAssistantError] = useState('')
  const [askingAssistant, setAskingAssistant] = useState(false)

  const myReservation = reservations.find((reservation) => reservation.reserved_by_me) || null
  const activeBySeat = useMemo(
    () => Object.fromEntries(reservations.map((reservation) => [reservation.seat_id, reservation])),
    [reservations],
  )
  const takenSpots = reservations.filter((reservation) =>
    PARKING_SPOTS.some((spot) => spot.seatId === reservation.seat_id),
  ).length
  const availableSpots = PARKING_SPOTS.length - takenSpots
  const selectedReservation = selectedSpot ? activeBySeat[selectedSpot.seatId] : undefined

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const [active, recentHistory, recentEstimates] = await Promise.all([
        getActiveReservations(email),
        getReservationHistory(email),
        getFillEstimates(timeZone).catch(() => []),
      ])
      setReservations(active)
      setHistory(recentHistory)
      setEstimates(Object.fromEntries(recentEstimates.map((estimate) => [estimate.seat_id, estimate])))
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load parking data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [email])

  useEffect(() => {
    const refreshTask = setTimeout(() => { void refresh() }, 0)
    return () => clearTimeout(refreshTask)
  }, [refresh])

  async function askAI() {
    setAskingAssistant(true)
    setAssistantError('')
    try {
      const response = await askAvailability(availableSpots, takenSpots)
      setAssistantAnswer(response.answer)
    } catch (askError) {
      setAssistantError(askError instanceof Error ? askError.message : 'The assistant is unavailable.')
    } finally {
      setAskingAssistant(false)
    }
  }

  async function bookSpot(spot: ParkingSpot) {
    if (busy || myReservation || activeBySeat[spot.seatId]) return
    setBusy(true)
    setError('')
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        throw new Error('Allow location access to book a spot at Candor TechSpace.')
      }
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      const reservation = await reserveSpot({
        email,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        seat_id: spot.seatId,
        seat_number: spot.number,
        tower: spot.tower,
        parking_level: spot.level,
        vehicle_type: spot.vehicleType,
      })
      const mine = { ...reservation, reserved_by_me: true }
      setReservations((current) => [...current, mine])
      setHistory((current) => [reservation, ...current])
    } catch (bookingError) {
      const message = bookingError instanceof Error ? bookingError.message : 'Unable to book this spot.'
      setError(message)
      await refresh(true)
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function cancelReservation() {
    if (!selectedReservation || !selectedReservation.reserved_by_me || busy) return
    setBusy(true)
    setError('')
    try {
      const released = await releaseSpot(selectedReservation.id, email)
      setReservations((current) => current.filter((item) => item.id !== released.id))
      setHistory((current) => current.map((item) => item.id === released.id ? released : item))
    } catch (releaseError) {
      setError(releaseError instanceof Error ? releaseError.message : 'Unable to release this spot.')
      await refresh(true)
    } finally {
      setBusy(false)
    }
  }

  if (loading && reservations.length === 0) {
    return <LoadingScreen label="Loading your parking lot…" />
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={COLORS.green} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View style={styles.loginBrandRow}>
            <View style={[styles.brandMark, styles.brandMarkSmall]}><Text style={styles.brandMarkText}>P</Text></View>
            <Text style={styles.brandName}>Parkside</Text>
          </View>
          <Pressable onPress={() => void onLogout()} hitSlop={10}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.welcomeHeader}>
          <View style={styles.eyebrow}><View style={styles.liveDot} /><Text style={styles.eyebrowText}>LIVE AVAILABILITY</Text></View>
          <Text style={styles.dashboardTitle}>Good parking{ '\n' }starts here.</Text>
          <Text style={styles.bodyText} numberOfLines={1}>{email}</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Available" value={loading ? '—' : String(availableSpots)} tone="green" />
          <StatCard label="Taken" value={loading ? '—' : String(takenSpots)} tone="amber" />
          <StatCard label="Your spot" value={myReservation?.seat_number || '—'} tone="neutral" />
        </View>

        <View style={styles.assistantCard}>
          <View style={styles.assistantTopline}>
            <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
            <Text style={styles.cardTitle}>Parking assistant</Text>
          </View>
          <Text style={styles.assistantText}>
            {assistantAnswer || `Ask about the current lot: ${availableSpots} available, ${takenSpots} taken.`}
          </Text>
          {!!assistantError && <Text style={styles.errorText}>{assistantError}</Text>}
          <Pressable onPress={askAI} disabled={askingAssistant || loading} style={styles.secondaryButton}>
            {askingAssistant && <ActivityIndicator size="small" color={COLORS.green} />}
            <Text style={styles.secondaryButtonText}>{askingAssistant ? 'Thinking…' : 'Ask availability'}</Text>
          </Pressable>
        </View>

        {!!error && <Text style={styles.errorBanner}>{error}</Text>}
        {myReservation && (
          <View style={styles.myReservationBanner}>
            <Text style={styles.myReservationLabel}>YOUR ACTIVE RESERVATION</Text>
            <Text style={styles.myReservationText}>Spot {myReservation.seat_number} · {myReservation.tower} · {myReservation.parking_level}</Text>
          </View>
        )}

        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionTitle}>Choose a spot</Text><Text style={styles.sectionCaption}>Tap an open spot for details and booking</Text></View>
          <View style={styles.legend}><View style={styles.legendOpen} /><Text style={styles.legendText}>Open</Text><View style={styles.legendTaken} /><Text style={styles.legendText}>Taken</Text></View>
        </View>

        <SpotSection
          title="Four-wheeler"
          spots={PARKING_SPOTS.filter((spot) => spot.vehicleType === 'Four-wheeler')}
          activeBySeat={activeBySeat}
          onSelect={setSelectedSpot}
        />
        <SpotSection
          title="Two-wheeler"
          spots={PARKING_SPOTS.filter((spot) => spot.vehicleType === 'Two-wheeler')}
          activeBySeat={activeBySeat}
          onSelect={setSelectedSpot}
        />

        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionTitle}>Reservation history</Text><Text style={styles.sectionCaption}>Recent activity for your account</Text></View>
        </View>
        {history.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>Your reservations will appear here.</Text></View>
        ) : history.slice(0, 8).map((reservation) => (
          <View key={reservation.id} style={styles.historyCard}>
            <View style={styles.historySpot}><Text style={styles.historySpotNumber}>{reservation.seat_number}</Text><Text style={styles.historySpotMeta}>{reservation.tower} · {reservation.parking_level}</Text></View>
            <View style={styles.historyDate}><Text style={styles.historyDateLabel}>Reserved</Text><Text style={styles.historyDateValue}>{humanDate(reservation.reserved_at)}</Text></View>
            <Text style={reservation.unreserved_at ? styles.historyStatusDone : styles.historyStatusActive}>{reservation.unreserved_at ? 'Released' : 'Active'}</Text>
          </View>
        ))}
        <Text style={styles.footerText}>© 2026 Parkside · Find your space.</Text>
      </ScrollView>

      <SpotModal
        spot={selectedSpot}
        reservation={selectedReservation}
        myReservation={myReservation}
        estimate={selectedSpot ? estimates[selectedSpot.seatId] : undefined}
        busy={busy}
        error={error}
        onClose={() => setSelectedSpot(null)}
        onBook={() => selectedSpot && void bookSpot(selectedSpot)}
        onRelease={() => void cancelReservation()}
      />
    </SafeAreaView>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'neutral' }) {
  return (
    <View style={[styles.statCard, tone === 'green' && styles.statGreen, tone === 'amber' && styles.statAmber]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function SpotSection({ title, spots, activeBySeat, onSelect }: {
  title: string
  spots: ParkingSpot[]
  activeBySeat: Record<string, Reservation>
  onSelect: (spot: ParkingSpot) => void
}) {
  const groups = useMemo(() => {
    const grouped = new Map<string, ParkingSpot[]>()
    spots.forEach((spot) => {
      const key = `${spot.tower} · ${spot.level}`
      grouped.set(key, [...(grouped.get(key) || []), spot])
    })
    return [...grouped.entries()]
  }, [spots])

  return (
    <View style={styles.vehicleSection}>
      <Text style={styles.vehicleTitle}>{title}</Text>
      {groups.map(([label, groupSpots]) => (
        <View key={label} style={styles.floorCard}>
          <Text style={styles.floorTitle}>{label}</Text>
          <View style={styles.spotGrid}>
            {groupSpots.map((spot) => {
              const reservation = activeBySeat[spot.seatId]
              const mine = reservation?.reserved_by_me
              return (
                <Pressable
                  key={spot.seatId}
                  accessibilityRole="button"
                  accessibilityLabel={`Spot ${spot.number}, ${label}, ${reservation ? mine ? 'reserved by you' : 'taken' : 'open'}`}
                  onPress={() => onSelect(spot)}
                  style={({ pressed }) => [
                    styles.spotChip,
                    reservation ? mine ? styles.spotMine : styles.spotTaken : styles.spotOpen,
                    pressed && styles.spotPressed,
                  ]}
                >
                  <Text style={[styles.spotChipText, reservation && styles.spotChipTextTaken]}>{spot.number}</Text>
                  {mine && <Text style={styles.youDot}>YOU</Text>}
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
    </View>
  )
}

function SpotModal({ spot, reservation, myReservation, estimate, busy, error, onClose, onBook, onRelease }: {
  spot: ParkingSpot | null
  reservation?: Reservation
  myReservation: Reservation | null
  estimate?: FillEstimate
  busy: boolean
  error: string
  onClose: () => void
  onBook: () => void
  onRelease: () => void
}) {
  const canBook = Boolean(spot && !reservation && !myReservation)
  return (
    <Modal visible={Boolean(spot)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close spot details" />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View><Text style={styles.modalKicker}>PARKING SPACE</Text><Text style={styles.modalTitle}>Spot {spot?.number}</Text></View>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.modalClose}>×</Text></Pressable>
          </View>
          <View style={[styles.statusPill, reservation ? reservation.reserved_by_me ? styles.statusMine : styles.statusTaken : styles.statusOpen]}>
            <Text style={styles.statusPillText}>{reservation ? reservation.reserved_by_me ? 'Reserved by you' : 'Already taken' : 'Available to reserve'}</Text>
          </View>
          <View style={styles.detailsGrid}>
            <Detail label="Vehicle" value={spot?.vehicleType || '—'} />
            <Detail label="Tower" value={spot?.tower || '—'} />
            <Detail label="Level" value={spot?.level || '—'} />
          </View>
          {reservation && <Text style={styles.detailNote}>Reserved at {humanDate(reservation.reserved_at)}</Text>}
          {!reservation && estimate && <View style={styles.estimateCard}>
            <Text style={styles.estimateTitle}>Typical reservation time</Text>
            <Text style={styles.estimateTime}>Around {humanTime(estimate.typical_reserved_time)}</Text>
            <Text style={styles.estimateNote}>From {estimate.reservations_in_period} {estimate.reservations_in_period === 1 ? 'reservation' : 'reservations'} over the last {estimate.period_days} days. Historical guide only.</Text>
            {estimate.reservations_in_period < 3 && <Text style={styles.estimateCaution}>Few records, so this estimate may be unreliable.</Text>}
          </View>}
          {canBook && <Text style={styles.locationNote}>Location access is required. Booking is available only at Candor TechSpace, Noida Sector 62. Your coordinates are checked for this booking and are not saved.</Text>}
          {myReservation && !reservation && <Text style={styles.locationNote}>Release your current spot {myReservation.seat_number} before booking another one.</Text>}
          {!!error && <Text style={styles.errorBanner}>{error}</Text>}
          {canBook && <PrimaryButton title={busy ? 'Checking location…' : 'Book this spot'} onPress={onBook} disabled={busy} />}
          {reservation?.reserved_by_me && <PrimaryButton title={busy ? 'Updating…' : 'Release this spot'} onPress={onRelease} disabled={busy} />}
          <Pressable onPress={onClose} style={styles.doneButton}><Text style={styles.doneButtonText}>Done</Text></Pressable>
        </View>
      </View>
    </Modal>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailCell}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  loadingText: { color: COLORS.muted, marginTop: 12, fontSize: 14 },
  loginPage: { flex: 1, justifyContent: 'space-between', padding: 22, paddingTop: 24, paddingBottom: 12 },
  loginBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.green },
  brandMarkSmall: { width: 34, height: 34, borderRadius: 11 },
  brandMarkText: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  brandName: { color: COLORS.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  loginCard: { padding: 23, borderRadius: 24, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#18312a', shadowOpacity: 0.05, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  liveDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: '#39a477' },
  eyebrowText: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800', color: COLORS.green },
  loginTitle: { fontSize: 39, fontWeight: '800', lineHeight: 43, letterSpacing: -1.2, color: COLORS.ink, marginBottom: 10 },
  titleAccent: { color: COLORS.green },
  bodyText: { color: COLORS.muted, fontSize: 14, lineHeight: 21 },
  inputLabel: { marginTop: 26, marginBottom: 8, color: COLORS.ink, fontSize: 12, fontWeight: '700' },
  emailInput: { height: 51, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: COLORS.ink, backgroundColor: '#fbfcfb' },
  errorText: { color: COLORS.red, fontSize: 12, lineHeight: 17, marginTop: 8 },
  errorBanner: { backgroundColor: COLORS.redPale, borderRadius: 12, color: COLORS.red, fontSize: 12, lineHeight: 18, marginBottom: 14, padding: 12 },
  primaryButton: { minHeight: 50, paddingHorizontal: 18, borderRadius: 12, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 17 },
  primaryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  buttonPressed: { opacity: 0.72 },
  loginFootnote: { color: COLORS.muted, textAlign: 'center', fontSize: 11, marginTop: 18 },
  footerText: { color: '#97a49d', fontSize: 11, textAlign: 'center', paddingVertical: 10 },
  dashboardContent: { padding: 18, paddingBottom: 30 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  signOut: { color: COLORS.green, fontSize: 12, fontWeight: '700' },
  welcomeHeader: { marginBottom: 20 },
  dashboardTitle: { color: COLORS.ink, fontSize: 35, fontWeight: '800', letterSpacing: -1.1, lineHeight: 38, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 9, marginBottom: 15 },
  statCard: { flex: 1, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14, paddingHorizontal: 12 },
  statGreen: { backgroundColor: COLORS.pale, borderColor: '#d8e8dd' },
  statAmber: { backgroundColor: COLORS.amberPale, borderColor: '#f4e4c6' },
  statValue: { color: COLORS.ink, fontSize: 23, fontWeight: '800' },
  statLabel: { color: COLORS.muted, fontSize: 10, marginTop: 4, fontWeight: '600' },
  assistantCard: { padding: 16, backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 18, marginBottom: 17 },
  assistantTopline: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  aiBadge: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pale },
  aiBadgeText: { color: COLORS.green, fontSize: 10, fontWeight: '900' },
  cardTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '800' },
  assistantText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  secondaryButton: { minHeight: 40, borderWidth: 1, borderColor: '#cfe1d6', borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 13, alignSelf: 'flex-start', paddingHorizontal: 13 },
  secondaryButtonText: { color: COLORS.green, fontSize: 12, fontWeight: '800' },
  myReservationBanner: { padding: 13, borderRadius: 14, backgroundColor: COLORS.pale, marginBottom: 19 },
  myReservationLabel: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  myReservationText: { color: COLORS.ink, fontSize: 13, fontWeight: '700', marginTop: 5 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 13, marginBottom: 11 },
  sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionCaption: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 2 },
  legendOpen: { width: 8, height: 8, borderRadius: 5, backgroundColor: COLORS.green },
  legendTaken: { width: 8, height: 8, borderRadius: 5, backgroundColor: '#d28a42', marginLeft: 5 },
  legendText: { color: COLORS.muted, fontSize: 9 },
  vehicleSection: { marginBottom: 9 },
  vehicleTitle: { color: COLORS.greenDark, fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 5 },
  floorCard: { borderRadius: 15, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, padding: 13, marginBottom: 9 },
  floorTitle: { color: COLORS.ink, fontSize: 11, fontWeight: '700', marginBottom: 10 },
  spotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  spotChip: { minWidth: 47, minHeight: 37, paddingHorizontal: 7, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  spotOpen: { backgroundColor: '#edf6f0', borderWidth: 1, borderColor: '#d4e8da' },
  spotTaken: { backgroundColor: '#fff1e4', borderWidth: 1, borderColor: '#f3ddc5' },
  spotMine: { backgroundColor: COLORS.green, borderWidth: 1, borderColor: COLORS.green },
  spotChipText: { fontSize: 10, fontWeight: '800', color: COLORS.greenDark },
  spotChipTextTaken: { color: '#8a5b2b' },
  youDot: { fontSize: 7, color: COLORS.white, fontWeight: '900' },
  spotPressed: { opacity: 0.58 },
  emptyCard: { borderRadius: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, padding: 17 },
  emptyText: { color: COLORS.muted, fontSize: 12 },
  historyCard: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  historySpot: { flex: 1 },
  historySpotNumber: { color: COLORS.ink, fontSize: 15, fontWeight: '800' },
  historySpotMeta: { color: COLORS.muted, fontSize: 9, marginTop: 3 },
  historyDate: { flex: 1.2 },
  historyDateLabel: { color: COLORS.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  historyDateValue: { color: COLORS.ink, fontSize: 9, marginTop: 3 },
  historyStatusActive: { color: COLORS.green, fontSize: 9, fontWeight: '800' },
  historyStatusDone: { color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12, 27, 22, 0.42)' },
  modalSheet: { paddingHorizontal: 21, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 23, backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHandle: { width: 42, height: 4, backgroundColor: '#dbe2dc', borderRadius: 3, alignSelf: 'center', marginBottom: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalKicker: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  modalTitle: { color: COLORS.ink, fontSize: 25, fontWeight: '800', marginTop: 3 },
  modalClose: { color: COLORS.muted, fontSize: 28, lineHeight: 30, paddingHorizontal: 5 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 20, marginTop: 13, paddingVertical: 6, paddingHorizontal: 10 },
  statusOpen: { backgroundColor: COLORS.pale },
  statusTaken: { backgroundColor: COLORS.amberPale },
  statusMine: { backgroundColor: COLORS.pale },
  statusPillText: { color: COLORS.ink, fontSize: 10, fontWeight: '700' },
  detailsGrid: { flexDirection: 'row', borderRadius: 14, backgroundColor: COLORS.canvas, marginTop: 16, padding: 12, gap: 9 },
  detailCell: { flex: 1 },
  detailLabel: { color: COLORS.muted, fontSize: 9 },
  detailValue: { color: COLORS.ink, fontSize: 11, fontWeight: '700', marginTop: 4 },
  detailNote: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 14 },
  estimateCard: { padding: 13, borderRadius: 13, backgroundColor: COLORS.amberPale, marginTop: 14 },
  estimateTitle: { color: COLORS.amber, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  estimateTime: { color: COLORS.ink, fontSize: 18, fontWeight: '800', marginTop: 4 },
  estimateNote: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  estimateCaution: { color: COLORS.amber, fontSize: 10, marginTop: 5, fontWeight: '700' },
  locationNote: { color: COLORS.muted, backgroundColor: COLORS.canvas, borderRadius: 11, padding: 11, fontSize: 10, lineHeight: 15, marginTop: 14 },
  doneButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  doneButtonText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
})
