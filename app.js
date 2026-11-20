// =====================================
// FAHD KHALED SALON
// Firebase + Booking + Admin + Visits
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
  updateDoc
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Admin UID
const ADMIN_UID = "n11bT3BtMaXwCWv2iYjW1sQ61Hv2";

// =====================================
// عناصر الموقع
// =====================================

const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("mainNav");

menuToggle?.addEventListener("click", () => {
  nav?.classList.toggle("open");
});

nav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
  });
});

// السنة
const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
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

form?.addEventListener("submit", async (event) => {

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

// =====================================
// فتح لوحة الإدارة
// =====================================

adminAccess?.addEventListener("click", (event) => {

  event.preventDefault();

  if (!adminPanel) return;

  adminPanel.style.display = "block";

  adminPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

});

// =====================================
// رسائل المدير
// =====================================

function showAdminMessage(text) {
  if (adminLoginMessage) {
    adminLoginMessage.textContent = text;
  }
}

// =====================================
// تسجيل دخول المدير
// =====================================

adminLoginForm?.addEventListener("submit", async (event) => {

  event.preventDefault();

  showAdminMessage("جاري تسجيل الدخول...");

  try {

    const email = adminEmail.value.trim();
    const password = adminPassword.value;

    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
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
      showAdminMessage("حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.");
    }

  }

});

// =====================================
// توحيد رقم الموبايل لحساب الزيارات
// =====================================

function normalizePhone(phone) {
  let value = String(phone || "").replace(/\D/g, "");

  // توحيد الأرقام المصرية التي تبدأ بـ 0020 أو 20
  if (value.startsWith("0020")) {
    value = value.slice(4);
  } else if (value.startsWith("20") && value.length === 12) {
    value = value.slice(2);
  }

  return value;
}

// =====================================
// عرض الحجوزات وعدد زيارات العملاء
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

    (snapshot) => {

      bookingsList.replaceChildren();

      if (snapshot.empty) {
        adminStatus.textContent = "لا توجد حجوزات حتى الآن.";
        return;
      }

      // حساب الزيارات لكل عميل
      const visitsByPhone = {};

      snapshot.forEach((item) => {

        const data = item.data();

        if (data.status === "completed") {

          const phone = normalizePhone(data.phone);

          if (phone) {
            visitsByPhone[phone] =
              (visitsByPhone[phone] || 0) + 1;
          }

        }

      });

      adminStatus.textContent =
        "عدد طلبات الحجز: " + snapshot.size;

      snapshot.forEach((bookingDoc) => {

        const booking = bookingDoc.data();

        const customerPhone = normalizePhone(booking.phone);

        const visits = visitsByPhone[customerPhone] || 0;

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
          ["ملاحظات", booking.notes || "لا توجد"],
        ];

        rows.forEach(([label, value]) => {

          const p = document.createElement("p");
          p.textContent = label + ": " + (value || "-");

          details.appendChild(p);

        });

        // عرض عدد الزيارات
        const visitsBox = document.createElement("div");

        visitsBox.textContent =
          "⭐ إجمالي زيارات العميل: " + visits + " زيارة";

        visitsBox.style.cssText = `
          background:#292216;
          border:1px solid #c9a45c;
          color:#e5c477;
          padding:12px;
          border-radius:8px;
          margin:12px 0;
          font-weight:bold;
          text-align:center;
        `;

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
              {
                status: select.value
              }
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
        card.appendChild(visitsBox);
        card.appendChild(statusLabel);
        card.appendChild(saveButton);

        bookingsList.appendChild(card);

      });

    },

    (error) => {

      console.error("Bookings error:", error);

      adminStatus.textContent =
        "تعذر تحميل الحجوزات. راجع صلاحيات قاعدة البيانات.";

    }

  );

}

// =====================================
// متابعة حالة تسجيل دخول المدير
// =====================================

onAuthStateChanged(auth, (user) => {

  if (user && user.uid === ADMIN_UID) {

    if (adminLogin) {
      adminLogin.style.display = "none";
    }

    if (adminDashboard) {
      adminDashboard.style.display = "block";
    }

    loadBookings();

  } else {

    if (unsubscribeBookings) {
      unsubscribeBookings();
      unsubscribeBookings = null;
    }

    if (adminLogin) {
      adminLogin.style.display = "block";
    }

    if (adminDashboard) {
      adminDashboard.style.display = "none";
    }

    if (bookingsList) {
      bookingsList.replaceChildren();
    }

  }

});

// =====================================
// تسجيل الخروج
// =====================================

adminLogout?.addEventListener("click", async () => {

  try {

    await signOut(auth);

    showAdminMessage("تم تسجيل الخروج.");

    if (adminPanel) {
      adminPanel.scrollIntoView({
        behavior: "smooth"
      });
    }

  } catch (error) {

    console.error("Logout error:", error);

    alert("تعذر تسجيل الخروج.");

  }

});
