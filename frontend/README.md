# Dispatch — Realtime Communication Platform

Dispatch là ứng dụng trò chuyện và truyền tin tức thì theo thời gian thực, xây dựng với kiến trúc hướng sự kiện (WebSocket STOMP), mã hóa chứng thực JWT và giao diện tối ưu hóa hiệu năng.

## Công nghệ sử dụng

### Frontend (Client)
- React 19 & Vite
- Tailwind CSS & Lucide Icons
- SockJS & STOMP Client

### Backend (Server)
- Java 21 & Spring Boot 4
- Spring Security (JWT & BCrypt)
- Spring WebSocket Message Broker
- Spring Data JPA

### Cơ sở dữ liệu & Triển khai
- MySQL 8.0 / TiDB Cloud Serverless
- Docker & Docker Compose
- Nginx Reverse Proxy

# Dispatch — Web Client

Giao diện web chính thức của Dispatch, xây dựng bằng React 19, Tailwind CSS và WebSocket client.