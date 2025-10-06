<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">
                {{ __('WhatsApp Management System') }}
            </h2>
            <button onclick="openCreateModal()" class="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Add New Session +
            </button>
        </div>
    </x-slot>

    <div class="py-8 md:py-12 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Success/Error Messages -->
            @if(session('success'))
                <div class="bg-green-600/20 border border-green-600/50 text-green-400 p-4 rounded-xl mb-6 backdrop-blur-sm flex items-center gap-3">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    {{ session('success') }}
                </div>
            @endif

            @if(session('error'))
                <div class="bg-red-600/20 border border-red-600/50 text-red-400 p-4 rounded-xl mb-6 backdrop-blur-sm flex items-center gap-3">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    {{ session('error') }}
                </div>
            @endif

            <!-- Sessions Table -->
            <div class="bg-gray-800/80 backdrop-blur-sm overflow-hidden shadow-xl sm:rounded-2xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                <div class="p-4 sm:p-6 md:p-8">
                    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 md:mb-8 gap-4">
                        <h3 class="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
                            <span class="bg-orange-500 w-8 h-8 rounded-lg flex items-center justify-center">
                                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                                </svg>
                            </span>
                            Sessions
                        </h3>
                        <div class="text-xs sm:text-sm text-gray-400 bg-gray-700/50 px-3 py-1.5 rounded-full border border-gray-600/50 max-w-fit">
                            <span class="flex items-center gap-2">
                                <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                                <span class="truncate">{{ Auth::user()->name }}</span>
                            </span>
                        </div>
                    </div>

                    @if($sessions->count() > 0)
                        <!-- Desktop Table -->
                        <div class="hidden md:block overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-gray-700">
                                        <th class="pb-4 text-orange-400 font-semibold text-sm uppercase tracking-wider">Session Name</th>
                                        <th class="pb-4 text-orange-400 font-semibold text-sm uppercase tracking-wider">Webhook</th>
                                        <th class="pb-4 text-orange-400 font-semibold text-sm uppercase tracking-wider">Status</th>
                                        <th class="pb-4 text-orange-400 font-semibold text-sm uppercase tracking-wider text-right">Options</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($sessions as $session)
                                        <tr class="border-b border-gray-700/50 hover:bg-gray-700/30 transition-all duration-200 hover:scale-[1.01] transform">
                                            <td class="py-5 text-orange-400 font-medium">{{ $session->session_name }}</td>
                                            <td class="py-5 text-gray-300">
                                                @if($session->webhook_url)
                                                    <span class="text-sm bg-gray-700/50 px-3 py-1 rounded-full border border-gray-600/50">{{ Str::limit($session->webhook_url, 30) }}</span>
                                                @else
                                                    <span class="text-gray-500 text-sm bg-gray-800/50 px-3 py-1 rounded-full border border-gray-700">No webhook</span>
                                                @endif
                                            </td>
                                            <td class="py-5">
                                                <span class="px-3 py-1 rounded-full text-sm font-medium
                                                    @if($session->status === 'connected') bg-green-600/20 text-green-400 border border-green-600/50
                                                    @elseif($session->status === 'connecting') bg-yellow-600/20 text-yellow-400 border border-yellow-600/50
                                                    @else bg-red-600/20 text-red-400 border border-red-600/50
                                                    @endif">
                                                    {{ ucfirst($session->status) }}
                                                </span>
                                            </td>
                                            <td class="py-5">
                                                <div class="flex gap-2 justify-end">
                                                    @if($session->status === 'disconnected')
                                                        <button onclick="startSession({{ $session->id }})"
                                                                class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center gap-2">
                                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                            Start
                                                        </button>
                                                    @elseif($session->status === 'connecting')
                                                        <button onclick="showQrModal({{ $session->id }})"
                                                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center gap-2">
                                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                                                            </svg>
                                                            QR
                                                        </button>
                                                        <button onclick="stopSession({{ $session->id }})"
                                                                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center gap-2">
                                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
                                                            </svg>
                                                            Stop
                                                        </button>
                                                    @else
                                                        <button onclick="stopSession({{ $session->id }})"
                                                                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center gap-2">
                                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
                                                            </svg>
                                                            Stop
                                                        </button>
                                                    @endif

                                                    <button onclick="openChatModal({{ $session->id }}, @js($session->session_name))"
                                                            class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center gap-2">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.657-2.239 3-5 3-1.343 0-2.563-.272-3.5-.723L7 19l1.723-3.447C8.272 15.563 8 14.343 8 13c0-2.761 3.134-5 7-5s7 2.239 7 5z"></path>
                                                        </svg>
                                                        Chat
                                                    </button>

                                                    <button onclick="openEditModal({{ $session->id }}, '{{ $session->session_name }}', '{{ $session->webhook_url }}')"
                                                            class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center gap-2">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                                        </svg>
                                                        Edit
                                                    </button>

                                                    <button onclick="deleteSession({{ $session->id }})"
                                                            class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center gap-2">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                        </svg>
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>

                        <!-- Mobile Cards -->
                        <div class="md:hidden space-y-4">
                            @foreach($sessions as $session)
                                <div class="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50 hover:border-gray-500/50 transition-all duration-200 hover:scale-[1.02]">
                                    <div class="flex items-start justify-between mb-3">
                                        <div class="flex-1 min-w-0">
                                            <h4 class="text-orange-400 font-semibold text-lg truncate">{{ $session->session_name }}</h4>
                                            <div class="mt-2">
                                                <span class="px-3 py-1 rounded-full text-xs font-medium
                                                    @if($session->status === 'connected') bg-green-600/20 text-green-400 border border-green-600/50
                                                    @elseif($session->status === 'connecting') bg-yellow-600/20 text-yellow-400 border border-yellow-600/50
                                                    @else bg-red-600/20 text-red-400 border border-red-600/50
                                                    @endif">
                                                    {{ ucfirst($session->status) }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mb-3">
                                        <div class="text-xs text-gray-400 mb-1">Webhook</div>
                                        @if($session->webhook_url)
                                            <span class="text-xs bg-gray-600/50 px-2 py-1 rounded border border-gray-500/50 block truncate">{{ Str::limit($session->webhook_url, 40) }}</span>
                                        @else
                                            <span class="text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded border border-gray-700">No webhook</span>
                                        @endif
                                    </div>

                                    <div class="flex flex-wrap gap-2">
                                        @if($session->status === 'disconnected')
                                            <button onclick="startSession({{ $session->id }})"
                                                    class="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center gap-1 min-w-[80px]">
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                </svg>
                                                Start
                                            </button>
                                        @elseif($session->status === 'connecting')
                                            <button onclick="showQrModal({{ $session->id }})"
                                                    class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center gap-1 min-w-[60px]">
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                                                </svg>
                                                QR
                                            </button>
                                            <button onclick="stopSession({{ $session->id }})"
                                                    class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center gap-1 min-w-[60px]">
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
                                                </svg>
                                                Stop
                                            </button>
                                        @else
                                            <button onclick="stopSession({{ $session->id }})"
                                                    class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center gap-1 min-w-[60px]">
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
                                                </svg>
                                                Stop
                                            </button>
                                        @endif

                                        <button onclick="openChatModal({{ $session->id }}, @js($session->session_name))"
                                                class="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center gap-1 min-w-[60px]">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.657-2.239 3-5 3-1.343 0-2.563-.272-3.5-.723L7 19l1.723-3.447C8.272 15.563 8 14.343 8 13c0-2.761 3.134-5 7-5s7 2.239 7 5z"></path>
                                            </svg>
                                            Chat
                                        </button>

                                        <button onclick="openEditModal({{ $session->id }}, '{{ $session->session_name }}', '{{ $session->webhook_url }}')"
                                                class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center gap-1 min-w-[60px]">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                            </svg>
                                            Edit
                                        </button>

                                        <button onclick="deleteSession({{ $session->id }})"
                                                class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center gap-1 min-w-[60px]">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                            </svg>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    @else
                        <div class="text-center py-8 md:py-16">
                            <div class="mb-6">
                                <div class="w-16 h-16 md:w-24 md:h-24 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-500/30">
                                    <svg class="w-8 h-8 md:w-12 md:h-12 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                                    </svg>
                                </div>
                                <div class="text-gray-400 text-base md:text-lg mb-2">No sessions found</div>
                                <div class="text-gray-500 text-sm md:text-base">Create your first WhatsApp session to get started</div>
                            </div>
                            <button onclick="openCreateModal()" class="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 md:px-8 md:py-4 rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover:shadow-xl flex items-center gap-2 md:gap-3 mx-auto">
                                <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                </svg>
                                <span class="text-sm md:text-base">Create Your First Session</span>
                            </button>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>

    <!-- Create Session Modal -->
    <div id="createModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm hidden items-center justify-center z-50 transition-all duration-300 p-4">
        <div class="bg-gray-800/95 backdrop-blur-md p-6 md:p-8 rounded-2xl w-full max-w-md border border-orange-400/50 shadow-2xl transform transition-all duration-300 scale-95 hover:scale-100">
            <div class="flex items-center gap-3 mb-6">
                <div class="bg-orange-500 w-10 h-10 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-white">NEW SESSION</h3>
            </div>
            <form action="{{ route('sessions.store') }}" method="POST">
                @csrf
                <div class="mb-6">
                    <label class="block text-orange-400 text-sm font-medium mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Session Name
                    </label>
                    <input type="text" name="session_name" required
                           class="w-full px-4 py-3 bg-gray-700/80 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500 transition-all duration-200"
                           placeholder="Enter session name">
                </div>
                <div class="mb-8">
                    <label class="block text-orange-400 text-sm font-medium mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                        </svg>
                        Webhook URL
                    </label>
                    <input type="url" name="webhook_url"
                           class="w-full px-4 py-3 bg-gray-700/80 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500 transition-all duration-200"
                           placeholder="https://example.com/webhook">
                </div>
                <div class="flex flex-col sm:flex-row justify-end gap-3">
                    <button type="button" onclick="closeCreateModal()"
                            class="px-6 py-3 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        Cancel
                    </button>
                    <button type="submit"
                            class="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Create Session
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Edit Session Modal -->
    <div id="editModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm hidden items-center justify-center z-50 transition-all duration-300 p-4">
        <div class="bg-gray-800/95 backdrop-blur-md p-6 md:p-8 rounded-2xl w-full max-w-md border border-orange-400/50 shadow-2xl transform transition-all duration-300 scale-95 hover:scale-100">
            <div class="flex items-center gap-3 mb-6">
                <div class="bg-yellow-500 w-10 h-10 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-white">EDIT SESSION</h3>
            </div>
            <form id="editForm" method="POST">
                @csrf
                @method('PUT')
                <div class="mb-6">
                    <label class="block text-orange-400 text-sm font-medium mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Session Name
                    </label>
                    <input type="text" id="editSessionName" name="session_name" required
                           class="w-full px-4 py-3 bg-gray-700/80 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500 transition-all duration-200"
                           placeholder="Enter session name">
                </div>
                <div class="mb-8">
                    <label class="block text-orange-400 text-sm font-medium mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                        </svg>
                        Webhook URL
                    </label>
                    <input type="url" id="editWebhookUrl" name="webhook_url"
                           class="w-full px-4 py-3 bg-gray-700/80 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500 transition-all duration-200"
                           placeholder="https://example.com/webhook">
                </div>
                <div class="flex flex-col sm:flex-row justify-end gap-3">
                    <button type="button" onclick="closeEditModal()"
                            class="px-6 py-3 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        Cancel
                    </button>
                    <button type="submit"
                            class="px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white rounded-xl font-medium hover:from-yellow-700 hover:to-yellow-800 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        Update Session
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- QR Code Modal -->
    <div id="qrModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm hidden items-center justify-center z-50 transition-all duration-300 p-4">
        <div class="bg-gray-800/95 backdrop-blur-md p-6 md:p-8 rounded-2xl w-full max-w-md border border-orange-400/50 shadow-2xl transform transition-all duration-300 scale-95 hover:scale-100">
            <div class="flex items-center gap-3 mb-6">
                <div class="bg-blue-500 w-10 h-10 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-white">Scan QR Code</h3>
            </div>
            <div class="text-center">
                <div id="qrCodeContainer" class="mb-6">
                    <div class="w-48 h-48 md:w-64 md:h-64 bg-gray-700/80 border-2 border-dashed border-gray-600 rounded-xl mx-auto flex items-center justify-center backdrop-blur-sm">
                        <div class="text-center">
                            <svg class="w-12 h-12 text-gray-400 mx-auto mb-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span class="text-gray-400">Loading QR Code...</span>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-700/50 rounded-xl p-4 mb-6 border border-gray-600/50">
                    <p class="text-gray-300 text-sm leading-relaxed">
                        <span class="text-orange-400 font-medium">Important:</span> Session Name & Webhook URL will remain the same, but the WhatsApp session will be deleted and recreated.
                    </p>
                </div>
                <button onclick="closeQrModal()"
                        class="px-6 py-3 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 mx-auto w-full sm:w-auto">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Close
                </button>
            </div>
        </div>
    </div>

    <!-- Chat Modal -->
    <div id="chatModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden items-center justify-center z-50 p-4">
        <div class="bg-gray-900/95 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800/60">
                <div>
                    <p class="text-xs uppercase tracking-wider text-gray-500">Active Session</p>
                    <h3 id="chatSessionTitle" class="text-2xl font-semibold text-white mt-1">Session</h3>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="openGroupPicker()"
                            class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Extract Group Numbers
                    </button>
                    <button onclick="closeChatModal()"
                            class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        Close
                    </button>
                </div>
            </div>
            <div class="flex flex-1 overflow-hidden">
                <div class="w-72 lg:w-80 xl:w-96 flex-shrink-0 bg-gray-900/80 border-r border-gray-800/60 flex flex-col">
                    <div class="p-4 border-b border-gray-800/60">
                        <div class="relative">
                            <input id="chatSearchInput" type="text"
                                   class="w-full bg-gray-800/80 border border-gray-700 rounded-xl py-2 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                   placeholder="Search conversations"
                                   oninput="filterChatConversations(this.value)">
                            <svg class="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 17a6 6 0 100-12 6 6 0 000 12z"></path>
                            </svg>
                        </div>
                    </div>
                    <div id="chatConversationList" class="flex-1 overflow-y-auto custom-scrollbar">
                        <div class="h-full flex items-center justify-center text-sm text-gray-500 px-6 text-center">
                            Loading conversations...
                        </div>
                    </div>
                </div>
                <div class="flex-1 flex flex-col bg-gray-900/60">
                    <div id="chatThreadHeader" class="hidden border-b border-gray-800/60 px-4 md:px-6 py-4">
                        <div>
                            <h4 id="chatThreadTitle" class="text-xl font-semibold text-white"></h4>
                            <p id="chatThreadSubtitle" class="text-sm text-gray-400 mt-1"></p>
                        </div>
                    </div>
                    <div id="chatPlaceholder" class="flex-1 flex items-center justify-center text-gray-500 text-sm px-6 text-center">
                        Select a conversation to view the message history.
                    </div>
                    <div id="chatMessagesContainer" class="hidden flex-1 overflow-y-auto px-3 md:px-6 py-6 space-y-3 custom-scrollbar bg-gray-900/40">
                        <!-- Messages rendered dynamically -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Group Picker Modal -->
    <div id="groupPickerModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden items-center justify-center z-50 p-4">
        <div class="bg-gray-900/95 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
                <div>
                    <h3 class="text-xl font-semibold text-white">Extract Group Numbers</h3>
                    <p id="groupSessionLabel" class="text-sm text-gray-400 mt-1"></p>
                </div>
                <button onclick="closeGroupPicker()"
                        class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Close
                </button>
            </div>
            <div class="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                <div>
                    <label class="text-xs uppercase tracking-wider text-gray-500">Filter Groups</label>
                    <div class="relative mt-2">
                        <input id="groupSearchInput" type="text"
                               class="w-full bg-gray-800/80 border border-gray-700 rounded-xl py-2 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                               placeholder="Search by group name"
                               oninput="filterGroupList(this.value)">
                        <svg class="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 17a6 6 0 100-12 6 6 0 000 12z"></path>
                        </svg>
                    </div>
                </div>
                <div id="groupListContainer" class="border border-gray-800/60 rounded-xl bg-gray-900/70 max-h-56 overflow-y-auto custom-scrollbar p-2 space-y-2 text-sm text-gray-200">
                    <div class="text-center text-gray-500 py-8">Loading groups...</div>
                </div>
                <div id="groupMembersContainer" class="hidden border border-gray-800/60 rounded-xl bg-gray-900/70">
                    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
                        <div>
                            <p class="text-xs uppercase tracking-wider text-gray-500">Selected Group</p>
                            <h4 id="selectedGroupName" class="text-lg font-semibold text-white"></h4>
                            <p class="text-sm text-gray-400 mt-1">Members: <span id="groupMembersCount">0</span></p>
                        </div>
                        <button onclick="copyGroupMembers()"
                                class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V5a2 2 0 012-2h6.5A2.5 2.5 0 0119 5.5V15a2 2 0 01-2 2h-2"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5.5A2.5 2.5 0 003 9.5v9A2.5 2.5 0 005.5 21h9a2.5 2.5 0 002.5-2.5V17"></path>
                            </svg>
                            Copy Numbers
                        </button>
                    </div>
                    <div class="max-h-48 overflow-y-auto px-4 py-3 custom-scrollbar">
                        <ul id="groupMembersList" class="space-y-2 text-sm text-gray-200">
                            <!-- Members rendered dynamically -->
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <style>
        .typing-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .typing-indicator .typing-dot {
            width: 6px;
            height: 6px;
            border-radius: 9999px;
            background-color: rgba(255, 255, 255, 0.75);
            opacity: 0.5;
            animation: typingBounce 1.2s infinite ease-in-out;
        }

        .typing-indicator.typing-indicator-dark .typing-dot {
            background-color: rgba(16, 185, 129, 0.85);
        }

        .typing-indicator .typing-dot:nth-child(1) {
            animation-delay: 0s;
        }

        .typing-indicator .typing-dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-indicator .typing-dot:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typingBounce {
            0%, 80%, 100% {
                transform: translateY(0);
                opacity: 0.5;
            }
            40% {
                transform: translateY(-3px);
                opacity: 1;
            }
        }
    </style>

    <script>
        const backendApiBase = @json(config('app.backend_url') . '/api');

        const chatState = {
            isOpen: false,
            sessionId: null,
            sessionName: '',
            messages: [],
            chatList: [],
            conversations: [],
            filteredConversations: [],
            selectedConversationId: null,
            chatSearchTerm: '',
            chatRefreshTimer: null,
            groups: [],
            filteredGroups: [],
            groupMembers: [],
            selectedGroupId: null
        };

        const chatModalEl = document.getElementById('chatModal');
        const chatSessionTitleEl = document.getElementById('chatSessionTitle');
        const chatConversationListEl = document.getElementById('chatConversationList');
        const chatMessagesContainerEl = document.getElementById('chatMessagesContainer');
        const chatPlaceholderEl = document.getElementById('chatPlaceholder');
        const chatThreadHeaderEl = document.getElementById('chatThreadHeader');
        const chatThreadTitleEl = document.getElementById('chatThreadTitle');
        const chatThreadSubtitleEl = document.getElementById('chatThreadSubtitle');
        const chatSearchInputEl = document.getElementById('chatSearchInput');

        const groupModalEl = document.getElementById('groupPickerModal');
        const groupSessionLabelEl = document.getElementById('groupSessionLabel');
        const groupListContainerEl = document.getElementById('groupListContainer');
        const groupMembersContainerEl = document.getElementById('groupMembersContainer');
        const groupMembersListEl = document.getElementById('groupMembersList');
        const groupMembersCountEl = document.getElementById('groupMembersCount');
        const selectedGroupNameEl = document.getElementById('selectedGroupName');
        const groupSearchInputEl = document.getElementById('groupSearchInput');

        function openChatModal(sessionId, sessionName) {
            if (chatState.chatRefreshTimer) {
                clearInterval(chatState.chatRefreshTimer);
                chatState.chatRefreshTimer = null;
            }

            chatState.isOpen = true;
            chatState.sessionId = sessionId;
            chatState.sessionName = sessionName || 'Session';
            chatState.messages = [];
            chatState.chatList = [];
            chatState.conversations = [];
            chatState.filteredConversations = [];
            chatState.selectedConversationId = null;
            chatState.chatSearchTerm = '';

            chatSessionTitleEl.textContent = chatState.sessionName;

            if (chatSearchInputEl) {
                chatSearchInputEl.value = '';
            }

            chatModalEl.classList.remove('hidden');
            chatModalEl.classList.add('flex');

            chatConversationListEl.innerHTML = '<div class="h-full flex items-center justify-center text-sm text-gray-500 px-6 text-center">Loading conversations...</div>';
            chatPlaceholderEl.classList.remove('hidden');
            chatMessagesContainerEl.classList.add('hidden');
            chatThreadHeaderEl.classList.add('hidden');
            chatThreadTitleEl.textContent = '';
            chatThreadSubtitleEl.textContent = '';

            refreshChatData({ resetSelection: true });

            chatState.chatRefreshTimer = setInterval(() => {
                if (!chatState.isOpen || !chatState.sessionId) {
                    return;
                }
                refreshChatData({ preserveSelection: true, silent: true });
            }, 7000);
        }

        function closeChatModal() {
            chatState.isOpen = false;
            chatState.sessionId = null;
            chatState.sessionName = '';
            chatState.selectedConversationId = null;

            if (chatState.chatRefreshTimer) {
                clearInterval(chatState.chatRefreshTimer);
                chatState.chatRefreshTimer = null;
            }

            chatModalEl.classList.add('hidden');
            chatModalEl.classList.remove('flex');
        }

        async function refreshChatData({ resetSelection = false, preserveSelection = true, silent = false } = {}) {
            if (!chatState.sessionId) {
                return;
            }

            try {
                const [messagesResponse, chatsResponse] = await Promise.all([
                    fetch(`${backendApiBase}/messages/session/${chatState.sessionId}?limit=500`),
                    fetch(`${backendApiBase}/sessions/${chatState.sessionId}/chats`)
                ]);

                if (!messagesResponse.ok) {
                    throw new Error('Failed to fetch messages');
                }

                if (!chatsResponse.ok) {
                    throw new Error('Failed to fetch chats');
                }

                const payload = await messagesResponse.json();
                const chatsPayload = await chatsResponse.json();

                const messages = (payload?.data?.messages || []).map((message) => ({
                    ...message,
                    timestamp: message.timestamp ? new Date(message.timestamp) : null
                }));

                messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const chatList = (chatsPayload?.data || []).map((chat) => ({
                    ...chat,
                    lastMessageTimestamp: chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp) : null
                }));

                chatState.messages = messages;
                chatState.chatList = chatList;

                const conversations = buildChatConversations(messages, chatList);
                chatState.conversations = conversations;

                if (resetSelection) {
                    chatState.selectedConversationId = null;
                }

                filterChatConversations(chatState.chatSearchTerm || '', { skipRender: true });

                if (chatState.filteredConversations.length === 0) {
                    chatConversationListEl.innerHTML = '<div class="h-full flex items-center justify-center text-sm text-gray-500 px-6 text-center">No chats found yet. Start a conversation to see it here.</div>';
                    chatMessagesContainerEl.classList.add('hidden');
                    chatPlaceholderEl.classList.remove('hidden');
                    chatThreadHeaderEl.classList.add('hidden');
                    return;
                }

                renderConversationList();

                if (preserveSelection && chatState.selectedConversationId) {
                    const existing = chatState.conversations.find((item) => item.id === chatState.selectedConversationId);
                    if (existing) {
                        renderActiveConversation(existing);
                        return;
                    }
                }

                const firstConversation = chatState.filteredConversations[0] || chatState.conversations[0];
                if (firstConversation) {
                    selectConversation(firstConversation.id, { skipRebuild: true });
                }
            } catch (error) {
                if (!silent) {
                    console.error('Error refreshing chat data:', error);
                }
                chatConversationListEl.innerHTML = '<div class="h-full flex items-center justify-center text-sm text-red-500 px-6 text-center">Unable to load conversations. Please try again.</div>';
            }
        }

        function buildChatConversations(messages, chats) {
            const conversationMap = new Map();

            (chats || []).forEach((chat) => {
                if (!chat || !chat.id) {
                    return;
                }

                if (!conversationMap.has(chat.id)) {
                    conversationMap.set(chat.id, {
                        id: chat.id,
                        name: chat.name,
                        isGroup: Boolean(chat.isGroup),
                        isTyping: Boolean(chat.isTyping),
                        unreadCount: Number.isFinite(chat.unreadCount) ? chat.unreadCount : 0,
                        isMuted: Boolean(chat.isMuted),
                        isArchived: Boolean(chat.isArchived),
                        lastMessagePreview: chat.lastMessagePreview || null,
                        lastMessageFromMe: chat.lastMessageFromMe || null,
                        lastMessageTimestamp: chat.lastMessageTimestamp || null,
                        messages: []
                    });
                } else {
                    const trackedConversation = conversationMap.get(chat.id);
                    trackedConversation.isTyping = Boolean(chat.isTyping);
                    if (Number.isFinite(chat.unreadCount)) {
                        trackedConversation.unreadCount = chat.unreadCount;
                    }
                    if (chat.lastMessagePreview) {
                        trackedConversation.lastMessagePreview = chat.lastMessagePreview;
                    }
                    if (chat.lastMessageFromMe !== undefined && chat.lastMessageFromMe !== null) {
                        trackedConversation.lastMessageFromMe = chat.lastMessageFromMe;
                    }
                    if (chat.lastMessageTimestamp) {
                        trackedConversation.lastMessageTimestamp = chat.lastMessageTimestamp;
                    }
                }
            });

            messages.forEach((message) => {
                const conversationId = message.groupId || (message.fromMe ? message.toNumber : message.fromNumber) || message.chatName || message.contactName;
                if (!conversationId) {
                    return;
                }

                if (!conversationMap.has(conversationId)) {
                    conversationMap.set(conversationId, {
                        id: conversationId,
                        isGroup: Boolean(message.groupId),
                        groupId: message.groupId || null,
                        name: resolveConversationName(message),
                        isTyping: false,
                        unreadCount: 0,
                        isMuted: false,
                        isArchived: false,
                        lastMessagePreview: null,
                        lastMessageFromMe: null,
                        lastMessageTimestamp: null,
                        messages: []
                    });
                }

                const conversation = conversationMap.get(conversationId);
                if (!conversation.name) {
                    conversation.name = resolveConversationName(message);
                }

                conversation.messages.push(message);
            });

            const conversations = Array.from(conversationMap.values()).map((conversation) => {
                conversation.messages.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
                conversation.lastMessage = conversation.messages[conversation.messages.length - 1] || null;

                if (conversation.lastMessage) {
                    conversation.lastMessagePreview = conversation.lastMessage.content || conversation.lastMessage.messageType || conversation.lastMessagePreview;
                    conversation.lastMessageTimestamp = conversation.lastMessage.timestamp || conversation.lastMessageTimestamp;
                    conversation.lastMessageFromMe = conversation.lastMessage.fromMe;
                }

                if (conversation.isTyping && conversation.lastMessageTimestamp) {
                    const lastTimestamp = new Date(conversation.lastMessageTimestamp).getTime();
                    if (!Number.isNaN(lastTimestamp) && Date.now() - lastTimestamp > 600000) {
                        conversation.isTyping = false;
                    }
                }

                conversation.avatar = buildAvatarInitials(conversation.name);
                return conversation;
            });

            conversations.sort((a, b) => {
                const aTime = conversationTimestampValue(a);
                const bTime = conversationTimestampValue(b);
                return bTime - aTime;
            });

            return conversations;
        }

        function resolveConversationName(message) {
            if (message.groupId) {
                return message.chatName || message.contactName || formatGroupIdentifier(message.groupId);
            }

            if (message.chatName) {
                return message.chatName;
            }

            if (message.contactName) {
                return message.contactName;
            }

            const identifier = message.fromMe ? message.toNumber : message.fromNumber;
            return formatPhone(identifier);
        }

        function buildAvatarInitials(name) {
            if (!name) {
                return '?';
            }

            const parts = name.trim().split(/\s+/).filter(Boolean);
            if (parts.length === 0) {
                return name.slice(0, 2).toUpperCase();
            }

            return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
        }

        function formatPhone(identifier) {
            if (!identifier || typeof identifier !== 'string') {
                return 'Unknown';
            }

            const sanitized = identifier.split('@')[0];
            if (!sanitized) {
                return 'Unknown';
            }

            if (sanitized.startsWith('+')) {
                return sanitized;
            }

            return sanitized.startsWith('0') ? sanitized : `+${sanitized}`;
        }

        function formatGroupIdentifier(identifier) {
            if (!identifier || typeof identifier !== 'string') {
                return 'Group';
            }

            const sanitized = identifier.replace('@g.us', '');
            return sanitized ? `Group ${sanitized}` : 'Group';
        }

        function renderConversationList() {
            const conversations = chatState.filteredConversations || [];
            chatConversationListEl.innerHTML = '';

            if (conversations.length === 0) {
                chatConversationListEl.innerHTML = '<div class="h-full flex items-center justify-center text-sm text-gray-500 px-6 text-center">No conversations found.</div>';
                return;
            }

            conversations.forEach((conversation) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `w-full text-left px-4 py-3 border-b border-gray-800/50 transition duration-150 ${
                    chatState.selectedConversationId === conversation.id
                        ? 'bg-emerald-600/20 border border-emerald-500/40'
                        : 'hover:bg-gray-800/60'
                }`;
                button.onclick = () => selectConversation(conversation.id);

                const wrapper = document.createElement('div');
                wrapper.className = 'flex items-center gap-3';

                const avatar = document.createElement('div');
                avatar.className = `w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                    conversation.isGroup ? 'bg-emerald-600/80 text-white' : 'bg-gray-700 text-gray-200'
                }`;
                avatar.textContent = conversation.avatar || '?';

                const content = document.createElement('div');
                content.className = 'flex-1 min-w-0';

                const titleRow = document.createElement('div');
                titleRow.className = 'flex items-center justify-between gap-2';

                const nameEl = document.createElement('p');
                nameEl.className = 'font-semibold text-gray-100 truncate';
                nameEl.textContent = conversation.name || 'Unknown';

                const metaWrapper = document.createElement('div');
                metaWrapper.className = 'flex items-center gap-2 flex-shrink-0';

                const timeEl = document.createElement('span');
                timeEl.className = 'text-xs text-gray-500';
                const timeValue = conversationTimestampValue(conversation);
                timeEl.textContent = timeValue ? formatTimestamp(timeValue) : '';

                metaWrapper.appendChild(timeEl);

                if (conversation.unreadCount > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'inline-flex items-center justify-center bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full';
                    badge.textContent = conversation.unreadCount > 99 ? '99+' : conversation.unreadCount;
                    metaWrapper.appendChild(badge);
                }

                titleRow.appendChild(nameEl);
                titleRow.appendChild(metaWrapper);

                const previewEl = document.createElement('div');
                previewEl.className = 'text-xs text-gray-400 truncate mt-1 flex items-center gap-2';
                previewEl.style.minHeight = '16px';

                if (conversation.isTyping) {
                    previewEl.classList.remove('text-gray-400', 'truncate');
                    previewEl.classList.add('text-emerald-300', 'font-medium');

                    const indicator = createTypingIndicatorElement({ compact: true });
                    previewEl.appendChild(indicator);

                    const label = document.createElement('span');
                    label.textContent = 'Typing…';
                    previewEl.appendChild(label);
                } else {
                    previewEl.textContent = resolveConversationPreview(conversation);
                }

                content.appendChild(titleRow);
                content.appendChild(previewEl);

                wrapper.appendChild(avatar);
                wrapper.appendChild(content);

                button.appendChild(wrapper);
                chatConversationListEl.appendChild(button);
            });
        }

        function conversationTimestampValue(conversation) {
            if (!conversation) {
                return 0;
            }

            const source = conversation.lastMessageTimestamp || conversation.lastMessage?.timestamp;
            if (!source) {
                return 0;
            }

            const date = source instanceof Date ? source : new Date(source);
            return Number.isNaN(date.getTime()) ? 0 : date.getTime();
        }

        function formatTimestamp(value) {
            if (!value) {
                return '';
            }

            const date = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(date.getTime())) {
                return '';
            }

            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function formatMessagePreview(message) {
            if (!message) {
                return '';
            }

            if (message.messageType && message.messageType !== 'chat') {
                return `[${message.messageType.toUpperCase()}]`.trim();
            }

            const content = message.content || '';
            return content.length > 60 ? `${content.slice(0, 57)}...` : content;
        }

        function resolveConversationPreview(conversation) {
            if (!conversation) {
                return '';
            }

            if (conversation.isTyping) {
                return 'typing...';
            }

            if (conversation.lastMessage) {
                return formatMessagePreview(conversation.lastMessage);
            }

            if (conversation.lastMessagePreview) {
                const preview = conversation.lastMessagePreview;
                return preview.length > 60 ? `${preview.slice(0, 57)}...` : preview;
            }

            return conversation.isGroup ? 'No messages yet in this group.' : 'No messages yet.';
        }

        function selectConversation(conversationId, options = {}) {
            const { skipRebuild = false } = options;
            chatState.selectedConversationId = conversationId;
            const conversation = (chatState.conversations || []).find((item) => item.id === conversationId);

            if (!conversation) {
                return;
            }

            if (!skipRebuild) {
                renderConversationList();
            }

            renderActiveConversation(conversation);
        }

        function renderActiveConversation(conversation) {
            chatThreadHeaderEl.classList.remove('hidden');
            chatThreadTitleEl.textContent = conversation.name || 'Conversation';

            const messageCount = conversation.messages.length;
            const subtitleParts = [
                `${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`
            ];

            if (conversation.isGroup) {
                subtitleParts.push('Group chat');
            }

            if (conversation.isTyping) {
                subtitleParts.push('Typing…');
            }

            chatThreadSubtitleEl.textContent = subtitleParts.join(' • ');

            renderMessageThread(conversation);
        }

        function renderMessageThread(conversation) {
            chatPlaceholderEl.classList.add('hidden');
            chatMessagesContainerEl.classList.remove('hidden');
            chatMessagesContainerEl.innerHTML = '';

            const hasMessages = conversation.messages.length > 0;

            if (!hasMessages) {
                const emptyState = document.createElement('div');
                emptyState.className = 'text-sm text-gray-400 text-center py-12';
                emptyState.textContent = conversation.isGroup
                    ? 'No messages yet. Say hello to start this group conversation.'
                    : 'No messages yet in this chat.';
                chatMessagesContainerEl.appendChild(emptyState);
            } else {
                conversation.messages.forEach((message) => {
                    chatMessagesContainerEl.appendChild(createMessageRow(message, conversation));
                });
            }

            if (conversation.isTyping) {
                const typingRow = document.createElement('div');
                typingRow.className = 'flex justify-start mt-2';

                const typingBubble = document.createElement('div');
                typingBubble.className = 'inline-flex items-center bg-gray-800/90 text-gray-100 rounded-2xl rounded-bl-md px-4 py-2 shadow';
                typingBubble.appendChild(createTypingIndicatorElement());

                typingRow.appendChild(typingBubble);
                chatMessagesContainerEl.appendChild(typingRow);
            }

            scrollMessagesToBottom();
        }

        function createMessageRow(message, conversation) {
            const row = document.createElement('div');
            row.className = `flex ${message.fromMe ? 'justify-end' : 'justify-start'}`;

            const bubble = document.createElement('div');
            bubble.className = `max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow ${
                message.fromMe ? 'bg-emerald-600/80 text-white rounded-br-md' : 'bg-gray-800/90 text-gray-100 rounded-bl-md'
            } whitespace-pre-wrap break-words`;

            if (conversation.isGroup && !message.fromMe && message.contactName) {
                const author = document.createElement('div');
                author.className = 'text-xs font-semibold text-emerald-300 mb-1';
                author.textContent = message.contactName;
                bubble.appendChild(author);
            }

            const content = document.createElement('div');
            content.textContent = message.content || '';
            bubble.appendChild(content);

            const meta = document.createElement('div');
            meta.className = `text-[10px] mt-1 ${message.fromMe ? 'text-white/70 text-right' : 'text-gray-400 text-right'}`;
            meta.textContent = formatFullTimestamp(message.timestamp);
            bubble.appendChild(meta);

            row.appendChild(bubble);
            return row;
        }

        function createTypingIndicatorElement(options = {}) {
            const { compact = false } = options;
            const indicator = document.createElement('div');
            indicator.className = `typing-indicator ${compact ? 'typing-indicator-dark' : ''}`;

            if (compact) {
                indicator.style.transform = 'scale(0.85)';
                indicator.style.transformOrigin = 'left center';
            }

            for (let i = 0; i < 3; i += 1) {
                const dot = document.createElement('span');
                dot.className = 'typing-dot';
                indicator.appendChild(dot);
            }

            return indicator;
        }

        function formatFullTimestamp(value) {
            if (!value) {
                return '';
            }

            const date = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(date.getTime())) {
                return '';
            }

            return date.toLocaleString([], {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function filterChatConversations(term, options = {}) {
            const { skipRender = false } = options;
            chatState.chatSearchTerm = term;

            const query = (term || '').trim().toLowerCase();

            if (!query) {
                chatState.filteredConversations = chatState.conversations;
            } else {
                chatState.filteredConversations = chatState.conversations.filter((conversation) => {
                    const haystack = `${conversation.name} ${resolveConversationPreview(conversation)}`.toLowerCase();
                    return haystack.includes(query);
                });
            }

            if (!skipRender) {
                renderConversationList();
            }
        }

        function scrollMessagesToBottom() {
            requestAnimationFrame(() => {
                chatMessagesContainerEl.scrollTop = chatMessagesContainerEl.scrollHeight;
            });
        }

        function openGroupPicker() {
            if (!chatState.sessionId) {
                alert('Open a session to extract group members.');
                return;
            }

            groupSessionLabelEl.textContent = `Session: ${chatState.sessionName}`;
            if (groupSearchInputEl) {
                groupSearchInputEl.value = '';
            }

            chatState.filteredGroups = chatState.groups;
            chatState.selectedGroupId = null;
            chatState.groupMembers = [];

            groupMembersContainerEl.classList.add('hidden');
            renderGroupListPlaceholder('Loading groups...');

            groupModalEl.classList.remove('hidden');
            groupModalEl.classList.add('flex');

            fetchGroups();
        }

        function closeGroupPicker() {
            chatState.selectedGroupId = null;
            chatState.groupMembers = [];
            groupModalEl.classList.add('hidden');
            groupModalEl.classList.remove('flex');
        }

        async function fetchGroups(force = false) {
            if (!chatState.sessionId) {
                return;
            }

            if (chatState.groups.length && !force) {
                chatState.filteredGroups = chatState.groups;
                renderGroupList();
                return;
            }

            try {
                const response = await fetch(`${backendApiBase}/sessions/${chatState.sessionId}/groups`);
                if (!response.ok) {
                    throw new Error('Failed to load groups');
                }

                const payload = await response.json();
                const groups = payload?.data || [];

                chatState.groups = groups.map((group) => ({
                    id: group.id,
                    name: group.name || formatGroupIdentifier(group.id),
                    participants: group.participants || 0
                }));

                chatState.filteredGroups = chatState.groups;
                renderGroupList();
            } catch (error) {
                console.error('Error loading groups:', error);
                renderGroupListPlaceholder('Unable to load groups. Please try again.');
            }
        }

        function renderGroupList() {
            const groups = chatState.filteredGroups || [];
            groupListContainerEl.innerHTML = '';

            if (groups.length === 0) {
                renderGroupListPlaceholder('No groups match your search.');
                return;
            }

            groups.forEach((group) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'w-full text-left bg-gray-800/60 hover:bg-emerald-600/30 border border-gray-800 hover:border-emerald-500 rounded-xl px-4 py-3 transition duration-150';
                button.onclick = () => selectGroup(group.id);

                const row = document.createElement('div');
                row.className = 'flex items-center justify-between gap-3';

                const info = document.createElement('div');
                info.className = 'flex-1 min-w-0';

                const nameEl = document.createElement('p');
                nameEl.className = 'font-semibold text-gray-100 truncate';
                nameEl.textContent = group.name;

                const countEl = document.createElement('p');
                countEl.className = 'text-xs text-gray-400 mt-1';
                countEl.textContent = `${group.participants} members`;

                info.appendChild(nameEl);
                info.appendChild(countEl);

                const icon = document.createElement('svg');
                icon.setAttribute('class', 'w-4 h-4 text-gray-500 flex-shrink-0');
                icon.setAttribute('fill', 'none');
                icon.setAttribute('stroke', 'currentColor');
                icon.setAttribute('viewBox', '0 0 24 24');
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';

                row.appendChild(info);
                row.appendChild(icon);

                button.appendChild(row);
                groupListContainerEl.appendChild(button);
            });
        }

        function renderGroupListPlaceholder(text) {
            groupListContainerEl.innerHTML = '';
            const placeholder = document.createElement('div');
            placeholder.className = 'text-center text-gray-500 py-8';
            placeholder.textContent = text;
            groupListContainerEl.appendChild(placeholder);
        }

        function filterGroupList(term) {
            const query = term.trim().toLowerCase();

            if (!query) {
                chatState.filteredGroups = chatState.groups;
            } else {
                chatState.filteredGroups = chatState.groups.filter((group) =>
                    group.name.toLowerCase().includes(query)
                );
            }

            renderGroupList();
        }

        async function selectGroup(groupId) {
            const group = chatState.groups.find((item) => item.id === groupId);
            if (!group) {
                return;
            }

            chatState.selectedGroupId = groupId;
            selectedGroupNameEl.textContent = group.name;
            renderGroupMembersPlaceholder('Loading members...');
            groupMembersContainerEl.classList.remove('hidden');

            try {
                const response = await fetch(`${backendApiBase}/sessions/${chatState.sessionId}/groups/${encodeURIComponent(groupId)}/members`);
                if (!response.ok) {
                    throw new Error('Failed to load members');
                }

                const payload = await response.json();
                const members = payload?.data || [];
                chatState.groupMembers = members;
                renderGroupMembers(members);
            } catch (error) {
                console.error('Error loading group members:', error);
                renderGroupMembersPlaceholder('Unable to load members. Please try again.');
            }
        }

        function renderGroupMembers(members) {
            groupMembersListEl.innerHTML = '';
            groupMembersCountEl.textContent = members.length;

            if (members.length === 0) {
                renderGroupMembersPlaceholder('No members found in this group.');
                return;
            }

            members.forEach((member) => {
                const item = document.createElement('li');
                item.className = 'flex flex-col bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-800';

                const numberEl = document.createElement('span');
                numberEl.className = 'font-semibold text-gray-100';
                numberEl.textContent = formatPhone(member.number || member.id || member);

                const nameEl = document.createElement('span');
                nameEl.className = 'text-xs text-gray-400 mt-1';
                const displayName = member.name || member.pushname || member.contactName || '';
                nameEl.textContent = displayName || 'Unknown name';

                item.appendChild(numberEl);
                item.appendChild(nameEl);
                groupMembersListEl.appendChild(item);
            });
        }

        function renderGroupMembersPlaceholder(text) {
            groupMembersListEl.innerHTML = '';
            groupMembersCountEl.textContent = '0';
            const placeholder = document.createElement('li');
            placeholder.className = 'text-sm text-gray-400 py-4 text-center';
            placeholder.textContent = text;
            groupMembersListEl.appendChild(placeholder);
        }

        async function copyGroupMembers() {
            if (!chatState.groupMembers || chatState.groupMembers.length === 0) {
                alert('No group members to copy yet.');
                return;
            }

            const numbers = chatState.groupMembers
                .map((member) => formatPhone(member.number || member.id || member))
                .join('\n');

            try {
                await navigator.clipboard.writeText(numbers);
                alert('Group member numbers copied to clipboard.');
            } catch (error) {
                console.error('Unable to copy members:', error);
                alert('Unable to copy numbers automatically. Please copy them manually.');
            }
        }

        function openCreateModal() {
            document.getElementById('createModal').classList.remove('hidden');
            document.getElementById('createModal').classList.add('flex');
        }

        function closeCreateModal() {
            document.getElementById('createModal').classList.add('hidden');
            document.getElementById('createModal').classList.remove('flex');
        }

        function openEditModal(id, sessionName, webhookUrl) {
            document.getElementById('editSessionName').value = sessionName;
            document.getElementById('editWebhookUrl').value = webhookUrl || '';
            document.getElementById('editForm').action = `/sessions/${id}`;
            document.getElementById('editModal').classList.remove('hidden');
            document.getElementById('editModal').classList.add('flex');
        }

        function closeEditModal() {
            document.getElementById('editModal').classList.add('hidden');
            document.getElementById('editModal').classList.remove('flex');
        }

        let qrInterval;

        function showQrModal(sessionId) {
            document.getElementById('qrModal').classList.remove('hidden');
            document.getElementById('qrModal').classList.add('flex');

            const fetchQr = () => {
                fetch(`/sessions/${sessionId}/qr`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.qr_code) {
                            document.getElementById('qrCodeContainer').innerHTML =
                                `<img src="${data.qr_code}" alt="QR Code" class="w-48 h-48 md:w-64 md:h-64 mx-auto">`;
                        } else {
                            document.getElementById('qrCodeContainer').innerHTML =
                                '<div class="w-48 h-48 md:w-64 md:h-64 bg-gray-700 border border-gray-600 rounded-xl mx-auto flex items-center justify-center"><span class="text-gray-400">QR Code not available</span></div>';
                        }

                        if (data.status === 'connected') {
                            clearInterval(qrInterval);
                            location.reload();
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching QR code:', error);
                        document.getElementById('qrCodeContainer').innerHTML =
                            '<div class="w-48 h-48 md:w-64 md:h-64 bg-gray-700 border border-gray-600 rounded-xl mx-auto flex items-center justify-center"><span class="text-red-400">Error loading QR Code</span></div>';
                    });
            };

            fetchQr();
            qrInterval = setInterval(fetchQr, 5000);
        }

        function closeQrModal() {
            clearInterval(qrInterval);
            document.getElementById('qrModal').classList.add('hidden');
            document.getElementById('qrModal').classList.remove('flex');
        }

        function startSession(sessionId) {
            fetch(`/sessions/${sessionId}/start`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Content-Type': 'application/json',
                },
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('Failed to start session');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Failed to start session');
            });
        }

        function stopSession(sessionId) {
            if (confirm('Are you sure you want to stop this session?')) {
                fetch(`/sessions/${sessionId}/stop`, {
                    method: 'POST',
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                        'Content-Type': 'application/json',
                    },
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        location.reload();
                    } else {
                        alert('Failed to stop session');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Failed to stop session');
                });
            }
        }

        function deleteSession(sessionId) {
            if (confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = `/sessions/${sessionId}`;

                const csrfToken = document.createElement('input');
                csrfToken.type = 'hidden';
                csrfToken.name = '_token';
                csrfToken.value = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

                const methodField = document.createElement('input');
                methodField.type = 'hidden';
                methodField.name = '_method';
                methodField.value = 'DELETE';

                form.appendChild(csrfToken);
                form.appendChild(methodField);
                document.body.appendChild(form);
                form.submit();
            }
        }

        setInterval(() => {
            if (!chatState.isOpen) {
                location.reload();
            }
        }, 30000);
    </script>
</x-app-layout>
