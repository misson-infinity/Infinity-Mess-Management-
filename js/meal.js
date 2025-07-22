// js/meal.js
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    const monthSelect = document.getElementById('month-select');
    const filterMealsBtn = document.getElementById('filter-meals-btn');
    const mealTableHeaderDates = document.getElementById('meal-table-header-dates');
    const mealTableBody = document.getElementById('meal-table-body');
    const totalDailyMealsRow = document.getElementById('total-daily-meals-row');
    const totalMonthlyMealsRow = document.getElementById('total-monthly-meals-row');

    const adminEditMealForm = document.getElementById('admin-edit-meal-form');
    const editMealDateInput = document.getElementById('edit-meal-date');
    const editMealMemberSelect = document.getElementById('edit-meal-member');
    const editMealMorning = document.getElementById('edit-meal-morning');
    const editMealNoon = document.getElementById('edit-meal-noon');
    const editMealNight = document.getElementById('edit-meal-night');
    const deleteMealEntryBtn = document.getElementById('delete-meal-entry-btn');

    let currentUserId = null;
    let currentUserRole = null;
    let currentUserMessId = null;
    let membersCache = []; // To store member details

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                currentUserRole = userData.role;
                currentUserMessId = userData.messId;

                if (!currentUserMessId) {
                    alert('আপনার কোন মেস যুক্ত নেই।');
                    window.location.href = 'dashboard.html';
                    return;
                }

                if (currentUserRole === 'admin') {
                    adminOnlyElements.forEach(el => el.classList.remove('hidden'));
                    loadMembersForEdit(); // Load members for admin edit form
                } else {
                    adminOnlyElements.forEach(el => el.classList.add('hidden'));
                }

                initializeMonthSelect();
                loadMealData();
            } else {
                alert('ব্যবহারকারীর ডেটা পাওয়া যায়নি।');
                auth.signOut();
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            alert('সফলভাবে লগআউট করা হয়েছে।');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('লগআউট ব্যর্থ:', error.message);
            alert(`লগআউট ব্যর্থ: ${error.message}`);
        }
    });

    function initializeMonthSelect() {
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        monthSelect.value = currentMonth;
    }

    async function loadMembersForEdit() {
        editMealMemberSelect.innerHTML = '<option value="">সদস্য নির্বাচন করুন</option>';
        const membersSnapshot = await db.collection('users')
            .where('messId', '==', currentUserMessId)
            .get(); // Get all users in the mess

        membersCache = []; // Clear cache
        membersSnapshot.forEach(doc => {
            const member = { id: doc.id, ...doc.data() };
            membersCache.push(member);
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = member.name;
            editMealMemberSelect.appendChild(option);
        });
    }

    async function loadMealData() {
        if (!currentUserMessId) return;

        const selectedMonth = monthSelect.value; // YYYY-MM
        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of the month

        mealTableHeaderDates.innerHTML = '<th>সদস্য/তারিখ</th>';
        mealTableBody.innerHTML = '';
        totalDailyMealsRow.innerHTML = '<td>মোট দৈনন্দিন মিল</td>';
        totalMonthlyMealsRow.innerHTML = '<td>মাসিক মোট মিল</td>';

        const daysInMonth = endDate.getDate();
        const dates = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month - 1, i);
            const formattedDate = date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
            mealTableHeaderDates.innerHTML += `<th>${formattedDate}</th>`;
            dates.push(date.toISOString().split('T')[0]); // YYYY-MM-DD
        }
        mealTableHeaderDates.innerHTML += '<th>মাসিক মোট</th>'; // Add total column header

        // Fetch all members in the mess
        if (membersCache.length === 0) {
            await loadMembersForEdit(); // Reload if empty
        }

        const members = membersCache;
        if (members.length === 0) {
            mealTableBody.innerHTML = '<tr><td colspan="' + (daysInMonth + 2) + '">কোনো সদস্য নেই।</td></tr>';
            return;
        }

        const mealsData = {}; // {userId: {date: mealCount}}
        const mealsSnapshot = await db.collection('meals')
            .where('messId', '==', currentUserMessId)
            .where('date', '>=', startDate.toISOString().split('T')[0])
            .where('date', '<=', endDate.toISOString().split('T')[0])
            .get();

        mealsSnapshot.forEach(doc => {
            const meal = doc.data();
            if (!mealsData[meal.userId]) {
                mealsData[meal.userId] = {};
            }
            let dailyTotal = 0;
            if (meal.morning) dailyTotal += 0.5;
            if (meal.noon) dailyTotal += 1;
            if (meal.night) dailyTotal += 1;
            mealsData[meal.userId][meal.date] = dailyTotal;
        });

        const dailyTotals = Array(daysInMonth).fill(0);
        const monthlyTotals = {};

        members.forEach(member => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${member.name}</td>`;
            let memberMonthlyTotal = 0;

            dates.forEach((date, index) => {
                const mealCount = mealsData[member.id] && mealsData[member.id][date] !== undefined ? mealsData[member.id][date] : 0;
                row.innerHTML += `<td>${mealCount}</td>`;
                dailyTotals[index] += mealCount;
                memberMonthlyTotal += mealCount;
            });
            row.innerHTML += `<td>${memberMonthlyTotal.toFixed(1)}</td>`; // Display member's monthly total
            mealTableBody.appendChild(row);
            monthlyTotals[member.id] = memberMonthlyTotal;
        });

        // Populate total daily meals row
        dates.forEach( (date, index) => {
            totalDailyMealsRow.innerHTML += `<td>${dailyTotals[index].toFixed(1)}</td>`;
        });
        totalDailyMealsRow.innerHTML += `<td>${dailyTotals.reduce((sum, val) => sum + val, 0).toFixed(1)}</td>`; // Grand total

        // Populate total monthly meals row
        // This row is for individual monthly totals, which are already calculated in member loop.
        // So just display the grand total for the month in the last cell for this row.
        let grandTotalAllMembers = 0;
        members.forEach(member => {
            grandTotalAllMembers += monthlyTotals[member.id];
        });
        totalMonthlyMealsRow.innerHTML += `<td colspan="${daysInMonth + 1}"></td><td>${grandTotalAllMembers.toFixed(1)}</td>`; // Spanning to align with total column

    }

    filterMealsBtn.addEventListener('click', loadMealData);

    // Admin Edit/Delete Meal Logic
    editMealDateInput.addEventListener('change', async () => {
        const selectedDate = editMealDateInput.value;
        const selectedMemberId = editMealMemberSelect.value;
        if (selectedDate && selectedMemberId) {
            await loadMealForEditForm(selectedDate, selectedMemberId);
        }
    });

    editMealMemberSelect.addEventListener('change', async () => {
        const selectedDate = editMealDateInput.value;
        const selectedMemberId = editMealMemberSelect.value;
        if (selectedDate && selectedMemberId) {
            await loadMealForEditForm(selectedDate, selectedMemberId);
        }
    });

    async function loadMealForEditForm(date, userId) {
        const mealDocRef = db.collection('meals').doc(`${currentUserMessId}_${date}_${userId}`);
        const doc = await mealDocRef.get();
        if (doc.exists) {
            const data = doc.data();
            editMealMorning.checked = data.morning || false;
            editMealNoon.checked = data.noon || false;
            editMealNight.checked = data.night || false;
        } else {
            editMealMorning.checked = false;
            editMealNoon.checked = false;
            editMealNight.checked = false;
        }
    }

    adminEditMealForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = editMealDateInput.value;
        const userId = editMealMemberSelect.value;
        const morning = editMealMorning.checked;
        const noon = editMealNoon.checked;
        const night = editMealNight.checked;

        if (!date || !userId || !currentUserMessId || currentUserRole !== 'admin') {
            alert('ফর্ম পূরণ করুন এবং আপনার অ্যাডমিন অনুমতি আছে কিনা নিশ্চিত করুন।');
            return;
        }

        try {
            const mealDocRef = db.collection('meals').doc(`${currentUserMessId}_${date}_${userId}`);
            await mealDocRef.set({
                messId: currentUserMessId,
                userId: userId,
                date: date,
                morning: morning,
                noon: noon,
                night: night,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            alert('মিল সফলভাবে আপডেট করা হয়েছে!');
            loadMealData(); // Reload table
        } catch (error) {
            console.error('মিল আপডেট ব্যর্থ:', error.message);
            alert(`মিল আপডেট ব্যর্থ: ${error.message}`);
        }
    });

    deleteMealEntryBtn.addEventListener('click', async () => {
        const date = editMealDateInput.value;
        const userId = editMealMemberSelect.value;

        if (!date || !userId || !currentUserMessId || currentUserRole !== 'admin') {
            alert('তারিখ এবং সদস্য নির্বাচন করুন এবং আপনার অ্যাডমিন অনুমতি আছে কিনা নিশ্চিত করুন।');
            return;
        }

        if (confirm('আপনি কি এই তারিখের এই সদস্যের মিল এন্ট্রি ডিলিট করতে নিশ্চিত?')) {
            try {
                const mealDocRef = db.collection('meals').doc(`${currentUserMessId}_${date}_${userId}`);
                await mealDocRef.delete();
                alert('মিল এন্ট্রি সফলভাবে ডিলিট করা হয়েছে!');
                adminEditMealForm.reset();
                loadMealData(); // Reload table
            } catch (error) {
                console.error('মিল ডিলিট ব্যর্থ:', error.message);
                alert(`মিল ডিলিট ব্যর্থ: ${error.message}`);
            }
        }
    });
});