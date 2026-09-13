'use strict';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test';
process.env.NODE_ENV = 'test';

jest.mock('node-cron', () => ({ schedule: jest.fn(() => ({ stop: jest.fn() })) }));

const cron = require('node-cron');
const { scheduleJob } = require('../../src/jobs/jobRunner');

/** Let queued promise callbacks settle. setImmediate stays real (see below). */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('jobRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The start-up run is a setTimeout, so timers are faked to control it —
    // but setImmediate has to stay real or `flush` never resolves.
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  });
  afterEach(() => jest.useRealTimers());

  it('registers the cron expression it was given', () => {
    const task = jest.fn().mockResolvedValue();
    scheduleJob({ name: 'Test', expression: '0,15,30,45 * * * *', task, runOnStart: false });

    expect(cron.schedule).toHaveBeenCalledWith('0,15,30,45 * * * *', expect.any(Function));
  });

  it('runs once at start-up so a restart does not wait for the next tick', async () => {
    const task = jest.fn().mockResolvedValue();
    scheduleJob({ name: 'Test', expression: '* * * * *', task });

    expect(task).not.toHaveBeenCalled(); // deferred, not inline
    jest.advanceTimersByTime(0);
    await flush();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('honours the start-up stagger, so a cycle keeps its order', async () => {
    const task = jest.fn().mockResolvedValue();
    scheduleJob({ name: 'Test', expression: '* * * * *', task, startDelayMs: 20_000 });

    jest.advanceTimersByTime(19_000);
    await flush();
    expect(task).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000);
    await flush();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('skips a tick while the previous run is still going', async () => {
    let release;
    const task = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    scheduleJob({ name: 'Test', expression: '* * * * *', task, runOnStart: false });

    const tick = cron.schedule.mock.calls[0][1];
    tick();
    await flush();
    tick(); // arrives while the first is still in flight
    await flush();
    expect(task).toHaveBeenCalledTimes(1);

    release();
    await flush();
    tick(); // the lock is released, so this one runs
    await flush();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('survives a failing run and stays schedulable', async () => {
    const task = jest.fn()
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValue();
    scheduleJob({ name: 'Test', expression: '* * * * *', task, runOnStart: false });

    const tick = cron.schedule.mock.calls[0][1];
    await expect(tick()).resolves.toBeUndefined();
    await flush();

    tick();
    await flush();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('exposes a manual trigger for the same guarded path', async () => {
    const task = jest.fn().mockResolvedValue();
    const job = scheduleJob({ name: 'Test', expression: '* * * * *', task, runOnStart: false });

    await job.trigger();
    expect(task).toHaveBeenCalledTimes(1);
  });
});
