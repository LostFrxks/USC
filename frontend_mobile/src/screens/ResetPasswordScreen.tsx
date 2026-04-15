import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, router } from "expo-router";
import { View } from "react-native";
import { useSession } from "@/session/SessionProvider";
import { getAuthGuardState } from "@/session/authErrors";
import { useToast } from "@/providers/ToastProvider";
import { ActionCard, ActionGrid, DataRow, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { Screen } from "@/ui/Screen";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { TextField } from "@/ui/TextField";

const schema = z.object({
  code: z.string().min(4),
  newPassword: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const { resetPassword } = useSession();
  const toast = useToast();
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      newPassword: "",
    },
  });

  return (
    <Screen testID="screen-reset-password" title="Reset password" subtitle={email ? `Reset for ${email}` : "Enter the reset code and your new password"}>
      <View style={{ gap: 16 }}>
        <HeroBanner
          eyebrow="New password"
          title={email || "Reset password"}
          text="Verify the reset code, then create a new password and return to sign-in."
          aside={<MetaTag label="Recovery" tone="primary" />}
        />

        <StatGrid>
          <StatTile label="Email" value={email || "Missing"} tone="neutral" />
          <StatTile label="Step" value="Set password" tone="neutral" />
          <StatTile label="Captcha" value={captchaRequired ? "Required" : "Clear"} tone={captchaRequired ? "warning" : "success"} />
          <StatTile label="Lockout" value={lockoutSeconds > 0 ? `${lockoutSeconds}s` : "None"} tone={lockoutSeconds > 0 ? "danger" : "success"} />
        </StatGrid>

        <SectionCard title="Password reset" subtitle="Complete the reset with the verification code and a new password.">
          <InsetPanel tone={email ? "neutral" : "danger"}>
            <DataRow
              title="Recovery target"
              body={email || "Missing email parameter for this recovery flow."}
              meta="If the email is missing, return to the previous step and request a reset code again."
              trailing={<MetaTag label={email ? "Ready" : "Missing"} tone={email ? "success" : "danger"} />}
            />
          </InsetPanel>

          <InsetPanel tone="neutral">
            <Controller
              control={form.control}
              name="code"
              render={({ field, fieldState }) => (
                <TextField
                  label="Reset code"
                  testID="reset-code"
                  keyboardType="number-pad"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="newPassword"
              render={({ field, fieldState }) => (
                <TextField
                  label="New password"
                  testID="reset-password"
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
                value={captchaToken}
                onChangeText={setCaptchaToken}
                autoCapitalize="none"
              />
            ) : null}
          </InsetPanel>

          {captchaRequired || lockoutSeconds > 0 ? (
            <InsetPanel tone={lockoutSeconds > 0 ? "danger" : "warning"}>
              <DataRow
                title="Recovery guard"
                body={lockoutSeconds > 0 ? `Retry in ${lockoutSeconds}s.` : "Captcha verification is required before the next reset attempt."}
                meta="USC temporarily protects this recovery route after repeated or suspicious attempts."
                trailing={<MetaTag label={lockoutSeconds > 0 ? "Locked" : "Captcha"} tone={lockoutSeconds > 0 ? "danger" : "warning"} />}
              />
            </InsetPanel>
          ) : null}

          <PrimaryButton
            testID="reset-submit"
            disabled={form.formState.isSubmitting || !email || lockoutSeconds > 0}
            onPress={form.handleSubmit(async (values) => {
              try {
                await resetPassword({
                  email,
                  code: values.code,
                  newPassword: values.newPassword,
                  captchaToken: captchaRequired ? captchaToken : undefined,
                });
                toast.show("Password updated. Sign in with the new password.", "success");
                router.replace("/(auth)/login");
              } catch (error) {
                const auth = getAuthGuardState(error);
                setCaptchaRequired(auth.captchaRequired);
                setLockoutSeconds(auth.lockoutSeconds);
                toast.show(auth.message, "error");
              }
            })}
          >
            {form.formState.isSubmitting ? "Updating..." : "Update password"}
          </PrimaryButton>

          <SecondaryButton onPress={() => router.replace("/(auth)/login")}>Back to login</SecondaryButton>
        </SectionCard>

        <SectionCard title="Need another route?" subtitle="Return to login or restart the recovery sequence from the request step.">
          <ActionGrid>
            <ActionCard title="Back to login" text="Return to sign-in and try the new password or another auth route." onPress={() => router.replace("/(auth)/login")} />
            <ActionCard title="Request another code" text="Open the recovery request screen again if the code expired or the email changed." onPress={() => router.replace("/(auth)/forgot")} />
          </ActionGrid>
        </SectionCard>
      </View>
    </Screen>
  );
}
