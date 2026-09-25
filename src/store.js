'use strict';

const { now } = require('./utils');

class RunStore {
  constructor() { this.runs = new Map(); this.events = new Map(); this.feedback = []; }

  create(run) {
    this.runs.set(run.id, run);
    this.events.set(run.id, []);
    this.publish(run.id, { at: now(), stage: 'queued', message: 'Analysis queued' });
    return run;
  }

  publish(runId, event) {
    const history = this.events.get(runId);
    if (!history) return;
    history.push({ sequence: history.length + 1, ...event });
    if (history.length > 250) history.shift();
  }

  get(runId) { return this.runs.get(runId) || null; }

  eventSlice(runId, after = 0) { return (this.events.get(runId) || []).filter((event) => event.sequence > after); }

  list() {
    return [...this.runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map((run) => ({
      id: run.id, status: run.status, task: run.task.text.slice(0, 180), startedAt: run.startedAt, completedAt: run.completedAt,
      decision: run.decision?.title || 'RUNNING', confidence: run.confidence?.score ?? null, modelCount: run.models.length
    }));
  }

  addFeedback(input) {
    const record = { id: `FB-${this.feedback.length + 1}`, runId: String(input.runId || ''), rating: ['up', 'down'].includes(input.rating) ? input.rating : 'down', message: String(input.message || '').slice(0, 600), at: now() };
    this.feedback.push(record);
    return record;
  }
}

module.exports = { RunStore };
