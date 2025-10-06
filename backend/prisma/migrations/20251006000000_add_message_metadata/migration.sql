-- Add metadata fields to messages
ALTER TABLE "public"."messages" ADD COLUMN "chat_name" TEXT;
ALTER TABLE "public"."messages" ADD COLUMN "author" TEXT;
ALTER TABLE "public"."messages" ADD COLUMN "from_me" BOOLEAN NOT NULL DEFAULT false;

-- Ensure message IDs are unique per session
CREATE UNIQUE INDEX "messages_session_id_message_id_key" ON "public"."messages"("session_id", "message_id");
