// ========================================
// FAHD KHALED SALON
// BOOKING + ADMIN + VIP + DELETE SYSTEM
// ========================================

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  updateDoc,
  writeBatch,
  serverTimestamp
} from
"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ========================================
// FIREBASE
// ========================================

const firebaseConfig = {
  apiKey: "AIzaSyByJ4mvTV4KwesCtd_9DZUCxmU8L_L7pvc",
  authDomain: "fahd-khaled-salon-website.firebaseapp.com",
  projectId: "fahd-khaled-salon-website",
  storageBucket: "fahd-khaled-salon-website.firebasestorage.app",
  messagingSenderId: "999874398926",
  appId: "1:999874398926:web:60a841f71a579d1b7e5e9f"
};

const ADMIN_UID = "n11bT3BtMaXwCWv2iYjW1sQ61Hv2";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ========================================
// HELPERS
// ========================================

const $ = id => document.getElementById(id);

function showMessage(id, text, color = "") {
  const element = $(id);
  if (!element) return;

  element.textContent = text;

  if (color) element.style.color = color;
}

function localDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function addDays(dateString, amount) {
  const date = new Date(dateString + "T12:00:00");
  date.setDate(date.getDate() + amount);
  return localDate(date);
}

function makeSlotId(barber, date, time) {
  return encodeURIComponent(`${barber}|${date}|${time}`);
}

function getAppointmentSlots(barber, date, time) {
  const [hour, minute] = time.split(":").map(Number);
  const start = hour * 60 + minute;
  const slots = [];

  for (let i = 0; i < 3; i++) {
    const total = start + i * 15;
    const dayOffset = Math.floor(total / 1440);
    const minuteOfDay = total % 1440;

    const h = Math.floor(minuteOfDay / 60);
    const m = minuteOfDay % 60;

    const slotDate = addDays(date, dayOffset);

    const slotTime =
      String(h).padStart(2, "0") + ":" +
      String(m).padStart(2, "0");

    slots.push({
      id: makeSlotId(barber, slotDate, slotTime),
      date: slotDate,
      time: slotTime
    });
  }

  return slots;
}

function formatTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "مساءً" : "صباحاً";
  const h = hour % 12 || 12;

  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function validPhone(phone) {
  return /^01[0125][0-9]{8}$/.test(phone);
}

// ========================================
// MENU
// ========================================

$("menuToggle")?.addEventListener("click", () => {
  $("mainNav")?.classList.toggle("open");
});

document.querySelectorAll("#mainNav a").forEach(link => {
  link.addEventListener("click", () => {
    $("mainNav")?.classList.remove("open");
  });
});

// ========================================
// YEAR
// ========================================

if ($("currentYear")) {
  $("currentYear").textContent = new Date().getFullYear();
}

// ========================================
// SERVICES TOTAL
// ========================================

function calculateTotal() {
  const selected = document.querySelectorAll(
    '#serviceChoices input[type="checkbox"]:checked'
  );

  let total = 0;
  const names = [];

  selected.forEach(item => {
    total += Number(item.dataset.price || 0);
    names.push(item.value);
  });

  if ($("bookingTotal")) {
    $("bookingTotal").textContent = total;
  }

  if ($("selectedServicesSummary")) {
    $("selectedServicesSummary").textContent =
      names.length
        ? "الخدمات المختارة: " + names.join(" - ")
        : "";
  }

  return { total, names };
}

document.querySelectorAll(
  '#serviceChoices input[type="checkbox"]'
).forEach(input => {
  input.addEventListener("change", calculateTotal);
});

calculateTotal();

// ========================================
// DATE
// ========================================

if ($("bookingDate")) {
  $("bookingDate").min = localDate(new Date());
}

// ========================================
// AVAILABLE TIMES
// ========================================

let loadingTimes = false;

