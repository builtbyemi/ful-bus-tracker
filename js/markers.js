import { busState, movement, timestamp } from "./tracking.js";

// Top-down silhouette: windscreen at the front. The whole vehicle rotates, the label stays upright.
const vehicle =
  '<svg viewBox="0 0 28 42" aria-hidden="true"><path class="bus-direction-arrow" d="m14 0 4 5h-8Z" fill="currentColor"/><rect x="4" y="7" width="20" height="33" rx="5" fill="currentColor"/><rect x="7" y="11" width="14" height="7" rx="2" fill="white"/><rect x="7" y="22" width="14" height="11" rx="2" fill="white" opacity=".23"/><path d="M1 15v6m26-6v6M1 31v6m26-6v6" stroke="currentColor" stroke-width="2"/><path d="M8 37h3m6 0h3" stroke="white" stroke-width="2"/></svg>';

export class BusMarkers {
  constructor(map, onSelect) {
    this.map = map;
    this.onSelect = onSelect;
    this.items = new Map();
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
  }
  update(id, bus, now, connected, selected) {
    let item = this.items.get(id);
    const state = busState(bus, now, connected);
    if (
      !bus ||
      !bus.tripStarted ||
      !timestamp(bus.lastGpsUpdate) ||
      now - timestamp(bus.lastGpsUpdate) > 300_000
    ) {
      this.remove(id);
      return;
    }
    if (!item && !state.live) return;
    if (!item) {
      const marker = L.marker([bus.latitude, bus.longitude], {
        icon: L.divIcon({
          className: "bus-map-marker",
          html:
            '<div class="bus-marker-body">' +
            vehicle +
            '<span class="bus-marker-label">' +
            id +
            "</span></div>",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        title: id,
        alt: id,
        keyboard: true,
        zIndexOffset: 1000,
      })
        .addTo(this.map)
        .on("click", () => this.onSelect(id));
      item = {
        marker,
        previous: null,
        heading: null,
        angle: 0,
        frame: null,
        lastTimestamp: 0,
        moving: false,
      };
      this.items.set(id, item);
    }
    if (state.live && timestamp(bus.lastGpsUpdate) > item.lastTimestamp) {
      const motion = movement(item.previous, bus, now);
      if (motion.heading !== null) {
        const delta =
          ((((motion.heading - item.angle) % 360) + 540) % 360) - 180;
        item.angle += delta;
        item.heading = motion.heading;
      }
      item.moving = motion.moving;
      this.move(
        item,
        [bus.latitude, bus.longitude],
        motion.animate && !this.reduced.matches,
      );
      item.previous = { ...bus };
      item.lastTimestamp = timestamp(bus.lastGpsUpdate);
    }
    if (!state.live) {
      this.stop(item);
      if (item.target) item.marker.setLatLng(item.target);
      item.moving = false;
    }
    const element = item.marker.getElement();
    const body = element.querySelector(".bus-marker-body");
    body.classList.toggle("is-selected", id === selected);
    body.classList.toggle("is-stale", !state.live);
    body.classList.toggle("is-moving", state.live && item.moving);
    body.style.setProperty("--heading", item.angle + "deg");
    element.setAttribute(
      "aria-label",
      id +
        " · " +
        (state.live ? "Live location" : "Last known location — " + state.label),
    );
    element.setAttribute(
      "title",
      id + " · " + (state.live ? "Live location" : "Last known location"),
    );
    item.marker.setZIndexOffset(id === selected ? 1500 : 1000);
  }
  move(item, target, animate) {
    this.stop(item);
    item.target = target;
    if (!animate) {
      item.marker.setLatLng(target);
      return;
    }
    const start = item.marker.getLatLng(),
      started = performance.now();
    const tick = (time) => {
      const progress = Math.min(1, (time - started) / 900);
      // Interpolate only between observed fixes, then stop exactly at the received point.
      item.marker.setLatLng([
        start.lat + (target[0] - start.lat) * progress,
        start.lng + (target[1] - start.lng) * progress,
      ]);
      item.frame = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    item.frame = requestAnimationFrame(tick);
  }
  stop(item) {
    if (item.frame !== null) cancelAnimationFrame(item.frame);
    item.frame = null;
  }
  heading(id) {
    const item = this.items.get(id);
    return item?.moving ? item.heading : null;
  }
  focus(id) {
    const item = this.items.get(id);
    if (item)
      this.map.setView(item.marker.getLatLng(), 16, {
        animate: !this.reduced.matches,
      });
  }
  remove(id) {
    const item = this.items.get(id);
    if (!item) return;
    this.stop(item);
    item.marker.remove();
    this.items.delete(id);
  }
  destroy() {
    for (const id of this.items.keys()) this.remove(id);
  }
}
