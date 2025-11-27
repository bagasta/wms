<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RequestLogger
{
    /**
     * Log basic request/response metadata for troubleshooting.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // Skip noisy/static assets
        if ($this->shouldSkip($request)) {
            return $next($request);
        }

        $start = microtime(true);
        $response = $next($request);

        $durationMs = (microtime(true) - $start) * 1000;
        $userId = optional($request->user())->id;
        $traceId = (string) Str::uuid();

        logger()->info('HTTP request', [
            'trace_id' => $traceId,
            'method' => $request->method(),
            'path' => '/' . ltrim($request->path(), '/'),
            'status' => $response->getStatusCode(),
            'duration_ms' => round($durationMs, 2),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'user_id' => $userId,
        ]);

        return $response;
    }

    protected function shouldSkip(Request $request): bool
    {
        $path = $request->path();

        // Ignore common static/health paths
        $skipPrefixes = [
            'storage/',
            'vendor/',
            'build/',
            'assets/',
            'favicon',
            'robots.txt',
        ];

        foreach ($skipPrefixes as $prefix) {
            if (Str::startsWith($path, $prefix)) {
                return true;
            }
        }

        return false;
    }
}
