// Made-up weather weeks, used by the rules tests (forecast.test.js) and for
// trying the rules out locally:  WEATHER_FIXTURE=hot npm run dev
// Real weather rarely produces a heatwave on the day you want to test one.
//
// Same shape as getWeek() in weather.js:
//   { days: [{ date, max, min, sunshineHours, daylightHours }] }

function week(daily) {
  // Seven days starting tomorrow, so weekday names look realistic
  return {
    days: daily.map((d, i) => {
      const date = new Date(Date.now() + (i + 1) * 86_400_000).toISOString().slice(0, 10)
      return { date, ...d }
    }),
  }
}

const calmDay = { max: 21, min: 12, sunshineHours: 5, daylightHours: 12 }

export const FIXTURES = {
  // Mild and sunny: no warnings at all
  calm: week(Array(7).fill(calmDay)),

  // A heatwave in the middle of the week
  hot: week([calmDay, { ...calmDay, max: 29 }, { ...calmDay, max: 34, min: 20 }, { ...calmDay, max: 31 }, calmDay, calmDay, calmDay]),

  // A frosty night or two
  cold: week([{ ...calmDay, max: 8, min: 4 }, { ...calmDay, max: 6, min: -1 }, ...Array(5).fill({ ...calmDay, max: 9, min: 6 })]),

  // Grey, short winter days
  dark: week(Array(7).fill({ max: 7, min: 6, sunshineHours: 0.8, daylightHours: 8.2 })),
}
