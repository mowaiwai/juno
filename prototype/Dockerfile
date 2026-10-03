# Juno 前端镜像：构建 SPA → nginx 托管并反代 /api
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

# 构建期注入 API 地址；默认走同源反代 /api/v1（见 nginx.conf）
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_MOCK=false

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
