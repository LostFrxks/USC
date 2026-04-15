import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSession } from "@/session/SessionProvider";
import { savePendingRegistration } from "@/session/pendingRegistration";
import { getAuthGuardState, mapAuthError } from "@/session/authErrors";
import { useToast } from "@/providers/ToastProvider";
import { cardShadow, palette } from "@/ui/theme";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { TextField } from "@/ui/TextField";

const emailSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

const phoneSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(6),
  code: z.string().min(4),
  email: z.string().optional(),
});

type EmailValues = z.infer<typeof emailSchema>;
type PhoneValues = z.infer<typeof phoneSchema>;

export function RegisterScreen() {
  const { requestEmailCode, requestPhoneCode, registerBuyerWithPhone } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
    },
  });

  const phoneForm = useForm<PhoneValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      code: "",
      email: "",
    },
  });

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => setEmailCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

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
      phoneForm.reset({
        firstName: phoneForm.getValues("firstName"),
        lastName: phoneForm.getValues("lastName"),
        phone: phoneForm.getValues("phone"),
        code: "",
        email: phoneForm.getValues("email"),
      });
    }
  }, [mode, phoneForm]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <Image source={require("../../assets/auth/usc.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Регистрация в USC</Text>
            <Text style={styles.subtitle}>Создайте аккаунт и подтвердите его кодом</Text>
          </View>

          <View style={styles.modeTabs}>
            <View style={styles.modeSlider} />
            <TouchableOpacity style={styles.modeTab} activeOpacity={0.9} onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.modeTabText}>Вход</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modeTab} activeOpacity={0.9}>
              <Text style={[styles.modeTabText, styles.modeTabTextActive]}>Регистрация</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.authTabs, mode === "phone" && styles.authTabsPhone]}>
            <View style={[styles.authTabsSlider, mode === "phone" && styles.authTabsSliderPhone]} />
            <TouchableOpacity style={styles.authTab} onPress={() => setMode("email")} activeOpacity={0.9}>
              <Text style={[styles.authTabText, mode === "email" && styles.authTabTextActive]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.authTab} onPress={() => setMode("phone")} activeOpacity={0.9}>
              <Text style={[styles.authTabText, mode === "phone" && styles.authTabTextActive]}>Телефон</Text>
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
                    testID="register-email"
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
                    testID="register-password"
                    secureTextEntry
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <View style={styles.splitRow}>
                <View style={styles.splitCol}>
                  <Controller
                    control={emailForm.control}
                    name="firstName"
                    render={({ field, fieldState }) => (
                      <TextField
                        label="Имя"
                        variant="auth"
                        testID="register-first-name"
                        value={field.value}
                        onChangeText={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </View>
                <View style={styles.splitCol}>
                  <Controller
                    control={emailForm.control}
                    name="lastName"
                    render={({ field, fieldState }) => (
                      <TextField
                        label="Фамилия"
                        variant="auth"
                        testID="register-last-name"
                        value={field.value}
                        onChangeText={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </View>
              </View>
              <Controller
                control={emailForm.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Телефон (опционально)"
                    variant="auth"
                    testID="register-phone"
                    value={field.value ?? ""}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />

              {emailCooldown > 0 ? <Text style={styles.message}>{`Получить код повторно через ${emailCooldown}с`}</Text> : null}

              <PrimaryButton
                testID="register-send-code"
                disabled={emailForm.formState.isSubmitting || emailCooldown > 0}
                onPress={emailForm.handleSubmit(async (values) => {
                  try {
                    const result = await requestEmailCode(values.email);
                    await savePendingRegistration(values);
                    setEmailCooldown(60);
                    toast.show(result.code ? `Код: ${result.code} (dev)` : "Код отправлен на email", "success");
                    router.push("/(auth)/verify-email");
                  } catch (error) {
                    toast.show(mapAuthError(error), "error");
                  }
                })}
              >
                {emailForm.formState.isSubmitting ? "Отправка..." : emailCooldown > 0 ? `Получить код (${emailCooldown}с)` : "Получить код на email"}
              </PrimaryButton>
            </View>
          ) : (
            <View style={[styles.panel, phoneCodeSent && styles.panelTall]}>
              <View style={styles.splitRow}>
                <View style={styles.splitCol}>
                  <Controller
                    control={phoneForm.control}
                    name="firstName"
                    render={({ field, fieldState }) => (
                      <TextField
                        label="Имя"
                        variant="auth"
                        testID="register-phone-first-name"
                        value={field.value}
                        onChangeText={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </View>
                <View style={styles.splitCol}>
                  <Controller
                    control={phoneForm.control}
                    name="lastName"
                    render={({ field, fieldState }) => (
                      <TextField
                        label="Фамилия"
                        variant="auth"
                        testID="register-phone-last-name"
                        value={field.value}
                        onChangeText={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </View>
              </View>

              <Controller
                control={phoneForm.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Телефон"
                    variant="auth"
                    testID="register-phone-number"
                    keyboardType="phone-pad"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={phoneForm.control}
                name="email"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Email (опционально)"
                    variant="auth"
                    testID="register-phone-email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={field.value ?? ""}
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
                      testID="register-phone-code"
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
                  testID="register-phone-request-code"
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
                    testID="register-phone-submit"
                    disabled={phoneForm.formState.isSubmitting || lockoutSeconds > 0}
                    onPress={phoneForm.handleSubmit(async (values) => {
                      try {
                        await registerBuyerWithPhone({
                          phone: values.phone,
                          code: values.code,
                          email: values.email?.trim() || undefined,
                          firstName: values.firstName,
                          lastName: values.lastName,
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
                    {phoneForm.formState.isSubmitting ? "Создание..." : "Создать аккаунт"}
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
                    {phoneCooldown > 0 ? `Повторно (${phoneCooldown}с)` : "Отправить код повторно"}
                  </SecondaryButton>
                </>
              )}
            </View>
          )}

          <View style={styles.actions}>
            <SecondaryButton onPress={() => router.push("/(auth)/login")}>Уже есть аккаунт?</SecondaryButton>
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
  modeTabs: {
    position: "relative",
    flexDirection: "row",
    backgroundColor: "#EAF0FB",
    borderRadius: 999,
    padding: 6,
    gap: 8,
  },
  modeSlider: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: "51%",
    width: "47%",
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  modeTab: {
    flex: 1,
    zIndex: 1,
  },
  modeTabText: {
    textAlign: "center",
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: "700",
    color: "#466186",
  },
  modeTabTextActive: {
    color: "#FFFFFF",
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
    minHeight: 260,
  },
  splitRow: {
    flexDirection: "row",
    gap: 8,
  },
  splitCol: {
    flex: 1,
  },
  message: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    gap: 10,
  },
});
