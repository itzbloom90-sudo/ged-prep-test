/* =========================================================
   GED Prep-Test — Application Logic
   ========================================================= */

const SUBJECTS = {
  math: {
    label: "Mathematical Reasoning",
    minutes: 115,
    passScore: 145, collegeReady: 165, collegeCredit: 175,
    sections: [
      { key:"math_part1", label:"Part 1 — No Calculator", count:5, calculator:false },
      { key:"math_part2", label:"Part 2 — Calculator Allowed", count:15, calculator:true }
    ]
  },
  rla: {
    label: "Reasoning Through Language Arts",
    minutes: 150, passScore: 145, collegeReady: 165, collegeCredit: 175,
    sections: [ { key:"rla", label:"Reading & Language", count:8, calculator:false } ] // pool: 16
  },
  science: {
    label: "Science",
    minutes: 90, passScore: 145, collegeReady: 165, collegeCredit: 175,
    sections: [ { key:"science", label:"Science Reasoning", count:10, calculator:false } ] // pool: 20
  },
  social_studies: {
    label: "Social Studies",
    minutes: 70, passScore: 145, collegeReady: 165, collegeCredit: 175,
    sections: [ { key:"social_studies", label:"Social Studies Reasoning", count:10, calculator:false } ] // pool: 17
  }
};

const STORAGE_KEY = "ged_prep_test_history_v1";
const PROFILE_KEY = "ged_prep_test_profile_v1";

/* ---------- Utility ---------- */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Shuffle-bag rotation + strict no-repeat-vs-last-attempt guarantee ---------- */
const BAG_KEY = "ged_prep_test_bag_v1";
const LAST_USED_KEY = "ged_prep_test_last_used_v1";

