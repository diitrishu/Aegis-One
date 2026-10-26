FROM qgis/qgis-server:latest

# Copy nginx configuration that replaces the main config
COPY config/qgis-nginx.conf /etc/nginx/nginx.conf

# Create necessary directories and set permissions
RUN mkdir -p /var/log/supervisor /var/run \
    && chown -R www-data:www-data /var/run

# Expose port
EXPOSE 80

# Use the default CMD from the base image