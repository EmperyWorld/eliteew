/**
 * In-process notification jobs (no Redis/BullMQ).
 * Schedule reminders use setTimeout(delay); immediate jobs use setImmediate.
 */

export type NotificationJobOptions = {
  delay?: number;
  attempts?: number;
  backoff?: { type: string; delay: number };
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
};

let jobIdSeq = 0;

function processNotificationJob(jobName: string, data: unknown): void {
  console.log(`Processing job ${jobName}`);

  if (jobName === 'admin-notification' || jobName === 'schedule-reminder') {
    const message =
      typeof data === 'object' &&
      data &&
      'message' in data &&
      typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : '';

    if (message) {
      console.log(`[notification:${jobName}] ${message}`);
    }
  }

  console.log(`Job ${jobName} completed`);
}

export const addNotificationJob = async (
  name: string,
  data: unknown,
  options?: NotificationJobOptions
) => {
  const delay = options?.delay ?? 0;
  const id = `mem-${++jobIdSeq}-${Date.now()}`;

  const run = () => {
    try {
      processNotificationJob(name, data);
    } catch (e) {
      console.error(`Job ${id} failed`, e);
    }
  };

  if (delay > 0) {
    setTimeout(run, delay);
  } else {
    setImmediate(run);
  }

  return { id };
};

export const initNotificationWorker = () => {
  console.log('Notification queue (in-memory) ready');
  return {
    close: async () => {
      /* no persistent connections */
    },
  };
};
