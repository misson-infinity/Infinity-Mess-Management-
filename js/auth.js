// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // Toggle between login and signup forms
    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.classList.add('hidden');
        signupSection.classList.remove('hidden');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        signupSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    // Login functionality
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Check if the user is an admin (first user to sign up) or a member
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.role === 'admin') {
                    alert('অ্যাডমিন হিসেবে লগইন সফল!');
                    window.location.href = 'dashboard.html'; // Redirect to admin dashboard
                } else if (userData.role === 'member') {
                    alert('সদস্য হিসেবে লগইন সফল!');
                    window.location.href = 'dashboard.html'; // Redirect to member dashboard
                } else {
                    alert('আপনার অ্যাকাউন্টের রোল নির্ধারণ করা হয়নি।');
                }
            } else {
                alert('ব্যবহারকারীর ডেটা পাওয়া যায়নি।');
            }
        } catch (error) {
            console.error('লগইন ব্যর্থ:', error.message);
            alert(`লগইন ব্যর্থ: ${error.message}`);
        }
    });

    // Signup functionality (for admin)
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = signupForm['signup-name'].value;
        const address = signupForm['signup-address'].value;
        const mobile = signupForm['signup-mobile'].value;
        const gender = signupForm['signup-gender'].value;
        const religion = signupForm['signup-religion'].value;
        const userClass = signupForm['signup-class'].value;
        const department = signupForm['signup-department'].value;
        const email = signupForm['signup-email'].value;
        const password = signupForm['signup-password'].value;

        try {
            // Check if there are any existing users (to determine if this is the first admin)
            const usersSnapshot = await db.collection('users').get();
            const isAdmin = usersSnapshot.empty; // If no users, this is the first admin

            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Save user data to Firestore
            await db.collection('users').doc(user.uid).set({
                name: name,
                address: address,
                mobile: mobile,
                gender: gender,
                religion: religion,
                class: userClass,
                department: department,
                email: email,
                role: isAdmin ? 'admin' : 'member', // First user is admin, others default to member (though signup is initially for admin only)
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (isAdmin) {
                alert('অ্যাডমিন হিসেবে সাইনআপ সফল! এখন আপনি মেস তৈরি করতে পারবেন।');
                window.location.href = 'create-mess.html'; // Redirect to create mess page
            } else {
                // This part ideally shouldn't be reached if only admin can sign up
                alert('সাইনআপ সফল! কিন্তু আপনি অ্যাডমিন নন।');
                auth.signOut(); // Log out non-admin signups
            }

        } catch (error) {
            console.error('সাইনআপ ব্যর্থ:', error.message);
            alert(`সাইনআপ ব্যর্থ: ${error.message}`);
        }
    });

    // Check auth state on page load
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is logged in, redirect to dashboard
            // No need to redirect if on auth page, unless already logged in.
            // This can be adjusted based on desired UX.
            // For now, let's keep them on auth page to login/signup.
        } else {
            // User is not logged in
        }
    });
});