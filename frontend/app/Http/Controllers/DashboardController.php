<?php

namespace App\Http\Controllers;

use App\Models\WhatsAppSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class DashboardController extends Controller
{
    public function index()
    {
        $sessions = collect();

        if (Schema::hasTable('whatsapp_sessions') && Auth::check()) {
            $sessions = Auth::user()->whatsappSessions()->latest()->get();
        }

        return view('dashboard', compact('sessions'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'session_name' => 'required|string|max:255',
            'webhook_url' => 'nullable|url',
        ]);

        if (!Schema::hasTable('whatsapp_sessions')) {
            return redirect()->route('dashboard')->with('error', 'Session storage is not available. Please run migrations.');
        }

        $session = Auth::user()->whatsappSessions()->create([
            'session_name' => $request->session_name,
            'webhook_url' => $request->webhook_url,
            'status' => 'disconnected',
        ]);

        // Call backend API to create session
        try {
            $response = Http::post($this->backendApiEndpoint('sessions'), [
                'session_id' => $session->id,
                'session_name' => $session->session_name,
                'webhook_url' => $session->webhook_url,
                'user_id' => Auth::id(),
            ]);

            // Backend session is created but not started automatically.
        } catch (\Exception $e) {
            // Log error but don't fail the creation
            logger()->error('Failed to create session in backend: ' . $e->getMessage());
        }

        return redirect()->route('dashboard')->with('success', 'Session created successfully!');
    }

    public function update(Request $request, WhatsAppSession $session)
    {
        $this->authorize('update', $session);

        $request->validate([
            'session_name' => 'required|string|max:255',
            'webhook_url' => 'nullable|url',
        ]);

        $session->update([
            'session_name' => $request->session_name,
            'webhook_url' => $request->webhook_url,
        ]);

        // Update backend
        try {
            Http::put($this->backendApiEndpoint("sessions/{$session->id}"), [
                'session_name' => $session->session_name,
                'webhook_url' => $session->webhook_url,
            ]);
        } catch (\Exception $e) {
            logger()->error('Failed to update session in backend: ' . $e->getMessage());
        }

        return redirect()->route('dashboard')->with('success', 'Session updated successfully!');
    }

    public function destroy(WhatsAppSession $session)
    {
        $this->authorize('delete', $session);

        // Delete from backend first
        try {
            Http::delete($this->backendApiEndpoint("sessions/{$session->id}"));
        } catch (\Exception $e) {
            logger()->error('Failed to delete session from backend: ' . $e->getMessage());
        }

        $session->delete();

        return redirect()->route('dashboard')->with('success', 'Session deleted successfully!');
    }

    public function getQr(WhatsAppSession $session)
    {
        $this->authorize('view', $session);

        try {
            $response = Http::get($this->backendApiEndpoint("sessions/{$session->id}/qr"));
            
            if ($response->successful()) {
                $payload = $response->json();
                $data = $payload['data'] ?? [];

                $session->update([
                    'qr_code' => $data['qr_code'] ?? null,
                    'status' => $data['status'] ?? $session->status,
                ]);

                return response()->json([
                    'qr_code' => $session->qr_code,
                    'status' => $session->status,
                ]);
            } else {
                logger()->error('QR fetch failed from backend', [
                    'session_id' => $session->id,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Exception $e) {
            logger()->error('Failed to get QR code: ' . $e->getMessage());
        }

        return response()->json(['error' => 'Failed to get QR code'], 500);
    }

    public function startSession(WhatsAppSession $session)
    {
        $this->authorize('update', $session);

        try {
            $response = Http::post($this->backendApiEndpoint("sessions/{$session->id}/start"));
            
            if ($response->successful()) {
                $payload = $response->json();
                $message = $payload['message'] ?? '';
                $qrCode = data_get($payload, 'data.qr_code');
                $status = data_get($payload, 'data.status');
                $isAlreadyConnected = Str::contains(Str::lower($message), 'already connected');

                $session->update([
                    'status' => $isAlreadyConnected ? 'connected' : ($status ?? 'connecting'),
                    'qr_code' => $qrCode ?? $session->qr_code,
                ]);

                return response()->json([
                    'success' => true,
                    'status' => $session->status,
                    'qr_code' => $session->qr_code,
                ]);
            } else {
                logger()->error('Start session failed from backend', [
                    'session_id' => $session->id,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Exception $e) {
            logger()->error('Failed to start session: ' . $e->getMessage());
        }

        return response()->json(['error' => 'Failed to start session'], 500);
    }

    public function stopSession(WhatsAppSession $session)
    {
        $this->authorize('update', $session);

        try {
            $response = Http::post($this->backendApiEndpoint("sessions/{$session->id}/stop"));
            
            if ($response->successful()) {
                $session->update(['status' => 'disconnected']);
                return response()->json(['success' => true]);
            }
        } catch (\Exception $e) {
            logger()->error('Failed to stop session: ' . $e->getMessage());
        }

        return response()->json(['error' => 'Failed to stop session'], 500);
    }

    /**
     * Build a backend API endpoint URL that respects internal routing.
     */
    protected function backendApiEndpoint(string $path): string
    {
        $baseApiUrl = config('app.backend_internal_api_url')
            ?? config('app.backend_api_url');

        if (!$baseApiUrl) {
            $baseUrlFallback = rtrim(config('app.backend_internal_url', config('app.backend_url')), '/');
            $baseApiUrl = Str::endsWith($baseUrlFallback, '/api')
                ? $baseUrlFallback
                : $baseUrlFallback . '/api';
        }

        $formattedPath = ltrim($path, '/');

        return rtrim($baseApiUrl, '/') . '/' . $formattedPath;
    }
}
