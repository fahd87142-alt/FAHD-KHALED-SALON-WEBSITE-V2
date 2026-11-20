// =====================================
// FAHD KHALED SALON
// Firebase + Booking + Tracking + Loyalty + Admin
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
  setDoc,
  runTransaction,
  deleteDoc,
  writeBatch
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

const ADMIN_UID = "n11bT3BtMaXwCWv2iYjW1sQ61Hv2";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// =====================================
// GENERAL HELPERS
// =====================================

const $ = (id) => document.getElementById(id);

function showMessage(element, message, success = false) {
  if (!element) return;

  element.textContent = message;
  element.style.color = success ? "#d6b45a" : "#ff7777";
}

function normalizePhone(phone) {
  let value = String(phone || "").replace(/\D/g, "");

  if (value.startsWith("0020")) {
    value = value.slice(2);
  }

  if (value.startsWith("20") && value.length === 12) {
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

async function hashText(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getCustomerId(phone) {
  return hashText(normalizePhone(phone));
}

async function getLegacyCustomerId(name, phone) {
  return hashText(
    normalizeName(name) + "|" + normalizePhone(phone)
  );
}

function createTrackingCode() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function statusText(status) {
  const statuses = {
    new: "طلبك قيد المراجعة",
    confirmed: "تم تأكيد الحجز",
    rejected: "تم رفض الحجز",
    completed: "تم تنفيذ الخدمة"
  };

  return statuses[status] || "حالة غير معروفة";
}

// Set minimum booking date to today
const dateInput = document.querySelector('input[name="date"]');

if (dateInput) {
  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  );

  dateInput.min = localDate.toISOString().split("T")[0];
}

// Mobile navigation
const menuButton = $("menuToggle");
const navMenu = $("navMenu");

if (menuButton && navMenu) {
  menuButton.addEventListener("click", () => {
    navMenu.classList.toggle("active");
  });

  navMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("active");
    });
  });
}

// Footer year
if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

// =====================================
// BOOKING SUBMISSION
// =====================================

const bookingForm = $("bookingForm");

if (bookingForm) {
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = $("submitBooking");
    const message = $("formMessage");

    if (submitButton) submitButton.disabled = true;

    showMessage(message, "جاري إرسال طلب الحجز...");

    try {
      const formData = new FormData(bookingForm);

      const name = String(formData.get("name") || "").trim();
      const phone = normalizePhone(formData.get("phone"));
      const service = String(formData.get("service") || "").trim();
      const date = String(formData.get("date") || "").trim();
      const time = String(formData.get("time") || "").trim();
      const notes = String(formData.get("notes") || "").trim();

      if (!name || phone.length < 7 || !service || !date || !time) {
        throw new Error("من فضلك راجع البيانات المطلوبة.");
      }

      const trackingCode = createTrackingCode();

      const booking = {
        name,
        phone,
        service,
        date,
        time,
        notes,
        status: "new",
        trackingCode,
        createdAt: serverTimestamp()
      };

      const batch = writeBatch(db);

      const bookingRef = doc(collection(db, "bookings"));
      const statusRef = doc(db, "bookingStatus", trackingCode);

      batch.set(bookingRef, booking);

      batch.set(statusRef, {
        status: "new",
        service,
        date,
        time
      });

      await batch.commit();

      bookingForm.reset();

      showMessage(
        message,
        "تم استلام طلبك بنجاح. الحجز غير مؤكد إلا بعد تواصل الصالون معك.",
        true
      );

      showTrackingCode(trackingCode);

    } catch (error) {
      console.error("Booking error:", error);

      showMessage(
        message,
        "حصلت مشكلة أثناء إرسال الحجز. راجع البيانات وحاول مرة تانية."
      );

    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// Show tracking code after booking
function showTrackingCode(code) {
  let box = $("trackingCodeBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "trackingCodeBox";

    box.style.cssText = `
      margin-top:18px;
      padding:18px;
      border:1px solid #c9a64b;
      border-radius:12px;
      text-align:center;
      background:#171717;
      color:#fff;
    `;

    const formMessage = $("formMessage");

    if (formMessage) {
      formMessage.insertAdjacentElement("afterend", box);
    } else if (bookingForm) {
      bookingForm.appendChild(box);
    }
  }

  box.innerHTML = `
    <h3 style="color:#d6b45a">كود متابعة الحجز</h3>
    <p>احتفظ بالكود ده عشان تتابع حالة حجزك:</p>
    <strong id="trackingCodeValue"
      style="display:block;font-size:20px;letter-spacing:2px;direction:ltr">
      ${code}
    </strong>
    <button type="button" id="copyTrackingCode"
      style="margin-top:12px;padding:10px 20px;cursor:pointer">
      نسخ الكود
    </button>
  `;

  $("copyTrackingCode").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      $("copyTrackingCode").textContent = "تم نسخ الكود";
    } catch {
      $("copyTrackingCode").textContent = "انسخ الكود يدويًا";
    }
  });
}

// =====================================
// BOOKING STATUS LOOKUP
// =====================================

const bookingStatusForm = $("bookingStatusForm");

