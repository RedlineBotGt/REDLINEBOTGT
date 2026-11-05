
const eventLocks = new Map<string, Promise<void>>();

export async function withEventLock<T>(
  key: string,
  action: () => Promise<T>
): Promise<T> {
  const previous = eventLocks.get(key) || Promise.resolve();

  let release!: () => void;

  const current = new Promise<void>(resolve => {
    release = resolve;
  });

  eventLocks.set(key, current);

  await previous;

  try {
    return await action();
  } finally {
    release();

    if (eventLocks.get(key) === current) {
      eventLocks.delete(key);
    }
  }
}
