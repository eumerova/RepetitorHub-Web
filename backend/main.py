# =============================================================================
# RepetitorHub: FastAPI Backend Integration Server
# File: backend/main.py
# =============================================================================

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
from pymongo import MongoClient
from datetime import datetime
from typing import Optional

app = FastAPI(
    title="RepetitorHub API",
    description="Hybrid REST API connecting PostgreSQL and MongoDB for Tutoring Marketplace",
    version="1.0.0"
)

# Enable CORS so frontend (HTML/JS) can freely communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Database Connection Helpers
# -----------------------------------------------------------------------------

def get_pg_connection():
    try:
        return psycopg2.connect(
            dbname="repetitorhub",
            user="postgres",
            password="secretpassword",
            host="localhost",  # Use "postgres" if running FastAPI inside Docker
            port=5432
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PostgreSQL connection error: {str(e)}")

def get_mongo_db():
    try:
        client = MongoClient("mongodb://localhost:27017/") # Use "mongodb" if running inside Docker
        return client["repetitorhub_logs"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MongoDB connection error: {str(e)}")

# -----------------------------------------------------------------------------
# Pydantic Schemas (Data Transfer Objects)
# -----------------------------------------------------------------------------

class BookingCreateRequest(BaseModel):
    student_id: int
    slot_id: int
    subject_id: int

class ReviewCreateRequest(BaseModel):
    booking_id: int
    tutor_id: int
    student_id: int
    rating: int
    comment: str
    punctuality: int
    clarity: int
    materials: int

# -----------------------------------------------------------------------------
# REST API Endpoints
# -----------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "online", "message": "RepetitorHub API is running"}

# 1. Search Tutors (PostgreSQL Query + MongoDB Event Logging)
@app.get("/api/tutors/search")
def search_tutors(
    subject_name: Optional[str] = Query(None, description="Subject filter (e.g. IELTS, SAT)"),
    max_price: Optional[float] = Query(None, description="Maximum hourly rate filter"),
    student_id: Optional[int] = Query(None, description="Optional Student ID for logging")
):
    # Log search event in MongoDB
    mongo_db = get_mongo_db()
    mongo_db.search_events.insert_one({
        "student_id": student_id,
        "search_query": {
            "subject_name": subject_name,
            "max_price": max_price
        },
        "timestamp": datetime.utcnow()
    })

    # Retrieve matching tutors from PostgreSQL
    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT 
                    t.tutor_id,
                    t.first_name,
                    t.last_name,
                    t.email,
                    s.subject_id,
                    s.subject_name,
                    ts.hourly_rate,
                    ts.experience_years
                FROM tutors t
                JOIN tutor_subjects ts ON t.tutor_id = ts.tutor_id
                JOIN subjects s ON ts.subject_id = s.subject_id
                WHERE (%s::varchar IS NULL OR s.subject_name ILIKE %s)
                  AND (%s::numeric IS NULL OR ts.hourly_rate <= %s)
                ORDER BY ts.hourly_rate ASC;
            """
            search_param = f"%{subject_name}%" if subject_name else None
            cur.execute(query, (subject_name, search_param, max_price, max_price))
            results = cur.fetchall()
            return {"count": len(results), "tutors": results}
    finally:
        conn.close()

# 2. Create Booking (PostgreSQL + Automatic Trigger Execution)
@app.post("/api/bookings")
def create_booking(booking: BookingCreateRequest):
    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check slot availability
            cur.execute("SELECT is_available FROM time_slots WHERE slot_id = %s;", (booking.slot_id,))
            slot = cur.fetchone()
            
            if not slot:
                raise HTTPException(status_code=404, detail="Time slot not found")
            if not slot["is_available"]:
                raise HTTPException(status_code=400, detail="Time slot is already booked")

            # Create booking (PostgreSQL trigger will mark slot as is_available = FALSE)
            cur.execute(
                """
                INSERT INTO bookings (student_id, slot_id, subject_id, status)
                VALUES (%s, %s, %s, 'confirmed')
                RETURNING booking_id, status, created_at;
                """,
                (booking.student_id, booking.slot_id, booking.subject_id)
            )
            new_booking = cur.fetchone()
            conn.commit()
            return {"status": "success", "booking": new_booking}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 3. Get Tutor Financial Earnings Report (PostgreSQL Analytical SQL)
@app.get("/api/reports/earnings/{tutor_id}")
def get_tutor_earnings_report(tutor_id: int):
    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT 
                    t.tutor_id,
                    CONCAT(t.first_name, ' ', t.last_name) AS tutor_name,
                    COUNT(b.booking_id) AS total_lessons_completed,
                    COALESCE(SUM(p.amount), 0.00) AS gross_earnings,
                    ROUND(COALESCE(SUM(p.amount), 0.00) * 0.10, 2) AS platform_fee_10pct,
                    ROUND(COALESCE(SUM(p.amount), 0.00) * 0.90, 2) AS net_payout
                FROM tutors t
                LEFT JOIN time_slots ts ON t.tutor_id = ts.tutor_id
                LEFT JOIN bookings b ON ts.slot_id = b.slot_id AND b.status = 'completed'
                LEFT JOIN payments p ON b.booking_id = p.booking_id AND p.payment_status = 'completed'
                WHERE t.tutor_id = %s
                GROUP BY t.tutor_id, t.first_name, t.last_name;
            """
            cur.execute(query, (tutor_id,))
            report = cur.fetchone()
            if not report:
                raise HTTPException(status_code=404, detail="Tutor not found")
            return report
    finally:
        conn.close()

# 4. Get Tutor Reviews Summary (MongoDB Aggregation Pipeline)
@app.get("/api/tutors/{tutor_id}/reviews")
def get_tutor_reviews(tutor_id: int):
    mongo_db = get_mongo_db()
    pipeline = [
        {"$match": {"tutor_id": tutor_id}},
        {"$group": {
            "_id": "$tutor_id",
            "avg_overall_rating": {"$avg": "$rating"},
            "avg_clarity": {"$avg": "$detailed_scores.clarity"},
            "avg_punctuality": {"$avg": "$detailed_scores.punctuality"},
            "avg_materials": {"$avg": "$detailed_scores.materials"},
            "total_reviews": {"$sum": 1},
            "reviews": {
                "$push": {
                    "rating": "$rating",
                    "comment": "$comment",
                    "created_at": "$created_at"
                }
            }
        }},
        {"$project": {
            "tutor_id": "$_id",
            "avg_overall_rating": {"$round": ["$avg_overall_rating", 2]},
            "avg_clarity": {"$round": ["$avg_clarity", 2]},
            "avg_punctuality": {"$round": ["$avg_punctuality", 2]},
            "avg_materials": {"$round": ["$avg_materials", 2]},
            "total_reviews": 1,
            "reviews": 1,
            "_id": 0
        }}
    ]
    
    results = list(mongo_db.lesson_reviews.aggregate(pipeline))
    if not results:
        return {"tutor_id": tutor_id, "total_reviews": 0, "reviews": []}
    return results[0]

# -----------------------------------------------------------------------------
# Helper Endpoints for Dynamic Frontend Dropdowns
# -----------------------------------------------------------------------------

# Get all registered students
@app.get("/api/students")
def get_students():
    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT student_id, first_name, last_name, email FROM students ORDER BY first_name ASC;")
            return cur.fetchall()
    finally:
        conn.close()

# Get all available subjects
@app.get("/api/subjects")
def get_subjects():
    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT subject_id, subject_name FROM subjects ORDER BY subject_name ASC;")
            return cur.fetchall()
    finally:
        conn.close()

# Get available time slots filtered by Subject
@app.get("/api/slots/available")
def get_available_slots(subject_id: int):
    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT 
                    ts.slot_id,
                    CONCAT(t.first_name, ' ', t.last_name) AS tutor_name,
                    ts.start_time,
                    ts.end_time,
                    sub_ts.hourly_rate
                FROM time_slots ts
                JOIN tutors t ON ts.tutor_id = t.tutor_id
                JOIN tutor_subjects sub_ts ON t.tutor_id = sub_ts.tutor_id AND sub_ts.subject_id = %s
                WHERE ts.is_available = TRUE
                ORDER BY ts.start_time ASC;
            """
            cur.execute(query, (subject_id,))
            return cur.fetchall()
    finally:
        conn.close()

# 1. Search Tutors (Shows ALL tutors if filters are empty/omitted)
@app.get("/api/tutors/search")
def search_tutors(
    subject_name: Optional[str] = Query(None, description="Subject filter (e.g. IELTS, SAT)"),
    max_price: Optional[float] = Query(None, description="Maximum hourly rate filter"),
    student_id: Optional[int] = Query(None, description="Optional Student ID for logging")
):
    # Sanitize parameters: convert empty strings or zero/negative prices to None
    if subject_name and subject_name.strip() == "":
        subject_name = None
    if max_price is not None and max_price <= 0:
        max_price = None

    # Log search event in MongoDB ONLY if user applied actual filter criteria
    if subject_name or max_price:
        mongo_db = get_mongo_db()
        mongo_db.search_events.insert_one({
            "student_id": student_id,
            "search_query": {
                "subject_name": subject_name,
                "max_price": max_price
            },
            "timestamp": datetime.utcnow()
        })

    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT 
                    t.tutor_id,
                    t.first_name,
                    t.last_name,
                    t.email,
                    s.subject_id,
                    s.subject_name,
                    ts.hourly_rate,
                    ts.experience_years
                FROM tutors t
                JOIN tutor_subjects ts ON t.tutor_id = ts.tutor_id
                JOIN subjects s ON ts.subject_id = s.subject_id
                WHERE (%s::varchar IS NULL OR s.subject_name ILIKE %s)
                  AND (%s::numeric IS NULL OR ts.hourly_rate <= %s)
                ORDER BY ts.hourly_rate ASC;
            """
            search_param = f"%{subject_name}%" if subject_name else None
            cur.execute(query, (subject_name, search_param, max_price, max_price))
            results = cur.fetchall()
            return {"count": len(results), "tutors": results}
    finally:
        conn.close()