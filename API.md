# WhatsApp Management System API Documentation

This document provides detailed information about the API endpoints available in the WhatsApp Management System.

## Base URL

All API endpoints are relative to the base URL:

```
http://localhost:3000/api
```

Set the `PORT` environment variable before starting the backend if you need to override the default.

## Quick Start (cURL)

The following example sequence shows how to create a session, start it, and send both text and media messages using cURL. Adjust the values (phone numbers, URLs, file paths) to match your environment.

```bash
# Base API endpoint
API_BASE="http://localhost:3000/api"

# 1. Create a new session
SESSION_RESPONSE=$(curl -sS -X POST "$API_BASE/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "Demo Session",
    "webhook_url": "https://example.com/webhook",
    "user_id": 1
  }')
echo "$SESSION_RESPONSE" | jq '.'

# Extract the session ID (requires jq)
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.data.id')

# 2. Start the session (scan the QR code that appears in the backend logs/UI)
curl -sS -X POST "$API_BASE/sessions/$SESSION_ID/start" | jq '.'

# 3. Optionally poll the session to confirm status
curl -sS "$API_BASE/sessions/$SESSION_ID" | jq '.'

# 4. Send a text message
curl -sS -X POST "$API_BASE/messages/session/$SESSION_ID/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890@c.us",
    "message": "Hello from WhatsApp Management System!"
  }' | jq '.'

# 5. Send an image message using multipart upload
curl -sS -X POST "$API_BASE/messages/session/$SESSION_ID/send" \
  -H "Content-Type: multipart/form-data" \
  -F "to=1234567890@c.us" \
  -F "caption=Look at this!" \
  -F "media=@/path/to/photo.jpg" | jq '.'

# 6. (Optional) Stop the session when finished
curl -sS -X POST "$API_BASE/sessions/$SESSION_ID/stop" | jq '.'
```

If `jq` is not available, omit the extraction lines and read the `id` from the raw JSON response.

## Authentication

Currently, the API does not implement authentication. It is recommended to implement JWT authentication for production use.

## Response Format

All API responses follow a standard format:

```json
{
  "status": "success|error",
  "data": { ... },  // For successful responses
  "message": "..." // For error responses
}
```

## API Endpoints

### Sessions

#### Get All Sessions

```
GET /sessions
```

Returns a list of all WhatsApp sessions.

**Response Example:**

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "sessionName": "Demo Session",
      "webhookUrl": "https://webhook.site/demo",
      "status": "disconnected",
      "lastSeen": null,
      "createdAt": "2025-08-11T14:08:40.218Z",
      "updatedAt": "2025-08-11T14:08:40.218Z",
      "userId": 2
    }
  ]
}
```

#### Get Session by ID

```
GET /sessions/:id
```

Returns details of a specific session.

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "sessionName": "Demo Session",
    "webhookUrl": "https://webhook.site/demo",
    "status": "disconnected",
    "lastSeen": null,
    "createdAt": "2025-08-11T14:08:40.218Z",
    "updatedAt": "2025-08-11T14:08:40.218Z",
    "userId": 2
  }
}
```

#### Create Session

```
POST /sessions
```

Creates a new WhatsApp session.

**Request Body:**

```json
{
  "session_name": "My Session",
  "webhook_url": "https://webhook.site/my-webhook",
  "user_id": 1
}
```

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "id": 2,
    "sessionName": "My Session",
    "webhookUrl": "https://webhook.site/my-webhook",
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

#### Update Session

```
PUT /sessions/:id
```

Updates an existing WhatsApp session.

**Request Body:**

```json
{
  "session_name": "Updated Session Name",
  "webhook_url": "https://webhook.site/updated-webhook"
}
```

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "sessionName": "Updated Session Name",
    "webhookUrl": "https://webhook.site/updated-webhook",
    "status": "disconnected",
    "qrCode": null,
    "sessionData": null,
    "lastSeen": null,
    "createdAt": "2025-08-11T14:08:40.218Z",
    "updatedAt": "2025-08-11T15:30:00.000Z",
    "userId": 2
  }
}
```

#### Delete Session

```
DELETE /sessions/:id
```

Deletes a WhatsApp session.

**Response Example:**

```json
{
  "status": "success",
  "message": "Session 1 deleted successfully"
}
```

#### Start Session

```
POST /sessions/:id/start
```

Starts a WhatsApp session and generates a QR code for scanning.

**Response Example:**

```json
{
  "status": "success",
  "message": "Session 1 started successfully"
}
```

#### Stop Session

```
POST /sessions/:id/stop
```

Stops a WhatsApp session.

**Response Example:**

```json
{
  "status": "success",
  "message": "Session 1 stopped successfully"
}
```

#### Get Session QR Code

```
GET /sessions/:id/qr
```

Returns the QR code for a session.

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "qr_code": "data:image/png;base64,...",
    "status": "connecting"
  }
}
```

### Messages

#### Get Messages for Session

```
GET /messages/session/:sessionId
```

Returns messages for a specific session.

**Query Parameters:**

