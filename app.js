// ========================================
// FAHD KHALED SALON
// BOOKING + ADMIN + LOYALTY + WHEEL + ATTENDANCE
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

const ADMIN_UID = "n11bT3BtMaXwCWv2";

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
  if (!time) return "-";

  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "مساءً" : "صباحاً";
  const h = hour % 12 || 12;

  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const parts = dateString.split("-");

  if (parts.length !== 3) return dateString;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getArabicDay(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString + "T12:00:00");

  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "long"
  }).format(date);
}

function validPhone(phone) {
  return /^01[0125][0-9]{8}$/.test(phone);
}

// ========================================
// LOYALTY REWARDS
// ========================================

const LOYALTY_REWARDS = [
  "قص شعر مجاناً",
  "قص دقن مجاناً",
  "جلسة بشرة كاملة مجاناً",
  "قص شعر + قص دقن + بشرة كاملة مجاناً"
];

let loyaltyCurrentPhone = "";
let loyaltySpinning = false;

function getCustomerLoyaltyData(customer) {
  const visits = Math.max(
    0,
    Number(customer?.visits || 0)
  );

  const spinsUsed = Math.max(
    0,
    Number(customer?.spinsUsed || 0)
  );

  const earnedSpins = Math.floor(visits / 10);

  const availableSpins = Math.max(
    0,
    earnedSpins - spinsUsed
  );

  const progress = availableSpins > 0
    ? 10
    : visits % 10;

  return {
    visits,
    spinsUsed,
    earnedSpins,
    availableSpins,
    progress
  };
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
// COMPLETE BOOKING + CUSTOMER VISITS
// ========================================

async function changeBookingStatus(bookingId, newStatus) {
  if (auth.currentUser?.uid !== ADMIN_UID) {
    throw new Error("غير مسموح.");
  }

  const bookingRef = doc(db, "bookings", bookingId);

  if (newStatus === "no_show") {
    await updateDoc(bookingRef, {
      status: "no_show"
    });

    return;
  }

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

    const oldCustomer = customerSnapshot.exists()
      ? customerSnapshot.data()
      : {};

    const oldVisits = Math.max(
      0,
      Number(oldCustomer.visits || 0)
    );

    transaction.update(bookingRef, {
      status: "completed",
      completedCounted: true
    });

    transaction.set(customerRef, {
      phone,
      name: booking.name || oldCustomer.name || "",
      visits: oldVisits + 1,
      spinsUsed: Number(oldCustomer.spinsUsed || 0),
      rewardHistory: Array.isArray(oldCustomer.rewardHistory)
        ? oldCustomer.rewardHistory
        : [],
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
}

// ========================================
// DELETE ONE BOOKING
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
// DELETE ALL BOOKINGS
// ========================================

async function deleteAllBookings() {
  if (auth.currentUser?.uid !== ADMIN_UID) {
    throw new Error("غير مسموح.");
  }

  const confirmed = confirm(
    "تحذير: هل أنت متأكد من مسح كل الحجوزات نهائياً؟"
  );

  if (!confirmed) return;

  const button = $("clearAllBookings");

  button.disabled = true;
  button.textContent = "جاري المسح...";

  try {
    const snapshot = await getDocs(
      collection(db, "bookings")
    );

    const bookings = snapshot.docs;

    for (let i = 0; i < bookings.length; i += 100) {
      const group = bookings.slice(i, i + 100);
      const batch = writeBatch(db);

      group.forEach(bookingDoc => {
        const booking = bookingDoc.data();

        batch.delete(
          doc(db, "bookings", bookingDoc.id)
        );

        (booking.slotIds || []).forEach(slotId => {
          batch.delete(
            doc(db, "barberSlots", slotId)
          );
        });
      });

      await batch.commit();
    }

    showMessage(
      "adminStatus",
      "تم مسح جميع الحجوزات وتحرير المواعيد.",
      "#75e49a"
    );

    await loadAdminBookings();

  } catch (error) {
    console.error(error);

    showMessage(
      "adminStatus",
      "تعذر مسح الحجوزات: " + error.message,
      "#ff7777"
    );

  } finally {
    button.disabled = false;
    button.textContent = "مسح كل الحجوزات";
  }
}

$("clearAllBookings")?.addEventListener(
  "click",
  deleteAllBookings
);

// ========================================
// DOWNLOAD BOOKINGS CSV
// ========================================

function escapeCSV(value) {
  const text = String(value ?? "");

  return '"' + text.replace(/"/g, '""') + '"';
}

async function downloadBookings() {
  if (auth.currentUser?.uid !== ADMIN_UID) {
    showMessage("adminStatus", "غير مسموح.", "#ff7777");
    return;
  }

  const button = $("downloadBookings");

  button.disabled = true;
  button.textContent = "جاري تجهيز الملف...";

  try {
    const snapshot = await getDocs(
      collection(db, "bookings")
    );

    const rows = [
      [
        "الاسم",
        "رقم الموبايل",
        "الحلاق",
        "اليوم",
        "التاريخ",
        "الوقت",
        "الخدمة",
        "إجمالي السعر",
        "الحالة"
      ]
    ];

    snapshot.docs.forEach(item => {
      const booking = item.data();

      let status = "مؤكد";

      if (booking.status === "completed") {
        status = "حضر";
      } else if (booking.status === "no_show") {
        status = "لم يحضر";
      } else if (booking.status === "rejected") {
        status = "مرفوض";
      }

      rows.push([
        booking.name || "",
        booking.phone || "",
        booking.barber || "",
        getArabicDay(booking.date),
        formatDate(booking.date),
        formatTime(booking.time),
        booking.service || "",
        booking.total || 0,
        status
      ]);
    });

    const csv = "\uFEFF" + rows
      .map(row => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(
      [csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download =
      "FAHD-KHALED-BOOKINGS-" + localDate(new Date()) + ".csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showMessage(
      "adminStatus",
      "تم تنزيل ملف الحجوزات بنجاح.",
      "#75e49a"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      "adminStatus",
      "تعذر تنزيل الملف: " + error.message,
      "#ff7777"
    );

  } finally {
    button.disabled = false;
    button.textContent = "⬇ تنزيل الحجوزات";
  }
}

$("downloadBookings")?.addEventListener(
  "click",
  downloadBookings
);

// ========================================
// ADMIN BOOKINGS TABLE
// ========================================

async function loadAdminBookings() {
  if (auth.currentUser?.uid !== ADMIN_UID) return;

  const list = $("bookingsList");

  if (!list) return;

  list.textContent = "جاري تحميل الحجوزات...";

  try {
    const snapshot = await getDocs(
      collection(db, "bookings")
    );

    const bookings = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    bookings.sort((a, b) => {
      const dateCompare =
        String(b.date || "").localeCompare(String(a.date || ""));

      if (dateCompare !== 0) return dateCompare;

      return String(a.time || "").localeCompare(String(b.time || ""));
    });

    const countElement = $("totalBookingsCount");

    if (countElement) {
      countElement.textContent = bookings.length;
    }

    list.innerHTML = "";

    if (!bookings.length) {
      list.textContent = "لا توجد حجوزات حالياً.";
      return;
    }

    const phones = [
      ...new Set(
        bookings
          .map(item => item.phone)
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

    const grouped = new Map();

    bookings.forEach(booking => {
      const date = booking.date || "بدون تاريخ";

      if (!grouped.has(date)) {
        grouped.set(date, []);
      }

      grouped.get(date).push(booking);
    });

    grouped.forEach((dayBookings, date) => {

      const daySection = document.createElement("section");
      daySection.className = "booking-day-section";

      const dayTitle = document.createElement("h3");
      dayTitle.className = "booking-day-title";

      if (date === "بدون تاريخ") {
        dayTitle.textContent = "حجوزات بدون تاريخ";
      } else {
        dayTitle.textContent =
          getArabicDay(date) + " - " + formatDate(date);
      }

      daySection.appendChild(dayTitle);

      const tableWrapper = document.createElement("div");
      tableWrapper.className = "booking-table-wrapper";

      const table = document.createElement("table");
      table.className = "admin-bookings-table";

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      [
        "الاسم",
        "الرقم",
        "اليوم",
        "التاريخ",
        "الوقت",
        "الخدمة",
        "إجمالي السعر",
        "الحضور / الغياب"
      ].forEach(title => {
        const th = document.createElement("th");
        th.textContent = title;
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      dayBookings.forEach(booking => {

        const row = document.createElement("tr");

        const values = [
          booking.name || "-",
          booking.phone || "-",
          getArabicDay(booking.date),
          formatDate(booking.date),
          formatTime(booking.time),
          booking.service || "-",
          `${Number(booking.total || 0)} جنيه`
        ];

        values.forEach(value => {
          const td = document.createElement("td");
          td.textContent = value;
          row.appendChild(td);
        });

        const attendanceCell = document.createElement("td");
        attendanceCell.className = "attendance-cell";

        const attendanceButtons = document.createElement("div");
        attendanceButtons.className = "attendance-buttons";

        const presentButton = document.createElement("button");
        presentButton.type = "button";
        presentButton.textContent = "✓";
        presentButton.className = "attendance-present";
        presentButton.title = "حضر";

        const absentButton = document.createElement("button");
        absentButton.type = "button";
        absentButton.textContent = "✕";
        absentButton.className = "attendance-absent";
        absentButton.title = "لم يحضر";

        if (booking.status === "completed") {
          presentButton.classList.add("active");
        }

        if (booking.status === "no_show") {
          absentButton.classList.add("active");
        }

        presentButton.addEventListener("click", async () => {
          await updateAttendance(
            booking.id,
            "completed",
            presentButton,
            absentButton
          );
        });

        absentButton.addEventListener("click", async () => {
          await updateAttendance(
            booking.id,
            "no_show",
            presentButton,
            absentButton
          );
        });

        attendanceButtons.append(
          presentButton,
          absentButton
        );

        attendanceCell.appendChild(attendanceButtons);
        row.appendChild(attendanceCell);

        tbody.appendChild(row);

        const extraRow = document.createElement("tr");
        extraRow.className = "booking-extra-row";

        const extraCell = document.createElement("td");
        extraCell.colSpan = 8;

        const visits = customerMap.get(booking.phone) || 0;

        extraCell.textContent =
          `الحلاق: ${booking.barber || "-"} | إجمالي زيارات العميل: ${visits}`;

        extraRow.appendChild(extraCell);
        tbody.appendChild(extraRow);
      });

      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      daySection.appendChild(tableWrapper);

      list.appendChild(daySection);
    });

  } catch (error) {
    console.error(error);

    list.textContent =
      "خطأ في تحميل الحجوزات: " + error.message;
  }
}

// ========================================
// UPDATE ATTENDANCE
// ========================================

async function updateAttendance(
  bookingId,
  newStatus,
  presentButton,
  absentButton
) {
  if (auth.currentUser?.uid !== ADMIN_UID) {
    showMessage("adminStatus", "غير مسموح.", "#ff7777");
    return;
  }

  presentButton.disabled = true;
  absentButton.disabled = true;

  try {
    await changeBookingStatus(bookingId, newStatus);

    if (newStatus === "completed") {
      showMessage(
        "adminStatus",
        "تم تسجيل حضور العميل واحتساب الزيارة.",
        "#75e49a"
      );
    } else {
      showMessage(
        "adminStatus",
        "تم تسجيل غياب العميل.",
        "#ff7777"
      );
    }

    await loadAdminBookings();

  } catch (error) {
    console.error(error);

    showMessage(
      "adminStatus",
      "تعذر تحديث الحالة: " + error.message,
      "#ff7777"
    );

    presentButton.disabled = false;
    absentButton.disabled = false;
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
// LOYALTY CARD DESIGN
// ========================================

function addLoyaltyStyles() {
  if ($("loyaltyDynamicStyles")) return;

  const style = document.createElement("style");
  style.id = "loyaltyDynamicStyles";

  style.textContent = `
    .loyalty-card-new {
      background: linear-gradient(145deg, #171717, #080808);
      border: 1px solid #b9954b;
      border-radius: 20px;
      padding: 22px;
      margin-top: 18px;
      color: #f7f0df;
      box-shadow: 0 8px 30px rgba(0,0,0,.35);
      direction: rtl;
      text-align: center;
    }

    .loyalty-card-new * {
      box-sizing: border-box;
    }

    .loyalty-brand {
      color: #d6b66d;
      font-size: 13px;
      letter-spacing: 2px;
      margin-bottom: 8px;
      font-weight: 800;
    }

    .loyalty-card-title {
      color: #fff;
      font-size: 22px;
      margin: 5px 0 18px;
      font-weight: 900;
    }

    .loyalty-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }

    .loyalty-stat {
      border: 1px solid rgba(201,164,92,.35);
      border-radius: 12px;
      padding: 12px 5px;
      background: rgba(255,255,255,.035);
    }

    .loyalty-stat strong {
      display: block;
      color: #d9b967;
      font-size: 25px;
      margin-bottom: 4px;
    }

    .loyalty-stat span {
      color: #bbb;
      font-size: 12px;
    }

    .loyalty-dots-title {
      color: #d9b967;
      font-weight: 800;
      margin: 12px 0;
    }

    .loyalty-dots {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      max-width: 280px;
      margin: 15px auto;
    }

    .loyalty-dot {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      margin: auto;
      border: 1px solid #80672f;
      background: #292929;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #777;
      font-weight: 900;
      font-size: 16px;
    }

    .loyalty-dot.active {
      background: linear-gradient(145deg, #f4d78a, #ad8235);
      color: #17120a;
      border-color: #ffe5a1;
      box-shadow: 0 0 13px rgba(220,181,91,.35);
    }

    .loyalty-progress-text {
      color: #ddd;
      font-size: 13px;
      margin: 12px 0;
    }

    .loyalty-reward-status {
      border: 1px solid rgba(201,164,92,.4);
      background: rgba(201,164,92,.08);
      border-radius: 12px;
      padding: 13px;
      margin-top: 15px;
      color: #e8d3a3;
      line-height: 1.8;
      font-size: 14px;
    }

    .loyalty-wheel-area {
      margin-top: 22px;
      padding-top: 20px;
      border-top: 1px solid rgba(201,164,92,.25);
    }

    .loyalty-wheel-title {
      color: #d9b967;
      font-size: 19px;
      font-weight: 900;
      margin-bottom: 8px;
    }

    .loyalty-wheel-desc {
      color: #bbb;
      font-size: 13px;
      margin-bottom: 15px;
    }

    .loyalty-wheel-wrap {
      position: relative;
      width: 260px;
      height: 260px;
      max-width: 100%;
      margin: 10px auto 18px;
    }

    .loyalty-wheel {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 7px solid #d0ac60;
      position: relative;
      overflow: hidden;
      background: conic-gradient(
        #d2ad60 0deg 90deg,
        #222 90deg 180deg,
        #d2ad60 180deg 270deg,
        #222 270deg 360deg
      );
      box-shadow: 0 0 22px rgba(201,164,92,.2);
      transition: transform 5s cubic-bezier(.12,.75,.12,1);
    }

    .loyalty-wheel::after {
      content: "";
      position: absolute;
      width: 42px;
      height: 42px;
      background: #111;
      border: 4px solid #e5c477;
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform: translate(-50%,-50%);
      z-index: 5;
    }

    .wheel-label {
      position: absolute;
      width: 88px;
      color: #17120a;
      font-size: 11px;
      font-weight: 900;
      line-height: 1.35;
      text-align: center;
      z-index: 2;
    }

    /* القطاع الأول: أعلى اليمين */
    .wheel-label.one {
      top: 24%;
      right: 7%;
      color: #17120a;
    }

    /* القطاع الثاني: أسفل اليمين */
    .wheel-label.two {
      bottom: 24%;
      right: 7%;
      color: #f2dfb5;
    }

    /* القطاع الثالث: أسفل اليسار */
    .wheel-label.three {
      bottom: 24%;
      left: 7%;
      color: #17120a;
    }

    /* القطاع الرابع: أعلى اليسار */
    .wheel-label.four {
      top: 24%;
      left: 7%;
      color: #f2dfb5;
    }

    .loyalty-wheel-pointer {
      position: absolute;
      z-index: 10;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 13px solid transparent;
      border-right: 13px solid transparent;
      border-top: 25px solid #fff0bd;
      filter: drop-shadow(0 2px 3px #000);
    }

    .loyalty-spin-button {
      background: linear-gradient(135deg, #e5c477, #a77c31);
      color: #15100a;
      border: none;
      border-radius: 30px;
      padding: 13px 28px;
      font-size: 16px;
      font-weight: 900;
      cursor: pointer;
      width: 100%;
      max-width: 280px;
    }

    .loyalty-spin-button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    .loyalty-spin-result {
      color: #e8cd8d;
      font-size: 16px;
      font-weight: 900;
      line-height: 1.8;
      margin-top: 15px;
    }

    .loyalty-history {
      margin-top: 20px;
      text-align: right;
      border-top: 1px solid rgba(201,164,92,.25);
      padding-top: 15px;
    }

    .loyalty-history h4 {
      color: #d9b967;
      margin-bottom: 10px;
    }

    .loyalty-history-item {
      padding: 9px;
      margin: 7px 0;
      background: rgba(255,255,255,.04);
      border-radius: 8px;
      color: #ddd;
      font-size: 13px;
    }

    @media(max-width:360px) {
      .loyalty-wheel-wrap {
        width: 230px;
        height: 230px;
      }

      .wheel-label {
        font-size: 10px;
        width: 78px;
      }

      .loyalty-dot {
        width: 36px;
        height: 36px;
      }
    }
  `;

  document.head.appendChild(style);
}

// ========================================
// LOYALTY CARD RENDER
// ========================================

function renderLoyaltyCard(phone, customer, spinMessage = "") {
  addLoyaltyStyles();

  const result = $("loyaltyResult");
  if (!result) return;

  const data = getCustomerLoyaltyData(customer);

  const history = Array.isArray(customer?.rewardHistory)
    ? [...customer.rewardHistory].reverse()
    : [];

  result.innerHTML = "";

  const card = document.createElement("div");
  card.className = "loyalty-card-new";

  const brand = document.createElement("div");
  brand.className = "loyalty-brand";
  brand.textContent = "FAHD KHALED SALON";

  const title = document.createElement("h3");
  title.className = "loyalty-card-title";
  title.textContent = "LOYALTY CARD";

  const stats = document.createElement("div");
  stats.className = "loyalty-stats";

  const visitsStat = document.createElement("div");
  visitsStat.className = "loyalty-stat";

  const visitsNumber = document.createElement("strong");
  visitsNumber.textContent = data.visits;

  const visitsLabel = document.createElement("span");
  visitsLabel.textContent = "إجمالي الزيارات";

  visitsStat.append(visitsNumber, visitsLabel);

  const spinsStat = document.createElement("div");
  spinsStat.className = "loyalty-stat";

  const spinsNumber = document.createElement("strong");
  spinsNumber.textContent = data.availableSpins;

  const spinsLabel = document.createElement("span");
  spinsLabel.textContent = "لفات مستحقة";

  spinsStat.append(spinsNumber, spinsLabel);

  stats.append(visitsStat, spinsStat);

  const dotsTitle = document.createElement("div");
  dotsTitle.className = "loyalty-dots-title";
  dotsTitle.textContent = "اجمع 10 زيارات واكسب لفة حظ";

  const dots = document.createElement("div");
  dots.className = "loyalty-dots";

  for (let i = 1; i <= 10; i++) {
    const dot = document.createElement("div");
    dot.className = "loyalty-dot";

    if (i <= data.progress) {
      dot.classList.add("active");
      dot.textContent = "✓";
    } else {
      dot.textContent = i;
    }

    dots.appendChild(dot);
  }

  const progressText = document.createElement("div");
  progressText.className = "loyalty-progress-text";
  progressText.textContent =
    `${data.progress} من 10 زيارات`;

  const status = document.createElement("div");
  status.className = "loyalty-reward-status";

  if (data.availableSpins > 0) {
    status.textContent =
      `مبروك! عندك ${data.availableSpins} لفة مستحقة. اضغط على العجلة للحصول على جائزتك.`;
  } else {
    const remaining = 10 - data.progress;

    status.textContent =
      remaining === 10
        ? "ابدأ زياراتك واجمع 10 زيارات لتحصل على لفة مجانية."
        : `متبقي ${remaining} زيارة للحصول على لفة الحظ القادمة.`;
  }

  const wheelArea = document.createElement("div");
  wheelArea.className = "loyalty-wheel-area";

  const wheelTitle = document.createElement("div");
  wheelTitle.className = "loyalty-wheel-title";
  wheelTitle.textContent = "عجلة الحظ";

  const wheelDesc = document.createElement("div");
  wheelDesc.className = "loyalty-wheel-desc";
  wheelDesc.textContent = "لف العجلة واكسب جائزتك المجانية";

  const wheelWrap = document.createElement("div");
  wheelWrap.className = "loyalty-wheel-wrap";

  const pointer = document.createElement("div");
  pointer.className = "loyalty-wheel-pointer";

  const wheel = document.createElement("div");
  wheel.className = "loyalty-wheel";
  wheel.id = "customerRewardWheel";

  const labels = [
    ["one", "قص شعر مجاناً"],
    ["two", "قص دقن مجاناً"],
    ["three", "جلسة بشرة كاملة"],
    ["four", "الباقة الكاملة"]
  ];

  labels.forEach(([className, text]) => {
    const label = document.createElement("div");
    label.className = `wheel-label ${className}`;
    label.textContent = text;
    wheel.appendChild(label);
  });

  wheelWrap.append(pointer, wheel);

  const spinButton = document.createElement("button");
  spinButton.type = "button";
  spinButton.className = "loyalty-spin-button";
  spinButton.id = "loyaltySpinButton";

  spinButton.textContent = data.availableSpins > 0
    ? "لف عجلة الحظ"
    : "اجمع 10 زيارات أولاً";

  spinButton.disabled = data.availableSpins <= 0;

  const spinResult = document.createElement("div");
  spinResult.className = "loyalty-spin-result";
  spinResult.id = "loyaltySpinResult";

  // الاحتفاظ برسالة الفوز بعد إعادة بناء الكارت
  spinResult.textContent = spinMessage;

  spinButton.addEventListener("click", () => {
    spinLoyaltyWheel(phone, spinButton, wheel, spinResult);
  });

  wheelArea.append(
    wheelTitle,
    wheelDesc,
    wheelWrap,
    spinButton,
    spinResult
  );

  const historyArea = document.createElement("div");
  historyArea.className = "loyalty-history";

  const historyTitle = document.createElement("h4");
  historyTitle.textContent = "سجل الجوائز";

  historyArea.appendChild(historyTitle);

  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "loyalty-history-item";
    empty.textContent = "لسه مفيش جوائز تم الحصول عليها.";
    historyArea.appendChild(empty);
  } else {
    history.slice(0, 20).forEach(item => {
      const entry = document.createElement("div");
      entry.className = "loyalty-history-item";

      const reward = document.createElement("div");
      reward.textContent = item.reward || "جائزة";

      const date = document.createElement("small");

      let dateText = "";

      if (item.createdAt?.toDate) {
        dateText = item.createdAt.toDate().toLocaleDateString("ar-EG");
      } else if (item.date) {
        dateText = item.date;
      }

      date.textContent = dateText
        ? `تاريخ الجائزة: ${dateText}`
        : "تاريخ الجائزة غير متاح";

      entry.append(reward, date);
      historyArea.appendChild(entry);
    });
  }

  card.append(
    brand,
    title,
    stats,
    dotsTitle,
    dots,
    progressText,
    status,
    wheelArea,
    historyArea
  );

  result.appendChild(card);
  result.hidden = false;
}

// ========================================
// SPIN LOYALTY WHEEL
// ========================================

async function spinLoyaltyWheel(
  phone,
  button,
  wheel,
  resultElement
) {
  if (loyaltySpinning) return;

  if (!validPhone(phone)) {
    showMessage("loyaltyMessage", "رقم الهاتف غير صحيح.", "#ff7777");
    return;
  }

  loyaltySpinning = true;
  button.disabled = true;
  button.textContent = "جاري تدوير العجلة...";

  resultElement.textContent = "";

  const rewardIndex = Math.floor(
    Math.random() * LOYALTY_REWARDS.length
  );

  const reward = LOYALTY_REWARDS[rewardIndex];

  try {
    const customerRef = doc(db, "customers", phone);

    let visitsAtWin = 0;

    await runTransaction(db, async transaction => {
      const customerSnapshot = await transaction.get(customerRef);

      if (!customerSnapshot.exists()) {
        throw new Error("بيانات العميل غير موجودة.");
      }

      const customer = customerSnapshot.data();

      const loyalty = getCustomerLoyaltyData(customer);

      if (loyalty.availableSpins <= 0) {
        throw new Error("ليس لديك لفات مستحقة حالياً.");
      }

      visitsAtWin = loyalty.visits;

      const oldHistory = Array.isArray(customer.rewardHistory)
        ? customer.rewardHistory
        : [];

      const newHistory = [
        ...oldHistory,
        {
          reward,
          rewardIndex,
          visitsAtWin,
          date: localDate(new Date()),
          createdAt: new Date().toISOString()
        }
      ];

      transaction.set(customerRef, {
        spinsUsed: loyalty.spinsUsed + 1,
        rewardHistory: newHistory,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    // حساب القطاع الفائز بالنسبة للمؤشر الثابت أعلى العجلة
    const sectorCenter = rewardIndex * 90 + 45;

    const targetRotation =
      360 * 6 + (360 - sectorCenter);

    wheel.style.transition = "none";
    wheel.style.transform = "rotate(0deg)";

    void wheel.offsetWidth;

    wheel.style.transition =
      "transform 5s cubic-bezier(.12,.75,.12,1)";

    wheel.style.transform =
      `rotate(${targetRotation}deg)`;

    await new Promise(resolve => setTimeout(resolve, 5200));

    const winMessage = `مبروك! جائزتك هي: ${reward}`;

    showMessage(
      "loyaltyMessage",
      "تم تسجيل جائزتك بنجاح.",
      "#75e49a"
    );

    // تحديث بيانات الكارت مع الاحتفاظ برسالة الفوز
    try {
      const updatedSnapshot = await getDoc(customerRef);

      if (updatedSnapshot.exists()) {
        renderLoyaltyCard(
          phone,
          updatedSnapshot.data(),
          winMessage
        );
      } else {
        resultElement.textContent = winMessage;
      }
    } catch (refreshError) {
      console.error("Loyalty refresh error:", refreshError);
      resultElement.textContent = winMessage;
    }

  } catch (error) {
    console.error(error);

    showMessage(
      "loyaltyMessage",
      "تعذر تدوير العجلة: " + error.message,
      "#ff7777"
    );

    try {
      const customerSnapshot = await getDoc(
        doc(db, "customers", phone)
      );

      if (customerSnapshot.exists()) {
        renderLoyaltyCard(phone, customerSnapshot.data());
      }
    } catch (refreshError) {
      console.error(refreshError);
    }

  } finally {
    loyaltySpinning = false;
  }
}

// ========================================
// CUSTOMER LOYALTY LOOKUP
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

  if (loyaltySpinning) return;

  button.disabled = true;
  button.textContent = "جاري البحث...";

  showMessage("loyaltyMessage", "");
  $("loyaltyResult").hidden = true;

  loyaltyCurrentPhone = phone;

  try {
    const customerRef = doc(db, "customers", phone);
    const customerSnapshot = await getDoc(customerRef);

    if (!customerSnapshot.exists()) {
      renderLoyaltyCard(phone, {
        phone,
        visits: 0,
        spinsUsed: 0,
        rewardHistory: []
      });

      showMessage(
        "loyaltyMessage",
        "لسه مفيش زيارات مسجلة بالرقم ده.",
        "#d9b967"
      );

    } else {
      renderLoyaltyCard(phone, customerSnapshot.data());

      showMessage(
        "loyaltyMessage",
        "تم الاستعلام بنجاح.",
        "#75e49a"
      );
    }

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
