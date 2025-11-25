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

1. Upload the updated `config/logging.php` file to your production server.
2. (Optional but recommended) Back up the live application directory:
   ```bash
   sudo cp -a /var/www/wms/frontend /var/www/wms/frontend.backup.$(date +%Y%m%d%H%M)
   ```
3. Sync the working copy you build from (e.g. `/root/wms/frontend`) into the live nginx path:
   ```bash
   # install rsync if needed: sudo apt install rsync
   rsync -av --delete /root/wms/frontend/ /var/www/wms/frontend/
   sudo chown -R www-data:www-data /var/www/wms/frontend
   ```
   > Tip: perform all future `git pull`, `npm run build`, and `php artisan` commands directly inside `/var/www/wms/frontend` so the working copy and live copy stay in sync.
4. Run the permission fix script from the project root:
   ```bash
   sudo ./deploy-fix-permissions.sh
   ```
5. Clear Laravel cache (from `/var/www/wms/frontend`):
   ```bash
   php artisan optimize:clear
   php artisan cache:clear
   php artisan config:clear
   php artisan view:clear
   ```
6. Reload services and verify:
   ```bash
   sudo systemctl reload nginx
   sudo systemctl reload php8.2-fpm    # adjust PHP-FPM version as needed
   ```

## Verification
After applying the fixes:
1. Check if logs are being written to `/var/www/wms/frontend/storage/logs/laravel.log`
2. If that fails, check `/tmp/laravel.log` for fallback logs
3. Test application functionality to ensure no permission-related errors
