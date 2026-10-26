// Meeting participant as identified by diarization or by a per-participant audio stream.

/** A participant voice known to the meeting. */
export interface Speaker {
  /** Stable identifier, e.g. `room-mic:1` or `participant:alice`. */
  id: string
  /** Human-readable name; editable by participants (diarized speakers start as "Speaker 1"). */
  label: string
  /** Index into the client's speaker color palette. */
  colorIndex: number
}
