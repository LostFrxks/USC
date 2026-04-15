import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/session/SessionProvider";
import { mapAuthError } from "@/session/authErrors";
import { useToast } from "@/providers/ToastProvider";
import { cardShadow, palette } from "@/ui/theme";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { TextField } from "@/ui/TextField";

const schema = z.object({
  email: z.email(),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordScreen() {
  const { requestPasswordResetCode } = useSession();
  const toast = useToast();
  const [cooldown, setCooldown] = useState(0);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <Image source={require("../../assets/auth/usc.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Восстановление доступа</Text>
            <Text style={styles.subtitle}>Получите код на email и сбросьте пароль</Text>
          </View>

          <View style={styles.panel}>
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <TextField
                  label="Email"
                  variant="auth"
                  testID="forgot-email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />

            {cooldown > 0 ? <Text style={styles.message}>{`Получить новый код через ${cooldown}с`}</Text> : null}

            <PrimaryButton
              testID="forgot-submit"
              disabled={form.formState.isSubmitting || cooldown > 0}
              onPress={form.handleSubmit(async (values) => {
                try {
                  const result = await requestPasswordResetCode(values.email);
                  setCooldown(60);
                  toast.show(result.code ? `Код: ${result.code} (dev)` : "Код отправлен на email", "success");
                  router.push({ pathname: "/(auth)/reset", params: { email: values.email } });
                } catch (error) {
                  toast.show(mapAuthError(error), "error");
                }
              })}
            >
              {form.formState.isSubmitting ? "Отправка..." : cooldown > 0 ? `Получить код (${cooldown}с)` : "Получить код"}
            </PrimaryButton>
          </View>

          <View style={styles.actions}>
            <SecondaryButton onPress={() => router.push("/(auth)/login")}>Назад ко входу</SecondaryButton>
            <SecondaryButton onPress={() => router.push("/(auth)/register")}>Регистрация</SecondaryButton>
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
  panel: {
    gap: 10,
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
