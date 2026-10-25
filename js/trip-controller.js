import {
  gpsFix,
  WRITE_INTERVAL_MS,
  HEARTBEAT_INTERVAL_MS,
} from "./tracking.js";
import { tripErrorMessage } from "./errors.js";

// Browser GPS lifecycle is isolated from Firebase so cancellation and failures can be tested.
export class TripController {
  constructor({
    backend,
    geolocation,
    onChange,
    now = Date.now,
    offset = () => 0,
  }) {
    Object.assign(this, { backend, geolocation, onChange, now, offset });
    this.connected = false;
    this.active = false;
    this.starting = false;
    this.ending = false;
    this.sessionId = null;
    this.watch = null;
    this.timer = null;
    this.epoch = 0;
    this.lastWrite = 0;
    this.writing = false;
    this.beating = false;
    this.destroyed = false;
    this.state = {
      phase: "idle",
      message: "Ready when you are. Start a trip to share this bus’s location.",
      lastSuccess: null,
      accuracy: null,
      startedAt: null,
    };
  }
  emit(patch) {
    Object.assign(this.state, patch);
    if (!this.destroyed) this.onChange({ ...this.state });
  }
  connection(value) {
    this.connected = value;
    if (!value && (this.active || this.starting)) {
      this.stopLocal();
      this.epoch++;
      this.emit({
        phase: "paused",
        message:
          "Connection lost. Location sharing has stopped. Reconnect to finish this trip before starting again.",
      });
    }
    if (value && this.sessionId && !this.active && !this.starting)
      this.finish().catch(() => {});
  }
  async start(routeId) {
    if (this.destroyed) return;
    if (this.active || this.starting || this.ending || this.sessionId) return;
    if (!this.connected)
      throw new Error(
        "Connect to the tracking service before starting a trip.",
      );
    if (!this.geolocation)
      throw new Error("Location sharing is not supported by this browser.");
    this.starting = true;
    const epoch = ++this.epoch,
      sessionId = crypto.randomUUID();
    this.sessionId = sessionId;
    this.emit({
      phase: "starting",
      message: "Preparing your trip…",
      lastSuccess: null,
      lastGpsUpdate: null,
      accuracy: null,
      startedAt: null,
    });
    let claimed = false;
    try {
      await this.backend.claim(sessionId, routeId);
      claimed = true;
      if (epoch !== this.epoch || !this.connected) {
        await this.finish();
        return;
      }
      await this.backend.arm(sessionId);
      if (epoch !== this.epoch || !this.connected) {
        await this.finish();
        return;
      }
      this.active = true;
      this.lastWrite = 0;
      this.emit({
        phase: "locating",
        message:
          "Allow location access. Waiting for a fresh, accurate GPS fix…",
        startedAt: this.now(),
      });
      this.watch = this.geolocation.watchPosition(
        (position) => this.position(position, epoch),
        (error) => this.gpsError(error, epoch),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
      this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    } catch (error) {
      this.stopLocal();
      // Keep ownership for retry if setup succeeded but offline cleanup cannot be confirmed.
      if (!claimed) this.sessionId = null;
      else if (this.connected) {
        try {
          await this.backend.end(sessionId);
          this.sessionId = null;
        } catch {
          /* retry using End trip */
        }
      }
      this.emit({
        phase: "error",
        message: this.sessionId
          ? "Trip setup was interrupted. GPS is stopped. Reconnect and use End trip to confirm cleanup."
          : tripErrorMessage(
              error,
              error.message || "The trip could not start. Please try again.",
            ),
      });
    } finally {
      this.starting = false;
    }
  }
  async position(position, epoch) {
    if (!this.active || !this.connected || epoch !== this.epoch) return;
    const fix = gpsFix(position, this.now(), this.offset());
    if (!fix) {
      this.emit({
        phase: "weak",
        message:
          "Waiting for a recent GPS fix within 100 metres. Move to an open area if it is safe.",
        accuracy: position?.coords?.accuracy ?? null,
      });
      return;
    }
    if (this.writing || this.now() - this.lastWrite < WRITE_INTERVAL_MS) return;
    this.writing = true;
    this.lastWrite = this.now();
    try {
      await this.backend.write(this.sessionId, fix);
      if (epoch === this.epoch && this.active)
        this.emit({
          phase: "sharing",
          message: "Location sharing is active. Keep this page open.",
          lastSuccess: this.now(),
          lastGpsUpdate: fix.lastGpsUpdate,
          accuracy: fix.accuracy,
        });
    } catch (error) {
      if (epoch === this.epoch) {
        this.stopLocal();
        this.emit({
          phase: "error",
          message: tripErrorMessage(
            error,
            "The location update was not accepted. Sharing stopped. End this trip, then check your connection and bus assignment.",
          ),
        });
      }
    } finally {
      this.writing = false;
    }
  }
  async heartbeat() {
    if (!this.active || !this.connected || this.beating) return;
    this.beating = true;
    const epoch = this.epoch;
    try {
      await this.backend.heartbeat(this.sessionId);
    } catch (error) {
      if (this.active && epoch === this.epoch) {
        this.stopLocal();
        this.emit({
          phase: "error",
          message: tripErrorMessage(
            error,
            "Connection check failed. Sharing stopped. End this trip and reconnect.",
          ),
        });
      }
    } finally {
      this.beating = false;
    }
  }
  gpsError(error, epoch = this.epoch) {
    if (!this.active || epoch !== this.epoch) return;
    if (error.code === 1) {
      this.stopLocal();
      this.epoch++;
      this.emit({
        phase: "denied",
        message:
          "Location permission was denied. Enable location access in browser settings before starting another trip.",
      });
      this.finish(true).catch(() => {});
    } else
      this.emit({
        phase: "locating",
        message:
          error.code === 3
            ? "GPS timed out. Waiting for a new fix; old locations will not remain live."
            : "Location is temporarily unavailable. Check your device’s location settings.",
      });
  }
  stopLocal() {
    this.active = false;
    if (this.watch !== null) this.geolocation?.clearWatch(this.watch);
    if (this.timer !== null) clearInterval(this.timer);
    this.watch = null;
    this.timer = null;
  }
  async stop() {
    this.stopLocal();
    this.epoch++;
    if (this.starting) {
      this.emit({ phase: "ending", message: "Cancelling trip setup…" });
      return;
    }
    return this.finish();
  }
  async finish(preserveMessage = false) {
    if (!this.sessionId || this.ending) return;
    if (!this.connected) {
      this.emit({
        phase: "paused",
        message:
          "GPS sharing has stopped on this device. Reconnect to confirm the trip has ended.",
      });
      return;
    }
    this.ending = true;
    const sessionId = this.sessionId;
    if (!preserveMessage)
      this.emit({ phase: "ending", message: "Ending trip…" });
    try {
      await this.backend.end(sessionId);
      if (this.sessionId === sessionId) this.sessionId = null;
      this.emit({
        phase: preserveMessage ? "denied" : "ended",
        ...(preserveMessage
          ? {}
          : {
              message:
                "Trip ended. This device is no longer sharing its location.",
            }),
      });
    } catch {
      this.emit({
        phase: "error",
        message:
          "Location sharing stopped locally, but the trip end is not confirmed. Reconnect and retry End trip.",
      });
    } finally {
      this.ending = false;
    }
  }
  destroy() {
    this.destroyed = true;
    this.stopLocal();
    this.epoch++;
  }
}
