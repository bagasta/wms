# Laravel Log Permission Fix

## Problem
The Laravel application is unable to write to the log file at `/var/www/wms/frontend/storage/logs/laravel.log` due to permission issues.

## Solutions Applied

### 1. Configuration Fix
Updated `frontend/config/logging.php` to:
- Added a fallback log channel that writes to `/tmp/laravel.log` in production
- Modified the stack channel to ignore exceptions and use both primary and fallback channels
- This ensures logging continues even if the main storage directory has permission issues

### 2. Permission Fix Script
Created `deploy-fix-permissions.sh` script that:
- Sets correct ownership (www-data:www-data) for storage directories
- Sets appropriate permissions (775/777) for writable directories
- Creates necessary cache and framework directories
- Fixes bootstrap cache permissions

## Deployment Instructions

1. Upload the updated `config/logging.php` file to your production server
2. Run the permission fix script:
   ```bash
   sudo ./deploy-fix-permissions.sh
   ```
3. Clear Laravel cache:
   ```bash
   php artisan cache:clear
   php artisan config:clear
   php artisan view:clear
   ```

## Verification
After applying the fixes:
1. Check if logs are being written to `/var/www/wms/frontend/storage/logs/laravel.log`
2. If that fails, check `/tmp/laravel.log` for fallback logs
3. Test application functionality to ensure no permission-related errors