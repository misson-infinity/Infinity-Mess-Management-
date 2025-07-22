// js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    const messNameDisplay = document.getElementById('mess-name-display');
    const currentDateDisplay = document.getElementById('current-date');
    const currentMonthDisplay = document.getElementById('current-month');
    const logoutBtn = document.getElementById('logout-btn');
    const adminOnlyElements = document.querySelectorAll('.admin-only');

    // Meal tracking elements
    const mealMorning = document.getElementById('meal-morning');
    const mealNoon = document.getElementById('meal-noon');
    const mealNight = document.getElementById('meal-night');
    const totalDailyMeal = document.getElementById('total-daily-meal');

    // Notice board elements
    const postNoticeForm = document.getElementById('post-notice-form');
    const noticeContent = document.getElementById('notice-content');
    const noticesDiv = document.getElementById('notices');
    const postCommentForm = document.getElementById('post-comment-form');
    const commentContent = document.getElementById('comment-content');

    // Bazar duty elements
    const todayBazarPerson = document.getElementById('today-bazar-person');
    const setBazarDutyBtn = document.getElementById('set-bazar-duty-btn');

    // Join requests elements
    const joinRequestsList = document.getElementById('join-requests-list');

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

                // Hide/show elements based on role
                if (currentUserRole === 'admin') {
                    adminOnlyElements.forEach(el => el.classList.remove('hidden'));
                } else {
                    adminOnlyElements.forEach(el => el.classList.add('hidden'));
                }

                // Load mess details
                if (currentUserMessId) {
                    const messDoc = await db.collection('messes').doc(currentUserMessId).get();
                    if (messDoc.exists) {
                        messNameDisplay.textContent = messDoc.data().name;
                    }
                } else {
                    messNameDisplay.textContent = 'মেস যুক্ত নয়';
                    alert('আপনার কোন মেস যুক্ত নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন অথবা একটি মেস তৈরি করুন/যোগদান করুন।');
                    // Optionally redirect users without a mess to create/join mess page
                    if (currentUserRole === 'admin') {
                        window.location.href = 'create-mess.html';
                    } else {
                        // For regular members, maybe show a message or redirect to join page
                        // window.location.href = 'join-mess.html';
                    }
                }

                displayCurrentDate();
                loadDailyMealStatus(user.uid);
                loadTodayBazarDuty();
                loadNotices();
                if (currentUserRole === 'admin') {
                    loadJoinRequests();
                }

            } else {
                alert('ব্যবহারকারীর ডেটা পাওয়া যায়নি।');
                auth.signOut();
            }
        } else {
            // No user is signed in.
            window.location.href = 'index.html'; // Redirect to login page
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

    function displayCurrentDate() {
        const today = new Date();
        const optionsDate = { year: 'numeric', month: 'long', day: 'numeric' };
        const optionsMonth = { month: 'long', year: 'numeric' };
        currentDateDisplay.textContent = today.toLocaleDateString('bn-BD', optionsDate);
        currentMonthDisplay.textContent = today.toLocaleDateString('bn-BD', optionsMonth);
    }

    // --- Meal Tracking Logic ---
    async function loadDailyMealStatus(userId) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const mealDocRef = db.collection('meals').doc(`${currentUserMessId}_${today}_${userId}`);

        const doc = await mealDocRef.get();
        if (doc.exists) {
            const data = doc.data();
            mealMorning.checked = data.morning || false;
            mealNoon.checked = data.noon || false;
            mealNight.checked = data.night || false;
        }
        updateTotalDailyMeal();
    }

    function updateTotalDailyMeal() {
        let total = 0;
        if (mealMorning.checked) total += 0.5;
        if (mealNoon.checked) total += 1;
        if (mealNight.checked) total += 1;
        totalDailyMeal.textContent = total;
    }

    async function saveMealStatus() {
        const today = new Date().toISOString().split('T')[0];
        const mealDocRef = db.collection('meals').doc(`${currentUserMessId}_${today}_${currentUserId}`);

        try {
            await mealDocRef.set({
                messId: currentUserMessId,
                userId: currentUserId,
                date: today,
                morning: mealMorning.checked,
                noon: mealNoon.checked,
                night: mealNight.checked,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }); // Use merge to update existing or create new
            updateTotalDailyMeal();
        } catch (error) {
            console.error('মিল স্ট্যাটাস সংরক্ষণ ব্যর্থ:', error.message);
            alert('মিল স্ট্যাটাস সংরক্ষণ করতে সমস্যা হয়েছে।');
        }
    }

    mealMorning.addEventListener('change', saveMealStatus);
    mealNoon.addEventListener('change', saveMealStatus);
    mealNight.addEventListener('change', saveMealStatus);

    // --- Notice Board Logic ---
    async function loadNotices() {
        noticesDiv.innerHTML = '';
        if (!currentUserMessId) return;

        db.collection('notices')
          .where('messId', '==', currentUserMessId)
          .orderBy('createdAt', 'desc')
          .onSnapshot((snapshot) => {
              noticesDiv.innerHTML = '';
              if (snapshot.empty) {
                  noticesDiv.innerHTML = '<p>কোনো নোটিশ নেই।</p>';
                  return;
              }
              snapshot.docs.forEach(doc => {
                  const notice = doc.data();
                  const noticeId = doc.id;
                  const noticeElement = document.createElement('div');
                  noticeElement.classList.add('notice-item');
                  noticeElement.innerHTML = `
                      <h4>${notice.content}</h4>
                      <small>পোস্ট করেছেন: ${notice.authorName} (${new Date(notice.createdAt.toDate()).toLocaleString('bn-BD')})</small>
                      <div class="comments-section" id="comments-${noticeId}">
                          <h5>কমেন্টস:</h5>
                          </div>
                      <form class="comment-form" data-notice-id="${noticeId}">
                          <input type="text" placeholder="কমেন্ট লিখুন..." required>
                          <button type="submit" class="btn secondary-btn">কমেন্ট করুন</button>
                      </form>
                  `;
                  noticesDiv.appendChild(noticeElement);
                  loadComments(noticeId);
              });
          });
    }

    postNoticeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = noticeContent.value.trim();
        if (!content || !currentUserMessId || !currentUserId) return;

        try {
            const userDoc = await db.collection('users').doc(currentUserId).get();
            const authorName = userDoc.exists ? userDoc.data().name : 'অজানা';

            await db.collection('notices').add({
                messId: currentUserMessId,
                userId: currentUserId,
                authorName: authorName,
                content: content,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            noticeContent.value = '';
            alert('নোটিশ সফলভাবে পোস্ট করা হয়েছে!');
        } catch (error) {
            console.error('নোটিশ পোস্ট ব্যর্থ:', error.message);
            alert('নোটিশ পোস্ট করতে সমস্যা হয়েছে।');
        }
    });

    async function loadComments(noticeId) {
        const commentsSection = document.getElementById(`comments-${noticeId}`);
        commentsSection.innerHTML = '';

        db.collection('comments')
          .where('noticeId', '==', noticeId)
          .orderBy('createdAt', 'asc')
          .onSnapshot((snapshot) => {
              commentsSection.innerHTML = ''; // Clear previous comments
              snapshot.docs.forEach(doc => {
                  const comment = doc.data();
                  const commentElement = document.createElement('p');
                  commentElement.innerHTML = `<strong>${comment.authorName}:</strong> ${comment.content} <small>(${new Date(comment.createdAt.toDate()).toLocaleString('bn-BD')})</small>`;
                  commentsSection.appendChild(commentElement);
              });
          });
    }

    document.addEventListener('submit', async (e) => {
        if (e.target.classList.contains('comment-form')) {
            e.preventDefault();
            const noticeId = e.target.dataset.noticeId;
            const content = e.target.querySelector('input').value.trim();
            if (!content || !noticeId || !currentUserId) return;

            try {
                const userDoc = await db.collection('users').doc(currentUserId).get();
                const authorName = userDoc.exists ? userDoc.data().name : 'অজানা';

                await db.collection('comments').add({
                    noticeId: noticeId,
                    userId: currentUserId,
                    authorName: authorName,
                    content: content,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                e.target.querySelector('input').value = ''; // Clear comment input
            } catch (error) {
                console.error('কমেন্ট পোস্ট ব্যর্থ:', error.message);
                alert('কমেন্ট পোস্ট করতে সমস্যা হয়েছে।');
            }
        }
    });

    // --- Bazar Duty Logic ---
    async function loadTodayBazarDuty() {
        if (!currentUserMessId) return;
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const bazarDutyDocRef = db.collection('bazarDuties').doc(`${currentUserMessId}_${today}`);

        const doc = await bazarDutyDocRef.get();
        if (doc.exists) {
            const dutyData = doc.data();
            const memberDoc = await db.collection('users').doc(dutyData.userId).get();
            if (memberDoc.exists) {
                todayBazarPerson.textContent = memberDoc.data().name;
            } else {
                todayBazarPerson.textContent = 'কোনো সদস্য পাওয়া যায়নি।';
            }
        } else {
            todayBazarPerson.textContent = 'কেউ নেই';
        }
    }

    setBazarDutyBtn.addEventListener('click', async () => {
        if (currentUserRole !== 'admin' || !currentUserMessId) {
            alert('আপনার এই কাজটি করার অনুমতি নেই।');
            return;
        }

        // Fetch members of the current mess
        const membersSnapshot = await db.collection('users')
            .where('messId', '==', currentUserMessId)
            .where('role', '==', 'member') // Only show regular members for duty
            .get();

        if (membersSnapshot.empty) {
            alert('এই মেসে কোনো সদস্য নেই যাদের বাজার দায়িত্বে দেওয়া যেতে পারে।');
            return;
        }

        let memberOptions = '';
        membersSnapshot.forEach(doc => {
            const member = doc.data();
            memberOptions += `<option value="${doc.id}">${member.name}</option>`;
        });

        const selectedMemberId = prompt(`আজকের বাজার দায়িত্বে কাকে দিবেন?\n\nসদস্যরা:\n${membersSnapshot.docs.map(doc => doc.data().name).join(', ')}\n\n(সদস্য আইডি/নাম টাইপ করুন):`);

        if (selectedMemberId) {
            const memberDoc = membersSnapshot.docs.find(doc => doc.id === selectedMemberId || doc.data().name === selectedMemberId);

            if (memberDoc) {
                const today = new Date().toISOString().split('T')[0];
                const bazarDutyDocRef = db.collection('bazarDuties').doc(`${currentUserMessId}_${today}`);
                try {
                    await bazarDutyDocRef.set({
                        messId: currentUserMessId,
                        userId: memberDoc.id,
                        date: today,
                        assignedBy: currentUserId,
                        assignedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    alert(`${memberDoc.data().name} কে আজকের বাজারের দায়িত্বে দেওয়া হয়েছে।`);
                    loadTodayBazarDuty();
                } catch (error) {
                    console.error('বাজার দায়িত্ব সেট করতে ব্যর্থ:', error.message);
                    alert('বাজার দায়িত্ব সেট করতে সমস্যা হয়েছে।');
                }
            } else {
                alert('নির্বাচিত সদস্য পাওয়া যায়নি।');
            }
        }
    });

    // --- Join Requests Logic (Admin Only) ---
    async function loadJoinRequests() {
        if (!currentUserMessId) return;

        db.collection('joinRequests')
            .where('messId', '==', currentUserMessId)
            .where('status', '==', 'pending')
            .onSnapshot(async (snapshot) => {
                joinRequestsList.innerHTML = '';
                if (snapshot.empty) {
                    joinRequestsList.innerHTML = '<p>কোনো নতুন আবেদন নেই।</p>';
                    return;
                }

                for (const doc of snapshot.docs) {
                    const request = doc.data();
                    const requestId = doc.id;
                    const requestElement = document.createElement('div');
                    requestElement.classList.add('request-item');
                    requestElement.innerHTML = `
                        <p><strong>নাম:</strong> ${request.memberName}</p>
                        <p><strong>ফোন:</strong> ${request.memberPhone}</p>
                        <p><strong>ইমেইল:</strong> ${request.memberEmail}</p>
                        <p><strong>ঠিকানা:</strong> ${request.memberAddress}</p>
                        <div class="request-actions">
                            <input type="number" class="member-rent-input" placeholder="ভাড়া (মাসিক)" min="0" required>
                            <button class="btn success-btn accept-request" data-request-id="${requestId}">অনুমোদন করুন</button>
                            <button class="btn danger-btn reject-request" data-request-id="${requestId}">বাতিল করুন</button>
                        </div>
                    `;
                    joinRequestsList.appendChild(requestElement);
                }
            });
    }

    joinRequestsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('accept-request')) {
            const requestId = e.target.dataset.requestId;
            const rentInput = e.target.closest('.request-item').querySelector('.member-rent-input');
            const monthlyRent = parseFloat(rentInput.value);

            if (isNaN(monthlyRent) || monthlyRent < 0) {
                alert('দয়া করে একটি বৈধ মাসিক ভাড়া দিন।');
                return;
            }

            try {
                const requestDoc = await db.collection('joinRequests').doc(requestId).get();
                if (!requestDoc.exists) return;
                const requestData = requestDoc.data();

                // Create a new user in Firebase Auth with a temporary password (or send email invite)
                // For simplicity, let's assume admin manually sets up the user in Auth or they sign up themselves
                // A better approach would be to send an invitation email or use Firebase Cloud Functions to create user
                // For now, we'll just add them as a member in Firestore.
                // Assuming the member has already signed up via `index.html` (or you'll need a different flow for members to sign up *after* admin approval)
                // For now, let's just add them to the users collection with member role and messId
                const memberEmail = requestData.memberEmail;
                const tempPassword = 'password123'; // IMPORTANT: This is highly insecure. Use email invitation or proper signup flow.
                                                  // For a real app, you would send an email with a link for them to set their password after approval.

                // Check if user already exists based on email (if they signed up already)
                const existingUsers = await db.collection('users').where('email', '==', memberEmail).get();
                let memberUserId;

                if (existingUsers.empty) {
                    // Create a user in Auth (this might require admin SDK or different approach on client side)
                    // For client-side, a user must sign up themselves. Admin cannot create auth users directly.
                    // So the flow should be: member signs up, then applies to mess, admin approves.
                    // This means the member has a user.uid already.
                    alert('সদস্যের ইমেইল আইডিটি ব্যবহার করে তাদের আগে সাইনআপ করতে হবে। অ্যাডমিন সরাসরি অ্যাকাউন্ট তৈরি করতে পারবে না।');
                    return;
                } else {
                    memberUserId = existingUsers.docs[0].id;
                }

                await db.collection('users').doc(memberUserId).update({
                    messId: currentUserMessId,
                    role: 'member',
                    monthlyRent: monthlyRent,
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await db.collection('joinRequests').doc(requestId).update({
                    status: 'accepted',
                    approvedBy: currentUserId,
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                alert(`${requestData.memberName} কে মেসে সদস্য হিসেবে যুক্ত করা হয়েছে!`);
            } catch (error) {
                console.error('অনুমোদন ব্যর্থ:', error.message);
                alert(`অনুমোদন ব্যর্থ: ${error.message}`);
            }
        } else if (e.target.classList.contains('reject-request')) {
            const requestId = e.target.dataset.requestId;
            try {
                await db.collection('joinRequests').doc(requestId).update({
                    status: 'rejected',
                    rejectedBy: currentUserId,
                    rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                alert('আবেদন বাতিল করা হয়েছে।');
            } catch (error) {
                console.error('বাতিল ব্যর্থ:', error.message);
                alert(`বাতিল ব্যর্থ: ${error.message}`);
            }
        }
    });

});