import { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import type { LatLng } from "@usc/core";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";
import { MAP_DEFAULT_LAT, MAP_DEFAULT_LNG, MAP_DEFAULT_ZOOM } from "@/config/env";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { DataRow, InsetPanel, MetaTag } from "@/ui/BusinessUI";
import { palette } from "@/ui/theme";
import { SheetFrame } from "@/ui/SheetFrame";

type MapPickerModalProps = {
  open: boolean;
  initialCoords?: LatLng | null;
  onClose: () => void;
  onConfirm: (coords: LatLng) => void;
};

type MapCenterMessage = {
  type: "center";
  lat: number;
  lng: number;
  zoom: number;
};

function buildMapHtml(lat: number, lng: number, zoom: number): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #f5f1e8;
      }
      .leaflet-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const startLat = ${lat};
      const startLng = ${lng};
      const startZoom = ${zoom};
      const map = L.map("map", { zoomControl: true }).setView([startLat, startLng], startZoom);
      const marker = L.marker([startLat, startLng]).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      function postCenter() {
        const center = map.getCenter();
        marker.setLatLng(center);
        const payload = {
          type: "center",
          lat: Number(center.lat.toFixed(6)),
          lng: Number(center.lng.toFixed(6)),
          zoom: map.getZoom()
        };
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      map.whenReady(postCenter);
      map.on("moveend", postCenter);
      map.on("zoomend", postCenter);
    </script>
  </body>
</html>`;
}

export function MapPickerModal({ open, initialCoords, onClose, onConfirm }: MapPickerModalProps) {
  const startingCoords = initialCoords ?? { lat: MAP_DEFAULT_LAT, lng: MAP_DEFAULT_LNG };
  const [selectedCoords, setSelectedCoords] = useState<LatLng>(startingCoords);

  useEffect(() => {
    if (!open) return;
    setSelectedCoords(startingCoords);
  }, [open, startingCoords.lat, startingCoords.lng]);

  const mapHtml = useMemo(() => buildMapHtml(startingCoords.lat, startingCoords.lng, MAP_DEFAULT_ZOOM), [startingCoords.lat, startingCoords.lng]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as MapCenterMessage;
      if (data.type !== "center") return;
      if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return;
      setSelectedCoords({ lat: data.lat, lng: data.lng });
    } catch {
      return;
    }
  }

  return (
    <Modal animationType="slide" transparent visible={open} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SheetFrame
          testID="map-picker-modal"
          eyebrow="Map picker"
          title="Pick delivery point"
          subtitle="Pan or zoom the map, then use the visible center as the checkout coordinates."
          footer={
            <View style={styles.actions}>
              <SecondaryButton testID="map-picker-cancel" onPress={onClose}>
                Cancel
              </SecondaryButton>
              <PrimaryButton testID="map-picker-confirm" onPress={() => onConfirm(selectedCoords)}>
                Use this point
              </PrimaryButton>
            </View>
          }
        >
          <InsetPanel tone="neutral" testID="map-picker-current-center">
            <DataRow
              title="Selected center"
              body={`${selectedCoords.lat.toFixed(6)}, ${selectedCoords.lng.toFixed(6)}`}
              meta="Pan or zoom the map until the center marker matches the intended delivery point."
              trailing={<MetaTag label="Live center" tone="primary" />}
            />
          </InsetPanel>
          <View style={styles.mapShell}>
            <WebView
              testID="map-picker-webview"
              originWhitelist={["*"]}
              source={{ html: mapHtml }}
              onMessage={handleMessage}
              startInLoadingState
              style={styles.webview}
            />
          </View>
        </SheetFrame>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000066",
  },
  mapShell: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 340,
  },
  webview: {
    flex: 1,
    minHeight: 340,
  },
  actions: {
    gap: 10,
  },
});
