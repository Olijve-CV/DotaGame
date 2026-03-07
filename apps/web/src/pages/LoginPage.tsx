import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { HeroAvatarOption, Language, UserProfile } from "@dotagame/contracts";
import { HeroAvatarPicker } from "../components/HeroAvatarPicker";
import { fetchHeroAvatars, login, register } from "../lib/api";

type AuthMode = "login" | "register";
type FieldName = "email" | "password" | "name";
type FieldErrors = Partial<Record<FieldName, string>>;

const labels = {
  "zh-CN": {
    heroEyebrow: "DotaPulse Account",
    heroTitle: "登录后，把你的情报流、问答记录和个人身份接回同一张工作台",
    heroSubtitle: "账号系统现在主要承担收藏、聊天记录和头像身份。先把入口体验做干净，后续再叠更多个性化能力。",
    benefits: [
      {
        title: "收藏同步",
        body: "把新闻、版本和赛事先存下来，之后回看会更顺手。"
      },
      {
        title: "统一身份",
        body: "注册后会直接生成个人档案，后续的历史记录和偏好都能挂在同一账号上。"
      },
      {
        title: "英雄头像",
        body: "可以直接从英雄池里选头像，也可以交给系统随机分配。"
      }
    ],
    loginTab: "登录",
    registerTab: "注册",
    loginEyebrow: "欢迎回来",
    registerEyebrow: "创建账号",
    loginTitle: "登录后继续浏览",
    registerTitle: "几十秒内完成注册",
    loginDescription: "用邮箱和密码回到你的个人中心、收藏内容和战术问答记录。",
    registerDescription: "注册完成后会直接登录，并跳转到个人中心。",
    emailLabel: "邮箱",
    emailPlaceholder: "name@example.com",
    passwordLabel: "密码",
    passwordPlaceholder: "至少 6 位字符",
    nameLabel: "显示名称",
    namePlaceholder: "希望别人怎么称呼你？",
    nameHintPrefix: "留空时默认使用",
    nameHintFallback: "你的邮箱地址",
    avatarTitle: "选择英雄头像",
    avatarDescription: "现在就选一个，也可以保留随机分配。",
    avatarRandomPreview: "随机头像",
    avatarLoading: "正在加载英雄头像...",
    submitLogin: "登录",
    submitRegister: "创建账号",
    pendingLogin: "登录中...",
    pendingRegister: "注册中...",
    switchToRegisterLead: "还没有账号？",
    switchToRegisterAction: "立即注册",
    switchToLoginLead: "已经有账号了？",
    switchToLoginAction: "返回登录",
    validationEmail: "请输入有效邮箱地址。",
    validationPassword: "密码至少需要 6 位字符。",
    validationName: "显示名称长度需在 2 到 32 个字符之间。",
    errors: {
      INVALID_PAYLOAD: "表单内容不完整，请检查输入项。",
      INVALID_CREDENTIALS: "邮箱或密码不正确。",
      EMAIL_EXISTS: "这个邮箱已经被注册。",
      INVALID_AVATAR: "当前头像不可用，请重新选择。",
      LOGIN_FAILED: "暂时无法登录，请稍后再试。",
      REGISTER_FAILED: "暂时无法注册，请稍后再试。",
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
        title: "Hero avatars",
        body: "Choose from the full hero roster, or let the system assign one for you."
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
    avatarTitle: "Choose your hero avatar",
    avatarDescription: "Customize it now, or let the system assign a random hero for you.",
    avatarRandomPreview: "Random pick",
    avatarLoading: "Loading hero avatars...",
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
      INVALID_AVATAR: "This avatar is unavailable. Please choose another one.",
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

function resolveRequestError(requestError: unknown, text: (typeof labels)["en-US"]) {
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
  const [selectedAvatarId, setSelectedAvatarId] = useState<number | null>(null);
  const [avatarOptions, setAvatarOptions] = useState<HeroAvatarOption[]>([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestedName = useMemo(() => {
    const normalizedEmail = email.trim().toLowerCase();
    return normalizedEmail || text.nameHintFallback;
  }, [email, text.nameHintFallback]);
  const selectedAvatar = useMemo(
    () => avatarOptions.find((item) => item.id === selectedAvatarId) ?? null,
    [avatarOptions, selectedAvatarId]
  );

  useEffect(() => {
    if (mode !== "register" || avatarOptions.length > 0 || isLoadingAvatars) {
      return;
    }

    let active = true;
    setIsLoadingAvatars(true);
    fetchHeroAvatars()
      .then((items) => {
        if (active) {
          setAvatarOptions(items);
        }
      })
      .catch(() => {
        if (active) {
          setError(text.errors.REQUEST_FAILED);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingAvatars(false);
        }
      });

    return () => {
      active = false;
    };
  }, [avatarOptions.length, isLoadingAvatars, mode, text.errors.REQUEST_FAILED]);

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
          name: name.trim() || normalizedEmail,
          avatarHeroId: selectedAvatarId ?? undefined
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
            <>
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

              <section className="auth-avatar-section">
                <div className="auth-avatar-header">
                  <div>
                    <span className="auth-label">{text.avatarTitle}</span>
                    <p className="auth-note">{text.avatarDescription}</p>
                  </div>
                  <div className="avatar-preview-card">
                    {selectedAvatar ? (
                      <>
                        <img alt={selectedAvatar.name} src={selectedAvatar.image} />
                        <strong>{selectedAvatar.name}</strong>
                      </>
                    ) : (
                      <>
                        <span className="avatar-random-badge large">?</span>
                        <strong>{text.avatarRandomPreview}</strong>
                      </>
                    )}
                  </div>
                </div>

                {isLoadingAvatars ? (
                  <p className="muted">{text.avatarLoading}</p>
                ) : (
                  <HeroAvatarPicker
                    locale={props.locale}
                    options={avatarOptions}
                    selectedAvatarId={selectedAvatarId}
                    onSelect={setSelectedAvatarId}
                  />
                )}
              </section>
            </>
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
