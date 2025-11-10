import { useEffect, useMemo, useRef, useState } from 'react'

const COLORS = [
  '#f43f5e', // rose
  '#fb7185',
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#f472b6', // pink
]

function startOfMonth(date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 Sun - 6 Sat
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

export default function Calendar() {
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', time: '', color: COLORS[8], reminder: 15 })
  const audioRef = useRef(null)

  const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  const monthLabel = current.toLocaleString('default', { month: 'long', year: 'numeric' })

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(current))
    const end = endOfMonth(current)
    const cells = []
    let d = new Date(start)
    while (d <= end || cells.length % 7 !== 0) {
      cells.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }
    return cells
  }, [current])

  async function fetchEvents() {
    try {
      const res = await fetch(`${baseUrl}/api/events/today`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchEvents()
    const t = setInterval(fetchEvents, 60_000)
    return () => clearInterval(t)
  }, [])

  // Sound notifications for upcoming events
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      events.forEach(ev => {
        if (!ev.reminder_minutes) return
        const start = new Date(ev.start)
        const notifyAt = new Date(start.getTime() - ev.reminder_minutes * 60000)
        // Trigger if within the last 1 minute window
        if (now >= notifyAt && now < new Date(notifyAt.getTime() + 60000)) {
          if (audioRef.current) {
            audioRef.current.currentTime = 0
            audioRef.current.play().catch(()=>{})
          }
        }
      })
    }, 15_000)
    return () => clearInterval(interval)
  }, [events])

  const createEvent = async (e) => {
    e.preventDefault()
    const date = new Date(form.date + 'T' + (form.time || '00:00'))
    const payload = {
      title: form.title,
      start: date.toISOString(),
      end: null,
      color: form.color,
      reminder_minutes: Number(form.reminder) || 0,
      all_day: !form.time,
      tags: [],
    }
    const res = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      setShowModal(false)
      setForm({ title: '', date: '', time: '', color: COLORS[8], reminder: 15 })
      fetchEvents()
    }
  }

  const todayStr = new Date().toDateString()

  const grouped = useMemo(() => {
    const map = {}
    events.forEach(ev => {
      const d = new Date(ev.start).toDateString()
      if (!map[d]) map[d] = []
      map[d].push(ev)
    })
    return map
  }, [events])

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Calendario</h1>
          <p className="text-gray-600">Promemoria con notifiche sonore</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth()-1, 1))} className="px-3 py-2 rounded bg-white/70 hover:bg-white shadow text-gray-700">◀</button>
          <div className="px-4 py-2 rounded bg-gradient-to-r from-pink-200 to-blue-200 text-gray-800 font-medium shadow">{monthLabel}</div>
          <button onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth()+1, 1))} className="px-3 py-2 rounded bg-white/70 hover:bg-white shadow text-gray-700">▶</button>
          <button onClick={() => setShowModal(true)} className="ml-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white shadow">+ Nuovo evento</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Dom','Lun','Mar','Mer','Gio','Ven','Sab'].map((d) => (
          <div key={d} className="text-center text-xs uppercase tracking-wide text-gray-500">{d}</div>
        ))}
        {days.map((d, i) => {
          const isToday = d.toDateString() === todayStr
          const key = d.toISOString()
          const dayEvents = grouped[d.toDateString()] || []
          return (
            <div key={key} className={`min-h-[110px] rounded-lg p-2 bg-white/70 backdrop-blur border border-white/60 shadow ${isToday ? 'ring-2 ring-blue-400' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{d.getDate()}</span>
                {isToday && <span className="text-[10px] text-blue-500 font-semibold">Oggi</span>}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0,3).map((ev) => (
                  <div key={ev.id} className="text-xs px-2 py-1 rounded text-white" style={{backgroundColor: ev.color}}>
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-gray-500">+{dayEvents.length - 3} altri</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">Nuovo evento</h3>
            <form onSubmit={createEvent} className="space-y-3">
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Titolo" className="w-full border rounded px-3 py-2" />
              <div className="grid grid-cols-2 gap-3">
                <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="border rounded px-3 py-2" />
                <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="border rounded px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <select value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="border rounded px-3 py-2">
                  {COLORS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="10080" value={form.reminder} onChange={e => setForm({...form, reminder: e.target.value})} className="border rounded px-3 py-2 w-24" />
                  <span className="text-sm text-gray-600">min prima</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-2 rounded border">Annulla</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <audio ref={audioRef} src="https://cdn.pixabay.com/download/audio/2021/08/04/audio_7a0f2b6f4e.mp3?filename=notification-199188-199188.mp3" preload="auto" />
    </div>
  )
}
