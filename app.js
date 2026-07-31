/*
 * My Life Planner v47
 * Code-quality release: duplicate top-level function declarations removed.
 * Behaviour and saved-data format are unchanged from the stable v19 baseline.
 */
var timelineRange='today';
var TIMELINE_TYPES={
  appointment:{icon:'📅',label:'Appointment'},todo:{icon:'✅',label:'To-do'},project:{icon:'📁',label:'Project'},
  cleaning:{icon:'🧹',label:'Cleaning'},annual:{icon:'🎂',label:'Birthday / annual date'},waiting:{icon:'⏳',label:'Waiting For'}
};

const dailyTasks = [
  { id: "wake", title: "Get up, wash and get dressed", time: "Around 7:00-8:00, depending on sleep and health" },
  { id: "coffee", title: "Coffee, breakfast and medication", time: "About 30 minutes" },
  { id: "emails", title: "Check important emails only", time: "15 minutes" },
  { id: "plan", title: "Look at today and choose one main focus", time: "5 minutes" },
  { id: "main", title: "Do one main morning task", time: "45-90 minutes while energy is best" },
  { id: "break", title: "Take a proper break", time: "Tea, food, sit down or fresh air" },
  { id: "computer", title: "Afternoon computer work", time: "30-60 minutes" },
  { id: "small", title: "Complete one small household task", time: "10-20 minutes only" }
];

const eveningTasks = [
  { id: "clear", title: "Clear one small surface", time: "5-10 minutes" },
  { id: "tomorrow", title: "Note tomorrow's most important task", time: "2 minutes" },
  { id: "stop", title: "Give myself permission to stop", time: "Rest counts" }
];

const defaultCategories = {
  photography: ["Go out for a short photography trip", "Edit five photographs", "Practise ICM or multiple exposure", "Review images from the last outing", "Watch one photography lesson"],
  decluttering: ["Declutter one drawer", "Sort one shelf", "Fill one charity bag", "Sort one small box", "Clear one visible surface"],
  vinted: ["Choose three items to sell", "Photograph three items", "Write one listing", "Publish prepared listings", "Answer messages"],
  admin: ["Sort one paperwork pile", "File five documents", "Reply to one important email", "Unsubscribe from unwanted emails", "Check one bill or appointment"],
  house: ["Bathroom: one small decorating job", "Kitchen: clear one area", "Living room: tidy one zone", "Office room: clear one work area", "Front shed: sort one box"]
};

const categoryNames = {
  photography: "Photography",
  decluttering: "Decluttering",
  vinted: "Vinted",
  admin: "Admin",
  house: "House"
};

const choicePools = {
  normal: ["Edit five photographs.", "Sort one drawer or shelf.", "Photograph three Vinted items.", "Deal with one important email or letter.", "Clear one small visible area.", "Take a short photo walk."],
  low: ["Delete ten unwanted photographs.", "Put away five things.", "Unsubscribe from three unwanted emails.", "Choose one Vinted item to list later.", "Make a drink and note tomorrow's first task."],
  quick: ["Clear one chair or small surface.", "File or shred five pieces of paper.", "Edit one photograph.", "Choose one item for Vinted.", "Set a 10-minute timer and tidy."]
};

function normaliseLegacyShape(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...source,
    todos: source.todos || source.todoItems || source.tasks || [],
    projects: source.projects || source.projectItems || [],
    annualDates: source.annualDates || source.birthdays || source.annualReminders || [],
    cleaningTasks: source.cleaningTasks || source.cleaning || source.cleaningJobs || source.householdTasks || [],
    appointments: source.appointments || source.events || [],
    customLists: Array.isArray(source.customLists) ? source.customLists : []
  };
}

function scoreData(candidate = {}) {
  const shaped = normaliseLegacyShape(candidate);
  return [shaped.todos, shaped.projects, shaped.annualDates, shaped.cleaningTasks, shaped.appointments]
    .reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

function mergeUniqueLists(candidates, field) {
  const result = [];
  const seen = new Set();
  candidates.forEach(candidate => {
    const shaped = normaliseLegacyShape(candidate.value);
    (shaped[field] || []).forEach(item => {
      const signature = item.id || `${item.name || item.title || ""}|${item.dueDate || item.nextDue || item.monthDay || ""}`;
      if (!seen.has(signature)) { seen.add(signature); result.push(item); }
    });
  });
  return result;
}

function addCandidate(candidates, key, priority, value) {
  if (!value || typeof value !== "object") return;
  const shaped = normaliseLegacyShape(value);
  if (scoreData(shaped) || key === "lifePlannerData") {
    candidates.push({ key, priority, value: normaliseData(shaped) });
  }
}

function getData() {
  const keys = ["lifePlannerData", "lifePlannerDataV9", "lifePlannerDataV8A", "lifePlannerDataV8", "lifePlannerDataV7", "lifePlannerDataV6", "lifePlannerDataV5", "lifePlannerDataV4", "lifePlannerDataV3"];
  const candidates = [];
  keys.forEach((key, priority) => {
    const saved = localStorage.getItem(key);
    if (!saved) return;
    try { addCandidate(candidates, key, priority, JSON.parse(saved)); }
    catch (error) { console.warn("Could not read", key, error); }
  });

  // One-time v9.4 rescue pass: inspect safety copies and daily snapshots so a list
  // missed by an earlier migration can be recovered rather than silently lost.
  if (!localStorage.getItem("lifePlannerMigrationV93Done")) {
    try {
      const safety = JSON.parse(localStorage.getItem("lifePlannerMigrationSafety") || "null");
      if (safety?.data) addCandidate(candidates, "migrationSafety", 20, safety.data);
    } catch {}
    ["lifePlannerDailyBackups", "lifePlannerDailyBackupsV9"].forEach((key, keyIndex) => {
      try {
        const copies = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(copies)) copies.forEach((copy, index) => {
          let snapshot = copy?.data;
          if (typeof snapshot === "string") { try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; } }
          if (snapshot) addCandidate(candidates, `${key}:${copy.date || index}`, 30 + keyIndex, snapshot);
        });
      } catch {}
    });
  }

  if (!candidates.length) return normaliseData({});
  candidates.sort((a,b) => a.priority-b.priority);
  const preferred = candidates[0].value;
  const merged = normaliseData({
    ...preferred,
    todos: mergeUniqueLists(candidates,"todos"),
    projects: mergeUniqueLists(candidates,"projects"),
    annualDates: mergeUniqueLists(candidates,"annualDates"),
    cleaningTasks: mergeUniqueLists(candidates,"cleaningTasks"),
    appointments: mergeUniqueLists(candidates,"appointments"),
    inbox: mergeUniqueLists(candidates,"inbox"),
    waiting: mergeUniqueLists(candidates,"waiting"),
    customLists: mergeUniqueLists(candidates,"customLists")
  });
  try {
    localStorage.setItem("lifePlannerMigrationSafety", JSON.stringify({savedAt:new Date().toISOString(), sourceKeys:candidates.map(x=>x.key), data:merged}));
    localStorage.setItem("lifePlannerData", JSON.stringify(merged));
    localStorage.setItem("lifePlannerMigrationV93Done", new Date().toISOString());
  } catch {}
  return merged;
}

let data = getData();

const DATA_KEY = "lifePlannerData";
const LEGACY_DATA_KEYS = ["lifePlannerDataV9","lifePlannerDataV8A","lifePlannerDataV8","lifePlannerDataV7","lifePlannerDataV6","lifePlannerDataV5","lifePlannerDataV4","lifePlannerDataV3"];
const RECOVERY_KEY = "lifePlannerDailyBackups";
const LEGACY_RECOVERY_KEYS = ["lifePlannerDailyBackupsV9"];
const SETTINGS_KEY = "lifePlannerSettings";
const LEGACY_SETTINGS_KEYS = ["lifePlannerSettingsV9","lifePlannerSettingsV8","lifePlannerSettingsV7"];
const APP_VERSION = "47";
const DATABASE_VERSION = "1";
const MODULE_VERSIONS = Object.freeze({
  brainCapture: "2.1",
  attachments: "1.1",
  appointments: "2.0",
  quickActions: "1.0"
});
let saveIndicatorTimer = null;

function normaliseData(loaded = {}) {
  return {
    todos: Array.isArray(loaded.todos) ? loaded.todos : [],
    projects: Array.isArray(loaded.projects) ? loaded.projects : [],
    annualDates: Array.isArray(loaded.annualDates) ? loaded.annualDates : [],
    cleaningTasks: Array.isArray(loaded.cleaningTasks) ? loaded.cleaningTasks : Array.isArray(loaded.cleaning) ? loaded.cleaning : Array.isArray(loaded.cleaningJobs) ? loaded.cleaningJobs : [],
    appointments: Array.isArray(loaded.appointments) ? loaded.appointments : [],
    inbox: Array.isArray(loaded.inbox) ? loaded.inbox : [],
    waiting: Array.isArray(loaded.waiting) ? loaded.waiting : [],
    customLists: Array.isArray(loaded.customLists) ? loaded.customLists.map(list => ({...list, items:Array.isArray(list.items)?list.items:[]})) : [],
    dailyTasks: Array.isArray(loaded.dailyTasks) ? loaded.dailyTasks : JSON.parse(JSON.stringify(dailyTasks)),
    eveningTasks: Array.isArray(loaded.eveningTasks) ? loaded.eveningTasks : JSON.parse(JSON.stringify(eveningTasks)),
    categoryTasks: loaded.categoryTasks && typeof loaded.categoryTasks === "object"
      ? loaded.categoryTasks : JSON.parse(JSON.stringify(defaultCategories))
  };
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function collectChecks() {
  return Object.fromEntries(
    Object.keys(localStorage)
      .filter(key => key.startsWith("lifePlanner:"))
      .map(key => [key, localStorage.getItem(key)])
  );
}

function createRecoveryCopy(serialised) {
  try {
    const today = localDateKey();
    let rawRecovery = localStorage.getItem(RECOVERY_KEY);
    if (!rawRecovery) { for (const key of LEGACY_RECOVERY_KEYS) { rawRecovery = localStorage.getItem(key); if (rawRecovery) break; } }
    let copies = JSON.parse(rawRecovery || "[]");
    if (!Array.isArray(copies)) copies = [];
    const snapshot = {
      date: today,
      savedAt: new Date().toISOString(),
      data: serialised,
      checks: collectChecks(),
      settings: getSettings()
    };
    const existing = copies.findIndex(copy => copy.date === today);
    if (existing >= 0) copies[existing] = snapshot;
    else copies.push(snapshot);
    copies.sort((a,b) => String(b.date).localeCompare(String(a.date)));
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(copies.slice(0, 5)));
  } catch (error) {
    console.warn("Could not create daily backup", error);
  }
}

function showSaved(message = "Saved on this device") {
  const indicator = document.getElementById("saveIndicator");
  if (!indicator) return;
  indicator.textContent = message;
  indicator.classList.add("saved");
  clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(() => indicator.classList.remove("saved"), 1800);
}

function saveData() {
  try {
    data = normaliseData(data);
    const serialised = JSON.stringify(data);
    createRecoveryCopy(serialised);
    localStorage.setItem(DATA_KEY, serialised);
    updateStorageStatus();
    showSaved();
  } catch (error) {
    console.error("Could not save planner data", error);
    const indicator = document.getElementById("saveIndicator");
    if (indicator) indicator.textContent = "Save failed — export a backup";
    alert("The planner could not save. Please use Export backup and check that Safari is not in Private Browsing.");
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function storageKey(group, id) {
  return `lifePlanner:${group}:${id}`;
}

function dateOnly(value) {
  if (!value) return null;
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, includeYear = true) {
  const date = dateOnly(value);
  if (!date) return "";
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  const day = String(date.getDate()).padStart(2,"0");
  const month = String(date.getMonth()+1).padStart(2,"0");
  const year = String(date.getFullYear()).slice(-2);
  return includeYear ? `${weekday} ${day}-${month}-${year}` : `${weekday} ${day}-${month}`;
}

function daysBetween(from, to) {
  const day = 86400000;
  return Math.ceil((to - from) / day);
}

function nextAnnualOccurrence(monthDay) {
  if (!monthDay) return null;
  const [month, day] = monthDay.split("-").map(Number);
  const today = new Date();
  today.setHours(12,0,0,0);
  let result = new Date(today.getFullYear(), month - 1, day, 12);
  if (result < today) result = new Date(today.getFullYear() + 1, month - 1, day, 12);
  return result;
}

function getTimingText(item) {
  if (item.timingType === "ongoing") return "Ongoing";
  if (item.dueDate) return `Due ${formatDate(item.dueDate)}`;
  return "No deadline";
}

function getBadge(item) {
  if (item.timingType === "ongoing") return { text: "Ongoing", cls: "ongoing" };
  if (!item.dueDate) return { text: "No date", cls: "" };
  const today = new Date(); today.setHours(12,0,0,0);
  const days = daysBetween(today, dateOnly(item.dueDate));
  if (days < 0) return { text: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, cls: "overdue" };
  if (days === 0) return { text: "Due today", cls: "due" };
  return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, cls: "due" };
}

function createTaskRow(task, group, editable = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "editable-task";

  const label = document.createElement("label");
  label.className = "task-row";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = localStorage.getItem(storageKey(group, task.id)) === "true";
  const copy = document.createElement("span");
  copy.className = "task-copy";
  copy.innerHTML = `<span class="task-title">${escapeHtml(task.title)}</span><span class="task-time">${escapeHtml(task.time || "")}</span>`;
  label.append(checkbox, copy);

  function refresh() { label.classList.toggle("completed", checkbox.checked); }
  checkbox.addEventListener("change", () => {
    localStorage.setItem(storageKey(group, task.id), checkbox.checked);
    refresh();
    updateProgress();
  });
  refresh();
  wrapper.appendChild(label);

  if (editable) {
    const actions = document.createElement("div");
    actions.className = "mini-actions";
    actions.innerHTML = `
      <button type="button" class="small-button" onclick="editRoutineTask('${group}','${task.id}')">Edit</button>
      <button type="button" class="small-button danger-button" onclick="deleteRoutineTask('${group}','${task.id}')">Delete</button>`;
    wrapper.appendChild(actions);
  }
  return wrapper;
}

function renderChecklist(containerId, tasks, group, editable = false) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state">No tasks yet. Use Add task.</div>`;
    return;
  }
  tasks.forEach(task => container.appendChild(createTaskRow(task, group, editable)));
}

function updateProgress() {
  const routineChecks = [...document.querySelectorAll("#dailyChecklist input, #eveningChecklist input")];
  const routineCompleted = routineChecks.filter(item => item.checked).length;
  const todos = Array.isArray(data.todos) ? data.todos : [];
  const completed = routineCompleted + todos.filter(item => item.completed).length;
  const total = routineChecks.length + todos.length;
  const percent = total ? Math.round(completed / total * 100) : 0;
  const bar = document.getElementById("progressBar");
  const text = document.getElementById("progressText");
  if (bar) bar.style.width = `${percent}%`;
  if (text) text.textContent = `${completed} of ${total}`;
}

