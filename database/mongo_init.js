// =============================================================================
// RepetitorHub: MongoDB Schema Initialization & Sample Data (English)
// File: database/mongo_init.js
// =============================================================================

// Switch to target database
db = db.getSiblingDB("repetitorhub_logs");

// -----------------------------------------------------------------------------
// 1. Collections Creation with Schema Validation
// -----------------------------------------------------------------------------

// Lesson Reviews Collection
db.createCollection("lesson_reviews", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["booking_id", "tutor_id", "student_id", "rating", "created_at"],
         properties: {
            booking_id: { bsonType: "int", description: "PostgreSQL Booking ID" },
            tutor_id: { bsonType: "int", description: "PostgreSQL Tutor ID" },
            student_id: { bsonType: "int", description: "PostgreSQL Student ID" },
            rating: { bsonType: "int", minimum: 1, maximum: 5, description: "Rating score from 1 to 5" },
            comment: { bsonType: "string", description: "Review feedback text" },
            detailed_scores: {
               bsonType: "object",
               required: ["punctuality", "clarity", "materials"],
               properties: {
                  punctuality: { bsonType: "int", minimum: 1, maximum: 5 },
                  clarity: { bsonType: "int", minimum: 1, maximum: 5 },
                  materials: { bsonType: "int", minimum: 1, maximum: 5 }
               }
            },
            created_at: { bsonType: "date" }
         }
      }
   }
});

// Search Events Collection (Logs)
db.createCollection("search_events", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["timestamp", "search_query"],
         properties: {
            student_id: { bsonType: ["int", "null"], description: "Nullable Student ID" },
            search_query: {
               bsonType: "object",
               properties: {
                  subject_name: { bsonType: "string" },
                  max_price: { bsonType: ["double", "int"] },
                  language: { bsonType: "string" }
               }
            },
            results_count: { bsonType: "int", minimum: 0 },
            timestamp: { bsonType: "date" }
         }
      }
   }
});

// -----------------------------------------------------------------------------
// 2. Index Creation
// -----------------------------------------------------------------------------

db.lesson_reviews.createIndex({ tutor_id: 1, created_at: -1 });
db.search_events.createIndex({ "search_query.subject_name": 1, timestamp: -1 });

// -----------------------------------------------------------------------------
// 3. Sample Data Seeding (English)
// -----------------------------------------------------------------------------

// Insert Lesson Reviews
db.lesson_reviews.insertMany([
  {
    booking_id: NumberInt(1),
    tutor_id: NumberInt(1),
    student_id: NumberInt(1),
    rating: NumberInt(5),
    comment: "Excellent tutor! We went through the IELTS Writing Academic Task 2 essay structure in great detail.",
    detailed_scores: {
      punctuality: NumberInt(5),
      clarity: NumberInt(5),
      materials: NumberInt(5)
    },
    created_at: new ISODate("2026-11-02T12:00:00Z")
  },
  {
    booking_id: NumberInt(2),
    tutor_id: NumberInt(2),
    student_id: NumberInt(2),
    rating: NumberInt(4),
    comment: "Great lesson on SAT Math geometry shortcuts, though the pacing was a bit fast.",
    detailed_scores: {
      punctuality: NumberInt(5),
      clarity: NumberInt(4),
      materials: NumberInt(4)
    },
    created_at: new ISODate("2026-11-03T16:00:00Z")
  }
]);

// Insert Search Logs
db.search_events.insertMany([
  {
    student_id: NumberInt(1),
    search_query: {
      subject_name: "IELTS",
      max_price: 30.00,
      language: "English"
    },
    results_count: NumberInt(3),
    timestamp: new ISODate("2026-11-01T09:15:00Z")
  },
  {
    student_id: NumberInt(2),
    search_query: {
      subject_name: "SAT",
      max_price: 35.00,
      language: "English"
    },
    results_count: NumberInt(1),
    timestamp: new ISODate("2026-11-01T10:00:00Z")
  },
  {
    student_id: null,
    search_query: {
      subject_name: "Korean Language",
      max_price: 25.00,
      language: "Korean"
    },
    results_count: NumberInt(5),
    timestamp: new ISODate("2026-11-01T11:30:00Z")
  }
]);