import { getAuthGuardState, mapAuthError } from "@/session/authErrors";

describe("auth guard error mapping", () => {
  it("maps lockout payload into user-facing state", () => {
    const error = new Error('API POST /auth/login/ -> 429: {"reason_code":"locked_out","captcha_required":true,"lockout_seconds":45}');
    expect(mapAuthError(error)).toBe("Too many attempts. Retry in 45s.");
    expect(getAuthGuardState(error)).toEqual({
      message: "Too many attempts. Retry in 45s.",
      captchaRequired: true,
      lockoutSeconds: 45,
    });
  });

  it("maps captcha requirement into user-facing state", () => {
    const error = new Error('API POST /auth/phone/verify/ -> 403: {"reason_code":"captcha_required","captcha_required":true}');
    expect(getAuthGuardState(error)).toEqual({
      message: "This flow now requires captcha support.",
      captchaRequired: true,
      lockoutSeconds: 0,
    });
  });
});