- `limit` (optional): Number of messages to return (default: 50)
- `offset` (optional): Offset for pagination (default: 0)
- `phone` (optional): Filter messages by phone number

**Response Example:**

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
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0
    }
  }
}
```

#### Get Message by ID

```
GET /messages/:id
```

Returns details of a specific message.

**Response Example:**

```json
{
  "status": "success",
  "data": {
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
}
```

#### Send Message

```
POST /messages/session/:sessionId/send
```

Sends a message from a specific session.

Either `message` (text) or a `media` payload is required. At this time only media with `type` set to `image` is supported.

**Note:** When your upstream returns binary image data, either supply it as base64 within `media.data` along with a `mimetype`, or upload the file via `multipart/form-data` as shown below. Use `media.url` only if the image is already accessible via HTTP.

**Request Body (text):**

```json
{
  "to": "1234567890@c.us",
  "message": "Hello from WhatsApp Management System!"
}
```

**Request Body (image):**

```json
{
  "to": "1234567890@c.us",
  "media": {
    "type": "image",
    "url": "https://example.com/photo.jpg",
    "caption": "Look at this!"
  }
}
```

Alternatively, you can supply base64-encoded image data instead of a URL:

```json
{
  "to": "1234567890@c.us",
  "media": {
    "type": "image",
    "data": "<base64 encoded jpeg>",
    "mimetype": "image/jpeg",
    "filename": "photo.jpg",
    "caption": "Look at this!"
  }
}
```

**Request (multipart/form-data with binary image):**

```bash
curl -X POST "http://localhost:3000/api/messages/session/1/send" \
  -H "Content-Type: multipart/form-data" \
  -F "to=1234567890@c.us" \
  -F "caption=Look at this!" \
  -F "media=@/path/to/photo.jpg"
```

When uploading binary data, the `media` form field must contain the image file. Optional text fields include `message` (used as a caption when provided) and `caption`.

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "id": 2,
    "sessionId": 1,
    "messageId": "GHIJKL0987654321",
    "fromNumber": "9876543210@c.us",
    "toNumber": "1234567890@c.us",
    "contactName": null,
    "groupId": null,
    "messageType": "chat",
    "content": "Hello from WhatsApp Management System!",
    "timestamp": "2025-08-11T16:00:00.000Z",
    "webhookSent": true,
    "createdAt": "2025-08-11T16:00:00.000Z"
  }
}
```

### Webhooks

#### Handle Incoming Webhook

```
POST /webhook/:sessionId
```

Handles incoming webhook requests for a specific session.

**Request Body:**

```json
{
  "message_id": "ABCDEF1234567890",
  "reply_to": "1234567890@c.us",
  "reply_message": "This is a reply to your message"
}
```

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "message": "Reply sent successfully",
    "sentMessage": {
      "id": 3,
      "sessionId": 1,
      "messageId": "MNOPQR1234567890",
      "fromNumber": "9876543210@c.us",
      "toNumber": "1234567890@c.us",
      "contactName": null,
      "groupId": null,
      "messageType": "chat",
      "content": "This is a reply to your message",
      "timestamp": "2025-08-11T16:30:00.000Z",
      "webhookSent": true,
      "createdAt": "2025-08-11T16:30:00.000Z"
    }
  }
}
```

#### Register Webhook

```
POST /webhook/:sessionId/register
```

Registers a webhook for a specific session.

**Request Body:**

```json
{
  "url": "https://webhook.site/my-webhook",
  "secret": "my-secret-key",
  "events": ["message", "status"]
}
```

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "id": 2,
    "sessionId": 1,
    "url": "https://webhook.site/my-webhook",
    "secret": "my-secret-key",
    "events": ["message", "status"],
    "active": true,
    "createdAt": "2025-08-11T17:00:00.000Z"
  }
}
```

#### Get Webhooks for Session

```
GET /webhook/:sessionId
```

Returns webhooks for a specific session.

**Response Example:**

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "sessionId": 1,
      "url": "https://webhook.site/demo-webhook",
      "secret": "demo-secret",
      "events": ["message", "status"],
      "active": true,
      "createdAt": "2025-08-11T14:08:40.222Z"
    }
  ]
}
```

#### Delete Webhook

```
DELETE /webhook/:id
```

Deletes a webhook.

**Response Example:**

```json
{
  "status": "success",
  "message": "Webhook 1 deleted successfully"
}
```

## Webhook Payload Format

When a message is received, it will be forwarded to the configured webhook URL with the following payload format:

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
    "mediaUrl": null
  }
}
```

For messages with media, the `mediaUrl` field will contain the URL to access the media file.

## Error Handling

All API endpoints return appropriate HTTP status codes:

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include a message explaining the error:

```json
{
  "status": "error",
  "message": "Session with ID 999 not found"
}
```

## Rate Limiting

Currently, there is no rate limiting implemented. It is recommended to implement rate limiting for production use.

## Versioning

The API does not currently implement versioning. Future versions may include versioning in the URL path (e.g., `/api/v1/sessions`).

## Support

For issues or questions, please open an issue on the GitHub repository or contact the maintainers.
