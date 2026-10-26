// Tests for Zoom webhook verification and RTMS handshake signing.
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ZoomRtmsGateway, signRtmsHandshake, verifyWebhookSignature } from './ZoomRtmsGateway'
import type { AudioIngest } from '../Audio/AudioIngest'

const credentials = { clientId: 'cid', clientSecret: 'csecret', webhookSecretToken: 'wsecret' }
const log = { info: () => undefined, warn: () => undefined, error: () => undefined }

function createGateway(): ZoomRtmsGateway {
  return new ZoomRtmsGateway(credentials, () => undefined, {} as AudioIngest, log)
}

describe('Zoom RTMS helpers', () => {
  it('signs the handshake as HMAC(client_secret, "client_id,meeting_uuid,stream_id")', () => {
    const expected = createHmac('sha256', 'csecret').update('cid,uuid==,stream1').digest('hex')
    expect(signRtmsHandshake(credentials, 'uuid==', 'stream1')).toBe(expected)
  })

  it('verifies webhook signatures', () => {
    const body = '{"event":"meeting.rtms_started"}'
    const signature = `v0=${createHmac('sha256', 'wsecret').update(`v0:123:${body}`).digest('hex')}`
    expect(verifyWebhookSignature('wsecret', '123', body, signature)).toBe(true)
    expect(verifyWebhookSignature('wsecret', '124', body, signature)).toBe(false)
  })
})

describe('ZoomRtmsGateway.handleWebhook', () => {
  it('answers URL validation challenges', () => {
    const response = createGateway().handleWebhook(
      JSON.stringify({ event: 'endpoint.url_validation', payload: { plainToken: 'abc' } }),
      {},
    )
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      plainToken: 'abc',
      encryptedToken: createHmac('sha256', 'wsecret').update('abc').digest('hex'),
    })
  })

  it('rejects unsigned events', () => {
    const response = createGateway().handleWebhook(
      JSON.stringify({ event: 'meeting.rtms_started', payload: {} }),
      { 'x-zm-signature': 'v0=bad', 'x-zm-request-timestamp': '1' },
    )
    expect(response.status).toBe(401)
  })
})