function setDate() {
  document.getElementById("todayDate").textContent = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

function resetDailyTasks() {
  if (!confirm("Untick all Daily Rhythm and evening tasks for today?")) return;
  [...data.dailyTasks, ...data.eveningTasks].forEach(task => localStorage.removeItem(storageKey("daily", task.id)));
  renderAll();
  showSaved("Today reset");
}

function savedChoiceItems() {
  return [
    ...data.todos.filter(x => !x.completed).map(x => x.name),
    ...data.projects.filter(x => !x.completed).map(x => x.name),
    ...data.projects.flatMap(p => p.steps.filter(s => !s.completed).map(s => s.name)),
    ...Object.values(data.categoryTasks || {}).flat(),
    ...data.cleaningTasks.filter(x => isDueTodayOrEarlier(x.nextDue)).map(x => x.name)
  ].filter(Boolean);
}

function chooseFrom(poolName) {
  const pool = [...new Set(savedChoiceItems().filter(Boolean))];
  const card = document.getElementById("choiceCard");
  if (!pool.length) { card.textContent = "There are no available saved tasks yet. Add one to a list first."; return; }
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(3, pool.length));
  card.innerHTML = `<ol class="choice-list">${shuffled.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol><button type="button" class="small-button" onclick="chooseFrom('${poolName}')">Give me three different saved tasks</button>`;
}

function chooseForMe() { chooseFrom("normal"); }
function chooseLowEnergy() { chooseFrom("low"); }
function chooseQuickWin() { chooseFrom("quick"); }

let lastHelpfulChoiceKey = '';
function helpfulCandidates(mode='extra') {
  const items = [
    ...data.todos.filter(x=>!x.completed).map(x=>({key:`todo:${x.id}`,label:x.name,detail:x.dueDate?getTimingText(x):'To-do',open:()=>editTodo(x.id),priority:x.dueDate?0:3})),
    ...data.projects.filter(x=>!x.completed).flatMap(p=>{
      const s=(p.steps||[]).find(x=>!x.completed);
      return s?[{key:`step:${p.id}:${s.id}`,label:s.name,detail:`Project: ${p.name}`,open:()=>editStep(p.id,s.id),priority:s.dueDate?0:2}]:[{key:`project:${p.id}`,label:`Review ${p.name}`,detail:'Project without a next step',open:()=>editProject(p.id),priority:4}];
    }),
    ...data.cleaningTasks.filter(x=>!x.completed).map(x=>({key:`clean:${x.id}`,label:x.name,detail:`Cleaning · ${x.room||'Home'}`,open:()=>editCleaning(x.id),priority:isDueTodayOrEarlier(x.nextDue)?0:5}))
  ];
  let pool=items.filter(x=>x.key!==lastHelpfulChoiceKey);
  if(!pool.length) pool=items;
  if(mode==='useful') pool=pool.sort((a,b)=>a.priority-b.priority).slice(0,Math.max(3,Math.ceil(pool.length/2)));
  if(mode==='extra') pool=pool.filter(x=>x.priority>=2 || !x.detail.includes('Project')) || pool;
  return pool;
}
function chooseHelpfulTask(mode='extra'){
  const result=document.getElementById('helpfulChoiceResult')||document.getElementById('dailyDecisionResult');
  const pool=helpfulCandidates(mode);
  if(!pool.length){result.classList.remove('hidden');result.textContent='Add a to-do, project, cleaning task or routine item first.';return;}
  const item=pool[Math.floor(Math.random()*pool.length)]; lastHelpfulChoiceKey=item.key;
  result.classList.remove('hidden');result.innerHTML=`<strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span>${item.open?'<button type="button" class="small-button" id="helpfulOpenButton">Open</button>':''}`;
  if(item.open) document.getElementById('helpfulOpenButton').onclick=item.open;
}
function decideDailyTask(){ chooseHelpfulTask('extra'); }


function showCategory(categoryKey) {
  const area = document.getElementById("categoryArea");
  area.innerHTML = `<h3>${categoryNames[categoryKey]}</h3>`;
  const list = document.createElement("div");
  list.className = "checklist";
  (data.categoryTasks[categoryKey] || []).forEach((taskText, index) => {
    list.appendChild(createTaskRow({ id: `${categoryKey}-${index}`, title: taskText, time: "Tick when completed" }, `category:${categoryKey}`));
  });
  area.appendChild(list);
}




function togglePanel(areaId, buttonId) {
  const area = document.getElementById(areaId);
  const button = document.getElementById(buttonId);
  if (!area || !button) return;
  const hidden = area.classList.toggle("collapsed-content");
  button.textContent = hidden ? "Show" : "Hide";
  localStorage.setItem(`lifePlannerPanel:${areaId}`, hidden ? "hidden" : "shown");
}

function restorePanelStates() {
  [["todayRemindersArea","todayToggle"],["weeklyArea","weekToggle"]].forEach(([areaId,buttonId]) => {
    const hidden = localStorage.getItem(`lifePlannerPanel:${areaId}`) === "hidden";
    const area = document.getElementById(areaId);
    const button = document.getElementById(buttonId);
    if (area) area.classList.toggle("collapsed-content", hidden);
    if (button) button.textContent = hidden ? "Show" : "Hide";
  });
}

let managedRoutineGroup = "daily";
const routineManagerDialog = document.getElementById("routineManagerDialog");

function openRoutineManager(group) {
  managedRoutineGroup = group;
  document.getElementById("routineManagerTitle").textContent = group === "evening" ? "Manage Gentle close-down" : "Manage Daily rhythm";
  document.getElementById("routineNewName").value = "";
  document.getElementById("routineNewTime").value = "";
  renderRoutineManager();
  routineManagerDialog.showModal();
}

function closeRoutineManager() { routineManagerDialog.close(); }

function renderRoutineManager() {
  const area = document.getElementById("routineManagerList");
  const list = routineList(managedRoutineGroup);
  area.innerHTML = "";
  if (!list.length) {
    area.innerHTML = '<div class="empty-state">No items yet. Add one below.</div>';
    return;
  }
  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "manager-row";
    row.innerHTML = `<div><strong>${escapeHtml(item.title)}</strong>${item.time ? `<div class="card-meta">${escapeHtml(item.time)}</div>` : ""}</div>
      <div class="mini-actions">
        <button type="button" class="small-button" onclick="editRoutineInManager('${item.id}')">Edit</button>
        <button type="button" class="small-button danger-button" onclick="deleteRoutineInManager('${item.id}')">Delete</button>
      </div>`;
    area.appendChild(row);
  });
}

function addRoutineFromManager() {
  const nameInput = document.getElementById("routineNewName");
  const timeInput = document.getElementById("routineNewTime");
  const title = nameInput.value.trim();
  if (!title) { nameInput.focus(); return; }
  routineList(managedRoutineGroup).push({ id: uid(), title, time: timeInput.value.trim() });
  saveData();
  nameInput.value = "";
  timeInput.value = "";
  renderRoutineManager();
  renderAll();
}

function editRoutineInManager(id) {
  const item = routineList(managedRoutineGroup).find(x => x.id === id);
  if (!item) return;
  const title = prompt("Edit item", item.title);
  if (title === null || !title.trim()) return;
  const note = prompt("Edit note or time", item.time || "");
  if (note === null) return;
  item.title = title.trim();
  item.time = note.trim();
  saveData();
  renderRoutineManager();
  renderAll();
}

function deleteRoutineInManager(id) {
  const item = routineList(managedRoutineGroup).find(x => x.id === id);
  if (!item || !confirm(`Delete "${item.title}"?`)) return;
  if (managedRoutineGroup === "evening") data.eveningTasks = data.eveningTasks.filter(x => x.id !== id);
  else data.dailyTasks = data.dailyTasks.filter(x => x.id !== id);
  localStorage.removeItem(storageKey("daily", id));
  saveData();
  renderRoutineManager();
  renderAll();
}

function routineList(group) {
  return group === "evening" ? data.eveningTasks : data.dailyTasks;
}

function editRoutineTask(group, id) {
  const item = routineList(group).find(x => x.id === id);
  if (!item) return;
  clearForm();
  itemType.value = group;
  document.getElementById("editingId").value = item.id;
  document.getElementById("itemName").value = item.title || "";
  document.getElementById("itemDetails").value = item.time || "";
  document.getElementById("dialogTitle").textContent = group === "evening" ? "Edit evening task" : "Edit daily task";
  updateFormVisibility();
  dialog.showModal();
}

function deleteRoutineTask(group, id) {
  const list = routineList(group);
  const item = list.find(x => x.id === id);
  if (!item) return;
  if (!confirm(`Delete "${item.title}"?`)) return;
  if (group === "evening") data.eveningTasks = list.filter(x => x.id !== id);
  else data.dailyTasks = list.filter(x => x.id !== id);
  localStorage.removeItem(storageKey("daily", id));
  saveData();
  renderAll();
}

function updateStorageStatus() {
  const status = document.getElementById("storageStatus");
  if (!status) return;
  const saved = localStorage.getItem(DATA_KEY) || LEGACY_DATA_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
  let recoveries = 0;
  try { recoveries = JSON.parse(localStorage.getItem(RECOVERY_KEY) || "[]").length; } catch {}
  status.textContent = saved
    ? `Saved privately on this device (${Math.max(1, Math.round(new Blob([saved]).size / 1024))} KB) · ${recoveries} daily backup${recoveries === 1 ? "" : "s"}.`
    : "No planner information has been saved yet.";
}

