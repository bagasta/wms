# Backend API Reference

This document describes all REST endpoints exposed by the backend service in `backend/`.

- Base URL: `http://localhost:3000`
- API Base Path: `http://localhost:3000/api`
- Content type: `application/json`
- Auth: Not implemented (recommend JWT or similar for production)

## Health

- Method: `GET`
- Path: `/health`
- Description: Liveness probe.
- Response 200:
  ```json
  { "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
  ```

## Sessions

### List Sessions
- Method: `GET`
- Path: `/api/sessions`
- Description: List all sessions.
- Response 200:
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": 1,
        "sessionName": "Demo Session",
        "webhookUrl": "https://example.test/hook",
        "status": "disconnected",
        "lastSeen": null,
        "createdAt": "2025-08-11T14:08:40.218Z",
        "updatedAt": "2025-08-11T14:08:40.218Z",
        "userId": 2
      }
    ]
  }
  ```

### Get Session
- Method: `GET`
- Path: `/api/sessions/:id`
- Path params: `id` (number)
- Response 200:
  ```json
  {
    "status": "success",
    "data": {
      "id": 1,
      "sessionName": "Demo Session",
      "webhookUrl": "https://example.test/hook",
      "status": "disconnected",
      "lastSeen": null,
      "createdAt": "2025-08-11T14:08:40.218Z",
      "updatedAt": "2025-08-11T14:08:40.218Z",
      "userId": 2
    }
  }
  ```
- Errors: 404 if not found.

### Create Session
- Method: `POST`
- Path: `/api/sessions`
- Body:
  ```json
  {
    "session_id": 2,            // optional, number
    "session_name": "My Session", // required, string
    "webhook_url": "https://example.test/hook", // optional, string
    "user_id": 1                 // required, number
  }
  ```
- Response 201:
  ```json
  {
    "status": "success",
    "data": {
      "id": 2,
      "sessionName": "My Session",
      "webhookUrl": "https://example.test/hook",
      "status": "disconnected",
      "qrCode": null,
      "sessionData": null,
      "lastSeen": null,
      "createdAt": "2025-08-11T15:00:00.000Z",
      "updatedAt": "2025-08-11T15:00:00.000Z",
      "userId": 1
    }
  }
  ```
- Errors: 400 (missing fields or name duplicate per user).

### Update Session
- Method: `PUT`
- Path: `/api/sessions/:id`
- Body:
  ```json
  {
    "session_name": "Updated Name",   // optional
    "webhook_url": "https://example.test/new" // optional
  }
  ```
- Response 200: Updated session object.
- Errors: 404 if not found.

### Delete Session
- Method: `DELETE`
- Path: `/api/sessions/:id`
- Response 200:
  ```json
  { "status": "success", "message": "Session 1 deleted successfully" }
  ```
- Errors: 404 if not found.

### Start Session
- Method: `POST`
- Path: `/api/sessions/:id/start`
- Description: Initializes WhatsApp client and begins QR flow.
- Response 200:
  ```json
  { "status": "success", "message": "Session 1 started successfully" }
  ```
- Notes: Status becomes `connecting` until QR scanned; QR updated via `/qr`.

### Stop Session
- Method: `POST`
- Path: `/api/sessions/:id/stop`
- Description: Destroys WhatsApp client and marks session disconnected.
- Response 200:
  ```json
  { "status": "success", "message": "Session 1 stopped successfully" }
  ```

### Get Session QR
- Method: `GET`
- Path: `/api/sessions/:id/qr`
- Response 200:
  ```json
  {
    "status": "success",
    "data": { "qr_code": "data:image/png;base64,...", "status": "connecting" }
  }
  ```
- Errors: 404 if session not found.

## Messages

### List Messages (by Session)
- Method: `GET`
- Path: `/api/messages/session/:sessionId`
- Query:
  - `limit` number, default 50
  - `offset` number, default 0
  - `phone` string, optional (partial match on `fromNumber`/`toNumber`)
- Response 200:
  ```json
  {
    "status": "success",
    "data": {
      "messages": [
        {
          "id": 1,
          "sessionId": 1,
          "messageId": "ABCDEF1234567890",
          "fromNumber": "1234567890@c.us",
          "toNumber": null,
          "contactName": "John Doe",
          "groupId": null,
          "messageType": "chat",
          "content": "Hello, world!",
          "timestamp": "2025-08-11T15:30:00.000Z",
          "webhookSent": true,
          "createdAt": "2025-08-11T15:30:00.000Z"
        }
      ],
      "pagination": { "total": 1, "limit": 50, "offset": 0 }
    }
  }
  ```

### Get Message
- Method: `GET`
- Path: `/api/messages/:id`
- Response 200: Message object.
- Errors: 404 if not found.

### Send Message
- Method: `POST`
- Path: `/api/messages/session/:sessionId/send`
- Body: Accepts `application/json` or `multipart/form-data`.
  - **Common fields**
    - `to` (string, required) — recipient phone/WhatsApp ID.
    - `message` (string, optional) — text body; required only when no media is supplied.
    - `caption` (string, optional) — overrides the caption used for media messages.
  - **Media options**
    - `media` can be:
      1. A JSON object `{ "type": "image", "url": "https://..." }`.
      2. A JSON object `{ "type": "image", "data": "<base64>", "mimetype": "image/jpeg", "filename": "photo.jpg" }`.
      3. A plain base64 string combined with `mediaMimeType` (and optional `mediaFilename`, `mediaType`) fields.
    - When using `multipart/form-data`, you may also upload a file field named `media`; the backend will convert it automatically.
    - Only `image` media type is currently supported.
- Example requests:
  - Text only
    ```json
    { "to": "1234567890@c.us", "message": "Hi there" }
    ```
  - JSON with base64 media
    ```json
    {
      "to": "1234567890",
      "media": {
        "type": "image",
        "data": "iVBORw0KGgoAAAANSUhEUgAA...",
        "mimetype": "image/png",
        "filename": "hello.png"
      }
    }
    ```
  - `multipart/form-data` fields
    - `to = 1234567890`
    - `media = iVBORw0KGgoAAAANSUhEUgAA...` (base64 string)
    - `mediaMimeType = image/png`
    - `mediaFilename = hello.png` *(optional)*
    - `caption = Hi there` *(optional)*
- Response 200: Saved sent message object.
- Errors: 400 (missing `to`, missing both `message` and media, invalid media payload, or session not connected), 404 (session not found).

## Webhooks

### Handle Incoming Webhook
- Method: `POST`
- Path: `/api/webhook/:sessionId`
- Body (any JSON). Optional convenience fields to trigger an immediate reply:
  ```json
  { "message_id": "ABC...", "reply_to": "1234567890@c.us", "reply_message": "Thanks!" }
  ```
- Responses:
  - 200 with `{ status: "success", message: "Webhook received" }` when no reply.
  - 200 with `{ status: "success", data: { message: "Reply sent successfully", sentMessage: { ... } } }` when `reply_to` and `reply_message` provided.
- Errors: 400 (session not connected), 404 (session not found).

### Register Webhook
- Method: `POST`
- Path: `/api/webhook/:sessionId/register`
- Body:
  ```json
  {
    "url": "https://example.test/hook",   // required
    "secret": "my-secret-key",            // optional, sent as X-Webhook-Secret
    "events": ["message"]                 // optional, defaults to ["message"]
  }
  ```
- Response 201/200: Webhook object (created/updated if URL already exists for session).
- Errors: 400 (missing url), 404 (session not found).

### List Webhooks (by Session)
- Method: `GET`
- Path: `/api/webhook/:sessionId`
- Response 200: Array of webhook objects.
- Errors: 404 if session not found.

### Delete Webhook
- Method: `DELETE`
- Path: `/api/webhook/:id`
- Response 200:
  ```json
  { "status": "success", "message": "Webhook 1 deleted successfully" }
  ```
- Errors: 404 if not found.

## Webhook Delivery Payload

When a WhatsApp message is received, the server POSTs the following JSON to the configured webhook(s):
```json
{
  "sessionId": 1,
  "sessionName": "Demo Session",
  "message": {
    "id": "ABCDEF1234567890",
    "from": "1234567890@c.us",
    "to": null,
    "contactName": "John Doe",
    "groupId": null,
    "type": "chat",
    "content": "Hello, world!",
    "timestamp": "2025-08-11T15:30:00.000Z",
    "mediaUrl": "/media/session-1/123.jpeg" // only when media exists
  }
}
```

Notes:
- `mediaUrl` is a relative path saved under `backend/media/session-<id>/`. Ensure your Express app serves this directory statically if you need public access.
- For image messages, a base64 `mediaData` and `mediaMimeType` can also be included.

### Auto-replies from Webhook Response
If your webhook responds with content, the backend tries to extract replies and send them via WhatsApp automatically. Accepted response shapes:
- String: treated as reply text.
- Object: uses first non-empty of `reply_message`, `output`, or `message`; optional `reply_to` overrides recipient.
- Array: list of strings/objects as above.

Example responses that will trigger replies:
```json
"Thanks for your message!"
```
```json
{ "reply_message": "We received your request", "reply_to": "1234567890@c.us" }
```
```json
[{ "message": "Item A" }, { "message": "Item B" }]
```

## Data Models (Prisma)

- Session: `id`, `userId`, `sessionName`, `webhookUrl?`, `status`, `qrCode?`, `sessionData?`, `lastSeen?`, `createdAt`, `updatedAt`
- Message: `id`, `sessionId`, `messageId`, `fromNumber`, `toNumber?`, `contactName?`, `groupId?`, `messageType`, `content`, `timestamp`, `webhookSent`, `createdAt`
- Webhook: `id`, `sessionId`, `url`, `secret?`, `events[]`, `active`, `createdAt`

## Errors

- 200 OK: Success
- 201 Created: Resource created
- 400 Bad Request: Validation or precondition failed
- 404 Not Found: Resource missing
- 500 Internal Server Error: Unhandled error

Error shape:
```json
{ "status": "error", "message": "<details>" }
```

## Environment Variables

- `PORT` (default `3000`): HTTP port
- `DATABASE_URL` (required): PostgreSQL connection string for Prisma
- `WWEBJS_DATA_DIR` (optional): Path for WhatsApp session auth data (defaults to `.wwebjs_auth`)

## Serving Media Files
To expose saved media via HTTP, mount a static handler in your Express app:
```js
const path = require('path');
app.use('/media', express.static(path.join(__dirname, '../media')));
```
