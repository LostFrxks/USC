import { useEffect, useState } from "react";
import { login, registerEmail, requestEmailCode, requestPhoneCode, verifyPhoneCode } from "../api/auth";

type Role = "buyer" | "supplier";

type AuthMode = "login" | "register";

type LoginMethod = "email" | "phone";

type AuthErrorDetail = {
  reason_code?: string;
  captcha_required?: boolean;
  lockout_seconds?: number;
};

const TEST_ACCOUNTS = [
  { email: "buyer1@usc.demo", password: "demo123456", role: "РџРѕРєСѓРїР°С‚РµР»СЊ", sales: 0, purchases: 1450 },
  { email: "buyer2@usc.demo", password: "demo123456", role: "РџРѕРєСѓРїР°С‚РµР»СЊ", sales: 0, purchases: 857 },
  { email: "supplier1@usc.demo", password: "demo123456", role: "РџРѕСЃС‚Р°РІС‰РёРє", sales: 133, purchases: 0 },
  { email: "supplier2@usc.demo", password: "demo123456", role: "РџРѕСЃС‚Р°РІС‰РёРє", sales: 132, purchases: 0 },
  { email: "supplier3@usc.demo", password: "demo123456", role: "РџРѕСЃС‚Р°РІС‰РёРє", sales: 962, purchases: 0 },
  { email: "supplier4@usc.demo", password: "demo123456", role: "РџРѕСЃС‚Р°РІС‰РёРє", sales: 966, purchases: 0 },
] as const;

