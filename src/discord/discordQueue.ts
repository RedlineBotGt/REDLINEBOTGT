
let discordRequestQueue: Promise<void> = Promise.resolve();

let lastDiscordRequestAt = 0;

const MIN_REQUEST_INTERVAL = 1100;

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function runDiscordRequest<T>(
  task: () => Promise<T>
): Promise<T> {
  const result = discordRequestQueue.then(async () => {
    const elapsed = Date.now() - lastDiscordRequestAt;
    const wait = MIN_REQUEST_INTERVAL - elapsed;

    if (wait > 0) {
      await sleep(wait);
    }

    return task();
  });

  discordRequestQueue = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}

export function updateLastDiscordRequestAt(): void {
  lastDiscordRequestAt = Date.now();
}
