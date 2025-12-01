# Troubleshooting: WhatsApp Session Connectivity & Status Issues

## Overview
This document details the issues encountered with WhatsApp session connectivity, where sessions were successfully connecting but the dashboard status remained stuck on "Connecting", and logs were inconsistent. It explains the root causes and the implemented solutions.

## Issue 1: Database Connection Pool Exhaustion
**Symptoms:**
- "Loading..." spinner on frontend spinning indefinitely.
- `cURL error 28: Operation timed out` in Laravel logs.
- Backend server becoming unresponsive.

**Root Cause:**
Multiple files (`sessionManager.js`, `messageHandler.js`, controllers, etc.) were each creating their own instance of `new PrismaClient()`. Each instance creates a separate connection pool to the database. This quickly exhausted the maximum allowable database connections, causing the server to hang while waiting for a free connection.

**Solution:**
- **Singleton Pattern:** Created a centralized `src/utils/prisma.js` file that exports a single shared instance of `PrismaClient`.
- **Refactoring:** Updated all files to import this singleton instance instead of creating new ones.

## Issue 2: Session Stuck in "Connecting" State
**Symptoms:**
- User scans QR code successfully.
- WhatsApp mobile app shows the device is linked.
- Dashboard status remains "Connecting" indefinitely.
- Logs might show "Ready" or "Authenticated" but the database status doesn't update.

**Root Causes:**
1.  **Missed Events:** The `ready` or `authenticated` events from the WhatsApp client were sometimes firing before the database update logic could execute or were being missed due to race conditions.
2.  **State Desynchronization:** The in-memory state of the bot was "Connected", but the database record remained "Connecting".

**Solution:**
We implemented a multi-layered "Self-Healing" mechanism to ensure the database always reflects the true state:

### 1. Periodic State Polling (`sessionManager.js`)
A timer runs every 5 seconds for each active session. It asks the WhatsApp client for its actual state (`client.getState()`).
- If the client reports `CONNECTED` but our local record isn't, we force an update to the database.

### 2. Activity-Based Healing (`messageHandler.js`)
If the system receives *any* incoming message for a session:
- It assumes the session **must** be connected (otherwise it wouldn't receive messages).
- It checks the database status. If it says "Connecting" (or anything else), it immediately forces an update to "Connected".

### 3. Dashboard Auto-Refresh (`dashboard.blade.php`)
The frontend now automatically refreshes the session list every 10 seconds (provided no modals are open). This ensures that once the backend heals the status, the user sees it without manual intervention.

## Issue 3: Group Mention Detection Failing
**Symptoms:**
- Bot ignores group messages even when it is explicitly mentioned, resulting in no webhook dispatch or automated reply.
- Logs show the `mentionedIds` array containing entries like `165971075592216@lid` while the bot’s stored ID remains a `@c.us` value.

**Root Cause:**
WhatsApp now serializes mentions as LIDs. The previous guard in `sessionManager.js` only compared `mentionedIds` to the bot’s known `@c.us` or cached `@lid` IDs. Because a freshly started session lacks a cached LID, all mentions resolved to `false` and the message was dropped before reaching `messageHandler`.

**Solution:**
- Added a fallback that calls `client.getContactLidAndPhone()` for the mentioned IDs, then compares the returned phone digits to the bot’s own digits.
- Once the mapping matches, `isMention` is set to `true`, the discovered LID is cached, and the message continues through the handler so webhooks/replies work even when WhatsApp uses LID addressing.

## Summary of Changes
- **Backend:**
    - `src/utils/prisma.js`: Singleton database client.
    - `src/services/sessionManager.js`: Added `stateCheckInterval` for periodic health checks.
    - `src/services/messageHandler.js`: Added logic to update status to "Connected" upon receiving any message.
- **Frontend:**
    - `dashboard.blade.php`: Added auto-refresh logic and "Starting..." UI feedback.
    - `src/services/sessionManager.js`: Added probabilistic mention detection so group mentions serialized as `@lid` still count for webhook/reply dispatch.

## How to Verify
1.  **Scan QR Code:** Status should update to "Connected" within 5-10 seconds.
2.  **Fallback:** If it remains "Connecting", send a message to the bot. The receipt of the message will trigger the self-healing logic and update the status immediately.
