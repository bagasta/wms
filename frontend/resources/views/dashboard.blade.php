<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">
                {{ __('WhatsApp Management System') }}
            </h2>
            <button onclick="openCreateModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                Add New Session +
            </button>
        </div>
    </x-slot>

    <div class="py-12 bg-gray-900 min-h-screen">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <!-- Success/Error Messages -->
            @if(session('success'))
                <div class="bg-green-600 text-white p-4 rounded-lg mb-6">
                    {{ session('success') }}
                </div>
            @endif

            @if(session('error'))
                <div class="bg-red-600 text-white p-4 rounded-lg mb-6">
                    {{ session('error') }}
                </div>
            @endif

            <!-- Sessions Table -->
            <div class="bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-semibold text-white">Sessions</h3>
                        <div class="text-sm text-gray-400">
                            Welcome, {{ Auth::user()->name }}
                        </div>
                    </div>

                    @if($sessions->count() > 0)
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-gray-700">
                                        <th class="pb-3 text-orange-400 font-medium">Session Name</th>
                                        <th class="pb-3 text-orange-400 font-medium">Webhook</th>
                                        <th class="pb-3 text-orange-400 font-medium">Status</th>
                                        <th class="pb-3 text-orange-400 font-medium">Options</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($sessions as $session)
                                        <tr class="border-b border-gray-700 hover:bg-gray-700">
                                            <td class="py-4 text-orange-400 font-medium">{{ $session->session_name }}</td>
                                            <td class="py-4 text-gray-300">
                                                @if($session->webhook_url)
                                                    <span class="text-sm">{{ Str::limit($session->webhook_url, 30) }}</span>
                                                @else
                                                    <span class="text-gray-500">No webhook</span>
                                                @endif
                                            </td>
                                            <td class="py-4">
                                                <span class="px-3 py-1 rounded-full text-sm
                                                    @if($session->status === 'connected') bg-green-600 text-white
                                                    @elseif($session->status === 'connecting') bg-yellow-600 text-white
                                                    @else bg-red-600 text-white
                                                    @endif">
                                                    {{ ucfirst($session->status) }}
                                                </span>
                                            </td>
                                            <td class="py-4">
                                                <div class="flex space-x-2">
                                                    @if($session->status === 'disconnected')
                                                        <button onclick="startSession({{ $session->id }})" 
                                                                class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                                                            Start
                                                        </button>
                                                    @elseif($session->status === 'connecting')
                                                        <button onclick="showQrModal({{ $session->id }})" 
                                                                class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                                                            QR
                                                        </button>
                                                        <button onclick="stopSession({{ $session->id }})" 
                                                                class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                                                            Stop
                                                        </button>
                                                    @else
                                                        <button onclick="stopSession({{ $session->id }})" 
                                                                class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                                                            Stop
                                                        </button>
                                                    @endif
                                                    
                                                    <button onclick="openEditModal({{ $session->id }}, '{{ $session->session_name }}', '{{ $session->webhook_url }}')" 
                                                            class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm">
                                                        Edit
                                                    </button>
                                                    
                                                    <button onclick="deleteSession({{ $session->id }})" 
                                                            class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @else
                        <div class="text-center py-12">
                            <div class="text-gray-400 text-lg mb-4">No sessions found</div>
                            <button onclick="openCreateModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
                                Create Your First Session
                            </button>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>

    <!-- Create Session Modal -->
    <div id="createModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg w-96 border border-orange-400">
            <h3 class="text-xl font-semibold text-white mb-4">NEW SESSION</h3>
            <form action="{{ route('sessions.store') }}" method="POST">
                @csrf
                <div class="mb-4">
                    <label class="block text-orange-400 text-sm font-medium mb-2">Session Name</label>
                    <input type="text" name="session_name" required 
                           class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-orange-400">
                </div>
                <div class="mb-6">
                    <label class="block text-orange-400 text-sm font-medium mb-2">Webhook URL</label>
                    <input type="url" name="webhook_url" 
                           class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-orange-400">
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="closeCreateModal()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Cancel
                    </button>
                    <button type="submit" 
                            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        Submit
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Edit Session Modal -->
    <div id="editModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg w-96 border border-orange-400">
            <h3 class="text-xl font-semibold text-white mb-4">EDIT SESSION</h3>
            <form id="editForm" method="POST">
                @csrf
                @method('PUT')
                <div class="mb-4">
                    <label class="block text-orange-400 text-sm font-medium mb-2">Session Name</label>
                    <input type="text" id="editSessionName" name="session_name" required 
                           class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-orange-400">
                </div>
                <div class="mb-6">
                    <label class="block text-orange-400 text-sm font-medium mb-2">Webhook URL</label>
                    <input type="url" id="editWebhookUrl" name="webhook_url" 
                           class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-orange-400">
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="closeEditModal()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Cancel
                    </button>
                    <button type="submit" 
                            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        Submit
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- QR Code Modal -->
    <div id="qrModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-gray-800 p-6 rounded-lg w-96 border border-orange-400">
            <h3 class="text-xl font-semibold text-white mb-4">Scan QR</h3>
            <div class="text-center">
                <div id="qrCodeContainer" class="mb-4">
                    <div class="w-64 h-64 bg-gray-700 border border-gray-600 rounded mx-auto flex items-center justify-center">
                        <span class="text-gray-400">Loading QR Code...</span>
                    </div>
                </div>
                <p class="text-gray-400 text-sm mb-4">
                    Session Name & Webhook URL<br>
                    Still same, but WhatsApp<br>
                    session will deleted and<br>
                    recreate a new session
                </p>
                <button onclick="closeQrModal()" 
                        class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                    Close
                </button>
            </div>
        </div>
    </div>

    <script>
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
                                `<img src="${data.qr_code}" alt="QR Code" class="w-64 h-64 mx-auto">`;
                        } else {
                            document.getElementById('qrCodeContainer').innerHTML =
                                '<div class="w-64 h-64 bg-gray-700 border border-gray-600 rounded mx-auto flex items-center justify-center"><span class="text-gray-400">QR Code not available</span></div>';
                        }

                        if (data.status && data.status !== 'connecting') {
                            clearInterval(qrInterval);
                            closeQrModal();
                            location.reload();
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching QR code:', error);
                        document.getElementById('qrCodeContainer').innerHTML =
                            '<div class="w-64 h-64 bg-gray-700 border border-gray-600 rounded mx-auto flex items-center justify-center"><span class="text-red-400">Error loading QR Code</span></div>';
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

        // Auto-refresh status every 30 seconds
        setInterval(() => {
            location.reload();
        }, 30000);
    </script>
</x-app-layout>
