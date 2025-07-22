// js/bazar.js
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    const setBazarDutyForm = document.getElementById('set-bazar-duty-form');
    const dutyMemberSelect = document.getElementById('duty-member');
    const addBazarEntryForm = document.getElementById('add-bazar-entry-form');
    const addShopDueForm = document.getElementById('add-shop-due-form');
    const bazarListBody = document.getElementById('bazar-list-body');

    let currentUserId = null;
    let currentUserRole = null;
    let currentUserMessId = null;

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

                // Hide/show elements based on role
                if (currentUserRole === 'admin') {
                    adminOnlyElements.forEach(el => el.classList.remove('hidden'));
                    loadMembersForDuty();
                } else {
                    adminOnlyElements.forEach(el => el.classList.add('hidden'));
                }

                loadBazarData();
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

    // Function to load members for duty assignment
    async function loadMembersForDuty() {
        if (!currentUserMessId) return;
        dutyMemberSelect.innerHTML = '<option value="">সদস্য নির্বাচন করুন</option>';
        const membersSnapshot = await db.collection('users')
            .where('messId', '==', currentUserMessId)
            .where('role', '==', 'member')
            .get();

        membersSnapshot.forEach(doc => {
            const member = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = member.name;
            dutyMemberSelect.appendChild(option);
        });
    }

    // Set Bazar Duty Form Submission
    setBazarDutyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dutyDate = setBazarDutyForm['duty-date'].value;
        const dutyMemberId = setBazarDutyForm['duty-member'].value;

        if (!dutyDate || !dutyMemberId || !currentUserMessId || currentUserRole !== 'admin') {
            alert('ফর্ম পূরণ করুন এবং আপনার অ্যাডমিন অনুমতি আছে কিনা নিশ্চিত করুন।');
            return;
        }

        try {
            // Check if duty already exists for this date
            const existingDuty = await db.collection('bazarDuties').doc(`${currentUserMessId}_${dutyDate}`).get();
            if (existingDuty.exists) {
                if (!confirm(`এই তারিখে (${dutyDate}) ইতিমধ্যে বাজার ডিউটি সেট করা আছে। আপনি কি এটি পরিবর্তন করতে চান?`)) {
                    return;
                }
            }

            await db.collection('bazarDuties').doc(`${currentUserMessId}_${dutyDate}`).set({
                messId: currentUserMessId,
                date: dutyDate,
                userId: dutyMemberId,
                assignedBy: currentUserId,
                assignedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }); // Use merge to update if exists

            alert('বাজার ডিউটি সফলভাবে সেট করা হয়েছে!');
            setBazarDutyForm.reset();
            loadBazarData(); // Reload data to show updated duty
        } catch (error) {
            console.error('বাজার ডিউটি সেট করতে ব্যর্থ:', error.message);
            alert(`বাজার ডিউটি সেট করতে ব্যর্থ: ${error.message}`);
        }
    });

    // Add Bazar Entry Form Submission (Member/Admin)
    addBazarEntryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bazarDate = addBazarEntryForm['bazar-date'].value;
        const bazarAmount = parseFloat(addBazarEntryForm['bazar-amount'].value);
        const bazarDescription = addBazarEntryForm['bazar-description'].value;
        const bazarComment = addBazarEntryForm['bazar-comment'].value;

        if (!bazarDate || isNaN(bazarAmount) || bazarAmount < 0 || !currentUserMessId) {
            alert('ফর্মের প্রয়োজনীয় ক্ষেত্রগুলো পূরণ করুন।');
            return;
        }

        try {
            await db.collection('bazarEntries').add({
                messId: currentUserMessId,
                userId: currentUserId,
                date: bazarDate,
                amount: bazarAmount,
                description: bazarDescription,
                comment: bazarComment,
                type: 'bazar', // 'bazar' or 'shop_due'
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('বাজার এন্ট্রি সফলভাবে যোগ করা হয়েছে!');
            addBazarEntryForm.reset();
            loadBazarData();
        } catch (error) {
            console.error('বাজার এন্ট্রি যোগ করতে ব্যর্থ:', error.message);
            alert(`বাজার এন্ট্রি যোগ করতে ব্যর্থ: ${error.message}`);
        }
    });

    // Add Shop Due Form Submission (Admin Only)
    addShopDueForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dueDate = addShopDueForm['due-date'].value;
        const dueAmount = parseFloat(addShopDueForm['due-amount'].value);
        const dueDescription = addShopDueForm['due-description'].value;

        if (!dueDate || isNaN(dueAmount) || dueAmount < 0 || !currentUserMessId || currentUserRole !== 'admin') {
            alert('ফর্ম পূরণ করুন এবং আপনার অ্যাডমিন অনুমতি আছে কিনা নিশ্চিত করুন।');
            return;
        }

        try {
            await db.collection('bazarEntries').add({
                messId: currentUserMessId,
                userId: null, // No specific user for shop due
                date: dueDate,
                amount: dueAmount,
                description: dueDescription,
                comment: 'দোকানের বাকি',
                type: 'shop_due',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('দোকানের বাকি সফলভাবে যোগ করা হয়েছে!');
            addShopDueForm.reset();
            loadBazarData();
        } catch (error) {
            console.error('দোকানের বাকি যোগ করতে ব্যর্থ:', error.message);
            alert(`দোকানের বাকি যোগ করতে ব্যর্থ: ${error.message}`);
        }
    });

    // Load and display bazar data
    async function loadBazarData() {
        if (!currentUserMessId) {
            bazarListBody.innerHTML = '<tr><td colspan="5">মেস ডেটা লোড হচ্ছে...</td></tr>';
            return;
        }

        db.collection('bazarEntries')
            .where('messId', '==', currentUserMessId)
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .onSnapshot(async (snapshot) => {
                bazarListBody.innerHTML = '';
                if (snapshot.empty) {
                    bazarListBody.innerHTML = '<tr><td colspan="5">কোনো বাজার এন্ট্রি বা বাকি নেই।</td></tr>';
                    return;
                }

                const userNames = {};
                // Pre-fetch user names to avoid multiple reads in loop
                const usersSnapshot = await db.collection('users').where('messId', '==', currentUserMessId).get();
                usersSnapshot.forEach(doc => {
                    userNames[doc.id] = doc.data().name;
                });

                for (const doc of snapshot.docs) {
                    const entry = doc.data();
                    const entryId = doc.id;
                    let memberName = 'N/A';
                    if (entry.userId && userNames[entry.userId]) {
                        memberName = userNames[entry.userId];
                    } else if (entry.type === 'shop_due') {
                        memberName = 'দোকানের বাকি';
                    }

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(entry.date).toLocaleDateString('bn-BD')}</td>
                        <td>${memberName} - ${entry.description || ''}</td>
                        <td>${entry.amount.toFixed(2)}</td>
                        <td>${entry.type === 'bazar' ? 'বাজার' : 'বাকি'}</td>
                        <td>
                            ${currentUserRole === 'admin' ? `
                                <button class="btn secondary-btn edit-entry" data-id="${entryId}">এডিট</button>
                                <button class="btn danger-btn delete-entry" data-id="${entryId}">ডিলিট</button>
                            ` : ''}
                        </td>
                    `;
                    bazarListBody.appendChild(row);
                }
            });

        // Also display Bazar Duties separately or integrated
        db.collection('bazarDuties')
            .where('messId', '==', currentUserMessId)
            .orderBy('date', 'desc')
            .onSnapshot(async (snapshot) => {
                // This could be a separate section or integrated into the table with a distinct style
                // For now, let's keep it simple and just update the main list.
                // You'll need to fetch the member name for each duty.
            });
    }

    // Edit/Delete functionality (Admin Only)
    bazarListBody.addEventListener('click', async (e) => {
        if (currentUserRole !== 'admin') return;

        const entryId = e.target.dataset.id;
        if (e.target.classList.contains('edit-entry')) {
            const doc = await db.collection('bazarEntries').doc(entryId).get();
            if (doc.exists) {
                const data = doc.data();
                const newAmount = prompt(`নতুন পরিমাণ দিন (${data.description}):`, data.amount);
                if (newAmount !== null && !isNaN(parseFloat(newAmount))) {
                    try {
                        await db.collection('bazarEntries').doc(entryId).update({
                            amount: parseFloat(newAmount),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        alert('পরিমাণ সফলভাবে আপডেট করা হয়েছে!');
                    } catch (error) {
                        console.error('আপডেট ব্যর্থ:', error.message);
                        alert('আপডেট করতে সমস্যা হয়েছে।');
                    }
                }
            }
        } else if (e.target.classList.contains('delete-entry')) {
            if (confirm('আপনি কি এই এন্ট্রিটি ডিলিট করতে নিশ্চিত?')) {
                try {
                    await db.collection('bazarEntries').doc(entryId).delete();
                    alert('এন্ট্রি সফলভাবে ডিলিট করা হয়েছে!');
                } catch (error) {
                    console.error('ডিলিট ব্যর্থ:', error.message);
                    alert('ডিলিট করতে সমস্যা হয়েছে।');
                }
            }
        }
    });
});