import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Item, Place } from "./model";
import { dailySequence } from "./model";
const colors: Record<string, string> = {
  美食: "#9B492D",
  景點: "#315C4B",
  住宿: "#514B88",
  交通: "#276583",
  其他: "#695F50",
};
export function TravelMap({
  places,
  items,
  selected,
  onSelect,
  pin,
  onPin,
  showDay = false,
}: {
  places: Place[];
  items: Item[];
  selected: string | null;
  onSelect: (i: Item) => void;
  pin: string | null;
  onPin: (id: string, lat: number, lng: number) => void;
  showDay?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null),
    marks = useRef(new Map<string, L.Marker>());
  const [tileError, se] = useState(false);
  const callbacks = useRef({ onSelect, onPin, pin });
  callbacks.current = { onSelect, onPin, pin };
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, {
      zoomControl: true,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([35.68, 139.76], 10);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    const tiles = L.tileLayer(
      import.meta.env.VITE_MAP_TILE_URL ||
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          import.meta.env.VITE_MAP_ATTRIBUTION ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(m);
    const failed = new Set<string>();
    tiles.on("loading", () => {
      failed.clear();
      se(false);
    });
    tiles.on("tileerror", (event: L.TileErrorEvent) => {
      failed.add((event.tile as HTMLImageElement).src);
      se(true);
    });
    tiles.on("tileload", (event: L.TileEvent) => {
      failed.delete((event.tile as HTMLImageElement).src);
      se(failed.size > 0);
    });
    m.on("click", (e) => {
      const p = callbacks.current.pin;
      if (p) callbacks.current.onPin(p, e.latlng.lat, e.latlng.lng);
    });
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      m.stop();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current,
      group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    marks.current.clear();
    const points: L.LatLngExpression[] = [];
    const numbers = dailySequence(items);
    const lines = new Map<string, L.LatLngExpression[]>();
    for (const i of items) {
      const p = places.find((p) => p.id === i.placeId);
      if (!p || p.lat === null || p.lng === null) continue;
      const point: L.LatLngExpression = [p.lat, p.lng];
      points.push(point);
      const candidate = i.status === "candidate";
      if (!candidate && i.day) lines.set(i.day, [...(lines.get(i.day) ?? []), point]);
      const label = candidate ? "?" : `${showDay && i.day ? `${i.day.slice(5)} · ` : ""}${numbers.get(i.id) ?? "?"}`;
      const element = document.createElement("span");
      element.className = `map-pin ${candidate ? "candidate" : ""} ${i.status === "skipped" ? "skipped" : ""}`;
      if (showDay && i.day) element.classList.add("dated");
      element.style.background = colors[p.category];
      element.textContent = label;
      element.setAttribute(
        "aria-label",
        `${p.name} ${i.day ?? "未排定"} ${candidate ? "候選" : `第 ${numbers.get(i.id)} 站`}${i.status === "skipped" ? " · 已跳過" : ""}`,
      );
      const marker = L.marker(point, {
        icon: L.divIcon({
          html: element,
          className: "marker-host",
          iconSize: [showDay && i.day ? 64 : 36, 44],
          iconAnchor: [showDay && i.day ? 32 : 18, 40],
        }),
        keyboard: true,
        title: p.name,
      }).addTo(group);
      const tip = document.createElement("span");
      tip.textContent = `${p.category} · ${p.name} · ${i.day ?? "未排定"} ${candidate ? "候選" : `第 ${numbers.get(i.id)} 站`}`;
      marker.bindTooltip(tip);
      marker.on("click", () => callbacks.current.onSelect(i));
      marks.current.set(i.id, marker);
    }
    for (const line of lines.values()) if (line.length > 1)
      L.polyline(line, {
        color: "#61746A",
        weight: 2,
        dashArray: "5 8",
        interactive: false,
      }).addTo(group);
    if (points.length && !selected)
      m.fitBounds(L.latLngBounds(points), {
        padding: [40, 40],
        maxZoom: 14,
        animate: false,
      });
  }, [places, items, showDay]);
  useEffect(() => {
    const marker = selected ? marks.current.get(selected) : null;
    if (marker) {
      marker.openTooltip();
      map.current?.panTo(marker.getLatLng(), { animate: false });
    }
  }, [selected, items]);
  return (
    <div className={`map-wrap ${pin ? "pin-mode" : ""}`}>
      <div ref={host} className="map" aria-label="可縮放行程地圖" />
      {tileError && (
        <div className="map-warning" role="status">
          底圖暫時無法載入；行程及已知位置仍可使用。
        </div>
      )}
      {pin && <div className="map-warning">點一下地圖以設定位置</div>}
      <p className="map-note">
        虛線只表示行程順序，不是真實道路路線。未定位地點不顯示標記。
      </p>
    </div>
  );
}
