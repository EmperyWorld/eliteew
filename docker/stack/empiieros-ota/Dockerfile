FROM docker.io/library/nginx:1.27-alpine
COPY nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /srv/empiieros-ota/blobs \
	&& chown -R nginx:nginx /srv/empiieros-ota
EXPOSE 80