async function loadAvailableTimes() {
  const barber = $("barberSelect")?.value;
  const date = $("bookingDate")?.value;
  const select = $("bookingTime");

  if (!select) return;

  if (!barber || !date) {
    select.innerHTML = "";
    select.add(new Option("اختار الحلاق والتاريخ أولاً", ""));
    select.disabled = true;
    showMessage("availabilityMessage", "");
    return;
  }

  if (date < localDate(new Date())) {
    select.innerHTML = "";
    select.add(new Option("تاريخ غير صالح", ""));
    select.disabled = true;

    showMessage(
      "availabilityMessage",
      "اختار تاريخ اليوم أو تاريخ قادم."
    );

    return;
  }

  if (loadingTimes) return;

  loadingTimes = true;
  select.disabled = true;
  select.innerHTML = "";
  select.add(new Option("جاري تحميل المواعيد...", ""));

  showMessage("availabilityMessage", "جاري فحص المواعيد...");

  try {
    const slotsQuery = query(
      collection(db, "barberSlots"),
      where("barber", "==", barber)
    );

    const snapshot = await getDocs(slotsQuery);
    const busy = new Set();

    snapshot.forEach(item => {
      const data = item.data();
      busy.add(`${data.date}|${data.time}`);
    });

    select.innerHTML = "";

    const now = new Date();
    const today = localDate(now);
    const currentMinutes =
      now.getHours() * 60 + now.getMinutes();

    let count = 0;

    for (let start = 660; start <= 1455; start += 15) {
      const hour = Math.floor((start % 1440) / 60);
      const minute = start % 60;

      const time =
        String(hour).padStart(2, "0") + ":" +
        String(minute).padStart(2, "0");

      if (
        date === today &&
        start < 1440 &&
        start <= currentMinutes
      ) {
        continue;
      }

      const appointmentSlots =
        getAppointmentSlots(barber, date, time);

      const isBusy = appointmentSlots.some(slot =>
        busy.has(`${slot.date}|${slot.time}`)
      );

      if (!isBusy) {
        select.add(new Option(formatTime(time), time));
        count++;
      }
    }

    if (count === 0) {
      select.add(new Option("لا توجد مواعيد متاحة", ""));
      select.disabled = true;
      showMessage(
        "availabilityMessage",
        "لا توجد مواعيد متاحة في هذا اليوم."
      );
    } else {
      select.disabled = false;
      showMessage(
        "availabilityMessage",
        `متاح ${count} موعد. اختار الموعد المناسب.`
      );
    }

  } catch (error) {
    console.error(error);

    select.innerHTML = "";
    select.add(new Option("تعذر تحميل المواعيد", ""));
    select.disabled = true;

    showMessage(
      "availabilityMessage",
      "خطأ في تحميل المواعيد: " + error.message,
      "#ff7777"
    );

  } finally {
    loadingTimes = false;
  }
}

$("barberSelect")?.addEventListener("change", loadAvailableTimes);
$("bookingDate")?.addEventListener("change", loadAvailableTimes);

// ========================================
// BOOKING
// ========================================

let bookingInProgress = false;

$("bookingForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (bookingInProgress) return;

  const name = $("customerName").value.trim();
  const phone = $("customerPhone").value.trim();
  const barber = $("barberSelect").value;
  const date = $("bookingDate").value;
  const time = $("bookingTime").value;
  const notes = $("bookingNotes").value.trim();

  const services = calculateTotal();

  if (name.length < 2) {
    showMessage("formMessage", "اكتب اسمك بشكل صحيح.");
    return;
  }

  if (!validPhone(phone)) {
    showMessage("formMessage", "اكتب رقم موبايل مصري صحيح.");
    return;
  }

  if (!barber || !date || !time) {
    showMessage("formMessage", "اختار الحلاق والتاريخ والموعد.");
    return;
  }

  if (!services.names.length) {
    showMessage("formMessage", "اختار خدمة واحدة على الأقل.");
    return;
  }

  if (date < localDate(new Date())) {
    showMessage("formMessage", "التاريخ غير صالح.");
    return;
  }

  bookingInProgress = true;

  const button = $("submitBooking");
  button.disabled = true;
  button.textContent = "جاري تسجيل الحجز...";

  showMessage("formMessage", "");

  try {
    const bookingRef = doc(collection(db, "bookings"));
    const slots = getAppointmentSlots(barber, date, time);

    await runTransaction(db, async transaction => {
      const slotRefs = slots.map(slot =>
        doc(db, "barberSlots", slot.id)
      );

      const slotSnapshots = [];

      for (const ref of slotRefs) {
        slotSnapshots.push(await transaction.get(ref));
      }

      if (slotSnapshots.some(item => item.exists())) {
        throw new Error("الموعد تم حجزه بالفعل. اختار موعداً آخر.");
      }

      transaction.set(bookingRef, {
        name,
        phone,
        barber,
        service: services.names.join(" + "),
        services: services.names,
        total: services.total,
        date,
        time,
        notes,
        status: "confirmed",
        slotIds: slots.map(slot => slot.id),
        createdAt: serverTimestamp()
      });

      slots.forEach((slot, index) => {
        transaction.set(slotRefs[index], {
          bookingId: bookingRef.id,
          barber,
          date: slot.date,
          time: slot.time
        });
      });
    });

    $("bookingConfirmation").hidden = false;

    $("confirmationDetails").textContent =
      `الاسم: ${name} | الحلاق: ${barber} | التاريخ: ${date} | الموعد: ${formatTime(time)} | الإجمالي: ${services.total} جنيه`;

    showMessage("formMessage", "تم الحجز بنجاح.", "#75e49a");

    $("bookingForm").reset();
    calculateTotal();

    await loadAvailableTimes();

    $("bookingConfirmation").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  } catch (error) {
    console.error(error);

    showMessage(
      "formMessage",
      "لم يتم الحجز: " + error.message,
      "#ff7777"
    );

  } finally {
    bookingInProgress = false;
    button.disabled = false;
    button.textContent = "تأكيد الحجز";
  }
});

