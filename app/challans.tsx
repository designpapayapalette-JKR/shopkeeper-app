import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, ScrollView, ActivityIndicator, RefreshControl, Text, Pressable } from "react-native";
import { Card, useTheme, Button, TextInput, Dialog, Portal, Chip, Snackbar, Searchbar } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth-context";
import { useTopInset, useBottomInset } from "../src/lib/useTopInset";

type ChallanItem = {
  id: string;
  product_id: string;
  quantity: number;
  hsn_code: string | null;
  taxable_value: number | null;
  tax_rate: number | null;
  product?: { name: string; sku: string | null; unit: string | null };
};

type Challan = {
  id: string;
  challan_number: string;
  party_id: string | null;
  destination: string | null;
  reason: string;
  place_of_supply: string | null;
  vehicle_number: string | null;
  transport_mode: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  total_taxable_value: number;
  notes: string | null;
  status: "pending" | "in_transit" | "delivered";
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  party: { name: string; gstin: string | null } | null;
  items?: ChallanItem[];
};

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: "clock-outline", color: "#F0AE4E", next: "in_transit" },
  in_transit: { label: "In Transit", icon: "truck-delivery", color: "#0368FE", next: "delivered" },
  delivered: { label: "Delivered", icon: "check-circle", color: "#2E9E5B", next: null },
} as const;

const REASONS = [
  { value: "supply", label: "Supply" },
  { value: "export", label: "Export" },
  { value: "job_work", label: "Job Work" },
  { value: "sales_return", label: "Sales Return" },
  { value: "line_sales", label: "Line Sales" },
  { value: "exhibition_or_fairs", label: "Exhibition / Fairs" },
  { value: "own_use", label: "Own Use" },
  { value: "others", label: "Others" },
];

