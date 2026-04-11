// frontend/src/hooks/useLiveDetection.ts
import { useEffect, useState } from "react";
import { useSpacetime } from "../components/SpacetimeProvider";
import type { LiveDetection } from "../spacetime-sdk/types";

/**
 * Hook to provide reactive access to the latest ML live detection for a given session.
 * 
 * FALLBACK LOGIC: The bridge service may use a hardcoded session ID (e.g. "session_alpha_1")
 * that doesn't match the frontend's dynamic session IDs ("session_<timestamp>").
 * When no exact match is found, we fall back to the most recently updated detection row
 * to ensure the FaceDisplay registration UI still appears for new persons.
 */
export function useLiveDetection(sessionId: string | null): LiveDetection | null {
  const { conn, isConnected } = useSpacetime();
  const [detection, setDetection] = useState<LiveDetection | null>(null);

  useEffect(() => {
    if (!conn || !isConnected) return;

    if (!sessionId) {
      setDetection(null);
      return;
    }

    // Attempt to load existing detection for the session
    try {
      const allDetections = [...conn.db.liveDetection.iter()];
      // First try exact match
      let match = allDetections.find(d => d.sessionId === sessionId);
      // Fallback: if no exact match, use the most recently updated detection
      // (handles bridge using hardcoded session IDs like "session_alpha_1")
      if (!match && allDetections.length > 0) {
        match = allDetections.reduce((latest, d) =>
          Number(d.updatedAt) > Number(latest.updatedAt) ? d : latest
        );
      }
      setDetection(match ?? null);
    } catch (e) {
      console.warn("[useLiveDetection] error reading initial state:", e);
    }

    // Event handlers — listen to ALL inserts/updates, not just matching session
    const onInsert = (_ctx: any, row: LiveDetection) => {
      if (row.sessionId === sessionId) {
        setDetection(row);
      } else {
        // Fallback: accept any detection when we have none
        setDetection(prev => prev ? prev : row);
      }
    };

    const onUpdate = (_ctx: any, _old: LiveDetection, newRow: LiveDetection) => {
      if (newRow.sessionId === sessionId) {
        setDetection(newRow);
      } else {
        // Fallback: always accept the latest update
        setDetection(prev => {
          if (!prev) return newRow;
          // Prefer exact session match, otherwise take the latest
          if (prev.sessionId === sessionId) return prev;
          return Number(newRow.updatedAt) > Number(prev.updatedAt) ? newRow : prev;
        });
      }
    };

    conn.db.liveDetection.onInsert(onInsert);
    conn.db.liveDetection.onUpdate(onUpdate);

  }, [conn, isConnected, sessionId]);

  return detection;
}
