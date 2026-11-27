-- =============================================================================
-- RepetitorHub: PostgreSQL Schema & Initial Seeding (English Data)
-- File: database/postgres_schema.sql
-- =============================================================================

-- Drop existing tables if re-running script
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;
DROP TABLE IF EXISTS tutor_subjects CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS tutors CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- -----------------------------------------------------------------------------
-- 1. Tables Creation (DDL)
-- -----------------------------------------------------------------------------

-- Subjects Lookup Table
CREATE TABLE subjects (
    subject_id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tutors Table
CREATE TABLE tutors (
    tutor_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-Many junction table for Tutors and Subjects
CREATE TABLE tutor_subjects (
    tutor_id INT NOT NULL REFERENCES tutors(tutor_id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
    hourly_rate DECIMAL(10, 2) NOT NULL CHECK (hourly_rate > 0),
    experience_years INT NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
    PRIMARY KEY (tutor_id, subject_id)
);

-- Students Table
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tutor Time Slots
CREATE TABLE time_slots (
    slot_id SERIAL PRIMARY KEY,
    tutor_id INT NOT NULL REFERENCES tutors(tutor_id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_time_slots_tutor_start ON time_slots(tutor_id, start_time) WHERE is_available = TRUE;

-- Lesson Bookings
CREATE TABLE bookings (
    booking_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
    slot_id INT NOT NULL UNIQUE REFERENCES time_slots(slot_id) ON DELETE RESTRICT,
    subject_id INT NOT NULL REFERENCES subjects(subject_id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_student ON bookings(student_id);

-- Payments
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE RESTRICT,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (payment_status IN ('pending', 'completed', 'refunded')),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('card', 'click', 'payme', 'bank_transfer')),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- -----------------------------------------------------------------------------
-- 2. Trigger Function: Slot Availability Manager
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_manage_slot_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- Lock slot if booking is pending or confirmed
    IF (TG_OP = 'INSERT' AND NEW.status IN ('pending', 'confirmed')) OR 
       (TG_OP = 'UPDATE' AND NEW.status IN ('pending', 'confirmed') AND OLD.status = 'cancelled') THEN
        UPDATE time_slots 
        SET is_available = FALSE 
        WHERE slot_id = NEW.slot_id;
        
    -- Reopen slot if booking is cancelled
    ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status IN ('pending', 'confirmed')) THEN
        UPDATE time_slots 
        SET is_available = TRUE 
        WHERE slot_id = NEW.slot_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_manage_slot_availability
AFTER INSERT OR UPDATE OF status ON bookings
FOR EACH ROW
EXECUTE FUNCTION fn_manage_slot_availability();

-- -----------------------------------------------------------------------------
-- 3. English Sample Data Seeding (DML)
-- -----------------------------------------------------------------------------

-- 1. Insert Subjects
INSERT INTO subjects (subject_name, description) VALUES
('IELTS', 'Preparation for Academic and General IELTS modules'),
('SAT', 'Comprehensive SAT Math and Evidence-Based Reading preparation'),
('Mathematics', 'Calculus, linear algebra, geometry, and high school math'),
('Russian Language', 'Grammar, conversational fluency, and exam preparation'),
('Korean Language', 'TOPIK I-II preparation and daily communication skills');

-- 2. Insert Tutors
INSERT INTO tutors (first_name, last_name, email, phone, bio) VALUES
('Alex', 'Smirnov', 'alex.smirnov@example.com', '+998901234567', 'Certified IELTS instructor with overall score 8.5 (7 years experience)'),
('Dilnoza', 'Karimova', 'd.karimova@example.com', '+998912345678', 'SAT Math expert and regional math olympiad coach'),
('Mikhail', 'Kim', 'm.kim@example.com', '+998933456789', 'Native Korean speaker with TOPIK Level 6 certification');

-- 3. Insert Tutor Subjects (M:N)
INSERT INTO tutor_subjects (tutor_id, subject_id, hourly_rate, experience_years) VALUES
(1, 1, 25.00, 7), -- Alex -> IELTS ($25/hr)
(1, 4, 15.00, 5), -- Alex -> Russian ($15/hr)
(2, 2, 30.00, 6), -- Dilnoza -> SAT ($30/hr)
(2, 3, 20.00, 8), -- Dilnoza -> Mathematics ($20/hr)
(3, 5, 22.00, 4); -- Mikhail -> Korean ($22/hr)

-- 4. Insert Students
INSERT INTO students (first_name, last_name, email, phone) VALUES
('Timur', 'Aliev', 'timur.aliev@example.com', '+998971112233'),
('Madina', 'Rustamova', 'm.rustamova@example.com', '+998974445566'),
('Sardor', 'Usmanov', 'sardor.u@example.com', '+998909998877');

-- 5. Insert Time Slots
INSERT INTO time_slots (tutor_id, start_time, end_time, is_available) VALUES
(1, '2026-11-02 10:00:00+05', '2026-11-02 11:00:00+05', TRUE),
(1, '2026-11-02 11:30:00+05', '2026-11-02 12:30:00+05', TRUE),
(2, '2026-11-03 14:00:00+05', '2026-11-03 15:00:00+05', TRUE),
(3, '2026-11-03 16:00:00+05', '2026-11-03 17:00:00+05', TRUE);

-- 6. Insert Bookings (Triggers will automatically set slot is_available = FALSE)
INSERT INTO bookings (student_id, slot_id, subject_id, status) VALUES
(1, 1, 1, 'completed'),  -- Timur booked IELTS with Alex
(2, 3, 2, 'confirmed'),  -- Madina booked SAT with Dilnoza
(3, 4, 5, 'pending');    -- Sardor booked Korean with Mikhail

-- 7. Insert Payments
INSERT INTO payments (booking_id, amount, payment_status, payment_method, paid_at) VALUES
(1, 25.00, 'completed', 'click', '2026-11-01 12:00:00+05'),
(2, 30.00, 'completed', 'payme', '2026-11-01 15:30:00+05'),
(3, 22.00, 'pending', 'card', NULL);