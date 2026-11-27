# 🎓 RepetitorHub — Tutoring Marketplace Database Project

# RepetitorHub — Hybrid Database Tutoring Marketplace

## Architecture
- **Frontend:** HTML5, CSS3, Vanilla JS
- **Backend:** Python FastAPI
- **Databases:** PostgreSQL 15 (Relational) + MongoDB 6.0 (Document/Logs) via Docker Compose

## How to Run
1. Start databases: `docker compose up -d`
2. Install backend dependencies: `pip install -r backend/requirements.txt`
3. Run FastAPI server: `cd backend && uvicorn main:app --reload`
4. Open `frontend/index.html` in your browser.

####

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue?logo=postgresql)
![MongoDB](https://img.shields.io/badge/MongoDB-6.0%2B-green?logo=mongodb)
![Python](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi)
![License](https://img.shields.io/badge/License-MIT-yellow)

**RepetitorHub** — это концептуальный проект гибридной системы управления базами данных (**Polyglot Persistence**) для маркетплейса репетиторов. Платформа позволяет находить преподавателей по предметам (*IELTS, SAT, Математика, Русский/Корейский языки*), бронировать временные слоты, оплачивать уроки, оставлять развернутые отзывы и формировать финансовую отчетность.

---

## 🛠 Архитектура хранения данных (Polyglot Persistence)

Проект объединяет преимущества реляционных и документных СУБД:

* **PostgreSQL (ACID SQL):** Служит основным источником истины для транзакционных данных. Отвечает за пользователей, справочники, слоты времени, бронирования и платежи. Использование уникальных ограничений и SQL-триггеров предотвращает двойное бронирование слотов (Race Conditions).
* **MongoDB (NoSQL Document Store):** Используется для высоконагруженных операций записи и хранения документов с гибкой/вложенной структурой:
  * `lesson_reviews` — отзывы и мультикритериальные оценки уроков.
  * `search_events` — логирование параметров поиска для аналитики спроса.

---

## 📐 Схема базы данных (ERD)
[tutors] 1 <---- N [tutor_subjects] N ----> 1 [subjects]
[tutors] 1 <---- N [time_slots]
[time_slots] 1 <---- 0..1 [bookings]
[students] 1 <---- N [bookings]
[subjects] 1 <---- N [bookings]
[bookings] 1 <---- 0..1 [payments]
