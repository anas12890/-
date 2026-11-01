/* ==========================================================
   تحدي الاستقامة على الصلاة - منطق الصفحة
   ========================================================== */
(function () {
  "use strict";

  /* ---------- الثوابت والبيانات ---------- */
  const STORAGE_KEY = "istiqama-prayer-challenge:v1";

  const TASKS = [
    { id: "wake-friend",    icon: "📞", title: "اتصال على صديق لإيقاظه لصلاة الفجر",        desc: "مكالمة صغيرة قد تكون سببًا في أجر عظيم لك ولصديقك." },
    { id: "groups-message", icon: "💬", title: "نشر رسالة على المجموعات تتكلم عن الصلاة",      desc: "كلمة طيبة تصل إلى كثيرين وتذكّرهم بأعظم الأعمال." },
    { id: "whatsapp-status",icon: "📱", title: "نشر حالة على الواتساب عن فقه الصلاة وأهميتها", desc: "اجعل حالتك نافذة خير ينتفع بها من يراها." },
    { id: "neighbors",      icon: "🏘️", title: "دعوة أهل الحي للصلاة",                          desc: "كن سببًا في عمارة المسجد بدعوة جيرانك بلطف وابتسامة." },
    { id: "remind-family",  icon: "👨‍👩‍👧‍👦", title: "تذكير إخوتي وأسرتي وعائلتي وأصدقائي بالصلاة", desc: "تذكير رقيق من القلب يصنع فرقًا كبيرًا." },
    { id: "duha",           icon: "☀️", title: "صلاة الضحى",                                    desc: "ركعتان في الضحى تجزئان عن صدقة كل مفصل من جسدك." },
    { id: "between-adhan",  icon: "⏳", title: "الجلسة بين الأذان والإقامة",                    desc: "وقت يُرجى فيه قبول الدعاء، فاغتنمه بالذكر والدعاء." },
    { id: "rawatib",        icon: "🕌", title: "السنن الرواتب",                                  desc: "حافظ عليها فهي تجبر نقص الفرائض وترفع الدرجات." }
  ];
  const TOTAL = TASKS.length;
  const VALID_IDS = new Set(TASKS.map((t) => t.id));

  /* ---------- عناصر الصفحة ---------- */
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const nameInput = $("#participant-name");
  const dateInput = $("#challenge-date");
  const taskListEl = $("#task-list");
  const resultName = $("#result-name");
  const resultDate = $("#result-date");
  const resultMessage = $("#result-message");
  const scoreRing = $("#score-ring");
  const toastEl = $("#toast");
  const confettiEl = $("#confetti");
  const dialogEl = $("#confirm-dialog");

  /* ---------- الحالة ---------- */
  const state = {
    name: "",
    date: "",
    completed: new Set()
  };

  /* ---------- أدوات مساعدة ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function isValidISODate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }

  function formatDateArabic(iso) {
    if (!isValidISODate(iso)) return iso || "—";
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    try {
      return new Intl.DateTimeFormat("ar-u-nu-latn-ca-gregory", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      }).format(date);
    } catch (e) {
      return iso;
    }
  }

  function getMessage(score) {
    if (score >= 8) return "ما شاء الله! إنجاز مكتمل، نسأل الله لك الثبات والقبول.";
    if (score === 7) return "رائع، اقتربت من إتمام جميع المهام.";
    if (score >= 5) return "إنجاز جميل، زادك الله حرصًا وثباتًا.";
    if (score >= 3) return "أحسنت، واصل طريق المحافظة على الصلاة.";
    return "بداية الطريق، استعن بالله وابدأ بخطوة جديدة.";
  }

  /* ---------- التخزين المحلي (مع معالجة الأخطاء) ---------- */
  let memoryStore = null; // احتياطي إذا كان LocalStorage غير متاح

  function emptyStore() {
    return { version: 1, name: "", lastDate: "", days: {} };
  }

  function readStore() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return memoryStore || emptyStore();
    }
    if (!raw) return memoryStore || emptyStore();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || typeof parsed.days !== "object" || parsed.days === null) {
        return emptyStore();
      }
      return {
        version: 1,
        name: typeof parsed.name === "string" ? parsed.name : "",
        lastDate: typeof parsed.lastDate === "string" ? parsed.lastDate : "",
        days: parsed.days
      };
    } catch (e) {
      return emptyStore(); // بيانات تالفة: نبدأ من جديد دون أخطاء
    }
  }

  function writeStore(store) {
    memoryStore = store;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveState() {
    const store = readStore();
    store.name = state.name;
    store.lastDate = state.date;
    store.days[state.date] = { tasks: Array.from(state.completed), updatedAt: Date.now() };
    writeStore(store);
  }

  function loadDay(iso) {
    const store = readStore();
    const day = store.days[iso];
    const ids = day && Array.isArray(day.tasks) ? day.tasks : [];
    // نقبل المعرفات الصحيحة فقط، والمجموعة Set تمنع التكرار تلقائيًا
    state.completed = new Set(ids.filter((id) => VALID_IDS.has(id)));
  }

  /* ---------- بناء بطاقات المهام ---------- */
  function buildTaskCards() {
    const fragment = document.createDocumentFragment();
    TASKS.forEach((task) => {
      const li = document.createElement("li");

      const label = document.createElement("label");
      label.className = "task-card";
      label.htmlFor = "task-" + task.id;
      label.dataset.taskId = task.id;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "task-checkbox";
      input.id = "task-" + task.id;
      input.value = task.id;

      const check = document.createElement("span");
      check.className = "task-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";

      const icon = document.createElement("span");
      icon.className = "task-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = task.icon;

      const body = document.createElement("span");
      body.className = "task-body";
      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = task.title;
      const desc = document.createElement("span");
      desc.className = "task-desc";
      desc.textContent = task.desc;
      body.append(title, desc);

      const point = document.createElement("span");
      point.className = "task-point";
      point.textContent = "+1";
      point.setAttribute("aria-hidden", "true");

      label.append(input, check, icon, body, point);
      li.appendChild(label);
      fragment.appendChild(li);
    });
    taskListEl.replaceChildren(fragment);
  }

  /* ---------- رسم الواجهة ---------- */
  function setText(selector, value, animate) {
    $$(selector).forEach((el) => {
      if (el.textContent !== String(value)) {
        el.textContent = value;
        if (animate) {
          el.classList.remove("bump");
          void el.offsetWidth; // إعادة تشغيل الحركة
          el.classList.add("bump");
        }
      }
    });
  }

  function syncCards() {
    $$(".task-card").forEach((card) => {
      const done = state.completed.has(card.dataset.taskId);
      card.classList.toggle("is-done", done);
      const input = card.querySelector("input");
      if (input.checked !== done) input.checked = done;
    });
  }

  function render(animate) {
    const score = state.completed.size; // نقطة واحدة لكل مهمة مكتملة فقط
    const percent = Math.round((score / TOTAL) * 100);

    syncCards();

    setText("[data-score]", score, animate);
    setText("[data-total]", TOTAL, false);
    setText("[data-percent]", percent, false);
    setText("[data-completed]", score, false);
    setText("[data-remaining]", TOTAL - score, false);

    $$("[data-progress-fill]").forEach((el) => { el.style.width = percent + "%"; });
    $$("[data-progressbar]").forEach((el) => { el.setAttribute("aria-valuenow", String(percent)); });
    scoreRing.style.setProperty("--pct", percent);

    resultName.textContent = state.name.trim() || "لم يُدخل الاسم بعد";
    resultDate.textContent = formatDateArabic(state.date);
    resultMessage.textContent = getMessage(score);
  }

  /* ---------- الإشعارات ---------- */
  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2800);
  }

  /* ---------- الاحتفال عند إكمال المهام ---------- */
  function celebrate() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#2e8b5c", "#c9a24a", "#f3e7c4", "#1b7149", "#8fd1a9"];
    const pieces = 46;
    for (let i = 0; i < pieces; i++) {
      const piece = document.createElement("span");
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = 2 + Math.random() * 2 + "s";
      piece.style.animationDelay = Math.random() * 0.6 + "s";
      piece.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      confettiEl.appendChild(piece);
      setTimeout(() => piece.remove(), 5000);
    }
  }

  /* ---------- نافذة التأكيد ---------- */
  function confirmAction({ title, message, confirmText }) {
    return new Promise((resolve) => {
      if (!dialogEl || typeof dialogEl.showModal !== "function") {
        resolve(window.confirm(message));
        return;
      }
      $("#dialog-title").textContent = title;
      $("#dialog-message").textContent = message;
      $("#dialog-confirm").textContent = confirmText;

      const onClose = () => {
        dialogEl.removeEventListener("close", onClose);
        resolve(dialogEl.returnValue === "confirm");
      };
      dialogEl.returnValue = "cancel";
      dialogEl.addEventListener("close", onClose);
      dialogEl.showModal();
    });
  }

  /* ---------- نص المشاركة ---------- */
  function buildShareText() {
    const score = state.completed.size;
    const percent = Math.round((score / TOTAL) * 100);
    const name = state.name.trim() || "متسابق";
    const lines = [
      "🕌 تحدي الاستقامة على الصلاة",
      "👤 المتسابق: " + name,
      "📅 التاريخ: " + formatDateArabic(state.date),
      "⭐ النقاط: " + score + " / " + TOTAL,
      "📊 نسبة الإنجاز: " + percent + "%",
      "✅ المهام المكتملة: " + score + " | ⏳ غير المكتملة: " + (TOTAL - score),
      "",
      getMessage(score)
    ];
    return lines.join("\n");
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) { /* ننتقل إلى الطريقة البديلة */ }
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function shareResult() {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: "تحدي الاستقامة على الصلاة", text: text });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // ألغى المستخدم المشاركة
        /* أي خطأ آخر: ننسخ النتيجة بدلًا من ذلك */
      }
    }
    const copied = await copyToClipboard(text);
    showToast(copied ? "تم نسخ النتيجة، يمكنك لصقها ومشاركتها ✅" : "تعذر النسخ تلقائيًا، حدد النص يدويًا ثم انسخه");
    if (!copied) window.prompt("انسخ النتيجة من هنا:", text);
  }

  /* ---------- معالجات الأحداث ---------- */
  function onTaskChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("task-checkbox")) return;

    const wasFull = state.completed.size === TOTAL;
    if (input.checked) {
      state.completed.add(input.value); // Set: لا يمكن احتساب المهمة مرتين
    } else {
      state.completed.delete(input.value);
    }
    saveState();
    render(true);

    if (!wasFull && state.completed.size === TOTAL) {
      celebrate();
      showToast("ما شاء الله! أتممت جميع المهام 🎉");
    }
  }

  function onNameInput() {
    state.name = nameInput.value;
    saveState();
    render(false);
  }

  function onDateChange() {
    let value = dateInput.value;
    if (!isValidISODate(value)) {
      value = todayISO(); // تاريخ فارغ أو غير صالح: نعود إلى اليوم
      dateInput.value = value;
    }
    state.date = value;
    loadDay(value);
    saveState();
    render(false);
    showToast("تم تحميل سجل يوم " + formatDateArabic(value));
  }

  async function onReset() {
    const ok = await confirmAction({
      title: "إعادة تعيين التحدي",
      message: "سيتم إلغاء تحديد جميع المهام والبدء من جديد لهذا اليوم. هل أنت متأكد؟",
      confirmText: "نعم، أعد التعيين"
    });
    if (!ok) return;
    state.completed.clear();
    saveState();
    render(false);
    showToast("تمت إعادة تعيين التحدي");
  }

  async function onClearDay() {
    const ok = await confirmAction({
      title: "مسح بيانات اليوم",
      message: "سيتم حذف سجل هذا اليوم المحفوظ فقط، ولن تتأثر الأيام الأخرى. هل أنت متأكد؟",
      confirmText: "نعم، امسح اليوم"
    });
    if (!ok) return;
    const store = readStore();
    delete store.days[state.date];
    store.name = state.name;
    store.lastDate = state.date;
    writeStore(store);
    state.completed.clear();
    render(false);
    showToast("تم مسح بيانات هذا اليوم");
  }

  function onPrint() {
    render(false);
    window.print();
  }

  /* ---------- التهيئة ---------- */
  function init() {
    buildTaskCards();

    const store = readStore();
    state.name = store.name || "";
    // نفتح دائمًا على تاريخ اليوم الحالي، ويبقى تغييره يدويًا متاحًا
    state.date = todayISO();
    loadDay(state.date);

    nameInput.value = state.name;
    dateInput.value = state.date;

    taskListEl.addEventListener("change", onTaskChange);
    nameInput.addEventListener("input", onNameInput);
    dateInput.addEventListener("change", onDateChange);
    $("#btn-reset").addEventListener("click", onReset);
    $("#btn-clear-day").addEventListener("click", onClearDay);
    $("#btn-print").addEventListener("click", onPrint);
    $("#btn-share").addEventListener("click", shareResult);

    render(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
