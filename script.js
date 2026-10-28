document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    let progressChart = null;
    let weeklyChart = null;
    let completionPieChart = null;
    let editingTaskId = null;
    let calendarDate = new Date();
    let selectedCalendarDate = null;
    const TASK_KEY = "todo-tasks";
    const DEADLINE_KEY = "todo-deadlines";
    const JOURNAL_KEY = "todo-journal";

    function escapeHTML(value) {
        const div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    }

    function showToast(message) {
        const existing = $("#toast");
        if (existing) {
            const messageElement = $("#toastMessage");
            if (messageElement) messageElement.textContent = message;
            existing.classList.add("show", "active");
            clearTimeout(existing._toastTimer);
            existing._toastTimer = setTimeout(() => {
                existing.classList.remove("show", "active");
            }, 2200);
            return;
        }

        let container = $(".toast-container");

        if (!container) {
            container = document.createElement("div");
            container.className = "toast-container";
            container.style.position = "fixed";
            container.style.right = "24px";
            container.style.bottom = "24px";
            container.style.zIndex = "3000";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => toast.remove(), 2500);
    }

    function readJSON(key, fallback) {
        try {
            const value = JSON.parse(
                localStorage.getItem(key) || "null"
            );

            return value == null ? fallback : value;

        } catch (error) {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );
    }

    function pad(value) {
        return String(value).padStart(2, "0");
    }

    function dateKey(date) {
        return `${date.getFullYear()}-${pad(
            date.getMonth() + 1
        )}-${pad(date.getDate())}`;
    }

    function dateTimeValue(date, time) {
        return new Date(
            `${date}T${time || "23:59"}`
        );
    }

    function formatDateTime(value) {
        const date =
            value instanceof Date
                ? value
                : new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Invalid date";
        }

        return date.toLocaleString(
            undefined,
            {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function formatDateOnly(value) {
        const date =
            value instanceof Date
                ? value
                : new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleDateString(
            undefined,
            {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    }

    function formatTime(value) {
        const date =
            value instanceof Date
                ? value
                : new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleTimeString(
            undefined,
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function normalizeStatus(status) {
        return [
            "pending",
            "in-progress",
            "completed",
            "delayed"
        ].includes(status)
            ? status
            : "pending";
    }

    function statusLabel(status) {
        return {
            pending: "Pending",
            "in-progress": "In Progress",
            completed: "Completed",
            delayed: "Delayed"
        }[normalizeStatus(status)];
    }

    function normalizePriority(priority) {
        return [
            "low",
            "medium",
            "high"
        ].includes(priority)
            ? priority
            : "medium";
    }

    const themeToggle =
        $("#themeToggle");

    const settingsThemeToggle =
        $("#settingsThemeToggle");

    const brightnessRange =
        $("#brightnessRange");

    const brightnessValue =
        $("#brightnessValue");

    function updateThemeIcon() {
        if (!themeToggle) return;

        const icon =
            themeToggle.querySelector("i") ||
            themeToggle.querySelector(
                ".theme-icon"
            );

        if (!icon) return;

        if (
            icon.classList.contains(
                "theme-icon"
            )
        ) {
            icon.textContent =
                document.body.classList.contains(
                    "light-mode"
                )
                    ? "☀️"
                    : "🌙";
        } else {
            icon.className =
                document.body.classList.contains(
                    "light-mode"
                )
                    ? "fa-solid fa-sun"
                    : "fa-solid fa-moon";
        }
    }

    function toggleTheme() {
        document.body.classList.toggle(
            "light-mode"
        );

        localStorage.setItem(
            "todo-theme",
            document.body.classList.contains(
                "light-mode"
            )
                ? "light"
                : "dark"
        );

        updateThemeIcon();
        updateCharts();
    }

    if (
        localStorage.getItem(
            "todo-theme"
        ) === "light"
    ) {
        document.body.classList.add(
            "light-mode"
        );
    }

    themeToggle?.addEventListener(
        "click",
        toggleTheme
    );

    settingsThemeToggle?.addEventListener(
        "click",
        toggleTheme
    );

    updateThemeIcon();

    function applyBrightness(value) {
        const level =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(value) || 0
                )
            );

        document.body.classList.remove(
            "brightness-low",
            "brightness-medium",
            "brightness-high"
        );

        if (level < 40) {
            document.body.classList.add(
                "brightness-low"
            );
        } else if (level < 75) {
            document.body.classList.add(
                "brightness-medium"
            );
        } else {
            document.body.classList.add(
                "brightness-high"
            );
        }

        if (brightnessValue) {
            brightnessValue.textContent =
                `${level}%`;
        }

        if (brightnessRange) {
            brightnessRange.value =
                level;
        }

        localStorage.setItem(
            "todo-brightness",
            String(level)
        );
    }

    if (brightnessRange) {
        applyBrightness(
            localStorage.getItem(
                "todo-brightness"
            ) ??
            brightnessRange.value ??
            50
        );

        brightnessRange.addEventListener(
            "input",
            event => {
                applyBrightness(
                    event.target.value
                );
            }
        );
    }

    const sidebar =
        $(".sidebar");

    const sidebarToggle =
        $("#sidebarToggle");

    const mobileSidebarToggle =
        $("#mobileSidebarToggle");

    const sidebarOverlay =
        $(".sidebar-overlay");

    function toggleSidebar() {
        if (!sidebar) return;

        sidebar.classList.toggle(
            "active"
        );

        sidebarOverlay?.classList.toggle(
            "active"
        );
    }

    sidebarToggle?.addEventListener(
        "click",
        toggleSidebar
    );

    mobileSidebarToggle?.addEventListener(
        "click",
        toggleSidebar
    );

    sidebarOverlay?.addEventListener(
        "click",
        toggleSidebar
    );

    const dashboardSections =
        $$(".dashboard-section");

    const dashboardLinks =
        $$('[data-section]');

    function showDashboardSection(
        sectionName
    ) {
        dashboardSections.forEach(
            section => {
                section.classList.remove(
                    "active"
                );
            }
        );

        const target =
            document.getElementById(
                sectionName
            );

        if (target) {
            target.classList.add(
                "active"
            );
        }

        dashboardLinks.forEach(
            link => {
                link.classList.toggle(
                    "active",
                    link.dataset.section ===
                    sectionName
                );
            }
        );

        if (
            sectionName ===
            "upcoming"
        ) {
            renderCalendar();
            renderUpcomingList();
        }
    }

    dashboardLinks.forEach(
        link => {
            link.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    if (
                        link.dataset.section
                    ) {
                        showDashboardSection(
                            link.dataset.section
                        );
                    }

                    if (
                        window.innerWidth <=
                        900
                    ) {
                        sidebar?.classList.remove(
                            "active"
                        );

                        sidebarOverlay?.classList.remove(
                            "active"
                        );
                    }
                }
            );
        }
    );

    function getTasks() {
        const tasks =
            readJSON(
                TASK_KEY,
                []
            );

        return Array.isArray(tasks)
            ? tasks
            : [];
    }

    function saveTasks(tasks) {
        writeJSON(
            TASK_KEY,
            tasks
        );
    }

    function getDeadlines() {
        const deadlines =
            readJSON(
                DEADLINE_KEY,
                []
            );

        return Array.isArray(
            deadlines
        )
            ? deadlines
            : [];
    }

    function saveDeadlines(
        deadlines
    ) {
        writeJSON(
            DEADLINE_KEY,
            deadlines
        );
    }

    function migrateStaticTasks() {
        const stored =
            getTasks();

        if (stored.length) {
            return stored;
        }

        const staticTasks =
            $$("#tasksList .task-item")
                .map(element => ({
                    id:
                        Number(
                            element.dataset.id
                        ) ||
                        Date.now() +
                        Math.random(),

                    title:
                        $(".task-main h4", element)
                            ?.textContent
                            .trim() ||
                        "Untitled Task",

                    status:
                        normalizeStatus(
                            element.dataset.status
                        ),

                    priority:
                        normalizePriority(
                            element.dataset.priority
                        ),

                    deadlineId:
                        element.dataset
                            .deadlineId ||
                        null,

                    createdAt:
                        new Date().toISOString(),

                    completedAt:
                        element.dataset.status ===
                        "completed"
                            ? new Date().toISOString()
                            : null
                }));

        if (
            staticTasks.length
        ) {
            saveTasks(
                staticTasks
            );
        }

        return staticTasks;
    }

    let tasks =
        migrateStaticTasks();

    function renderTask(task) {
        const status =
            normalizeStatus(
                task.status
            );

        const priority =
            normalizePriority(
                task.priority
            );

        const item =
            document.createElement(
                "div"
            );

        item.className =
            `task-item${
                status === "completed"
                    ? " completed"
                    : ""
            }`;

        item.dataset.id =
            task.id;

        item.dataset.status =
            status;

        item.dataset.priority =
            priority;

        if (task.deadlineId) {
            item.dataset.deadlineId =
                task.deadlineId;
        }

        item.innerHTML = `
            <label class="task-check-wrapper">
                <input type="checkbox" class="task-checkbox" ${
                    status === "completed"
                        ? "checked"
                        : ""
                }>
                <span class="custom-checkbox"></span>
            </label>

            <div class="task-main">
                <h4>${escapeHTML(
                    task.title
                )}</h4>

                <span class="status-badge ${status}">
                    ${statusLabel(status)}
                </span>
            </div>

            <div class="task-meta">
                <span class="priority-badge ${priority}">
                    ${escapeHTML(
                        priority[0].toUpperCase() +
                        priority.slice(1)
                    )}
                </span>
            </div>

            <button
                type="button"
                class="edit-task"
                aria-label="Edit task"
            >
                <i class="fa-solid fa-pen"></i>
            </button>

            <button
                type="button"
                class="delete-task"
                aria-label="Delete task"
            >
                ×
            </button>
        `;

        return item;
    }

    function renderTasks() {
        const list =
            $("#tasksList") ||
            $(".tasks-list");

        const empty =
            $("#taskEmptyState");

        if (!list) return;

        list.innerHTML = "";

        tasks =
            getTasks();

        tasks.forEach(
            task => {
                list.appendChild(
                    renderTask(task)
                );
            }
        );

        updateTaskStatistics();
        applyTaskFilters();
        updateCharts();
        updateNotifications();
    }

    function updateTaskStatus(
        id,
        status
    ) {
        tasks =
            getTasks();

        const task =
            tasks.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!task) return;

        task.status =
            normalizeStatus(
                status
            );

        task.completedAt =
            task.status === "completed"
                ? new Date().toISOString()
                : null;

        saveTasks(tasks);

        if (task.deadlineId) {
            const deadlines =
                getDeadlines();

            const deadline =
                deadlines.find(
                    item =>
                        String(item.id) ===
                        String(task.deadlineId)
                );

            if (deadline) {
                deadline.status =
                    task.status;

                saveDeadlines(
                    deadlines
                );
            }
        }

        renderTasks();
        renderCalendar();
        renderUpcomingList();
    }

    function deleteTask(
        id,
        ask = true
    ) {
        tasks =
            getTasks();

        const task =
            tasks.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!task) return;

        if (
            ask &&
            !confirm(
                `Delete "${task.title}"?`
            )
        ) {
            return;
        }

        tasks =
            tasks.filter(
                item =>
                    String(item.id) !==
                    String(id)
            );

        saveTasks(tasks);

        if (task.deadlineId) {
            const deadlines =
                getDeadlines().filter(
                    item =>
                        String(item.id) !==
                        String(
                            task.deadlineId
                        )
                );

            saveDeadlines(
                deadlines
            );
        }

        renderTasks();
        renderCalendar();
        renderUpcomingList();
        renderCurrentDeadline();

        showToast(
            "Task deleted."
        );
    }

    function openTaskEditor(
        id
    ) {
        const task =
            getTasks().find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!task) return;

        editingTaskId =
            task.id;

        const modal =
            $("#editTaskModal") ||
            $("#taskModal");

        const titleInput =
            $("#editTaskInput") ||
            $("#editTaskTitle");

        const statusInput =
            $("#editTaskStatus");

        const priorityInput =
            $("#editTaskPriority");

        const hidden =
            $("#editingTaskId");

        if (titleInput) {
            titleInput.value =
                task.title;
        }

        if (statusInput) {
            statusInput.value =
                normalizeStatus(
                    task.status
                );
        }

        if (priorityInput) {
            priorityInput.value =
                normalizePriority(
                    task.priority
                );
        }

        if (hidden) {
            hidden.value =
                task.id;
        }

        modal?.classList.add(
            "active"
        );
    }

    function closeTaskEditor() {
        const modal =
            $("#editTaskModal") ||
            $("#taskModal");

        modal?.classList.remove(
            "active"
        );

        editingTaskId =
            null;
    }

    function saveEditedTask(
        event
    ) {
        event?.preventDefault();

        if (
            editingTaskId ==
            null
        ) {
            return;
        }

        const titleInput =
            $("#editTaskInput") ||
            $("#editTaskTitle");

        const statusInput =
            $("#editTaskStatus");

        const priorityInput =
            $("#editTaskPriority");

        const title =
            titleInput?.value.trim() ||
            "";

        if (!title) {
            showToast(
                "Task name cannot be empty."
            );

            return;
        }

        tasks =
            getTasks();

        const task =
            tasks.find(
                item =>
                    String(item.id) ===
                    String(editingTaskId)
            );

        if (!task) return;

        task.title =
            title.slice(
                0,
                120
            );

        task.status =
            normalizeStatus(
                statusInput?.value ||
                task.status
            );

        task.priority =
            normalizePriority(
                priorityInput?.value ||
                task.priority
            );

        task.completedAt =
            task.status ===
            "completed"
                ? (
                    task.completedAt ||
                    new Date().toISOString()
                )
                : null;

        saveTasks(tasks);

        if (task.deadlineId) {
            const deadlines =
                getDeadlines();

            const deadline =
                deadlines.find(
                    item =>
                        String(item.id) ===
                        String(
                            task.deadlineId
                        )
                );

            if (deadline) {
                deadline.title =
                    task.title;

                deadline.status =
                    task.status;

                saveDeadlines(
                    deadlines
                );
            }
        }

        closeTaskEditor();

        renderTasks();
        renderCalendar();
        renderUpcomingList();
        renderCurrentDeadline();

        showToast(
            "Task updated."
        );
    }

    function attachTaskEvents(
        item
    ) {
        const id =
            item.dataset.id;

        const checkbox =
            $(".task-checkbox", item);

        const edit =
            $(".edit-task", item);

        const remove =
            $(".delete-task", item);

        checkbox?.addEventListener(
            "change",
            () => {
                updateTaskStatus(
                    id,
                    checkbox.checked
                        ? "completed"
                        : "pending"
                );
            }
        );

        edit?.addEventListener(
            "click",
            () => {
                openTaskEditor(id);
            }
        );

        remove?.addEventListener(
            "click",
            () => {
                deleteTask(id);
            }
        );
    }

    $("#tasksList")?.addEventListener(
        "click",
        event => {
            const item =
                event.target.closest(
                    ".task-item"
                );

            if (item) {
                if (
                    event.target.closest(
                        ".edit-task"
                    )
                ) {
                    openTaskEditor(
                        item.dataset.id
                    );
                }

                if (
                    event.target.closest(
                        ".delete-task"
                    )
                ) {
                    deleteTask(
                        item.dataset.id
                    );
                }
            }
        }
    );

    $("#tasksList")?.addEventListener(
        "change",
        event => {
            if (
                !event.target.classList.contains(
                    "task-checkbox"
                )
            ) {
                return;
            }

            const item =
                event.target.closest(
                    ".task-item"
                );

            if (item) {
                updateTaskStatus(
                    item.dataset.id,
                    event.target.checked
                        ? "completed"
                        : "pending"
                );
            }
        }
    );

    const editForm =
        $("#editTaskForm");

    editForm?.addEventListener(
        "submit",
        saveEditedTask
    );

    $("#closeEditTaskModal")?.addEventListener(
        "click",
        closeTaskEditor
    );

    $("#closeTaskModal")?.addEventListener(
        "click",
        closeTaskEditor
    );

    $("#cancelEditTask")?.addEventListener(
        "click",
        closeTaskEditor
    );

    $$(".modal-overlay").forEach(
        overlay => {
            overlay.addEventListener(
                "click",
                event => {
                    if (
                        event.target ===
                        overlay
                    ) {
                        overlay.classList.remove(
                            "active"
                        );
                    }
                }
            );
        }
    );

    let activeStatusFilter =
        "all";

    let activePriorityFilter =
        "all";

    function applyTaskFilters() {
        const search =
            (
                $("#taskSearch")
                    ?.value ||
                ""
            )
                .toLowerCase()
                .trim();

        const list =
            $("#tasksList") ||
            $(".tasks-list");

        const empty =
            $("#taskEmptyState");

        if (!list) return;

        const items =
            $$(".task-item", list);

        let visible = 0;

        items.forEach(
            item => {
                const statusMatch =
                    activeStatusFilter ===
                    "all" ||
                    item.dataset.status ===
                    activeStatusFilter;

                const priorityMatch =
                    activePriorityFilter ===
                    "all" ||
                    item.dataset.priority ===
                    activePriorityFilter;

                const textMatch =
                    !search ||
                    item.textContent
                        .toLowerCase()
                        .includes(search);

                const show =
                    statusMatch &&
                    priorityMatch &&
                    textMatch;

                item.style.display =
                    show
                        ? ""
                        : "none";

                if (show) {
                    visible++;
                }
            }
        );

        if (empty) {
            empty.hidden =
                visible !== 0;
        }
    }

    $$('[data-filter]').forEach(
        button => {
            button.addEventListener(
                "click",
                () => {
                    $$('[data-filter]').forEach(
                        btn => {
                            btn.classList.remove(
                                "active"
                            );
                        }
                    );

                    button.classList.add(
                        "active"
                    );

                    activeStatusFilter =
                        button.dataset.filter ||
                        "all";

                    applyTaskFilters();
                }
            );
        }
    );

    $$('[data-priority]').forEach(
        button => {
            button.addEventListener(
                "click",
                () => {
                    $$('[data-priority]').forEach(
                        btn => {
                            btn.classList.remove(
                                "active"
                            );
                        }
                    );

                    button.classList.add(
                        "active"
                    );

                    activePriorityFilter =
                        button.dataset.priority ||
                        "all";

                    applyTaskFilters();
                }
            );
        }
    );

    $("#taskSearch")?.addEventListener(
        "input",
        applyTaskFilters
    );

    const quickAddInput =
        $("#quickAddTask");

    const quickAddStatus =
        $("#quickAddStatus");

    const quickAddButton =
        $("#quickAddButton");

    const quickAddCount =
        $("#quickAddCount") ||
        $("#quickTaskCounter");

    function updateQuickAddCount() {
        if (
            quickAddInput &&
            quickAddCount
        ) {
            quickAddCount.textContent =
                `${quickAddInput.value.length}/120`;
        }
    }

    function addTask() {
        const title =
            quickAddInput?.value.trim() ||
            "";

        const status =
            normalizeStatus(
                quickAddStatus?.value ||
                "pending"
            );

        if (!title) {
            showToast(
                "Please enter a task."
            );

            quickAddInput?.focus();

            return;
        }

        tasks =
            getTasks();

        tasks.unshift({
            id:
                Date.now(),

            title:
                title.slice(
                    0,
                    120
                ),

            status:
                status,

            priority:
                "medium",

            deadlineId:
                null,

            createdAt:
                new Date().toISOString(),

            completedAt:
                status === "completed"
                    ? new Date().toISOString()
                    : null
        });

        saveTasks(tasks);

        if (quickAddInput) {
            quickAddInput.value =
                "";
        }

        if (quickAddStatus) {
            quickAddStatus.value =
                "pending";
        }

        updateQuickAddCount();

        renderTasks();

        showToast(
            "Task added."
        );
    }

    quickAddButton?.addEventListener(
        "click",
        addTask
    );

    quickAddInput?.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Enter"
            ) {
                event.preventDefault();
                addTask();
            }
        }
    );

    quickAddInput?.addEventListener(
        "input",
        updateQuickAddCount
    );

    updateQuickAddCount();

    $("#dashboardAddTask")?.addEventListener(
        "click",
        () => {
            showDashboardSection(
                "tasks"
            );

            setTimeout(
                () =>
                    quickAddInput?.focus(),
                50
            );
        }
    );

    $("#clearCompleted")?.addEventListener(
        "click",
        () => {
            tasks =
                getTasks();

            const completed =
                tasks.filter(
                    task =>
                        normalizeStatus(
                            task.status
                        ) ===
                        "completed"
                );

            if (
                !completed.length
            ) {
                showToast(
                    "No completed tasks to clear."
                );

                return;
            }

            const deadlineIds =
                completed
                    .map(
                        task =>
                            task.deadlineId
                    )
                    .filter(Boolean)
                    .map(String);

            tasks =
                tasks.filter(
                    task =>
                        normalizeStatus(
                            task.status
                        ) !==
                        "completed"
                );

            saveTasks(tasks);

            if (
                deadlineIds.length
            ) {
                saveDeadlines(
                    getDeadlines().filter(
                        deadline =>
                            !deadlineIds.includes(
                                String(
                                    deadline.id
                                )
                            )
                    )
                );
            }

            renderTasks();
            renderCalendar();
            renderUpcomingList();
            renderCurrentDeadline();

            showToast(
                "Completed tasks cleared."
            );
        }
    );

    function updateTaskStatistics() {
        const currentTasks =
            getTasks();

        const total =
            currentTasks.length;

        const completed =
            currentTasks.filter(
                task =>
                    normalizeStatus(
                        task.status
                    ) ===
                    "completed"
            ).length;

        const remaining =
            Math.max(
                total -
                completed,
                0
            );

        const percentage =
            total
                ? Math.round(
                    (
                        completed /
                        total
                    ) *
                    100
                )
                : 0;

        const values = {
            "#totalTasks":
                total,

            "#completedTasks":
                completed,

            "#remainingTasks":
                remaining,

            "#progressPercentage":
                `${percentage}%`,

            "#analyticsProgress":
                `${percentage}%`,

            "#analyticsProgressLarge":
                `${percentage}%`,

            "#analyticsTotal":
                total,

            "#analyticsCompleted":
                completed,

            "#analyticsPending":
                remaining,

            "#analyticsRate":
                `${percentage}%`
        };

        Object.entries(
            values
        ).forEach(
            ([selector, value]) => {
                const element =
                    $(selector);

                if (element) {
                    element.textContent =
                        value;
                }
            }
        );
    }

    const deadlineForm =
        $("#deadlineForm");

    const deadlineTitleInput =
        $("#deadlineTitle");

    const deadlineDateInput =
        $("#deadlineDate");

    const deadlineTimeInput =
        $("#deadlineTime");

    const savedDeadline =
        $("#savedDeadline");

    function createDeadlineTask(
        deadline
    ) {
        tasks =
            getTasks();

        const existing =
            tasks.find(
                task =>
                    String(task.id) ===
                    String(
                        deadline.taskId
                    )
            );

        if (existing) {
            existing.title =
                deadline.title;

            existing.status =
                normalizeStatus(
                    deadline.status ||
                    existing.status
                );

            existing.deadlineId =
                deadline.id;

            saveTasks(tasks);

            return existing;
        }

        const task = {
            id:
                Date.now() +
                Math.floor(
                    Math.random() *
                    1000
                ),

            title:
                deadline.title,

            status:
                normalizeStatus(
                    deadline.status ||
                    "pending"
                ),

            priority:
                "high",

            deadlineId:
                deadline.id,

            createdAt:
                new Date().toISOString(),

            completedAt:
                null
        };

        tasks.unshift(task);

        deadline.taskId =
            task.id;

        saveTasks(tasks);

        return task;
    }

    function renderCurrentDeadline() {
        if (!savedDeadline) {
            return;
        }

        const deadlines =
            getDeadlines()
                .map(
                    item => ({
                        ...item,
                        dateObject:
                            dateTimeValue(
                                item.date,
                                item.time
                            )
                    })
                )
                .filter(
                    item =>
                        !Number.isNaN(
                            item.dateObject.getTime()
                        )
                )
                .sort(
                    (a, b) =>
                        a.dateObject -
                        b.dateObject
                );

        if (!deadlines.length) {
            savedDeadline.innerHTML = `
                <div>
                    <span class="stat-label">
                        Current deadline
                    </span>

                    <h3>
                        No deadline set
                    </h3>

                    <p>
                        Choose a project date and time above.
                    </p>
                </div>

                <i class="fa-solid fa-flag-checkered"></i>
            `;

            return;
        }

        const deadline =
            deadlines.find(
                item =>
                    item.dateObject >=
                    new Date()
            ) ||
            deadlines[0];

        savedDeadline.innerHTML = `
            <div>
                <span class="stat-label">
                    Current deadline
                </span>

                <h3>
                    ${escapeHTML(
                        deadline.title
                    )}
                </h3>

                <p>
                    ${escapeHTML(
                        formatDateTime(
                            deadline.dateObject
                        )
                    )}
                </p>

                <div
                    style="
                        display:flex;
                        gap:8px;
                        margin-top:10px;
                        flex-wrap:wrap;
                    "
                >
                    <button
                        type="button"
                        class="secondary-button"
                        data-dashboard-edit-deadline="${deadline.id}"
                    >
                        <i class="fa-solid fa-pen"></i>
                        Edit
                    </button>

                    <button
                        type="button"
                        class="danger-button"
                        data-dashboard-delete-deadline="${deadline.id}"
                    >
                        <i class="fa-solid fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>

            <i class="fa-solid fa-flag-checkered"></i>
        `;
    }

    function addOrUpdateDeadline(
        event
    ) {
        event.preventDefault();

        const title =
            deadlineTitleInput
                ?.value.trim() ||
            "";

        const date =
            deadlineDateInput
                ?.value ||
            "";

        const time =
            deadlineTimeInput
                ?.value ||
            "";

        if (
            !title ||
            !date ||
            !time
        ) {
            showToast(
                "Please complete project name, date and time."
            );

            return;
        }

        const dateObject =
            dateTimeValue(
                date,
                time
            );

        if (
            Number.isNaN(
                dateObject.getTime()
            )
        ) {
            showToast(
                "Please choose a valid date and time."
            );

            return;
        }

        const deadline = {
            id:
                Date.now(),

            title:
                title.slice(
                    0,
                    120
                ),

            date:
                date,

            time:
                time,

            dateTime:
                `${date}T${time}`,

            status:
                "pending",

            taskId:
                null,

            createdAt:
                new Date().toISOString()
        };

        createDeadlineTask(
            deadline
        );

        const deadlines =
            getDeadlines();

        deadlines.push(
            deadline
        );

        saveDeadlines(
            deadlines
        );

        deadlineForm?.reset();

        renderTasks();
        renderCurrentDeadline();
        renderCalendar();
        renderUpcomingList();
        updateNotifications();

        showToast(
            "Submission deadline saved and added to My Tasks."
        );
    }

    deadlineForm?.addEventListener(
        "submit",
        addOrUpdateDeadline
    );

    function editDeadline(
        id
    ) {
        const deadlines =
            getDeadlines();

        const deadline =
            deadlines.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!deadline) {
            return;
        }

        const title =
            prompt(
                "Edit project / submission name:",
                deadline.title
            );

        if (title === null) {
            return;
        }

        if (!title.trim()) {
            showToast(
                "Project name cannot be empty."
            );

            return;
        }

        const date =
            prompt(
                "Edit submission date (YYYY-MM-DD):",
                deadline.date
            );

        if (date === null) {
            return;
        }

        const time =
            prompt(
                "Edit submission time (HH:MM):",
                deadline.time
            );

        if (time === null) {
            return;
        }

        const parsed =
            dateTimeValue(
                date.trim(),
                time.trim()
            );

        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {
            showToast(
                "Use date YYYY-MM-DD and time HH:MM."
            );

            return;
        }

        deadline.title =
            title
                .trim()
                .slice(
                    0,
                    120
                );

        deadline.date =
            date.trim();

        deadline.time =
            time.trim();

        deadline.dateTime =
            `${deadline.date}T${deadline.time}`;

        const linkedTask =
            getTasks().find(
                task =>
                    String(task.id) ===
                    String(
                        deadline.taskId
                    )
            );

        if (linkedTask) {
            linkedTask.title =
                deadline.title;
        }

        saveTasks(
            getTasks()
        );

        saveDeadlines(
            deadlines
        );

        renderTasks();
        renderCurrentDeadline();
        renderCalendar();
        renderUpcomingList();
        updateNotifications();

        showToast(
            "Submission updated."
        );
    }

    function deleteDeadline(
        id,
        ask = true
    ) {
        const deadlines =
            getDeadlines();

        const deadline =
            deadlines.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!deadline) {
            return;
        }

        if (
            ask &&
            !confirm(
                `Delete submission "${deadline.title}"?`
            )
        ) {
            return;
        }

        saveDeadlines(
            deadlines.filter(
                item =>
                    String(item.id) !==
                    String(id)
            )
        );

        if (deadline.taskId) {
            saveTasks(
                getTasks().filter(
                    task =>
                        String(task.id) !==
                        String(
                            deadline.taskId
                        )
                )
            );
        }

        renderTasks();
        renderCurrentDeadline();
        renderCalendar();
        renderUpcomingList();
        updateNotifications();

        showToast(
            "Submission deleted."
        );
    }

    savedDeadline?.addEventListener(
        "click",
        event => {
            const edit =
                event.target.closest(
                    "[data-dashboard-edit-deadline]"
                );

            const remove =
                event.target.closest(
                    "[data-dashboard-delete-deadline]"
                );

            if (edit) {
                editDeadline(
                    edit.dataset
                        .dashboardEditDeadline
                );
            }

            if (remove) {
                deleteDeadline(
                    remove.dataset
                        .dashboardDeleteDeadline
                );
            }
        }
    );

    const calendarDays =
        $("#calendarDays");

    const calendarMonth =
        $("#calendarMonth");

    const previousMonth =
        $("#previousMonth");

    const nextMonth =
        $("#nextMonth");

    const upcomingList =
        $("#upcomingList");

    function ensureUpcomingFilterBar() {
        const box =
            $(".calendar-box");

        if (
            !box ||
            $("#upcomingFilterBar")
        ) {
            return;
        }

        const bar =
            document.createElement(
                "div"
            );

        bar.id =
            "upcomingFilterBar";

        bar.style.display =
            "flex";

        bar.style.alignItems =
            "center";

        bar.style.gap =
            "8px";

        bar.style.flexWrap =
            "wrap";

        bar.style.marginTop =
            "14px";

        bar.style.paddingTop =
            "14px";

        bar.style.borderTop =
            "1px solid var(--border)";

        bar.innerHTML = `
            <button
                type="button"
                class="secondary-button"
                id="upcomingNearestFilter"
            >
                Nearest
            </button>

            <button
                type="button"
                class="secondary-button"
                id="upcomingTodayFilter"
            >
                Today
            </button>

            <input
                type="date"
                id="upcomingDateFilter"
                aria-label="Filter upcoming submissions by date"
                style="
                    flex:1;
                    min-width:150px;
                "
            >
        `;

        box.appendChild(
            bar
        );

        $("#upcomingNearestFilter")
            ?.addEventListener(
                "click",
                () => {
                    selectedCalendarDate =
                        null;

                    renderUpcomingList();
                }
            );

        $("#upcomingTodayFilter")
            ?.addEventListener(
                "click",
                () => {
                    selectedCalendarDate =
                        dateKey(
                            new Date()
                        );

                    calendarDate =
                        new Date();

                    renderCalendar();
                    renderUpcomingList();
                }
            );

        $("#upcomingDateFilter")
            ?.addEventListener(
                "change",
                event => {
                    selectedCalendarDate =
                        event.target.value ||
                        null;

                    if (
                        selectedCalendarDate
                    ) {
                        const parts =
                            selectedCalendarDate
                                .split("-")
                                .map(Number);

                        calendarDate =
                            new Date(
                                parts[0],
                                parts[1] - 1,
                                parts[2]
                            );

                        renderCalendar();
                    }

                    renderUpcomingList();
                }
            );
    }

    function getDeadlineDate(
        deadline
    ) {
        const value =
            deadline.dateTime ||
            `${deadline.date}T${
                deadline.time ||
                "23:59"
            }`;

        const result =
            new Date(value);

        return result;
    }

    function renderCalendar() {
        if (!calendarDays) {
            return;
        }

        ensureUpcomingFilterBar();

        const year =
            calendarDate.getFullYear();

        const month =
            calendarDate.getMonth();

        const monthLabel =
            calendarDate.toLocaleDateString(
                undefined,
                {
                    month: "long",
                    year: "numeric"
                }
            );

        if (calendarMonth) {
            calendarMonth.textContent =
                monthLabel;
        }

        calendarDays.innerHTML =
            "";

        const firstDay =
            new Date(
                year,
                month,
                1
            ).getDay();

        const daysInMonth =
            new Date(
                year,
                month + 1,
                0
            ).getDate();

        const deadlines =
            getDeadlines();

        const todayKey =
            dateKey(
                new Date()
            );

        for (
            let i = 0;
            i < firstDay;
            i++
        ) {
            const empty =
                document.createElement(
                    "span"
                );

            empty.className =
                "calendar-day empty";

            calendarDays.appendChild(
                empty
            );
        }

        for (
            let day = 1;
            day <= daysInMonth;
            day++
        ) {
            const current =
                new Date(
                    year,
                    month,
                    day
                );

            const key =
                dateKey(current);

            const cell =
                document.createElement(
                    "button"
                );

            cell.type =
                "button";

            cell.className =
                "calendar-day";

            cell.dataset.date =
                key;

            cell.textContent =
                day;

            if (
                key ===
                todayKey
            ) {
                cell.classList.add(
                    "today"
                );
            }

            if (
                key ===
                selectedCalendarDate
            ) {
                cell.classList.add(
                    "selected"
                );
            }

            if (
                deadlines.some(
                    deadline =>
                        dateKey(
                            getDeadlineDate(
                                deadline
                            )
                        ) === key
                )
            ) {
                cell.classList.add(
                    "has-task",
                    "has-event"
                );
            }

            cell.addEventListener(
                "click",
                () => {
                    selectedCalendarDate =
                        key;

                    const filter =
                        $("#upcomingDateFilter");

                    if (filter) {
                        filter.value =
                            key;
                    }

                    renderCalendar();
                    renderUpcomingList();
                }
            );

            calendarDays.appendChild(
                cell
            );
        }

        const totalCells =
            firstDay +
            daysInMonth;

        const remaining =
            Math.max(
                0,
                42 -
                totalCells
            );

        for (
            let day = 1;
            day <= remaining;
            day++
        ) {
            const empty =
                document.createElement(
                    "span"
                );

            empty.className =
                "calendar-day empty";

            calendarDays.appendChild(
                empty
            );
        }

        const filter =
            $("#upcomingDateFilter");

        if (filter) {
            filter.value =
                selectedCalendarDate ||
                "";
        }
    }

    previousMonth?.addEventListener(
        "click",
        () => {
            calendarDate =
                new Date(
                    calendarDate.getFullYear(),
                    calendarDate.getMonth() - 1,
                    1
                );

            selectedCalendarDate =
                null;

            renderCalendar();
            renderUpcomingList();
        }
    );

    nextMonth?.addEventListener(
        "click",
        () => {
            calendarDate =
                new Date(
                    calendarDate.getFullYear(),
                    calendarDate.getMonth() + 1,
                    1
                );

            selectedCalendarDate =
                null;

            renderCalendar();
            renderUpcomingList();
        }
    );

    function deadlineStatus(
        deadline
    ) {
        const linkedTask =
            getTasks().find(
                task =>
                    String(task.id) ===
                    String(
                        deadline.taskId
                    )
            );

        if (linkedTask) {
            return normalizeStatus(
                linkedTask.status
            );
        }

        if (
            normalizeStatus(
                deadline.status
            ) ===
            "completed"
        ) {
            return "completed";
        }

        const due =
            getDeadlineDate(
                deadline
            );

        if (
            due < new Date()
        ) {
            return "delayed";
        }

        return due.toDateString() ===
            new Date().toDateString()
            ? "in-progress"
            : "pending";
    }

    function renderUpcomingList() {
        if (!upcomingList) {
            return;
        }

        const now =
            new Date();

        let items =
            getDeadlines()
                .map(
                    deadline => ({
                        ...deadline,
                        dateObject:
                            getDeadlineDate(
                                deadline
                            )
                    })
                )
                .filter(
                    deadline =>
                        !Number.isNaN(
                            deadline
                                .dateObject
                                .getTime()
                        )
                );

        if (
            selectedCalendarDate
        ) {
            items =
                items.filter(
                    deadline =>
                        dateKey(
                            deadline.dateObject
                        ) ===
                        selectedCalendarDate
                );
        } else {
            items =
                items.filter(
                    deadline => {
                        const status =
                            deadlineStatus(
                                deadline
                            );

                        return (
                            deadline.dateObject >=
                            now ||
                            status ===
                            "completed" ||
                            status ===
                            "delayed"
                        );
                    }
                );
        }

        items.sort(
            (a, b) =>
                a.dateObject -
                b.dateObject
        );

        const clearButton = `
            <div
                style="
                    display:flex;
                    justify-content:flex-end;
                    margin-top:12px;
                "
            >
                <button
                    type="button"
                    class="secondary-button"
                    id="clearUpcomingCompleted"
                >
                    <i class="fa-solid fa-broom"></i>
                    Clear Completed
                </button>
            </div>
        `;

        if (!items.length) {
            upcomingList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-calendar-xmark"></i>

                    <h3>
                        ${
                            selectedCalendarDate
                                ? "No submissions on this date"
                                : "No upcoming submissions"
                        }
                    </h3>

                    <p>
                        ${
                            selectedCalendarDate
                                ? "Select another date or use Nearest to see your schedule."
                                : "Set a project deadline from the Dashboard."
                        }
                    </p>
                </div>

                ${clearButton}
            `;

            attachUpcomingControls();

            return;
        }

        upcomingList.innerHTML =
            items.map(
                item => {
                    const status =
                        deadlineStatus(
                            item
                        );

                    const label =
                        statusLabel(
                            status
                        );

                    return `
                        <div
                            class="upcoming-item"
                            data-deadline-id="${item.id}"
                        >
                            <div
                                style="
                                    display:flex;
                                    align-items:flex-start;
                                    justify-content:space-between;
                                    gap:12px;
                                "
                            >
                                <div>
                                    <h4>
                                        ${escapeHTML(
                                            item.title
                                        )}
                                    </h4>

                                    <p>
                                        <i class="fa-regular fa-calendar"></i>
                                        ${escapeHTML(
                                            formatDateOnly(
                                                item.dateObject
                                            )
                                        )}
                                    </p>

                                    <p>
                                        <i class="fa-regular fa-clock"></i>
                                        ${escapeHTML(
                                            formatTime(
                                                item.dateObject
                                            )
                                        )}
                                    </p>
                                </div>

                                <span
                                    class="status-badge ${status}"
                                >
                                    ${label}
                                </span>
                            </div>

                            <div
                                style="
                                    display:flex;
                                    gap:8px;
                                    justify-content:flex-end;
                                    margin-top:10px;
                                    flex-wrap:wrap;
                                "
                            >
                                <button
                                    type="button"
                                    class="secondary-button"
                                    data-edit-deadline="${item.id}"
                                >
                                    <i class="fa-solid fa-pen"></i>
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="danger-button"
                                    data-delete-deadline="${item.id}"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                    Delete
                                </button>
                            </div>
                        </div>
                    `;
                }
            )
            .join("") +
            clearButton;

        attachUpcomingControls();
    }

    function attachUpcomingControls() {
        $$(
            "[data-edit-deadline]"
        ).forEach(
            button => {
                button.addEventListener(
                    "click",
                    () =>
                        editDeadline(
                            button.dataset
                                .editDeadline
                        )
                );
            }
        );

        $$(
            "[data-delete-deadline]"
        ).forEach(
            button => {
                button.addEventListener(
                    "click",
                    () =>
                        deleteDeadline(
                            button.dataset
                                .deleteDeadline
                        )
                );
            }
        );

        $("#clearUpcomingCompleted")
            ?.addEventListener(
                "click",
                () => {
                    const completedDeadlines =
                        getDeadlines().filter(
                            deadline =>
                                deadlineStatus(
                                    deadline
                                ) ===
                                "completed"
                        );

                    if (
                        !completedDeadlines.length
                    ) {
                        showToast(
                            "No completed submissions to clear."
                        );

                        return;
                    }

                    const ids =
                        completedDeadlines
                            .map(
                                deadline =>
                                    String(
                                        deadline.id
                                    )
                            );

                    const taskIds =
                        completedDeadlines
                            .map(
                                deadline =>
                                    deadline.taskId
                            )
                            .filter(Boolean)
                            .map(String);

                    saveDeadlines(
                        getDeadlines().filter(
                            deadline =>
                                !ids.includes(
                                    String(
                                        deadline.id
                                    )
                                )
                        )
                    );

                    saveTasks(
                        getTasks().filter(
                            task =>
                                !taskIds.includes(
                                    String(
                                        task.id
                                    )
                                )
                        )
                    );

                    renderTasks();
                    renderCalendar();
                    renderUpcomingList();
                    renderCurrentDeadline();

                    showToast(
                        "Completed submissions cleared."
                    );
                }
            );
    }

    const journalText =
        $("#journalText");

    const journalCount =
        $("#journalCount");

    const journalDate =
        $("#journalDate");

    const journalTime =
        $("#journalTime");

    const saveJournal =
        $("#saveJournal");

    const clearJournal =
        $("#clearJournal");

    const journalHistory =
        $("#journalHistory");

    function getJournalEntries() {
        const value =
            readJSON(
                JOURNAL_KEY,
                []
            );

        return Array.isArray(value)
            ? value
            : [];
    }

    function saveJournalEntries(
        entries
    ) {
        writeJSON(
            JOURNAL_KEY,
            entries
        );
    }

    function updateJournalCount() {
        if (
            journalText &&
            journalCount
        ) {
            journalCount.textContent =
                `${journalText.value.length}/3000`;
        }
    }

    function currentJournalDateTime() {
        const date =
            journalDate?.value ||
            dateKey(new Date());

        const time =
            journalTime?.value ||
            `${pad(
                new Date().getHours()
            )}:${pad(
                new Date().getMinutes()
            )}`;

        return {
            date,
            time,
            dateTime:
                `${date}T${time}`
        };
    }

    function loadJournalForSelection() {
        if (!journalText) {
            return;
        }

        const { date } =
            currentJournalDateTime();

        const entries =
            getJournalEntries()
                .filter(
                    entry =>
                        entry.date ===
                        date
                );

        const latest =
            entries.sort(
                (a, b) =>
                    new Date(
                        b.dateTime
                    ) -
                    new Date(
                        a.dateTime
                    )
            )[0];

        journalText.value =
            latest?.text ||
            "";

        updateJournalCount();
    }

    function renderJournalHistory() {
        if (!journalHistory) {
            return;
        }

        const entries =
            getJournalEntries().sort(
                (a, b) =>
                    new Date(
                        b.dateTime
                    ) -
                    new Date(
                        a.dateTime
                    )
            );

        if (!entries.length) {
            journalHistory.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-note-sticky"></i>

                    <h3>
                        No diary entries yet
                    </h3>

                    <p>
                        Your saved entries will appear here.
                    </p>
                </div>
            `;

            return;
        }

        journalHistory.innerHTML =
            entries
                .map(
                    entry => `
                        <div
                            class="journal-entry"
                            data-journal-id="${entry.id}"
                            style="
                                padding:14px;
                                border:1px solid var(--border);
                                border-radius:10px;
                                background:var(--card-light);
                                margin-bottom:10px;
                            "
                        >
                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    gap:12px;
                                    align-items:flex-start;
                                "
                            >
                                <strong>
                                    ${escapeHTML(
                                        formatDateTime(
                                            entry.dateTime
                                        )
                                    )}
                                </strong>

                                <button
                                    type="button"
                                    class="delete-journal"
                                    data-id="${entry.id}"
                                    aria-label="Delete diary entry"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>

                            <p
                                style="
                                    margin-top:8px;
                                    white-space:pre-wrap;
                                "
                            >
                                ${escapeHTML(
                                    entry.text
                                )}
                            </p>
                        </div>
                    `
                )
                .join("");

        $(
            ".delete-journal",
            journalHistory
        ).forEach(
            button => {
                button.addEventListener(
                    "click",
                    () => {
                        const entries =
                            getJournalEntries()
                                .filter(
                                    entry =>
                                        String(
                                            entry.id
                                        ) !==
                                        String(
                                            button.dataset
                                                .id
                                        )
                                );

                        saveJournalEntries(
                            entries
                        );

                        renderJournalHistory();
                        loadJournalForSelection();

                        showToast(
                            "Diary entry deleted."
                        );
                    }
                );
            }
        );
    }

    if (
        journalDate &&
        !journalDate.value
    ) {
        journalDate.value =
            dateKey(
                new Date()
            );
    }

    if (
        journalTime &&
        !journalTime.value
    ) {
        journalTime.value =
            `${pad(
                new Date().getHours()
            )}:${pad(
                new Date().getMinutes()
            )}`;
    }

    journalText?.addEventListener(
        "input",
        updateJournalCount
    );

    journalDate?.addEventListener(
        "change",
        loadJournalForSelection
    );

    journalTime?.addEventListener(
        "change",
        loadJournalForSelection
    );

    saveJournal?.addEventListener(
        "click",
        () => {
            const text =
                journalText?.value.trim() ||
                "";

            if (!text) {
                showToast(
                    "Write something before saving your diary entry."
                );

                return;
            }

            const {
                date,
                time,
                dateTime
            } =
                currentJournalDateTime();

            const entries =
                getJournalEntries();

            entries.unshift({
                id:
                    Date.now(),

                date:
                    date,

                time:
                    time,

                dateTime:
                    dateTime,

                text:
                    text.slice(
                        0,
                        3000
                    )
            });

            saveJournalEntries(
                entries
            );

            if (journalText) {
                journalText.value =
                    "";
            }

            updateJournalCount();
            renderJournalHistory();

            showToast(
                "Diary entry saved."
            );
        }
    );

    clearJournal?.addEventListener(
        "click",
        () => {
            if (journalText) {
                journalText.value =
                    "";
            }

            updateJournalCount();
        }
    );

    const notificationButton =
        $("#notificationButton");

    const notificationPanel =
        $("#notificationPanel");

    const closeNotifications =
        $("#closeNotifications");

    const notificationList =
        $("#notificationList");

    const notificationDot =
        $("#notificationDot");

    function getNotifications() {
        const notifications =
            [];

        const now =
            new Date();

        getDeadlines().forEach(
            deadline => {
                const due =
                    getDeadlineDate(
                        deadline
                    );

                if (
                    Number.isNaN(
                        due.getTime()
                    )
                ) {
                    return;
                }

                const diff =
                    due - now;

                const status =
                    deadlineStatus(
                        deadline
                    );

                if (
                    status !==
                    "completed" &&
                    diff > 0 &&
                    diff <=
                        7 *
                        24 *
                        60 *
                        60 *
                        1000
                ) {
                    notifications.push({
                        title:
                            "Upcoming submission",

                        message:
                            `${deadline.title} is due ${formatDateTime(due)}.`
                    });
                }

                if (
                    status ===
                    "delayed"
                ) {
                    notifications.push({
                        title:
                            "Delayed submission",

                        message:
                            `${deadline.title} has passed its deadline.`
                    });
                }
            }
        );

        getTasks().forEach(
            task => {
                if (
                    normalizeStatus(
                        task.status
                    ) ===
                    "in-progress"
                ) {
                    notifications.push({
                        title:
                            "Task in progress",

                        message:
                            task.title
                    });
                }
            }
        );

        return notifications.slice(
            0,
            12
        );
    }

    function updateNotifications() {
        if (!notificationList) {
            return;
        }

        const notifications =
            getNotifications();

        if (notificationDot) {
            notificationDot.style.display =
                notifications.length
                    ? "block"
                    : "none";
        }

        if (!notifications.length) {
            notificationList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-bell"></i>

                    <h3>
                        No new notifications
                    </h3>

                    <p>
                        You're all caught up.
                    </p>
                </div>
            `;

            return;
        }

        notificationList.innerHTML =
            notifications
                .map(
                    item => `
                        <div class="notification-item">
                            <strong>
                                ${escapeHTML(
                                    item.title
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    item.message
                                )}
                            </span>
                        </div>
                    `
                )
                .join("");
    }

    notificationButton?.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            notificationPanel?.classList.toggle(
                "active"
            );

            notificationPanel?.setAttribute(
                "aria-hidden",
                notificationPanel?.classList.contains(
                    "active"
                )
                    ? "false"
                    : "true"
            );

            updateNotifications();
        }
    );

    closeNotifications?.addEventListener(
        "click",
        () => {
            notificationPanel?.classList.remove(
                "active"
            );

            notificationPanel?.setAttribute(
                "aria-hidden",
                "true"
            );
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (
                notificationPanel &&
                notificationPanel.classList.contains(
                    "active"
                ) &&
                !notificationPanel.contains(
                    event.target
                ) &&
                !notificationButton?.contains(
                    event.target
                )
            ) {
                notificationPanel.classList.remove(
                    "active"
                );

                notificationPanel.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        }
    );

    function chartTextColor() {
        return document.body.classList.contains(
            "light-mode"
        )
            ? "#1f2937"
            : "#f5f7ff";
    }

    function chartGridColor() {
        return document.body.classList.contains(
            "light-mode"
        )
            ? "rgba(0,0,0,.08)"
            : "rgba(255,255,255,.08)";
    }

    function getWeeklyCompletedCounts() {
        const result = [
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ];

        const now =
            new Date();

        const start =
            new Date(now);

        start.setDate(
            now.getDate() -
            (
                (
                    now.getDay() +
                    6
                ) %
                7
            )
        );

        start.setHours(
            0,
            0,
            0,
            0
        );

        getTasks().forEach(
            task => {
                if (
                    normalizeStatus(
                        task.status
                    ) !==
                    "completed" ||
                    !task.completedAt
                ) {
                    return;
                }

                const completed =
                    new Date(
                        task.completedAt
                    );

                const diff =
                    Math.floor(
                        (
                            completed -
                            start
                        ) /
                        86400000
                    );

                if (
                    diff >= 0 &&
                    diff < 7
                ) {
                    result[diff]++;
                }
            }
        );

        return result;
    }

    function createCharts() {
        if (
            typeof Chart ===
            "undefined"
        ) {
            return;
        }

        const progressCanvas =
            $("#progressChart");

        if (progressCanvas) {
            progressChart?.destroy();

            const currentTasks =
                getTasks();

            const completed =
                currentTasks.filter(
                    task =>
                        normalizeStatus(
                            task.status
                        ) ===
                        "completed"
                ).length;

            const remaining =
                Math.max(
                    currentTasks.length -
                    completed,
                    0
                );

            progressChart =
                new Chart(
                    progressCanvas,
                    {
                        type:
                            "doughnut",

                        data: {
                            labels: [
                                "Completed",
                                "Remaining"
                            ],

                            datasets: [{
                                data: [
                                    completed,
                                    remaining
                                ],

                                backgroundColor: [
                                    "#7c5cff",
                                    "rgba(124,92,255,.15)"
                                ],

                                borderWidth:
                                    0
                            }]
                        },

                        options: {
                            responsive:
                                true,

                            maintainAspectRatio:
                                false,

                            cutout:
                                "72%",

                            plugins: {
                                legend: {
                                    position:
                                        "bottom",

                                    labels: {
                                        color:
                                            chartTextColor(),

                                        usePointStyle:
                                            true
                                    }
                                }
                            }
                        }
                    }
                );
        }

        const weeklyCanvas =
            $("#weeklyChart");

        if (weeklyCanvas) {
            weeklyChart?.destroy();

            weeklyChart =
                new Chart(
                    weeklyCanvas,
                    {
                        type:
                            "bar",

                        data: {
                            labels: [
                                "Mon",
                                "Tue",
                                "Wed",
                                "Thu",
                                "Fri",
                                "Sat",
                                "Sun"
                            ],

                            datasets: [{
                                label:
                                    "Tasks Completed",

                                data:
                                    getWeeklyCompletedCounts(),

                                backgroundColor:
                                    "#7c5cff",

                                borderRadius:
                                    7
                            }]
                        },

                        options: {
                            responsive:
                                true,

                            maintainAspectRatio:
                                false,

                            scales: {
                                x: {
                                    grid: {
                                        display:
                                            false
                                    },

                                    ticks: {
                                        color:
                                            chartTextColor()
                                    }
                                },

                                y: {
                                    beginAtZero:
                                        true,

                                    ticks: {
                                        color:
                                            chartTextColor(),

                                        precision:
                                            0
                                    },

                                    grid: {
                                        color:
                                            chartGridColor()
                                    }
                                }
                            },

                            plugins: {
                                legend: {
                                    labels: {
                                        color:
                                            chartTextColor()
                                    }
                                }
                            }
                        }
                    }
                );
        }

        const analyticsProgressCanvas =
            $("#analyticsProgressChart");

        if (analyticsProgressCanvas) {

            window.analyticsProgressChart?.destroy();

            const currentTasks =
                getTasks();

            const completed =
                currentTasks.filter(
                    task =>
                        normalizeStatus(
                            task.status
                        ) === "completed"
                ).length;

            const remaining =
                Math.max(
                    currentTasks.length -
                    completed,
                    0
                );

            window.analyticsProgressChart =
                new Chart(
                    analyticsProgressCanvas,
                    {
                        type: "doughnut",

                        data: {
                            labels: [
                                "Completed",
                                "Remaining"
                            ],

                            datasets: [{
                                data: [
                                    completed,
                                    remaining
                                ],

                                backgroundColor: [
                                    "#7c5cff",
                                    "rgba(124,92,255,.15)"
                                ],

                                borderWidth: 0
                            }]
                        },

                        options: {
                            responsive: true,

                            maintainAspectRatio: false,

                            cutout: "72%",

                            plugins: {
                                legend: {
                                    position: "bottom",

                                    labels: {
                                        color:
                                            chartTextColor(),

                                        usePointStyle: true
                                    }
                                }
                            }
                        }
                    }
                );
        }

        const analyticsWeeklyCanvas =
            $("#analyticsWeeklyChart");

        if (
            analyticsWeeklyCanvas
        ) {
            window.analyticsWeeklyChart?.destroy();

            window.analyticsWeeklyChart =
                new Chart(
                    analyticsWeeklyCanvas,
                    {
                        type:
                            "bar",

                        data: {
                            labels: [
                                "Mon",
                                "Tue",
                                "Wed",
                                "Thu",
                                "Fri",
                                "Sat",
                                "Sun"
                            ],

                            datasets: [{
                                label:
                                    "Tasks Completed",

                                data:
                                    getWeeklyCompletedCounts(),

                                backgroundColor:
                                    "#7c5cff",

                                borderRadius:
                                    7
                            }]
                        },

                        options: {
                            responsive:
                                true,

                            maintainAspectRatio:
                                false,

                            scales: {
                                x: {
                                    grid: {
                                        display:
                                            false
                                    },

                                    ticks: {
                                        color:
                                            chartTextColor()
                                    }
                                },

                                y: {
                                    beginAtZero:
                                        true,

                                    ticks: {
                                        color:
                                            chartTextColor(),

                                        precision:
                                            0
                                    },

                                    grid: {
                                        color:
                                            chartGridColor()
                                    }
                                }
                            },

                            plugins: {
                                legend: {
                                    labels: {
                                        color:
                                            chartTextColor()
                                    }
                                }
                            }
                        }
                    }
                );
        }
    }

    function updateCharts() {
        const currentTasks =
            getTasks();

        const completed =
            currentTasks.filter(
                task =>
                    normalizeStatus(
                        task.status
                    ) ===
                    "completed"
            ).length;

        const remaining =
            Math.max(
                currentTasks.length -
                completed,
                0
            );

        if (progressChart) {
            progressChart.data
                .datasets[0]
                .data = [
                    completed,
                    remaining
                ];

            progressChart.options
                .plugins
                .legend
                .labels
                .color =
                chartTextColor();

            progressChart.update();
        }

        if (weeklyChart) {
            weeklyChart.data
                .datasets[0]
                .data =
                getWeeklyCompletedCounts();

            weeklyChart.options
                .scales
                .x
                .ticks
                .color =
                chartTextColor();

            weeklyChart.options
                .scales
                .y
                .ticks
                .color =
                chartTextColor();

            weeklyChart.options
                .scales
                .y
                .grid
                .color =
                chartGridColor();

            weeklyChart.update();
        }

        if (
            window.analyticsProgressChart
        ) {
            window.analyticsProgressChart
                .data
                .datasets[0]
                .data = [
                    completed,
                    remaining
                ];

            window.analyticsProgressChart
                .update();
        }

        if (
            window.analyticsWeeklyChart
        ) {
            window.analyticsWeeklyChart
                .data
                .datasets[0]
                .data =
                getWeeklyCompletedCounts();

            window.analyticsWeeklyChart
                .update();
        }
    }

    $("#resetWorkspace")
        ?.addEventListener(
            "click",
            () => {
                if (
                    !confirm(
                        "Reset tasks, deadlines and diary entries? This cannot be undone."
                    )
                ) {
                    return;
                }

                localStorage.removeItem(
                    TASK_KEY
                );

                localStorage.removeItem(
                    DEADLINE_KEY
                );

                localStorage.removeItem(
                    JOURNAL_KEY
                );

                tasks = [];

                renderTasks();
                renderCalendar();
                renderUpcomingList();
                renderCurrentDeadline();
                renderJournalHistory();
                loadJournalForSelection();
                updateNotifications();

                showToast(
                    "Workspace reset."
                );
            }
        );

    renderTasks();

    renderCurrentDeadline();

    renderCalendar();

    renderUpcomingList();

    renderJournalHistory();

    loadJournalForSelection();

    updateJournalCount();

    updateNotifications();

    updateTaskStatistics();

    createCharts();

    applyTaskFilters();

    window.addEventListener(
        "resize",
        () => {
            if (
                window.innerWidth >
                900
            ) {
                sidebar?.classList.remove(
                    "active"
                );

                sidebarOverlay?.classList.remove(
                    "active"
                );
            }
        }
    );
});    
/* =========================================================
   PROFESSIONAL ANALYTICS CHARTS
========================================================= */

let completionChart = null;
let weeklyPerformanceChart = null;
let weeklyActivityChart = null;


/* =========================================================
   GET TASK DATA
========================================================= */

function getChartTasks() {

    try {

        const savedTasks =
            JSON.parse(
                localStorage.getItem("todo-tasks") || "[]"
            );

        return Array.isArray(savedTasks)
            ? savedTasks
            : [];

    } catch (error) {

        console.error(
            "Unable to load tasks for charts:",
            error
        );

        return [];

    }

}


/* =========================================================
   TASK STATUS
========================================================= */

function getTaskStatus(task) {

    if (!task) {
        return "pending";
    }

    if (
        task.status === "completed" ||
        task.completed === true
    ) {
        return "completed";
    }

    if (
        task.status === "delayed"
    ) {
        return "delayed";
    }

    return "pending";

}


/* =========================================================
   COMPLETION DOUGHNUT CHART
========================================================= */

function renderCompletionChart() {

    const canvas =
        document.getElementById(
            "progressChart"
        );

    if (!canvas) {
        return;
    }


    const tasks =
        getChartTasks();


    let completed = 0;
    let pending = 0;
    let delayed = 0;


    tasks.forEach(task => {

        const status =
            getTaskStatus(task);


        if (status === "completed") {

            completed++;

        } else if (status === "delayed") {

            delayed++;

        } else {

            pending++;

        }

    });


    const total =
        completed +
        pending +
        delayed;


    const percentage =
        total > 0
            ? Math.round(
                (completed / total) * 100
            )
            : 0;


    const percentageElement =
        document.getElementById(
            "analyticsProgress"
        );


    if (percentageElement) {

        percentageElement.textContent =
            `${percentage}%`;

    }


    if (completionChart) {

        completionChart.destroy();

    }


    completionChart =
        new Chart(
            canvas,
            {
                type: "doughnut",

                data: {

                    labels: [
                        "Completed",
                        "Pending",
                        "Delayed"
                    ],

                    datasets: [
                        {
                            data: [
                                completed,
                                pending,
                                delayed
                            ],

                            backgroundColor: [
                                "#22c55e",
                                "#6366f1",
                                "#ef4444"
                            ],

                            borderColor: "#151b2b",

                            borderWidth: 3,

                            hoverOffset: 8
                        }
                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    cutout: "68%",

                    plugins: {

                        legend: {

                            position: "bottom",

                            labels: {

                                padding: 20,

                                usePointStyle: true,

                                font: {
                                    size: 12
                                }

                            }

                        },

                        tooltip: {

                            callbacks: {

                                label: function(context) {

                                    return (
                                        `${context.label}: ${context.raw}`
                                    );

                                }

                            }

                        }

                    }

                }

            }
        );

}


/* =========================================================
   GET LAST 7 DAYS
========================================================= */

function getLastSevenDays() {

    const days = [];

    const today =
        new Date();


    for (
        let i = 6;
        i >= 0;
        i--
    ) {

        const date =
            new Date(today);


        date.setHours(
            0,
            0,
            0,
            0
        );


        date.setDate(
            today.getDate() - i
        );


        days.push(date);

    }


    return days;

}


/* =========================================================
   WEEKLY PERFORMANCE BAR CHART
========================================================= */

function renderWeeklyPerformanceChart() {

    const canvas =
        document.getElementById(
            "weeklyPerformanceChart"
        );

    if (!canvas) {
        return;
    }


    const tasks =
        getChartTasks();


    const days =
        getLastSevenDays();


    const labels =
        days.map(
            date =>
                date.toLocaleDateString(
                    undefined,
                    {
                        weekday: "short"
                    }
                )
        );


    const completedData =
        days.map(day => {

            const dayKey =
                day.toISOString()
                .split("T")[0];


            return tasks.filter(task => {

                if (
                    getTaskStatus(task) !==
                    "completed"
                ) {
                    return false;
                }


                const taskDate =
                    task.completedAt ||
                    task.updatedAt ||
                    task.date;


                if (!taskDate) {
                    return false;
                }


                return (
                    new Date(taskDate)
                        .toISOString()
                        .split("T")[0]
                    === dayKey
                );

            }).length;

        });


    if (weeklyPerformanceChart) {

        weeklyPerformanceChart.destroy();

    }


    weeklyPerformanceChart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels: labels,

                    datasets: [

                        {
                            label:
                                "Completed Tasks",

                            data:
                                completedData,

                            borderRadius: 8,

                            backgroundColor:
                                "#6366f1",

                            borderWidth: 0,

                            barThickness:
                                28

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    scales: {

                        y: {

                            beginAtZero: true,

                            ticks: {

                                precision: 0,

                                color: "#94a3b8"

                            },

                            grid: {

                                color:
                                    "rgba(148,163,184,0.12)"

                            }

                        },

                        x: {

                            ticks: {

                                color: "#94a3b8"

                            },

                            grid: {

                                display: false

                            }

                        }

                    },

                    plugins: {

                        legend: {

                            display: false

                        }

                    }

                }

            }
        );

}


/* =========================================================
   WEEKLY ACTIVITY CHART
========================================================= */

function renderWeeklyActivityChart() {

    const canvas =
        document.getElementById(
            "weeklyActivityChart"
        );

    if (!canvas) {
        return;
    }


    const tasks =
        getChartTasks();


    const days =
        getLastSevenDays();


    const labels =
        days.map(
            date =>
                date.toLocaleDateString(
                    undefined,
                    {
                        weekday: "short"
                    }
                )
        );


    const activityData =
        days.map(day => {

            const dayKey =
                day.toISOString()
                .split("T")[0];


            return tasks.filter(task => {

                const taskDate =
                    task.updatedAt ||
                    task.completedAt ||
                    task.createdAt ||
                    task.date;


                if (!taskDate) {
                    return false;
                }


                return (
                    new Date(taskDate)
                        .toISOString()
                        .split("T")[0]
                    === dayKey
                );

            }).length;

        });


    if (weeklyActivityChart) {

        weeklyActivityChart.destroy();

    }


    weeklyActivityChart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels: labels,

                    datasets: [

                        {
                            label:
                                "Task Activity",

                            data:
                                activityData,

                            backgroundColor:
                                "#8b5cf6",

                            borderRadius: 8,

                            barThickness:
                                28

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    scales: {

                        y: {

                            beginAtZero: true,

                            ticks: {

                                precision: 0,

                                color: "#94a3b8"

                            },

                            grid: {

                                color:
                                    "rgba(148,163,184,0.12)"

                            }

                        },

                        x: {

                            ticks: {

                                color: "#94a3b8"

                            },

                            grid: {

                                display: false

                            }

                        }

                    },

                    plugins: {

                        legend: {

                            display: false

                        }

                    }

                }

            }
        );

}


/* =========================================================
   UPDATE ALL CHARTS
========================================================= */

function updateAllCharts() {

    renderCompletionChart();

    renderWeeklyPerformanceChart();

    renderWeeklyActivityChart();

}


/* =========================================================
   INITIALIZE CHARTS
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        updateAllCharts();

    }
);

const sidebarCollapse =
    document.getElementById("sidebarCollapse");

const sidebar =
    document.querySelector(".sidebar");

if (sidebarCollapse && sidebar) {

    sidebarCollapse.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle("collapsed");

        }
    );

}