function exportPlanner() {
  saveData();
  const backup = {
    app: "My Life Planner",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    checks: collectChecks(),
    settings: getSettings()
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `my-life-planner-backup-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function sharePlannerBackup() {
  saveData();
  const backup = {
    app: "My Life Planner",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    checks: collectChecks(),
    settings: getSettings()
  };
  const file = new File([JSON.stringify(backup, null, 2)],
    `my-life-planner-backup-${new Date().toISOString().slice(0,10)}.json`,
    { type: "application/json" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: "My Life Planner backup", text: "A backup of my planner information.", files: [file] });
      showSaved("Backup shared");
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  exportPlanner();
}

function getDailyBackups() {
  try {
    const copies = JSON.parse(localStorage.getItem(RECOVERY_KEY) || "[]");
    return Array.isArray(copies) ? copies : [];
  } catch { return []; }
}

function renderDailyBackups() {
  const area = document.getElementById("dailyBackupsArea");
  if (!area) return;
  const copies = getDailyBackups();
  area.innerHTML = "";
  if (!copies.length) {
    area.innerHTML = '<div class="empty-state">Your first dated backup will appear after the planner saves.</div>';
    return;
  }
  copies.forEach(copy => {
    const row = document.createElement("div");
    row.className = "backup-row";
    const date = new Date(`${copy.date}T12:00:00`).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
    const time = new Date(copy.savedAt).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
    row.innerHTML = `<div><strong>${escapeHtml(date)}</strong><div class="card-meta">Latest save at ${escapeHtml(time)}</div></div><button type="button" class="small-button">Restore</button>`;
    row.querySelector("button").addEventListener("click", () => restoreDailyBackup(copy.date));
    area.appendChild(row);
  });
}

function restoreDailyBackup(dateKey) {
  const copy = getDailyBackups().find(item => item.date === dateKey);
  if (!copy) return alert("That daily backup is no longer available.");
  const label = new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });
  if (!confirm(`Restore the backup from ${label}? A safety copy of your current planner will be made first.`)) return;
  try {
    createRecoveryCopy(JSON.stringify(data));
    data = normaliseData(JSON.parse(copy.data));
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    Object.entries(copy.checks || {}).forEach(([key,value]) => localStorage.setItem(key,value));
    if (copy.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(copy.settings));
    applySettings();
    renderAll();
    showSaved("Daily backup restored");
  } catch { alert("That daily backup could not be restored."); }
}

function restoreLatestRecovery() {
  const latest = getDailyBackups()[0];
  if (!latest) return alert("There is no daily backup available yet.");
  restoreDailyBackup(latest.date);
}

function importPlanner(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      const imported = backup.data || backup;
      if (!imported || typeof imported !== "object") throw new Error("Invalid backup");
      data = normaliseData(imported);
      Object.entries(backup.checks || {}).forEach(([key, value]) => localStorage.setItem(key, value));
      if (backup.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(backup.settings));
      applySettings();
      saveData();
      renderAll();
      alert("Planner backup imported successfully.");
    } catch (error) {
      alert("That file is not a valid My Life Planner backup.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.getElementById("installButton")?.classList.remove("hidden");
});

async function installPlanner() {
  if (!deferredInstallPrompt) {
    alert("On iPhone or iPad, open the Share menu and choose Add to Home Screen. On Android, use the browser menu and choose Install app.");
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  const installButton = document.getElementById("installButton");
  if (installButton) installButton.textContent = "Install app";
}

function frequencyLabel(value) {
  return {
    daily: "Daily",
    weekly: "Weekly",
    fortnightly: "Every two weeks",
    monthly: "Monthly"
  }[value] || value;
}

function nextCleaningDate(currentDate, frequency) {
  const base = currentDate ? dateOnly(currentDate) : new Date();
  const next = new Date(base);
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "fortnightly") next.setDate(next.getDate() + 14);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

function isDueTodayOrEarlier(value) {
  if (!value) return false;
  const today = new Date();
  today.setHours(12,0,0,0);
  return dateOnly(value) <= today;
}

function openCleaningDialog() {
  openAddDialog("cleaning");
}


function deleteCleaning(id) {
  data.cleaningTasks = data.cleaningTasks.filter(item => item.id !== id);
  saveData();
  renderAll();
}

function editCleaning(id) {
  const item = data.cleaningTasks.find(x => x.id === id);
  if (!item) return;
  clearForm();
  itemType.value = "cleaning";
  document.getElementById("editingId").value = item.id;
  document.getElementById("itemName").value = item.name || "";
  document.getElementById("itemDetails").value = item.details || "";
  document.getElementById("cleaningRoom").value = item.room || "";
  document.getElementById("cleaningFrequency").value = item.frequency || "weekly";
  document.getElementById("cleaningStartDate").value = item.nextDue || "";
  document.getElementById("dialogTitle").textContent = "Edit cleaning task";
  updateFormVisibility();
  dialog.showModal();
}

function renderCleaningToday() {
  const area = document.getElementById("cleaningTodayArea");
  if (!area) return;
  const items = getWeeklyItems().filter(item => !item.annual && item.itemType !== "annual");
  area.innerHTML = "";
  if (!items.length) { area.innerHTML = `<div class="empty-state">No actionable tasks are due within the next week.</div>`; return; }
  items.forEach(item => {
    let onComplete = null;
    if (item.itemType === "cleaning") onComplete = () => completeCleaning(item.id);
    if (item.itemType === "todo") onComplete = () => toggleTodo(item.id);
    if (item.itemType === "project") onComplete = () => toggleProject(item.id);
    if (item.itemType === "step") onComplete = () => toggleStep(item.parentId,item.id);
    const meta = `${item.source} · ${getTimingText(item)}`;
    area.appendChild(compactReminderRow(item,{meta,actionable:true,onComplete,clickable:true}));
  });
}





function annualStatus(item) {
  const occurrence = nextAnnualOccurrence(item.monthDay);
  if (!occurrence) return null;

  const today = new Date();
  today.setHours(12,0,0,0);
  const days = daysBetween(today, occurrence);
  const reminderDays = Number(item.reminderDays || 7);

  return {
    occurrence,
    days,
    reminderDays,
    isToday: days === 0,
    inReminderWindow: days >= 0 && days <= reminderDays
  };
}




function compactReminderRow(item, options = {}) {
  const row = document.createElement("div");
  const overdue = item.dueDate && dateOnly(item.dueDate) < new Date(new Date().setHours(0,0,0,0));
  row.className = `compact-reminder-row${options.clickable ? " clickable-reminder" : ""}${overdue ? " overdue-row" : ""}`;
  const actionable = options.actionable;
  const icon = item.itemType === "annual" ? "🎂" : "";
  const control = actionable ? `<input type="checkbox" aria-label="Complete ${escapeHtml(item.name)}">` : `<span class="compact-icon">${icon}</span>`;
  row.innerHTML = `${control}<div class="compact-copy"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(options.meta || "")}</span></div>${options.badge ? `<span class="compact-badge">${escapeHtml(options.badge)}</span>` : ""}`;
  if (actionable) row.querySelector("input").addEventListener("change", event => { event.stopPropagation(); options.onComplete?.(); });
  if (options.clickable) {
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `Open ${item.name}`);
    row.addEventListener("click", event => { if (event.target.matches('input,button')) return; openReminderItem(item); });
    row.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openReminderItem(item); } });
  }
  return row;
}


function renderMainOverview() {
  const area = document.getElementById("mainOverviewArea");
  area.innerHTML = `
    <div class="overview-card"><strong>To-do items</strong><span class="overview-number">${data.todos.length}</span></div>
    <div class="overview-card"><strong>Projects</strong><span class="overview-number">${data.projects.length}</span></div>
    <div class="overview-card"><strong>Annual dates</strong><span class="overview-number">${data.annualDates.length}</span></div>
    <div class="overview-card"><strong>Cleaning tasks</strong><span class="overview-number">${data.cleaningTasks.length}</span></div>
    <div class="overview-card"><strong>Thoughts</strong><span class="overview-number">${data.inbox.length}</span></div>
    <div class="overview-card"><strong>Waiting For</strong><span class="overview-number">${data.waiting.length}</span></div>
  `;
}





function sortByDueDate(a,b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return dateOnly(a.dueDate) - dateOnly(b.dueDate);
}

function toggleTodo(id) { const item=data.todos.find(x=>x.id===id); if(item)item.completed=!item.completed; saveData(); renderAll(); }
function deleteTodo(id) { data.todos=data.todos.filter(x=>x.id!==id); saveData(); renderAll(); }
function toggleProject(id) { const item=data.projects.find(x=>x.id===id); if(item)item.completed=!item.completed; saveData(); renderAll(); }
function deleteProject(id) { data.projects=data.projects.filter(x=>x.id!==id); saveData(); renderAll(); }
function deleteAnnual(id) { data.annualDates=data.annualDates.filter(x=>x.id!==id); saveData(); renderAll(); }


function deleteStep(projectId,stepId) {
  const project=data.projects.find(x=>x.id===projectId);
  if(project) project.steps=project.steps.filter(x=>x.id!==stepId);
  saveData(); renderAll();
}

const dialog=document.getElementById("addDialog");
const addForm=document.getElementById("addForm");
const itemType=document.getElementById("itemType");
const timingType=document.getElementById("timingType");

function clearForm() {
  loadStepBuilder("projectStepsBuilder",[]); loadStepBuilder("itemStepsBuilder",[]);
  addForm.reset();
  document.getElementById("editingId").value="";
  document.getElementById("editingParentId").value="";
  document.getElementById("monthsCount").value=3;
  document.getElementById("leadDays").value=7;
  document.getElementById("annualReminderDays").value=7;
  document.getElementById("cleaningFrequency").value="weekly";
  document.getElementById("cleaningStartDate").value=new Date().toISOString().slice(0,10);
  const itemSteps=document.getElementById("itemSteps"); if(itemSteps)itemSteps.value="";
}

function openAddDialog(type="todo",projectId="") {
  clearForm();
  itemType.value=type;
  document.getElementById("editingParentId").value=projectId;
  populateProjectPicker(projectId);
  document.getElementById("dialogTitle").textContent="New item";
  updateFormVisibility();
  dialog.showModal();
  document.getElementById("itemName").focus();
}

function openAnnualDialog() { openAddDialog("annual"); }
function closeAddDialog() { dialog.close(); }

function populateProjectPicker(selectedId="") {
  const picker = document.getElementById("projectPicker");
  const projects = Array.isArray(data.projects) ? data.projects : [];
  if (!projects.length) {
    picker.innerHTML = `<option value="">No projects available — add a project first</option>`;
    picker.disabled = true;
    return;
  }
  picker.disabled = false;
  picker.innerHTML = projects
    .map(p=>`<option value="${p.id}">${escapeHtml(p.name)}${p.completed ? " (completed)" : ""}</option>`).join("");
  if (selectedId && projects.some(p => p.id === selectedId)) picker.value = selectedId;
}

function updateFormVisibility() {
  const type=itemType.value;
  const timing=timingType.value;
  const routine = type === "daily" || type === "evening";
  document.getElementById("projectPickerLabel").classList.toggle("hidden",type!=="step");
  document.getElementById("projectStepsLabel").classList.toggle("hidden",type!=="project");
  document.getElementById("itemStepsLabel")?.classList.toggle("hidden",!["todo","cleaning","annual"].includes(type));
  document.getElementById("cleaningAreaLabel").classList.toggle("hidden",type!=="cleaning");
  document.getElementById("cleaningFrequencyLabel").classList.toggle("hidden",type!=="cleaning");
  document.getElementById("cleaningStartLabel").classList.toggle("hidden",type!=="cleaning");
  document.getElementById("annualDateLabel").classList.toggle("hidden",type!=="annual");
  document.getElementById("annualReminderLabel").classList.toggle("hidden",type!=="annual");
  document.getElementById("dateLabel").classList.toggle("hidden",timing!=="date" || type==="annual" || routine);
  document.getElementById("monthsLabel").classList.toggle("hidden",timing!=="months" || type==="annual" || routine);
  document.getElementById("leadLabel").classList.toggle("hidden",!(["date","months"].includes(timing)) || type==="annual" || routine);
  timingType.closest("label").classList.toggle("hidden",type==="annual" || type==="cleaning" || routine);
  document.getElementById("detailsLabel").querySelector("textarea").placeholder =
    routine ? "For example: 10 minutes, after breakfast, or any helpful note" : "Notes, contact details, what needs doing...";
}

itemType.addEventListener("change",()=>{
  if (itemType.value === "step") populateProjectPicker(document.getElementById("editingParentId").value);
  updateFormVisibility();
});
timingType.addEventListener("change",updateFormVisibility);

function loadCommon(item,type,parentId="") {
  clearForm();
  itemType.value=type;
  document.getElementById("editingId").value=item.id;
  document.getElementById("editingParentId").value=parentId;
  document.getElementById("itemName").value=item.name || "";
  document.getElementById("itemDetails").value=item.details || "";
  if (type === "project") loadStepBuilder("projectStepsBuilder", item.steps || []);
  if (["todo","cleaning","annual"].includes(type)) loadStepBuilder("itemStepsBuilder", item.steps || []);
  timingType.value=item.timingType || (item.dueDate ? "date" : "none");
  document.getElementById("dueDate").value=item.dueDate || "";
  document.getElementById("leadDays").value=item.leadDays ?? 7;
  populateProjectPicker();
  if(parentId) document.getElementById("projectPicker").value=parentId;
  document.getElementById("dialogTitle").textContent="Edit item";
  updateFormVisibility();
  dialog.showModal();
}

function editTodo(id) { const item=data.todos.find(x=>x.id===id); if(item)loadCommon(item,"todo"); }
function editProject(id) { const item=data.projects.find(x=>x.id===id); if(item)loadCommon(item,"project"); }
function editStep(projectId,stepId) {
  const project=data.projects.find(x=>x.id===projectId);
  const item=project?.steps.find(x=>x.id===stepId);
  if(item)loadCommon(item,"step",projectId);
}
function editAnnual(id) {
  const item=data.annualDates.find(x=>x.id===id);
  if(!item)return;
  clearForm();
  itemType.value="annual";
  document.getElementById("editingId").value=item.id;
  document.getElementById("itemName").value=item.name || "";
  document.getElementById("itemDetails").value=item.details || "";
  document.getElementById("annualDate").value=`2000-${item.monthDay}`;
  document.getElementById("annualReminderDays").value=item.reminderDays ?? 7;
  document.getElementById("dialogTitle").textContent="Edit annual date";
  updateFormVisibility();
  dialog.showModal();
}

addForm.addEventListener("submit",event=>{
  event.preventDefault();
  const type=itemType.value;
  const id=document.getElementById("editingId").value;
  const parentId=document.getElementById("editingParentId").value || document.getElementById("projectPicker").value;
  const name=document.getElementById("itemName").value.trim();
  const details=document.getElementById("itemDetails").value.trim();
  const timing=timingType.value;
  const leadDays=Number(document.getElementById("leadDays").value || 7);
  syncStepBuilders();
  if(!name)return;

  if(type==="daily" || type==="evening") {
    const list = type === "evening" ? data.eveningTasks : data.dailyTasks;
    const payload = { id: id || uid(), title: name, time: details };
    if (id) list[list.findIndex(x => x.id === id)] = payload;
    else list.push(payload);
    saveData(); closeAddDialog(); renderAll(); refreshListsImmediately(); return;
  }

  if(type==="cleaning") {
    const startDate = document.getElementById("cleaningStartDate").value || new Date().toISOString().slice(0,10);
    const payload = {
      id: id || uid(),
      name,
      details,
      room: document.getElementById("cleaningRoom").value.trim(),
      frequency: document.getElementById("cleaningFrequency").value,
      nextDue: startDate,
      lastCompleted: null,
      steps: mergeEnteredSteps(id?(data.cleaningTasks.find(x=>x.id===id)?.steps||[]):[], parseDatedSteps(document.getElementById("itemSteps")?.value||""), {})
    };
    if(id) {
      const old = data.cleaningTasks.find(x => x.id === id);
      payload.lastCompleted = old?.lastCompleted || null;
      data.cleaningTasks[data.cleaningTasks.findIndex(x => x.id === id)] = payload;
    } else {
      data.cleaningTasks.push(payload);
    }
    saveData(); closeAddDialog(); renderAll(); refreshListsImmediately(); return;
  }

  if(type==="annual") {
    const annualDate=document.getElementById("annualDate").value;
    if(!annualDate)return;
    const monthDay=annualDate.slice(5);
    const oldAnnual=id?data.annualDates.find(x=>x.id===id):null;
    const payload={id:id||uid(),name,details,monthDay,reminderDays:Number(document.getElementById("annualReminderDays").value||7),kind:"Birthday / annual date",steps:mergeEnteredSteps(oldAnnual?.steps||[],parseDatedSteps(document.getElementById("itemSteps")?.value||""),{})};
    if(id) data.annualDates[data.annualDates.findIndex(x=>x.id===id)]=payload;
    else data.annualDates.push(payload);
    saveData(); closeAddDialog(); renderAll(); refreshListsImmediately(); return;
  }

  let dueDate=null;
  if(timing==="date") dueDate=document.getElementById("dueDate").value || null;
  if(timing==="months") {
    const date=new Date();
    date.setMonth(date.getMonth()+Number(document.getElementById("monthsCount").value||1));
    dueDate=date.toISOString().slice(0,10);
  }

  const common={id:id||uid(),name,details,timingType:timing,dueDate,leadDays,completed:false};
  const parsedItemSteps = parseDatedSteps(document.getElementById("itemSteps")?.value || "");

  if(type==="todo") {
    if(id) {
      const old=data.todos.find(x=>x.id===id);
      common.completed=old?.completed||false;
      common.steps=mergeEnteredSteps(old?.steps || [], parsedItemSteps, common);
      data.todos[data.todos.findIndex(x=>x.id===id)]=common;
    } else { common.steps=mergeEnteredSteps([], parsedItemSteps, common); data.todos.push(common); }
  }

  if(type==="project") {
    const enteredSteps = parseDatedSteps(document.getElementById("projectSteps").value);
    if(id) {
      const old=data.projects.find(x=>x.id===id);
      const oldSteps = old?.steps || [];
      const steps = enteredSteps.map((entry,index) => {
        const existing = oldSteps[index];
        return existing ? {...existing,name:entry.name,dueDate:entry.dueDate || existing.dueDate || null,order:index} : {id:uid(),name:entry.name,details:"",timingType:entry.dueDate?"date":common.timingType,dueDate:entry.dueDate || common.dueDate,leadDays:entry.leadDays || common.leadDays,completed:false,order:index};
      });
      data.projects[data.projects.findIndex(x=>x.id===id)]={...common,completed:old?.completed||false,steps};
    } else {
      const steps = enteredSteps.map((entry,index) => ({id:uid(),name:entry.name,details:"",timingType:entry.dueDate?"date":common.timingType,dueDate:entry.dueDate || common.dueDate,leadDays:entry.leadDays || common.leadDays,completed:false,order:index}));
      data.projects.push({...common,steps});
    }
  }

  if(type==="step") {
    const project=data.projects.find(x=>x.id===parentId);
    if(project) {
      if(id) {
        const old=project.steps.find(x=>x.id===id);
        project.steps[project.steps.findIndex(x=>x.id===id)]={...common,completed:old?.completed||false};
      } else { project.steps.push({...common,order:project.steps.length}); project.completed=false; }
    }
  }

  if(type==="category") {
    const category=document.getElementById("categoryPicker").value;
    data.categoryTasks[category].push(name);
  }

  saveData(); closeAddDialog(); renderAll(); refreshListsImmediately();
});

function parseDatedSteps(text) {
  return String(text||"").split(/\n/).map(x=>x.trim()).filter(Boolean).map(line=>{
    const parts=line.split("|");
    let raw=parts.length>1?parts.shift().trim():"";
    let name=(parts.length?parts.join("|"):line).trim();
    let leadDays=0;
    const leadMatch=name.match(/\|\s*lead:(\d+)\s*$/);
    if(leadMatch){leadDays=Number(leadMatch[1]);name=name.replace(/\|\s*lead:\d+\s*$/,"").trim();}
    let dueDate=null;
    let m=raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2}|\d{4})$/);
    if(m){let y=m[3]; if(y.length===2)y="20"+y; dueDate=`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;}
    else if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) dueDate=raw;
    else if(parts.length===0) name=line;
    return {name,dueDate,leadDays};
  });
}
function mergeEnteredSteps(oldSteps, entered, defaults={}) {
  return entered.map((entry,index)=>{const old=oldSteps[index]; return old?{...old,name:entry.name,dueDate:entry.dueDate||old.dueDate||null,order:index}:{id:uid(),name:entry.name,dueDate:entry.dueDate||null,details:"",completed:false,order:index,leadDays:entry.leadDays||defaults.leadDays||0,timingType:entry.dueDate?"date":"none"};});
}

function escapeHtml(value) {
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function getSettingsFromAnyKey() {
  const keys = [SETTINGS_KEY, ...LEGACY_SETTINGS_KEYS];
  const candidates = [];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") candidates.push(parsed);
    } catch {}
  }

  if (!candidates.length) return {};

  // Some older releases created a new default settings record while the user's
  // actual colour/font remained in a legacy record. Prefer a genuinely
  // customised value instead of allowing that default record to mask it.
  const customised = candidates.find(item =>
    (item.theme && item.theme !== "sage") ||
    (item.font && item.font !== "clear") ||
    (item.ownerName && String(item.ownerName).trim())
  );

  return customised || candidates[0];
}
function getSettings() {
  const settings = { ownerName:"", theme:"sage", font:"clear", ...getSettingsFromAnyKey() };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  return settings;
}

