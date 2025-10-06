#!/bin/bash

# Fix Laravel log permissions script for production server

echo "Fixing Laravel log permissions..."

# Set the correct ownership for the storage directory
sudo chown -R www-data:www-data /var/www/wms/frontend/storage

# Set correct permissions
sudo chmod -R 775 /var/www/wms/frontend/storage
sudo chmod -R 777 /var/www/wms/frontend/storage/logs

# Create cache directory if it doesn't exist
sudo mkdir -p /var/www/wms/frontend/storage/framework/cache
sudo mkdir -p /var/www/wms/frontend/storage/framework/sessions
sudo mkdir -p /var/www/wms/frontend/storage/framework/views

# Set permissions for framework directories
sudo chmod -R 775 /var/www/wms/frontend/storage/framework
sudo chmod -R 777 /var/www/wms/frontend/storage/framework/cache
sudo chmod -R 777 /var/www/wms/frontend/storage/framework/sessions
sudo chmod -R 777 /var/www/wms/frontend/storage/framework/views

# Create bootstrap cache directory
sudo mkdir -p /var/www/wms/frontend/bootstrap/cache
sudo chmod -R 775 /var/www/wms/frontend/bootstrap/cache

# Set ownership for the entire project (except vendor)
sudo chown -R www-data:www-data /var/www/wms/frontend

# Keep vendor directory ownership as is or set appropriately
sudo chown -R www-data:www-data /var/www/wms/frontend/vendor

echo "Permissions fixed successfully!"
echo "You may need to run: php artisan cache:clear && php artisan config:clear"