const TRANSPORT_MODES = [
  { value: "road", label: "Road" },
  { value: "rail", label: "Rail" },
  { value: "air", label: "Air" },
  { value: "ship", label: "Ship" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ChallansScreen() {
  const { userRole } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const canEdit = userRole === "owner" || userRole === "manager" || userRole === "warehouse_manager" || userRole === "staff";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Detail bottom sheet
  const [detail, setDetail] = useState<Challan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Barcode scan state (placeholder)
  const [scannerActive, setScannerActive] = useState(false);

  // Create dialog
  const [createDialog, setCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formPartyId, setFormPartyId] = useState("");
  const [formPartySearch, setFormPartySearch] = useState("");
  const [formPartyResults, setFormPartyResults] = useState<any[]>([]);
  const [formReason, setFormReason] = useState("supply");
  const [formDestination, setFormDestination] = useState("");
  const [formPlaceOfSupply, setFormPlaceOfSupply] = useState("");
  const [formVehicle, setFormVehicle] = useState("");
  const [formTransportMode, setFormTransportMode] = useState("road");
  const [formDriverName, setFormDriverName] = useState("");
  const [formDriverPhone, setFormDriverPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formCart, setFormCart] = useState<{ productId: string; name: string; quantity: number }[]>([]);
  const [formProductSearch, setFormProductSearch] = useState("");
  const [formProductResults, setFormProductResults] = useState<any[]>([]);

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editChallan, setEditChallan] = useState<Challan | null>(null);
  const [editDestination, setEditDestination] = useState("");
  const [editPlaceOfSupply, setEditPlaceOfSupply] = useState("");
  const [editVehicle, setEditVehicle] = useState("");
  const [editTransportMode, setEditTransportMode] = useState("road");
  const [editDriverName, setEditDriverName] = useState("");
  const [editDriverPhone, setEditDriverPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Debounce refs
  const partySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const fetchChallans = useCallback(async () => {
    try {
      const params: any = { page, limit: 20 };
      if (search) {
        params.search = search;
      }
      const res = await api.get<{ data: Challan[]; meta: any }>("/challans", { params });
      setChallans(res.data || []);
      setMeta(res.meta);
    } catch { setChallans([]); }
  }, [page, search]);

  const fetchData = useCallback(async () => {
    await fetchChallans();
  }, [fetchChallans]);

  useEffect(() => { fetchData().finally(() => { setLoading(false); setRefreshing(false); }); }, [fetchData]);

  const searchParty = useCallback((q: string) => {
    setFormPartySearch(q);
    if (partySearchTimer.current) clearTimeout(partySearchTimer.current);
    if (q.length < 1) { setFormPartyResults([]); return; }
    partySearchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get<any>("/parties", { params: { search: q, limit: 10 } });
        setFormPartyResults(res.data || []);
      } catch { setFormPartyResults([]); }
    }, 300);
  }, []);

  const searchProduct = useCallback((q: string) => {
    setFormProductSearch(q);
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
    if (q.length < 1) { setFormProductResults([]); return; }
    productSearchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get<any>("/products", { params: { search: q, limit: 10 } });
        setFormProductResults(res.data || []);
      } catch { setFormProductResults([]); }
    }, 300);
  }, []);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get<{ data: Challan }>(`/challans/${id}/detail`);
      setDetail(res.data);
    } catch { setSnackbar({ visible: true, message: "Could not load challan details." }); }
    finally { setDetailLoading(false); }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const body: any = {
        reason: formReason,
        destination: formDestination || undefined,
        placeOfSupply: formPlaceOfSupply || undefined,
        vehicleNumber: formVehicle || undefined,
        transportMode: formTransportMode,
        driverName: formDriverName || undefined,
        driverPhone: formDriverPhone || undefined,
        notes: formNotes || undefined,
        items: formCart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      };
      if (formPartyId) body.partyId = formPartyId;
      if (formInvoiceId) body.invoiceId = formInvoiceId;

      await api.post("/challans", body);
      setCreateDialog(false);
      resetForm();
      await fetchChallans();
      setSnackbar({ visible: true, message: "Challan created" });
    } catch { setSnackbar({ visible: true, message: "Failed to create challan." }); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editChallan) return;
    setSaving(true);
    try {
      await api.patch(`/challans/${editChallan.id}`, {
        destination: editDestination || undefined,
        placeOfSupply: editPlaceOfSupply || undefined,
        vehicleNumber: editVehicle || undefined,
        transportMode: editTransportMode,
        driverName: editDriverName || undefined,
        driverPhone: editDriverPhone || undefined,
        notes: editNotes || undefined,
      });
      setEditDialog(false);
      setEditChallan(null);
      await fetchChallans();
      setSnackbar({ visible: true, message: "Challan updated" });
    } catch { setSnackbar({ visible: true, message: "Failed to update challan." }); }
    finally { setSaving(false); }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/challans/${id}/status`, { status });
      await fetchChallans();
      if (detail?.id === id) loadDetail(id);
      setSnackbar({ visible: true, message: `Status updated to ${status}` });
    } catch { setSnackbar({ visible: true, message: "Failed to update status." }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/challans/${id}`);
      await fetchChallans();
      setDetail(null);
      setSnackbar({ visible: true, message: "Challan deleted" });
    } catch { setSnackbar({ visible: true, message: "Failed to delete challan." }); }
  };

  const resetForm = () => {
    setFormPartyId("");
    setFormPartySearch("");
    setFormPartyResults([]);
    setFormReason("supply");
    setFormDestination("");
    setFormPlaceOfSupply("");
    setFormVehicle("");
    setFormTransportMode("road");
    setFormDriverName("");
    setFormDriverPhone("");
    setFormNotes("");
    setFormInvoiceId("");
    setFormCart([]);
    setFormProductSearch("");
    setFormProductResults([]);
  };

  const openEdit = (c: Challan) => {
    setEditChallan(c);
    setEditDestination(c.destination || "");
    setEditPlaceOfSupply(c.place_of_supply || "");
    setEditVehicle(c.vehicle_number || "");
    setEditTransportMode(c.transport_mode || "road");
    setEditDriverName(c.driver_name || "");
    setEditDriverPhone(c.driver_phone || "");
    setEditNotes(c.notes || "");
    setEditDialog(true);
  };

  const getStatusLabel = (s: string) => {
    const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG];
    return cfg || { label: s, icon: "help", color: "#9E9E9E" };
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-bg-dark">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-bg-dark">
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: bottomInset + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 mb-3">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <MaterialCommunityIcons name="clipboard-list" size={24} color={theme.colors.primary} />
            <Text className="text-2xl font-bold text-on-surface">Challans</Text>
          </View>
        </View>

        {/* Search */}
        <View className="px-4 mb-3">
          <Searchbar
            placeholder="Search challans..."
            value={search}
            onChangeText={setSearch}
            onClearIconPress={() => setSearch("")}
            onSubmitEditing={() => { setPage(1); fetchData(); }}
          />
        </View>

        {challans.length === 0 ? (
          <View className="items-center py-16">
            <MaterialCommunityIcons name="clipboard-list-outline" size={48} color={theme.colors.outlineVariant} />
            <Text className="text-sm text-on-surface-variant mt-3">No challans yet</Text>
            {canEdit && <Text className="text-xs text-on-surface-variant mt-1">Tap "+" to create one</Text>}
          </View>
        ) : (
          challans.map((c) => {
            const status = getStatusLabel(c.status);
            return (
              <Pressable key={c.id} onPress={() => { loadDetail(c.id); }}>
                <Card mode="elevated" className="mx-4 mb-2">
                  <Card.Content>
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: `${status.color}15` }}>
                          <MaterialCommunityIcons name={status.icon as any} size={18} color={status.color} />
                        </View>
                        <View>
                          <Text className="text-sm font-bold text-on-surface">{c.challan_number}</Text>
                          <Text className="text-[10px] text-on-surface-variant">
                            {c.party?.name || "Walk-in"} · {formatDate(c.created_at)}
                          </Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="text-sm font-bold text-on-surface">
                          ₹{Number(c.total_taxable_value).toLocaleString("en-IN")}
                        </Text>
                        <Chip
                          mode="flat"
                          compact
                          textStyle={{ fontSize: 9, color: status.color }}
                          style={{ backgroundColor: `${status.color}15`, height: 22, marginTop: 2 }}
                        >
                          {status.label}
                        </Chip>
                      </View>
                    </View>
                    {(c.vehicle_number || c.destination) && (
                      <View className="flex-row" style={{ gap: 12 }}>
                        {c.vehicle_number && (
                          <View className="flex-row items-center" style={{ gap: 4 }}>
                            <MaterialCommunityIcons name="truck" size={12} color={theme.colors.onSurfaceVariant} />
                            <Text className="text-[10px] text-on-surface-variant">{c.vehicle_number}</Text>
                          </View>
                        )}
                        {c.destination && (
                          <View className="flex-row items-center" style={{ gap: 4 }}>
                            <MaterialCommunityIcons name="map-marker" size={12} color={theme.colors.onSurfaceVariant} />
                            <Text className="text-[10px] text-on-surface-variant" numberOfLines={1}>{c.destination}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </Card.Content>
                </Card>
              </Pressable>
            );
          })
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <View className="flex-row justify-center items-center px-4 mt-3" style={{ gap: 12 }}>
            <Button mode="outlined" compact disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Text className="text-sm text-on-surface-variant">Page {meta.page} of {meta.totalPages}</Text>
            <Button mode="outlined" compact disabled={page >= meta.totalPages} onPress={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {canEdit && (
        <Pressable
          onPress={() => setCreateDialog(true)}
          className="absolute bottom-6 right-4 w-14 h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: theme.colors.primary, elevation: 6 }}
        >
          <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      {/* Detail Bottom Sheet */}
      <Portal>
        <Dialog visible={!!detail} onDismiss={() => setDetail(null)} style={{ maxHeight: "85%" }}>
          {detailLoading ? (
            <Dialog.Content>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </Dialog.Content>
          ) : detail ? (
            <>
              <Dialog.Title>
                <View>
                  <Text className="text-base font-bold">{detail.challan_number}</Text>
                  <Text className="text-xs text-on-surface-variant font-normal">{formatDate(detail.created_at)}</Text>
                </View>
              </Dialog.Title>
              <Dialog.ScrollArea style={{ maxHeight: 400 }}>
                <View style={{ gap: 12 }}>
                  {/* Status */}
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    {(["pending", "in_transit", "delivered"] as const).map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      const isCurrent = detail.status === s;
                      const isPast = s === "pending" || (s === "in_transit" && detail.status === "delivered");
                      return (
                        <React.Fragment key={s}>
                          <View className="flex-row items-center" style={{ gap: 4 }}>
                            <MaterialCommunityIcons
                              name={cfg.icon as any}
                              size={16}
                              color={isCurrent ? cfg.color : isPast ? cfg.color : theme.colors.outlineVariant}
                            />
                            <Text className={`text-xs font-bold ${isCurrent ? "" : "text-on-surface-variant"}`}
                              style={isCurrent ? { color: cfg.color } : {}}>
                              {cfg.label}
                            </Text>
                          </View>
                          {s !== "delivered" && <View className="w-4 h-px bg-outline-variant" />}
                        </React.Fragment>
                      );
                    })}
                  </View>

                  {/* Party */}
                  <View>
                    <Text className="text-[10px] text-on-surface-variant uppercase tracking-wide">Party</Text>
                    <Text className="text-sm font-bold text-on-surface">{detail.party?.name || "Walk-in / Unnamed"}</Text>
                    {detail.party?.gstin && <Text className="text-xs text-on-surface-variant">GSTIN: {detail.party.gstin}</Text>}
                  </View>

                  {/* Reason */}
                  <View>
                    <Text className="text-[10px] text-on-surface-variant uppercase tracking-wide">Reason</Text>
                    <Text className="text-sm text-on-surface capitalize">{detail.reason.replace(/_/g, " ")}</Text>
                  </View>

                  {/* Transport */}
                  {(detail.vehicle_number || detail.driver_name || detail.destination) && (
                    <View>
                      <Text className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Transport</Text>
                      {detail.vehicle_number && <Text className="text-xs text-on-surface">Vehicle: {detail.vehicle_number}</Text>}
                      {detail.driver_name && <Text className="text-xs text-on-surface">Driver: {detail.driver_name} {detail.driver_phone ? `(${detail.driver_phone})` : ""}</Text>}
                      {detail.destination && <Text className="text-xs text-on-surface">Destination: {detail.destination}</Text>}
                      {detail.place_of_supply && <Text className="text-xs text-on-surface">Place of Supply: {detail.place_of_supply}</Text>}
                    </View>
                  )}

                  {/* Items */}
                  {detail.items && detail.items.length > 0 && (
                    <View>
                      <Text className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Items</Text>
                      {detail.items.map((item) => (
                        <View key={item.id} className="flex-row items-center justify-between py-1 border-b border-outline-variant/30">
                          <View className="flex-1">
                            <Text className="text-xs font-semibold text-on-surface">{item.product?.name || item.product_id}</Text>
                            <Text className="text-[10px] text-on-surface-variant">
                              {item.product?.sku || ""} {item.hsn_code ? `HSN: ${item.hsn_code}` : ""}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-xs text-on-surface">{Number(item.quantity).toLocaleString("en-IN")} {item.product?.unit || "pcs"}</Text>
                            {item.taxable_value != null && (
                              <Text className="text-xs font-bold text-on-surface">₹{Number(item.taxable_value).toLocaleString("en-IN")}</Text>
                            )}
                          </View>
                        </View>
                      ))}
                      <View className="flex-row justify-between pt-2">
                        <Text className="text-xs font-bold text-on-surface">Total</Text>
                        <Text className="text-sm font-black text-primary">₹{Number(detail.total_taxable_value).toLocaleString("en-IN")}</Text>
                      </View>
                    </View>
                  )}

                  {/* Notes */}
                  {detail.notes && (
                    <View>
                      <Text className="text-[10px] text-on-surface-variant uppercase tracking-wide">Notes</Text>
                      <Text className="text-xs text-on-surface">{detail.notes}</Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {canEdit && detail.status === "pending" && (
                      <>
                        <Button compact mode="contained" onPress={() => { setDetail(null); openEdit(detail); }}>
                          Edit Logistics
                        </Button>
                        <Button
                          compact mode="contained"
                          onPress={() => handleStatus(detail.id, "in_transit")}
                          icon="truck-delivery"
                        >
                          Mark In Transit
                        </Button>
                        <Button compact mode="outlined" textColor={theme.colors.error} onPress={() => handleDelete(detail.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                    {canEdit && detail.status === "in_transit" && (
                      <Button compact mode="contained" onPress={() => handleStatus(detail.id, "delivered")} icon="check-circle">
                        Mark Delivered
                      </Button>
                    )}
                  </View>
                </View>
              </Dialog.ScrollArea>
              <Dialog.Actions>
                <Button onPress={() => setDetail(null)}>Close</Button>
              </Dialog.Actions>
            </>
          ) : null}
        </Dialog>
      </Portal>

      {/* Create Dialog */}
      <Portal>
        <Dialog visible={createDialog} onDismiss={() => { setCreateDialog(false); resetForm(); }} style={{ maxHeight: "90%" }}>
          <Dialog.Title>New Challan</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 500 }}>
            <View style={{ gap: 12 }}>
              {/* Party Search */}
              <Text className="text-xs text-on-surface-variant">Party (optional)</Text>
              <TextInput
                mode="outlined"
                value={formPartySearch}
                onChangeText={searchParty}
                placeholder="Search parties..."
                dense
              />
              {formPartyResults.length > 0 && (
                <View className="border border-outline-variant rounded-xl">
                  {formPartyResults.map((p: any) => (
                    <Pressable
                      key={p.id}
                      onPress={() => { setFormPartyId(p.id); setFormPartySearch(p.name); setFormPartyResults([]); }}
                      className="px-3 py-2 border-b border-outline-variant/30"
                    >
                      <Text className="text-sm text-on-surface">{p.name}</Text>
                      {p.gstin && <Text className="text-[10px] text-on-surface-variant">{p.gstin}</Text>}
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Reason */}
              <Text className="text-xs text-on-surface-variant">Reason</Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r.value}
                    onPress={() => setFormReason(r.value)}
                    className={`px-3 py-1.5 rounded-full border ${formReason === r.value ? "bg-primary border-0" : "border-outline-variant"}`}
                  >
                    <Text className={`text-xs font-bold ${formReason === r.value ? "text-white" : "text-on-surface-variant"}`}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput mode="outlined" label="Destination (optional)" value={formDestination} onChangeText={setFormDestination} dense />
              <TextInput mode="outlined" label="Place of Supply (optional)" value={formPlaceOfSupply} onChangeText={setFormPlaceOfSupply} dense />
              <TextInput mode="outlined" label="Vehicle Number (optional)" value={formVehicle} onChangeText={setFormVehicle} dense />

              {/* Transport Mode */}
              <Text className="text-xs text-on-surface-variant">Transport Mode</Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {TRANSPORT_MODES.map((m) => (
                  <Pressable
                    key={m.value}
                    onPress={() => setFormTransportMode(m.value)}
                    className={`px-3 py-1.5 rounded-full border ${formTransportMode === m.value ? "bg-primary border-0" : "border-outline-variant"}`}
                  >
                    <Text className={`text-xs font-bold ${formTransportMode === m.value ? "text-white" : "text-on-surface-variant"}`}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput mode="outlined" label="Driver Name (optional)" value={formDriverName} onChangeText={setFormDriverName} dense />
              <TextInput mode="outlined" label="Driver Phone (optional)" value={formDriverPhone} onChangeText={setFormDriverPhone} dense keyboardType="phone-pad" />
              <TextInput mode="outlined" label="Notes (optional)" value={formNotes} onChangeText={setFormNotes} multiline dense />
              <TextInput mode="outlined" label="Link Invoice ID (optional)" value={formInvoiceId} onChangeText={setFormInvoiceId} dense />

              {/* Products */}
              <Text className="text-xs text-on-surface-variant">Items ({formCart.length})</Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <TextInput
                  mode="outlined"
                  value={formProductSearch}
                  onChangeText={searchProduct}
                  placeholder="Search products or scan barcode..."
                  dense
                  style={{ flex: 1 }}
                />
                <Pressable onPress={() => setScannerActive(true)} className="w-10 h-10 rounded-lg bg-primary items-center justify-center">
                  <MaterialCommunityIcons name="barcode-scan" size={20} color="white" />
                </Pressable>
              </View>
              {formProductResults.length > 0 && (
                <View className="border border-outline-variant rounded-xl max-h-32">
                  {formProductResults.map((p: any) => (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        const existing = formCart.find((c) => c.productId === p.id);
                        if (existing) {
                          setFormCart(formCart.map((c) => c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c));
                        } else {
                          setFormCart([...formCart, { productId: p.id, name: p.name, quantity: 1 }]);
                        }
                        setFormProductSearch("");
                        setFormProductResults([]);
                      }}
                      className="px-3 py-2 border-b border-outline-variant/30"
                    >
                      <Text className="text-sm text-on-surface">{p.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {formCart.map((item, idx) => (
                <View key={item.productId} className="flex-row items-center bg-surface-variant rounded-xl px-3 py-2" style={{ gap: 8 }}>
                  <Text className="text-sm font-bold text-on-surface flex-1" numberOfLines={1}>{item.name}</Text>
                  <Pressable onPress={() => setFormCart(formCart.map((c) => c.productId === item.productId ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))} className="w-7 h-7 rounded-full bg-surface-container-lowest dark:bg-surface-dark items-center justify-center">
                    <MaterialCommunityIcons name="minus" size={14} color={theme.colors.onSurfaceVariant} />
                  </Pressable>
                  <Text className="text-sm font-bold w-5 text-center text-on-surface">{item.quantity}</Text>
                  <Pressable onPress={() => setFormCart(formCart.map((c) => c.productId === item.productId ? { ...c, quantity: c.quantity + 1 } : c))} className="w-7 h-7 rounded-full bg-surface-container-lowest dark:bg-surface-dark items-center justify-center">
                    <MaterialCommunityIcons name="plus" size={14} color={theme.colors.onSurfaceVariant} />
                  </Pressable>
                  <Pressable onPress={() => setFormCart(formCart.filter((c) => c.productId !== item.productId))}>
                    <MaterialCommunityIcons name="close" size={16} color={theme.colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => { setCreateDialog(false); resetForm(); }}>Cancel</Button>
            <Button onPress={handleCreate} loading={saving} disabled={saving}>Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit Logistics Dialog */}
      <Portal>
        <Dialog visible={editDialog} onDismiss={() => setEditDialog(false)}>
          <Dialog.Title>Edit Logistics</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <TextInput mode="outlined" label="Destination" value={editDestination} onChangeText={setEditDestination} dense />
            <TextInput mode="outlined" label="Place of Supply" value={editPlaceOfSupply} onChangeText={setEditPlaceOfSupply} dense />
            <TextInput mode="outlined" label="Vehicle Number" value={editVehicle} onChangeText={setEditVehicle} dense />
            <Text className="text-xs text-on-surface-variant">Transport Mode</Text>
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {TRANSPORT_MODES.map((m) => (
                <Pressable
                  key={m.value}
                  onPress={() => setEditTransportMode(m.value)}
                  className={`px-3 py-1.5 rounded-full border ${editTransportMode === m.value ? "bg-primary border-0" : "border-outline-variant"}`}
                >
                  <Text className={`text-xs font-bold ${editTransportMode === m.value ? "text-white" : "text-on-surface-variant"}`}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput mode="outlined" label="Driver Name" value={editDriverName} onChangeText={setEditDriverName} dense />
            <TextInput mode="outlined" label="Driver Phone" value={editDriverPhone} onChangeText={setEditDriverPhone} dense keyboardType="phone-pad" />
            <TextInput mode="outlined" label="Notes" value={editNotes} onChangeText={setEditNotes} multiline dense />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialog(false)}>Cancel</Button>
            <Button onPress={handleEdit} loading={saving} disabled={saving}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Barcode Scanner Placeholder */}
      <Portal>
        <Dialog visible={scannerActive} onDismiss={() => setScannerActive(false)}>
          <Dialog.Title>Scan Barcode</Dialog.Title>
          <Dialog.Content>
            <Text className="text-sm text-on-surface-variant mb-3">Point your camera at a product barcode to add it to the challan.</Text>
            <Text className="text-xs text-on-surface-variant">Note: Camera access requires granting camera permissions. Type the product name manually as a fallback.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setScannerActive(false)}>Cancel</Button>
            <Button onPress={() => { setScannerActive(false); }}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={2000}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}