// ========================================
// ADMIN PANEL
// ========================================

$("adminAccess")?.addEventListener("click", () => {
  $("adminPanel").hidden = false;
});

$("closeAdmin")?.addEventListener("click", () => {
  $("adminPanel").hidden = true;
});

$("adminPanel")?.addEventListener("click", event => {
  if (event.target === $("adminPanel")) {
    $("adminPanel").hidden = true;
  }
});

// ========================================
// ADMIN LOGIN
// ========================================

$("adminLoginForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;
  const button = $("adminLoginButton");

  button.disabled = true;
  button.textContent = "جاري الدخول...";

  showMessage("adminLoginMessage", "");

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);
      throw new Error("الحساب ليس حساب الإدارة.");
    }

  } catch (error) {
    console.error(error);

    showMessage(
      "adminLoginMessage",
      "فشل الدخول: " + error.message,
      "#ff7777"
    );

  } finally {
    button.disabled = false;
    button.textContent = "تسجيل الدخول";
  }
});

// ========================================
// ADMIN AUTH
// ========================================

onAuthStateChanged(auth, async user => {
  if (user && user.uid === ADMIN_UID) {
    $("adminLoginForm").hidden = true;
    $("adminDashboard").hidden = false;

    showMessage("adminStatus", "تم تسجيل الدخول بنجاح.");

    await loadAdminBookings();

  } else {
    $("adminLoginForm").hidden = false;
    $("adminDashboard").hidden = true;

    if (user) {
      await signOut(auth);
    }
  }
});

// ========================================
// COMPLETE BOOKING + COUNT VISIT
// ========================================

async function changeBookingStatus(bookingId, newStatus) {
  const bookingRef = doc(db, "bookings", bookingId);

  if (newStatus !== "completed") {
    await updateDoc(bookingRef, {
      status: newStatus
    });
    return;
  }

  await runTransaction(db, async transaction => {
    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists()) {
      throw new Error("الحجز غير موجود.");
    }

    const booking = bookingSnapshot.data();

    if (booking.completedCounted === true) {
      transaction.update(bookingRef, {
        status: "completed"
      });
      return;
    }

    const phone = booking.phone;
    const customerRef = doc(db, "customers", phone);

    const customerSnapshot = await transaction.get(customerRef);

    const oldVisits = customerSnapshot.exists()
      ? Number(customerSnapshot.data().visits || 0)
      : 0;

    transaction.update(bookingRef, {
      status: "completed",
      completedCounted: true
    });

    transaction.set(customerRef, {
      phone: phone,
      name: booking.name,
      visits: oldVisits + 1,
      updatedAt: serverTimestamp()
    });
  });
}

// ========================================
// DELETE BOOKING + RELEASE SLOTS
// ========================================

async function deleteBooking(bookingId, slotIds = []) {
  if (auth.currentUser?.uid !== ADMIN_UID) {
    throw new Error("غير مسموح.");
  }

  const confirmed = confirm(
    "هل أنت متأكد من حذف هذا الحجز نهائياً؟"
  );

  if (!confirmed) return false;

  const batch = writeBatch(db);

  batch.delete(doc(db, "bookings", bookingId));

  slotIds.forEach(slotId => {
    batch.delete(doc(db, "barberSlots", slotId));
  });

  await batch.commit();

  return true;
}

// ========================================
// ADMIN BOOKINGS
// ========================================

