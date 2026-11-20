// =====================================
// FAHD KHALED SALON
// Firebase + Booking + Admin + Loyalty
// =====================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyByJ4mvTV4KwesCtd_9DZUCxmU8L_L7pvc",
  authDomain: "fahd-khaled-salon-website.firebaseapp.com",
  projectId: "fahd-khaled-salon-website",
  storageBucket: "fahd-khaled-salon-website.firebasestorage.app",
  messagingSenderId: "999874398926",
  appId: "1:999874398926:web:60a841f71a579d1b7e5e9f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_UID = "n11bT3BtMaXwCWv2iYjW1sQ61Hv2";

// =====================================
// القائمة والسنة
// =====================================

const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("mainNav");

menuToggle?.addEventListener("click", () => {
  nav?.classList.toggle("open");
});

nav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    nav?.classList.remove("open");
  });
});

const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

// =====================================
// توحيد البيانات
// =====================================

function normalizePhone(phone) {
  let value = String(phone || "").replace(/\D/g, "");

  if (value.startsWith("0020")) {
    value = value.slice(4);
  } else if (value.startsWith("20") && value.length === 12) {
    value = value.slice(2);
  }

  return value;
}

function normalizeName(name) {
  return String(name || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// إنشاء معرف ثابت من الاسم ورقم الهاتف
async function createCustomerId(name, phone) {
  const identity =
    normalizeName(name) + "|" + normalizePhone(phone);

  const bytes = new TextEncoder().encode(identity);

  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

// =====================================
// تحديد أقل تاريخ للحجز
// =====================================

const dateInput = document.querySelector('input[name="date"]');

function setMinimumDate() {
  if (!dateInput) return;

  const today = new Date();

  dateInput.min = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);
}

setMinimumDate();

// =====================================
// نظام الحجوزات
// =====================================

const form = document.getElementById("bookingForm");
const message = document.getElementById("formMessage");
const submitButton = document.getElementById("submitBooking");

form?.addEventListener("submit", async event => {
  event.preventDefault();

  if (message) message.textContent = "";

  if (!form.reportValidity()) return;

  const formData = new FormData(form);

  const booking = {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    service: String(formData.get("service") || ""),
    date: String(formData.get("date") || ""),
    time: String(formData.get("time") || ""),
    notes: String(formData.get("notes") || "").trim().slice(0, 500),
    status: "new",
    createdAt: serverTimestamp()
  };

  if (booking.name.length < 2 || booking.phone.length < 7) {
    if (message) {
      message.textContent = "راجع الاسم ورقم الموبايل من فضلك.";
    }
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "جاري إرسال الطلب...";
  }

  try {
    await addDoc(collection(db, "bookings"), booking);

    form.reset();
    setMinimumDate();

    if (message) {
      message.textContent =
        "وصلنا طلبك بنجاح! الصالون هيتواصل معاك لتأكيد الموعد.";
    }

  } catch (error) {
    console.error("Booking error:", error);

    if (message) {
      message.textContent =
        "تعذر إرسال الطلب حاليًا. حاول مرة تانية.";
    }

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "إرسال طلب الحجز";
    }
  }
});

// =====================================
// نظام استعلام العميل عن زياراته
// =====================================

const loyaltyForm = document.getElementById("loyaltyForm");
const loyaltyName = document.getElementById("loyaltyName");
const loyaltyPhone = document.getElementById("loyaltyPhone");
const loyaltyButton = document.getElementById("loyaltySearchButton");

const loyaltyMessage = document.getElementById("loyaltyMessage");
const loyaltyResult = document.getElementById("loyaltyResult");

const loyaltyVisits = document.getElementById("loyaltyVisits");
const loyaltyRewards = document.getElementById("loyaltyRewards");
const loyaltyNextReward = document.getElementById("loyaltyNextReward");

loyaltyForm?.addEventListener("submit", async event => {
  event.preventDefault();

  loyaltyMessage.textContent = "";
  loyaltyResult.style.display = "none";

  const name = loyaltyName.value.trim();
  const phone = loyaltyPhone.value.trim();

  if (name.length < 2 || normalizePhone(phone).length < 7) {
    loyaltyMessage.textContent =
      "من فضلك اكتب الاسم ورقم الموبايل بشكل صحيح.";

    return;
  }

  loyaltyButton.disabled = true;
  loyaltyButton.textContent = "جاري البحث...";

  try {
    const customerId = await createCustomerId(name, phone);

    const customerRef = doc(db, "customers", customerId);
    const customerSnapshot = await getDoc(customerRef);

    if (!customerSnapshot.exists()) {
      loyaltyMessage.textContent =
        "لم نجد زيارات مسجلة بالبيانات دي. لو زرت الصالون قبل كده، تواصل معانا.";

      return;
    }

    const data = customerSnapshot.data();

    const visits = Number(data.visits || 0);
    const earned = Number(data.rewardsEarned || 0);
    const used = Number(data.rewardsUsed || 0);

    const available = Math.max(0, earned - used);

    loyaltyVisits.textContent = visits;
    loyaltyRewards.textContent = available;

    const nextVisit = ((visits % 5) === 0 && visits > 0)
      ? 5
      : 5 - (visits % 5);

    if (available > 0) {
      loyaltyNextReward.textContent =
        "🎁 مبروك! عندك " + available +
        " مكافأة تنظيف بشرة VIP بخصم 50%.";
    } else {
      loyaltyNextReward.textContent =
        "باقي لك " + nextVisit +
        " زيارة مكتملة للحصول على مكافأة VIP القادمة.";
    }

    loyaltyResult.style.display = "block";
    loyaltyMessage.textContent = "تم العثور على حسابك بنجاح.";

  } catch (error) {
    console.error("Loyalty search error:", error);

    loyaltyMessage.textContent =
      "حصل خطأ أثناء البحث. حاول مرة تانية.";

  } finally {
    loyaltyButton.disabled = false;
    loyaltyButton.textContent = "اعرف زياراتي ومكافآتي";
  }
});

// =====================================
// لوحة تحكم المدير
// =====================================

const adminPanel = document.getElementById("adminPanel");
const adminAccess = document.getElementById("adminAccess");

const adminLogin = document.getElementById("adminLogin");
const adminDashboard = document.getElementById("adminDashboard");

const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");

const adminLoginMessage = document.getElementById("adminLoginMessage");

const adminLogout = document.getElementById("adminLogout");
const adminStatus = document.getElementById("adminStatus");
const bookingsList = document.getElementById("bookingsList");

let unsubscribeBookings = null;

adminAccess?.addEventListener("click", event => {
  event.preventDefault();

  if (!adminPanel) return;

  adminPanel.style.display = "block";

  adminPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

function showAdminMessage(text) {
  if (adminLoginMessage) {
    adminLoginMessage.textContent = text;
  }
}

// =====================================
// تسجيل دخول المدير
// =====================================

adminLoginForm?.addEventListener("submit", async event => {
  event.preventDefault();

  showAdminMessage("جاري تسجيل الدخول...");

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      adminEmail.value.trim(),
      adminPassword.value
    );

    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);

      showAdminMessage("هذا الحساب غير مصرح له بدخول الإدارة.");
      return;
    }

    showAdminMessage("تم تسجيل الدخول بنجاح.");
    adminLoginForm.reset();

  } catch (error) {
    console.error("Login error:", error);

    if (error.code === "auth/invalid-credential") {
      showAdminMessage("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    } else if (error.code === "auth/too-many-requests") {
      showAdminMessage("محاولات كثيرة. حاول مرة أخرى لاحقًا.");
    } else {
      showAdminMessage("حدث خطأ أثناء تسجيل الدخول.");
    }
  }
});

