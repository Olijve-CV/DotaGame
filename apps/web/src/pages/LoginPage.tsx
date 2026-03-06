import { useMemo, useState } from "react";
import type { Language, UserProfile } from "@dotagame/contracts";
import { login, register } from "../lib/api";

const labels = {
  "zh-CN": {
    login: "登录",
    register: "注册",
    email: "邮箱",
    password: "密码（至少6位）",
    name: "昵称",
    submit: "提交"
  },
  "en-US": {
    login: "Login",
    register: "Register",
    email: "Email",
    password: "Password (min 6)",
    name: "Display name",
    submit: "Submit"
  }
};

export function LoginPage(props: {
  locale: Language;
  onAuth: (token: string, user: UserProfile) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const text = useMemo(() => labels[props.locale], [props.locale]);

  async function submit() {
    setError(null);
    try {
      if (mode === "register") {
        const result = await register({ email, password, name: name || email.split("@")[0] });
        props.onAuth(result.token, result.user);
        return;
      }
      const result = await login({ email, password });
      props.onAuth(result.token, result.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "REQUEST_FAILED");
    }
  }

  return (
    <section className="stack">
      <div className="panel narrow">
        <div className="chip-row">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            {text.login}
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            {text.register}
          </button>
        </div>
        <input placeholder={text.email} value={email} onChange={(event) => setEmail(event.target.value)} />
        <input
          placeholder={text.password}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {mode === "register" && (
          <input placeholder={text.name} value={name} onChange={(event) => setName(event.target.value)} />
        )}
        <button onClick={submit}>{text.submit}</button>
        {error && <p className="danger">{error}</p>}
      </div>
    </section>
  );
}
