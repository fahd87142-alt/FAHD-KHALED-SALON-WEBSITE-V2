// FAHD KHALED SALON
// Firebase + Booking + Admin Dashboard

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

// Firebase configuration
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

// المدير المسموح له بالدخول
const ADMIN_UID = "n11bT3BtMaXwCWv2iYjW1sQ61Hv2";

// عناصر الموقع
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("mainNav");

menuToggle?.addEventListener("click", () => {
  nav?.classList.toggle("open");
});

nav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => nav.classList.remove("open"));
});

document.getElementById("year").textContent =
  new Date().getFullYear();

// تحديد أقل تاريخ للحجز
const dateInput = document.querySelector('input[name="date"]');

function setMinimumDate() {
  if (!dateInput) return;

  const today = new Date();
  dateInput.min = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);
}

setMinimumDate();

// ===============================
// نظام الحجوزات
// ===============================

const form = document.getElementById("bookingForm");
const message = document.getElementById("formMessage");
const submitButton = document.getElementById("submitBooking");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  message.textContent = "";

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
    message.textContent = "راجع الاسم ورقم الموبايل من فضلك.";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "جاري إرسال الطلب...";

  try {
    await addDoc(collection(db, "bookings"), booking);

    form.reset();
    setMinimumDate();

    message.textContent =
      "وصلنا طلبك بنجاح! الصالون هيتواصل معاك لتأكيد الموعد.";

  } catch (error) {
    console.error("Booking error:", error);

    message.textContent =
      "تعذر إرسال الطلب حاليًا. حاول مرة تانية.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "إرسال طلب الحجز";
  }
});

// ===============================
// لوحة تحكم المدير
// ===============================

const adminPanel = document.getElementById("adminPanel");
const adminAccess = document.getElementById("adminAccess");

const adminLogin = document.getElementById("adminLogin");
const adminDashboard = document.getElementById("adminDashboard");

const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");

const adminLoginMessage =
  document.getElementById("adminLoginMessage");

const adminLogout = document.getElementById("adminLogout");
const adminStatus = document.getElementById("adminStatus");
const bookingsList = document.getElementById("bookingsList");

let unsubscribeBookings = null;

// فتح لوحة الإدارة
adminAccess?.addEventListener("click", (event) => {
  event.preventDefault();

  adminPanel.style.display = "block";

  adminPanel.scrollIntoView({
    behavior: "smooth"
  });
});

// عرض رسالة
function showAdminMessage(text) {
  adminLoginMessage.textContent = text;
}

// تسجيل دخول المدير
adminLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  showAdminMessage("جاري تسجيل الدخول...
