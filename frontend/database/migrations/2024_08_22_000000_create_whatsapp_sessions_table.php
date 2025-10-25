<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('whatsapp_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('session_name');
            $table->string('webhook_url')->nullable();
            $table->string('status')->default('disconnected');
            $table->text('qr_code')->nullable();
            $table->json('session_data')->nullable();
            $table->timestamp('last_seen')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'session_name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('whatsapp_sessions');
    }
};
