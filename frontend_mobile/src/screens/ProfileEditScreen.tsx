import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { DataRow, DataStack, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { palette } from "@/ui/theme";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  phone: z.string().optional(),
  isCourierEnabled: z.boolean(),
  companyName: z.string().optional(),
  companyPhone: z.string().optional(),
  companyAddress: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function workspaceTone(companyType?: string | null) {
  const normalized = String(companyType ?? "").toUpperCase();
  if (normalized === "BUYER") return "primary" as const;
  if (normalized === "SUPPLIER") return "accent" as const;
  return "neutral" as const;
}

export function ProfileEditScreen() {
  const { profile, services, refreshProfile } = useSession();
  const { activeCompanyId, activeCompany } = useSelectedCompany();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      isCourierEnabled: false,
      companyName: "",
      companyPhone: "",
      companyAddress: "",
    },
  });

  useEffect(() => {
    if (!profile) return;
    form.reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone ?? "",
      isCourierEnabled: Boolean(profile.isCourierEnabled),
      companyName: activeCompany?.name ?? "",
      companyPhone: activeCompany?.phone ?? "",
      companyAddress: activeCompany?.address ?? "",
    });
  }, [activeCompany?.address, activeCompany?.name, activeCompany?.phone, form, profile]);

  return (
    <Screen testID="screen-profile-edit" title="Edit profile" subtitle="Update both user and active company data.">
      <HeroBanner
        eyebrow="Profile management"
        title={activeCompany?.name ?? "Profile edit"}
        text="Update user identity, courier availability and active company details in one mobile settings flow."
        aside={<MetaTag label={profile?.isCourierEnabled ? "Courier enabled" : "Courier disabled"} tone={profile?.isCourierEnabled ? "success" : "neutral"} />}
      />

      <StatGrid>
        <StatTile label="Email" value={profile?.email ?? "-"} tone="neutral" />
        <StatTile label="Courier" value={form.watch("isCourierEnabled") ? "Enabled" : "Disabled"} tone={form.watch("isCourierEnabled") ? "success" : "warning"} />
        <StatTile label="Workspace" value={activeCompany?.name ?? "None"} tone="neutral" />
        <StatTile label="Type" value={activeCompany?.companyType ?? "Company"} tone="neutral" />
      </StatGrid>

      <SectionCard title="Current workspace" subtitle="You are editing the user account plus the company currently active in mobile mode.">
        <InsetPanel tone={workspaceTone(activeCompany?.companyType)}>
          <DataStack>
            <DataRow
              title={activeCompany?.name ?? "No active company"}
              body={activeCompany?.address || activeCompany?.phone || "No company details yet"}
              meta={`Type ${activeCompany?.companyType || "Company"}${activeCompanyId ? ` | ID ${activeCompanyId}` : ""}`}
              trailing={<MetaTag label={activeCompany?.companyType || "Company"} tone={workspaceTone(activeCompany?.companyType)} />}
            />
          </DataStack>
        </InsetPanel>
      </SectionCard>

      <SectionCard title="Personal details" subtitle="Update the user identity attached to this mobile session.">
        <View style={styles.form}>
          <Controller
            control={form.control}
            name="firstName"
            render={({ field, fieldState }) => (
              <TextField testID="profile-edit-first-name" label="First name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="lastName"
            render={({ field, fieldState }) => (
              <TextField testID="profile-edit-last-name" label="Last name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <TextField
                testID="profile-edit-email"
                label="Email"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            )}
          />
          <Controller
            control={form.control}
            name="phone"
            render={({ field, fieldState }) => (
              <TextField testID="profile-edit-phone" label="Phone" value={field.value ?? ""} onChangeText={field.onChange} error={fieldState.error?.message} />
            )}
          />
        </View>
      </SectionCard>

      <SectionCard title="Courier role" subtitle="Control whether this account can be assigned to delivery workflows.">
        <Controller
          control={form.control}
          name="isCourierEnabled"
          render={({ field }) => (
            <Pressable testID="profile-edit-courier-toggle" style={({ pressed }) => [styles.togglePressable, pressed && styles.togglePressed]} onPress={() => field.onChange(!field.value)}>
              <InsetPanel tone={field.value ? "success" : "neutral"}>
                <View style={styles.toggleHead}>
                  <View style={styles.toggleCopy}>
                    <Text style={styles.toggleTitle}>Courier availability</Text>
                    <Text style={styles.toggleBody}>
                      Enable this if the user can be assigned as a courier in buyer or supplier delivery workflows.
                    </Text>
                  </View>
                  <MetaTag label={field.value ? "Enabled" : "Disabled"} tone={field.value ? "success" : "warning"} />
                </View>
              </InsetPanel>
            </Pressable>
          )}
        />
      </SectionCard>

      <SectionCard title="Company details" subtitle="These fields update the company that is currently active in mobile mode.">
        <View style={styles.form}>
          <Controller
            control={form.control}
            name="companyName"
            render={({ field, fieldState }) => (
              <TextField testID="profile-edit-company-name" label="Company name" value={field.value ?? ""} onChangeText={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="companyPhone"
            render={({ field, fieldState }) => (
              <TextField testID="profile-edit-company-phone" label="Company phone" value={field.value ?? ""} onChangeText={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="companyAddress"
            render={({ field, fieldState }) => (
              <TextField
                testID="profile-edit-company-address"
                label="Company address"
                value={field.value ?? ""}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                multiline
              />
            )}
          />
        </View>
      </SectionCard>

      <SectionCard title="Save changes" subtitle="Persist both user and company updates, then return to the profile hub.">
        <PrimaryButton
          testID="profile-edit-submit"
          disabled={form.formState.isSubmitting}
          onPress={form.handleSubmit(async (values) => {
            try {
              await services.profileApi.updateMe({
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                phone: values.phone,
                isCourierEnabled: values.isCourierEnabled,
                activeCompanyId: activeCompanyId ?? undefined,
                companyName: values.companyName,
                companyPhone: values.companyPhone,
                companyAddress: values.companyAddress,
              });
              await refreshProfile();
              await queryClient.invalidateQueries();
              toast.show("Profile updated.", "success");
              router.back();
            } catch (error) {
              toast.show(error instanceof Error ? error.message : "Failed to update profile.", "error");
            }
          })}
        >
          {form.formState.isSubmitting ? "Saving..." : "Save changes"}
        </PrimaryButton>
        <SecondaryButton onPress={() => router.back()}>Cancel</SecondaryButton>
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  togglePressable: {
    gap: 0,
  },
  togglePressed: {
    opacity: 0.9,
  },
  toggleHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "800",
  },
  toggleBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
