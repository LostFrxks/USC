type AuthGuardPayload = {
  reason_code?: string;
  captcha_required?: boolean;
  lockout_seconds?: number;
};

function parseGuardPayload(input: string): AuthGuardPayload | null {
  const jsonStart = input.indexOf("{");
  const source = jsonStart >= 0 ? input.slice(jsonStart) : input;
  try {
    return JSON.parse(source) as AuthGuardPayload;
  } catch {
    return null;
  }
}

export function mapAuthError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const payload = parseGuardPayload(text);

  if (payload?.reason_code === "locked_out") {
    if (payload.lockout_seconds && payload.lockout_seconds > 0) {
      return `Too many attempts. Retry in ${payload.lockout_seconds}s.`;
    }
    return "Too many attempts. Account is temporarily locked.";
  }
  if (payload?.reason_code === "captcha_required") {
    return "This flow now requires captcha support.";
  }
  if (payload?.reason_code === "rate_limited") {
    return "Too many requests. Try again later.";
  }

  if (text.includes("Invalid credentials")) return "Invalid email or password.";
  if (text.includes("Invalid phone")) return "Invalid phone number.";
  if (text.includes("Invalid code")) return "Invalid verification code.";
  if (text.includes("Code not requested")) return "Request a code first.";
  if (text.includes("Code expired")) return "Code expired. Request a new one.";
  if (text.includes("User with this email already exists")) return "This email is already registered.";
  if (text.includes("User with this phone already exists")) return "This phone is already registered.";
  if (text.includes("Phone already in use")) return "This phone is already in use.";
  if (text.includes("Email already in use")) return "This email is already in use.";

  return text;
}

export function getAuthGuardState(error: unknown): {
  message: string;
  captchaRequired: boolean;
  lockoutSeconds: number;
} {
  const text = error instanceof Error ? error.message : String(error);
  const payload = parseGuardPayload(text);
  return {
    message: mapAuthError(error),
    captchaRequired: Boolean(payload?.captcha_required),
    lockoutSeconds: Number(payload?.lockout_seconds ?? 0),
  };
}
