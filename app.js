// Firebase connection for FAHD KHALED SALON
// Public Firebase web configuration. Database access is controlled by Firestore Security Rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

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

const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("mainNav");
menuToggle?.addEventListener("click", () => nav.classList.toggle("open"));
nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => nav.classList.remove("open")));

document.getElementById("year").textContent = new Date().getFullYear();

const dateInput = document.querySelector('input[name="date"]');
if (dateInput) {
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  dateInput.min = localToday;
}

const form = document.getElementById("bookingForm");
const message = document.getElementById("formMessage");
const submitButton = document.getElementById("submitBooking");

form.addEventListener("submit", async (event) => {
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
    if (dateInput) {
      const now = new Date();
      dateInput.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }
    message.textContent = "وصلنا طلبك بنجاح! الصالون هيتواصل معاك لتأكيد الموعد.";
  } catch (error) {
    console.error("Booking submission failed:", error);
    message.textContent = "تعذر إرسال الطلب حاليًا. إعدادات أمان قاعدة البيانات لسه محتاجة تفعيل.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "إرسال طلب الحجز";
  }
});
