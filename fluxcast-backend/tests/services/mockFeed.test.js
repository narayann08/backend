'use strict';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test';
process.env.NODE_ENV = 'test';

const { buildReading, indexWeather, weatherAt } = require('../../src/services/telemetry/mockFeed');
const { slotFor, SLOT_MINUTES } = require('../../src/jobs/scheduledTelemetryJob');

const solar = { _id: 'plant-1', type: 'solar', capacityMW: 200 };

const hours = [
  { time: '2026-09-13T06:00:00Z', ghiWm2: 400, temperatureC: 30, windSpeedMs: 4 },
  { time: '2026-09-13T07:00:00Z', ghiWm2: 800, temperatureC: 34, windSpeedMs: 8 },
];

describe('telemetry cadence', () => {
  describe('slotFor', () => {
    it(`floors to the ${SLOT_MINUTES}-minute slot`, () => {
      expect(slotFor(new Date('2026-09-13T06:07:43.512Z')).toISOString()).toBe('2026-09-13T06:00:00.000Z');
      expect(slotFor(new Date('2026-09-13T06:15:00.000Z')).toISOString()).toBe('2026-09-13T06:15:00.000Z');
      expect(slotFor(new Date('2026-09-13T06:59:59.999Z')).toISOString()).toBe('2026-09-13T06:45:00.000Z');
    });

    it('is stable, so re-running a slot resolves to the same instant', () => {
      const a = slotFor(new Date('2026-09-13T06:21:00Z'));
      const b = slotFor(new Date('2026-09-13T06:29:00Z'));
      expect(a.getTime()).toBe(b.getTime());
    });
  });

  describe('weatherAt', () => {
    const index = indexWeather(hours);

    it('returns the hour itself on the hour', () => {
      expect(weatherAt(new Date('2026-09-13T06:00:00Z'), index).ghiWm2).toBe(400);
    });

    it('blends toward the next hour in between', () => {
      expect(weatherAt(new Date('2026-09-13T06:15:00Z'), index).ghiWm2).toBeCloseTo(500, 5);
      expect(weatherAt(new Date('2026-09-13T06:30:00Z'), index).ghiWm2).toBeCloseTo(600, 5);
      expect(weatherAt(new Date('2026-09-13T06:45:00Z'), index).temperatureC).toBeCloseTo(33, 5);
    });

    it('falls back to the current hour when the next one is missing', () => {
      const single = indexWeather([hours[1]]);
      expect(weatherAt(new Date('2026-09-13T07:30:00Z'), single).ghiWm2).toBe(800);
    });

    it('returns null when there is no weather at all', () => {
      expect(weatherAt(new Date(), indexWeather([]))).toBeNull();
      expect(weatherAt(new Date(), undefined)).toBeNull();
    });
  });

  describe('buildReading', () => {
    it('rises across the slots of a brightening hour', () => {
      const index = indexWeather(hours);
      const readings = ['06:00', '06:15', '06:30', '06:45'].map(
        (hhmm) => buildReading(solar, new Date(`2026-09-13T${hhmm}:00Z`), index).generationMW
      );

      // Noise is ±6%, while each step adds 25% of the hour's climb — so the
      // span across the hour must still be clearly upward.
      expect(readings[3]).toBeGreaterThan(readings[0]);
      expect(new Set(readings).size).toBeGreaterThan(1);
    });

    it('never reports more than the plant can produce, or less than nothing', () => {
      const bright = indexWeather([
        { time: '2026-09-13T06:00:00Z', ghiWm2: 1400, temperatureC: 20 },
        { time: '2026-09-13T07:00:00Z', ghiWm2: 1400, temperatureC: 20 },
      ]);
      const reading = buildReading(solar, new Date('2026-09-13T06:30:00Z'), bright);
      expect(reading.generationMW).toBeLessThanOrEqual(solar.capacityMW);
      expect(reading.generationMW).toBeGreaterThanOrEqual(0);
    });

    it('falls back to the clock curve when no weather is stored', () => {
      const reading = buildReading(solar, new Date('2026-09-13T06:30:00Z'), indexWeather([]));
      expect(reading.generationMW).toBeGreaterThan(0); // 12:00 IST — the middle of the day
      expect(reading.plantId).toBe(solar._id);
      expect(reading.timestamp).toEqual(new Date('2026-09-13T06:30:00Z'));
    });

    it('reports zero for a solar plant at night', () => {
      const night = indexWeather([
        { time: '2026-09-12T20:00:00Z', ghiWm2: 0, temperatureC: 24 },
        { time: '2026-09-12T21:00:00Z', ghiWm2: 0, temperatureC: 23 },
      ]);
      expect(buildReading(solar, new Date('2026-09-12T20:30:00Z'), night).generationMW).toBe(0);
    });
  });
});