if (bookingStatusForm) {
  bookingStatusForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = $("trackingCodeInput");
    const result = $("bookingStatusResult");

    const code = String(input?.value || "").trim().toLowerCase();

    if (!code) {
      showMessage(result, "اكتب كود متابعة الحجز.");
      return;
    }

    showMessage(result, "جاري البحث عن الحجز...");

    try {
      const statusRef = doc(db, "bookingStatus", code);
      const statusSnap = await getDoc(statusRef);

      if (!statusSnap.exists()) {
        showMessage(
          result,
          "الكود غير صحيح أو الحجز غير موجود. راجع الكود وحاول تاني."
        );
        return;
      }

      const data = statusSnap.data();

      result.innerHTML = `
        <div style="padding:15px;border:1px solid #c9a64b;border-radius:10px">
          <h3 style="color:#d6b45a">حالة الحجز</h3>
          <p><strong>الحالة:</strong> ${statusText(data.status)}</p>
          <p><strong>الخدمة:</strong> ${data.service || "-"}</p>
          <p><strong>التاريخ:</strong> ${data.date || "-"}</p>
          <p><strong>الوقت:</strong> ${data.time || "-"}</p>
        </div>
      `;

    } catch (error) {
      console.error("Status lookup error:", error);

      showMessage(
        result,
        "تعذر متابعة الحجز حاليًا. حاول مرة تانية."
      );
    }
  });
}
// =====================================
// CUSTOMER LOYALTY LOOKUP
// =====================================

const loyaltyForm = $("loyaltyForm");

if (loyaltyForm) {
  loyaltyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const phone = normalizePhone($("loyaltyPhone")?.value);
    const message = $("loyaltyMessage");

    if (phone.length < 7) {
      showMessage(message, "اكتب رقم موبايل صحيح.");
      return;
    }

    showMessage(message, "جاري البحث عن الزيارات...");

    try {
      const customerId = await getCustomerId(phone);
      const customerRef = doc(db, "customers", customerId);
      const customerSnap = await getDoc(customerRef);

      if (!customerSnap.exists()) {
        if ($("loyaltyResult")) {
          $("loyaltyResult").style.display = "none";
        }

        showMessage(message, "لسه مفيش زيارات مسجلة بالرقم ده.");
        return;
      }

      const customer = customerSnap.data();
      const visits = Number(customer.visits || 0);
      const rewards = Number(customer.rewards || 0);
      const rewardsUsed = Number(customer.rewardsUsed || 0);
      const availableRewards = Math.max(0, rewards - rewardsUsed);

      if ($("loyaltyVisits")) {
        $("loyaltyVisits").textContent = visits;
      }

      if ($("loyaltyRewards")) {
        $("loyaltyRewards").textContent = availableRewards;
      }

      if ($("loyaltyNextReward")) {
        const remaining = visits % 5 === 0 ? 5 : 5 - (visits % 5);

        $("loyaltyNextReward").textContent =
          remaining === 0
            ? "مبروك! عندك مكافأة مستحقة."
            : `فاضلك ${remaining} زيارات على المكافأة القادمة.`;
      }

      if ($("loyaltyResult")) {
        $("loyaltyResult").style.display = "block";
      }

      showMessage(message, "تم العثور على حسابك بنجاح.", true);

    } catch (error) {
      console.error("Loyalty lookup error:", error);
      showMessage(message, "حصلت مشكلة أثناء البحث. حاول تاني.");
    }
  });
}

// =====================================
// ADMIN LOGIN
// =====================================

const adminLoginForm = $("adminLoginForm");

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("adminEmail")?.value.trim();
    const password = $("adminPassword")?.value;
    const message = $("adminLoginMessage");

    showMessage(message, "جاري تسجيل الدخول...");

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (credential.user.uid !== ADMIN_UID) {
        await signOut(auth);
        showMessage(message, "الحساب ده مش حساب الإدارة.");
        return;
      }

      showMessage(message, "تم تسجيل الدخول بنجاح.", true);

    } catch (error) {
      console.error("Admin login error:", error);
      showMessage(message, "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    }
  });
}

// =====================================
// ADMIN DASHBOARD ELEMENTS
// =====================================

function setAdminVisible(isVisible) {
  if ($("adminDashboard")) {
    $("adminDashboard").style.display = isVisible ? "block" : "none";
  }

  if ($("adminLoginForm")) {
    $("adminLoginForm").style.display = isVisible ? "none" : "block";
  }
}

const adminLogout = $("adminLogout");

if (adminLogout) {
  adminLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  });
}

// =====================================
// LOYALTY RECORDS AND MIGRATION
// =====================================

