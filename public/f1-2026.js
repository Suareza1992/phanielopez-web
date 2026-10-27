// F1 2026 calendar — 23 rounds. Generated 2026-10-18 from the Jolpica F1 API (api.jolpi.ca/ergast),
// cross-checked against formula1.com + Wikipedia.
// Saudi Arabia was cancelled in March 2026; Bahrain was moved to Sepang (Malaysia) on Oct 2–4.
// Qatar and Abu Dhabi were still listed but flagged as uncertain at the time of writing.
// sessions: start times in UTC (fp1/fp2/fp3 = prácticas, sq = sprint qualifying, quali = clasificación).
// winner: most recent Grand Prix winner at that circuit (2026 if already raced, else 2025).
//   This file is the offline fallback: main.js fetches the live 2026 winners + session times from
//   the same API at runtime and overrides these values, so no hand edits are needed after a race.
window.F1_2026 = [
  {
    round: 1, name: 'GP de Australia', circuit: 'Albert Park', city: 'Melbourne', cc: 'AUS', start: '2026-03-06', end: '2026-03-08',
    sessions: { fp1: '2026-03-06T01:30Z', fp2: '2026-03-06T05:00Z', fp3: '2026-03-07T01:30Z', quali: '2026-03-07T05:00Z', race: '2026-03-08T04:00Z' },
    winner: { driver: 'George Russell', team: 'Mercedes', year: 2026 },
  },
  {
    round: 2, name: 'GP de China', circuit: 'Circuito Internacional de Shanghái', city: 'Shanghái', cc: 'CHN', start: '2026-03-13', end: '2026-03-15', sprint: true,
    sessions: { fp1: '2026-03-13T03:30Z', sq: '2026-03-13T07:30Z', sprint: '2026-03-14T03:00Z', quali: '2026-03-14T07:00Z', race: '2026-03-15T07:00Z' },
    winner: { driver: 'Kimi Antonelli', team: 'Mercedes', year: 2026 },
  },
  {
    round: 3, name: 'GP de Japón', circuit: 'Suzuka', city: 'Suzuka', cc: 'JPN', start: '2026-03-27', end: '2026-03-29',
    sessions: { fp1: '2026-03-27T02:30Z', fp2: '2026-03-27T06:00Z', fp3: '2026-03-28T02:30Z', quali: '2026-03-28T06:00Z', race: '2026-03-29T05:00Z' },
    winner: { driver: 'Kimi Antonelli', team: 'Mercedes', year: 2026 },
  },
  {
    round: 4, name: 'GP de Miami', circuit: 'Miami International Autodrome', city: 'Miami Gardens', cc: 'USA', start: '2026-05-01', end: '2026-05-03', sprint: true,
    sessions: { fp1: '2026-05-01T16:00Z', sq: '2026-05-01T20:30Z', sprint: '2026-05-02T16:00Z', quali: '2026-05-02T20:00Z', race: '2026-05-03T20:00Z' },
    winner: { driver: 'Kimi Antonelli', team: 'Mercedes', year: 2026 },
  },
  {
    round: 5, name: 'GP de Canadá', circuit: 'Circuit Gilles Villeneuve', city: 'Montreal', cc: 'CAN', start: '2026-05-22', end: '2026-05-24', sprint: true,
    sessions: { fp1: '2026-05-22T16:30Z', sq: '2026-05-22T20:30Z', sprint: '2026-05-23T16:00Z', quali: '2026-05-23T20:00Z', race: '2026-05-24T20:00Z' },
    winner: { driver: 'Kimi Antonelli', team: 'Mercedes', year: 2026 },
  },
  {
    round: 6, name: 'GP de Mónaco', circuit: 'Circuit de Monaco', city: 'Montecarlo', cc: 'MON', start: '2026-06-05', end: '2026-06-07',
    sessions: { fp1: '2026-06-05T11:30Z', fp2: '2026-06-05T15:00Z', fp3: '2026-06-06T10:30Z', quali: '2026-06-06T14:00Z', race: '2026-06-07T13:00Z' },
    winner: { driver: 'Kimi Antonelli', team: 'Mercedes', year: 2026 },
  },
  {
    round: 7, name: 'GP de Barcelona-Catalunya', circuit: 'Circuit de Barcelona-Catalunya', city: 'Montmeló', cc: 'ESP', start: '2026-06-12', end: '2026-06-14',
    sessions: { fp1: '2026-06-12T11:30Z', fp2: '2026-06-12T15:00Z', fp3: '2026-06-13T10:30Z', quali: '2026-06-13T14:00Z', race: '2026-06-14T13:00Z' },
    winner: { driver: 'Lewis Hamilton', team: 'Ferrari', year: 2026 },
  },
  {
    round: 8, name: 'GP de Austria', circuit: 'Red Bull Ring', city: 'Spielberg', cc: 'AUT', start: '2026-06-26', end: '2026-06-28',
    sessions: { fp1: '2026-06-26T11:30Z', fp2: '2026-06-26T15:00Z', fp3: '2026-06-27T10:30Z', quali: '2026-06-27T14:00Z', race: '2026-06-28T13:00Z' },
    winner: { driver: 'George Russell', team: 'Mercedes', year: 2026 },
  },
  {
    round: 9, name: 'GP de Gran Bretaña', circuit: 'Silverstone', city: 'Silverstone', cc: 'GBR', start: '2026-07-03', end: '2026-07-05', sprint: true,
    sessions: { fp1: '2026-07-03T11:30Z', sq: '2026-07-03T15:30Z', sprint: '2026-07-04T11:00Z', quali: '2026-07-04T15:00Z', race: '2026-07-05T14:00Z' },
    winner: { driver: 'Charles Leclerc', team: 'Ferrari', year: 2026 },
  },
  {
    round: 10, name: 'GP de Bélgica', circuit: 'Spa-Francorchamps', city: 'Stavelot', cc: 'BEL', start: '2026-07-17', end: '2026-07-19',
    sessions: { fp1: '2026-07-17T11:30Z', fp2: '2026-07-17T15:00Z', fp3: '2026-07-18T10:30Z', quali: '2026-07-18T14:00Z', race: '2026-07-19T13:00Z' },
    winner: { driver: 'Kimi Antonelli', team: 'Mercedes', year: 2026 },
  },
  {
    round: 11, name: 'GP de Hungría', circuit: 'Hungaroring', city: 'Budapest', cc: 'HUN', start: '2026-07-24', end: '2026-07-26',
    sessions: { fp1: '2026-07-24T11:30Z', fp2: '2026-07-24T15:00Z', fp3: '2026-07-25T10:30Z', quali: '2026-07-25T14:00Z', race: '2026-07-26T13:00Z' },
    winner: { driver: 'Lando Norris', team: 'McLaren', year: 2026 },
  },
  {
    round: 12, name: 'GP de los Países Bajos', circuit: 'Zandvoort', city: 'Zandvoort', cc: 'NED', start: '2026-08-21', end: '2026-08-23', sprint: true,
    sessions: { fp1: '2026-08-21T10:30Z', sq: '2026-08-21T14:30Z', sprint: '2026-08-22T10:00Z', quali: '2026-08-22T14:00Z', race: '2026-08-23T13:00Z' },
    winner: { driver: 'Lando Norris', team: 'McLaren', year: 2026 },
  },
  {
    round: 13, name: 'GP de Italia', circuit: 'Monza', city: 'Monza', cc: 'ITA', start: '2026-09-04', end: '2026-09-06',
    sessions: { fp1: '2026-09-04T10:30Z', fp2: '2026-09-04T14:00Z', fp3: '2026-09-05T10:30Z', quali: '2026-09-05T14:00Z', race: '2026-09-06T13:00Z' },
    winner: { driver: 'Kimi Antonelli', team: 'Mercedes', year: 2026 },
  },
  {
    round: 14, name: 'GP de España', circuit: 'Madring', city: 'Madrid', cc: 'ESP', start: '2026-09-11', end: '2026-09-13',
    sessions: { fp1: '2026-09-11T11:30Z', fp2: '2026-09-11T15:00Z', fp3: '2026-09-12T10:30Z', quali: '2026-09-12T14:00Z', race: '2026-09-13T13:00Z' },
    winner: { driver: 'Kimi Antonelli', team: 'Mercedes', year: 2026 },
  },
  {
    round: 15, name: 'GP de Azerbaiyán', circuit: 'Circuito Urbano de Bakú', city: 'Bakú', cc: 'AZE', start: '2026-09-24', end: '2026-09-26', saturday: true,
    sessions: { fp1: '2026-09-24T08:30Z', fp2: '2026-09-24T12:00Z', fp3: '2026-09-25T08:30Z', quali: '2026-09-25T12:00Z', race: '2026-09-26T11:00Z' },
    winner: { driver: 'George Russell', team: 'Mercedes', year: 2026 },
  },
  {
    round: 16, name: 'GP de Baréin (en Malasia)', circuit: 'Sepang International Circuit', city: 'Sepang', cc: 'MAS', start: '2026-10-02', end: '2026-10-04',
    sessions: { fp1: '2026-10-02T04:30Z', fp2: '2026-10-02T08:00Z', fp3: '2026-10-03T04:30Z', quali: '2026-10-03T08:00Z', race: '2026-10-04T07:00Z' },
    winner: { driver: 'Max Verstappen', team: 'Red Bull', year: 2026 },
  },
  {
    round: 17, name: 'GP de Singapur', circuit: 'Marina Bay', city: 'Singapur', cc: 'SGP', start: '2026-10-09', end: '2026-10-11', sprint: true,
    sessions: { fp1: '2026-10-09T08:30Z', sq: '2026-10-09T12:30Z', sprint: '2026-10-10T09:00Z', quali: '2026-10-10T13:00Z', race: '2026-10-11T12:00Z' },
    winner: { driver: 'Max Verstappen', team: 'Red Bull', year: 2026 },
  },
  {
    round: 18, name: 'GP de Estados Unidos', circuit: 'Circuit of the Americas', city: 'Austin, Texas', cc: 'USA', start: '2026-10-23', end: '2026-10-25',
    sessions: { fp1: '2026-10-23T17:30Z', fp2: '2026-10-23T21:00Z', fp3: '2026-10-24T17:30Z', quali: '2026-10-24T21:00Z', race: '2026-10-25T20:00Z' },
    winner: { driver: 'Max Verstappen', team: 'Red Bull', year: 2025 },
  },
  {
    round: 19, name: 'GP de la Ciudad de México', circuit: 'Autódromo Hermanos Rodríguez', city: 'Ciudad de México', cc: 'MEX', start: '2026-10-30', end: '2026-11-01',
    sessions: { fp1: '2026-10-30T18:30Z', fp2: '2026-10-30T22:00Z', fp3: '2026-10-31T17:30Z', quali: '2026-10-31T21:00Z', race: '2026-11-01T20:00Z' },
    winner: { driver: 'Lando Norris', team: 'McLaren', year: 2025 },
  },
  {
    round: 20, name: 'GP de São Paulo', circuit: 'Interlagos', city: 'São Paulo', cc: 'BRA', start: '2026-11-06', end: '2026-11-08',
    sessions: { fp1: '2026-11-06T15:30Z', fp2: '2026-11-06T19:00Z', fp3: '2026-11-07T14:30Z', quali: '2026-11-07T18:00Z', race: '2026-11-08T17:00Z' },
    winner: { driver: 'Lando Norris', team: 'McLaren', year: 2025 },
  },
  {
    round: 21, name: 'GP de Las Vegas', circuit: 'Las Vegas Strip Circuit', city: 'Las Vegas', cc: 'USA', start: '2026-11-19', end: '2026-11-21', saturday: true,
    sessions: { fp1: '2026-11-20T00:30Z', fp2: '2026-11-20T04:00Z', fp3: '2026-11-21T00:30Z', quali: '2026-11-21T04:00Z', race: '2026-11-22T04:00Z' },
    winner: { driver: 'Max Verstappen', team: 'Red Bull', year: 2025 },
  },
  {
    round: 22, name: 'GP de Catar', circuit: 'Lusail', city: 'Lusail', cc: 'QAT', start: '2026-11-27', end: '2026-11-29',
    sessions: { fp1: '2026-11-27T13:30Z', fp2: '2026-11-27T17:00Z', fp3: '2026-11-28T14:30Z', quali: '2026-11-28T18:00Z', race: '2026-11-29T16:00Z' },
    winner: { driver: 'Max Verstappen', team: 'Red Bull', year: 2025 },
  },
  {
    round: 23, name: 'GP de Abu Dabi', circuit: 'Yas Marina', city: 'Abu Dabi', cc: 'UAE', start: '2026-12-04', end: '2026-12-06',
    sessions: { fp1: '2026-12-04T09:30Z', fp2: '2026-12-04T13:00Z', fp3: '2026-12-05T10:30Z', quali: '2026-12-05T14:00Z', race: '2026-12-06T13:00Z' },
    winner: { driver: 'Max Verstappen', team: 'Red Bull', year: 2025 },
  },
];
