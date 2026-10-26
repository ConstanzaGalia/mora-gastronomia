'use client'

import { useEffect, useRef, useState } from 'react'
import { deliveryMapsHref, orderCustomerWhatsappHref } from '@/lib/market'
import 'leaflet/dist/leaflet.css'

export type DeliveryStop = {
  id: string
  name: string
  address: string
  phone: string
}

const TUCUMAN: [number, number] = [-26.82414, -65.2226]
const UTENSILS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4"/></svg>'
const WHATSAPP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
  ))
}

async function geocode(address: string) {
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`)
  if (!response.ok) return null
  const data = (await response.json()) as { lat: number | null; lng: number | null }
  if (data.lat == null || data.lng == null) return null
  return { lat: data.lat, lng: data.lng }
}

export function MarketDeliveryMap({ stops }: { stops: DeliveryStop[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [located, setLocated] = useState(0)
  const [done, setDone] = useState(false)
  const mapsHref = deliveryMapsHref(stops.map((stop) => stop.address))

  useEffect(() => {
    const node = mapRef.current
    if (!node || stops.length === 0) return
    let cancelled = false
    let map: import('leaflet').Map | undefined

    async function run() {
      const leaflet = await import('leaflet')
      const L = leaflet.default ?? leaflet
      if (cancelled || !node) return

      map = L.map(node, { zoomControl: false, attributionControl: true }).setView(TUCUMAN, 13)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      L.control.zoom({ position: 'bottomleft' }).addTo(map)
      window.setTimeout(() => map?.invalidateSize(), 80)

      const pin = L.divIcon({
        className: 'market-map-pin',
        html: `<span class="market-map-mark">${UTENSILS_SVG}</span>`,
        iconSize: [36, 44],
        iconAnchor: [18, 42],
        popupAnchor: [0, -38],
      })

      const bounds = L.latLngBounds([])
      let found = 0
      for (const stop of stops) {
        if (cancelled) return
        const point = await geocode(stop.address)
        if (cancelled || !point || !map) continue
        const whatsapp = orderCustomerWhatsappHref({ customerName: stop.name, phone: stop.phone })
        const popup = `<div class="market-map-popup"><strong>${escapeHtml(stop.name)}</strong><span>${escapeHtml(stop.address)}</span>${
          whatsapp
            ? `<a class="market-map-wa" href="${escapeHtml(whatsapp)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${WHATSAPP_SVG}</a>`
            : ''
        }</div>`
        L.marker([point.lat, point.lng], { icon: pin }).addTo(map).bindPopup(popup)
        bounds.extend([point.lat, point.lng])
        found += 1
        setLocated(found)
      }
      if (!cancelled && found > 0) {
        map.fitBounds(bounds.pad(0.28), { maxZoom: 15, animate: false })
        window.setTimeout(() => map?.invalidateSize(), 50)
      }
      if (!cancelled) setDone(true)
    }

    void run()
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [stops])

  return (
    <div className="market-map-wrap">
      <div className="market-map" ref={mapRef} />
      {mapsHref && (
        <a className="market-map-route" href={mapsHref} rel="noopener noreferrer" target="_blank">
          Abrir ruta en Google Maps
        </a>
      )}
      {!done && <p className="market-map-status">Ubicando direcciones…</p>}
      {done && located === 0 && (
        <p className="market-map-status">No pudimos poner los pines. La ruta en Google Maps sigue disponible.</p>
      )}
    </div>
  )
}