async function syncCustomerRecords(snapshot) {
  const completedBookings = snapshot.docs.filter(
    bookingDoc => bookingDoc.data().status === "completed"
  );

  for (const bookingDoc of completedBookings) {
    const booking = bookingDoc.data();

    if (!booking.phone) continue;

    try {
      const phone = normalizePhone(booking.phone);
      const customerId = await getCustomerId(phone);
      const customerRef = doc(db, "customers", customerId);

      await runTransaction(db, async (transaction) => {
        const customerSnap = await transaction.get(customerRef);

        let customerData = customerSnap.exists()
          ? customerSnap.data()
          : {};

        let completedIds = Array.isArray(customerData.completedBookingIds)
          ? [...customerData.completedBookingIds]
          : [];

        if (completedIds.includes(bookingDoc.id)) {
          return;
        }

        const legacyId = booking.name
          ? await getLegacyCustomerId(booking.name, phone)
          : null;

        if (!customerSnap.exists() && legacyId) {
          const legacyRef = doc(db, "customers", legacyId);
          const legacySnap = await transaction.get(legacyRef);

          if (legacySnap.exists()) {
            const legacyData = legacySnap.data();

            customerData = {
              ...legacyData,
              visits: Number(legacyData.visits || 0),
              rewards: Number(legacyData.rewards || 0),
              rewardsUsed: Number(legacyData.rewardsUsed || 0),
              completedBookingIds: Array.isArray(
                legacyData.completedBookingIds
              )
                ? [...legacyData.completedBookingIds]
                : []
            };

            transaction.set(customerRef, customerData);
            transaction.delete(legacyRef);
          }
        }

        completedIds = Array.isArray(customerData.completedBookingIds)
          ? [...customerData.completedBookingIds]
          : [];

        if (completedIds.includes(bookingDoc.id)) {
          return;
        }

        const oldVisits = Number(customerData.visits || 0);
        const oldRewards = Number(customerData.rewards || 0);
        const newVisits = oldVisits + 1;

        const newRewards = Math.floor(newVisits / 5);

        completedIds.push(bookingDoc.id);

        transaction.set(customerRef, {
          visits: newVisits,
          rewards: Math.max(oldRewards, newRewards),
          rewardsUsed: Number(customerData.rewardsUsed || 0),
          completedBookingIds: completedIds,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

    } catch (error) {
      console.error(
        "Customer loyalty sync error:",
        bookingDoc.id,
        error
      );
    }
  }
}

// =====================================
// ADMIN CUSTOMERS DISPLAY
// =====================================

async function renderAdminCustomers() {
  const container = $("adminCustomersList");
  if (!container) return;

  container.innerHTML = "<p>جاري تحميل بيانات العملاء...</p>";

  try {
    const customerQuery = query(collection(db, "customers"));

    const snapshot = await new Promise((resolve, reject) => {
      const unsubscribe = onSnapshot(
        customerQuery,
        result => {
          unsubscribe();
          resolve(result);
        },
        error => {
          unsubscribe();
          reject(error);
        }
      );
    });

    if (snapshot.empty) {
      container.innerHTML = "<p>لا يوجد عملاء مسجلون حتى الآن.</p>";
      return;
    }

    container.innerHTML = "";

    snapshot.forEach(customerDoc => {
      const customer = customerDoc.data();

      const visits = Number(customer.visits || 0);
      const rewards = Number(customer.rewards || 0);
      const rewardsUsed = Number(customer.rewardsUsed || 0);
      const available = Math.max(0, rewards - rewardsUsed);

      const card = document.createElement("div");

      card.style.cssText = `
        padding:15px;
        margin:12px 0;
        border:1px solid #c9a64b;
        border-radius:10px;
        background:#171717;
        color:white;
      `;

      const title = document.createElement("h4");
      title.textContent = `عميل ${customerDoc.id.slice(0, 8)}`;

      const details = document.createElement("p");
      details.textContent =
        `الزيارات: ${visits} | المكافآت: ${available}`;

      const redeemButton = document.createElement("button");
      redeemButton.type = "button";
      redeemButton.textContent = "استخدام مكافأة VIP";

      redeemButton.disabled = available <= 0;

      redeemButton.addEventListener("click", async () => {
        if (!confirm("تأكيد استخدام مكافأة تنظيف البشرة VIP بخصم 50%؟")) {
          return;
        }

        redeemButton.disabled = true;

        try {
          await runTransaction(db, async transaction => {
            const freshSnap = await transaction.get(customerDoc.ref);

            if (!freshSnap.exists()) {
              throw new Error("العميل غير موجود.");
            }

            const fresh = freshSnap.data();
            const currentRewards = Number(fresh.rewards || 0);
            const currentUsed = Number(fresh.rewardsUsed || 0);

            if (currentUsed >= currentRewards) {
              throw new Error("لا توجد مكافآت متاحة.");
            }

            transaction.update(customerDoc.ref, {
              rewardsUsed: currentUsed + 1,
              updatedAt: serverTimestamp()
            });
          });

          alert("تم استخدام المكافأة بنجاح.");

          renderAdminCustomers();

        } catch (error) {
          console.error("Redeem reward error:", error);
          alert(error.message || "حصلت مشكلة أثناء استخدام المكافأة.");
          redeemButton.disabled = false;
        }
      });

      card.appendChild(title);
      card.appendChild(details);
      card.appendChild(redeemButton);

      container.appendChild(card);
    });

  } catch (error) {
    console.error("Admin customers error:", error);
    container.innerHTML = "<p>تعذر تحميل بيانات العملاء.</p>";
  }
          }
