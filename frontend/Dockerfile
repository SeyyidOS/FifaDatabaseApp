# Production image: build the SPA, then serve it with nginx, which also proxies /api to the backend
# (see nginx/default.conf.template).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV VITE_API_URL=/api
RUN npx tsc -b && npx vite build --base=/

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
