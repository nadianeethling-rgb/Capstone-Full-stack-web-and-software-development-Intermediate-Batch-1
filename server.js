const http = require("http");
const crypto = require("crypto");

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "development-only-change-me";
const users = [
    { id: "user-admin", email: "admin@example.com", password: "admin123", role: "admin" },
    { id: "user-student", email: "student@example.com", password: "student123", role: "student" },
    { id: "user-evaluator", email: "evaluator@example.com", password: "evaluator123", role: "evaluator" }
];
const assessments = [];
const submissions = [];

function encode(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createToken(user) {
    const header = encode({ alg: "HS256", typ: "JWT" });
    const payload = encode({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 });
    const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
    return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
    try {
        const [header, payload, signature] = token.split(".");
        if (!header || !payload || !signature) return null;
        const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
        if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
    } catch {
        return null;
    }
}

function send(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

function auth(req, res, roles) {
    const value = req.headers.authorization || "";
    const token = value.startsWith("Bearer ") ? value.slice(7) : "";
    const claims = token && verifyToken(token);
    if (!claims) {
        send(res, 401, { message: "Valid Bearer token required" });
        return null;
    }
    if (roles && !roles.includes(claims.role)) {
        send(res, 403, { message: "Insufficient permissions" });
        return null;
    }
    return claims;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", chunk => { raw += chunk; });
        req.on("end", () => {
            try { resolve(raw ? JSON.parse(raw) : {}); }
            catch { reject(new Error("Request body must be valid JSON")); }
        });
        req.on("error", reject);
    });
}

function findById(items, id) {
    return items.find(item => item.id === id);
}

const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.writeHead(204, { "Access-Control-Allow-Headers": "Content-Type, Authorization" });
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split("/").filter(Boolean);

    try {
        if (req.method === "POST" && url.pathname === "/api/auth/login") {
            const body = await readBody(req);
            const user = users.find(candidate => candidate.email === body.email && candidate.password === body.password);
            if (!user) return send(res, 401, { message: "Invalid email or password" });
            return send(res, 200, { token: createToken(user), user: { id: user.id, email: user.email, role: user.role } });
        }

        if (req.method === "POST" && url.pathname === "/api/assessments") {
            if (!auth(req, res, ["admin"])) return;
            const body = await readBody(req);
            if (!body.title || !Array.isArray(body.questions) || body.questions.length === 0) {
                return send(res, 400, { message: "title and at least one question are required" });
            }
            const assessment = { id: crypto.randomUUID(), title: body.title, questions: body.questions, createdAt: new Date().toISOString() };
            assessments.push(assessment);
            return send(res, 201, assessment);
        }

        if (req.method === "GET" && url.pathname === "/api/assessments") {
            if (!auth(req, res)) return;
            return send(res, 200, assessments);
        }

        if (req.method === "POST" && parts[0] === "api" && parts[1] === "assessments" && parts[3] === "submissions") {
            const claims = auth(req, res, ["student"]);
            if (!claims) return;
            const assessment = findById(assessments, parts[2]);
            if (!assessment) return send(res, 404, { message: "Assessment not found" });
            if (submissions.some(item => item.assessmentId === assessment.id && item.studentId === claims.sub)) {
                return send(res, 409, { message: "A submission already exists for this assessment" });
            }
            const body = await readBody(req);
            if (!Array.isArray(body.answers)) return send(res, 400, { message: "answers must be an array" });
            const submission = { id: crypto.randomUUID(), assessmentId: assessment.id, studentId: claims.sub, answers: body.answers, status: "submitted", createdAt: new Date().toISOString() };
            submissions.push(submission);
            return send(res, 201, submission);
        }

        if (req.method === "PATCH" && parts[0] === "api" && parts[1] === "submissions" && parts[3] === "review") {
            if (!auth(req, res, ["evaluator"])) return;
            const submission = findById(submissions, parts[2]);
            if (!submission) return send(res, 404, { message: "Submission not found" });
            if (submission.status !== "submitted") return send(res, 409, { message: "Only submitted work can enter review" });
            submission.status = "pending_review";
            return send(res, 200, submission);
        }

        if (req.method === "PATCH" && parts[0] === "api" && parts[1] === "submissions" && parts[3] === "score") {
            if (!auth(req, res, ["evaluator"])) return;
            const submission = findById(submissions, parts[2]);
            if (!submission) return send(res, 404, { message: "Submission not found" });
            if (submission.status !== "pending_review") return send(res, 409, { message: "Submission must be pending_review before scoring" });
            const body = await readBody(req);
            if (!Number.isInteger(body.score) || body.score < 0 || body.score > 100) return send(res, 400, { message: "score must be an integer from 0 to 100" });
            submission.score = body.score;
            submission.status = "scored";
            submission.scoredAt = new Date().toISOString();
            return send(res, 200, submission);
        }

        if (req.method === "GET" && url.pathname === "/api/submissions") {
            if (!auth(req, res, ["admin", "evaluator"])) return;
            return send(res, 200, submissions);
        }

        send(res, 404, { message: "Route not found" });
    } catch (error) {
        send(res, error.message === "Request body must be valid JSON" ? 400 : 500, { message: error.message });
    }
});

server.listen(PORT, () => console.log(`Assessment API running at http://localhost:${PORT}`));