async function loadAdminBookings() {
  if (auth.currentUser?.uid !== ADMIN_UID) return;

  const list = $("bookingsList");
  list.textContent = "جاري تحميل الحجوزات...";

  try {
    const q = query(
      collection(db, "bookings"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const snapshot = await getDocs(q);

    list.innerHTML = "";

    if (snapshot.empty) {
      list.textContent = "لا توجد حجوزات.";
      return;
    }

    const phones = [
      ...new Set(
        snapshot.docs
          .map(item => item.data().phone)
          .filter(Boolean)
      )
    ];

    const customerMap = new Map();

    await Promise.all(
      phones.map(async phone => {
        const customerSnapshot = await getDoc(
          doc(db, "customers", phone)
        );

        customerMap.set(
          phone,
          customerSnapshot.exists()
            ? Number(customerSnapshot.data().visits || 0)
            : 0
        );
      })
    );

    snapshot.forEach(bookingDoc => {
      const booking = bookingDoc.data();

      const card = document.createElement("div");
      card.className = "booking-card";

      const details = document.createElement("p");

      const visits = customerMap.get(booking.phone) || 0;

      details.textContent =
        `الاسم: ${booking.name} | الهاتف: ${booking.phone} | الحلاق: ${booking.barber} | التاريخ: ${booking.date} | الوقت: ${booking.time} | الخدمات: ${booking.service} | الإجمالي: ${booking.total} جنيه | الحالة: ${booking.status} | زيارات العميل: ${visits}`;

      const status = document.createElement("select");

      [
        ["new", "جديد"],
        ["confirmed", "مؤكد"],
        ["completed", "مكتمل"],
        ["rejected", "مرفوض"]
      ].forEach(([value, label]) => {
        status.add(new Option(label, value));
      });

      status.value = booking.status || "confirmed";

      const save = document.createElement("button");
      save.type = "button";
      save.textContent = "حفظ الحالة";

      save.addEventListener("click", async () => {
        try {
          if (auth.currentUser?.uid !== ADMIN_UID) return;

          save.disabled = true;

          await changeBookingStatus(
            bookingDoc.id,
            status.value
          );

          showMessage("adminStatus", "تم تحديث الحالة.");

          await loadAdminBookings();

        } catch (error) {
          showMessage(
            "adminStatus",
            "خطأ: " + error.message,
            "#ff7777"
          );

          save.disabled = false;
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "حذف الحجز";
      deleteButton.style.background = "#a52a2a";
      deleteButton.style.color = "white";
      deleteButton.style.margin = "8px";

      deleteButton.addEventListener("click", async () => {
        try {
          deleteButton.disabled = true;

          const deleted = await deleteBooking(
            bookingDoc.id,
            booking.slotIds || []
          );

          if (deleted) {
            showMessage("adminStatus", "تم حذف الحجز وإتاحة الموعد.");
            await loadAdminBookings();
          } else {
            deleteButton.disabled = false;
          }

        } catch (error) {
          console.error(error);

          showMessage(
            "adminStatus",
            "تعذر حذف الحجز: " + error.message,
            "#ff7777"
          );

          deleteButton.disabled = false;
        }
      });

      card.append(details, status, save, deleteButton);
      list.appendChild(card);
    });

  } catch (error) {
    console.error(error);

    list.textContent =
      "خطأ في تحميل الحجوزات: " + error.message;
  }
}

// ========================================
// ADMIN LOGOUT
// ========================================

$("adminLogout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showMessage("adminLoginMessage", "تم تسجيل الخروج.");
  } catch (error) {
    showMessage("adminStatus", error.message);
  }
});

// ========================================
// CUSTOMER VIP LOOKUP
// ========================================

$("loyaltyForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const phone = $("loyaltyPhone").value.trim();
  const button = $("loyaltySearchButton");

  if (!validPhone(phone)) {
    showMessage(
      "loyaltyMessage",
      "اكتب رقم موبايل مصري صحيح.",
      "#ff7777"
    );
    $("loyaltyResult").hidden = true;
    return;
  }

  button.disabled = true;
  button.textContent = "جاري البحث...";

  showMessage("loyaltyMessage", "");
  $("loyaltyResult").hidden = true;

  try {
    const customerRef = doc(db, "customers", phone);
    const customerSnapshot = await getDoc(customerRef);

    const visits = customerSnapshot.exists()
      ? Number(customerSnapshot.data().visits || 0)
      : 0;

    const rewards = Math.floor(visits / 5);
    const remaining = 5 - (visits % 5);

    $("loyaltyVisits").textContent = visits;
    $("loyaltyRewards").textContent = rewards;

    $("loyaltyNextReward").textContent =
      visits >= 5 && visits % 5 === 0
        ? "مبروك! عندك خصم 50% مستحق على تنظيف البشرة."
        : `متبقي ${remaining} زيارة للحصول على المكافأة القادمة.`;

    $("loyaltyResult").hidden = false;

    showMessage(
      "loyaltyMessage",
      "تم الاستعلام بنجاح.",
      "#75e49a"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      "loyaltyMessage",
      "تعذر الاستعلام: " + error.message,
      "#ff7777"
    );

  } finally {
    button.disabled = false;
    button.textContent = "استعلام";
  }
});

// ========================================
// ERROR HANDLING
// ========================================

window.addEventListener("error", event => {
  console.error(event.error);

  showMessage(
    "siteError",
    "حدث خطأ في الموقع. برجاء تحديث الصفحة."
  );
});

window.addEventListener("unhandledrejection", event => {
  console.error(event.reason);

  showMessage(
    "siteError",
    "حدث خطأ في الاتصال. برجاء المحاولة مرة أخرى."
  );
});

console.log("FAHD KHALED SALON READY");