function getBag(sectionKey, poolIds) {
  let all = {};
  try {
    const raw = localStorage.getItem(BAG_KEY);
    all = raw ? JSON.parse(raw) : {};
  } catch { all = {}; }
  let bag = all[sectionKey];
  if (!bag || bag.length === 0 || !bag.every(id => poolIds.includes(id))) bag = shuffle(poolIds);
  return bag;
}
function saveBag(sectionKey, bag) {
  let all = {};
  try {
    const raw = localStorage.getItem(BAG_KEY);
    all = raw ? JSON.parse(raw) : {};
  } catch { all = {}; }
  all[sectionKey] = bag;
  localStorage.setItem(BAG_KEY, JSON.stringify(all));
}
function getLastUsed(sectionKey) {
  try {
    const raw = localStorage.getItem(LAST_USED_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[sectionKey] || [];
  } catch { return []; }
}
function setLastUsed(sectionKey, ids) {
  try {
    const raw = localStorage.getItem(LAST_USED_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[sectionKey] = ids;
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/**
 * Draws `count` questions for a section such that:
 *  1) None of them were in the immediately previous attempt for this section
 *     (guaranteed whenever pool size is at least 2x count — true for every section here).
 *  2) Over many attempts, every question in the pool gets used before any repeats,
 *     via a persistent rotation "bag".
 */
function drawFromBag(bankKey, count) {
  const pool = QUESTION_BANK[bankKey] || [];
  const poolIds = pool.map(q => q.id);
  const byId = Object.fromEntries(pool.map(q => [q.id, q]));
  const avoidIds = getLastUsed(bankKey);

  let bag = getBag(bankKey, poolIds);
  // Prioritize items NOT in the immediately previous attempt, without discarding the rest of the bag.
  bag = [...bag.filter(id => !avoidIds.includes(id)), ...bag.filter(id => avoidIds.includes(id))];

  const drawnIds = [];
  while (drawnIds.length < count) {
    if (bag.length === 0) {
      let refill = shuffle(poolIds.filter(id => !drawnIds.includes(id)));
      refill = [...refill.filter(id => !avoidIds.includes(id)), ...refill.filter(id => avoidIds.includes(id))];
      bag = refill;
      if (bag.length === 0) break; // pool smaller than requested count; safety stop
    }
    drawnIds.push(bag.shift());
  }

  saveBag(bankKey, bag);
  setLastUsed(bankKey, drawnIds); // remember this exact set so the NEXT attempt avoids all of it
  return drawnIds.map(id => byId[id]);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ---------- Profile (local, offline-first) ---------- */
function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setProfile(name) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, mode: "offline", createdAt: Date.now() }));
}

/* ---------- History ---------- */
function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveAttempt(subjectKey, attempt) {
  const history = getHistory();
  if (!history[subjectKey]) history[subjectKey] = [];
  history[subjectKey].push(attempt);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/* ---------- (legacy helpers removed — replaced by the shuffle-bag system below) ---------- */

/* ---------- Scoring: approximate GED-style scaled score (100-200) ---------- */
function scaleScore(rawCorrect, rawTotal) {
  const pct = rawTotal > 0 ? rawCorrect / rawTotal : 0;
  // Map 0%-100% raw onto 100-200 scaled, with passing (145) requiring ~65% raw.
  // This is an approximation for practice purposes, not an official GED formula.
  let scaled;
  if (pct <= 0.65) {
    scaled = 100 + (pct / 0.65) * 45; // 0%->100, 65%->145
  } else {
    scaled = 145 + ((pct - 0.65) / 0.35) * 55; // 65%->145, 100%->200
  }
  return Math.round(scaled);
}

function scoreLabel(scaled, subjectMeta) {
  if (scaled >= subjectMeta.collegeCredit) return { label: "College Ready + Credit", tone: "pass" };
  if (scaled >= subjectMeta.collegeReady) return { label: "College Ready", tone: "pass" };
  if (scaled >= subjectMeta.passScore) return { label: "Passing", tone: "pass" };
  return { label: "Below Passing", tone: "fail" };
}

/* =========================================================
   APP STATE + VIEW ROUTER
   ========================================================= */
const App = {
  root: null,
  timerInterval: null,
  examState: null,

  init(root) {
    this.root = root;
    const profile = getProfile();
    if (!profile) this.renderWelcome();
    else this.renderDashboard();
  },

  /* ---------- WELCOME / PROFILE CREATION ---------- */
  renderWelcome() {
    this.root.innerHTML = `
      <div class="center-screen">
        <div class="panel welcome-panel">
          <div class="seal"><span>GP</span></div>
          <h1>GED Prep-Test</h1>
          <p class="subtitle">Candidate preparation system</p>
          <p class="lead">Create a local profile to begin. All results are stored privately on this device.</p>
          <input id="nameInput" type="text" placeholder="Enter your name" class="text-input" />
          <button id="startBtn" class="btn-primary">Create profile &amp; continue</button>
          <p class="fineprint">Prefer cloud sync across devices? Google sign-in can be enabled by the site owner — see README for setup. This demo runs fully offline.</p>
        </div>
      </div>`;
    document.getElementById("startBtn").addEventListener("click", () => {
      const name = document.getElementById("nameInput").value.trim() || "Candidate";
      setProfile(name);
      this.renderDashboard();
    });
  },

  /* ---------- DASHBOARD ---------- */
  renderDashboard() {
    const profile = getProfile();
    const history = getHistory();

    const cards = Object.entries(SUBJECTS).map(([key, meta]) => {
      const attempts = history[key] || [];
      const count = attempts.length;
      const passes = attempts.filter(a => a.scaled >= meta.passScore).length;
      const fails = count - passes;
      const best = count ? Math.max(...attempts.map(a => a.scaled)) : null;
      return `
        <div class="subject-card">
          <div class="subject-card-top">
            <div class="subject-name">${meta.label}</div>
            <div class="subject-time">${meta.minutes} min</div>
          </div>
          <div class="subject-stats">
            <div><span class="stat-num">${count}</span><span class="stat-label">attempts</span></div>
            <div><span class="stat-num pass">${passes}</span><span class="stat-label">passed</span></div>
            <div><span class="stat-num fail">${fails}</span><span class="stat-label">failed</span></div>
          </div>
          ${best ? `<div class="best-score">Best score: <strong>${best}</strong> / 200</div>` : `<div class="best-score muted">No attempts yet</div>`}
          <div class="card-actions">
            <button class="btn-ghost" data-history="${key}">History</button>
            <button class="btn-primary" data-start="${key}">Begin exam</button>
          </div>
        </div>`;
    }).join("");

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            <div class="seal small"><span>GP</span></div>
            <div>
              <div class="brand-title">GED Prep-Test</div>
              <div class="brand-sub">Candidate preparation system</div>
            </div>
          </div>
          <div class="profile-pill">${profile.name} · offline profile</div>
        </header>
        <main class="dashboard">
          <h2>Choose a subject</h2>
          <p class="lead">Every attempt uses a freshly randomized set of questions and a live official-length timer.</p>
          <div class="subject-grid">${cards}</div>
        </main>
      </div>`;

    this.root.querySelectorAll("[data-start]").forEach(btn => {
      btn.addEventListener("click", () => this.startExam(btn.getAttribute("data-start")));
    });
    this.root.querySelectorAll("[data-history]").forEach(btn => {
      btn.addEventListener("click", () => this.renderHistory(btn.getAttribute("data-history")));
    });
  },

  /* ---------- HISTORY VIEW ---------- */
  renderHistory(subjectKey) {
    const meta = SUBJECTS[subjectKey];
    const attempts = (getHistory()[subjectKey] || []).slice().reverse();
    const rows = attempts.map((a, i) => {
      const result = scoreLabel(a.scaled, meta);
      const date = new Date(a.date).toLocaleString();
      return `<tr>
        <td>${attempts.length - i}</td>
        <td>${date}</td>
        <td>${a.correct}/${a.total}</td>
        <td>${a.scaled}/200</td>
        <td class="${result.tone}">${result.label}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="5" class="muted">No attempts recorded yet.</td></tr>`;

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            <div class="seal small"><span>GP</span></div>
            <div><div class="brand-title">GED Prep-Test</div><div class="brand-sub">${meta.label} — history</div></div>
          </div>
          <button class="btn-ghost" id="backDash">Back to dashboard</button>
        </header>
        <main class="dashboard">
          <h2>${meta.label} — attempt history</h2>
          <table class="history-table">
            <thead><tr><th>#</th><th>Date</th><th>Raw score</th><th>Scaled score</th><th>Result</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </main>
      </div>`;
    document.getElementById("backDash").addEventListener("click", () => this.renderDashboard());
  },

  /* ---------- EXAM FLOW ---------- */
  startExam(subjectKey) {
    const meta = SUBJECTS[subjectKey];
    const sections = meta.sections.map(sec => {
      const questions = drawFromBag(sec.key, sec.count);
      return { ...sec, questions };
    });
    const allQuestions = sections.flatMap(sec => sec.questions.map(q => ({ ...q, sectionLabel: sec.label, calculator: sec.calculator })));

    this.examState = {
      subjectKey, meta, sections, allQuestions,
      index: 0,
      answers: {},
      secondsLeft: meta.minutes * 60,
      startedAt: Date.now()
    };
    clearInterval(this.timerInterval);
    this.timerInterval = null; // reset so the timer is guaranteed to (re)start for this fresh attempt
    this.renderExamIntro();
  },

  renderExamIntro() {
    const { meta, allQuestions } = this.examState;
    this.root.innerHTML = `
      <div class="center-screen">
        <div class="panel">
          <h1>${meta.label}</h1>
          <p class="lead">${allQuestions.length} questions · ${meta.minutes} minutes · timer begins when you click start</p>
          <ul class="rules-list">
            <li>Questions are freshly randomized for this attempt.</li>
            <li>You may move between questions using Back / Next.</li>
            <li>The exam auto-submits when time runs out.</li>
            <li>Scoring is an approximation of the official GED scale, for practice purposes only.</li>
          </ul>
          <button class="btn-primary" id="beginBtn">Start timed exam</button>
          <button class="btn-ghost" id="cancelBtn">Cancel</button>
        </div>
      </div>`;
    document.getElementById("beginBtn").addEventListener("click", () => this.renderQuestion());
    document.getElementById("cancelBtn").addEventListener("click", () => this.renderDashboard());
  },

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.timerInterval = setInterval(() => {
      this.examState.secondsLeft--;
      const el = document.getElementById("timerDisplay");
      if (el) el.textContent = formatTime(this.examState.secondsLeft);
      if (this.examState.secondsLeft <= 0) {
        clearInterval(this.timerInterval);
        this.submitExam();
      }
    }, 1000);
  },

  renderQuestion() {
    const state = this.examState;
    const q = state.allQuestions[state.index];
    const total = state.allQuestions.length;
    const savedAnswer = state.answers[q.id] || "";

    let answerHtml = "";
    if (q.type === "mc") {
      answerHtml = `<div class="options-grid">` + q.options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const selected = savedAnswer === opt ? "selected" : "";
        return `<button class="option-btn ${selected}" data-opt="${opt.replace(/"/g,'&quot;')}">
                  <span class="opt-letter">${letter}</span>${opt}
                </button>`;
      }).join("") + `</div>`;
    } else {
      answerHtml = `<input type="text" id="fibInput" class="text-input" placeholder="Type your answer" value="${savedAnswer}" />`;
    }

    this.root.innerHTML = `
      <div class="app-shell exam-shell">
        <header class="topbar">
          <div class="brand">
            <div class="seal small"><span>GP</span></div>
            <div><div class="brand-title">GED Prep-Test</div><div class="brand-sub">${state.meta.label}</div></div>
          </div>
          <div id="timerDisplay" class="timer-pill">${formatTime(state.secondsLeft)}</div>
        </header>
        <main class="exam-main">
          <div class="progress-row">
            <div class="section-label">${q.sectionLabel}${q.calculator ? " · Calculator available" : ""}</div>
            <div class="q-count">Question ${state.index + 1} of ${total}</div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${((state.index+1)/total)*100}%"></div></div>
          <div class="question-card">${q.prompt}</div>
          ${answerHtml}
          <div class="nav-row">
            <button class="btn-ghost" id="backQ" ${state.index === 0 ? "disabled" : ""}>Back</button>
            <button class="btn-primary" id="nextQ">${state.index === total - 1 ? "Submit exam" : "Next question"}</button>
          </div>
        </main>
      </div>`;

    if (q.type === "mc") {
      this.root.querySelectorAll(".option-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          state.answers[q.id] = btn.getAttribute("data-opt");
          this.root.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
        });
      });
    } else {
      document.getElementById("fibInput").addEventListener("input", (e) => {
        state.answers[q.id] = e.target.value;
      });
    }

    document.getElementById("backQ").addEventListener("click", () => {
      if (state.index > 0) { state.index--; this.renderQuestion(); }
    });
    document.getElementById("nextQ").addEventListener("click", () => {
      if (state.index < total - 1) { state.index++; this.renderQuestion(); }
      else { clearInterval(this.timerInterval); this.submitExam(); }
    });

    if (state.index === 0 && !this.timerInterval) this.startTimer();
  },

  submitExam() {
    clearInterval(this.timerInterval);
    const state = this.examState;
    let correct = 0;
    const review = state.allQuestions.map(q => {
      const given = (state.answers[q.id] || "").toString().trim().toLowerCase();
      const correctAns = q.answer.toString().trim().toLowerCase();
      const isCorrect = given === correctAns;
      if (isCorrect) correct++;
      return { ...q, given: state.answers[q.id] || "(no answer)", isCorrect };
    });

    const total = state.allQuestions.length;
    const scaled = scaleScore(correct, total);
    const attempt = { date: Date.now(), correct, total, scaled };
    saveAttempt(state.subjectKey, attempt);

    this.renderResults(review, correct, total, scaled, state.meta);
  },

  renderResults(review, correct, total, scaled, meta) {
    const result = scoreLabel(scaled, meta);
    const reviewHtml = review.map((q, i) => `
      <div class="review-item ${q.isCorrect ? "ok" : "bad"}">
        <div class="review-q">Q${i+1}. ${q.prompt}</div>
        <div class="review-line">Your answer: <strong>${q.given}</strong></div>
        ${!q.isCorrect ? `<div class="review-line">Correct answer: <strong>${q.answer}</strong></div>` : ""}
        <div class="review-explain">${q.explanation}</div>
      </div>`).join("");

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            <div class="seal small"><span>GP</span></div>
            <div><div class="brand-title">GED Prep-Test</div><div class="brand-sub">Score report</div></div>
          </div>
          <button class="btn-ghost" id="backDash">Dashboard</button>
        </header>
        <main class="dashboard">
          <div class="score-report">
            <div class="score-circle ${result.tone}">
              <div class="score-num">${scaled}</div>
              <div class="score-den">/ 200</div>
            </div>
            <div class="score-meta">
              <div class="score-subject">${meta.label}</div>
              <div class="score-result ${result.tone}">${result.label}</div>
              <div class="score-raw">Raw score: ${correct} / ${total} correct</div>
              <div class="score-disclaimer">This is an approximate practice score, not an official GED result.</div>
            </div>
          </div>
          <h3>Question review</h3>
          <div class="review-list">${reviewHtml}</div>
          <button class="btn-primary" id="doneBtn">Return to dashboard</button>
        </main>
      </div>`;
    document.getElementById("backDash").addEventListener("click", () => this.renderDashboard());
    document.getElementById("doneBtn").addEventListener("click", () => this.renderDashboard());
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.init(document.getElementById("app"));
});
