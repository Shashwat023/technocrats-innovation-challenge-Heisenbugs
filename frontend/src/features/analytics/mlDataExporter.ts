// frontend/src/features/analytics/mlDataExporter.ts
// ML Pipeline: Transforms SpacetimeDB quiz logs → structured JSON payload → POST to ML API.
// ML API endpoint is configurable via VITE_ML_API_URL env variable.

import type { QuizLog } from '../../spacetime-sdk/types';

export interface MLPayloadData {
  day_index: number;
  date: string;
  quiz_accuracy: number | null;    // 0.0 to 1.0
  quiz_speed_sec: number | null;   // estimated response time
  quiz_composite: number | null;   // weighted composite 0-100
  activity_flag: number;           // 0 or 1
}

export interface MLPipelineOutput {
  patient_id: string;
  window_size: number;
  generated_at: string;
  data: MLPayloadData[];
}

/**
 * Transforms quiz log arrays into the ML model's expected payload format.
 * Accepts data directly — no global table access needed.
 */
export function generateMLPayload(
  patientId: string,
  quizLogs: QuizLog[],
  windowDays: number = 30
): MLPipelineOutput {
  const payload: MLPipelineOutput = {
    patient_id: patientId,
    window_size: windowDays,
    generated_at: new Date().toISOString(),
    data: []
  };

  const patientLogs = quizLogs.filter(q => q.patientId === patientId);

  for (let i = 0; i < windowDays; i++) {
    const historicalDate = new Date();
    historicalDate.setDate(historicalDate.getDate() - (windowDays - i - 1));
    const targetDateString = historicalDate.toISOString().split("T")[0];

    // Find quiz on this specific day
    const dailyQuiz = patientLogs.find(q => {
      const qDateStr = new Date(Number(q.createdAt)).toISOString().split("T")[0];
      return qDateStr === targetDateString;
    });

    let quizAccuracy = null;
    let quizSpeedSec = null;
    let quizComposite = null;

    if (dailyQuiz) {
      quizAccuracy = dailyQuiz.accuracyScore ? parseFloat((dailyQuiz.accuracyScore / 100).toFixed(3)) : null;
      quizSpeedSec = dailyQuiz.speedScore ? parseFloat((((100 - dailyQuiz.speedScore) / 100) * 8 + 4).toFixed(1)) : null;
      quizComposite = dailyQuiz.averageScore ? Math.round(dailyQuiz.averageScore) : null;
    }

    payload.data.push({
      day_index: i + 1,
      date: targetDateString,
      quiz_accuracy: quizAccuracy,
      quiz_speed_sec: quizSpeedSec,
      quiz_composite: quizComposite,
      activity_flag: dailyQuiz ? 1 : 0,
    });
  }

  return payload;
}

/**
 * Sends the ML payload to the configured API endpoint.
 * Returns the API response or null on failure.
 */
export async function sendToMLAPI(payload: MLPipelineOutput): Promise<any> {
  const mlApiUrl = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";
  const endpoint = `${mlApiUrl}/analyze`;

  console.log(`[ML Pipeline] Sending ${payload.data.length}-day payload to ${endpoint}...`);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      console.error(`[ML Pipeline] API returned ${resp.status}: ${resp.statusText}`);
      return null;
    }

    const result = await resp.json();
    console.log("[ML Pipeline] Response:", result);
    return result;
  } catch (err) {
    console.error("[ML Pipeline] Failed to reach ML API:", err);
    return null;
  }
}
