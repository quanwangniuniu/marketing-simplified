export const AGENT_SKELETON_DEBUG_DELAY_MS = 3000

export async function sleep(ms: number = AGENT_SKELETON_DEBUG_DELAY_MS) {
  await new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function withMinimumDelay<T>(
  promise: Promise<T>,
  ms: number = AGENT_SKELETON_DEBUG_DELAY_MS,
): Promise<T> {
  const [result] = await Promise.all([promise, sleep(ms)])
  return result
}
