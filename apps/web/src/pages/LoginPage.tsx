import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { Language, UserProfile } from "@dotagame/contracts";
import { login, register } from "../lib/api";

type AuthMode = "login" | "register";
type FieldName = "email" | "password" | "name";
type FieldErrors = Partial<Record<FieldName, string>>;

const labels = {
  "zh-CN": {
    heroEyebrow: "DotaPulse 账号中心",
    heroTitle: "登录后继续你的 Dota 内容与训练节奏",
    heroSubtitle: "把新闻、补丁、赛事和教练问答放进同一个个人空间，切换设备也不会丢。",
    benefits: [
      {
        title: "同步收藏",
        body: "把新闻、补丁和赛事存进个人列表，回来看时更快。"
      },
      {
        title: "保留身份",
        body: "注册后会自动生成个人资料，后续扩展历史记录也更顺。"
      },
      {
        title: "中英双语",
        body: "在双语内容流里切换，不需要重复配置你的账号。"
      }
    ],
    loginTab: "登录",
    registerTab: "注册",
    loginEyebrow: "欢迎回来",
    registerEyebrow: "创建账号",
    loginTitle: "继续进入你的个人空间",
    registerTitle: "用 30 秒完成注册",
    loginDescription: "输入邮箱和密码，继续查看收藏、资料和后续个性化能力。",
    registerDescription: "注册后会直接登录，并带你进入个人资料页继续操作。",
    emailLabel: "邮箱",
    emailPlaceholder: "name@example.com",
    passwordLabel: "密码",
    passwordPlaceholder: "至少 6 位字符",
    nameLabel: "显示名称",
    namePlaceholder: "你希望别人怎么称呼你",
    nameHintPrefix: "不填写时默认使用",
    nameHintFallback: "邮箱前缀",
    submitLogin: "立即登录",
    submitRegister: "创建并进入",
    pendingLogin: "正在登录...",
    pendingRegister: "正在创建账号...",
    switchToRegisterLead: "还没有账号？",
    switchToRegisterAction: "去注册",
    switchToLoginLead: "已经有账号？",
    switchToLoginAction: "返回登录",
    validationEmail: "请输入有效的邮箱地址。",
    validationPassword: "密码长度至少 6 位。",
    validationName: "显示名称长度需为 2 到 32 个字符。",
    errors: {
      INVALID_PAYLOAD: "提交信息不完整，请检查输入内容。",
      INVALID_CREDENTIALS: "邮箱或密码不正确。",
      EMAIL_EXISTS: "这个邮箱已经注册过了。",
      LOGIN_FAILED: "登录失败，请稍后再试。",
      REGISTER_FAILED: "注册失败，请稍后再试。",
      REQUEST_FAILED: "请求失败，请检查网络后重试。"
    }
  },
  "en-US": {
    heroEyebrow: "DotaPulse Account",
    heroTitle: "Pick up your Dota feed and coaching flow where you left off",
    heroSubtitle: "Keep news, patch tracking, tournaments, and guided chat inside one account space.",
    benefits: [
      {
        title: "Saved picks",
        body: "Keep articles, patch notes, and events in a personal list for later review."
      },
      {
        title: "Persistent identity",
        body: "Your profile is ready as soon as you sign up, so future history features can build on it."
      },
      {
        title: "Bilingual ready",
        body: "Switch between Chinese and English content without reconfiguring your account."
      }
    ],
    loginTab: "Login",
    registerTab: "Register",
    loginEyebrow: "Welcome back",
    registerEyebrow: "Create account",
    loginTitle: "Sign in to continue",
    registerTitle: "Set up your account in seconds",
    loginDescription: "Use your email and password to return to your profile and personalized content flow.",
    registerDescription: "You will be signed in immediately after registration and redirected to your profile.",
    emailLabel: "Email",
    emailPlaceholder: "name@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 6 characters",
    nameLabel: "Display name",
    namePlaceholder: "How should we call you?",
    nameHintPrefix: "Leave it blank and we will use",
    nameHintFallback: "your email address",
    submitLogin: "Sign in",
    submitRegister: "Create account",
    pendingLogin: "Signing in...",
    pendingRegister: "Creating account...",
    switchToRegisterLead: "New here?",
    switchToRegisterAction: "Create an account",
    switchToLoginLead: "Already have an account?",
    switchToLoginAction: "Back to sign in",
    validationEmail: "Enter a valid email address.",
    validationPassword: "Password must be at least 6 characters.",
    validationName: "Display name must be 2-32 characters.",
    errors: {
      INVALID_PAYLOAD: "Your form is incomplete. Please review the fields.",
      INVALID_CREDENTIALS: "Email or password is incorrect.",
      EMAIL_EXISTS: "This email is already registered.",
      LOGIN_FAILED: "Unable to sign in right now. Please try again.",
      REGISTER_FAILED: "Unable to create the account right now. Please try again.",
      REQUEST_FAILED: "Request failed. Check your connection and retry."
    }
  }
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateForm(
  mode: AuthMode,
  values: { email: string; password: string; name: string },
  text: (typeof labels)["en-US"]
): FieldErrors {
  const errors: FieldErrors = {};

  if (!isValidEmail(values.email.trim())) {
    errors.email = text.validationEmail;
  }

  if (values.password.trim().length < 6) {
    errors.password = text.validationPassword;
  }

  if (mode === "register" && values.name.trim().length > 0) {
    const trimmedName = values.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 32) {
      errors.name = text.validationName;
    }
  }

  return errors;
}

