'use strict';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET  = 'test';
process.env.NODE_ENV    = 'test';

jest.mock('../../src/models/Telemetry');
const Telemetry = require('../../src/models/Telemetry');
const { getRecentTelemetry } = require('../../src/services/connectors/telemetryConnector');

describe('telemetryConnector', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries telemetry for the last N days and returns data', async () => {
    const mockData = [
      { plantId: 'p1', timestamp: new Date(), generationMW: 5.2, sensorStatus: 'ok' },
    ];
    Telemetry.find.mockReturnValue({ sort: () => ({ lean: () => mockData }) });

    const result = await getRecentTelemetry('p1', 4);
    expect(result).toEqual(mockData);
    expect(Telemetry.find).toHaveBeenCalledWith(
      expect.objectContaining({ plantId: 'p1' })
    );
  });

  it('passes a date filter for N days ago', async () => {
    Telemetry.find.mockReturnValue({ sort: () => ({ lean: () => [] }) });
    await getRecentTelemetry('p2', 7);
    const callArgs = Telemetry.find.mock.calls[0][0];
    expect(callArgs.timestamp).toHaveProperty('$gte');
    const cutoff = callArgs.timestamp.$gte;
    const diffDays = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });
});
