// js/expense.js
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    const addOtherBillForm = document.getElementById('add-other-bill-form');
    const reportMonthSelect = document.getElementById('report-month-select');
    const generateReportBtn = document.getElementById('generate-report-btn');

    const totalBazarCostSpan = document.getElementById('total-bazar-cost');
    const totalShopDueSpan = document.getElementById('total-shop-due');
    const totalOtherBillsSpan = document.getElementById('total-other-bills');
    const totalMonthlyMealsReportSpan = document.getElementById('total-monthly-meals-report');
    const mealRateSpan = document.getElementById('meal-rate');
    const memberExpenseBody = document.getElementById('member-expense-body');
    const sendWhatsappBtn = document.getElementById('send-whatsapp-btn');
    const sendEmailBtn = document.getElementById('send-email-btn');

    let currentUserId = null;
    let currentUserRole = null;
    let currentUserMessId = null;
    let membersCache = []; // Store member details
    let currentReportData = null; // Store data for sending reports

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

                initializeReportMonthSelect();
                await loadMembersForReport(); // Load members for initial calculations
                generateReport(); // Generate report on page load
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

    function initializeReportMonthSelect() {
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        reportMonthSelect.value = currentMonth;
        addOtherBillForm['bill-month'].value = currentMonth; // Also set for adding bills
    }

    async function loadMembersForReport() {
        const membersSnapshot = await db.collection('users')
            .where('messId', '==', currentUserMessId)
            .get();
        membersCache = [];
        membersSnapshot.forEach(doc => {
            membersCache.push({ id: doc.id, ...doc.data() });
        });
    }

    // Add Other Bill Form Submission (Admin Only)
    addOtherBillForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const billType = addOtherBillForm['bill-type'].value;
        const billAmount = parseFloat(addOtherBillForm['bill-amount'].value);
        const billMonthYear = addOtherBillForm['bill-month'].value; // YYYY-MM

        if (!billType || isNaN(billAmount) || billAmount < 0 || !billMonthYear || !currentUserMessId || currentUserRole !== 'admin') {
            alert('ফর্ম পূরণ করুন এবং আপনার অ্যাডমিন অনুমতি আছে কিনা নিশ্চিত করুন।');
            return;
        }

        try {
            await db.collection('bills').add({
                messId: currentUserMessId,
                type: billType,
                amount: billAmount,
                monthYear: billMonthYear,
                addedBy: currentUserId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('বিল সফলভাবে যোগ করা হয়েছে!');
            addOtherBillForm.reset();
            addOtherBillForm['bill-month'].value = billMonthYear; // Keep month selected
            generateReport(); // Regenerate report after adding bill
        } catch (error) {
            console.error('বিল যোগ করতে ব্যর্থ:', error.message);
            alert(`বিল যোগ করতে ব্যর্থ: ${error.message}`);
        }
    });

    generateReportBtn.addEventListener('click', generateReport);

    async function generateReport() {
        if (!currentUserMessId) {
            alert('মেসের তথ্য লোড হয়নি।');
            return;
        }

        const selectedMonth = reportMonthSelect.value; // YYYY-MM
        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of the month

        // Fetch all bazar entries and shop dues for the month
        const bazarEntriesSnapshot = await db.collection('bazarEntries')
            .where('messId', '==', currentUserMessId)
            .where('date', '>=', startDate.toISOString().split('T')[0])
            .where('date', '<=', endDate.toISOString().split('T')[0])
            .get();

        let totalBazarCost = 0;
        let totalShopDue = 0;
        const memberBazarContributions = {}; // {userId: totalAmount}

        bazarEntriesSnapshot.forEach(doc => {
            const entry = doc.data();
            if (entry.type === 'bazar') {
                totalBazarCost += entry.amount;
                if (!memberBazarContributions[entry.userId]) {
                    memberBazarContributions[entry.userId] = 0;
                }
                memberBazarContributions[entry.userId] += entry.amount;
            } else if (entry.type === 'shop_due') {
                totalShopDue += entry.amount;
            }
        });

        // Fetch other bills for the month
        const billsSnapshot = await db.collection('bills')
            .where('messId', '==', currentUserMessId)
            .where('monthYear', '==', selectedMonth)
            .get();

        let totalOtherBills = 0;
        billsSnapshot.forEach(doc => {
            totalOtherBills += doc.data().amount;
        });

        // Calculate total meals for each member and total monthly meals
        const mealsData = {}; // {userId: totalMealsForMonth}
        const mealsSnapshot = await db.collection('meals')
            .where('messId', '==', currentUserMessId)
            .where('date', '>=', startDate.toISOString().split('T')[0])
            .where('date', '<=', endDate.toISOString().split('T')[0])
            .get();

        let totalMonthlyMeals = 0;
        mealsSnapshot.forEach(doc => {
            const meal = doc.data();
            let dailyTotal = 0;
            if (meal.morning) dailyTotal += 0.5;
            if (meal.noon) dailyTotal += 1;
            if (meal.night) dailyTotal += 1;

            if (!mealsData[meal.userId]) {
                mealsData[meal.userId] = 0;
            }
            mealsData[meal.userId] += dailyTotal;
            totalMonthlyMeals += dailyTotal;
        });

        // Update summary display
        totalBazarCostSpan.textContent = totalBazarCost.toFixed(2);
        totalShopDueSpan.textContent = totalShopDue.toFixed(2);
        totalOtherBillsSpan.textContent = totalOtherBills.toFixed(2);
        totalMonthlyMealsReportSpan.textContent = totalMonthlyMeals.toFixed(1);

        const totalFoodCost = totalBazarCost + totalShopDue;
        const mealRate = totalMonthlyMeals > 0 ? totalFoodCost / totalMonthlyMeals : 0;
        mealRateSpan.textContent = mealRate.toFixed(2);

        // Calculate individual member expenses
        memberExpenseBody.innerHTML = '';
        const numMembers = membersCache.length;
        const perMemberOtherBill = numMembers > 0 ? totalOtherBills / numMembers : 0;

        currentReportData = {
            summary: {
                totalBazarCost: totalBazarCost,
                totalShopDue: totalShopDue,
                totalOtherBills: totalOtherBills,
                totalMonthlyMeals: totalMonthlyMeals,
                mealRate: mealRate
            },
            members: []
        };

        membersCache.forEach(member => {
            const memberTotalMeals = mealsData[member.id] || 0;
            const foodExpense = memberTotalMeals * mealRate;
            const monthlyRent = member.monthlyRent || 0;

            const totalIndividualExpense = foodExpense + monthlyRent + perMemberOtherBill;
            const memberBazarContributed = memberBazarContributions[member.id] || 0;
            const balance = memberBazarContributed - totalIndividualExpense; // Positive means extra paid, negative means owes

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.name}</td>
                <td>${monthlyRent.toFixed(2)}</td>
                <td>${memberTotalMeals.toFixed(1)}</td>
                <td>${foodExpense.toFixed(2)}</td>
                <td>${perMemberOtherBill.toFixed(2)}</td>
                <td>${totalIndividualExpense.toFixed(2)}</td>
                <td>${memberBazarContributed.toFixed(2)}</td>
                <td style="color: ${balance >= 0 ? 'green' : 'red'}; font-weight: bold;">${balance.toFixed(2)} ${balance >= 0 ? '(ফেরত পাবে)' : '(বাকি)'}</td>
            `;
            memberExpenseBody.appendChild(row);

            currentReportData.members.push({
                name: member.name,
                email: member.email,
                phone: member.mobile,
                monthlyRent: monthlyRent,
                totalMeals: memberTotalMeals,
                foodExpense: foodExpense,
                perMemberOtherBill: perMemberOtherBill,
                totalIndividualExpense: totalIndividualExpense,
                bazarContributed: memberBazarContributed,
                balance: balance
            });
        });
    }

    sendWhatsappBtn.addEventListener('click', () => sendReport('whatsapp'));
    sendEmailBtn.addEventListener('click', () => sendReport('email'));

    function sendReport(type) {
        if (!currentReportData || currentReportData.members.length === 0) {
            alert('কোনো রিপোর্ট ডেটা নেই। অনুগ্রহ করে রিপোর্ট জেনারেট করুন।');
            return;
        }

        const selectedMonth = reportMonthSelect.value;
        const monthName = new Date(selectedMonth).toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' });

        let message = `*${monthName} মাসের মেস রিপোর্ট - Infinity Mess Management*\n\n`;
        message += `*সাধারণ হিসাব:*\n`;
        message += `মোট বাজার খরচ: ${currentReportData.summary.totalBazarCost.toFixed(2)} টাকা\n`;
        message += `মোট দোকানের বাকি: ${currentReportData.summary.totalShopDue.toFixed(2)} টাকা\n`;
        message += `মোট বিল (মেইড, কারেন্ট, ওয়াইফাই, অন্যান্য): ${currentReportData.summary.totalOtherBills.toFixed(2)} টাকা\n`;
        message += `মাসিক মোট মিল: ${currentReportData.summary.totalMonthlyMeals.toFixed(1)} মিল\n`;
        message += `মিল রেট: ${currentReportData.summary.mealRate.toFixed(2)} টাকা/মিল\n\n`;

        message += `*সদস্যদের ব্যক্তিগত হিসাব:*\n`;
        currentReportData.members.forEach(member => {
            message += `\n*${member.name}:*\n`;
            message += `  মাসিক ভাড়া: ${member.monthlyRent.toFixed(2)} টাকা\n`;
            message += `  মোট মিল: ${member.totalMeals.toFixed(1)} মিল\n`;
            message += `  খাবারের খরচ: ${member.foodExpense.toFixed(2)} টাকা\n`;
            message += `  অন্যান্য বিলের অংশ: ${member.perMemberOtherBill.toFixed(2)} টাকা\n`;
            message += `  মোট খরচ: ${member.totalIndividualExpense.toFixed(2)} টাকা\n`;
            message += `  মোট বাজার দিয়েছে: ${member.bazarContributed.toFixed(2)} টাকা\n`;
            message += `  বাকি/ফেরত: ${member.balance.toFixed(2)} ${member.balance >= 0 ? '(ফেরত পাবে)' : '(বাকি)'}\n`;
        });

        if (type === 'whatsapp') {
            const whatsappLink = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(whatsappLink, '_blank');
        } else if (type === 'email') {
            const subject = encodeURIComponent(`${monthName} মাসের মেস রিপোর্ট`);
            let body = encodeURIComponent(message);
            // Replace * with bold tags for email client support (though not all support markdown)
            body = body.replace(/\*(.*?)\*/g, '<b>$1</b>');
            const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
            window.open(mailtoLink);
        }
    }
});