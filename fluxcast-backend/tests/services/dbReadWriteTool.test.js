'use strict';
const ForecastResult = require('../../src/models/ForecastResult');
const Recommendation = require('../../src/models/Recommendation');
const Alert = require('../../src/models/Alert');
const WeatherSnapshot = require('../../src/models/WeatherSnapshot');

jest.mock('../../src/models/ForecastResult');
jest.mock('../../src/models/Recommendation');
jest.mock('../../src/models/Alert');
jest.mock('../../src/models/WeatherSnapshot');

const dbReadWriteTool = require('../../src/services/mcp-tools/dbReadWriteTool');

describe('MCP Tool: dbReadWriteTool', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has valid MCP metadata and required properties', () => {
    expect(dbReadWriteTool.name).toBe('dbReadWriteTool');
    expect(dbReadWriteTool.inputSchema.required).toEqual(['operation', 'collection']);
  });

  it('throws error for unknown collection', async () => {
    await expect(
      dbReadWriteTool.handler({ operation: 'read', collection: 'unknown_collection' })
    ).rejects.toThrow('Unknown collection: unknown_collection');
  });

  describe('write operation', () => {
    it('creates a new document in the forecasts collection', async () => {
      ForecastResult.create.mockResolvedValue({ _id: 'forecast-doc-1' });

      const payload = { plantId: 'plant-1', points: [] };
      const result = await dbReadWriteTool.handler({
        operation: 'write',
        collection: 'forecasts',
        data: payload,
      });

      expect(ForecastResult.create).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ success: true, id: 'forecast-doc-1' });
    });

    it('creates a new recommendation document', async () => {
      Recommendation.create.mockResolvedValue({ _id: 'rec-doc-1' });

      const payload = { plantId: 'plant-1', action: 'charge_battery' };
      const result = await dbReadWriteTool.handler({
        operation: 'write',
        collection: 'recommendations',
        data: payload,
      });

      expect(Recommendation.create).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ success: true, id: 'rec-doc-1' });
    });
  });

  describe('read operation', () => {
    it('reads the latest document sorted by createdAt desc', async () => {
      const mockDoc = { _id: 'alert-1', plantId: 'plant-1', type: 'shortfall_risk' };
      Alert.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockDoc),
        }),
      });

      const result = await dbReadWriteTool.handler({
        operation: 'read',
        collection: 'alerts',
        plantId: 'plant-1',
      });

      expect(Alert.findOne).toHaveBeenCalledWith({ plantId: 'plant-1' });
      expect(result).toEqual(mockDoc);
    });

    it('returns null if no document is found', async () => {
      WeatherSnapshot.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await dbReadWriteTool.handler({
        operation: 'read',
        collection: 'weatherSnapshots',
        plantId: 'plant-none',
      });

      expect(result).toBeNull();
    });
  });
});
