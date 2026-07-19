import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  sku: string | null;
  unit: string;
}

interface SOItem {
  id: string;
  product_id: string;
  quantity: string;
  delivered_quantity: string;
  unit_price: string;
  product: { id: string; name: string; sku: string | null; unit: string };
}

interface SalesOrder {
  id: string;
  so_number: string;
  date: string;
  status: string;
  notes: string | null;
  customer: { id: string; name: string; phone: string | null };
  items: SOItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#6B7280", bg: "#F3F4F6" },
  confirmed: { label: "Confirmed", color: "#2563EB", bg: "#DBEAFE" },
  partially_delivered: { label: "Partial", color: "#D97706", bg: "#FEF3C7" },
  delivered: { label: "Delivered", color: "#16A34A", bg: "#DCFCE7" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["partially_delivered", "delivered", "cancelled"],
  partially_delivered: ["delivered", "cancelled"],
};

export default function SalesOrdersScreen() {
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const confirm = useConfirm();
  const router = useRouter();

  const [tab, setTab] = useState<"list" | "new">("list");
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadTrigger, setLoadTrigger] = useState(0);

  // New SO form
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Detail modal
  const [activeSO, setActiveSO] = useState<SalesOrder | null>(null);

  // Deliver modal
  const [showDeliver, setShowDeliver] = useState(false);
  const [deliverQtys, setDeliverQtys] = useState<Record<string, string>>({});
  const [delivering, setDelivering] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: SalesOrder[] }>("/sales-orders");
      setOrders(res.data ?? []);
    } catch (e) {
      console.error("Failed to load sales orders:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders, loadTrigger]);

  const loadFormData = useCallback(async () => {
    setFormLoading(true);
    try {
      const [pr, cr] = await Promise.all([
        api.get<{ data: Product[] }>("/products"),
        api.get<{ data: Customer[] }>("/parties", { params: { type: "customer" } }),
      ]);
      setProducts(pr.data ?? []);
      setCustomers(cr.data ?? []);
    } catch {
      Alert.alert("Error", "Failed to load form data.");
    } finally {
      setFormLoading(false);
    }
  }, []);

  const openNewTab = () => {
    setTab("new");
    loadFormData();
    setCart([]);
    setCustomerId("");
    setNotes("");
    setSearchQuery("");
  };

  const filteredProducts = products.filter(
    (p) =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        return prev.map((c) =>
          c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          quantity: 1,
          unitPrice: 0,
        },
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.productId === productId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c
      )
    );
  };

  const updateCartPrice = (productId: string, price: string) => {
    const num = parseFloat(price);
    if (isNaN(num)) return;
    setCart((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, unitPrice: Math.max(0, num) } : c))
    );
  };

  const removeCartItem = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  };

  const cartTotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  const handleCreateSO = async () => {
    if (!customerId || cart.length === 0) {
      Alert.alert("Required", "Select a customer and add at least one item.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/sales-orders", {
        customerId,
        notes: notes.trim() || undefined,
        items: cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
      });
      Alert.alert("Success", "Sales order created.");
      setTab("list");
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create sales order.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/sales-orders/${id}/status`, { status });
      setLoadTrigger((n) => n + 1);
      setActiveSO((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update status.");
    }
  };

  const openDetail = (so: SalesOrder) => setActiveSO(so);

  const openDeliver = () => {
    if (!activeSO) return;
    const initQtys: Record<string, string> = {};
    activeSO.items.forEach((item) => {
      initQtys[item.id] = String(
        Math.max(0, Number(item.quantity) - Number(item.delivered_quantity))
      );
    });
    setDeliverQtys(initQtys);
    setShowDeliver(true);
  };

  const handleDeliver = async () => {
    if (!activeSO) return;
    setDelivering(true);
    try {
      const items = Object.entries(deliverQtys)
        .filter(([, qty]) => parseFloat(qty) > 0)
        .map(([itemId, qty]) => {
          const item = activeSO.items.find((i) => i.id === itemId);
          return { productId: item!.product_id, quantity: parseFloat(qty) };
        });
      if (items.length === 0) {
        Alert.alert("Nothing to Deliver", "Enter at least one item quantity.");
        return;
      }
      await api.post(`/sales-orders/${activeSO.id}/deliver`, { items });
      Alert.alert("Success", "Delivery recorded.");
      setShowDeliver(false);
      setActiveSO(null);
      setLoadTrigger((n) => n + 1);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to record delivery.");
    } finally {
      setDelivering(false);
    }
  };

  const renderOrder = ({ item }: { item: SalesOrder }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
    const totalQty = item.items.reduce((s, i) => s + Number(i.quantity), 0);
    return (
      <Pressable
        onPress={() => openDetail(item)}
        className="bg-surface dark:bg-surface-dark p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm active:opacity-80"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-base font-bold text-text-primary dark:text-text-primary-dark">
              {item.so_number}
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">{item.customer.name}</Text>
            <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
              <View style={{ backgroundColor: cfg.bg }} className="px-2.5 py-1 rounded-full">
                <Text style={{ color: cfg.color }} className="text-xs font-bold">
                  {cfg.label}
                </Text>
              </View>
              <Text className="text-xs text-text-secondary">{totalQty} items</Text>
            </View>
          </View>
          <Text className="text-sm text-text-secondary">
            {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: topInset }}>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center active:opacity-70">
            <MaterialCommunityIcons name="arrow-left" size={22} color="#6B7280" />
          </Pressable>
          <Text className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
            Sales Orders
          </Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View className="px-6 mb-4 flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={() => setTab("list")}
          className={`flex-1 py-2.5 rounded-xl items-center border ${
            tab === "list"
              ? "bg-primary border-primary"
              : "bg-surface dark:bg-surface-dark border-gray-200 dark:border-zinc-800"
          }`}
        >
          <Text className={`text-xs font-bold uppercase tracking-wider ${tab === "list" ? "text-white" : "text-text-secondary"}`}>
            Orders
          </Text>
        </Pressable>
        <Pressable
          onPress={openNewTab}
          className={`flex-1 py-2.5 rounded-xl items-center border ${
            tab === "new"
              ? "bg-primary border-primary"
              : "bg-surface dark:bg-surface-dark border-gray-200 dark:border-zinc-800"
          }`}
        >
          <Text className={`text-xs font-bold uppercase tracking-wider ${tab === "new" ? "text-white" : "text-text-secondary"}`}>
            New Order
          </Text>
        </Pressable>
      </View>

      {tab === "list" ? (
        loading ? (
          <View className="flex-1 items-center justify-center pb-20">
            <ActivityIndicator size="large" color="#0368FE" />
          </View>
        ) : orders.length === 0 ? (
          <View className="flex-1 items-center justify-center pb-20 px-6">
            <MaterialCommunityIcons name="file-document-outline" size={48} color="#D1D5DB" />
            <Text className="text-base font-bold text-text-secondary mt-4">No sales orders yet</Text>
            <Text className="text-sm text-text-secondary mt-1 text-center">Create your first sales order to track commitments before billing.</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderOrder}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 24 }}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : formLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0368FE" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Customer Picker */}
            <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Customer *</Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {customers.length === 0 ? (
                  <Text className="text-sm text-text-secondary">No customers found. Add one from Ledger.</Text>
                ) : (
                  customers.slice(0, 20).map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setCustomerId(c.id)}
                      className={`px-3.5 py-2.5 rounded-xl border ${
                        customerId === c.id
                          ? "bg-primary border-primary"
                          : "bg-surface dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${customerId === c.id ? "text-white" : "text-text-secondary"}`}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </View>

            {/* Product Search */}
            <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Products</Text>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search products..."
                placeholderTextColor="#A0A0A0"
                className="bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 font-medium mb-3"
              />
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {filteredProducts.slice(0, 30).map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => addToCart(p)}
                    className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-surface dark:bg-zinc-900 active:opacity-70"
                  >
                    <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">{p.name}</Text>
                    <Text className="text-xs text-text-secondary">{p.sku || "No SKU"}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Cart */}
            <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
              <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-3">
                Cart ({cart.length})
              </Text>
              {cart.length === 0 ? (
                <Text className="text-sm text-text-secondary">No items added yet.</Text>
              ) : (
                cart.map((item) => (
                  <View
                    key={item.productId}
                    className="flex-row items-center py-3 border-b border-gray-100 dark:border-zinc-800"
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                        <Pressable onPress={() => updateCartQty(item.productId, -1)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-zinc-800 items-center justify-center">
                          <MaterialCommunityIcons name="minus" size={12} color="#6B7280" />
                        </Pressable>
                        <Text className="text-sm font-bold w-6 text-center">{item.quantity}</Text>
                        <Pressable onPress={() => updateCartQty(item.productId, 1)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-zinc-800 items-center justify-center">
                          <MaterialCommunityIcons name="plus" size={12} color="#6B7280" />
                        </Pressable>
                        <TextInput
                          value={item.unitPrice.toString()}
                          onChangeText={(v) => updateCartPrice(item.productId, v)}
                          keyboardType="decimal-pad"
                          className="bg-background dark:bg-zinc-900 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs font-bold w-20 text-right"
                        />
                      </View>
                    </View>
                    <Pressable onPress={() => removeCartItem(item.productId)} className="w-8 h-8 items-center justify-center">
                      <MaterialCommunityIcons name="close" size={16} color="#D64545" />
                    </Pressable>
                  </View>
                ))
              )}
              {cart.length > 0 && (
                <Text className="text-base font-bold text-text-primary dark:text-text-primary-dark text-right mt-3">
                  Total: ₹{cartTotal.toLocaleString("en-IN")}
                </Text>
              )}
            </View>

            {/* Notes */}
            <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Delivery instructions, etc."
                placeholderTextColor="#A0A0A0"
                multiline
                numberOfLines={2}
                className="bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 font-medium"
              />
            </View>

            <Pressable
              onPress={handleCreateSO}
              disabled={submitting || !customerId || cart.length === 0}
              className="bg-primary py-4 rounded-xl items-center mb-6 opacity-100 disabled:opacity-50"
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Create Sales Order</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Detail Modal */}
      <Modal visible={!!activeSO && !showDeliver} animationType="slide" onRequestClose={() => setActiveSO(null)}>
        <SafeAreaProvider>
          <ScrollView className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: topInset }}>
            <View className="px-6 pb-8">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {activeSO?.so_number}
                </Text>
                <Pressable onPress={() => setActiveSO(null)} className="w-11 h-11 items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
                </Pressable>
              </View>

              {activeSO && (
                <>
                  <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
                    <Text className="text-sm font-bold text-text-secondary">{activeSO.customer.name}</Text>
                    {activeSO.customer.phone && (
                      <Text className="text-sm text-text-secondary mt-1">{activeSO.customer.phone}</Text>
                    )}
                    {(() => {
                      const cfg = STATUS_CONFIG[activeSO.status] || STATUS_CONFIG.draft;
                      return (
                        <View style={{ backgroundColor: cfg.bg }} className="px-3 py-1.5 rounded-full self-start mt-2">
                          <Text style={{ color: cfg.color }} className="text-xs font-bold">{cfg.label}</Text>
                        </View>
                      );
                    })()}
                  </View>

                  <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
                    <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark mb-3">Items</Text>
                    {activeSO.items.map((item) => (
                      <View key={item.id} className="flex-row items-center py-2 border-b border-gray-100 dark:border-zinc-800">
                        <View className="flex-1 mr-2">
                          <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">{item.product.name}</Text>
                          <Text className="text-xs text-text-secondary">
                            Qty: {item.quantity} · Delivered: {item.delivered_quantity}
                          </Text>
                        </View>
                        <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">
                          ₹{Number(item.unit_price).toLocaleString("en-IN")}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {activeSO.notes && (
                    <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
                      <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark mb-1">Notes</Text>
                      <Text className="text-sm text-text-secondary">{activeSO.notes}</Text>
                    </View>
                  )}

                  {/* Status Actions */}
                  {(VALID_TRANSITIONS[activeSO.status] || []).length > 0 && (
                    <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
                      <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark mb-3">Actions</Text>
                      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {VALID_TRANSITIONS[activeSO.status].map((nextStatus) => {
                          const cfg = STATUS_CONFIG[nextStatus];
                          return (
                            <Pressable
                              key={nextStatus}
                              onPress={() => {
                                if (nextStatus === "cancelled") {
                                  confirm({
                                    title: "Cancel Order?",
                                    message: `Cancel ${activeSO.so_number}?`,
                                    confirmLabel: "Cancel Order",
                                    destructive: true,
                                  }).then((ok) => {
                                    if (ok) updateStatus(activeSO.id, nextStatus);
                                  });
                                } else {
                                  updateStatus(activeSO.id, nextStatus);
                                }
                              }}
                              style={{ backgroundColor: cfg.bg }}
                              className="px-4 py-3 rounded-xl active:opacity-70"
                            >
                              <Text style={{ color: cfg.color }} className="text-sm font-bold">
                                {nextStatus === "confirmed" ? "Confirm" : nextStatus === "delivered" ? "Mark Delivered" : nextStatus === "partially_delivered" ? "Partial Delivery" : cfg.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                        {(activeSO.status === "confirmed" || activeSO.status === "partially_delivered") && (
                          <Pressable
                            onPress={openDeliver}
                            className="px-4 py-3 rounded-xl bg-primary active:opacity-70"
                          >
                            <Text className="text-sm font-bold text-white">Record Delivery</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </SafeAreaProvider>
      </Modal>

      {/* Deliver Modal */}
      <Modal visible={showDeliver} animationType="slide" onRequestClose={() => setShowDeliver(false)}>
        <SafeAreaProvider>
          <ScrollView className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: topInset }}>
            <View className="px-6 pb-8">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  Record Delivery
                </Text>
                <Pressable onPress={() => setShowDeliver(false)} className="w-11 h-11 items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
                </Pressable>
              </View>

              <Text className="text-sm font-bold text-text-secondary mb-4">
                {activeSO?.so_number} · {activeSO?.customer.name}
              </Text>

              {activeSO?.items.map((item) => (
                <View key={item.id} className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-3">
                  <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">{item.product.name}</Text>
                  <View className="flex-row items-center justify-between mt-2">
                    <Text className="text-xs text-text-secondary">
                      Ordered: {item.quantity} · Delivered: {item.delivered_quantity}
                    </Text>
                    <TextInput
                      value={deliverQtys[item.id] || "0"}
                      onChangeText={(v) => setDeliverQtys((prev) => ({ ...prev, [item.id]: v }))}
                      keyboardType="numeric"
                      className="bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold w-24 text-right"
                    />
                  </View>
                </View>
              ))}

              <Pressable
                onPress={handleDeliver}
                disabled={delivering}
                className="bg-primary py-4 rounded-xl items-center mt-4"
              >
                {delivering ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">Submit Delivery</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}