// =====================================
// إنشاء قسم إدارة المكافآت
// =====================================

let loyaltyAdminList = null;

function createAdminLoyaltySection() {
  if (loyaltyAdminList || !adminDashboard || !bookingsList) return;

  const section = document.createElement("section");

  section.style.cssText = `
    margin:25px 0;
    padding:18px;
    background:#171717;
    border:1px solid #c9a45c;
    border-radius:12px;
    color:white;
  `;

  const title = document.createElement("h3");
  title.textContent = "⭐ ملفات العملاء ومكافآت VIP";

  loyaltyAdminList = document.createElement("div");

  section.appendChild(title);
  section.appendChild(loyaltyAdminList);

  adminDashboard.insertBefore(section, bookingsList);
}

// =====================================
// مزامنة الزيارات مع ملفات العملاء
// =====================================

async function syncCustomerRecords(snapshot) {
  const customers = new Map();

  for (const item of snapshot.docs) {
    const booking = item.data();

    if (booking.status !== "completed") continue;

    const phone = normalizePhone(booking.phone);
    const name = normalizeName(booking.name);

    if (!phone || !name) continue;

    const customerId = await createCustomerId(name, phone);

    if (!customers.has(customerId)) {
      customers.set(customerId, {
        visits: 0
      });
    }

    customers.get(customerId).visits++;
  }

  for (const [customerId, customer] of customers) {
    const customerRef = doc(db, "customers", customerId);

    const oldSnapshot = await getDoc(customerRef);

    const oldData = oldSnapshot.exists()
      ? oldSnapshot.data()
      : {};

    const earned = Math.floor(customer.visits / 5);

    const used = Number(oldData.rewardsUsed || 0);

    if (
      Number(oldData.visits || 0) !== customer.visits ||
      Number(oldData.rewardsEarned || 0) !== earned ||
      !oldSnapshot.exists()
    ) {
      await setDoc(customerRef, {
        visits: customer.visits,
        rewardsEarned: earned,
        rewardsUsed: used,
        updatedAt: serverTimestamp()
      });
    }
  }

  return customers;
}

