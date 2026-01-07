document.addEventListener("DOMContentLoaded", () => {
  let selectedDate = new Date().toISOString().slice(0, 10);
  const calendarEl = document.getElementById("calendar");
  const todoListEl = document.getElementById("todo-list");
  const todoTitleInput = document.getElementById("todo-title");
  const todoTimeInput = document.getElementById("todo-time");
  const addBtn = document.getElementById("addBtn");

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/logout");
    location.href = "/index.html";
  });

  function formatKoreanTime(dateStr) {
    const [year, month, day, hour, minute] = dateStr.match(/\d+/g).map(Number);
    let h = hour;
    const m = String(minute).padStart(2, "0");
    const period = h < 12 ? "오전" : "오후";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${period} ${h}:${m}`;
  }

  function highlightSelectedDate(dateStr) {
    document.querySelectorAll(".fc-daygrid-day").forEach((day) => {
      day.classList.remove("selected-date");
      if (day.dataset.date === dateStr) day.classList.add("selected-date");
    });
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: { left: "prev,next today", center: "title", right: "" },
    dateClick(info) {
      selectedDate = info.dateStr;
      fetchTodos();
      highlightSelectedDate(info.dateStr);
    },
    eventContent: function (arg) {
      const el = document.createElement("div");
      el.textContent = `${formatKoreanTime(arg.event.startStr)} ${
        arg.event.extendedProps.title
      }`;
      if (arg.event.extendedProps.completed)
        el.style.textDecoration = "line-through";
      return { domNodes: [el] };
    },
  });
  calendar.render();

  async function fetchTodos() {
    const res = await fetch("/todos");
    const todos = await res.json();

    todoListEl.innerHTML = "";
    calendar.removeAllEvents();

    todos.forEach((todo) => {
      const dateStr = todo.due_date.slice(0, 10);

      if (dateStr === selectedDate) {
        const li = document.createElement("li");
        const left = document.createElement("div");
        left.className = "todo-left";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = todo.completed;
        checkbox.addEventListener("change", () =>
          toggleCompleted(todo.id, checkbox.checked)
        );

        const span = document.createElement("span");
        span.textContent = `${todo.title} (${formatKoreanTime(todo.due_date)})`;

        left.appendChild(checkbox);
        left.appendChild(span);
        li.appendChild(left);

        const btns = document.createElement("div");
        btns.className = "todo-buttons";

        const editBtn = document.createElement("button");
        editBtn.textContent = "수정";
        editBtn.onclick = () => editTodo(todo.id, todo.title, todo.due_date);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "삭제";
        deleteBtn.onclick = () => deleteTodo(todo.id);

        btns.appendChild(editBtn);
        btns.appendChild(deleteBtn);
        li.appendChild(btns);
        todoListEl.appendChild(li);
      }

      calendar.addEvent({
        start: todo.due_date,
        extendedProps: { title: todo.title, completed: todo.completed },
        className: todo.completed ? "completed" : "",
      });
    });
  }

  addBtn.addEventListener("click", async () => {
    const title = todoTitleInput.value.trim();
    const time = todoTimeInput.value;
    if (!title) return alert("내용을 입력하세요");

    await fetch("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, due_date: `${selectedDate}T${time}` }),
    });
    todoTitleInput.value = "";
    fetchTodos();
  });

  async function editTodo(id, oldTitle, oldDateStr) {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "50%";
    container.style.left = "50%";
    container.style.transform = "translate(-50%,-50%)";
    container.style.background = "#fff";
    container.style.padding = "20px";
    container.style.border = "1px solid #ccc";
    container.style.borderRadius = "6px";
    container.style.zIndex = "1000";
    container.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";

    const titleInput = document.createElement("input");
    titleInput.value = oldTitle;
    titleInput.style.marginBottom = "10px";
    titleInput.style.width = "200px";
    titleInput.style.display = "block";

    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.value = oldDateStr.slice(11, 16);
    timeInput.style.marginBottom = "10px";
    timeInput.style.display = "block";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "저장";
    saveBtn.style.marginRight = "10px";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "취소";

    container.appendChild(titleInput);
    container.appendChild(timeInput);
    container.appendChild(saveBtn);
    container.appendChild(cancelBtn);
    document.body.appendChild(container);

    saveBtn.onclick = async () => {
      const newTitle = titleInput.value.trim();
      const newTime = timeInput.value;
      if (!newTitle) return alert("제목을 입력하세요");

      const newDateTime = oldDateStr.slice(0, 10) + "T" + newTime;

      await fetch(`/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, due_date: newDateTime }),
      });
      container.remove();
      fetchTodos();
    };

    cancelBtn.onclick = () => container.remove();
  }

  async function deleteTodo(id) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/todos/${id}`, { method: "DELETE" });
    fetchTodos();
  }

  async function toggleCompleted(id, completed) {
    await fetch(`/todos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    fetchTodos();
  }

  fetchTodos();
  highlightSelectedDate(selectedDate);
});
