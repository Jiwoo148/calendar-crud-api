const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 세션 설정
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }, // 1일
  })
);

// 정적 파일
app.use(express.static(path.join(__dirname)));

// DB 연결
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234",
  database: "login_project",
});

db.connect((err) => {
  if (err) return console.error("DB 연결 실패:", err);
  console.log("DB 연결 성공");
});

// ==========================
// 회원가입
// ==========================
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ success: false, message: "아이디와 비밀번호 입력 필요" });
  if (password.length < 6)
    return res.json({ success: false, message: "비밀번호는 최소 6자리 이상" });

  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err) return res.json({ success: false, message: "DB 오류" });
      if (results.length > 0)
        return res.json({ success: false, message: "이미 존재하는 아이디" });

      const hash = await bcrypt.hash(password, 10);
      db.query(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hash],
        (err) => {
          if (err) return res.json({ success: false, message: "DB 오류" });
          res.json({ success: true, message: "회원가입 성공" });
        }
      );
    }
  );
});

// ==========================
// 로그인
// ==========================
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ success: false, message: "아이디와 비밀번호 입력 필요" });

  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err) return res.json({ success: false, message: "DB 오류" });
      if (results.length === 0)
        return res.json({ success: false, message: "아이디 없음" });

      const match = await bcrypt.compare(password, results[0].password);
      if (!match) return res.json({ success: false, message: "비밀번호 틀림" });

      req.session.user = { id: results[0].id, username: results[0].username };
      res.json({ success: true, message: "로그인 성공" });
    }
  );
});

// ==========================
// 로그아웃
// ==========================
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ==========================
// 세션 체크
// ==========================
app.get("/session", (req, res) => {
  res.json({ loggedIn: !!req.session.user });
});

// ==========================
// todos CRUD
// ==========================
app.get("/todos", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ success: false, message: "로그인 필요" });

  const userId = req.session.user.id;
  db.query(
    "SELECT id, title, due_date, completed FROM todos WHERE user_id = ? ORDER BY id DESC",
    [userId],
    (err, results) => {
      if (err)
        return res.status(500).json({ success: false, message: "DB 오류" });

      const todos = results.map((todo) => ({
        id: todo.id,
        title: todo.title,
        due_date: todo.due_date,
        completed: !!todo.completed,
      }));
      res.json(todos);
    }
  );
});

app.post("/todos", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ success: false, message: "로그인 필요" });

  const userId = req.session.user.id;
  const title = req.body.title;
  const dueDate = req.body.due_date ? new Date(req.body.due_date) : new Date();

  const yyyy = dueDate.getFullYear();
  const mm = String(dueDate.getMonth() + 1).padStart(2, "0");
  const dd = String(dueDate.getDate()).padStart(2, "0");
  const hh = String(dueDate.getHours()).padStart(2, "0");
  const mi = String(dueDate.getMinutes()).padStart(2, "0");
  const mysqlDate = `${yyyy}-${mm}-${dd} ${hh}:${mi}:00`;

  db.query(
    "INSERT INTO todos (user_id, title, due_date, completed) VALUES (?, ?, ?, 0)",
    [userId, title, mysqlDate],
    (err) => {
      if (err)
        return res.status(500).json({ success: false, message: "DB 오류" });
      res.json({ success: true, message: "추가 성공" });
    }
  );
});

app.put("/todos/:id", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ success: false, message: "로그인 필요" });

  const todoId = req.params.id;
  const { title, completed, due_date } = req.body;

  db.query(
    "SELECT due_date FROM todos WHERE id = ? AND user_id = ?",
    [todoId, req.session.user.id],
    (err, results) => {
      if (err)
        return res.status(500).json({ success: false, message: "DB 오류" });
      if (results.length === 0)
        return res.status(404).json({ success: false, message: "할 일 없음" });

      let newDueDate = results[0].due_date;
      if (due_date) {
        const d = new Date(due_date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const mi = String(d.getMinutes()).padStart(2, "0");
        newDueDate = `${yyyy}-${mm}-${dd} ${hh}:${mi}:00`;
      }

      const updates = [];
      const values = [];

      if (title !== undefined) {
        updates.push("title = ?");
        values.push(title);
      }
      if (completed !== undefined) {
        updates.push("completed = ?");
        values.push(completed);
      }
      updates.push("due_date = ?");
      values.push(newDueDate);

      values.push(todoId, req.session.user.id);

      const sql = `UPDATE todos SET ${updates.join(
        ", "
      )} WHERE id = ? AND user_id = ?`;
      db.query(sql, values, (err) => {
        if (err)
          return res.status(500).json({ success: false, message: "DB 오류" });
        res.json({ success: true, message: "수정 성공" });
      });
    }
  );
});

app.delete("/todos/:id", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ success: false, message: "로그인 필요" });
  const todoId = req.params.id;
  db.query(
    "DELETE FROM todos WHERE id=? AND user_id=?",
    [todoId, req.session.user.id],
    (err) => {
      if (err)
        return res.status(500).json({ success: false, message: "DB 오류" });
      res.json({ success: true, message: "삭제 성공" });
    }
  );
});

// 서버 실행
app.listen(3000, () => console.log("서버 실행중: http://localhost:3000"));
