# WhatsApp Management System

A complete WhatsApp management system with Laravel Breeze frontend and WhatsApp WebJS API backend. This project allows users to create and manage multiple WhatsApp sessions, send and receive messages, and integrate with external systems via webhooks.

## Features

- **User Authentication**: Secure registration and login with Laravel Breeze
- **Dashboard**: Clean and intuitive dashboard for managing WhatsApp sessions
- **Session Management**: Create, edit, and delete WhatsApp sessions
- **QR Code Scanning**: Easy connection to WhatsApp Web via QR code scanning
- **Webhook Integration**: Forward incoming messages to external systems
- **Message Handling**: Send and receive messages, including media
- **Group Message Support**: Receive messages from groups when bot is mentioned
- **Image Compression**: Automatic compression of images using Sharp
- **Comprehensive Logging**: Detailed logs for debugging and monitoring
- **Error Handling**: Robust error handling and reporting

## Architecture

The project consists of two main components:

1. **Frontend**: Laravel Breeze application with authentication and dashboard
2. **Backend**: Node.js API with WhatsApp WebJS integration

### Technology Stack

- **Frontend**:
  - Laravel 11.x
  - Laravel Breeze (Authentication)
  - Blade Templates
  - Tailwind CSS

- **Backend**:
  - Node.js
  - Express.js
  - WhatsApp WebJS
  - Prisma ORM
  - PostgreSQL

## Installation

### Prerequisites

- PHP 8.1 or higher
- Composer
- Node.js 16 or higher
- npm or yarn
- PostgreSQL
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/whatsapp-management-system.git
cd whatsapp-management-system
```

### Step 2: Set Up Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install PHP dependencies
composer install

# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Configure database in .env file
# DB_CONNECTION=pgsql
# DB_HOST=127.0.0.1
# DB_PORT=5432
# DB_DATABASE=whatsapp_management
# DB_USERNAME=postgres
# DB_PASSWORD=your_password

# Run migrations
php artisan migrate

# Install NPM dependencies
npm install

# Build assets
npm run build

# Start the development server
php artisan serve
```

### Step 3: Set Up Backend

```bash
# Navigate to backend directory
cd ../backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure environment variables in .env file
# PORT=3000
# DATABASE_URL="postgresql://postgres:your_password@localhost:5432/whatsapp_management"
# JWT_SECRET=your_jwt_secret_key_here
# WWEBJS_DATA_DIR=.wwebjs_auth

# Run Prisma migrations
npx prisma migrate dev

# Seed the database
npm run prisma:seed

# Start the development server
npm run dev
```

### Step 4: Access the Application

- Frontend: http://localhost:8000
- Backend API: http://localhost:3000

## Usage

### User Registration and Login

1. Access the frontend application at http://localhost:8000
2. Register a new account or login with existing credentials
3. After login, you will be redirected to the dashboard

### Creating a WhatsApp Session

1. From the dashboard, click on "Add New Session"
2. Enter a session name and webhook URL (optional)
3. Click "Submit" to create the session
4. Click on the "Start" button for the session
5. Scan the QR code with your WhatsApp mobile app

### Sending Messages

You can send messages using the API:

```bash
curl -X POST http://localhost:3000/api/messages/session/1/send \
  -H "Content-Type: application/json" \
  -d '{"to": "1234567890@c.us", "message": "Hello from WhatsApp Management System!"}'
```

### Receiving Messages

When a message is received, it will be:

1. Saved to the database
2. Forwarded to the webhook URL (if configured)
3. Visible in the logs

### Webhook Integration

To receive messages in your external system:

1. Configure a webhook URL when creating or editing a session
2. Ensure your webhook endpoint can receive POST requests
3. Process the incoming JSON payload in your application
4. (Optional) Tune webhook timeout behaviour with environment variables:
   - `WEBHOOK_TIMEOUT_MS`: how long the backend waits for the webhook before giving up. Leave unset/empty to wait indefinitely, or set to a specific number of milliseconds (e.g. `60000`).
   - `WEBHOOK_SLOW_RESPONSE_MS`: threshold (ms) for logging a warning when a webhook takes too long. Defaults to 10s or `WEBHOOK_TIMEOUT_MS - 1s`.

## API Documentation

Detailed API documentation is available in the [API.md](API.md) file.

## Development

### Frontend Development

```bash
cd frontend
npm run dev
```

### Backend Development

```bash
cd backend
npm run dev
```

## Troubleshooting

### Common Issues

- **QR Code Not Displaying**: Ensure the backend server is running and accessible from the frontend
- **Connection Issues**: Check that your WhatsApp mobile app is connected to the internet
- **Database Connection Errors**: Verify your PostgreSQL credentials and database existence

### Logs

- Frontend logs: `frontend/storage/logs/laravel.log`
- Backend logs: `backend/logs/combined.log` and `backend/logs/error.log`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Laravel](https://laravel.com/)
- [WhatsApp WebJS](https://github.com/pedroslopez/whatsapp-web.js/)
- [WAHA Plus](https://waha.devlike.pro/docs/overview/quick-start/)
