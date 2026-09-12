'use strict';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET  = 'test';
process.env.NODE_ENV    = 'test';

jest.mock('../../src/models/Alert');
jest.mock('../../src/sockets/alertSocket', () => ({ emitAlert: jest.fn(), initSocket: jest.fn() }));

const Alert = require('../../src/models/Alert');
const { emitAlert } = require('../../src/sockets/alertSocket');
const notificationTool = require('../../src/services/mcp-tools/notificationTool');

describe('notificationTool', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an alert in DB and emits a socket event', async () => {
    const mockAlert = {
      _id:       'alert123',
      plantId:   'plant1',
      severity:  'high',
      type:      'shortfall_risk',
      message:   'Generation shortfall expected',
      createdAt: new Date(),
    };
    Alert.create.mockResolvedValue(mockAlert);

    const result = await notificationTool.handler({
      plantId:  'plant1',
      severity: 'high',
      type:     'shortfall_risk',
      message:  'Generation shortfall expected',
    });

    expect(result.success).toBe(true);
    expect(result.alertId).toBe('alert123');
    expect(Alert.create).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'high', type: 'shortfall_risk' })
    );
    expect(emitAlert).toHaveBeenCalledWith(
      expect.objectContaining({ plantId: 'plant1', severity: 'high' })
    );
  });

  it('propagates errors from Alert.create', async () => {
    Alert.create.mockRejectedValue(new Error('DB write failed'));
    await expect(
      notificationTool.handler({ plantId: 'p1', severity: 'low', type: 'sensor_fault', message: 'test' })
    ).rejects.toThrow('DB write failed');
  });
});
