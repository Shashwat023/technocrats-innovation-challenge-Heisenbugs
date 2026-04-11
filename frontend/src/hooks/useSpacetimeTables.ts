// frontend/src/hooks/useSpacetimeTables.ts
// Reactive hook — returns live table data from SpacetimeDB.
// Automatically re-renders on any insert / delete / update.
//
// USAGE (in any component):
//   const { knownPersons, meetingSummaries, notifications } = useSpacetimeTables();
//
// All arrays are [] until the SpacetimeDB subscription syncs (isConnected).

import { useEffect, useState } from "react";
import { useSpacetime } from "../components/SpacetimeProvider";
import type {
  KnownPerson,
  MeetingSummary,
  Notification,
  MeetingLog,
  QuizLog,
  Medication,
  SafeZone,
} from "../spacetime-sdk/types";

export interface SpacetimeTablesResult {
  knownPersons:     KnownPerson[];
  meetingSummaries: MeetingSummary[];
  meetingLogs:      MeetingLog[];
  quizLog:          QuizLog[];
  medications:      Medication[];
  safeZones:        SafeZone[];
  notifications:    Notification[];
  /** True once initial table sync is complete */
  synced: boolean;
}

export function useSpacetimeTables(): SpacetimeTablesResult {
  const { conn, isConnected } = useSpacetime();

  const [knownPersons,     setKnownPersons]     = useState<KnownPerson[]>([]);
  const [meetingSummaries, setMeetingSummaries] = useState<MeetingSummary[]>([]);
  const [meetingLogs,      setMeetingLogs]      = useState<MeetingLog[]>([]);
  const [quizLog,          setQuizLog]          = useState<QuizLog[]>([]);
  const [medications,      setMedications]      = useState<Medication[]>([]);
  const [safeZones,        setSafeZones]        = useState<SafeZone[]>([]);
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  const [synced,           setSynced]           = useState(false);

  useEffect(() => {
    if (!conn || !isConnected) return;

    // ── Load initial state from cached subscription ────────────────────────
    const loadAll = () => {
      try {
        setKnownPersons([...conn.db.knownPerson.iter()]);
        setMeetingSummaries([...conn.db.meetingSummary.iter()]);
        setMeetingLogs([...conn.db.meetingLog.iter()]);
        setNotifications([...conn.db.notification.iter()]);

        // Tables added by feature work — use `as any` to avoid SDK type gaps
        const db = conn.db as any;
        const qLogs = db.quizLog ? [...db.quizLog.iter()] : [];
        const meds  = db.medication ? [...db.medication.iter()] : [];
        const zones = db.safeZone ? [...db.safeZone.iter()] : [];
        console.log("📊 SpacetimeDB sync — quizLogs:", qLogs.length, "meds:", meds.length, "zones:", zones.length);
        setQuizLog(qLogs);
        setMedications(meds);
        setSafeZones(zones);

        setSynced(true);
      } catch (e) {
        console.warn("[useSpacetimeTables] initial load error:", e);
      }
    };

    loadAll();

    // ── KnownPerson ───────────────────────────────────────────────────────
    conn.db.knownPerson.onInsert((_ctx: any, row: KnownPerson) => {
      setKnownPersons((prev) => {
        const exists = prev.some((p) => p.personId === row.personId);
        return exists ? prev : [...prev, row];
      });
    });
    conn.db.knownPerson.onUpdate((_ctx: any, _old: KnownPerson, newRow: KnownPerson) => {
      setKnownPersons((prev) =>
        prev.map((p) => (p.personId === newRow.personId ? newRow : p))
      );
    });
    conn.db.knownPerson.onDelete((_ctx: any, row: KnownPerson) => {
      setKnownPersons((prev) => prev.filter((p) => p.personId !== row.personId));
    });

    // ── MeetingSummary ────────────────────────────────────────────────────
    conn.db.meetingSummary.onInsert((_ctx: any, row: MeetingSummary) => {
      setMeetingSummaries((prev) => {
        const exists = prev.some((s) => s.sessionId === row.sessionId);
        return exists ? prev : [...prev, row];
      });
    });
    conn.db.meetingSummary.onDelete((_ctx: any, row: MeetingSummary) => {
      setMeetingSummaries((prev) => prev.filter((s) => s.sessionId !== row.sessionId));
    });

    // ── MeetingLog ────────────────────────────────────────────────────────
    conn.db.meetingLog.onInsert((_ctx: any, row: MeetingLog) => {
      setMeetingLogs((prev) => {
        const exists = prev.some((l) => l.sessionId === row.sessionId);
        return exists ? prev : [...prev, row];
      });
    });
    conn.db.meetingLog.onUpdate((_ctx: any, _old: MeetingLog, newRow: MeetingLog) => {
      setMeetingLogs((prev) =>
        prev.map((l) => (l.sessionId === newRow.sessionId ? newRow : l))
      );
    });
    conn.db.meetingLog.onDelete((_ctx: any, row: MeetingLog) => {
      setMeetingLogs((prev) => prev.filter((l) => l.sessionId !== row.sessionId));
    });

    // ── Notification ──────────────────────────────────────────────────────
    conn.db.notification.onInsert((_ctx: any, row: Notification) => {
      setNotifications((prev) => {
        const exists = prev.some((n) => n.notificationId === row.notificationId);
        return exists ? prev : [...prev, row];
      });
    });
    conn.db.notification.onUpdate((_ctx: any, _old: Notification, newRow: Notification) => {
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === newRow.notificationId ? newRow : n))
      );
    });
    conn.db.notification.onDelete((_ctx: any, row: Notification) => {
      setNotifications((prev) =>
        prev.filter((n) => n.notificationId !== row.notificationId)
      );
    });

    // ── QuizLog ────────────────────────────────────────────────────────────
    const db = conn.db as any;
    if (db.quizLog) {
      db.quizLog.onInsert((_ctx: any, row: QuizLog) => {
        console.log("📈 New Quiz Log:", row.quizSessionId);
        setQuizLog((prev) => {
          const exists = prev.some((l) => l.quizSessionId === row.quizSessionId);
          return exists ? prev : [...prev, row];
        });
      });
    }

    // ── Medication ─────────────────────────────────────────────────────────
    if (db.medication) {
      db.medication.onInsert((_ctx: any, row: Medication) => {
        setMedications((prev) => {
          const exists = prev.some((m) => m.medicationId === row.medicationId);
          return exists ? prev : [...prev, row];
        });
      });
      db.medication.onUpdate((_ctx: any, _old: Medication, newRow: Medication) => {
        setMedications((prev) =>
          prev.map((m) => (m.medicationId === newRow.medicationId ? newRow : m))
        );
      });
      db.medication.onDelete((_ctx: any, row: Medication) => {
        setMedications((prev) => prev.filter((m) => m.medicationId !== row.medicationId));
      });
    }

    // ── SafeZone ───────────────────────────────────────────────────────────
    if (db.safeZone) {
      db.safeZone.onInsert((_ctx: any, row: SafeZone) => {
        setSafeZones((prev) => {
          const exists = prev.some((z) => z.zoneId === row.zoneId);
          return exists ? prev : [...prev, row];
        });
      });
      db.safeZone.onUpdate((_ctx: any, _old: SafeZone, newRow: SafeZone) => {
        setSafeZones((prev) =>
          prev.map((z) => (z.zoneId === newRow.zoneId ? newRow : z))
        );
      });
    }

  }, [conn, isConnected]);

  return { knownPersons, meetingSummaries, meetingLogs, quizLog, medications, safeZones, notifications, synced };
}