function openSettingsDialog() {
  setTimeout(refreshBrainShortcutUrl,0);
  document.getElementById("settingsDialog")?.showModal();
  applySettings();
  previewSettings();
  renderDailyBackups();
  updateStorageStatus();
  refreshDeveloperDashboard();
}
function formatStorageBytes(bytes) {
  const value=Number(bytes)||0;
  if(value<1024)return `${value} B`;
  if(value<1024*1024)return `${(value/1024).toFixed(1)} KB`;
  if(value<1024*1024*1024)return `${(value/(1024*1024)).toFixed(1)} MB`;
  return `${(value/(1024*1024*1024)).toFixed(1)} GB`;
}

async function refreshDeveloperDashboard() {
  const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value ?? "—");};
  setText("devPlannerVersion", `v${APP_VERSION}`);
  setText("devCacheVersion", `my-life-planner-v${APP_VERSION}`);
  setText("devManifestVersion", APP_VERSION);
  setText("devDatabaseVersion", DATABASE_VERSION);
  setText("devBrainModule", MODULE_VERSIONS.brainCapture);
  setText("devAttachmentModule", MODULE_VERSIONS.attachments);
  setText("devAppointmentModule", MODULE_VERSIONS.appointments);
  setText("devQuickModule", MODULE_VERSIONS.quickActions);
  setText("devAppointmentsCount", data.appointments.length);
  setText("devTodosCount", data.todos.length);
  setText("devInboxCount", data.inbox.length);
  const backups=getDailyBackups();
  const newest=backups.slice().sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))[0];
  setText("devLastBackup", newest?.savedAt ? new Date(newest.savedAt).toLocaleString("en-GB", {dateStyle:"medium", timeStyle:"short"}) : "No backup yet");
  try {
    const estimate=await navigator.storage?.estimate?.();
    const used=Number(estimate?.usage)||0;
    const quota=Number(estimate?.quota)||0;
    setText("devStorageUsed", formatStorageBytes(used));
    setText("devStorageQuota", quota ? formatStorageBytes(quota) : "Not reported");
  } catch {
    setText("devStorageUsed", "Not reported");
    setText("devStorageQuota", "Not reported");
  }
}

function closeSettingsDialog() { document.getElementById("settingsDialog")?.close(); }
function previewSettings() {
  const theme=document.getElementById("themeChoice")?.value || "sage";
  const font=document.getElementById("fontChoice")?.value || "clear";
  const themePreview=document.getElementById("themePreview");
  const fontPreview=document.getElementById("fontPreview");
  if(themePreview) themePreview.dataset.themePreview=theme;
  if(fontPreview) fontPreview.dataset.fontPreview=font;
  // Preview the selected font across the whole app immediately.
  document.body.dataset.font = font;
}

function applySettings() {
  const settings = getSettings();
  document.body.dataset.theme = settings.theme;
  document.body.dataset.font = settings.font;
  const title = document.getElementById("plannerTitle");
  if (title) title.textContent = settings.ownerName ? `${settings.ownerName}'s Life Planner` : "My Life Planner";
  const owner = document.getElementById("ownerName");
  const theme = document.getElementById("themeChoice");
  const font = document.getElementById("fontChoice");
  if (owner) owner.value = settings.ownerName;
  if (theme) theme.value = settings.theme;
  if (font) font.value = settings.font;
  previewSettings();
}

