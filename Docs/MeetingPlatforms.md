# Meeting platforms and audio capture

[日本語](MeetingPlatforms.ja.md)

Choose the platform and capture mode when creating a room; both can be changed later in **Settings → Room**. Every participant opens the same room URL to see the shared canvas. Audio needs to come from only one of the paths below.

| Platform        | Zero setup                                    | Better speaker names           | Production per-participant audio      |
| --------------- | --------------------------------------------- | ------------------------------ | ------------------------------------- |
| In person       | Room microphone                               | —                              | —                                     |
| Google Meet     | Host captures the Meet tab                    | Everyone streams their own mic | Meeting bot (Recall.ai, experimental) |
| Zoom            | Host captures Zoom (web tab or system audio)  | Everyone streams their own mic | Zoom RTMS, or meeting bot             |
| Microsoft Teams | Host captures Teams (web tab or system audio) | Everyone streams their own mic | Meeting bot                           |

A consent dialog appears before any audio leaves a device. Everyone in the meeting must know and agree that it is being transcribed.

## In person: one room microphone

1. Put a laptop with a decent microphone in the middle of the table. Use Chrome or Edge.
2. Create a room with **In person** and **Room microphone**.
3. Click **Audio → Start capturing**.

Browser echo cancellation, noise suppression and automatic gain are turned off, so quieter, distant voices are kept. Soniox separates speakers (they appear as "Speaker 1", "Speaker 2"); click a name in the transcript to rename it.

## Google Meet

### Host captures the Meet tab (no setup)

1. Open Google Meet in a **regular** Chrome or Edge tab (not the installed app window).
2. Create a room with **Google Meet** and **Host captures the meeting audio**.
3. Click **Audio → Start capturing**, choose the **Meet tab** in the picker, and tick **Also share tab audio**.

The Meet tab carries only the _remote_ participants' voices; they are diarized. The host's own microphone is sent as a separate stream labelled with the host's name. If the host listens on speakers, remote voices leak into the host's microphone. The server's `EchoGuard` drops those duplicates, but headphones work best.

### Everyone streams their own microphone

Each participant opens the room, enters their name and starts **Audio**. Transcripts carry real names. Everyone should use headphones.

### Google Meet add-on (canvas inside Meet)

The add-on puts EkklesiazousAI inside Meet:

- **Side panel (personal):** private help, the transcript and the command bar.
- **Main stage (shared):** the canvas for everyone in the call, with each participant interacting in their own frame.

1. Create a Google Cloud project and note its **project number**.
2. Enable the **Google Workspace Marketplace SDK** and the **Google Workspace add-ons API**.
3. Serve EkklesiazousAI over **HTTPS** (`pnpm build && pnpm start` behind a TLS proxy or tunnel).
4. Create an HTTP deployment with a manifest like the following (check the current field names in Google's documentation):

   ```json
   {
     "addOns": {
       "common": { "name": "EkklesiazousAI", "logoUrl": "https://YOUR_HOST/Favicon.svg" },
       "meet": {
         "web": {
           "sidePanelUrl": "https://YOUR_HOST/addon/meet/sidepanel",
           "addOnOrigins": ["https://YOUR_HOST"]
         }
       }
     }
   }
   ```

5. Set `VITE_MEET_CLOUD_PROJECT_NUMBER` in `.env` and rebuild the client.
6. Install the deployment, open **Activities** in a Meet call, create a room in the side panel, and click **Show the canvas to everyone**.

Add-ons cannot access meeting audio. Combine the add-on with one of the capture paths above. Google's real-time **Meet Media API** is not accepting new sign-ups (October 2026), so it is not supported.

### Meeting bot (experimental)

With `RECALL_API_KEY` set and `PUBLIC_BASE_URL` reachable over HTTPS (for example through ngrok), create a room with **Meeting bot** and paste the Meet link in **Audio → Invite bot**. The host must admit the bot. Each participant's voice arrives separately, with their name. The bot costs about $0.50 per hour plus speech recognition per active speaker.

## Zoom

### Host captures Zoom

- **Zoom web client:** pick the Zoom tab and tick **Share tab audio**.
- **Zoom desktop on Windows:** pick **Entire screen** and tick **Share system audio**.
- **Zoom desktop on macOS:** system audio capture needs a recent Chrome and macOS; the Zoom web client is the reliable option.

The host's microphone is sent as a separate, named stream, as with Google Meet.

### Zoom RTMS (per-participant audio from Zoom's servers)

Requirements: a Zoom Pro, Business or Enterprise account with Zoom Developer Pack credits, and an account admin who allows apps to access meeting content.

1. In the Zoom App Marketplace, create a **General (OAuth)** app with the scope `meeting:read:meeting_audio`.
2. Add the event subscriptions `meeting.rtms_started` and `meeting.rtms_stopped`, with the endpoint URL `https://YOUR_HOST/api/zoom/webhook`. The server answers Zoom's URL validation automatically.
3. Put `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN` and `PUBLIC_BASE_URL` in `.env`.
4. Create a room with **Zoom** and **Zoom RTMS**, then enter the Zoom meeting ID in **Settings → Room**. The room must be open in a browser so that it is live.
5. Start the RTMS app in the meeting (automatically, or by the host). Each participant's audio arrives with their Zoom name.

The server implements the RTMS WebSocket protocol directly, because the official SDK does not run on Windows. Breakout rooms are not captured.

### Meeting bot

Works as for Google Meet: paste the Zoom join link.

## Microsoft Teams

- **Host capture:** Teams on the web, choose the Teams tab and tick **Share tab audio**. Teams desktop on Windows, choose **Entire screen** and tick **Share system audio**.
- **Everyone streams their own microphone.**
- **Meeting bot:** paste the Teams join link.

## Demo

**Start demo meeting** in the lobby replays a scripted Japanese/English meeting without a microphone. With API keys configured, the demo meeting is processed by the real AI and search services, which is a convenient way to test them.