export default function AuthScreen({ onSuccess }: { onSuccess: () => void }) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [method, setMethod] = useState<LoginMethod>("email");
  const [role, setRole] = useState<Role>("buyer");

  const [loginEmailValue, setLoginEmailValue] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPhoneCode, setLoginPhoneCode] = useState("");

  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCode, setRegCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const t = setInterval(() => setEmailCooldown((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [emailCooldown]);

  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const t = setInterval(() => setPhoneCooldown((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [phoneCooldown]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setInterval(() => setLockoutSeconds((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds]);

  useEffect(() => {
    setMsg(null);
    if (authMode === "register") {
      setMethod("email");
      setPhoneCodeSent(false);
      setLoginPhoneCode("");
    } else {
      setEmailCodeSent(false);
      setRegCode("");
    }
  }, [authMode]);

  const passwordScore = (() => {
    let score = 0;
    if (regPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(regPassword)) score += 1;
    if (/[a-z]/.test(regPassword)) score += 1;
    if (/[0-9]/.test(regPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(regPassword)) score += 1;
    return score;
  })();

  const passwordLabel =
    passwordScore >= 4 ? "РЎРёР»СЊРЅС‹Р№ РїР°СЂРѕР»СЊ" : passwordScore >= 3 ? "РќРѕСЂРјР°Р»СЊРЅС‹Р№ РїР°СЂРѕР»СЊ" : "РЎР»Р°Р±С‹Р№ РїР°СЂРѕР»СЊ";

  const isEmailValid = (value: string) => /.+@.+\..+/.test(value.trim());
  const isPhoneValid = (value: string) => value.replace(/[^0-9+]/g, "").length >= 6;

    const mapError = (e: unknown) => {
    const text = String(e);
    let parsed: AuthErrorDetail | null = null;
    const payloadStart = text.indexOf("{");
    if (payloadStart >= 0) {
      try {
        parsed = JSON.parse(text.slice(payloadStart)) as AuthErrorDetail;
      } catch {
        parsed = null;
      }
    }

    if (parsed?.lockout_seconds && parsed.lockout_seconds > 0) setLockoutSeconds(parsed.lockout_seconds);
    if (parsed?.captcha_required) setCaptchaRequired(true);
    if (parsed?.reason_code === "locked_out") return "Слишком много попыток. Аккаунт временно заблокирован.";
    if (parsed?.reason_code === "captcha_required") return "Требуется captcha-проверка.";
    if (parsed?.reason_code === "rate_limited") return "Слишком много запросов. Попробуйте позже.";

    if (text.includes("Invalid email")) return "Некорректный email";
    if (text.includes("Password too short")) return "Пароль минимум 6 символов";
    if (text.includes("Email code required")) return "Требуется код из email";
    if (text.includes("Code not requested")) return "Сначала запросите код на email";
    if (text.includes("Code expired")) return "Код истек, запросите новый";
    if (text.includes("Invalid code")) return "Неверный код подтверждения";
    if (text.includes("already exists")) return "Такой аккаунт уже существует";
    if (text.includes("Failed to send email code")) return "Не удалось отправить код на почту";
    if (text.includes("Email provider is not configured")) return "Почтовый сервис не настроен";
    if (text.includes("401")) return "Неверный email или пароль";
    if (text.includes("422")) return "Проверьте данные и попробуйте снова";
    if (text.includes("Register failed. DB says:")) {
      const suffix = text.split("Register failed. DB says:")[1]?.trim();
      return suffix ? `DB: ${suffix}` : "Ошибка базы при регистрации";
    }
    return text;
  };

  const submitLoginEmail = async () => {
    setMsg(null);
    if (lockoutSeconds > 0) {
      setMsg(`Повторите через ${lockoutSeconds} сек`);
      return;
    }
    if (captchaRequired && !captchaToken.trim()) {
      setMsg("Введите captcha token");
      return;
    }
    const email = loginEmailValue.trim().toLowerCase();
    if (!email || !isEmailValid(email)) {
      setMsg("Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ email");
      return;
    }
    if (!loginPassword) {
      setMsg("Р’РІРµРґРёС‚Рµ РїР°СЂРѕР»СЊ");
      return;
    }

    try {
      setBusy(true);
      await login(email, loginPassword, captchaRequired ? captchaToken.trim() : undefined);
      setCaptchaRequired(false);
      setCaptchaToken("");
      setLockoutSeconds(0);
      onSuccess();
    } catch (e) {
      setMsg(mapError(e));
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const sendPhoneLoginCode = async () => {
    setMsg(null);
    const phone = loginPhone.trim();
    if (!phone || !isPhoneValid(phone)) {
      setMsg("Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ С‚РµР»РµС„РѕРЅ");
      return;
    }
    if (phoneCooldown > 0) return;

    try {
      setBusy(true);
      const res = await requestPhoneCode(phone);
      if (res?.code) setMsg(`РљРѕРґ: ${res.code} (dev)`);
      else setMsg("РљРѕРґ РѕС‚РїСЂР°РІР»РµРЅ");
      setPhoneCodeSent(true);
      setPhoneCooldown(60);
    } catch (e) {
      setMsg("РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґ");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const verifyPhoneLoginCode = async () => {
    setMsg(null);
    if (lockoutSeconds > 0) {
      setMsg(`Повторите через ${lockoutSeconds} сек`);
      return;
    }
    if (captchaRequired && !captchaToken.trim()) {
      setMsg("Введите captcha token");
      return;
    }
    if (!loginPhone || !isPhoneValid(loginPhone) || !loginPhoneCode.trim()) {
      setMsg("Р’РІРµРґРёС‚Рµ С‚РµР»РµС„РѕРЅ Рё РєРѕРґ");
      return;
    }

    try {
      setBusy(true);
      await verifyPhoneCode({
        phone: loginPhone.trim(),
        code: loginPhoneCode.trim(),
        captcha_token: captchaRequired ? captchaToken.trim() : undefined,
      });
      setCaptchaRequired(false);
      setCaptchaToken("");
      setLockoutSeconds(0);
      onSuccess();
    } catch (e) {
      setMsg(mapError(e));
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const sendRegisterEmailCode = async () => {
    setMsg(null);
    const email = regEmail.trim().toLowerCase();
    if (!email || !isEmailValid(email)) {
      setMsg("Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ email");
      return;
    }
    if (emailCooldown > 0) return;

    try {
      setBusy(true);
      const res = await requestEmailCode(email);
      if (res?.code) setMsg(`РљРѕРґ: ${res.code} (dev)`);
      else setMsg("РљРѕРґ РѕС‚РїСЂР°РІР»РµРЅ РЅР° email");
      setEmailCodeSent(true);
      setEmailCooldown(60);
    } catch (e) {
      setMsg(mapError(e));
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const submitRegisterEmail = async () => {
    setMsg(null);
    const email = regEmail.trim().toLowerCase();
    const code = regCode.trim();

    if (!email || !isEmailValid(email)) {
      setMsg("Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ email");
      return;
    }
    if (!regPassword) {
      setMsg("Р’РІРµРґРёС‚Рµ РїР°СЂРѕР»СЊ");
      return;
    }
    if (regPassword.length < 6 || passwordScore < 3) {
      setMsg("РџР°СЂРѕР»СЊ СЃР»РёС€РєРѕРј СЃР»Р°Р±С‹Р№");
      return;
    }
    if (!code) {
      setMsg("Р’РІРµРґРёС‚Рµ РєРѕРґ РёР· email");
      return;
    }

    try {
      setBusy(true);
      await registerEmail({
        email,
        password: regPassword,
        code,
        phone: regPhone,
        first_name: firstName,
        last_name: lastName,
        role,
      });
      await login(email, regPassword);
      onSuccess();
    } catch (e) {
      setMsg(mapError(e));
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/media/usc.svg" alt="USC" className="auth-logo" />
          <div className="auth-title">{authMode === "login" ? "Р’С…РѕРґ РІ USC" : "Р РµРіРёСЃС‚СЂР°С†РёСЏ РІ USC"}</div>
          <div className="auth-subtitle">
            {authMode === "login" ? "Р’РѕР№РґРёС‚Рµ РІ Р°РєРєР°СѓРЅС‚ РєРѕРјРїР°РЅРёРё" : "РЎРѕР·РґР°Р№С‚Рµ Р°РєРєР°СѓРЅС‚ Рё РїРѕРґС‚РІРµСЂРґРёС‚Рµ email РєРѕРґРѕРј"}
          </div>
        </div>

        <div className={`auth-mode-tabs ${authMode === "register" ? "is-register" : "is-login"}`}>
          <button type="button" className={`auth-mode-tab ${authMode === "login" ? "active" : ""}`} onClick={() => setAuthMode("login")}>
            Р’С…РѕРґ
          </button>
          <button
            type="button"
            className={`auth-mode-tab ${authMode === "register" ? "active" : ""}`}
            onClick={() => setAuthMode("register")}
          >
            Р РµРіРёСЃС‚СЂР°С†РёСЏ
          </button>
        </div>

        {authMode === "login" ? (
          <>
            <div className={`auth-tabs ${method === "phone" ? "is-phone" : "is-email"}`}>
              <button type="button" className={`auth-tab ${method === "email" ? "active" : ""}`} onClick={() => setMethod("email")}>
                Email + РїР°СЂРѕР»СЊ
              </button>
              <button type="button" className={`auth-tab ${method === "phone" ? "active" : ""}`} onClick={() => setMethod("phone")}>
                РўРµР»РµС„РѕРЅ + РєРѕРґ
              </button>
            </div>

            <div className={`auth-panels ${method === "phone" && phoneCodeSent ? "tall" : ""}`}>
              <div className={`auth-panel ${method === "email" ? "active" : ""}`}>
                <div className="auth-row">
                  <label>Email</label>
                  <input
                    data-testid="auth-login-email"
                    type="email"
                    value={loginEmailValue}
                    onChange={(e) => setLoginEmailValue(e.target.value)}
                    placeholder="seller@usc.market"
                  />
                </div>
                <div className="auth-row">
                  <label>РџР°СЂРѕР»СЊ</label>
                  <input
                    data-testid="auth-login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў"
                  />
                </div>
                                {captchaRequired && (
                  <div className="auth-row">
                    <label>Captcha token</label>
                    <input
                      type="text"
                      value={captchaToken}
                      onChange={(e) => setCaptchaToken(e.target.value)}
                      placeholder="pass-captcha"
                    />
                  </div>
                )}
                {lockoutSeconds > 0 && <div className="auth-msg">{`Блокировка: ${lockoutSeconds} сек`}</div>}
                <button
                  className="primary-button"
                  data-testid="auth-login-submit"
                  type="button"
                  onClick={submitLoginEmail}
                  disabled={busy}
                >
                  Р’РѕР№С‚Рё
                </button>
              </div>

              <div className={`auth-panel ${method === "phone" ? "active" : ""}`}>
                <div className="auth-row">
                  <label>РўРµР»РµС„РѕРЅ</label>
                  <input
                    type="tel"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="+996 ..."
                  />
                </div>
                {!phoneCodeSent ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={sendPhoneLoginCode}
                    disabled={busy || phoneCooldown > 0}
                  >
                    {phoneCooldown > 0 ? `РџРѕР»СѓС‡РёС‚СЊ РєРѕРґ (${phoneCooldown}СЃ)` : "РџРѕР»СѓС‡РёС‚СЊ РєРѕРґ"}
                  </button>
                ) : (
                  <>
                    <div className="auth-row">
                      <label>РљРѕРґ</label>
                      <input
                        value={loginPhoneCode}
                        onChange={(e) => setLoginPhoneCode(e.target.value)}
                        placeholder="123456"
                      />
                    </div>
                                        {captchaRequired && (
                      <div className="auth-row">
                        <label>Captcha token</label>
                        <input
                          type="text"
                          value={captchaToken}
                          onChange={(e) => setCaptchaToken(e.target.value)}
                          placeholder="pass-captcha"
                        />
                      </div>
                    )}
                    {lockoutSeconds > 0 && <div className="auth-msg">{`Блокировка: ${lockoutSeconds} сек`}</div>}
                    <button className="primary-button" type="button" onClick={verifyPhoneLoginCode} disabled={busy}>
                      Р’РѕР№С‚Рё
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="auth-row">
              <label>Р РѕР»СЊ</label>
              <div className="auth-seg">
                <button type="button" className={role === "buyer" ? "active" : ""} onClick={() => setRole("buyer")}>
                  РџРѕРєСѓРїР°С‚РµР»СЊ
                </button>
                <button type="button" className={role === "supplier" ? "active" : ""} onClick={() => setRole("supplier")}>
                  РџРѕСЃС‚Р°РІС‰РёРє
                </button>
              </div>
            </div>

            <div className="auth-body">
              <div className="auth-row">
                <label>Email</label>
                <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="seller@usc.market" />
              </div>
              <div className="auth-row">
                <label>РџР°СЂРѕР»СЊ</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў"
                />
                {regPassword.length > 0 && (
                  <div className="pwd-meter">
                    <div className={`pwd-bar level-${Math.min(passwordScore, 5)}`} />
                    <div className="pwd-label">{passwordLabel}</div>
                  </div>
                )}
              </div>
              <div className="auth-row">
                <label>РўРµР»РµС„РѕРЅ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)</label>
                <input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="+996 ..." />
              </div>
              <div className="auth-row split">
                <div className="auth-col">
                  <label>РРјСЏ</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="auth-col">
                  <label>Р¤Р°РјРёР»РёСЏ</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>

              {!emailCodeSent ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={sendRegisterEmailCode}
                  disabled={busy || emailCooldown > 0}
                >
                  {emailCooldown > 0 ? `РџРѕР»СѓС‡РёС‚СЊ РєРѕРґ (${emailCooldown}СЃ)` : "РџРѕР»СѓС‡РёС‚СЊ РєРѕРґ РЅР° email"}
                </button>
              ) : (
                <>
                  <div className="auth-row">
                    <label>РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ</label>
                    <input value={regCode} onChange={(e) => setRegCode(e.target.value)} placeholder="123456" />
                  </div>
                  <button className="primary-button" type="button" onClick={submitRegisterEmail} disabled={busy}>
                    РЎРѕР·РґР°С‚СЊ Р°РєРєР°СѓРЅС‚
                  </button>
                  <button className="auth-link" type="button" onClick={sendRegisterEmailCode} disabled={busy || emailCooldown > 0}>
                    {emailCooldown > 0 ? `РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ РїРѕРІС‚РѕСЂРЅРѕ (${emailCooldown}СЃ)` : "РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ РїРѕРІС‚РѕСЂРЅРѕ"}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {msg && <div className="auth-msg">{msg}</div>}

        {authMode === "login" ? (
          <div className="auth-test-box">
            <div className="auth-test-title">РўРµСЃС‚РѕРІС‹Рµ Р°РєРєР°СѓРЅС‚С‹ (РІСЂРµРјРµРЅРЅРѕ)</div>
            <div className="auth-test-subtitle">Р”Р»СЏ Р±С‹СЃС‚СЂРѕРіРѕ РІС…РѕРґР° Рё РїСЂРѕРІРµСЂРєРё Р°РЅР°Р»РёС‚РёРєРё. РџРѕС‚РѕРј СѓРґР°Р»РёРј.</div>
            <div className="auth-test-list">
              {TEST_ACCOUNTS.map((x) => (
                <div key={x.email} className="auth-test-item">
                  <div className="auth-test-main">
                    <div className="auth-test-email">{x.email}</div>
                    <div className="auth-test-pass">{`РџР°СЂРѕР»СЊ: ${x.password}`}</div>
                  </div>
                  <div className="auth-test-meta">
                    <span>{x.role}</span>
                    <span>{`РџСЂРѕРґР°Р¶Рё: ${x.sales}`}</span>
                    {x.purchases > 0 ? <span>{`РџРѕРєСѓРїРєРё: ${x.purchases}`}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}





