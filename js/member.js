// js/member.js
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    const memberListBody = document.getElementById('member-list-body');
    const editMemberSection = document.getElementById('edit-member-section');
    const editMemberForm = document.getElementById('edit-member-form');
    const deleteMemberBtn = document.getElementById('delete-member-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

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

                if (currentUserRole === 'admin') {
                    adminOnlyElements.forEach(el => el.classList.remove('hidden'));
                } else {
                    adminOnlyElements.forEach(el => el.classList.add('hidden'));
                }
                loadMembers();
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

    async function loadMembers() {
        if (!currentUserMessId) return;

        db.collection('users')
            .where('messId', '==', currentUserMessId)
            .orderBy('name', 'asc')
            .onSnapshot((snapshot) => {
                memberListBody.innerHTML = '';
                if (snapshot.empty) {
                    memberListBody.innerHTML = '<tr><td colspan="8">এই মেসে কোনো সদস্য নেই।</td></tr>';
                    return;
                }

                snapshot.docs.forEach(doc => {
                    const member = doc.data();
                    const memberId = doc.id;
                    const joinedDate = member.joinedAt ? new Date(member.joinedAt.toDate()).toLocaleDateString('bn-BD') : 'N/A';
                    const memberRole = member.role === 'admin' ? 'অ্যাডমিন' : 'সদস্য'; // Show role

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><img src="${member.photoURL || 'img/default-profile.png'}" alt="${member.name}" style="width: 50px; height: 50px; border-radius: 50%;"></td>
                        <td>${member.name} (${memberRole})</td>
                        <td>${member.mobile || 'N/A'}</td>
                        <td>${member.email}</td>
                        <td>${member.address || 'N/A'}</td>
                        <td>${member.monthlyRent !== undefined ? member.monthlyRent : 'N/A'}</td>
                        <td>${joinedDate}</td>
                        <td class="admin-only ${currentUserRole !== 'admin' ? 'hidden' : ''}">
                            <button class="btn secondary-btn edit-member-btn" data-id="${memberId}">এডিট</button>
                            ${memberId !== currentUserId && member.role !== 'admin' ? `
                            <button class="btn danger-btn delete-member-btn" data-id="${memberId}">ডিলিট</button>
                            ` : ''}
                        </td>
                    `;
                    memberListBody.appendChild(row);
                });
            });
    }

    // Edit/Delete functionality (Admin Only)
    memberListBody.addEventListener('click', async (e) => {
        if (currentUserRole !== 'admin') return;

        const memberId = e.target.dataset.id;
        if (e.target.classList.contains('edit-member-btn')) {
            const memberDoc = await db.collection('users').doc(memberId).get();
            if (memberDoc.exists) {
                const data = memberDoc.data();
                editMemberSection.classList.remove('hidden');
                editMemberForm['edit-member-id'].value = memberId;
                editMemberForm['edit-member-name'].value = data.name || '';
                editMemberForm['edit-member-phone'].value = data.mobile || '';
                editMemberForm['edit-member-email'].value = data.email || '';
                editMemberForm['edit-member-address'].value = data.address || '';
                editMemberForm['edit-member-rent'].value = data.monthlyRent !== undefined ? data.monthlyRent : '';
            }
        } else if (e.target.classList.contains('delete-member-btn')) {
            if (confirm('আপনি কি এই সদস্যকে মেস থেকে ডিলিট করতে নিশ্চিত?')) {
                // Ensure admin cannot delete themselves or another admin
                const memberToDeleteDoc = await db.collection('users').doc(memberId).get();
                if (memberToDeleteDoc.exists && memberToDeleteDoc.data().role === 'admin') {
                    alert('আপনি একজন অ্যাডমিনকে ডিলিট করতে পারবেন না।');
                    return;
                }
                if (memberId === currentUserId) {
                    alert('আপনি নিজেকে ডিলিট করতে পারবেন না।');
                    return;
                }

                try {
                    // Remove messId from user, or set role to 'inactive'
                    await db.collection('users').doc(memberId).update({
                        messId: firebase.firestore.FieldValue.delete(), // Remove mess association
                        role: 'inactive' // Mark as inactive or another role
                    });
                    // Optionally, delete related data like meals, bazar entries for this user
                    alert('সদস্য সফলভাবে ডিলিট করা হয়েছে!');
                    loadMembers(); // Reload list
                } catch (error) {
                    console.error('ডিলিট ব্যর্থ:', error.message);
                    alert('ডিলিট করতে সমস্যা হয়েছে।');
                }
            }
        }
    });

    editMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const memberId = editMemberForm['edit-member-id'].value;
        const newName = editMemberForm['edit-member-name'].value;
        const newPhone = editMemberForm['edit-member-phone'].value;
        const newAddress = editMemberForm['edit-member-address'].value;
        const newRent = parseFloat(editMemberForm['edit-member-rent'].value);

        if (!memberId || !newName || !newPhone || !newAddress || isNaN(newRent) || newRent < 0 || currentUserRole !== 'admin') {
            alert('ফর্ম পূরণ করুন এবং আপনার অ্যাডমিন অনুমতি আছে কিনা নিশ্চিত করুন।');
            return;
        }

        try {
            await db.collection('users').doc(memberId).update({
                name: newName,
                mobile: newPhone,
                address: newAddress,
                monthlyRent: newRent,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('সদস্যের তথ্য সফলভাবে আপডেট করা হয়েছে!');
            editMemberSection.classList.add('hidden');
            editMemberForm.reset();
        } catch (error) {
            console.error('আপডেট ব্যর্থ:', error.message);
            alert(`আপডেট ব্যর্থ: ${error.message}`);
        }
    });

    cancelEditBtn.addEventListener('click', () => {
        editMemberSection.classList.add('hidden');
        editMemberForm.reset();
    });
});