function saveSettings() {
  const settings = {
    ownerName: document.getElementById("ownerName")?.value.trim() || "",
    theme: document.getElementById("themeChoice")?.value || "sage",
    font: document.getElementById("fontChoice")?.value || "clear"
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings();
  saveData();
  showSaved("Customisation saved");
  closeSettingsDialog();
}

function renderAll() {
  setDate();
  renderChecklist("dailyChecklist",data.dailyTasks,"daily",false);
  renderChecklist("eveningChecklist",data.eveningTasks,"daily",false);
  renderFocusToday();
  renderInbox();
  renderWaiting();
  renderAppointments();
  try { renderTimeline(); } catch (error) {
    console.error("Timeline could not be rendered", error);
    const area=document.getElementById("timelineArea");
    const summary=document.getElementById("timelineSummary");
    if(area) area.innerHTML='<div class="empty-state">Timeline could not be loaded. Your saved lists are unaffected.</div>';
    if(summary) summary.textContent='Timeline unavailable.';
  }
  updateListHubCounts();
  renderProjectNextActions();
  renderTodayReminders();
  renderWeekly();
  renderCleaningToday();
  renderTodos();
  renderAnnualDates();
  renderProjects();
  renderCleaning();
  renderCustomLists();
  renderMainOverview();
  updateProgress();
  updateStorageStatus();
  renderDailyBackups();
  applySettings();
  restorePanelStates();
}


let waitingServiceWorker = null;
let plannerServiceWorkerRegistration = null;

async function checkForAppUpdates() {
  if (!("serviceWorker" in navigator)) {
    alert("App updates are not supported by this browser.");
    return;
  }
  try {
    const registration = plannerServiceWorkerRegistration || await navigator.serviceWorker.getRegistration();
    if (!registration) {
      alert("The app is not installed yet. Use Install app first.");
      return;
    }
    await registration.update();
    if (registration.waiting || waitingServiceWorker) {
      waitingServiceWorker = registration.waiting || waitingServiceWorker;
      if (confirm("An update is available. Apply it now?")) applyAppUpdate();
    } else {
      alert("You already have the latest version.");
    }
  } catch (error) {
    console.error(error);
    alert("The update check could not be completed. Please check your connection and try again.");
  }
}

function applyAppUpdate() {
  if (waitingServiceWorker) waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
  else window.location.reload();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${APP_VERSION}`, { updateViaCache: "none" });
      plannerServiceWorkerRegistration = registration;
      if (registration.waiting) {
        waitingServiceWorker = registration.waiting;
        document.getElementById("updateButton")?.classList.remove("hidden");
        const updateButton=document.getElementById("updateButton"); if(updateButton) updateButton.textContent="Update available";
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            waitingServiceWorker = worker;
            document.getElementById("updateButton")?.classList.remove("hidden");
            const updateButton=document.getElementById("updateButton"); if(updateButton) updateButton.textContent="Update available";
          }
        });
      });
    } catch (error) {
      console.warn("Offline app registration failed", error);
    }
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}

applySettings();
createRecoveryCopy(JSON.stringify(data));
renderAll();


function getCollapsedListSections() {
  try { return JSON.parse(localStorage.getItem('myLifePlannerCollapsedLists') || '{}'); }
  catch (error) { return {}; }
}

function saveCollapsedListSections(state) {
  localStorage.setItem('myLifePlannerCollapsedLists', JSON.stringify(state));
}

function applyListSectionState(section, collapsed) {
  if (!section) return;
  section.classList.toggle('list-section-collapsed', collapsed);
  const toggle = section.querySelector('.list-collapse-toggle');
  const name = section.dataset.listName || 'list';
  if (toggle) {
    toggle.textContent = collapsed ? `Show ${name}` : `Hide ${name}`;
    toggle.setAttribute('aria-expanded', String(!collapsed));
  }
}

function toggleListSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const state = getCollapsedListSections();
  const collapsed = !section.classList.contains('list-section-collapsed');
  state[sectionId] = collapsed;
  saveCollapsedListSections(state);
  applyListSectionState(section, collapsed);
}

function addListSectionControls() {
  const state = getCollapsedListSections();
  document.querySelectorAll('.managed-list-section').forEach(section => {
    const heading = section.querySelector(':scope > .section-heading');
    if (!heading) return;
    let controls = heading.querySelector('.list-heading-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'list-heading-controls';
      const existingAdd = heading.querySelector('.section-plus');
      if (existingAdd) controls.appendChild(existingAdd);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'small-button secondary-button list-collapse-toggle';
      toggle.onclick = () => toggleListSection(section.id);
      controls.appendChild(toggle);
      heading.appendChild(controls);
    }
    applyListSectionState(section, Boolean(state[section.id]));
  });
}

function prepareListsView() {
  const search = document.getElementById('globalListSearch');
  if (search && search.value) search.value = '';
  document.querySelectorAll('.managed-list-section').forEach(section => {
    section.hidden = false;
    section.classList.remove('search-no-match');
    section.querySelectorAll('.compact-manage-row,.annual-manage-row,.list-card,.v10-row').forEach(row => {
      row.hidden = false;
    });
  });
  addListSectionControls();
}

function showAppView(view, button) {
  if(view !== 'tasks') toggleListsSideNav(false);
  const titles = {
    home: ["Home", "Your day"],
    tasks: ["Lists", "All tasks saved under each category"],
    planner: ["Planner", "Projects, dates and routines"]
  };
  document.querySelectorAll('.app-view-section').forEach(section => {
    section.hidden = section.dataset.view !== view;
  });
  if (view === 'tasks') {
    renderTodos();
    renderAppointments();
    renderInbox();
    renderWaiting();
    renderAnnualDates();
    renderProjects();
    renderCleaning();
    updateListHubCounts();
    prepareListsView();
  }
  document.querySelectorAll('.bottom-nav .nav-button[data-tab]').forEach(btn => btn.classList.remove('active'));
  const activeButton = button || document.querySelector(`.bottom-nav .nav-button[data-tab="${view}"]`);
  if (activeButton) activeButton.classList.add('active');
  const copy = titles[view] || titles.home;
  const eyebrow = document.getElementById('viewEyebrow');
  const title = document.getElementById('viewTitle');
  if (eyebrow) eyebrow.textContent = copy[0];
  if (title) title.textContent = copy[1];
  localStorage.setItem('myLifePlannerActiveView', view);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let plannerWasHidden = false;

function returnPlannerToHome() {
  localStorage.removeItem('myLifePlannerActiveView');
  showAppView('home');
}

// A newly loaded app always starts on Home.
document.addEventListener('DOMContentLoaded', () => { if(!openRequestedLaunch()) returnPlannerToHome(); });

// Installed PWAs commonly remain alive in the background instead of reloading.
// Treat leaving and returning to the app as a fresh opening and return to Home.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    plannerWasHidden = true;
  } else if (plannerWasHidden) {
    plannerWasHidden = false;
    if(!openRequestedLaunch()) returnPlannerToHome();
  }
});

window.addEventListener('pageshow', event => {
  if (event.persisted) returnPlannerToHome();
});

/* v9.7 dashboard and compact-management refinements */
function activeProjectDashboardItems() {
  const today = new Date().toISOString().slice(0,10);
  return data.projects.flatMap(project => {
    if (project.completed) return [];
    const nextStep = (project.steps || []).find(step => !step.completed);
    if (!nextStep) return [];
    return [{...nextStep, dueDate: nextStep.dueDate || today, source:`Project: ${project.name}`, itemType:"step", parentId:project.id, isUndatedProjectStep:!nextStep.dueDate}];
  });
}
function activeTodoDashboardItems() {
  return data.todos.flatMap(todo=>{
    if(todo.completed) return [];
    const steps=todo.steps||[];
    const next=steps.find(s=>!s.completed);
    if(next) return [{...next,source:`To-do: ${todo.name}`,itemType:"todoStep",parentId:todo.id}];
    return [{...todo,source:"To-do",itemType:"todo"}];
  });
}
function getTodayReminderItems() {
  const today=new Date(); today.setHours(12,0,0,0);
  const dated=[...activeTodoDashboardItems(),...activeProjectDashboardItems(),...appointmentDashboardItems()].filter(x=>!x.completed&&x.dueDate&&dateOnly(x.dueDate)<=today);
  const annual=data.annualDates.map(item=>({item,status:annualStatus(item)})).filter(e=>e.status&&(e.status.isToday||e.status.inReminderWindow)).map(e=>({id:e.item.id,name:e.item.name,details:e.item.details,source:e.status.isToday?"Annual date today":"Annual reminder",dueDate:e.status.occurrence.toISOString().slice(0,10),itemType:"annual"}));
  const cleaning=data.cleaningTasks.filter(i=>isDueTodayOrEarlier(i.nextDue)).map(i=>({id:i.id,name:i.name,details:i.details,source:`Cleaning: ${i.room||"General"}`,dueDate:i.nextDue,itemType:"cleaning"}));
  return [...dated,...annual,...cleaning].sort((a,b)=>dateOnly(a.dueDate)-dateOnly(b.dueDate));
}
function getWeeklyItems() {
  const today=new Date(); today.setHours(12,0,0,0);
  const end=new Date(today); end.setDate(end.getDate()+7);
  const ordinary=[...activeTodoDashboardItems(),...activeProjectDashboardItems(),...appointmentDashboardItems(),...data.cleaningTasks.map(i=>({id:i.id,name:i.name,details:i.details,source:`Cleaning: ${i.room||"General"}`,dueDate:i.nextDue,itemType:"cleaning",completed:false,leadDays:0}))]
    .filter(i=>!i.completed&&i.dueDate)
    .filter(i=>{
      const due=dateOnly(i.dueDate);
      const lead=Number(i.leadDays||0);
      const reminderStart=new Date(due); reminderStart.setDate(reminderStart.getDate()-lead);
      // Today and overdue items belong only in the Today panel.
      return due>today && reminderStart<=end;
    });
  const annual=data.annualDates
    .map(i=>{const o=nextAnnualOccurrence(i.monthDay);return {...i,source:i.kind||"Annual reminder",dueDate:o?o.toISOString().slice(0,10):null,annual:true,itemType:"annual"};})
    .filter(i=>i.dueDate&&dateOnly(i.dueDate)>today&&dateOnly(i.dueDate)<=end);
  return [...ordinary,...annual].sort((a,b)=>dateOnly(a.dueDate)-dateOnly(b.dueDate));
}
function toggleTodoStep(todoId,stepId){const todo=data.todos.find(x=>x.id===todoId),step=todo?.steps?.find(x=>x.id===stepId);if(!todo||!step)return;step.completed=!step.completed;todo.completed=(todo.steps||[]).length>0&&todo.steps.every(s=>s.completed);saveData();renderAll();}
function openReminderItem(item){if(item.itemType==="todo")editTodo(item.id);else if(item.itemType==="todoStep")editTodo(item.parentId);else if(item.itemType==="step")editStep(item.parentId,item.id);else if(item.itemType==="cleaning")editCleaning(item.id);else if(item.itemType==="annual"||item.annual)editAnnual(item.id);else if(item.itemType==="appointment")openAppointmentDialog(item.id);else if(item.itemType==="project")editProject(item.id);}
function completionFor(item){if(item.itemType==="cleaning")return()=>completeCleaning(item.id);if(item.itemType==="todo")return()=>toggleTodo(item.id);if(item.itemType==="todoStep")return()=>toggleTodoStep(item.parentId,item.id);if(item.itemType==="step")return()=>toggleStep(item.parentId,item.id);return null;}
function renderTodayReminders(){const area=document.getElementById("todayRemindersArea"),items=getTodayReminderItems();area.innerHTML="";if(!items.length){area.innerHTML='<div class="empty-state">No dated reminders need attention today.</div>';return;}items.forEach(item=>{const overdue=item.itemType!=="annual"&&dateOnly(item.dueDate)<new Date(new Date().setHours(0,0,0,0));area.appendChild(compactReminderRow(item,{meta:`${item.source} · ${formatDate(item.dueDate,item.itemType!=="annual")}${overdue?" · OVERDUE":""}`,actionable:item.itemType!=="annual",onComplete:completionFor(item),clickable:true}));});}
function renderWeekly(){const area=document.getElementById("weeklyArea"),items=getWeeklyItems();area.innerHTML="";if(!items.length){area.innerHTML='<div class="empty-state">Nothing needs attention this week.</div>';return;}items.forEach(item=>area.appendChild(compactReminderRow(item,{meta:`${item.source} · ${formatDate(item.dueDate,item.itemType!=="annual")}`,actionable:item.itemType!=="annual",onComplete:completionFor(item),clickable:true})));}
let activeAnchoredMenu=null;
function closeAnchoredMenu(){if(activeAnchoredMenu){activeAnchoredMenu.remove();activeAnchoredMenu=null;}}
function showAnchoredMenu(button){
  closeAnchoredMenu();
  const template=button.parentElement.querySelector('.item-menu-template');
  if(!template)return;
  const pop=document.createElement('div'); pop.className='anchored-item-menu';
  pop.innerHTML=`<button type="button" class="menu-close-x" aria-label="Close">×</button>${template.innerHTML}`;
  document.body.appendChild(pop); activeAnchoredMenu=pop;
  const r=button.getBoundingClientRect(), gap=6;
  const w=pop.offsetWidth, h=pop.offsetHeight;
  let left=Math.min(window.innerWidth-w-8,Math.max(8,r.right-w));
  let top=r.bottom+gap;
  if(top+h>window.innerHeight-8) top=Math.max(8,r.top-h-gap);
  pop.style.left=`${left}px`; pop.style.top=`${top}px`;
  pop.querySelector('.menu-close-x').onclick=closeAnchoredMenu;
}
document.addEventListener('click',e=>{if(activeAnchoredMenu&&!activeAnchoredMenu.contains(e.target)&&!e.target.closest('.item-menu-trigger'))closeAnchoredMenu();});
window.addEventListener('scroll',closeAnchoredMenu,true); window.addEventListener('resize',closeAnchoredMenu);
function compactMenu(actions,label){return `<span class="item-menu-anchor"><button type="button" class="item-menu-trigger" onclick="event.stopPropagation();showAnchoredMenu(this)" aria-label="Options for ${escapeHtml(label)}">⋯</button><span class="item-menu-template hidden">${actions}</span></span>`;}
function renderAnnualDates(){const area=document.getElementById('annualArea');area.innerHTML='';if(!data.annualDates.length){area.innerHTML='<div class="empty-state">No birthdays or annual dates yet.</div>';return;}[...data.annualDates].sort((a,b)=>nextAnnualOccurrence(a.monthDay)-nextAnnualOccurrence(b.monthDay)).forEach(item=>{const next=nextAnnualOccurrence(item.monthDay),row=document.createElement('div');row.className='annual-manage-row';row.innerHTML=`<div><strong>${escapeHtml(item.name)}</strong><div class="card-meta">${next?next.toLocaleDateString('en-GB',{day:'numeric',month:'long'}):''}</div></div>${compactMenu(`<button onclick="closeAnchoredMenu();editAnnual('${item.id}')">Edit</button><button class="danger-text" onclick="closeAnchoredMenu();deleteAnnual('${item.id}')">Delete</button>`,item.name)}`;area.appendChild(row);});}

function addStepBuilderRow(builderId, step={}){
 const box=document.getElementById(builderId); if(!box)return;
 const row=document.createElement('div'); row.className='step-builder-row';
 const mode=step.leadDays>0?'before':(step.dueDate?'date':'none');
 row.innerHTML=`<input class="step-name-input" type="text" placeholder="Step description" value="${escapeHtml(step.name||'')}"><select class="step-date-mode"><option value="none">No date</option><option value="date" ${mode==='date'?'selected':''}>Choose date</option><option value="before" ${mode==='before'?'selected':''}>Days before event</option></select><input class="step-date-input ${mode==='date'?'':'hidden'}" type="date" value="${step.dueDate||''}"><div class="step-before-input ${mode==='before'?'':'hidden'}"><input type="number" min="0" max="3650" value="${step.leadDays||1}"><span>days before</span></div><button type="button" class="step-remove" aria-label="Remove step">×</button>`;
 row.querySelector('.step-date-mode').addEventListener('change',e=>{row.querySelector('.step-date-input').classList.toggle('hidden',e.target.value!=='date');row.querySelector('.step-before-input').classList.toggle('hidden',e.target.value!=='before');});
 row.querySelector('.step-remove').onclick=()=>row.remove(); box.appendChild(row);
}
function loadStepBuilder(builderId,steps=[]){const box=document.getElementById(builderId);if(!box)return;box.innerHTML='';(steps||[]).forEach(s=>addStepBuilderRow(builderId,s));}
function baseDateForSteps(builderId){if(builderId==='projectStepsBuilder'||builderId==='itemStepsBuilder'){const t=document.getElementById('itemType').value;if(t==='annual'){const v=document.getElementById('annualDate').value;return v||null;}return document.getElementById('dueDate').value||null;}return null;}
function serializeStepBuilder(builderId){const box=document.getElementById(builderId),base=baseDateForSteps(builderId);if(!box)return '';return [...box.querySelectorAll('.step-builder-row')].map(row=>{const name=row.querySelector('.step-name-input').value.trim();if(!name)return null;const mode=row.querySelector('.step-date-mode').value;let date='';let leadDays=0;if(mode==='date')date=row.querySelector('.step-date-input').value||'';if(mode==='before'){leadDays=Number(row.querySelector('.step-before-input input').value||0);if(base){const d=new Date(base+'T12:00:00');d.setDate(d.getDate()-leadDays);date=d.toISOString().slice(0,10);}}return `${date} | ${name} | lead:${leadDays}`;}).filter(Boolean).join('\n');}
function syncStepBuilders(){const a=document.getElementById('projectSteps');const b=document.getElementById('itemSteps');if(a)a.value=serializeStepBuilder('projectStepsBuilder');if(b)b.value=serializeStepBuilder('itemStepsBuilder');}


/* ===== Version 10 experience ===== */
function dueClass(value){
  if(!value) return 'status-future';
  const d=dateOnly(value),today=new Date();today.setHours(12,0,0,0);
  const days=daysBetween(today,d);
  return days<0?'status-overdue':days<=2?'status-soon':'status-future';
}
function focusCandidateRows(){
  const rows=[];
  const today=new Date(); today.setHours(12,0,0,0);
  data.todos.filter(x=>!x.completed).forEach(x=>rows.push({name:x.name,meta:getTimingText(x),dueDate:x.dueDate,kind:'To-do',action:()=>toggleTodo(x.id),open:()=>editTodo(x.id),score:x.dueDate?daysBetween(today,dateOnly(x.dueDate)):40}));
  data.cleaningTasks.filter(x=>isDueTodayOrEarlier(x.nextDue)).forEach(x=>rows.push({name:x.name,meta:`Cleaning · ${x.room||'Home'}`,dueDate:x.nextDue,kind:'Cleaning',action:()=>completeCleaning(x.id),open:()=>editCleaning(x.id),score:-2}));
  data.projects.filter(x=>!x.completed).forEach(p=>{const s=(p.steps||[]).find(x=>!x.completed);if(s)rows.push({name:s.name,meta:`Next action · ${p.name}`,dueDate:s.dueDate,kind:'Project',action:()=>toggleStep(p.id,s.id),open:()=>editStep(p.id,s.id),score:s.dueDate?daysBetween(today,dateOnly(s.dueDate)):12});});
  data.waiting.filter(x=>!x.completed&&x.reviewDate&&dateOnly(x.reviewDate)<=today).forEach(x=>rows.push({name:x.name,meta:'Waiting for · review due',dueDate:x.reviewDate,kind:'Waiting',open:()=>editCapture('waiting',x.id),score:0}));
  return rows.sort((a,b)=>a.score-b.score).slice(0,7);
}
function makeV10Row(item,{complete=true,menu='' }={}){
 const row=document.createElement('div'); row.className=`v10-row ${dueClass(item.dueDate)}`;
 const main=document.createElement('button');main.type='button';main.className='v10-row-main';main.innerHTML=`<span class="v10-row-title">${escapeHtml(item.name)}</span><span class="v10-row-meta">${escapeHtml(item.meta||'')}</span>`; if(item.open)main.onclick=item.open;
 row.appendChild(main);
 if(complete&&item.action){const done=document.createElement('button');done.type='button';done.className='complete-dot';done.setAttribute('aria-label',`Mark ${item.name} complete`);done.setAttribute('title','Mark complete');done.innerHTML='';done.onclick=event=>{event.stopPropagation();item.action();};row.prepend(done);}
 if(menu)row.insertAdjacentHTML('beforeend',menu);
 return row;
}
function renderFocusToday(){const area=document.getElementById('focusTodayArea');if(!area)return;area.innerHTML='';const items=focusCandidateRows();if(!items.length){area.innerHTML='<div class="empty-state calm-empty"><strong>You are clear for now.</strong><span>Capture a thought or add a task when something comes to mind.</span></div>';return;}items.forEach(x=>area.appendChild(makeV10Row(x)));}
function refreshFocusToday(){renderFocusToday();const el=document.getElementById('focusTodayArea');el?.animate([{opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:260});}
function renderProjectNextActions(){const area=document.getElementById('projectNextActionsArea');if(!area)return;area.innerHTML='';const active=data.projects.filter(p=>!p.completed).map(p=>({p,s:(p.steps||[]).find(x=>!x.completed)})).filter(x=>x.s);if(!active.length){area.innerHTML='<div class="empty-state">No project needs a next action.</div>';return;}active.forEach(({p,s})=>area.appendChild(makeV10Row({name:s.name,meta:`${p.name}${s.dueDate?' · '+formatDate(s.dueDate):''}`,dueDate:s.dueDate,action:()=>toggleStep(p.id,s.id),open:()=>editStep(p.id,s.id)})));}
function openCaptureDialog(type='inbox',id=''){
 const item=(data[type]||[]).find(x=>x.id===id);
 document.getElementById('captureType').value=type;document.getElementById('captureId').value=id;
 document.getElementById('captureTitle').textContent=type==='waiting'?(id?'Edit waiting item':'Add Waiting For'):(id?'Edit Brain Inbox item':'Capture to Brain Inbox');
 document.getElementById('captureName').value=item?.name||'';document.getElementById('captureNote').value=item?.note||'';document.getElementById('captureDate').value=item?.reviewDate||'';
 document.getElementById('captureCategory').value=item?.category||'';document.getElementById('captureStatus').value=item?.status||'new';
 document.getElementById('captureUrl').value=item?.url||'';window.pendingBrainAttachment=item?.attachment||null;renderBrainAttachmentPreview();
 document.getElementById('waitingDateLabel').classList.toggle('hidden',type!=='waiting');
 document.getElementById('inboxCaptureOptions').classList.toggle('hidden',type!=='inbox');
 document.getElementById('brainCaptureHub')?.classList.toggle('hidden',type!=='inbox');
 document.getElementById('captureConvertActions')?.classList.toggle('hidden',type!=='inbox');
 const saveBtn=document.querySelector('#captureForm .dialog-actions button:last-child');if(saveBtn)saveBtn.textContent=type==='waiting'?'Save item':'Save to Brain Inbox';
 document.getElementById('captureDialog').showModal();setTimeout(()=>document.getElementById('captureName').focus(),80);
}
function closeCaptureDialog(){window.pendingBrainAttachment=null;document.getElementById('captureDialog')?.close();}
function editCapture(type,id){openCaptureDialog(type,id);}
function deleteCapture(type,id){data[type]=data[type].filter(x=>x.id!==id);saveData();renderAll();showSaved('Deleted');}
function completeWaiting(id){const x=data.waiting.find(x=>x.id===id);if(x)x.completed=!x.completed;saveData();renderAll();}
function captureDraft(){return {type:document.getElementById('captureType').value,id:document.getElementById('captureId').value,name:document.getElementById('captureName').value.trim(),note:document.getElementById('captureNote').value.trim(),reviewDate:document.getElementById('captureDate').value,category:document.getElementById('captureCategory').value.trim(),status:document.getElementById('captureStatus').value,url:normaliseBrainUrl(document.getElementById('captureUrl')?.value||''),attachment:window.pendingBrainAttachment||null};}
function saveCapture(targetType=''){
 const d=captureDraft(); if(!d.name){document.getElementById('captureName').focus();return false;}
 const sourceItem=d.id?(data[d.type]||[]).find(x=>x.id===d.id):null;
 if(targetType==='appointment'){
   pendingInboxAppointmentId=d.id||'';
   pendingInboxDraft=d;
   closeCaptureDialog();openAppointmentDialog('',d.name,d.note);return true;
 }
 const type=targetType||d.type;
 if(type==='todo')data.todos.unshift({id:uid(),name:d.name,details:d.note,timingType:'none',dueDate:'',completed:false,steps:[],createdAt:new Date().toISOString()});
 else if(type==='project')data.projects.unshift({id:uid(),name:d.name,details:d.note,timingType:'none',dueDate:'',completed:false,steps:[],createdAt:new Date().toISOString()});
 else {const list=data[type]||(data[type]=[]),existing=list.find(x=>x.id===d.id);const record={id:existing?.id||uid(),name:d.name,note:d.note,reviewDate:type==='waiting'?d.reviewDate:'',category:type==='inbox'?d.category:'',status:type==='inbox'?d.status:'new',url:type==='inbox'?d.url:'',attachment:type==='inbox'?d.attachment:null,completed:existing?.completed||false,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(existing)Object.assign(existing,record);else list.unshift(record);}
 if(targetType&&d.type==='inbox'&&sourceItem)data.inbox=data.inbox.filter(x=>x.id!==d.id);
 saveData();closeCaptureDialog();renderAll();showSaved(targetType?`Saved as ${targetType==='waiting'?'Waiting For':targetType}`:'Saved');return true;
}
function saveCaptureAs(type){saveCapture(type);}
function inboxStatusLabel(status){return status==='processed'?'Processed':status==='progress'?'In progress':'New';}
function inboxMeta(x){const parts=[];parts.push(inboxStatusLabel(x.status));if(x.category)parts.push(x.category);if(x.url)parts.push('🔗 Website');if(x.attachment)parts.push(`${x.attachment.type?.startsWith('image/')?'🖼️':'📄'} ${x.attachment.name||'Attachment'}`);if(x.createdAt)parts.push(`Captured ${new Date(x.createdAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}`);if(x.note)parts.push(x.note);return parts.join(' · ');}
function toggleInboxProcessed(id){const x=data.inbox.find(item=>item.id===id);if(!x)return;x.status=x.status==='processed'?'new':'processed';x.updatedAt=new Date().toISOString();saveData();renderAll();showSaved(x.status==='processed'?'Marked processed':'Returned to inbox');}
function renderInbox(){const full=document.getElementById('inboxArea'),preview=document.getElementById('inboxPreviewArea');[full,preview].forEach(area=>{if(!area)return;area.innerHTML='';const sorted=[...data.inbox].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));const items=area===preview?sorted.filter(x=>x.status!=='processed').slice(0,3):sorted;if(!items.length){area.innerHTML='<div class="empty-state">Nothing waiting in your inbox.</div>';return;}items.forEach(x=>{const processed=x.status==='processed';const row=makeV10Row({name:x.name,meta:inboxMeta(x),open:()=>editCapture('inbox',x.id)},{complete:false,menu:compactMenu(`<button onclick="closeAnchoredMenu();editCapture('inbox','${x.id}')">Edit</button><button onclick="closeAnchoredMenu();toggleInboxProcessed('${x.id}')">${processed?'Mark as new':'Mark processed'}</button>${x.url?`<button onclick="closeAnchoredMenu();openBrainLink('${x.id}')">Open website</button>`:''}${x.attachment?`<button onclick="closeAnchoredMenu();openBrainAttachment('${x.id}')">Open attachment</button>`:''}<button onclick="closeAnchoredMenu();convertInbox('${x.id}','todo')">Make a to-do</button><button onclick="closeAnchoredMenu();convertInbox('${x.id}','project')">Make a project</button><button onclick="closeAnchoredMenu();convertInbox('${x.id}','appointment')">Make an appointment</button><button onclick="closeAnchoredMenu();convertInbox('${x.id}','waiting')">Move to Waiting For</button><button class="danger-text" onclick="closeAnchoredMenu();deleteCapture('inbox','${x.id}')">Delete</button>`,x.name)});if(processed)row.classList.add('processed-inbox-row');area.appendChild(row);});});}
function renderWaiting(){const area=document.getElementById('waitingArea');if(!area)return;area.innerHTML='';if(!data.waiting.length){area.innerHTML='<div class="empty-state">Nothing being waited for.</div>';return;}data.waiting.forEach(x=>area.appendChild(makeV10Row({name:x.name,meta:x.reviewDate?`Review ${formatDate(x.reviewDate)}`:(x.note||'No review date'),dueDate:x.reviewDate,action:()=>completeWaiting(x.id),open:()=>editCapture('waiting',x.id)},{menu:compactMenu(`<button onclick="closeAnchoredMenu();editCapture('waiting','${x.id}')">Edit</button><button onclick="closeAnchoredMenu();completeWaiting('${x.id}')">${x.completed?'Mark active':'Complete'}</button><button class="danger-text" onclick="closeAnchoredMenu();deleteCapture('waiting','${x.id}')">Delete</button>`,x.name)})));}
window.pendingBrainAttachment=null;
function normaliseBrainUrl(value){const text=String(value||'').trim();if(!text)return '';try{return new URL(/^https?:\/\//i.test(text)?text:`https://${text}`).href;}catch(error){return text;}}
function focusWebsiteCapture(){document.getElementById('captureUrl')?.focus();}
function chooseBrainAttachment(accept='*/*',capture=''){const input=document.getElementById('brainAttachmentInput');if(!input)return;input.value='';input.accept=accept;if(capture)input.setAttribute('capture',capture);else input.removeAttribute('capture');input.click();}
async function handleBrainAttachment(event){
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.type?.startsWith('image/')){
   const reduced=await prepareBrainImage(file);
   window.pendingBrainAttachment=reduced;
   renderBrainAttachmentPreview();
   showSaved(reduced.originalSize>reduced.size?`Image reduced from ${formatFileSize(reduced.originalSize)} to ${formatFileSize(reduced.size)}`:'Image ready');
   return;
  }
  if(file.size>1572864){alert('That document is too large for safe on-device storage. Please choose a document under 1.5 MB.');event.target.value='';return;}
  const dataUrl=await readFileAsDataUrl(file);
  window.pendingBrainAttachment={name:file.name||'Attachment',type:file.type||'application/octet-stream',size:file.size,data:dataUrl};renderBrainAttachmentPreview();
 }catch(error){console.error(error);alert('The attachment could not be prepared. Please try another file.');event.target.value='';}
}
function readFileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(file);});}
function loadImageFromDataUrl(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});}
function dataUrlByteSize(dataUrl){const base64=(dataUrl.split(',')[1]||'');return Math.max(0,Math.floor(base64.length*3/4));}
function formatFileSize(bytes){return bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`;}
async function prepareBrainImage(file){
 const originalData=await readFileAsDataUrl(file);const image=await loadImageFromDataUrl(originalData);
 const maxDimension=1600;const scale=Math.min(1,maxDimension/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height));
 const width=Math.max(1,Math.round((image.naturalWidth||image.width)*scale));const height=Math.max(1,Math.round((image.naturalHeight||image.height)*scale));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,width,height);
 let quality=.84;let data=canvas.toDataURL('image/jpeg',quality);const target=900*1024;
 while(dataUrlByteSize(data)>target&&quality>.44){quality-=.08;data=canvas.toDataURL('image/jpeg',quality);}
 let size=dataUrlByteSize(data);if(size>1572864)throw new Error('Compressed image remains too large');
 const base=(file.name||'image').replace(/\.[^.]+$/,'');return{name:`${base}-planner.jpg`,type:'image/jpeg',size,data,originalSize:file.size,width,height,compressed:true};
}
function renderBrainAttachmentPreview(){const area=document.getElementById('brainAttachmentPreview');if(!area)return;const attachment=window.pendingBrainAttachment;if(!attachment){area.classList.add('hidden');area.innerHTML='';return;}const size=formatFileSize(attachment.size||0);const reduction=attachment.originalSize&&attachment.originalSize>attachment.size?` <small class="attachment-reduction">(reduced from ${formatFileSize(attachment.originalSize)})</small>`:'';const thumb=attachment.type?.startsWith('image/')?`<img src="${attachment.data}" alt="Selected attachment preview">`:`<span class="attachment-file-icon" aria-hidden="true">📄</span>`;area.innerHTML=`${thumb}<span><strong>${escapeHtml(attachment.name||'Attachment')}</strong><small>${size}${reduction}</small></span><button type="button" onclick="removeBrainAttachment()" aria-label="Remove attachment">×</button>`;area.classList.remove('hidden');}
function removeBrainAttachment(){window.pendingBrainAttachment=null;const input=document.getElementById('brainAttachmentInput');if(input)input.value='';renderBrainAttachmentPreview();}
function openBrainLink(id){const item=data.inbox.find(x=>x.id===id);if(!item?.url)return;window.open(normaliseBrainUrl(item.url),'_blank','noopener');}
window.currentBrainAttachment=null;window.currentAttachmentObjectUrl='';
function dataUrlToBlob(dataUrl){const parts=dataUrl.split(',');const match=parts[0].match(/data:([^;]+)/);const type=match?.[1]||'application/octet-stream';const binary=atob(parts[1]||'');const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type});}
function openBrainAttachment(id){const item=data.inbox.find(x=>x.id===id);if(!item?.attachment?.data)return;showAttachmentViewer(item.attachment);}
function showAttachmentViewer(attachment){
 closeAttachmentViewer(false);window.currentBrainAttachment=attachment;const dialog=document.getElementById('attachmentViewerDialog');const body=document.getElementById('attachmentViewerBody');const title=document.getElementById('attachmentViewerTitle');if(!dialog||!body)return;
 title.textContent=attachment.name||'Attachment';body.innerHTML='';const type=attachment.type||'';
 if(type.startsWith('image/')){const img=document.createElement('img');img.src=attachment.data;img.alt=attachment.name||'Attachment preview';body.appendChild(img);}
 else if(type==='application/pdf'){const blob=dataUrlToBlob(attachment.data);window.currentAttachmentObjectUrl=URL.createObjectURL(blob);const frame=document.createElement('iframe');frame.src=window.currentAttachmentObjectUrl;frame.title=attachment.name||'PDF preview';body.appendChild(frame);}
 else if(type.startsWith('text/')){const blob=dataUrlToBlob(attachment.data);blob.text().then(text=>{const pre=document.createElement('pre');pre.textContent=text;body.replaceChildren(pre);});}
 else{body.innerHTML='<div class="empty-state"><strong>Preview is not available for this file type.</strong><p>Use Download copy to open it in another app.</p></div>';}
 dialog.showModal();
}
function closeAttachmentViewer(closeDialog=true){if(window.currentAttachmentObjectUrl){URL.revokeObjectURL(window.currentAttachmentObjectUrl);window.currentAttachmentObjectUrl='';}if(closeDialog)document.getElementById('attachmentViewerDialog')?.close();}
function downloadCurrentAttachment(){const attachment=window.currentBrainAttachment;if(!attachment?.data)return;const link=document.createElement('a');link.href=attachment.data;link.download=attachment.name||'attachment';document.body.appendChild(link);link.click();link.remove();}
function brainInboxShortcutUrl(){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('open','brain-inbox');return url.href;}
function refreshBrainShortcutUrl(){const input=document.getElementById('brainShortcutUrl');if(input)input.value=brainInboxShortcutUrl();}
async function copyBrainInboxShortcut(){const value=brainInboxShortcutUrl();try{await navigator.clipboard.writeText(value);showSaved('Brain Inbox address copied');}catch{const input=document.getElementById('brainShortcutUrl');input?.select();document.execCommand('copy');showSaved('Brain Inbox address copied');}}
function openBrainInboxShortcut(){location.href=brainInboxShortcutUrl();}

function requestedBrainInboxLaunch(){const params=new URLSearchParams(location.search);return params.get('open')==='brain'||params.get('open')==='brain-inbox'||location.hash==='#brain-inbox';}
function openRequestedLaunch(){if(!requestedBrainInboxLaunch())return false;showAppView('tasks');setTimeout(()=>{document.getElementById('inboxListSection')?.scrollIntoView({block:'start'});openCaptureDialog('inbox');},180);return true;}
function startVoiceCapture(type=''){
 if(type) openCaptureDialog(type);
 const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SpeechRecognition){alert('Voice dictation is not supported by this browser. You can use the microphone button on your phone keyboard instead.');return;}
 const r=new SpeechRecognition();r.lang='en-GB';r.interimResults=false;r.maxAlternatives=1;
 const mic=document.querySelector('.capture-mic');mic?.classList.add('listening');
 r.onresult=e=>{const text=e.results[0][0].transcript.trim();const input=document.getElementById('captureName');input.value=input.value?`${input.value} ${text}`:text;input.dispatchEvent(new Event('input'));};
 r.onerror=()=>alert('I could not hear that clearly. Please try again or use your keyboard microphone.');
 r.onend=()=>mic?.classList.remove('listening');r.start();
}
document.getElementById('captureForm')?.addEventListener('submit',e=>{e.preventDefault();saveCapture();});


/* ===== Version 10.3 My Lists control centre ===== */
function updateListHubCounts(){
 const simple={annualHubCount:data.annualDates.length,appointmentHubCount:(data.appointments||[]).length,inboxHubCount:(data.inbox||[]).length,customHubCount:(data.customLists||[]).reduce((sum,list)=>sum+(list.items||[]).length,0)};
 Object.entries(simple).forEach(([id,n])=>{const el=document.getElementById(id);if(el)el.textContent=`${n} ${n===1?'item':'items'}`;});
 const statusCounts={
   todoHubCount:[data.todos.filter(x=>!x.completed).length,data.todos.filter(x=>x.completed).length],
   projectHubCount:[data.projects.filter(x=>!x.completed).length,data.projects.filter(x=>x.completed).length],
   cleaningHubCount:[data.cleaningTasks.length,0],
   waitingHubCount:[(data.waiting||[]).filter(x=>!x.completed).length,(data.waiting||[]).filter(x=>x.completed).length]
 };
 Object.entries(statusCounts).forEach(([id,[active,done]])=>{const el=document.getElementById(id);if(el)el.textContent=done?`${active} active · ${done} completed`:`${active} ${active===1?'item':'items'}`;});
}
function openTimelineShortcut(){
  showAppView('planner');
  requestAnimationFrame(()=>document.querySelector('.timeline-panel')?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function scrollListsToTop(){
  document.querySelector('.lists-hub')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function updateListsScrollCue(){
 const panel=document.getElementById('listsSideNav');
 const cue=panel?.querySelector('.lists-scroll-cue');
 if(!panel||!cue)return;
 const hasMore=panel.scrollHeight-panel.scrollTop-panel.clientHeight>10;
 cue.classList.toggle('is-visible',hasMore);
}
function toggleListsSideNav(force){
 const wrap=document.querySelector('.lists-floating-wrap');
 const toggle=document.querySelector('.lists-rail-toggle');
 if(!wrap||!toggle)return;
 const open=typeof force==='boolean'?force:!wrap.classList.contains('nav-open');
 wrap.classList.toggle('nav-open',open);
 toggle.setAttribute('aria-expanded',String(open));
 if(open){
  requestAnimationFrame(()=>{
   const panel=document.getElementById('listsSideNav');
   if(panel)panel.scrollTop=0;
   updateListsScrollCue();
  });
 }
}
let listsLayoutResetTimer;
function resetListsNavigationLayout(){
 clearTimeout(listsLayoutResetTimer);
 listsLayoutResetTimer=setTimeout(()=>toggleListsSideNav(false),60);
}
window.addEventListener('resize',resetListsNavigationLayout,{passive:true});
window.addEventListener('orientationchange',()=>{
 toggleListsSideNav(false);
 resetListsNavigationLayout();
},{passive:true});
if(window.visualViewport)window.visualViewport.addEventListener('resize',resetListsNavigationLayout,{passive:true});
document.getElementById('listsSideNav')?.addEventListener('scroll',updateListsScrollCue,{passive:true});

document.addEventListener('pointerdown',event=>{
 const wrap=document.querySelector('.lists-floating-wrap');
 if(!wrap?.classList.contains('nav-open'))return;
 if(!wrap.contains(event.target))toggleListsSideNav(false);
});
function jumpToList(id){
 const el=document.getElementById(id);
 if(!el)return;
 // A Lists-menu choice must reveal the section before scrolling to it.
 if(el.classList.contains('list-section-collapsed')){
   const state=getCollapsedListSections();
   state[id]=false;
   saveCollapsedListSections(state);
   applyListSectionState(el,false);
 }
 requestAnimationFrame(()=>{
   const header=document.querySelector('.app-header');
   const offset=(header?.getBoundingClientRect().height||0)+14;
   const top=window.scrollY+el.getBoundingClientRect().top-offset;
   window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
   toggleListsSideNav(false);
   el.classList.add('list-highlight');
   setTimeout(()=>el.classList.remove('list-highlight'),900);
 });
}
function filterMyLists(query=''){
 const search=document.getElementById('globalListSearch');
 const q=String(query ?? search?.value ?? '').trim().toLocaleLowerCase();
 const sections=[...document.querySelectorAll('.managed-list-section')];
 let matchingSections=0;
 sections.forEach(section=>{
   const rows=[...section.querySelectorAll('.compact-manage-row,.annual-manage-row,.list-card,.v10-row,.custom-list-card,.custom-preview-item,.step-compact-row')];
   const headingText=String(section.dataset.listName||section.querySelector('h2')?.textContent||'').toLocaleLowerCase();
   const headingMatch=Boolean(q)&&headingText.includes(q);
   let visibleRows=0;
   rows.forEach(row=>{
     const match=!q||headingMatch||String(row.textContent||'').toLocaleLowerCase().includes(q);
     row.classList.toggle('list-search-hidden',!match);
     row.hidden=!match;
     if(match)visibleRows++;
   });
   const show=!q||headingMatch||visibleRows>0;
   section.classList.toggle('list-search-hidden',!show);
   section.hidden=!show;
   section.style.display=show?'':'none';
   if(show)matchingSections++;
 });
 const status=document.getElementById('listSearchStatus');
 if(status){
   status.textContent=!q?'':matchingSections?`${matchingSections} matching ${matchingSections===1?'section':'sections'}`:'No matching items';
 }
}

function initialiseListSearch(){
 const search=document.getElementById('globalListSearch');
 if(!search||search.dataset.searchReady==='true')return;
 search.dataset.searchReady='true';
 search.addEventListener('input',event=>filterMyLists(event.target.value));
 search.addEventListener('search',event=>filterMyLists(event.target.value));
}



/* ===== V11.6 core appointments rebuild ===== */
function appointmentDashboardItems(){
  return (data.appointments||[]).flatMap(a=>appointmentOccurrences(a, new Date(), 60).map(o=>({id:a.id,name:a.name,details:a.notes||'',source:'Appointment',dueDate:o.date,itemType:'appointment',time:a.time||'',occurrenceDate:o.date})));
}
function addMonthsSafe(date,n){const d=new Date(date);const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return d;}
function normaliseAppointmentRepeat(a={}){
  let repeat=a.repeat||'none',unit=a.repeatUnit||'',interval=Math.max(1,Number(a.repeatInterval)||1);
  if(repeat==='fortnightly'){repeat='weekly';unit='week';interval=2;}
  if(!unit){unit=repeat==='daily'?'day':repeat==='weekly'?'week':repeat==='monthly'?'month':repeat==='yearly'?'year':'';}
  if(repeat==='none'||!unit)return{repeat:'none',unit:'',interval:1,endType:'never',endDate:'',count:0};
  const endType=['never','count','date'].includes(a.repeatEndType)?a.repeatEndType:'never';
  return{repeat,unit,interval,endType,endDate:a.repeatEndDate||'',count:Math.max(1,Number(a.repeatCount)||10)};
}
function advanceAppointmentDate(date,rule){
  const d=new Date(date);if(rule.unit==='day')d.setDate(d.getDate()+rule.interval);else if(rule.unit==='week')d.setDate(d.getDate()+7*rule.interval);else if(rule.unit==='month')return addMonthsSafe(d,rule.interval);else if(rule.unit==='year')return addMonthsSafe(d,12*rule.interval);return d;
}
function appointmentOccurrences(a,from=new Date(),days=400){
  if(!a||!a.date)return[];const start=dateOnly(a.date);if(isNaN(start))return[];
  const floor=new Date(from);floor.setHours(0,0,0,0);const end=new Date(floor);end.setDate(end.getDate()+days);
  const rule=normaliseAppointmentRepeat(a),limitDate=rule.endType==='date'&&rule.endDate?dateOnly(rule.endDate):null;
  const out=[];let d=new Date(start),occurrence=1,guard=0;
  while(d<floor&&rule.repeat!=='none'&&guard++<5000){if(rule.endType==='count'&&occurrence>=rule.count)return[];d=advanceAppointmentDate(d,rule);occurrence++;if(limitDate&&d>limitDate)return[];}
  guard=0;while(d<=end&&guard++<5000){
    if(limitDate&&d>limitDate)break;if(rule.endType==='count'&&occurrence>rule.count)break;
    if(d>=floor)out.push({date:localDateKey(d),occurrence});
    if(rule.repeat==='none')break;d=advanceAppointmentDate(d,rule);occurrence++;
  }
  return out;
}
function appointmentRepeatDescription(a){
  const r=normaliseAppointmentRepeat(a);if(r.repeat==='none')return'';
  const unit=r.unit+(r.interval===1?'':'s');let text=r.interval===1?`every ${unit}`:`every ${r.interval} ${unit}`;
  if(r.endType==='count')text+=` · ${r.count} appointments`;else if(r.endType==='date'&&r.endDate)text+=` · until ${formatDate(r.endDate)}`;
  return text;
}
function updateAppointmentRepeatControls(){
  const repeat=document.getElementById('appointmentRepeat'),box=document.getElementById('appointmentRepeatOptions');if(!repeat||!box)return;
  const active=repeat.value!=='none';box.hidden=!active;
  const unit=document.getElementById('appointmentRepeatUnit');if(active&&unit){const expected=repeat.value==='daily'?'day':repeat.value==='weekly'?'week':repeat.value==='monthly'?'month':'year';if(unit.dataset.userChanged!=='true')unit.value=expected;}
  const end=document.getElementById('appointmentRepeatEnd')?.value||'never';document.getElementById('appointmentRepeatCountLabel').hidden=!active||end!=='count';document.getElementById('appointmentRepeatEndDateLabel').hidden=!active||end!=='date';
  const summary=document.getElementById('appointmentRepeatSummary');if(summary&&active){summary.textContent='Repeats '+appointmentRepeatDescription({repeat:repeat.value,repeatUnit:unit?.value,repeatInterval:document.getElementById('appointmentRepeatInterval')?.value,repeatEndType:end,repeatCount:document.getElementById('appointmentRepeatCount')?.value,repeatEndDate:document.getElementById('appointmentRepeatEndDate')?.value})+'.';}
}
function openAppointmentDialog(id='',prefillName='',prefillNotes=''){
  const a=(data.appointments||[]).find(x=>x.id===id),rule=normaliseAppointmentRepeat(a||{});
  document.getElementById('appointmentId').value=a?.id||'';
  document.getElementById('appointmentName').value=a?.name||prefillName||'';
  document.getElementById('appointmentDate').value=a?.date||localDateKey();
  document.getElementById('appointmentTime').value=a?.time||'';
  document.getElementById('appointmentEndTime').value=a?.endTime||'';
  document.getElementById('appointmentLocation').value=a?.location||'';
  document.getElementById('appointmentLink').value=a?.link||a?.url||a?.meetingLink||'';
  document.getElementById('appointmentNotes').value=a?.notes||prefillNotes||'';
  document.getElementById('appointmentRepeat').value=rule.repeat;
  document.getElementById('appointmentRepeatInterval').value=rule.interval;
  const unit=document.getElementById('appointmentRepeatUnit');unit.value=rule.unit||'day';unit.dataset.userChanged='false';
  document.getElementById('appointmentRepeatEnd').value=rule.endType;
  document.getElementById('appointmentRepeatCount').value=rule.count||10;
  document.getElementById('appointmentRepeatEndDate').value=rule.endDate||'';
  document.getElementById('appointmentDialogTitle').textContent=a?'Edit appointment':'Add appointment';updateAppointmentRepeatControls();
  const dlg=document.getElementById('appointmentDialog');if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
  setTimeout(()=>document.getElementById('appointmentName').focus(),50);
}
function closeAppointmentDialog(){const d=document.getElementById('appointmentDialog');if(d.open&&d.close)d.close();else d.removeAttribute('open');}
function saveAppointment(){
  try{
    const name=document.getElementById('appointmentName').value.trim(),date=document.getElementById('appointmentDate').value;
    if(!name){alert('Please enter an appointment title.');document.getElementById('appointmentName').focus();return false;}
    if(!date){alert('Please choose a date.');document.getElementById('appointmentDate').focus();return false;}
    const id=document.getElementById('appointmentId').value,existing=(data.appointments||[]).find(x=>x.id===id),link=normaliseAppointmentLink(document.getElementById('appointmentLink').value);
    if(document.getElementById('appointmentLink').value.trim()&&!link){alert('Please enter a valid meeting or web link.');document.getElementById('appointmentLink').focus();return false;}
    const repeat=document.getElementById('appointmentRepeat').value,interval=Math.max(1,Number(document.getElementById('appointmentRepeatInterval').value)||1),endType=document.getElementById('appointmentRepeatEnd').value,count=Math.max(1,Number(document.getElementById('appointmentRepeatCount').value)||1),endDate=document.getElementById('appointmentRepeatEndDate').value;
    if(repeat!=='none'&&endType==='date'&&!endDate){alert('Please choose the repeat end date.');document.getElementById('appointmentRepeatEndDate').focus();return false;}
    if(repeat!=='none'&&endType==='date'&&dateOnly(endDate)<dateOnly(date)){alert('The repeat end date cannot be before the first appointment.');document.getElementById('appointmentRepeatEndDate').focus();return false;}
    const rec={id:existing?.id||uid(),name,date,time:document.getElementById('appointmentTime').value,endTime:document.getElementById('appointmentEndTime').value,location:document.getElementById('appointmentLocation').value.trim(),link,notes:document.getElementById('appointmentNotes').value.trim(),repeat,repeatInterval:repeat==='none'?1:interval,repeatUnit:repeat==='none'?'':document.getElementById('appointmentRepeatUnit').value,repeatEndType:repeat==='none'?'never':endType,repeatCount:repeat!=='none'&&endType==='count'?count:null,repeatEndDate:repeat!=='none'&&endType==='date'?endDate:'',createdAt:existing?.createdAt||new Date().toISOString()};
    if(existing)Object.assign(existing,rec);else data.appointments.unshift(rec);
    saveData();closeAppointmentDialog();renderAll();showSaved('Appointment saved');return true;
  }catch(e){console.error(e);alert('The appointment could not be saved. Please try again.');return false;}
}
function normaliseAppointmentLink(value){
  const raw=(value||'').trim();if(!raw)return '';
  const candidate=/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:`https://${raw}`;
  try{const url=new URL(candidate);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
function openAppointmentLink(id){const a=(data.appointments||[]).find(x=>String(x.id)===String(id));const link=normaliseAppointmentLink(a?.link||a?.url||a?.meetingLink||'');if(link)window.open(link,'_blank','noopener,noreferrer');}
function deleteAppointment(id){if(!confirm('Delete this appointment?'))return;data.appointments=data.appointments.filter(x=>String(x.id)!==String(id));saveData();renderAll();}
function renderAppointments(){
  const area=document.getElementById('appointmentsArea');if(!area)return;area.innerHTML='';
  const items=[...(data.appointments||[])].sort((a,b)=>((a.date||'')+(a.time||'')).localeCompare((b.date||'')+(b.time||'')));
  if(!items.length){area.innerHTML='<div class="empty-state">No appointments yet.</div>';return;}
  items.forEach(a=>{
    const link=normaliseAppointmentLink(a.link||a.url||a.meetingLink||'');
    const row=document.createElement('article');row.className='appointment-card';
    const timeText=a.time?`${a.time}${a.endTime?'–'+a.endTime:''}`:'All day';
    row.innerHTML=`<div class="appointment-card-main"><button class="appointment-open" onclick="openAppointmentDialog('${a.id}')"><span class="appointment-date">${escapeHtml(formatDate(a.date))}</span><span class="appointment-title">${escapeHtml(a.name)}</span><span class="appointment-meta">${escapeHtml(timeText)}${a.location?' · '+escapeHtml(a.location):''}${appointmentRepeatDescription(a)?' · '+escapeHtml(appointmentRepeatDescription(a)):''}</span>${a.notes?`<span class="appointment-notes">${escapeHtml(a.notes)}</span>`:''}</button>${compactMenu(`<button onclick="closeAnchoredMenu();openAppointmentDialog('${a.id}')">Edit</button>${link?`<button onclick="closeAnchoredMenu();openAppointmentLink('${a.id}')">Open link</button>`:''}<button class="danger-text" onclick="closeAnchoredMenu();deleteAppointment('${a.id}')">Delete</button>`,a.name)}</div>${link?`<button class="appointment-link-button" type="button" onclick="openAppointmentLink('${a.id}')">Open meeting or web link</button>`:''}`;
    area.appendChild(row);
  });
}
// Timeline controls. Constants are initialised at the top of the file before the first render.
function setTimelineRange(range,button){
  timelineRange=range;
  document.querySelectorAll('.timeline-filter').forEach(b=>b.classList.toggle('active',b.dataset.range===range));
  if(button)button.classList.add('active');
  renderTimeline();
}
function timelineDateBounds(range){
  const today=dateOnly(localDateKey()),start=new Date(today),end=new Date(today);
  if(range==='tomorrow'){start.setDate(start.getDate()+1);end.setDate(end.getDate()+1);}
  else if(range==='week')end.setDate(end.getDate()+6);
  else if(range==='month')end.setMonth(end.getMonth()+1,0);
  else if(range==='all')end.setDate(end.getDate()+365);
  return {start,end};
}
function timelineItems(){
  const today=new Date();today.setHours(0,0,0,0);
  const items=[];
  const add=(item)=>{
    if(!item||!item.date)return;
    const parsed=dateOnly(String(item.date).slice(0,10));
    if(!parsed||parsed<today)return;
    items.push({...item,date:localDateKey(parsed),name:String(item.name||'Untitled item')});
  };
  try{
    (data.appointments||[]).forEach(a=>{
      appointmentOccurrences(a,today,365).forEach(o=>add({id:a.id,type:'appointment',name:a.name||a.title,date:o.date,time:a.time||'',detail:[a.endTime&&a.time?`${a.time}–${a.endTime}`:a.time,a.location].filter(Boolean).join(' · '),open:()=>openAppointmentDialog(a.id)}));
    });
  }catch(error){console.warn('Timeline appointments skipped',error);}
  (data.todos||[]).filter(x=>!x.completed&&(x.dueDate||x.date)).forEach(x=>add({id:x.id,type:'todo',name:x.name||x.title,date:x.dueDate||x.date,detail:x.details||x.notes||'',open:()=>editTodo(x.id)}));
  (data.projects||[]).filter(x=>!x.completed&&(x.dueDate||x.targetDate||x.date)).forEach(x=>add({id:x.id,type:'project',name:x.name||x.title,date:x.dueDate||x.targetDate||x.date,detail:x.details||x.notes||'',open:()=>editProject(x.id)}));
  (data.cleaningTasks||[]).filter(x=>!x.completed&&(x.nextDue||x.dueDate||x.date)).forEach(x=>add({id:x.id,type:'cleaning',name:x.name||x.title,date:x.nextDue||x.dueDate||x.date,detail:x.room||x.area||'Home',open:()=>editCleaning(x.id)}));
  (data.annualDates||[]).forEach(x=>{
    try{const d=nextAnnualOccurrence(String(x.monthDay||''));if(d)add({id:x.id,type:'annual',name:x.name||x.title,date:localDateKey(d),detail:x.details||x.notes||'',open:()=>editAnnual(x.id)});}catch(error){console.warn('Timeline annual date skipped',error);}
  });
  (data.waiting||[]).filter(x=>!x.completed&&(x.reviewDate||x.dueDate||x.date)).forEach(x=>add({id:x.id,type:'waiting',name:x.name||x.title,date:x.reviewDate||x.dueDate||x.date,detail:x.note||x.details||'Review due',open:()=>editCapture('waiting',x.id)}));
  return items.sort((a,b)=>`${a.date}${a.time||'99:99'}${a.name}`.localeCompare(`${b.date}${b.time||'99:99'}${b.name}`));
}
function renderTimeline(){
  const area=document.getElementById('timelineArea'),summary=document.getElementById('timelineSummary');if(!area)return;
  const {start,end}=timelineDateBounds(timelineRange);
  const items=timelineItems().filter(x=>{const d=dateOnly(x.date);return d>=start&&d<=end;});
  area.innerHTML='';
  const labels={today:'today',tomorrow:'tomorrow',week:'in the next 7 days',month:'this month',all:'in the next year'};
  if(summary)summary.textContent=`${items.length} ${items.length===1?'item':'items'} ${labels[timelineRange]}.`;
  if(!items.length){area.innerHTML='<div class="empty-state">Nothing dated for this period.</div>';return;}
  let current='';
  items.forEach(item=>{
    if(item.date!==current){current=item.date;const h=document.createElement('h3');h.className='timeline-date-heading';h.textContent=formatDate(item.date);area.appendChild(h);}
    const type=TIMELINE_TYPES[item.type],row=document.createElement('button');row.type='button';row.className=`timeline-item timeline-${item.type}`;row.onclick=item.open;
    row.innerHTML=`<span class="timeline-icon" aria-hidden="true">${type.icon}</span><span class="timeline-copy"><strong>${escapeHtml(item.name)}</strong><span class="timeline-meta">${escapeHtml(type.label)}${item.time?' · '+escapeHtml(item.time):''}${item.detail?' · '+escapeHtml(item.detail):''}</span></span><span class="timeline-chevron" aria-hidden="true">›</span>`;
    area.appendChild(row);
  });
}

/* Safe Brain Inbox conversion: an inbox item is only removed after the destination is saved. */
let pendingInboxAppointmentId='';
let pendingInboxDraft=null;
function convertInbox(id,type){
  const x=data.inbox.find(item=>item.id===id);if(!x)return;
  if(type==='appointment'){
    pendingInboxAppointmentId=id;pendingInboxDraft=null;
    openAppointmentDialog('',x.name,x.note||'');
    return;
  }
  if(type==='todo')data.todos.unshift({id:uid(),name:x.name,details:x.note||'',timingType:'none',dueDate:'',completed:false,steps:[]});
  else if(type==='project')data.projects.unshift({id:uid(),name:x.name,details:x.note||'',timingType:'none',dueDate:'',completed:false,steps:[]});
  else data.waiting.unshift({id:uid(),name:x.name,note:x.note||'',reviewDate:'',completed:false});
  data.inbox=data.inbox.filter(item=>item.id!==id);saveData();renderAll();showSaved('Thought converted');
}
const saveAppointmentCore=saveAppointment;
saveAppointment=function(){
  const saved=saveAppointmentCore();
  if(saved&&pendingInboxAppointmentId){data.inbox=data.inbox.filter(x=>x.id!==pendingInboxAppointmentId);pendingInboxAppointmentId='';pendingInboxDraft=null;saveData();renderAll();}
  else if(saved&&pendingInboxDraft){pendingInboxDraft=null;}
  return saved;
};
const closeAppointmentDialogCore=closeAppointmentDialog;
closeAppointmentDialog=function(){pendingInboxAppointmentId='';pendingInboxDraft=null;closeAppointmentDialogCore();};


/* ===== Authoritative Lists renderers =====
   Lists and Home read from the same live data objects. */
function renderTodos() {
  const area = document.getElementById('todoArea');
  if (!area) return;
  area.innerHTML = '';
  const items = Array.isArray(data.todos) ? data.todos : [];
  if (!items.length) {
    area.innerHTML = '<div class="empty-state">No to-do items yet.</div>';
    return;
  }
  [...items].sort(sortByDueDate).forEach(todo => {
    const row = document.createElement('div');
    row.className = `compact-manage-row ${todo.completed ? 'completed-row' : ''}`;
    const timing = escapeHtml(getTimingText(todo) || 'No date');
    const details = todo.details ? ` · ${escapeHtml(todo.details)}` : '';
    const actions = `<button onclick="closeAnchoredMenu();toggleTodo('${todo.id}');refreshListsImmediately()">${todo.completed ? 'Mark active' : 'Complete'}</button><button onclick="closeAnchoredMenu();editTodo('${todo.id}')">Edit</button><button class="danger-text" onclick="closeAnchoredMenu();deleteTodo('${todo.id}');refreshListsImmediately()">Delete</button>`;
    row.innerHTML = `<button type="button" class="compact-row-main" onclick="editTodo('${todo.id}')"><span class="compact-row-title">${escapeHtml(todo.name || 'Untitled to-do')}</span><span class="compact-row-meta">${timing}${details}</span></button>${compactMenu(actions,todo.name || 'to-do')}`;
    area.appendChild(row);

    const steps = Array.isArray(todo.steps) ? todo.steps : [];
    steps.forEach((step,index) => {
      const stepRow=document.createElement('div');
      stepRow.className=`compact-manage-row nested-compact-row ${step.completed?'completed-row':''}`;
      const stepActions=`<button onclick="closeAnchoredMenu();toggleTodoStep('${todo.id}','${step.id}');refreshListsImmediately()">${step.completed?'Mark active':'Complete'}</button><button onclick="closeAnchoredMenu();editTodo('${todo.id}')">Edit to-do</button>`;
      stepRow.innerHTML=`<button type="button" class="compact-row-main" onclick="toggleTodoStep('${todo.id}','${step.id}');refreshListsImmediately()"><span class="compact-row-title">${index+1}. ${escapeHtml(step.name||'Untitled step')}</span><span class="compact-row-meta">${step.dueDate?'Due '+formatDate(step.dueDate):'No date'}</span></button>${compactMenu(stepActions,step.name||'step')}`;
      area.appendChild(stepRow);
    });
  });
}

function renderProjects() {
  const area = document.getElementById('projectsArea');
  if (!area) return;
  area.innerHTML = '';
  const projects = Array.isArray(data.projects) ? data.projects : [];
  if (!projects.length) {
    area.innerHTML = '<div class="empty-state">No projects yet.</div>';
    return;
  }
  [...projects].sort(sortByDueDate).forEach(project => {
    const steps = Array.isArray(project.steps) ? project.steps : [];
    const genuinelyComplete = steps.length > 0 && steps.every(step => step.completed);
    project.completed = genuinelyComplete;
    const completedCount=steps.filter(step=>step.completed).length;
    const row=document.createElement('div');
    row.className=`compact-manage-row project-compact-row ${genuinelyComplete?'completed-row':''}`;
    const projectActions=`<button onclick="closeAnchoredMenu();openAddDialog('step','${project.id}')">Add step</button><button onclick="closeAnchoredMenu();editProject('${project.id}')">Edit project</button><button class="danger-text" onclick="closeAnchoredMenu();deleteProject('${project.id}');refreshListsImmediately()">Delete project</button>`;
    row.innerHTML=`<button type="button" class="compact-row-main" onclick="editProject('${project.id}')"><span class="compact-row-title">${escapeHtml(project.name||'Untitled project')}</span><span class="compact-row-meta">${steps.length?`${completedCount} of ${steps.length} steps`:'No steps'}${project.details?' · '+escapeHtml(project.details):''}</span></button>${compactMenu(projectActions,project.name||'project')}`;
    area.appendChild(row);
    steps.forEach((step,index)=>{
      const stepRow=document.createElement('div');
      stepRow.className=`compact-manage-row nested-compact-row ${step.completed?'completed-row':''}`;
      const stepActions=`<button onclick="closeAnchoredMenu();toggleStep('${project.id}','${step.id}');refreshListsImmediately()">${step.completed?'Mark active':'Complete step'}</button><button onclick="closeAnchoredMenu();editStep('${project.id}','${step.id}')">Edit step</button><button class="danger-text" onclick="closeAnchoredMenu();deleteStep('${project.id}','${step.id}');refreshListsImmediately()">Delete step</button>`;
      stepRow.innerHTML=`<button type="button" class="compact-row-main" onclick="toggleStep('${project.id}','${step.id}');refreshListsImmediately()"><span class="compact-row-title">${index+1}. ${escapeHtml(step.name||'Untitled step')}</span><span class="compact-row-meta">${step.dueDate?'Due '+formatDate(step.dueDate):'No date'}</span></button>${compactMenu(stepActions,step.name||'project step')}`;
      area.appendChild(stepRow);
    });
  });
}

function toggleStep(projectId, stepId) {
  const project = (data.projects || []).find(item => item.id === projectId);
  const step = project && (project.steps || []).find(item => item.id === stepId);
  if (!project || !step) return;
  step.completed = !step.completed;
  project.completed = (project.steps || []).length > 0 && project.steps.every(item => item.completed);
  saveData();
  renderAll();
}

function completeCleaning(id) {
  const task = (data.cleaningTasks || []).find(item => item.id === id);
  if (!task) return;
  const completedOn = localDateKey ? localDateKey() : new Date().toISOString().slice(0,10);
  task.lastCompleted = completedOn;
  task.nextDue = nextCleaningDate(task.nextDue || completedOn, task.frequency || 'weekly');
  saveData();
  renderAll();
}

function renderCleaning() {
  const area = document.getElementById('cleaningArea');
  if (!area) return;
  area.innerHTML = '';
  const items = Array.isArray(data.cleaningTasks) ? data.cleaningTasks : [];
  if (!items.length) {
    area.innerHTML = '<div class="empty-state">No cleaning tasks yet.</div>';
    return;
  }
  [...items].sort((a,b) => String(a.nextDue || '').localeCompare(String(b.nextDue || ''))).forEach(item => {
    const dueNow = isDueTodayOrEarlier(item.nextDue);
    const row=document.createElement('div');
    row.className=`compact-manage-row ${dueNow?'status-overdue':''}`;
    const meta=`${escapeHtml(item.room||'General')} · ${escapeHtml(frequencyLabel(item.frequency||'weekly'))} · Next due ${item.nextDue?formatDate(item.nextDue):'not set'}${item.details?' · '+escapeHtml(item.details):''}`;
    const actions=`<button onclick="closeAnchoredMenu();completeCleaning('${item.id}');refreshListsImmediately()">Complete</button><button onclick="closeAnchoredMenu();editCleaning('${item.id}')">Edit</button><button class="danger-text" onclick="closeAnchoredMenu();deleteCleaning('${item.id}');refreshListsImmediately()">Delete</button>`;
    row.innerHTML=`<button type="button" class="compact-row-main" onclick="editCleaning('${item.id}')"><span class="compact-row-title">${escapeHtml(item.name||'Untitled cleaning task')}</span><span class="compact-row-meta">${meta}</span></button>${compactMenu(actions,item.name||'cleaning task')}`;
    area.appendChild(row);
  });
}



/* ===== Custom lists ===== */
let activeCustomListId='';
function openCustomListManager(listId=''){
  activeCustomListId=String(listId||'');
  const list=(data.customLists||[]).find(x=>String(x.id)===activeCustomListId);
  const title=document.getElementById('customListDialogTitle');
  const name=document.getElementById('customListName');
  const item=document.getElementById('customListNewItem');
  if(title)title.textContent=list?'Edit custom list':'Create custom list';
  if(name)name.value=list?.name||'';
  if(item)item.value='';
  renderCustomListDialogItems();
  document.getElementById('customListDialog')?.showModal();
  setTimeout(()=>name?.focus(),60);
}
function closeCustomListManager(){document.getElementById('customListDialog')?.close();activeCustomListId='';}
function saveCustomListName(closeAfter=true){
  const name=document.getElementById('customListName')?.value.trim();
  if(!name){alert('Please give the list a name.');return;}
  let list=(data.customLists||[]).find(x=>String(x.id)===activeCustomListId);
  if(!list){list={id:uid(),name,items:[]};data.customLists.unshift(list);activeCustomListId=list.id;}
  else list.name=name;
  saveData();renderCustomLists();updateListHubCounts();renderCustomListDialogItems();showSaved('Custom list saved');
  if(closeAfter)closeCustomListManager();
}

function addCustomListItem(){
  let list=(data.customLists||[]).find(x=>String(x.id)===activeCustomListId);
  if(!list){saveCustomListName(false);list=(data.customLists||[]).find(x=>String(x.id)===activeCustomListId);}
  if(!list)return;
  const input=document.getElementById('customListNewItem');const name=input?.value.trim();if(!name)return;
  list.items=list.items||[];list.items.push({id:uid(),name,completed:false});if(input)input.value='';saveData();renderCustomLists();updateListHubCounts();renderCustomListDialogItems();
}
function toggleCustomListItem(listId,itemId){const list=(data.customLists||[]).find(x=>String(x.id)===String(listId));const item=list?.items?.find(x=>String(x.id)===String(itemId));if(!item)return;item.completed=!item.completed;saveData();renderCustomLists();renderCustomListDialogItems();}
function deleteCustomListItem(listId,itemId){const list=(data.customLists||[]).find(x=>String(x.id)===String(listId));if(!list)return;list.items=(list.items||[]).filter(x=>String(x.id)!==String(itemId));saveData();renderCustomLists();updateListHubCounts();renderCustomListDialogItems();}
function deleteActiveCustomList(){deleteCustomList(activeCustomListId);}
function deleteCustomList(listId){const list=(data.customLists||[]).find(x=>String(x.id)===String(listId));if(!list||!confirm(`Delete the list “${list.name}”?`))return;data.customLists=(data.customLists||[]).filter(x=>String(x.id)!==String(listId));saveData();closeCustomListManager();renderCustomLists();updateListHubCounts();}
function renderCustomListDialogItems(){
  const area=document.getElementById('customListDialogItems');if(!area)return;area.innerHTML='';
  const list=(data.customLists||[]).find(x=>String(x.id)===activeCustomListId);
  const del=document.getElementById('deleteCustomListButton');if(del)del.hidden=!list;
  if(!list){area.innerHTML='<div class="empty-state">Save the list name, then add items.</div>';return;}
  if(!(list.items||[]).length){area.innerHTML='<div class="empty-state">No items yet.</div>';return;}
  (list.items||[]).forEach(item=>{const row=document.createElement('div');row.className=`compact-manage-row ${item.completed?'completed-row':''}`;row.innerHTML=`<button type="button" class="complete-dot" onclick="toggleCustomListItem('${list.id}','${item.id}')" aria-label="${item.completed?'Mark active':'Complete'}">${item.completed?'✓':''}</button><button type="button" class="compact-row-main" onclick="toggleCustomListItem('${list.id}','${item.id}')"><span class="compact-row-title">${escapeHtml(item.name)}</span></button><button type="button" class="small-button danger-text" onclick="deleteCustomListItem('${list.id}','${item.id}')">Delete</button>`;area.appendChild(row);});
}
function renderCustomLists(){
  const area=document.getElementById('customListsArea');if(!area)return;area.innerHTML='';
  const lists=data.customLists||[];
  if(!lists.length){area.innerHTML='<div class="empty-state">No custom lists yet. Create one for shopping, packing, ideas or anything else.</div>';return;}
  lists.forEach(list=>{const card=document.createElement('article');card.className='custom-list-card';card.innerHTML=`<div class="custom-list-heading"><div><h3>${escapeHtml(list.name||'Untitled list')}</h3></div><button type="button" class="small-button" onclick="openCustomListManager('${list.id}')">Manage</button></div><div class="stack-list">${(list.items||[]).slice(0,5).map(item=>`<button type="button" class="custom-preview-item ${item.completed?'completed-row':''}" onclick="toggleCustomListItem('${list.id}','${item.id}')"><span>${item.completed?'✓':'○'}</span><span>${escapeHtml(item.name)}</span></button>`).join('')||'<div class="empty-state">No items yet.</div>'}</div>`;area.appendChild(card);});
}

/* ===== Lists refresh ===== */
function refreshListsImmediately() {
  renderTodos();
  renderAppointments();
  renderInbox();
  renderWaiting();
  renderAnnualDates();
  renderProjects();
  renderCleaning();
  renderCustomLists();
  updateListHubCounts();
}

const originalRenderAllV15 = renderAll;
renderAll = function() {
  originalRenderAllV15();
  refreshListsImmediately();
};

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initialiseListSearch);}else{initialiseListSearch();}
