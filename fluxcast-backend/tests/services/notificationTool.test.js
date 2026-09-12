'use strict';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET  = 'test';
process.env.NODE_ENV    = 'test';

jest.mock('../../src/models/Alert');
jest.mock('../../src/models/Notification');
jest.mock('../../src/models/Plant');
jest.mock('../../src/sockets/alertSocket', () => ({ emitAlert: jest.fn(), initSocket: jest.fn() }));
jest.mock('../../src/services/notifications/emailDispatcher', () => ({
  dispatchAlertEmail: jest.fn().mockResolvedValue({ status: 'skipped', detail: 'SMTP not configured in tests' }),
  shouldEscalate: jest.fn(() => true),
  isConfigured: jest.fn(() => false),
}));

const Alert = require('../../src/models/Alert');
const Notification = require('../../src/models/Notification');
const Plant = require('../../src/models/Plant');
const { emitAlert } = require('../../src/sockets/alertSocket');
const { dispatchAlertEmail } = require('../../src/services/notifications/emailDispatcher');
const notificationTool = require('../../src/services/mcp-tools/notificationTool');

describe('notificationTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.create.mockResolvedValue({ _id: 'note1' });
    Plant.findById.mockReturnValue({ select: () => ({ lean: () => ({ name: 'Test Plant' }) }) });
    dispatchAlertEmail.mockResolvedValue({ status: 'skipped', detail: 'SMTP not configured in tests' });
  });

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

  it('logs both the socket push and the email escalation outcome', async () => {
    Alert.create.mockResolvedValue({ _id: 'alert456', createdAt: new Date() });

    const result = await notificationTool.handler({
      plantId:  'plant1',
      severity: 'high',
      type:     'sensor_fault',
      message:  'Sensor offline',
    });

    expect(dispatchAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'high', type: 'sensor_fault', plantName: 'Test Plant' })
    );
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'socket', status: 'sent' })
    );
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email', status: 'skipped' })
    );
    expect(result.emailStatus).toBe('skipped');
  });

  it('propagates errors from Alert.create', async () => {
    Alert.create.mockRejectedValue(new Error('DB write failed'));
    await expect(
      notificationTool.handler({ plantId: 'p1', severity: 'low', type: 'sensor_fault', message: 'test' })
    ).rejects.toThrow('DB write failed');
  });
});
