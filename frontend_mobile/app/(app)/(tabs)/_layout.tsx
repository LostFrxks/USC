import { Tabs } from "expo-router";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { cardShadow, palette } from "@/ui/theme";

export default function TabsLayout() {
  const { appRole } = useSelectedCompany();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarActiveBackgroundColor: palette.primarySoft,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          ...cardShadow,
          height: 78,
          paddingBottom: 12,
          paddingTop: 10,
          marginHorizontal: 14,
          marginBottom: 14,
          borderRadius: 24,
          backgroundColor: "#FFFFFF",
          borderColor: "#E4EBF8",
          borderWidth: 1,
        },
        tabBarItemStyle: {
          marginHorizontal: 4,
          marginVertical: 4,
          borderRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarButtonTestID: "tab-home" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarButtonTestID: "tab-orders" }} />
      <Tabs.Screen
        name="cart"
        options={{ title: "Cart", href: appRole === "buyer" ? undefined : null, tabBarButtonTestID: "tab-cart" }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{ title: "Deliveries", href: appRole === "supplier" ? undefined : null, tabBarButtonTestID: "tab-deliveries" }}
      />
      <Tabs.Screen
        name="publications"
        options={{ title: "SKUs", href: appRole === "supplier" ? undefined : null, tabBarButtonTestID: "tab-publications" }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarButtonTestID: "tab-profile" }} />
    </Tabs>
  );
}
