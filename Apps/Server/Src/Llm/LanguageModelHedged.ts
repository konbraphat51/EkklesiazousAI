// Hedged requests: start a backup model if the primary is slow, keep whichever answers first.
import type { GenerationRequest, LanguageModel } from './LanguageModel'

/** Runs a primary model and, after a delay, a backup; the first success wins and the other aborts. */
export class LanguageModelHedged implements LanguageModel {
  /** Combined id, e.g. `cerebras/gpt-oss-120b|claude-haiku-5-5`. */
  readonly modelId: string

  /**
   * @param primary - Preferred (usually fastest) model.
   * @param backup - Model started when the primary is slow or fails.
   * @param hedgeDelayMs - How long to wait for the primary before starting the backup.
   */
  constructor(
    private readonly primary: LanguageModel,
    private readonly backup: LanguageModel,
    private readonly hedgeDelayMs: number,
  ) {
    this.modelId = `${primary.modelId}|${backup.modelId}`
  }

  generate<T>(request: GenerationRequest<T>): Promise<T> {
    const controllers = [new AbortController(), new AbortController()]
    request.signal?.addEventListener('abort', () => {
      for (const controller of controllers) controller.abort()
    })

    return new Promise<T>((resolve, reject) => {
      let isSettled = false
      let failures = 0
      let isBackupStarted = false
      const errors: unknown[] = []

      const launch = (model: LanguageModel, index: number): void => {
        model
          .generate({ ...request, signal: controllers[index]!.signal })
          .then((value) => {
            if (isSettled) return
            isSettled = true
            clearTimeout(backupTimer)
            controllers[1 - index]!.abort()
            resolve(value)
          })
          .catch((error: unknown) => {
            errors.push(error)
            failures += 1
            // a failing primary starts the backup immediately
            if (index === 0 && !isBackupStarted) startBackup()
            if (failures === 2 && !isSettled) {
              isSettled = true
              reject(errors[0] instanceof Error ? errors[0] : new Error('all models failed'))
            }
          })
      }

      const startBackup = (): void => {
        if (isBackupStarted || isSettled) return
        isBackupStarted = true
        clearTimeout(backupTimer)
        launch(this.backup, 1)
      }

      // callbacks run asynchronously, so the timer exists before any of them reads it
      const backupTimer = setTimeout(startBackup, this.hedgeDelayMs)
      launch(this.primary, 0)
    })
  }
}