// =====================================
// عرض العملاء والمكافآت في لوحة الإدارة
// =====================================

async function renderAdminCustomers(customers) {
  createAdminLoyaltySection();

  if (!loyaltyAdminList) return;

  loyaltyAdminList.replaceChildren();

  if (customers.size === 0) {
    loyaltyAdminList.textContent =
      "لا توجد زيارات مكتملة حتى الآن.";

    return;
  }

  for (const [customerId, customer] of customers) {
    const customerRef = doc(db, "customers", customerId);

    const customerSnapshot = await getDoc(customerRef);

    const data = customerSnapshot.exists()
      ? customerSnapshot.data()
      : {};

    const visits = customer.visits;
    const earned = Number(data.rewardsEarned || 0);
    const used = Number(data.rewardsUsed || 0);
    const available = Math.max(0, earned - used);

    const card = document.createElement("div");

    card.style.cssText = `
      background:#242018;
      border:1px solid #65502d;
      padding:15px;
      margin:12px 0;
      border-radius:10px;
    `;

    const title = document.createElement("h4");
    title.textContent = "عميل رقم " + customerId.slice(0, 8);

    const visitsText = document.createElement("p");
    visitsText.textContent = "الزيارات المكتملة: " + visits;

    const rewardsText = document.createElement("p");
    rewardsText.textContent =
      "المكافآت المتاحة: " + available;

    const usedText = document.createElement("p");
    usedText.textContent =
      "المكافآت المستخدمة: " + used;

    card.append(title, visitsText, rewardsText, usedText);

    if (available > 0) {
      const redeemButton = document.createElement("button");

      redeemButton.type = "button";
      redeemButton.textContent =
        "تسجيل استخدام تنظيف البشرة VIP";

      redeemButton.style.cssText = `
        background:#c9a45c;
        color:#111;
        border:0;
        padding:12px;
        border-radius:7px;
        font-weight:bold;
        margin-top:8px;
        cursor:pointer;
      `;

      redeemButton.addEventListener("click", async () => {
        if (!confirm("هل تم استخدام مكافأة تنظيف البشرة VIP؟")) {
          return;
        }

        redeemButton.disabled = true;
        redeemButton.textContent = "جاري التسجيل...";

        try {
          const latestSnapshot = await getDoc(customerRef);

          if (!latestSnapshot.exists()) {
            throw new Error("Customer not found");
          }

          const latest = latestSnapshot.data();

          const latestAvailable =
            Number(latest.rewardsEarned || 0) -
            Number(latest.rewardsUsed || 0);

          if (latestAvailable <= 0) {
            alert("لا توجد مكافآت متاحة.");
            return;
          }

          await updateDoc(customerRef, {
            rewardsUsed: Number(latest.rewardsUsed || 0) + 1,
            updatedAt: serverTimestamp()
          });

          alert("تم تسجيل استخدام المكافأة بنجاح.");

          await renderAdminCustomers(customers);

        } catch (error) {
          console.error("Reward redemption error:", error);

          alert("تعذر تسجيل استخدام المكافأة.");

          redeemButton.disabled = false;
          redeemButton.textContent =
            "تسجيل استخدام تنظيف البشرة VIP";
        }
      });

      card.appendChild(redeemButton);
    }

    loyaltyAdminList.appendChild(card);
  }
}

// =====================================
// تحميل الحجوزات
// =====================================

