const API_BASE_URL = "http://localhost:8000/api";

// -----------------------------------------------------------------------------
// Booking Page Logic (Dynamic Dropdowns)
// -----------------------------------------------------------------------------

// 1. Initialize Booking Page: Load Students & Subjects
async function initBookingPage() {
    await loadStudentsDropdown();
    await loadSubjectsDropdown();

    // Check if redirect parameters exist in URL (e.g. from Search page)
    const params = new URLSearchParams(window.location.search);
    const preselectedSubjectId = params.get('subject_id');
    
    if (preselectedSubjectId) {
        const subjectSelect = document.getElementById("subjectSelect");
        subjectSelect.value = preselectedSubjectId;
        await loadAvailableSlots(); // Auto-fetch slots for preselected subject
    }
}

// Populate Student Dropdown
async function loadStudentsDropdown() {
    const studentSelect = document.getElementById("studentSelect");
    try {
        const response = await fetch(`${API_BASE_URL}/students`);
        const students = await response.json();

        studentSelect.innerHTML = '<option value="">Select a student...</option>';
        students.forEach(student => {
            studentSelect.innerHTML += `
                <option value="${student.student_id}">
                    ${student.first_name} ${student.last_name} (${student.email})
                </option>`;
        });
    } catch (error) {
        console.error("Error loading students:", error);
        studentSelect.innerHTML = '<option value="">Failed to load students</option>';
    }
}

// Populate Subject Dropdown
async function loadSubjectsDropdown() {
    const subjectSelect = document.getElementById("subjectSelect");
    try {
        const response = await fetch(`${API_BASE_URL}/subjects`);
        const subjects = await response.json();

        subjectSelect.innerHTML = '<option value="">Choose a subject...</option>';
        subjects.forEach(subject => {
            subjectSelect.innerHTML += `
                <option value="${subject.subject_id}">${subject.subject_name}</option>`;
        });
    } catch (error) {
        console.error("Error loading subjects:", error);
        subjectSelect.innerHTML = '<option value="">Failed to load subjects</option>';
    }
}

// Dynamically Load Free Slots when a Subject is Selected
async function loadAvailableSlots() {
    const subjectId = document.getElementById("subjectSelect").value;
    const slotSelect = document.getElementById("slotSelect");

    if (!subjectId) {
        slotSelect.innerHTML = '<option value="">Please select a subject first...</option>';
        slotSelect.disabled = true;
        return;
    }

    slotSelect.disabled = true;
    slotSelect.innerHTML = '<option value="">Loading available slots...</option>';

    try {
        const response = await fetch(`${API_BASE_URL}/slots/available?subject_id=${subjectId}`);
        const slots = await response.json();

        if (slots.length === 0) {
            slotSelect.innerHTML = '<option value="">No free slots available for this subject</option>';
            return;
        }

        slotSelect.innerHTML = '<option value="">Select a time slot...</option>';
        slots.forEach(slot => {
            // Format time range nicely (e.g. "Alex Smirnov — Nov 02, 10:00 to 11:00")
            const startTime = new Date(slot.start_time).toLocaleString('en-US', { 
                month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false 
            });
            const endTime = new Date(slot.end_time).toLocaleTimeString('en-US', { 
                hour: '2-digit', minute: '2-digit', hour12: false 
            });

            slotSelect.innerHTML += `
                <option value="${slot.slot_id}">
                    ${slot.tutor_name} — ${startTime} - ${endTime} ($${slot.hourly_rate}/hr)
                </option>`;
        });

        slotSelect.disabled = false;
    } catch (error) {
        console.error("Error loading slots:", error);
        slotSelect.innerHTML = '<option value="">Error loading slots</option>';
    }
}

