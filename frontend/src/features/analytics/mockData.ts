// frontend/src/features/analytics/mockData.ts
// Only visual-fallback generators that aren't yet driven by SpacetimeDB live data.
// Quiz and Medication data are FULLY LIVE from SpacetimeDB — no mock generators.

export const PATIENT_ID = "patient_001"

// Heatmap: hour × day-of-week → agitation frequency
// Used until real behaviour events flow from call analysis
export function generateAgitationHeatmap() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const data = []
  
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const isEvening = h >= 16 && h <= 21
      const isNight = h >= 22 || h <= 5
      
      const base = isEvening ? 0.7 : isNight ? 0.15 : 0.1
      const value = base + Math.random() * 0.3
      data.push({
        day: days[d],
        hour: h,
        value: parseFloat(value.toFixed(2)),
        label: `${days[d]} ${h}:00`
      })
    }
  }
  return data
}

// Conversation topic frequency — from call analysis
export function generateTopicData() {
  return [
    { topic: "Family", count: 34, sentiment: 0.72 },
    { topic: "Past memories", count: 28, sentiment: 0.65 },
    { topic: "Health", count: 21, sentiment: 0.18 },
    { topic: "Food", count: 18, sentiment: 0.58 },
    { topic: "Current events", count: 9, sentiment: 0.12 },
    { topic: "Confusion", count: 7, sentiment: -0.42 },
    { topic: "Location", count: 6, sentiment: -0.18 },
  ]
}

// Sentiment from calls — fallback until real sentiment_log data flows
export function generateSentimentData(days = 30) {
  const data = []
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - (days - i))
    const hour = 14 + Math.floor(Math.random() * 6)
    const isEvening = hour >= 17
    const baseScore = isEvening ? -0.2 : 0.3
    const score = baseScore + (Math.random() - 0.5) * 0.4

    data.push({
      date: date.toISOString().split("T")[0],
      sentiment_score: parseFloat(score.toFixed(2)),
      dominant_emotion: score > 0.2 ? "happy" : score > 0 ? "calm" : score > -0.2 ? "anxious" : "confused",
      hour,
    })
  }
  return data
}
