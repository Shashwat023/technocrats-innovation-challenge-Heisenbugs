// frontend/src/features/geolocation/GeoTracker.tsx
// Browser-based geolocation tracking with safe zone breach & loitering detection.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSpacetime } from '../../components/SpacetimeProvider';
import { useSpacetimeTables } from '../../hooks/useSpacetimeTables';

interface Position {
  lat: number;
  lng: number;
  timestamp: number;
}

// Haversine distance in meters
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SAFE_ZONE_RADIUS = 100; // meters
const LOITER_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const LOITER_RADIUS = 15; // meters — if staying within 15m for 10 min

export default function GeoTracker() {
  const { conn, isConnected } = useSpacetime();
  const { safeZones, notifications } = useSpacetimeTables();

  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<Position | null>(null);
  const [positionHistory, setPositionHistory] = useState<Position[]>([]);
  const [safeZoneCenter, setSafeZoneCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [breachAlerted, setBreachAlerted] = useState(false);
  const [loiterAlerted, setLoiterAlerted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);

  // Load existing safe zone from SpacetimeDB
  useEffect(() => {
    if (safeZones.length > 0) {
      const zone = safeZones[0];
      setSafeZoneCenter({ lat: zone.centerLat, lng: zone.centerLng });
    }
  }, [safeZones]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setTracking(true);
    setBreachAlerted(false);
    setLoiterAlerted(false);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos: Position = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: Date.now(),
        };
        setCurrentPos(newPos);
        setPositionHistory(prev => [...prev.slice(-60), newPos]); // Keep last 60 readings
      },
      (err) => {
        setError(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }, []);

  const handleSetSafeZone = () => {
    if (!currentPos || !conn || !isConnected) {
      alert("Need active position and DB connection to set safe zone.");
      return;
    }
    try {
      conn.reducers.setSafeZone({
        centerLat: currentPos.lat,
        centerLng: currentPos.lng,
        radiusMeters: SAFE_ZONE_RADIUS,
        label: "Home Safe Zone",
      });
      setSafeZoneCenter({ lat: currentPos.lat, lng: currentPos.lng });
      setBreachAlerted(false);
      alert("✅ Safe zone set at current location (100m radius)!");
    } catch (err) {
      console.error("Failed to set safe zone:", err);
    }
  };

  // ── Breach Detection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentPos || !safeZoneCenter || !conn || breachAlerted) return;

    const dist = distanceMeters(currentPos.lat, currentPos.lng, safeZoneCenter.lat, safeZoneCenter.lng);
    if (dist > SAFE_ZONE_RADIUS) {
      setBreachAlerted(true);
      try {
        conn.reducers.triggerSafeZoneAlert({
          lastLat: currentPos.lat,
          lastLng: currentPos.lng,
        });
        console.log("🚨 Safe zone breach detected! Alert sent.");
      } catch (err) {
        console.error("Failed to send breach alert:", err);
      }
    }
  }, [currentPos, safeZoneCenter, conn, breachAlerted]);

  // ── Loitering Detection ───────────────────────────────────────────────
  useEffect(() => {
    if (positionHistory.length < 5 || !conn || loiterAlerted) return;

    const now = Date.now();
    const recentPositions = positionHistory.filter(p => now - p.timestamp < LOITER_THRESHOLD_MS);
    
    if (recentPositions.length < 3) return;

    // Check if all recent positions are within LOITER_RADIUS of the oldest one
    const anchor = recentPositions[0];
    const timeDelta = now - anchor.timestamp;
    const allWithinRadius = recentPositions.every(p => 
      distanceMeters(p.lat, p.lng, anchor.lat, anchor.lng) < LOITER_RADIUS
    );

    if (allWithinRadius && timeDelta >= LOITER_THRESHOLD_MS) {
      setLoiterAlerted(true);
      try {
        // We use triggerSafeZoneAlert with a different message via notification
        conn.reducers.triggerSafeZoneAlert({
          lastLat: anchor.lat,
          lastLng: anchor.lng,
        });
        console.log("⚠️ Loitering detected! Alert sent.");
      } catch (err) {
        console.error("Failed to send loiter alert:", err);
      }
    }
  }, [positionHistory, conn, loiterAlerted]);

  // Calculate distance from safe zone
  const distFromZone = currentPos && safeZoneCenter
    ? Math.round(distanceMeters(currentPos.lat, currentPos.lng, safeZoneCenter.lat, safeZoneCenter.lng))
    : null;

  const isInsideZone = distFromZone !== null && distFromZone <= SAFE_ZONE_RADIUS;

  // Recent alerts (safe_zone_breach notifications)
  const recentAlerts = notifications
    .filter(n => n.type === 'safe_zone_breach')
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, 10);

  const S: Record<string, React.CSSProperties> = {
    root: { background: "#0d0d14", minHeight: "100vh", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif", padding: "100px 32px 32px" },
    header: { marginBottom: 32 },
    title: { fontSize: 24, fontWeight: 700, color: "#a78bfa" },
    subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
    card: { background: "#13131f", border: "1px solid #1e1e30", borderRadius: 12, padding: 24, marginBottom: 16 },
    cardTitle: { fontSize: 13, fontWeight: 600, color: "#64748b", letterSpacing: ".08em", marginBottom: 16, textTransform: "uppercase" as const },
    btn: { padding: "12px 24px", borderRadius: 10, border: "1px solid #2d2d44", fontSize: 14, fontWeight: 600, cursor: "pointer" },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 },
    statCard: { background: "#1a1a2e", borderRadius: 10, padding: 20, textAlign: 'center' as const },
    statValue: { fontSize: 28, fontWeight: 700, color: '#e2e8f0' },
    statLabel: { fontSize: 11, color: '#64748b', marginTop: 4, textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '.05em' },
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.title}>📍 Geolocation Tracker</div>
        <div style={S.subtitle}>
          Safe zone monitoring & loitering detection · <span style={{ color: isConnected ? '#10b981' : '#f59e0b' }}>{isConnected ? '🟢 Live' : '⏳ Connecting...'}</span>
        </div>
      </div>

      {error && (
        <div style={{ ...S.card, borderLeft: '4px solid #ef4444', color: '#f87171' }}>
          ❌ {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {!tracking ? (
          <button style={{ ...S.btn, background: '#4c1d95', color: '#ddd6fe', borderColor: '#7c3aed' }} onClick={startTracking}>
            ▶ Start Tracking
          </button>
        ) : (
          <button style={{ ...S.btn, background: '#7f1d1d', color: '#fca5a5', borderColor: '#ef4444' }} onClick={stopTracking}>
            ⏹ Stop Tracking
          </button>
        )}
        <button 
          style={{ ...S.btn, background: '#1a1a2e', color: '#94a3b8' }} 
          onClick={handleSetSafeZone}
          disabled={!currentPos}
        >
          📌 Set Current Location as Safe Zone
        </button>
      </div>

      {/* Status Grid */}
      <div style={S.statGrid}>
        <div style={S.statCard}>
          <div style={{ ...S.statValue, color: tracking ? '#10b981' : '#64748b' }}>
            {tracking ? '🔴 LIVE' : 'OFF'}
          </div>
          <div style={S.statLabel}>Tracking Status</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statValue, color: distFromZone !== null ? (isInsideZone ? '#10b981' : '#ef4444') : '#64748b' }}>
            {distFromZone !== null ? `${distFromZone}m` : '—'}
          </div>
          <div style={S.statLabel}>Distance from Safe Zone</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statValue, color: isInsideZone ? '#10b981' : distFromZone !== null ? '#ef4444' : '#64748b' }}>
            {distFromZone !== null ? (isInsideZone ? '✓ SAFE' : '⚠ OUTSIDE') : '—'}
          </div>
          <div style={S.statLabel}>Zone Status</div>
        </div>
      </div>

      {/* Visual Safe Zone Indicator */}
      {safeZoneCenter && currentPos && (
        <div style={S.card}>
          <div style={S.cardTitle}>Safe Zone Visualization</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260, position: 'relative' }}>
            {/* Circle representing safe zone */}
            <div style={{
              width: 200, height: 200, borderRadius: '50%',
              border: `3px dashed ${isInsideZone ? '#10b981' : '#ef4444'}`,
              background: isInsideZone ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              transition: 'all 0.5s',
            }}>
              {/* Center marker */}
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: '#94a3b8', border: '2px solid #475569',
                position: 'absolute',
              }} />

              {/* Current position dot */}
              <motion.div
                animate={{
                  x: Math.min(80, Math.max(-80, (currentPos.lng - safeZoneCenter.lng) * 100000)),
                  y: Math.min(80, Math.max(-80, -(currentPos.lat - safeZoneCenter.lat) * 100000)),
                }}
                transition={{ type: 'spring', damping: 20 }}
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: isInsideZone ? '#10b981' : '#ef4444',
                  boxShadow: `0 0 20px ${isInsideZone ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'}`,
                  position: 'absolute',
                }}
              />

              <div style={{ position: 'absolute', bottom: -30, fontSize: 11, color: '#64748b' }}>
                {SAFE_ZONE_RADIUS}m radius
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
            📍 {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)} · Updated {new Date(currentPos.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      <div style={S.card}>
        <div style={S.cardTitle}>Recent Location Alerts ({recentAlerts.length})</div>
        {recentAlerts.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 14 }}>No alerts yet. Alerts appear when the safe zone is breached or loitering is detected.</div>
        ) : (
          recentAlerts.map((alert, i) => (
            <motion.div
              key={alert.notificationId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                padding: 12, marginBottom: 8, borderRadius: 8,
                background: '#1a1a2e', borderLeft: '3px solid #ef4444',
              }}
            >
              <div style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>🚨 {alert.message}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {new Date(Number(alert.createdAt)).toLocaleString()}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