function loadBookings() {
  if (!bookingsList || !adminStatus) return;

  if (unsubscribeBookings) {
    unsubscribeBookings();
    unsubscribeBookings = null;
  }

  adminStatus.textContent = "جاري تحميل الحجوزات...";
  bookingsList.replaceChildren();

  const bookingsQuery = query(
    collection(db, "bookings"),
    orderBy("createdAt", "desc")
  );

  unsubscribeBookings = onSnapshot(
    bookingsQuery,

    async snapshot => {
      bookingsList.replaceChildren();

      try {
        const customers = await syncCustomerRecords(snapshot);

        await renderAdminCustomers(customers);

      } catch (error) {
        console.error("Customer sync error:", error);

        adminStatus.textContent =
          "تعذر تحديث ملفات العملاء. راجع صلاحيات Firebase.";

        return;
      }

      if (snapshot.empty) {
        adminStatus.textContent = "لا توجد حجوزات حتى الآن.";
        return;
      }

      adminStatus.textContent =
        "عدد طلبات الحجز: " + snapshot.size;

      snapshot.forEach(bookingDoc => {
        const booking = bookingDoc.data();

        const card = document.createElement("div");

        card.style.cssText = `
          background:#171717;
          border:1px solid #c9a45c;
          border-radius:12px;
          padding:18px;
          margin:15px 0;
          color:white;
          text-align:right;
        `;

        const title = document.createElement("h3");
        title.textContent = booking.name || "بدون اسم";

        const details = document.createElement("div");

        const rows = [
          ["رقم الموبايل", booking.phone],
          ["الخدمة", booking.service],
          ["اليوم", booking.date],
          ["الوقت", booking.time],
          ["ملاحظات", booking.notes || "لا توجد"]
        ];

        rows.forEach(([label, value]) => {
          const p = document.createElement("p");
          p.textContent = label + ": " + (value || "-");
          details.appendChild(p);
        });

        const statusLabel = document.createElement("label");
        statusLabel.textContent = "حالة الحجز: ";

        const select = document.createElement("select");

        select.style.cssText = `
          padding:10px;
          margin:8px;
          border-radius:6px;
          max-width:100%;
        `;

        const statuses = [
          ["new", "حجز جديد"],
          ["confirmed", "تم تأكيد الحجز"],
          ["rejected", "تم رفض الحجز"],
          ["completed", "تم تنفيذ الخدمة"]
        ];

        statuses.forEach(([value, text]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          select.appendChild(option);
        });

        select.value = booking.status || "new";

        const saveButton = document.createElement("button");

        saveButton.type = "button";
        saveButton.textContent = "حفظ الحالة";

        saveButton.style.cssText = `
          background:#c9a45c;
          color:#111;
          border:0;
          padding:10px 18px;
          border-radius:6px;
          cursor:pointer;
          margin:8px;
          font-weight:bold;
        `;

        saveButton.addEventListener("click", async () => {
          saveButton.disabled = true;
          saveButton.textContent = "جاري الحفظ...";

          try {
            await updateDoc(
              doc(db, "bookings", bookingDoc.id),
              { status: select.value }
            );

            saveButton.textContent = "تم الحفظ ✓";

          } catch (error) {
            console.error("Update error:", error);

            saveButton.textContent = "فشل الحفظ";
            alert("تعذر تحديث حالة الحجز.");

          } finally {
            saveButton.disabled = false;
          }
        });

        statusLabel.appendChild(select);

        card.appendChild(title);
        card.appendChild(details);
        card.appendChild(statusLabel);
        card.appendChild(saveButton);

        bookingsList.appendChild(card);
      });
    },

    error => {
      console.error("Bookings error:", error);

      adminStatus.textContent =
        "تعذر تحميل الحجوزات. راجع صلاحيات قاعدة البيانات.";
    }
  );
}

// =====================================
// متابعة تسجيل دخول المدير
// =====================================

onAuthStateChanged(auth, user => {
  if (user && user.uid === ADMIN_UID) {
    if (adminLogin) adminLogin.style.display = "none";
    if (adminDashboard) adminDashboard.style.display = "block";

    createAdminLoyaltySection();
    loadBookings();

  } else {
    if (unsubscribeBookings) {
      unsubscribeBookings();
      unsubscribeBookings = null;
    }

    if (adminLogin) adminLogin.style.display = "block";
    if (adminDashboard) adminDashboard.style.display = "none";

    if (bookingsList) bookingsList.replaceChildren();

    if (loyaltyAdminList) loyaltyAdminList.replaceChildren();
  }
});

// =====================================
// تسجيل الخروج
// =====================================

adminLogout?.addEventListener("click", async () => {
  try {
    await signOut(auth);

    showAdminMessage("تم تسجيل الخروج.");

    adminPanel?.scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    console.error("Logout error:", error);
    alert("تعذر تسجيل الخروج.");
  }
});