function resolveRequestError(
  requestError: unknown,
  text: (typeof labels)["en-US"]
) {
  const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
  return text.errors[code as keyof typeof text.errors] ?? text.errors.REQUEST_FAILED;
}

export function LoginPage(props: {
  locale: Language;
  token: string | null;
  onAuth: (token: string, user: UserProfile) => void;
}) {
  const navigate = useNavigate();
  const text = useMemo(() => labels[props.locale], [props.locale]);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestedName = useMemo(() => {
    const prefix = email.split("@")[0]?.trim();
    return prefix || text.nameHintFallback;
  }, [email, text.nameHintFallback]);

  if (props.token) {
    return <Navigate to="/profile" replace />;
  }

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setFieldErrors({});
  }

  function handleFieldChange(field: FieldName, value: string) {
    setError(null);
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      return { ...current, [field]: undefined };
    });

    if (field === "email") {
      setEmail(value);
      return;
    }
    if (field === "password") {
      setPassword(value);
      return;
    }
    setName(value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValues = { email, password, name };
    const nextErrors = validateForm(mode, nextValues, text);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "register") {
        const normalizedEmail = email.trim().toLowerCase();
        const result = await register({
          email: normalizedEmail,
          password: password.trim(),
          name: name.trim() || normalizedEmail
        });
        props.onAuth(result.token, result.user);
        navigate("/profile", { replace: true });
        return;
      }

      const result = await login({
        email: email.trim().toLowerCase(),
        password: password.trim()
      });
      props.onAuth(result.token, result.user);
      navigate("/profile", { replace: true });
    } catch (requestError) {
      setError(resolveRequestError(requestError, text));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <aside className="panel auth-hero">
        <p className="auth-kicker">{text.heroEyebrow}</p>
        <h2 className="auth-hero-title">{text.heroTitle}</h2>
        <p className="auth-copy">{text.heroSubtitle}</p>

        <div className="auth-points">
          {text.benefits.map((item) => (
            <article className="auth-point" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </aside>

      <div className="panel auth-card">
        <div className="auth-header">
          <p className="auth-kicker auth-kicker-muted">
            {mode === "login" ? text.loginEyebrow : text.registerEyebrow}
          </p>
          <h2 className="auth-title">{mode === "login" ? text.loginTitle : text.registerTitle}</h2>
          <p className="auth-caption">
            {mode === "login" ? text.loginDescription : text.registerDescription}
          </p>
        </div>

        <div className="chip-row auth-mode-toggle">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => handleModeChange("login")}
            type="button"
          >
            {text.loginTab}
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => handleModeChange("register")}
            type="button"
          >
            {text.registerTab}
          </button>
        </div>

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-label">{text.emailLabel}</span>
            <input
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete={mode === "login" ? "username" : "email"}
              placeholder={text.emailPlaceholder}
              type="email"
              value={email}
              onChange={(event) => handleFieldChange("email", event.target.value)}
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </label>

          <label className="auth-field">
            <span className="auth-label">{text.passwordLabel}</span>
            <input
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={text.passwordPlaceholder}
              type="password"
              value={password}
              onChange={(event) => handleFieldChange("password", event.target.value)}
            />
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </label>

          {mode === "register" && (
            <label className="auth-field">
              <span className="auth-label">{text.nameLabel}</span>
              <input
                aria-invalid={Boolean(fieldErrors.name)}
                autoComplete="nickname"
                placeholder={text.namePlaceholder}
                value={name}
                onChange={(event) => handleFieldChange("name", event.target.value)}
              />
              <span className="auth-note">
                {text.nameHintPrefix} <strong>{suggestedName}</strong>
              </span>
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </label>
          )}

          {error && <p className="auth-status danger">{error}</p>}

          <button className="primary-btn auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? mode === "login"
                ? text.pendingLogin
                : text.pendingRegister
              : mode === "login"
                ? text.submitLogin
                : text.submitRegister}
          </button>
        </form>

        <p className="auth-switch-line">
          {mode === "login" ? text.switchToRegisterLead : text.switchToLoginLead}{" "}
          <button
            className="text-btn"
            onClick={() => handleModeChange(mode === "login" ? "register" : "login")}
            type="button"
          >
            {mode === "login" ? text.switchToRegisterAction : text.switchToLoginAction}
          </button>
        </p>
      </div>
    </section>
  );
}
