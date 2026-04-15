import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { View } from "react-native";
import { clearPendingRegistration, readPendingRegistration } from "@/session/pendingRegistration";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { ActionCard, ActionGrid, DataRow, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { Screen } from "@/ui/Screen";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { TextField } from "@/ui/TextField";
import { LoadingScreen } from "@/ui/LoadingScreen";

const schema = z.object({
  code: z.string().min(4),
});

type FormValues = z.infer<typeof schema>;

export function VerifyEmailScreen() {
  const { registerBuyer } = useSession();
  const toast = useToast();
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof readPendingRegistration>>>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
    },
  });

  useEffect(() => {
    let mounted = true;
    void readPendingRegistration().then((value) => {
      if (!mounted) return;
      setDraft(value);
      setLoadingDraft(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loadingDraft) {
    return <LoadingScreen text="Loading registration draft..." />;
  }

  if (!draft) {
    return (
      <Screen title="Verification required" subtitle="No registration draft was found.">
        <View style={{ gap: 16, paddingHorizontal: 16, paddingTop: 8 }}>
          <SectionCard title="Missing registration draft" subtitle="This verification step needs a pending email registration first.">
            <ActionGrid>
              <ActionCard
                title="Back to register"
                text="Start a new buyer registration and request another email verification code."
                onPress={() => router.replace("/(auth)/register")}
              />
            </ActionGrid>
          </SectionCard>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Verify email" subtitle={`Code for ${draft.email}`}>
      <View style={{ gap: 16 }}>
        <HeroBanner
          eyebrow="Email verification"
          title={draft.email}
          text="Enter the verification code to finish buyer registration and open the workspace."
          aside={<MetaTag label="Email code" tone="primary" />}
        />

        <StatGrid>
          <StatTile label="Step" value="Verify" tone="neutral" />
          <StatTile label="Role" value="Buyer" tone="neutral" />
          <StatTile label="Email" value={draft.email} tone="neutral" />
          <StatTile label="Phone" value={draft.phone || "Optional"} tone="neutral" />
        </StatGrid>

        <SectionCard title="Registration draft" subtitle="This is the buyer account that will be created after verification.">
          <InsetPanel tone="neutral">
            <DataRow
              title={`${draft.firstName ?? ""} ${draft.lastName ?? ""}`.trim() || draft.email}
              body={draft.email}
              meta={draft.phone || "No phone attached"}
              trailing={<MetaTag label="Pending" tone="warning" />}
            />
          </InsetPanel>
        </SectionCard>

        <SectionCard title="Verification code" subtitle="This step completes buyer registration and signs the user in.">
          <InsetPanel tone="neutral">
            <Controller
              control={form.control}
              name="code"
              render={({ field, fieldState }) => (
                <TextField
                  label="Email code"
                  testID="verify-email-code"
                  keyboardType="number-pad"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </InsetPanel>
          <InsetPanel tone="neutral">
            <DataRow
              title="What happens next"
              body="USC creates the buyer account, signs the user in and restores the workspace shell immediately."
              meta="If the code is wrong or expired, start the registration flow again and request a fresh email code."
              trailing={<MetaTag label="Final step" tone="primary" />}
            />
          </InsetPanel>

          <PrimaryButton
            testID="verify-email-submit"
            disabled={form.formState.isSubmitting}
            onPress={form.handleSubmit(async (values) => {
              try {
                await registerBuyer({
                  email: draft.email,
                  password: draft.password,
                  code: values.code,
                  firstName: draft.firstName,
                  lastName: draft.lastName,
                  phone: draft.phone,
                });
                await clearPendingRegistration();
                router.replace("/");
              } catch (error) {
                toast.show(error instanceof Error ? error.message : "Verification failed.", "error");
              }
            })}
          >
            {form.formState.isSubmitting ? "Creating account..." : "Create buyer account"}
          </PrimaryButton>

          <SecondaryButton onPress={() => router.replace("/(auth)/register")}>Start over</SecondaryButton>
        </SectionCard>
      </View>
    </Screen>
  );
}