// 2. Submit Booking
async function submitBooking(event) {
    event.preventDefault();

    const studentId = parseInt(document.getElementById("studentSelect").value);
    const subjectId = parseInt(document.getElementById("subjectSelect").value);
    const slotId = parseInt(document.getElementById("slotSelect").value);
    const alertBox = document.getElementById("bookingAlert");

    if (!studentId || !subjectId || !slotId) {
        alertBox.className = "alert error";
        alertBox.innerText = "Please fill in all required fields.";
        alertBox.classList.remove("hidden");
        return;
    }

    const payload = {
        student_id: studentId,
        subject_id: subjectId,
        slot_id: slotId
    };

    try {
        const response = await fetch(`${API_BASE_URL}/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            alertBox.className = "alert success";
            alertBox.innerText = `Booking #${result.booking.booking_id} successfully confirmed! The time slot is now reserved.`;
            // Refresh slots list to remove the booked slot
            await loadAvailableSlots();
        } else {
            alertBox.className = "alert error";
            alertBox.innerText = `Booking failed: ${result.detail}`;
        }
    } catch (error) {
        alertBox.className = "alert error";
        alertBox.innerText = "Connection error with FastAPI server.";
    }

    alertBox.classList.remove("hidden");
}



// Fetch and render tutors (All tutors on initial load or filtered results on search)
async function searchTutors() {
    const subject = document.getElementById("subjectSelect").value;
    const maxPrice = document.getElementById("maxPriceInput").value;
    const tutorsContainer = document.getElementById("tutorsContainer");

    // Build URL query parameters dynamically
    const params = new URLSearchParams();
    if (subject && subject.trim() !== "") {
        params.append("subject_name", subject.trim());
    }
    if (maxPrice && parseFloat(maxPrice) > 0) {
        params.append("max_price", maxPrice);
    }

    const queryString = params.toString();
    const url = queryString ? `${API_BASE_URL}/tutors/search?${queryString}` : `${API_BASE_URL}/tutors/search`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch tutors");

        const data = await response.json();
        document.getElementById("tutorCount").innerText = data.count;

        tutorsContainer.innerHTML = "";

        // If no results found, show empty state with a Reset button
        if (data.tutors.length === 0) {
            tutorsContainer.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #64748b;">
                    <p style="font-size: 1.1rem; margin-bottom: 1rem;">No tutors found matching your search criteria.</p>
                    <button class="btn-primary" onclick="resetFilters()">Reset Filters & Show All</button>
                </div>
            `;
            return;
        }

        // Render tutor cards
        data.tutors.forEach(tutor => {
            const card = document.createElement("div");
            card.className = "tutor-card";
            card.innerHTML = `
                <div>
                    <div class="tutor-name">${tutor.first_name} ${tutor.last_name}</div>
                    <span class="subject-badge">${tutor.subject_name}</span>
                    <p style="font-size:0.875rem; color:#64748b;">Experience: ${tutor.experience_years} years</p>
                    <div class="price">$${tutor.hourly_rate} / hr</div>
                </div>
                <button class="btn-primary" onclick="goToBooking(${tutor.subject_id})">Book Lesson</button>
            `;
            tutorsContainer.appendChild(card);
        });
    } catch (error) {
        console.error("Search Error:", error);
        tutorsContainer.innerHTML = `<p style="color:red;">Error connecting to API. Ensure FastAPI server is running.</p>`;
    }
}

// Reset filter fields and load all tutors
function resetFilters() {
    document.getElementById("subjectSelect").value = "";
    document.getElementById("maxPriceInput").value = "";
    searchTutors();
}

// Redirect to booking page
function goToBooking(subjectId) {
    window.location.href = `booking.html?subject_id=${subjectId}`;
}

// Render tutor cards
data.tutors.forEach(tutor => {
    const initials = `${tutor.first_name[0]}${tutor.last_name[0]}`;
    const card = document.createElement("div");
    card.className = "tutor-card";
    card.innerHTML = `
        <div>
            <div class="tutor-header">
                <div class="tutor-avatar">${initials}</div>
                <div>
                    <div class="tutor-name">${tutor.first_name} ${tutor.last_name}</div>
                    <div class="experience-text">Verified Tutor</div>
                </div>
            </div>
            <span class="subject-badge">${tutor.subject_name}</span>
            <div class="experience-text">Experience: ${tutor.experience_years} years</div>
            <div class="price-text">$${tutor.hourly_rate} <span class="price-unit">/ hour</span></div>
        </div>
        <button class="btn-primary" style="width: 100%;" onclick="goToBooking(${tutor.subject_id})">
            Book Lesson
        </button>
    `;
    tutorsContainer.appendChild(card);
});