/* global crypto */
(function () {
  const USERS_KEY = "ep_users_v1";
  const SESSION_KEY = "ep_session_v1";
  const ADMIN_PIN_HASH_KEY = "ep_admin_pin_hash_v1";
  const ADMIN_SESSION_KEY = "ep_admin_session_v1";
  const STAFF_PIN_HASH_KEY = "ep_staff_pin_hash_v1";
  const STAFF_SESSION_KEY = "ep_staff_session_v1";

  function nowIso() {
    return new Date().toISOString();
  }

  function uid() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return toHex(digest);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read the photo file."));
        reader.readAsDataURL(file);
      } catch {
        reject(new Error("Could not read the photo file."));
      }
    });
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getUsers() {
    return readJson(USERS_KEY, []);
  }

  function saveUsers(users) {
    writeJson(USERS_KEY, users);
  }

  function getSession() {
    return readJson(SESSION_KEY, null);
  }

  function setSession(userId) {
    writeJson(SESSION_KEY, { userId, createdAt: nowIso() });
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getAdminSession() {
    return readJson(ADMIN_SESSION_KEY, null);
  }

  function setAdminSession() {
    writeJson(ADMIN_SESSION_KEY, { ok: true, createdAt: nowIso() });
  }

  function clearAdminSession() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }

  function getAdminPinHash() {
    return readJson(ADMIN_PIN_HASH_KEY, null);
  }

  function setAdminPinHash(hash) {
    writeJson(ADMIN_PIN_HASH_KEY, { hash, createdAt: nowIso() });
  }

  function getStaffSession() {
    return readJson(STAFF_SESSION_KEY, null);
  }

  function setStaffSession() {
    writeJson(STAFF_SESSION_KEY, { ok: true, createdAt: nowIso() });
  }

  function clearStaffSession() {
    localStorage.removeItem(STAFF_SESSION_KEY);
  }

  function getStaffPinHash() {
    return readJson(STAFF_PIN_HASH_KEY, null);
  }

  function setStaffPinHash(hash) {
    writeJson(STAFF_PIN_HASH_KEY, { hash, createdAt: nowIso() });
  }

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
  }

  function normalizeStudentId(v) {
    return String(v || "").trim().toUpperCase();
  }

  function findUserById(users, userId) {
    return users.find((u) => u.id === userId) || null;
  }

  function findUserByLogin(users, loginId) {
    const raw = String(loginId || "").trim();
    if (!raw) return null;
    const asEmail = normalizeEmail(raw);
    const asSid = normalizeStudentId(raw);
    return users.find((u) => normalizeEmail(u.email) === asEmail || normalizeStudentId(u.studentId) === asSid) || null;
  }

  function require(value, message) {
    if (!value) throw new Error(message);
  }

  function validateRegistration(payload, users) {
    const fullName = String(payload.fullName || "").trim();
    const studentId = normalizeStudentId(payload.studentId);
    const email = normalizeEmail(payload.email);
    const phone = String(payload.phone || "").trim();
    const dob = String(payload.dob || "").trim(); // YYYY-MM-DD
    const password = String(payload.password || "");
    const confirmPassword = String(payload.confirmPassword || "");

    require(fullName.length >= 2, "Full name is required.");
    require(studentId.length >= 3, "Student ID is required.");
    require(email.includes("@") && email.includes("."), "Enter a valid email.");
    require(phone.length >= 6, "Phone number is required.");
    require(dob.length >= 8, "Date of birth is required.");
    // Basic sanity check: DOB cannot be in the future.
    require(!Number.isNaN(Date.parse(dob)), "Enter a valid date of birth.");
    require(new Date(dob + "T00:00:00").getTime() <= Date.now(), "Date of birth cannot be in the future.");
    require(password.length >= 8, "Password must be at least 8 characters.");
    require(password === confirmPassword, "Passwords do not match.");

    const sidTaken = users.some((u) => normalizeStudentId(u.studentId) === studentId);
    require(!sidTaken, "That Student ID is already registered.");
    const emailTaken = users.some((u) => normalizeEmail(u.email) === email);
    require(!emailTaken, "That email is already registered.");

    return { fullName, studentId, email, phone, dob, password };
  }

  function availableExams() {
    return [
      { id: "EXM-MTH-101", name: "Mathematics 101", date: "2026-04-10", center: "Main Campus Hall A" },
      { id: "EXM-PHY-101", name: "Physics 101", date: "2026-04-12", center: "Main Campus Hall B" },
      { id: "EXM-CS-102", name: "Computer Science 102", date: "2026-04-15", center: "Lab Block 2" },
      { id: "EXM-ENG-101", name: "English 101", date: "2026-04-18", center: "Arts Block Room 14" }
    ];
  }

  function ensureUserData(user) {
    const next = { ...user };
    if (!Array.isArray(next.examRegistrations)) next.examRegistrations = [];
    if (!next.examResults || typeof next.examResults !== "object") next.examResults = {};
    return next;
  }

  function upsertUser(users, updated) {
    const i = users.findIndex((u) => u.id === updated.id);
    if (i === -1) return [...users, updated];
    const next = users.slice();
    next[i] = updated;
    return next;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function showAlert(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
  }

  function hideAlert(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
  }

  function fmtDate(isoDate) {
    try {
      const d = new Date(isoDate + "T00:00:00");
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return isoDate;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }

  function pill(status) {
    const s = String(status || "").toLowerCase();
    if (s === "registered") return `<span class="pill ok">Registered</span>`;
    if (s === "pending") return `<span class="pill warn">Pending</span>`;
    if (s === "published") return `<span class="pill ok">Published</span>`;
    if (s === "failed") return `<span class="pill bad">Failed</span>`;
    return `<span class="pill">${escapeHtml(status || "—")}</span>`;
  }

  function renderDatabasePage() {
    const users = getUsers().map(ensureUserData);
    const exams = availableExams();

    const totalRegs = users.reduce((n, u) => n + (u.examRegistrations?.length || 0), 0);
    const totalResults = users.reduce((n, u) => n + Object.keys(u.examResults || {}).length, 0);

    const usersRows = users
      .slice()
      .sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)))
      .map((u) => {
        const regCount = u.examRegistrations.length;
        const resCount = Object.keys(u.examResults).length;
        return `
          <tr>
            <td style="font-weight:900">${escapeHtml(u.fullName)}</td>
            <td>${escapeHtml(u.studentId)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.phone)}</td>
            <td class="muted">${escapeHtml(new Date(u.createdAt).toLocaleString())}</td>
            <td>${escapeHtml(String(regCount))}</td>
            <td>${escapeHtml(String(resCount))}</td>
          </tr>
        `;
      })
      .join("");

    const regRows = users
      .flatMap((u) =>
        u.examRegistrations.map((r) => {
          const ex = exams.find((e) => e.id === r.examId);
          return {
            studentId: u.studentId,
            fullName: u.fullName,
            examId: r.examId,
            examName: ex ? ex.name : r.examName,
            registeredAt: r.registeredAt,
            status: r.status || "Registered"
          };
        })
      )
      .sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt)))
      .map((r) => {
        return `
          <tr>
            <td>${escapeHtml(r.studentId)}</td>
            <td>${escapeHtml(r.fullName)}</td>
            <td>${escapeHtml(r.examId)}</td>
            <td>${escapeHtml(r.examName || r.examId)}</td>
            <td class="muted">${escapeHtml(new Date(r.registeredAt).toLocaleString())}</td>
            <td>${pill(r.status)}</td>
          </tr>
        `;
      })
      .join("");

    const resultsRows = users
      .flatMap((u) =>
        Object.values(u.examResults || {}).map((res) => ({
          studentId: u.studentId,
          fullName: u.fullName,
          examId: res.examId,
          examName: res.examName,
          score: res.score,
          grade: res.grade,
          publishedAt: res.publishedAt
        }))
      )
      .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
      .map((r) => {
        return `
          <tr>
            <td>${escapeHtml(r.studentId)}</td>
            <td>${escapeHtml(r.fullName)}</td>
            <td>${escapeHtml(r.examId)}</td>
            <td>${escapeHtml(r.examName || r.examId)}</td>
            <td style="font-weight:900">${escapeHtml(String(r.score ?? "—"))}</td>
            <td>${escapeHtml(String(r.grade ?? "—"))}</td>
            <td class="muted">${r.publishedAt ? escapeHtml(new Date(r.publishedAt).toLocaleString()) : "—"}</td>
          </tr>
        `;
      })
      .join("");

    setHtml(
      "dbActions",
      `
        <span class="pill warn">${escapeHtml(String(users.length))} students</span>
        <span class="pill warn">${escapeHtml(String(totalRegs))} registrations</span>
        <span class="pill warn">${escapeHtml(String(totalResults))} results</span>
        <button id="exportJsonBtn" class="btn btn-small btn-primary" type="button">Export JSON</button>
        <button id="exportCsvBtn" class="btn btn-small" type="button">Export CSV</button>
        <button id="adminLogoutBtn" class="btn btn-small btn-ghost" type="button">Principal Logout</button>
        <button id="clearDbBtn" class="btn btn-small" type="button">Clear Database</button>
      `
    );

    setHtml(
      "dbBody",
      `
        <div class="stack">
          <div class="alert" style="background:rgba(0,0,0,.18)">
            This page reads the portal “database” from LocalStorage (browser-only). It is for demo/teacher checking, not real security.
          </div>

          <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
            <div style="font-weight:900; letter-spacing:.2px">Students</div>
            <div class="hint">All registered student accounts.</div>
            <div class="hr"></div>
            <table class="table" aria-label="Students table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Student ID</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Created</th>
                  <th>Regs</th>
                  <th>Results</th>
                </tr>
              </thead>
              <tbody>${usersRows || `<tr><td colspan="7">No students registered yet.</td></tr>`}</tbody>
            </table>
          </div>

          <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
            <div style="font-weight:900; letter-spacing:.2px">Exam Registrations</div>
            <div class="hint">Every exam registration by every student.</div>
            <div class="hr"></div>
            <table class="table" aria-label="Registrations table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Exam ID</th>
                  <th>Exam</th>
                  <th>Registered At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${regRows || `<tr><td colspan="6">No registrations yet.</td></tr>`}</tbody>
            </table>
          </div>

          <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
            <div style="font-weight:900; letter-spacing:.2px">Exam Results</div>
            <div class="hint">Results are available after staff publishes them.</div>
            <div class="hr"></div>
            <table class="table" aria-label="Results table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Exam ID</th>
                  <th>Exam</th>
                  <th>Score</th>
                  <th>Grade</th>
                  <th>Published At</th>
                </tr>
              </thead>
              <tbody>${resultsRows || `<tr><td colspan="7">No results published yet.</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      `
    );

    const exportJsonBtn = document.getElementById("exportJsonBtn");
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener("click", () => {
        const snapshot = {
          exportedAt: nowIso(),
          keys: { users: USERS_KEY, session: SESSION_KEY },
          users: getUsers()
        };
        downloadText("exam-portal-database.json", JSON.stringify(snapshot, null, 2), "application/json");
      });
    }

    const exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", () => {
        const usersNow = getUsers().map(ensureUserData);
        const studentLines = [
          ["fullName", "studentId", "email", "phone", "createdAt", "registrationsCount", "resultsCount"].join(",")
        ];
        usersNow.forEach((u) => {
          studentLines.push(
            [
              csvEscape(u.fullName),
              csvEscape(u.studentId),
              csvEscape(u.email),
              csvEscape(u.phone),
              csvEscape(u.createdAt),
              csvEscape(u.examRegistrations.length),
              csvEscape(Object.keys(u.examResults).length)
            ].join(",")
          );
        });

        const regLines = [["studentId", "examId", "registeredAt", "status"].join(",")];
        usersNow.forEach((u) => {
          u.examRegistrations.forEach((r) => {
            regLines.push([csvEscape(u.studentId), csvEscape(r.examId), csvEscape(r.registeredAt), csvEscape(r.status)].join(","));
          });
        });

        const text =
          "# Students\n" +
          studentLines.join("\n") +
          "\n\n# Registrations\n" +
          regLines.join("\n") +
          "\n";
        downloadText("exam-portal-database.csv", text, "text/csv");
      });
    }

    const clearDbBtn = document.getElementById("clearDbBtn");
    if (clearDbBtn) {
      clearDbBtn.addEventListener("click", () => {
        const ok = confirm("Clear ALL portal data (students + sessions)? This cannot be undone.");
        if (!ok) return;
        localStorage.removeItem(USERS_KEY);
        localStorage.removeItem(SESSION_KEY);
        clearAdminSession();
        renderDatabaseLogin();
      });
    }

    const adminLogoutBtn = document.getElementById("adminLogoutBtn");
    if (adminLogoutBtn) {
      adminLogoutBtn.addEventListener("click", () => {
        clearAdminSession();
        renderDatabaseLogin();
      });
    }
  }

  function renderDatabaseLogin() {
    setHtml("dbActions", "");
    const pinMeta = getAdminPinHash();
    const hasPin = Boolean(pinMeta && pinMeta.hash);

    setHtml(
      "dbBody",
      `
        <div class="stack">
          <div class="alert alert-danger">
            This is not secure. It only hides the page behind a local principal PIN in your browser.
          </div>
          <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
            <div style="font-weight:900; letter-spacing:.2px">${hasPin ? "Principal Login" : "Set Principal PIN"}</div>
            <div class="hint">${hasPin ? "Enter your principal PIN to view the database." : "Create a principal PIN for this browser (min 4 characters)."}</div>
            <div class="hr"></div>
            <form id="dbPinForm" class="form" novalidate>
              <div class="grid-2">
                <div class="field">
                  <label for="dbPin">${hasPin ? "PIN" : "New PIN"}</label>
                  <input id="dbPin" name="dbPin" type="password" required placeholder="${hasPin ? "Enter PIN" : "Create PIN"}" />
                </div>
                ${
                  hasPin
                    ? `<div class="field">
                        <label>&nbsp;</label>
                        <button class="btn btn-primary" type="submit">Unlock</button>
                      </div>`
                    : `<div class="field">
                        <label for="dbPin2">Confirm PIN</label>
                        <input id="dbPin2" name="dbPin2" type="password" required placeholder="Confirm PIN" />
                      </div>`
                }
              </div>
              ${hasPin ? "" : `<button class="btn btn-primary" type="submit">Save PIN</button>`}
              <div id="dbPinError" class="alert alert-danger" role="alert" hidden></div>
              <div class="hint">Tip: if you forget the PIN, clear site data in your browser to reset.</div>
            </form>
          </div>
        </div>
      `
    );

    const form = document.getElementById("dbPinForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert("dbPinError");

      const pin = String(form.dbPin.value || "");
      try {
        require(pin.length >= 4, "PIN must be at least 4 characters.");
        const pinHash = await hashPassword(pin);

        const current = getAdminPinHash();
        if (!current || !current.hash) {
          const pin2 = String(form.dbPin2.value || "");
          require(pin === pin2, "PINs do not match.");
          setAdminPinHash(pinHash);
          setAdminSession();
          renderDatabasePage();
          return;
        }

        require(current.hash === pinHash, "Invalid PIN.");
        setAdminSession();
        renderDatabasePage();
      } catch (err) {
        showAlert("dbPinError", err instanceof Error ? err.message : "Could not unlock database.");
      }
    });
  }

  function bindDatabasePage() {
    // If the page HTML isn't present, no-op.
    if (!document.getElementById("dbBody")) return;
    if (!document.getElementById("dbActions")) return;

    const adminSession = getAdminSession();
    if (adminSession && adminSession.ok) renderDatabasePage();
    else renderDatabaseLogin();
  }

  function guardPublicPage() {
    const session = getSession();
    if (session && session.userId) window.location.replace("dashboard.html");
  }

  function guardPrivatePage() {
    const session = getSession();
    if (!session || !session.userId) window.location.replace("login.html");
  }

  function guardStaffPrivatePage() {
    const session = getStaffSession();
    if (!session || !session.ok) window.location.replace("staff-login.html");
  }

  function bindStaffLoginPage() {
    const form = document.getElementById("staffLoginForm");
    if (!form) return;

    const pinMeta = getStaffPinHash();
    const hasPin = Boolean(pinMeta && pinMeta.hash);

    const wrap = document.getElementById("staffPin2Wrap");
    const modeTitle = document.getElementById("staffModeTitle");
    const pinLabel = document.getElementById("staffPinLabel");
    const pinHint = document.getElementById("staffPinHint");
    const btn = document.getElementById("staffLoginBtn");

    if (!hasPin) {
      if (modeTitle) modeTitle.textContent = "Set Staff PIN";
      if (pinLabel) pinLabel.textContent = "New PIN";
      if (pinHint) pinHint.textContent = "Create a staff PIN for this browser (min 4 characters).";
      if (btn) btn.textContent = "Save PIN";
      if (wrap) wrap.hidden = false;
    } else {
      if (modeTitle) modeTitle.textContent = "Staff Login";
      if (pinLabel) pinLabel.textContent = "PIN";
      if (pinHint) pinHint.textContent = "Enter your staff PIN.";
      if (btn) btn.textContent = "Unlock";
      if (wrap) wrap.hidden = true;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert("staffLoginError");

      const pin = String(form.staffPin.value || "");
      try {
        require(pin.length >= 4, "PIN must be at least 4 characters.");
        const pinHash = await hashPassword(pin);

        const current = getStaffPinHash();
        if (!current || !current.hash) {
          const pin2 = String(form.staffPin2.value || "");
          require(pin === pin2, "PINs do not match.");
          setStaffPinHash(pinHash);
          setStaffSession();
          window.location.replace("staff-dashboard.html");
          return;
        }

        require(current.hash === pinHash, "Invalid PIN.");
        setStaffSession();
        window.location.replace("staff-dashboard.html");
      } catch (err) {
        showAlert("staffLoginError", err instanceof Error ? err.message : "Could not login.");
      }
    });
  }

  function bindStaffDashboardPage() {
    if (!document.getElementById("staffBody")) return;
    if (!document.getElementById("staffActions")) return;

    const logoutBtn = document.getElementById("staffLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearStaffSession();
        window.location.replace("staff-login.html");
      });
    }

    const exams = availableExams();
    const selectedKey = "ep_staff_selected_student_v1";

    function getSelectedId() {
      return String(localStorage.getItem(selectedKey) || "");
    }

    function setSelectedId(id) {
      localStorage.setItem(selectedKey, String(id || ""));
    }

    function loadUsers() {
      return getUsers().map(ensureUserData);
    }

    function saveUser(nextUser) {
      const nextUsers = upsertUser(loadUsers(), ensureUserData(nextUser));
      saveUsers(nextUsers);
    }

    function findUser(users, id) {
      return users.find((u) => u.id === id) || null;
    }

    function renderSelectedStudent(user) {
      const regRows = user.examRegistrations
        .slice()
        .sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt)))
        .map((r) => {
          const ex = exams.find((e) => e.id === r.examId);
          const examName = ex ? ex.name : r.examName || r.examId;
          const status = r.status || "Registered";
          const result = (user.examResults && user.examResults[r.examId]) || null;
          const hasResult = Boolean(result);
          const scoreValue = result && result.score != null ? String(result.score) : "";
          const gradeValue = result && result.grade != null ? String(result.grade) : "";
          return `
            <tr>
              <td>${escapeHtml(examName)}</td>
              <td>${escapeHtml(r.examId)}</td>
              <td class="muted">${escapeHtml(new Date(r.registeredAt).toLocaleString())}</td>
              <td>
                <select data-action="reg-status" data-examid="${escapeHtml(r.examId)}" class="btn btn-small" style="padding:8px 10px">
                  <option value="Registered" ${status === "Registered" ? "selected" : ""}>Registered</option>
                  <option value="Cancelled" ${status === "Cancelled" ? "selected" : ""}>Cancelled</option>
                </select>
              </td>
              <td>${hasResult ? pill("Published") : pill("Pending")}</td>
              <td>
                <input
                  class="btn btn-small"
                  style="width:92px; padding:8px 10px"
                  type="number"
                  min="0"
                  max="100"
                  inputmode="numeric"
                  data-role="res-score"
                  data-examid="${escapeHtml(r.examId)}"
                  value="${escapeHtml(scoreValue)}"
                  placeholder="0-100"
                />
              </td>
              <td>
                <input
                  class="btn btn-small"
                  style="width:86px; padding:8px 10px"
                  type="text"
                  data-role="res-grade"
                  data-examid="${escapeHtml(r.examId)}"
                  value="${escapeHtml(gradeValue)}"
                  placeholder="A/B/C"
                />
              </td>
              <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap">
                  <button class="btn btn-small btn-primary" type="button" data-action="result-save" data-examid="${escapeHtml(r.examId)}">
                    ${hasResult ? "Save Result" : "Publish Result"}
                  </button>
                  <button class="btn btn-small" type="button" data-action="result-remove" data-examid="${escapeHtml(r.examId)}" ${
                    hasResult ? "" : "disabled"
                  }>
                    Remove Result
                  </button>
                  <button class="btn btn-small" type="button" data-action="reg-remove" data-examid="${escapeHtml(r.examId)}">Remove Registration</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      const existing = new Set(user.examRegistrations.map((r) => r.examId));
      const available = exams.filter((e) => !existing.has(e.id));
      const addOptions = available
        .map((e) => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)} (${escapeHtml(e.id)})</option>`)
        .join("");

      return `
        <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
          <div class="row">
            <div>
              <div style="font-weight:900; letter-spacing:.2px">Edit Student</div>
              <div class="hint">Editing Student ID or Email will affect how the student logs in.</div>
            </div>
            <button class="btn btn-small btn-ghost" type="button" data-action="clear-selection">Close</button>
          </div>
          <div class="hr"></div>

          <form id="staffEditForm" class="form" novalidate>
            <input type="hidden" id="editUserId" value="${escapeHtml(user.id)}" />
            <div class="grid-2">
              <div class="field">
                <label for="editFullName">Full Name</label>
                <input id="editFullName" name="editFullName" required value="${escapeHtml(user.fullName)}" />
              </div>
              <div class="field">
                <label for="editStudentId">Student ID</label>
                <input id="editStudentId" name="editStudentId" required value="${escapeHtml(user.studentId)}" />
              </div>
            </div>
            <div class="grid-2">
              <div class="field">
                <label for="editEmail">Email</label>
                <input id="editEmail" name="editEmail" type="email" required value="${escapeHtml(user.email)}" />
              </div>
              <div class="field">
                <label for="editPhone">Phone</label>
                <input id="editPhone" name="editPhone" required value="${escapeHtml(user.phone)}" />
              </div>
            </div>
            <div id="staffEditError" class="alert alert-danger" role="alert" hidden></div>
            <div id="staffEditOk" class="alert alert-success" role="status" hidden></div>
            <div class="row">
              <button class="btn btn-primary" type="submit">Save Details</button>
              <div class="hint">Account created: ${escapeHtml(new Date(user.createdAt).toLocaleString())}</div>
            </div>
          </form>

          <div class="hr"></div>
          <div style="font-weight:900; letter-spacing:.2px">Exam Registrations</div>
          <div class="hint">Add/remove registrations, publish results, or mark registrations as Cancelled.</div>
          <div class="hr"></div>

          <div class="row">
            <div class="field" style="flex:1; min-width:260px; margin:0">
              <label for="addExamSelect">Add Exam</label>
              <select id="addExamSelect" class="btn btn-small" style="width:100%; padding:10px 12px">
                ${addOptions || `<option value="">No available exams</option>`}
              </select>
            </div>
            <button class="btn btn-small btn-primary" type="button" data-action="reg-add" ${available.length ? "" : "disabled"}>
              Add Registration
            </button>
          </div>

          <div class="hr"></div>
          <div id="staffResultError" class="alert alert-danger" role="alert" hidden></div>
          <div id="staffResultOk" class="alert alert-success" role="status" hidden></div>
          <table class="table" aria-label="Student registrations editor table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Exam ID</th>
                <th>Registered At</th>
                <th>Status</th>
                <th>Result</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${regRows || `<tr><td colspan="8">No registrations yet.</td></tr>`}</tbody>
          </table>
        </div>
      `;
    }

    function wireEvents() {
      const root = document.getElementById("staffBody");
      if (!root) return;
      const passMark = 40;

      function gradeFromScore(score) {
        if (score >= 90) return "A+";
        if (score >= 80) return "A";
        if (score >= 70) return "B";
        if (score >= 60) return "C";
        return "D";
      }

      function showResultOk(msg) {
        hideAlert("staffResultError");
        showAlert("staffResultOk", msg);
      }

      function showResultError(msg) {
        hideAlert("staffResultOk");
        showAlert("staffResultError", msg);
      }

      root.querySelectorAll("[data-action='select-student']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id") || "";
          setSelectedId(id);
          render();
        });
      });

      root.querySelectorAll("[data-action='clear-selection']").forEach((btn) => {
        btn.addEventListener("click", () => {
          setSelectedId("");
          render();
        });
      });

      const editForm = document.getElementById("staffEditForm");
      if (editForm) {
        editForm.addEventListener("submit", (e) => {
          e.preventDefault();
          hideAlert("staffEditError");
          hideAlert("staffEditOk");

          const users = loadUsers();
          const id = String(document.getElementById("editUserId")?.value || "");
          const current = findUser(users, id);
          if (!current) {
            showAlert("staffEditError", "Student not found.");
            return;
          }

          const fullName = String(document.getElementById("editFullName")?.value || "").trim();
          const studentId = normalizeStudentId(document.getElementById("editStudentId")?.value || "");
          const email = normalizeEmail(document.getElementById("editEmail")?.value || "");
          const phone = String(document.getElementById("editPhone")?.value || "").trim();

          try {
            require(fullName.length >= 2, "Full name is required.");
            require(studentId.length >= 3, "Student ID is required.");
            require(email.includes("@") && email.includes("."), "Enter a valid email.");
            require(phone.length >= 6, "Phone number is required.");

            const sidTaken = users.some((u) => u.id !== id && normalizeStudentId(u.studentId) === studentId);
            require(!sidTaken, "That Student ID is already used by another account.");
            const emailTaken = users.some((u) => u.id !== id && normalizeEmail(u.email) === email);
            require(!emailTaken, "That email is already used by another account.");

            const next = ensureUserData({ ...current, fullName, studentId, email, phone });
            saveUser(next);
            showAlert("staffEditOk", "Student details updated.");
            render();
          } catch (err) {
            showAlert("staffEditError", err instanceof Error ? err.message : "Could not update student.");
          }
        });
      }

      root.querySelectorAll("[data-action='reg-add']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const users = loadUsers();
          const id = getSelectedId();
          const current = id ? findUser(users, id) : null;
          if (!current) return;

          const select = document.getElementById("addExamSelect");
          const examId = String(select?.value || "");
          const ex = exams.find((e) => e.id === examId);
          if (!ex) return;

          const already = current.examRegistrations.some((r) => r.examId === ex.id);
          if (already) return;

          const next = ensureUserData({
            ...current,
            examRegistrations: [
              ...current.examRegistrations,
              { examId: ex.id, examName: ex.name, registeredAt: nowIso(), status: "Registered" }
            ]
          });
          saveUser(next);
          render();
        });
      });

      root.querySelectorAll("[data-action='reg-remove']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const examId = String(btn.getAttribute("data-examid") || "");
          const users = loadUsers();
          const id = getSelectedId();
          const current = id ? findUser(users, id) : null;
          if (!current) return;

          const ok = confirm("Remove this registration? Any published result for this exam will also be removed.");
          if (!ok) return;

          const nextRegs = current.examRegistrations.filter((r) => r.examId !== examId);
          const nextResults = { ...(current.examResults || {}) };
          delete nextResults[examId];
          const next = ensureUserData({ ...current, examRegistrations: nextRegs, examResults: nextResults });
          saveUser(next);
          render();
        });
      });

      root.querySelectorAll("[data-action='reg-status']").forEach((sel) => {
        sel.addEventListener("change", () => {
          const examId = String(sel.getAttribute("data-examid") || "");
          const status = String(sel.value || "Registered");
          const users = loadUsers();
          const id = getSelectedId();
          const current = id ? findUser(users, id) : null;
          if (!current) return;

          const nextRegs = current.examRegistrations.map((r) => (r.examId === examId ? { ...r, status } : r));
          const next = ensureUserData({ ...current, examRegistrations: nextRegs });
          saveUser(next);
          render();
        });
      });

      root.querySelectorAll("[data-action='result-save']").forEach((btn) => {
        btn.addEventListener("click", () => {
          hideAlert("staffResultError");
          hideAlert("staffResultOk");

          const examId = String(btn.getAttribute("data-examid") || "");
          const scoreEl = root.querySelector(`[data-role="res-score"][data-examid="${examId}"]`);
          const gradeEl = root.querySelector(`[data-role="res-grade"][data-examid="${examId}"]`);
          const scoreRaw = String(scoreEl && scoreEl.value != null ? scoreEl.value : "").trim();
          const gradeRaw = String(gradeEl && gradeEl.value != null ? gradeEl.value : "").trim().toUpperCase();

          const users = loadUsers();
          const id = getSelectedId();
          const current = id ? findUser(users, id) : null;
          if (!current) return;

          const ex = exams.find((e) => e.id === examId);
          const examName = ex ? ex.name : examId;

          let score = Number(scoreRaw);
          if (!Number.isFinite(score)) {
            showResultError("Enter a valid numeric score.");
            return;
          }
          score = Math.round(score);
          if (score < 0 || score > 100) {
            showResultError("Score must be between 0 and 100.");
            return;
          }

          const grade = gradeRaw || gradeFromScore(score);
          const status = score >= passMark ? "Passed" : "Failed";

          const nextResults = { ...(current.examResults || {}) };
          nextResults[examId] = {
            examId,
            examName,
            score,
            grade,
            status,
            publishedAt: nowIso()
          };

          const next = ensureUserData({ ...current, examResults: nextResults });
          saveUser(next);
          showResultOk("Result saved.");
          render();
        });
      });

      root.querySelectorAll("[data-action='result-remove']").forEach((btn) => {
        btn.addEventListener("click", () => {
          hideAlert("staffResultError");
          hideAlert("staffResultOk");

          const examId = String(btn.getAttribute("data-examid") || "");
          const users = loadUsers();
          const id = getSelectedId();
          const current = id ? findUser(users, id) : null;
          if (!current) return;

          const has = Boolean(current.examResults && current.examResults[examId]);
          if (!has) return;

          const ok = confirm("Remove the published result for this exam?");
          if (!ok) return;

          const nextResults = { ...(current.examResults || {}) };
          delete nextResults[examId];
          const next = ensureUserData({ ...current, examResults: nextResults });
          saveUser(next);
          showResultOk("Result removed.");
          render();
        });
      });

      const publishRandomBtn = document.getElementById("publishRandomBtn");
      if (publishRandomBtn) {
        publishRandomBtn.addEventListener("click", () => {
          const usersNow = loadUsers();
          const nextUsers = usersNow.map((u) => {
            const nextResults = { ...u.examResults };
            u.examRegistrations.forEach((r) => {
              if (nextResults[r.examId]) return;
              const score = Math.floor(35 + Math.random() * 66);
              const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : "D";
              const ex = exams.find((e) => e.id === r.examId);
              nextResults[r.examId] = {
                examId: r.examId,
                examName: ex ? ex.name : r.examName,
                score,
                grade,
                status: score >= 40 ? "Passed" : "Failed",
                publishedAt: nowIso()
              };
            });
            return ensureUserData({ ...u, examResults: nextResults });
          });
          saveUsers(nextUsers);
          render();
        });
      }

      const refreshBtn = document.getElementById("refreshStaffBtn");
      if (refreshBtn) {
        refreshBtn.addEventListener("click", () => render());
      }
    }

    function render() {
      const users = loadUsers();
      const totalRegs = users.reduce((n, u) => n + (u.examRegistrations?.length || 0), 0);
      const totalResults = users.reduce((n, u) => n + Object.keys(u.examResults || {}).length, 0);

      setHtml(
        "staffActions",
        `
          <span class="pill warn">${escapeHtml(String(users.length))} students</span>
          <span class="pill warn">${escapeHtml(String(totalRegs))} registrations</span>
          <span class="pill warn">${escapeHtml(String(totalResults))} results</span>
          <button id="publishRandomBtn" class="btn btn-small btn-primary" type="button">Publish Random Results</button>
          <button id="refreshStaffBtn" class="btn btn-small" type="button">Refresh</button>
        `
      );

      const selectedId = getSelectedId();
      const selectedUser = selectedId ? findUser(users, selectedId) : null;

      const studentRows = users
        .slice()
        .sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)))
        .map((u) => {
          const regCount = u.examRegistrations.length;
          const resCount = Object.keys(u.examResults).length;
          const active = selectedUser && selectedUser.id === u.id;
          return `
            <tr>
              <td style="font-weight:900">${escapeHtml(u.fullName)}</td>
              <td>${escapeHtml(u.studentId)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>${escapeHtml(u.phone)}</td>
              <td>${escapeHtml(String(regCount))}</td>
              <td>${escapeHtml(String(resCount))}</td>
              <td>
                <button class="btn btn-small ${active ? "btn-primary" : ""}" type="button" data-action="select-student" data-id="${escapeHtml(
                  u.id
                )}">
                  ${active ? "Selected" : "Edit"}
                </button>
              </td>
            </tr>
          `;
        })
        .join("");

      const selectedPanel = selectedUser
        ? renderSelectedStudent(selectedUser)
        : `
          <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
            <div style="font-weight:900; letter-spacing:.2px">Student Editor</div>
            <div class="hint">Select a student to edit their details and registrations.</div>
          </div>
        `;

      setHtml(
        "staffBody",
        `
          <div class="stack">
            <div class="alert" style="background:rgba(0,0,0,.18)">
              Staff can edit student details and exam registrations. Changes are saved to LocalStorage immediately.
            </div>

            <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
              <div style="font-weight:900; letter-spacing:.2px">Students</div>
              <div class="hint">Click Edit to open a student for changes.</div>
              <div class="hr"></div>
              <table class="table" aria-label="Students table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Student ID</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Regs</th>
                    <th>Results</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>${studentRows || `<tr><td colspan="7">No students registered yet.</td></tr>`}</tbody>
              </table>
            </div>

            ${selectedPanel}
          </div>
        `
      );

      wireEvents();
    }

    render();
  }

  function bindLoginPage() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert("loginError");

      const loginId = form.loginId.value;
      const password = form.password.value;

      try {
        require(String(loginId || "").trim(), "Enter your email or student ID.");
        require(String(password || ""), "Enter your password.");

        const users = getUsers();
        const user = findUserByLogin(users, loginId);
        require(user, "Invalid login. Check your email/student ID and password.");

        const passwordHash = await hashPassword(password);
        require(user.passwordHash === passwordHash, "Invalid login. Check your email/student ID and password.");

        setSession(user.id);
        window.location.replace("dashboard.html");
      } catch (err) {
        showAlert("loginError", err instanceof Error ? err.message : "Login failed.");
      }
    });
  }

  function bindRegisterPage() {
    const form = document.getElementById("registerForm");
    if (!form) return;

    const photoInput = document.getElementById("photo");
    const photoPreview = document.getElementById("photoPreview");
    const maxPhotoBytes = 300 * 1024;

    function renderPhotoPreview(file, dataUrl) {
      if (!photoPreview) return;
      if (!file || !dataUrl) {
        photoPreview.hidden = true;
        photoPreview.innerHTML = "";
        return;
      }
      const sizeKb = Math.round(file.size / 1024);
      photoPreview.hidden = false;
      photoPreview.innerHTML = `
        <img alt="Selected photo preview" src="${dataUrl}" />
        <div class="photo-meta">
          <div class="photo-name">${escapeHtml(file.name)}</div>
          <div class="photo-size">${escapeHtml(String(sizeKb))} KB</div>
        </div>
      `;
    }

    if (photoInput) {
      photoInput.addEventListener("change", async () => {
        const file = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
        if (!file) return renderPhotoPreview(null, "");
        if (!String(file.type || "").startsWith("image/")) return renderPhotoPreview(null, "");
        if (file.size > maxPhotoBytes) return renderPhotoPreview(null, "");
        try {
          const url = await readFileAsDataUrl(file);
          renderPhotoPreview(file, url);
        } catch {
          renderPhotoPreview(null, "");
        }
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert("registerError");
      hideAlert("registerOk");

      const users = getUsers();
      try {
        const photoFile = form.photo && form.photo.files && form.photo.files[0] ? form.photo.files[0] : null;
        let photoDataUrl = "";
        if (photoFile) {
          require(String(photoFile.type || "").startsWith("image/"), "Photo must be an image file.");
          require(photoFile.size <= maxPhotoBytes, "Photo is too large. Please upload a photo under 300KB.");
          photoDataUrl = await readFileAsDataUrl(photoFile);
        }

        const payload = {
          fullName: form.fullName.value,
          studentId: form.studentId.value,
          email: form.email.value,
          phone: form.phone.value,
          dob: form.dob.value,
          password: form.password.value,
          confirmPassword: form.confirmPassword.value
        };

        const validated = validateRegistration(payload, users);
        const passwordHash = await hashPassword(validated.password);

        const newUser = ensureUserData({
          id: uid(),
          fullName: validated.fullName,
          studentId: validated.studentId,
          email: validated.email,
          phone: validated.phone,
          dob: validated.dob,
          photoDataUrl,
          passwordHash,
          createdAt: nowIso()
        });

        saveUsers([...users, newUser]);
        showAlert("registerOk", "Account created. You can log in now.");

        form.reset();
        renderPhotoPreview(null, "");
        setTimeout(() => window.location.replace("login.html"), 600);
      } catch (err) {
        showAlert("registerError", err instanceof Error ? err.message : "Registration failed.");
      }
    });
  }

  function bindForgotPasswordPage() {
    const form = document.getElementById("forgotPasswordForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert("fpError");
      hideAlert("fpOk");

      const loginId = String(form.loginId.value || "").trim();
      const dob = String(form.dob.value || "").trim();
      const newPassword = String(form.newPassword.value || "");
      const confirmPassword = String(form.confirmPassword.value || "");

      try {
        require(loginId, "Enter your email or student ID.");
        require(dob.length >= 8, "Date of birth is required.");
        require(!Number.isNaN(Date.parse(dob)), "Enter a valid date of birth.");
        require(new Date(dob + "T00:00:00").getTime() <= Date.now(), "Date of birth cannot be in the future.");
        require(newPassword.length >= 8, "New password must be at least 8 characters.");
        require(newPassword === confirmPassword, "Passwords do not match.");

        const users = getUsers().map(ensureUserData);
        const user = findUserByLogin(users, loginId);
        require(user, "Account not found.");
        require(user.dob, "Your account does not have a date of birth set. Contact staff to update your profile.");
        require(String(user.dob) === dob, "Date of birth does not match this account.");

        const passwordHash = await hashPassword(newPassword);
        const next = ensureUserData({ ...user, passwordHash });
        saveUsers(upsertUser(users, next));

        // Force re-login after reset.
        clearSession();

        showAlert("fpOk", "Password reset successful. You can log in now.");
        form.reset();
        setTimeout(() => window.location.replace("login.html"), 700);
      } catch (err) {
        showAlert("fpError", err instanceof Error ? err.message : "Could not reset password.");
      }
    });
  }

  function bindDashboardPage() {
    const session = getSession();
    const users = getUsers();
    let user = session ? findUserById(users, session.userId) : null;
    if (!user) {
      clearSession();
      window.location.replace("login.html");
      return;
    }

    user = ensureUserData(user);
    setText("whoami", `${user.fullName} (${user.studentId})`);

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearSession();
        window.location.replace("login.html");
      });
    }

    const nav = document.querySelector(".nav");
    const navItems = Array.from(document.querySelectorAll(".nav-item"));

    function saveUser(nextUser) {
      saveUsers(upsertUser(getUsers(), nextUser));
      user = nextUser;
      setText("whoami", `${user.fullName} (${user.studentId})`);
    }

    function renderRegistration() {
      setText("panelTitle", "Exam Registration");
      setText("panelSubtitle", "Register for available exams and track status.");
      setHtml("panelActions", "");

      const exams = availableExams();
      const registered = new Set(user.examRegistrations.map((r) => r.examId));

      const rows = exams
        .map((ex) => {
          const isReg = registered.has(ex.id);
          const action = isReg
            ? `<span class="pill ok">Already Registered</span>`
            : `<button class="btn btn-small btn-primary" data-action="register" data-examid="${escapeHtml(ex.id)}" type="button">Register</button>`;
          return `
            <tr>
              <td>
                <div style="font-weight:800">${escapeHtml(ex.name)}</div>
                <div class="hint">Exam ID: ${escapeHtml(ex.id)}</div>
              </td>
              <td>${escapeHtml(fmtDate(ex.date))}</td>
              <td>${escapeHtml(ex.center)}</td>
              <td>${action}</td>
            </tr>
          `;
        })
        .join("");

      const regRows = user.examRegistrations
        .slice()
        .sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt)))
        .map((r) => {
          const ex = exams.find((e) => e.id === r.examId);
          const examName = ex ? ex.name : r.examName || r.examId;
          return `
            <tr>
              <td>${escapeHtml(examName)}</td>
              <td>${escapeHtml(r.examId)}</td>
              <td>${escapeHtml(new Date(r.registeredAt).toLocaleString())}</td>
              <td>${pill(r.status || "Registered")}</td>
            </tr>
          `;
        })
        .join("");

      setHtml(
        "panelBody",
        `
          <div class="stack">
            <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
              <div class="row">
                <div>
                  <div style="font-weight:900; letter-spacing:.2px">Available Exams</div>
                  <div class="hint">Select an exam to register. Registrations are stored for this student.</div>
                </div>
                <div class="pill warn">${escapeHtml(String(user.examRegistrations.length))} registered</div>
              </div>
              <div class="hr"></div>
              <table class="table" aria-label="Available exams">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Date</th>
                    <th>Center</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>${rows || `<tr><td colspan="4">No exams available.</td></tr>`}</tbody>
              </table>
            </div>

            <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
              <div style="font-weight:900; letter-spacing:.2px">Your Registrations</div>
              <div class="hint">Confirm your registered exams and status.</div>
              <div class="hr"></div>
              <table class="table" aria-label="Your registrations">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Exam ID</th>
                    <th>Registered At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>${regRows || `<tr><td colspan="4">No exam registrations yet.</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        `
      );

      const body = document.getElementById("panelBody");
      if (!body) return;
      body.querySelectorAll("[data-action='register']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const examId = btn.getAttribute("data-examid");
          const ex = exams.find((e) => e.id === examId);
          if (!ex) return;
          if (registered.has(ex.id)) return;

          const next = ensureUserData({
            ...user,
            examRegistrations: [
              ...user.examRegistrations,
              { examId: ex.id, examName: ex.name, registeredAt: nowIso(), status: "Registered" }
            ]
          });
          saveUser(next);
          renderRegistration();
        });
      });
    }

    function renderResults() {
      setText("panelTitle", "Exam Result");
      setText("panelSubtitle", "View your published results.");
      setHtml("panelActions", "");

      const exams = availableExams();
      const rows = user.examRegistrations
        .slice()
        .sort((a, b) => String(a.examId).localeCompare(String(b.examId)))
        .map((r) => {
          const ex = exams.find((e) => e.id === r.examId);
          const examName = ex ? ex.name : r.examName || r.examId;
          const result = user.examResults[r.examId];
          if (!result) {
            return `
              <tr>
                <td>${escapeHtml(examName)}</td>
                <td>${escapeHtml(r.examId)}</td>
                <td>${pill("Pending")}</td>
                <td class="muted">—</td>
                <td class="muted">—</td>
              </tr>
            `;
          }
          return `
            <tr>
              <td>${escapeHtml(result.examName || examName)}</td>
              <td>${escapeHtml(result.examId || r.examId)}</td>
              <td>${pill("Published")}</td>
              <td style="font-weight:900">${escapeHtml(String(result.score))}</td>
              <td>${escapeHtml(result.grade)}</td>
            </tr>
          `;
        })
        .join("");

      setHtml(
        "panelBody",
        `
          <div class="stack">
            <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
              <div class="row">
                <div>
                  <div style="font-weight:900; letter-spacing:.2px">Your Results</div>
                  <div class="hint">Results show as Pending until published.</div>
                </div>
                <div class="pill warn">${escapeHtml(String(Object.keys(user.examResults).length))} published</div>
              </div>
              <div class="hr"></div>
              <table class="table" aria-label="Exam results">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Exam ID</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>${rows || `<tr><td colspan="5">Register for an exam to see results here.</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        `
      );
    }

    function renderProfile() {
      setText("panelTitle", "Student Profile");
      setText("panelSubtitle", "View and update your profile details.");
      setHtml("panelActions", "");

      const initials = String(user.fullName || "Student")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => (p[0] ? p[0].toUpperCase() : ""))
        .join("");

      const photoHtml = user.photoDataUrl
        ? `<img alt="Student photo" src="${user.photoDataUrl}" />`
        : `<span aria-hidden="true">${escapeHtml(initials || "S")}</span>`;

      setHtml(
        "panelBody",
        `
          <div class="stack">
            <div class="card" style="padding:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10)">
              <div class="row">
                <div>
                  <div style="font-weight:900; letter-spacing:.2px">Profile</div>
                  <div class="hint">Your Student ID cannot be changed.</div>
                </div>
                <span class="pill ok">Active</span>
              </div>
              <div class="hr"></div>
              <form id="profileForm" class="form" novalidate>
                <div class="profile-head">
                  <div class="avatar">${photoHtml}</div>
                  <div>
                    <div style="font-weight:900; letter-spacing:.2px">${escapeHtml(user.fullName)}</div>
                    <div class="hint">${escapeHtml(user.studentId)} • ${escapeHtml(user.email)}</div>
                  </div>
                </div>
                <div class="grid-2">
                  <div class="field">
                    <label for="pFullName">Full Name</label>
                    <input id="pFullName" name="pFullName" required value="${escapeHtml(user.fullName)}" />
                  </div>
                  <div class="field">
                    <label for="pStudentId">Student ID</label>
                    <input id="pStudentId" name="pStudentId" disabled value="${escapeHtml(user.studentId)}" />
                  </div>
                </div>
                <div class="grid-2">
                  <div class="field">
                    <label for="pEmail">Email</label>
                    <input id="pEmail" name="pEmail" type="email" required value="${escapeHtml(user.email)}" />
                  </div>
                  <div class="field">
                    <label for="pPhone">Phone</label>
                    <input id="pPhone" name="pPhone" required value="${escapeHtml(user.phone)}" />
                  </div>
                </div>
                <div class="grid-2">
                  <div class="field">
                    <label for="pDob">Date of Birth</label>
                    <input id="pDob" name="pDob" type="date" required value="${escapeHtml(user.dob || "")}" />
                  </div>
                  <div class="field">
                    <label for="pPhoto">Photo (Optional)</label>
                    <input id="pPhoto" name="pPhoto" type="file" accept="image/*" />
                    <div class="hint">Max 300KB. Leave empty to keep current photo.</div>
                    <div id="pPhotoPreview" class="photo-preview" hidden></div>
                    ${
                      user.photoDataUrl
                        ? `<div class="row" style="justify-content:flex-start">
                             <button class="btn btn-small" id="pRemovePhotoBtn" type="button">Remove Photo</button>
                           </div>`
                        : ""
                    }
                  </div>
                </div>
                <div id="profileError" class="alert alert-danger" role="alert" hidden></div>
                <div id="profileOk" class="alert alert-success" role="status" hidden></div>
                <div class="row">
                  <button class="btn btn-primary" type="submit">Save Changes</button>
                  <div class="hint">Member since ${escapeHtml(new Date(user.createdAt).toLocaleDateString())}</div>
                </div>
              </form>
            </div>
          </div>
        `
      );

      const form = document.getElementById("profileForm");
      if (!form) return;

      const maxPhotoBytes = 300 * 1024;
      const photoInput = document.getElementById("pPhoto");
      const photoPreview = document.getElementById("pPhotoPreview");

      function renderPhotoPreview(file, dataUrl) {
        if (!photoPreview) return;
        if (!file || !dataUrl) {
          photoPreview.hidden = true;
          photoPreview.innerHTML = "";
          return;
        }
        const sizeKb = Math.round(file.size / 1024);
        photoPreview.hidden = false;
        photoPreview.innerHTML = `
          <img alt="Selected photo preview" src="${dataUrl}" />
          <div class="photo-meta">
            <div class="photo-name">${escapeHtml(file.name)}</div>
            <div class="photo-size">${escapeHtml(String(sizeKb))} KB</div>
          </div>
        `;
      }

      if (photoInput) {
        photoInput.addEventListener("change", async () => {
          const file = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
          if (!file) return renderPhotoPreview(null, "");
          if (!String(file.type || "").startsWith("image/")) return renderPhotoPreview(null, "");
          if (file.size > maxPhotoBytes) return renderPhotoPreview(null, "");
          try {
            const url = await readFileAsDataUrl(file);
            renderPhotoPreview(file, url);
          } catch {
            renderPhotoPreview(null, "");
          }
        });
      }

      const removeBtn = document.getElementById("pRemovePhotoBtn");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          const ok = confirm("Remove your profile photo?");
          if (!ok) return;
          const next = ensureUserData({ ...user, photoDataUrl: "" });
          saveUser(next);
          renderProfile();
          showAlert("profileOk", "Photo removed.");
        });
      }

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert("profileError");
        hideAlert("profileOk");

        const fullName = String(form.pFullName.value || "").trim();
        const email = normalizeEmail(form.pEmail.value);
        const phone = String(form.pPhone.value || "").trim();
        const dob = String(form.pDob.value || "").trim();

        try {
          require(fullName.length >= 2, "Full name is required.");
          require(email.includes("@") && email.includes("."), "Enter a valid email.");
          require(phone.length >= 6, "Phone number is required.");
          require(dob.length >= 8, "Date of birth is required.");
          require(!Number.isNaN(Date.parse(dob)), "Enter a valid date of birth.");
          require(new Date(dob + "T00:00:00").getTime() <= Date.now(), "Date of birth cannot be in the future.");

          const usersNow = getUsers();
          const emailTaken = usersNow.some((u) => u.id !== user.id && normalizeEmail(u.email) === email);
          require(!emailTaken, "That email is already used by another account.");

          let photoDataUrl = user.photoDataUrl || "";
          const photoFile = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
          if (photoFile) {
            require(String(photoFile.type || "").startsWith("image/"), "Photo must be an image file.");
            require(photoFile.size <= maxPhotoBytes, "Photo is too large. Please upload a photo under 300KB.");
            photoDataUrl = await readFileAsDataUrl(photoFile);
          }

          const next = ensureUserData({ ...user, fullName, email, phone, dob, photoDataUrl });
          saveUser(next);
          renderProfile();
          showAlert("profileOk", "Profile updated.");
        } catch (err) {
          showAlert("profileError", err instanceof Error ? err.message : "Could not update profile.");
        }
      });
    }

    function renderView(view) {
      if (view === "results") return renderResults();
      if (view === "profile") return renderProfile();
      return renderRegistration();
    }

    function setActive(view) {
      navItems.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
      renderView(view);
    }

    if (nav) {
      nav.addEventListener("click", (e) => {
        const btn = e.target.closest(".nav-item");
        if (!btn) return;
        setActive(btn.dataset.view || "registration");
      });
    }

    renderRegistration();
  }

  window.ExamPortal = {
    guardPublicPage,
    guardPrivatePage,
    guardStaffPrivatePage,
    bindLoginPage,
    bindRegisterPage,
    bindForgotPasswordPage,
    bindDashboardPage,
    bindDatabasePage,
    bindStaffLoginPage,
    bindStaffDashboardPage
  };
})();
