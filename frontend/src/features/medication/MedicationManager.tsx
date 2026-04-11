// frontend/src/features/medication/MedicationManager.tsx
// Full medication scheduling, tracking, and mark-as-taken functionality.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpacetime } from '../../components/SpacetimeProvider';
import { useSpacetimeTables } from '../../hooks/useSpacetimeTables';

export default function MedicationManager() {
  const { conn, isConnected } = useSpacetime();
  const { medications } = useSpacetimeTables();

  const [showForm, setShowForm] = useState(false);
  const [medicineName, setMedicineName] = useState('');
  const [dose, setDose] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const handleAddMedication = () => {
    if (!conn || !isConnected) {
      alert("SpacetimeDB not connected!");
      return;
    }
    if (!medicineName || !dose || !scheduleDate || !scheduleTime) {
      alert("Please fill in all fields.");
      return;
    }

    const dateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    const triggerTimeMs = BigInt(dateTime.getTime());
    const medId = `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      conn.reducers.addMedication({
        medicationId: medId,
        medicineName,
        dose,
        triggerTime: triggerTimeMs,
      });
      setMedicineName('');
      setDose('');
      setScheduleDate('');
      setScheduleTime('');
      setShowForm(false);
    } catch (err) {
      console.error("Failed to add medication:", err);
      alert("Error adding medication. Check console.");
    }
  };

  const handleMarkTaken = (medicationId: string) => {
    if (!conn) return;
    try {
      conn.reducers.markMedicationTaken({ medicationId });
    } catch (err) {
      console.error("Failed to mark taken:", err);
    }
  };

  const handleRemove = (medicationId: string) => {
    if (!conn) return;
    try {
      conn.reducers.removeMedication({ medicationId });
    } catch (err) {
      console.error("Failed to remove:", err);
    }
  };

  const sortedMeds = [...medications].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

  const statusColor = (s: string) => {
    if (s === 'taken') return { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#34d399' };
    if (s === 'alerting') return { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fbbf24' };
    if (s === 'missed') return { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#f87171' };
    return { bg: 'rgba(100,116,139,0.1)', border: '#475569', text: '#94a3b8' };
  };

  const S: Record<string, React.CSSProperties> = {
    root: { background: "#0d0d14", minHeight: "100vh", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif", padding: "100px 32px 32px" },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
    title: { fontSize: 24, fontWeight: 700, color: "#a78bfa" },
    subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
    addBtn: { padding: "12px 24px", borderRadius: 10, background: "#4c1d95", color: "#ddd6fe", border: "1px solid #7c3aed", fontSize: 14, fontWeight: 600, cursor: "pointer" },
    form: { background: "#13131f", border: "1px solid #1e1e30", borderRadius: 16, padding: 32, marginBottom: 32 },
    inputGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 20 },
    label: { fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '.05em' },
    input: { padding: "12px 16px", borderRadius: 8, background: "#1a1a2e", border: "1px solid #2d2d44", color: "#e2e8f0", fontSize: 15, outline: 'none' },
    card: { background: "#13131f", border: "1px solid #1e1e30", borderRadius: 12, padding: "20px 24px", marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    smallBtn: { padding: "8px 16px", borderRadius: 8, border: "1px solid #2d2d44", background: "transparent", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <div style={S.title}>💊 Medication Manager</div>
          <div style={S.subtitle}>Schedule, track, and manage daily medications · <span style={{ color: isConnected ? '#10b981' : '#f59e0b' }}>{isConnected ? '🟢 Live' : '⏳ Connecting...'}</span></div>
        </div>
        <button style={S.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Medication'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            style={S.form}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={S.inputGroup}>
                <label style={S.label}>Medicine Name</label>
                <input style={S.input} placeholder="e.g. Donepezil" value={medicineName} onChange={e => setMedicineName(e.target.value)} />
              </div>
              <div style={S.inputGroup}>
                <label style={S.label}>Dose</label>
                <input style={S.input} placeholder="e.g. 10mg" value={dose} onChange={e => setDose(e.target.value)} />
              </div>
              <div style={S.inputGroup}>
                <label style={S.label}>Scheduled Date</label>
                <input style={S.input} type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
              </div>
              <div style={S.inputGroup}>
                <label style={S.label}>Scheduled Time</label>
                <input style={S.input} type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
              </div>
            </div>
            <button 
              style={{ ...S.addBtn, width: '100%', marginTop: 12 }}
              onClick={handleAddMedication}
            >
              Schedule Medication
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Medication List */}
      <div style={{ marginTop: 8 }}>
        {sortedMeds.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💊</div>
            <div style={{ fontSize: 16 }}>No medications scheduled yet.</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Click "Add Medication" to get started.</div>
          </div>
        )}

        <AnimatePresence>
          {sortedMeds.map((med, i) => {
            const sc = statusColor(med.status);
            const scheduledTime = new Date(Number(med.triggerTime));
            const isPast = scheduledTime.getTime() < Date.now();
            const showTakeBtn = med.status === 'pending' || med.status === 'alerting';

            return (
              <motion.div
                key={med.medicationId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  ...S.card,
                  borderLeft: `4px solid ${sc.border}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
                    {med.medicineName} <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>— {med.dose}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    📅 {scheduledTime.toLocaleDateString()} at {scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isPast && med.status === 'pending' && <span style={{ color: '#f59e0b', marginLeft: 8 }}>⚠ Overdue</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    padding: "5px 12px", borderRadius: 20,
                    background: sc.bg, color: sc.text,
                    fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                    border: `1px solid ${sc.border}`,
                  }}>
                    {med.status}
                  </span>
                  {showTakeBtn && (
                    <button 
                      style={{ ...S.smallBtn, background: '#064e3b', color: '#34d399', borderColor: '#10b981' }}
                      onClick={() => handleMarkTaken(med.medicationId)}
                    >
                      ✓ Mark Taken
                    </button>
                  )}
                  <button 
                    style={{ ...S.smallBtn, color: '#f87171', borderColor: '#7f1d1d' }}
                    onClick={() => handleRemove(med.medicationId)}
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
