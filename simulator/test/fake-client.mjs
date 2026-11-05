
import { EventEmitter } from 'node:events';

export class FakeClient extends EventEmitter {
  constructor() {
    super();
    this.published = [];
    this.subscriptions = [];
    this.ended = false;
  }

  publish(topic, message, options = {}) {
    this.published.push({
      topic,
      message,
      options
    });
  }

  subscribe(topic, options = {}) {
    this.subscriptions.push({ topic, options });
  }

  end() {
    this.ended = true;
  }
}
