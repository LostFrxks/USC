import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useSession } from "@/session/SessionProvider";
import { getAuthGuardState } from "@/session/authErrors";
import { DEMO_ACCOUNTS } from "@/config/demoAccounts";
import { useToast } from "@/providers/ToastProvider";
import { cardShadow, palette } from "@/ui/theme";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { TextField } from "@/ui/TextField";

const emailSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

const phoneSchema = z.object({
  phone: z.string().min(6),
  code: z.string().min(4),
});

type EmailValues = z.infer<typeof emailSchema>;
type PhoneValues = z.infer<typeof phoneSchema>;

export function LoginScreen() {
  const { login, requestPhoneCode, loginWithPhoneCode } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const phoneForm = useForm<PhoneValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: "",
      code: "",
    },
  });

  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = setInterval(() => setPhoneCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => setLockoutSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  useEffect(() => {
    setCaptchaRequired(false);
    setCaptchaToken("");
    setLockoutSeconds(0);
    setPhoneHint(null);
    if (mode === "email") {
      setPhoneCodeSent(false);
      phoneForm.reset({ phone: phoneForm.getValues("phone"), code: "" });
    }
  }, [mode, phoneForm]);

  async function signInDemo(email: string, password: string) {
    try {
      await login(email, password);
      router.replace("/");
    } catch (error) {
      const auth = getAuthGuardState(error);
      setCaptchaRequired(auth.captchaRequired);
      setLockoutSeconds(auth.lockoutSeconds);
      toast.show(auth.message, "error");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <Image source={require("../../assets/auth/usc.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Вход в USC</Text>
            <Text style={styles.subtitle}>Войдите в аккаунт компании</Text>
          </View>

          <View style={[styles.authTabs, mode === "phone" && styles.authTabsPhone]}>
            <View style={[styles.authTabsSlider, mode === "phone" && styles.authTabsSliderPhone]} />
            <TouchableOpacity style={styles.authTab} onPress={() => setMode("email")} activeOpacity={0.9}>
              <Text style={[styles.authTabText, mode === "email" && styles.authTabTextActive]}>Email + пароль</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.authTab} onPress={() => setMode("phone")} activeOpacity={0.9}>
              <Text style={[styles.authTabText, mode === "phone" && styles.authTabTextActive]}>Телефон + код</Text>
            </TouchableOpacity>
          </View>

          {mode === "email" ? (
            <View style={styles.panel}>
              <Controller
                control={emailForm.control}
                name="email"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Email"
                    variant="auth"
                    testID="login-email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />

              <Controller
                control={emailForm.control}
                name="password"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Пароль"
                    variant="auth"
                    testID="login-password"
                    secureTextEntry
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />

              {captchaRequired ? (
                <TextField
                  label="Captcha token"
                  variant="auth"
                  value={captchaToken}
                  onChangeText={setCaptchaToken}
                  autoCapitalize="none"
                />
              ) : null}

              {lockoutSeconds > 0 ? <Text style={styles.message}>{`Блокировка: ${lockoutSeconds} сек`}</Text> : null}

              <PrimaryButton
                testID="login-submit"
                disabled={emailForm.formState.isSubmitting || lockoutSeconds > 0}
                onPress={emailForm.handleSubmit(async (values) => {
                  try {
                    await login(values.email, values.password, captchaRequired ? captchaToken : undefined);
                    router.replace("/");
                  } catch (error) {
                    const auth = getAuthGuardState(error);
                    setCaptchaRequired(auth.captchaRequired);
                    setLockoutSeconds(auth.lockoutSeconds);
                    toast.show(auth.message, "error");
                  }
                })}
              >
                {emailForm.formState.isSubmitting ? "Входим..." : "Войти"}
              </PrimaryButton>
            </View>
          ) : (
            <View style={[styles.panel, phoneCodeSent && styles.panelTall]}>
              <Controller
                control={phoneForm.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Телефон"
                    variant="auth"
                    testID="login-phone"
                    keyboardType="phone-pad"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />

              {phoneCodeSent ? (
                <Controller
                  control={phoneForm.control}
                  name="code"
                  render={({ field, fieldState }) => (
                    <TextField
                      label="Код"
                      variant="auth"
                      testID="login-phone-code"
                      keyboardType="number-pad"
                      value={field.value}
                      onChangeText={field.onChange}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              ) : null}

              {captchaRequired ? (
                <TextField
                  label="Captcha token"
                  variant="auth"
                  value={captchaToken}
                  onChangeText={setCaptchaToken}
                  autoCapitalize="none"
                />
              ) : null}

              {phoneHint ? <Text style={styles.message}>{phoneHint}</Text> : null}
              {lockoutSeconds > 0 ? <Text style={styles.message}>{`Блокировка: ${lockoutSeconds} сек`}</Text> : null}

              {!phoneCodeSent ? (
                <PrimaryButton
                  testID="login-phone-request-code"
                  disabled={phoneForm.formState.isSubmitting || phoneCooldown > 0}
                  onPress={phoneForm.handleSubmit(async (values) => {
                    try {
                      const result = await requestPhoneCode(values.phone);
                      setPhoneCodeSent(true);
                      setPhoneCooldown(60);
                      setPhoneHint(result.code ? `Код: ${result.code} (dev)` : "Код отправлен");
                    } catch (error) {
                      const auth = getAuthGuardState(error);
                      setCaptchaRequired(auth.captchaRequired);
                      setLockoutSeconds(auth.lockoutSeconds);
                      toast.show(auth.message, "error");
                    }
                  })}
                >
                  {phoneForm.formState.isSubmitting ? "Отправка..." : phoneCooldown > 0 ? `Получить код (${phoneCooldown}с)` : "Получить код"}
                </PrimaryButton>
              ) : (
                <>
                  <PrimaryButton
                    testID="login-phone-submit"
                    disabled={phoneForm.formState.isSubmitting || lockoutSeconds > 0}
                    onPress={phoneForm.handleSubmit(async (values) => {
                      try {
                        await loginWithPhoneCode({
                          phone: values.phone,
                          code: values.code,
                          captchaToken: captchaRequired ? captchaToken : undefined,
                        });
                        router.replace("/");
                      } catch (error) {
                        const auth = getAuthGuardState(error);
                        setCaptchaRequired(auth.captchaRequired);
                        setLockoutSeconds(auth.lockoutSeconds);
                        toast.show(auth.message, "error");
                      }
                    })}
                  >
                    {phoneForm.formState.isSubmitting ? "Проверка..." : "Войти"}
                  </PrimaryButton>
                  <SecondaryButton
                    disabled={phoneCooldown > 0}
                    onPress={async () => {
                      try {
                        const result = await requestPhoneCode(phoneForm.getValues("phone"));
                        setPhoneCooldown(60);
                        setPhoneHint(result.code ? `Код: ${result.code} (dev)` : "Код отправлен");
                      } catch (error) {
                        const auth = getAuthGuardState(error);
                        setCaptchaRequired(auth.captchaRequired);
                        setLockoutSeconds(auth.lockoutSeconds);
                        toast.show(auth.message, "error");
                      }
                    }}
                  >
                    {phoneCooldown > 0 ? `Отправить повторно (${phoneCooldown}с)` : "Отправить код повторно"}
                  </SecondaryButton>
                </>
              )}
            </View>
          )}

          <View style={styles.demoBox}>
            <View style={styles.demoHead}>
              <View>
                <Text style={styles.demoTitle}>Тестовые аккаунты</Text>
                <Text style={styles.demoSubtitle}>Для быстрого входа и проверки аналитики</Text>
              </View>
              <View style={styles.demoScrollHint}>
                <View style={styles.demoScrollBar} />
              </View>
            </View>

            <View style={styles.demoList}>
              {DEMO_ACCOUNTS.map((account) => (
                <View key={account.id} style={styles.demoItem}>
                  <View style={styles.demoTop}>
                    <View style={styles.demoMain}>
                      <Text style={styles.demoEmail}>{account.email}</Text>
                      <Text style={styles.demoPass}>{`Пароль: ${account.password}`}</Text>
                    </View>
                    <SecondaryButton onPress={() => void signInDemo(account.email, account.password)}>Войти</SecondaryButton>
                  </View>
                  <View style={styles.demoMeta}>
                    <Text style={styles.demoMetaChip}>{account.role === "buyer" ? "Покупатель" : "Поставщик"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            <SecondaryButton onPress={() => router.push("/(auth)/register")}>Регистрация</SecondaryButton>
            <SecondaryButton onPress={() => router.push("/(auth)/forgot")}>Забыли пароль?</SecondaryButton>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  screen: {
    minHeight: "100%",
    paddingHorizontal: 16,
    paddingVertical: 28,
    justifyContent: "center",
  },
  card: {
    ...cardShadow,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 15,
  },
  header: {
    alignItems: "center",
    gap: 6,
  },
  logo: {
    width: 76,
    height: 36,
  },
  title: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 12,
    textAlign: "center",
  },
  authTabs: {
    position: "relative",
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    padding: 6,
    gap: 8,
  },
  authTabsPhone: {},
  authTabsSlider: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: 6,
    width: "47%",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  authTabsSliderPhone: {
    left: "51%",
  },
  authTab: {
    flex: 1,
    zIndex: 1,
  },
  authTabText: {
    textAlign: "center",
    paddingVertical: 8,
    fontSize: 12,
    color: palette.muted,
  },
  authTabTextActive: {
    color: palette.text,
    fontWeight: "700",
  },
  panel: {
    gap: 10,
  },
  panelTall: {
    minHeight: 220,
  },
  message: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  demoBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    backgroundColor: "#F8FAFC",
    padding: 12,
    gap: 10,
  },
  demoHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  demoTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "800",
  },
  demoSubtitle: {
    color: palette.muted,
    fontSize: 11,
  },
  demoScrollHint: {
    width: 36,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#EAF0FB",
    alignItems: "center",
    justifyContent: "center",
  },
  demoScrollBar: {
    width: 18,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  demoList: {
    gap: 10,
  },
  demoItem: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    padding: 12,
    gap: 8,
  },
  demoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  demoMain: {
    flex: 1,
    gap: 4,
  },
  demoEmail: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "800",
  },
  demoPass: {
    color: palette.muted,
    fontSize: 12,
  },
  demoMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  demoMetaChip: {
    color: "#1E3A8A",
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  actions: {
    gap: 10,
  },
});
