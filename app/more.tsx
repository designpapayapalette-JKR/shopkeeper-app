import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/lib/auth-context";
import { api, ApiError, uploadDocument } from "../src/lib/api";
import { useConfirm } from "../src/components/ConfirmDialog";
import { shareLedgerReminder, shareChallan } from "../src/lib/sharer";
import { useTopInset } from "../src/lib/useTopInset";
import { useBottomInset } from "../src/lib/useBottomInset";
import { useTerminology } from "../src/lib/terminology-context";

// Not meant to be memorable — it's shared with the new employee over
// WhatsApp and they're expected to change it after first login.
function randomTempPassword(): string {
  return Math.random().toString(36).slice(-8) + "!1";
}

// The new backend has a fixed set of assignable roles (see
// shopkeeper-api/src/routes/staff.ts) instead of Directus's dynamic
// directus_roles collection — Owner can't be created via this screen.
const STAFF_ROLES = [
  { id: "manager", name: "Manager" },
  { id: "staff", name: "Staff" },
  { id: "field_agent", name: "Field Agent" },
];

// Managers run the shop itself (POS/inventory/ledger) and log into this same
// owner-facing app; staff and field agents only get attendance/tasks/salary,
// which live in the separate Employee App (agent-app) — see the backend's
// attendance.ts/salaries.ts grouping "staff" with "field_agent".
const AGENT_APP_DOWNLOAD_URL =
  "https://github.com/designpapayapalette-JKR/agent-app/releases/download/beta-latest/agent-app-latest.apk";
const APP_DOWNLOAD_URL =
  "https://github.com/designpapayapalette-JKR/shopkeeper-app/releases/download/beta-latest/shopkeeper-app-latest.apk";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity?: string;
  unit?: string;
  pack_unit?: string | null;
  pack_size?: string | null;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

interface StockMovement {
  id: string;
  created_at: string;
  product?: { name: string };
  quantity: string;
  type: string;
  reference: string;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface SalaryRecord {
  id: string;
  date: string;
  amount: string;
  status: string;
  reference: string;
  user?: { first_name: string; last_name: string };
}

interface Invoice {
  id: string;
  invoice_number: string;
  grand_total: string;
}

interface Challan {
  id: string;
  challan_number: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone: string;
  destination: string;
  status: "pending" | "in_transit" | "delivered";
}

interface Party {
  id: string;
  name: string;
  phone: string;
  type: string;
  current_balance: string;
}

export default function MoreScreen() {
  const { user, activeCompany, refreshCompany, setupQuickPin, pinLoginAvailable, logout } = useAuth();
  const { mode, lang, setMode, setLang } = useTerminology();
  const router = useRouter();
  const confirm = useConfirm();
  const confirmDiscard = async () =>
    confirm({
      title: "Discard changes?",
      message: "You have unsaved changes. Are you sure you want to go back?",
      confirmLabel: "Discard",
      destructive: true,
    });
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const params = useLocalSearchParams<{ openPurchase?: string; openReport?: string; openExpense?: string; billPhotoUri?: string; openTransfer?: string; transferPhotoUri?: string }>();
  const [billPhotoUri, setBillPhotoUri] = useState<string | null>(null);
  const [transferPhotoUri, setTransferPhotoUri] = useState<string | null>(null);

  // Record Expense Modal State — shopkeeper-app had no shop-level expense
  // entry at all before (only agent-app's field-expense flow); this is a
  // minimal counterpart so the Scan Hub's "Photograph Expense" option has
  // somewhere real to land.
  const [isExpenseModal, setIsExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<"travel" | "fuel" | "food" | "other">("other");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // Quick PIN Setup State
  const [isPinSetupModal, setIsPinSetupModal] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // Business Profile Modal State
  const [isBusinessProfileModal, setIsBusinessProfileModal] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizGstin, setBizGstin] = useState("");
  const [bizState, setBizState] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizBankName, setBizBankName] = useState("");
  const [bizBankAccountNumber, setBizBankAccountNumber] = useState("");
  const [bizBankIfsc, setBizBankIfsc] = useState("");
  const [bizUpiId, setBizUpiId] = useState("");
  const [bizSubmitting, setBizSubmitting] = useState(false);

  const openBusinessProfileModal = () => {
    setBizName(activeCompany?.name ?? "");
    setBizGstin(activeCompany?.gstin ?? "");
    setBizState(activeCompany?.state ?? "");
    setBizAddress(activeCompany?.address ?? "");
    setBizPhone(activeCompany?.phone ?? "");
    setBizBankName(activeCompany?.bank_name ?? "");
    setBizBankAccountNumber(activeCompany?.bank_account_number ?? "");
    setBizBankIfsc(activeCompany?.bank_ifsc ?? "");
    setBizUpiId(activeCompany?.upi_id ?? "");
    setIsBusinessProfileModal(true);
  };

  const handleSaveBusinessProfile = async () => {
    if (!bizName.trim()) {
      Alert.alert("Required Field", "Business name is required.");
      return;
    }
    setBizSubmitting(true);
    try {
      await api.patch("/companies/me", {
        name: bizName.trim(),
        gstin: bizGstin.trim() || undefined,
        state: bizState.trim() || undefined,
        address: bizAddress.trim() || undefined,
        phone: bizPhone.trim() || undefined,
        bankName: bizBankName.trim() || undefined,
        bankAccountNumber: bizBankAccountNumber.trim() || undefined,
        bankIfsc: bizBankIfsc.trim() || undefined,
        upiId: bizUpiId.trim() || undefined,
      });
      await refreshCompany();
      Alert.alert("Saved", "Business profile updated. This appears on your Tally-style invoices.");
      setIsBusinessProfileModal(false);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save business profile.");
    } finally {
      setBizSubmitting(false);
    }
  };
  
  const resetBusinessProfileForm = () => {
    setBizName("");
    setBizGstin("");
    setBizState("");
    setBizAddress("");
    setBizPhone("");
    setBizBankName("");
    setBizBankAccountNumber("");
    setBizBankIfsc("");
    setBizUpiId("");
  };

  const closeBusinessProfileModal = async () => {
    const hasChanges =
      bizName !== (activeCompany?.name ?? "") ||
      bizGstin !== (activeCompany?.gstin ?? "") ||
      bizState !== (activeCompany?.state ?? "") ||
      bizAddress !== (activeCompany?.address ?? "") ||
      bizPhone !== (activeCompany?.phone ?? "") ||
      bizBankName !== (activeCompany?.bank_name ?? "") ||
      bizBankAccountNumber !== (activeCompany?.bank_account_number ?? "") ||
      bizBankIfsc !== (activeCompany?.bank_ifsc ?? "") ||
      bizUpiId !== (activeCompany?.upi_id ?? "");
    if (hasChanges && !(await confirmDiscard())) return;
    setIsBusinessProfileModal(false);
    resetBusinessProfileForm();
  };

  // Lists
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [salariesList, setSalariesList] = useState<SalaryRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [partiesList, setPartiesList] = useState<Party[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [isPurchaseModal, setIsPurchaseModal] = useState(false);
  const [isMovementsModal, setIsMovementsModal] = useState(false);
  const [isWarehouseModal, setIsWarehouseModal] = useState(false);
  const [isTransferModal, setIsTransferModal] = useState(false);
  const [isAttendanceModal, setIsAttendanceModal] = useState(false);
  const [isSalaryModal, setIsSalaryModal] = useState(false);
  const [isChallanModal, setIsChallanModal] = useState(false);
  const [isCreateChallanModal, setIsCreateChallanModal] = useState(false);

  // Add Staff Modal State
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffFirstName, setNewStaffFirstName] = useState("");
  const [newStaffLastName, setNewStaffLastName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<string>("");
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [addStaffLoading, setAddStaffLoading] = useState(false);

  // Dispatch Task State
  const [isDispatchTaskModal, setIsDispatchTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(false);

  // Reports Modals UI State
  const [isSalesReportModal, setIsSalesReportModal] = useState(false);
  const [isStockReportModal, setIsStockReportModal] = useState(false);
  const [isLedgerReportModal, setIsLedgerReportModal] = useState(false);

  // Deep-link support: dashboard quick actions navigate here with a query
  // param to jump straight into a modal instead of landing on the plain list.
  useEffect(() => {
    if (params.openPurchase === "1") setIsPurchaseModal(true);
    if (params.openReport === "1") setIsSalesReportModal(true);
    if (params.openExpense === "1") setIsExpenseModal(true);
    if (params.billPhotoUri) setBillPhotoUri(decodeURIComponent(params.billPhotoUri));
    if (params.openTransfer === "1") setIsTransferModal(true);
    if (params.transferPhotoUri) setTransferPhotoUri(decodeURIComponent(params.transferPhotoUri));
  }, [params.openPurchase, params.openReport, params.openExpense, params.billPhotoUri, params.openTransfer, params.transferPhotoUri]);

  // Quick Actions on the Dashboard (and the Scan Hub) open these modals by
  // navigating to /more?openXyz=1 — that's a real navigation, not just a
  // modal toggle, so simply closing the modal left the user stranded on the
  // Operations screen underneath instead of back where they tapped from.
  // Popping the stack only when we actually arrived via that deep link
  // keeps the normal "already on Operations, tap Add Expense" flow intact.
  const returnIfDeepLinked = (cameFromDeepLink: boolean) => {
    if (cameFromDeepLink && router.canGoBack()) router.back();
  };

  const handleRecordExpense = async () => {
    if (!expenseAmount) {
      Alert.alert("Required Field", "Amount is required.");
      return;
    }
    setExpenseSubmitting(true);
    try {
      let attachment: string | undefined;
      if (billPhotoUri) {
        try {
          attachment = await uploadDocument(billPhotoUri, "expense");
        } catch (e) {
          Alert.alert("Receipt Upload Failed", "The expense will be saved without the receipt photo.");
        }
      }
      await api.post("/expenses", {
        amount: parseFloat(expenseAmount),
        category: expenseCategory,
        date: new Date().toISOString(),
        notes: expenseNotes || undefined,
        attachment,
      });
      Alert.alert("Success", "Expense recorded successfully.");
      setIsExpenseModal(false);
      const cameFromDeepLink = params.openExpense === "1";
      resetExpenseForm();
      setBillPhotoUri(null);
      returnIfDeepLinked(cameFromDeepLink);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to record expense.");
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const resetExpenseForm = () => {
    setExpenseAmount("");
    setExpenseNotes("");
    setExpenseCategory("other");
  };

  const closeExpenseModal = async () => {
    const hasChanges = expenseAmount.trim() !== "" || expenseNotes.trim() !== "" || expenseCategory !== "other";
    if (hasChanges && !(await confirmDiscard())) return;
    setIsExpenseModal(false);
    resetExpenseForm();
    setBillPhotoUri(null);
    returnIfDeepLinked(params.openExpense === "1");
  };

  // Purchase Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [purchaseQtyMode, setPurchaseQtyMode] = useState<"unit" | "pack">("unit");
  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseRef, setPurchaseRef] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [productPickerSearch, setProductPickerSearch] = useState("");
  const [isQuickAddSupplier, setIsQuickAddSupplier] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState("");
  const [quickSupplierPhone, setQuickSupplierPhone] = useState("");
  const [quickAddSupplierLoading, setQuickAddSupplierLoading] = useState(false);
  const [isQuickAddProduct, setIsQuickAddProduct] = useState(false);
  const [quickProductName, setQuickProductName] = useState("");
  const [quickProductPrice, setQuickProductPrice] = useState("");
  const [quickAddProductLoading, setQuickAddProductLoading] = useState(false);

  const filteredSuppliers = suppliers.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));
  const filteredProductsForPurchase = products.filter((p) => p.name.toLowerCase().includes(productPickerSearch.toLowerCase()));
  const [transferProductSearch, setTransferProductSearch] = useState("");
  const filteredProductsForTransfer = products.filter((p) => p.name.toLowerCase().includes(transferProductSearch.toLowerCase()));

  const handleQuickAddSupplier = async () => {
    if (!quickSupplierName.trim()) {
      Alert.alert("Required Field", "Supplier name is required.");
      return;
    }
    setQuickAddSupplierLoading(true);
    try {
      const created = await api.post<{ data: Supplier }>("/parties", {
        name: quickSupplierName.trim(),
        phone: quickSupplierPhone.trim() || undefined,
        type: "supplier",
        current_balance: 0,
        opening_balance: 0,
      });
      setSuppliers((prev) => [created.data, ...prev]);
      setSelectedSupplierId(created.data.id);
      setIsQuickAddSupplier(false);
      // Reset the search box to the new supplier's actual name — otherwise a
      // stale search term (e.g. if the user edited the name in the quick-add
      // form) filters the newly created supplier out of the chip list, and
      // its selection appears to have silently vanished.
      setSupplierSearch(created.data.name);
      resetQuickSupplierForm();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to add supplier.");
    } finally {
      setQuickAddSupplierLoading(false);
    }
  };

  const resetQuickSupplierForm = () => {
    setQuickSupplierName("");
    setQuickSupplierPhone("");
  };

  const handleQuickAddProduct = async () => {
    if (!quickProductName.trim() || !quickProductPrice) {
      Alert.alert("Required Fields", "Product name and price are required.");
      return;
    }
    setQuickAddProductLoading(true);
    try {
      const created = await api.post<{ data: Product }>("/products", {
        name: quickProductName.trim(),
        price: parseFloat(quickProductPrice),
        status: "active",
      });
      setProducts((prev) => [created.data, ...prev]);
      setSelectedProductId(created.data.id);
      setIsQuickAddProduct(false);
      // Same reasoning as handleQuickAddSupplier above — keep the search box
      // in sync with the newly created product so its chip stays visible.
      setProductPickerSearch(created.data.name);
      resetQuickProductForm();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to add product.");
    } finally {
      setQuickAddProductLoading(false);
    }
  };

  const resetQuickProductForm = () => {
    setQuickProductName("");
    setQuickProductPrice("");
  };

  // Warehouse Form State
  const [newWhName, setNewWhName] = useState("");
  const [newWhLoc, setNewWhLoc] = useState("");
  const [whLoading, setWhLoading] = useState(false);

  // Transfer Form State
  const [transferProductId, setTransferProductId] = useState("");
  const [transferSourceWhId, setTransferSourceWhId] = useState("");
  const [transferDestWhId, setTransferDestWhId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  // Attendance State
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceMap, setAttendanceMap] = useState<{ [userId: string]: "present" | "absent" }>({});
  const [attLoading, setAttLoading] = useState(false);

  // Salary Form State
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryRef, setSalaryRef] = useState("");
  const [salaryStatus, setSalaryStatus] = useState<"paid" | "pending">("paid");
  const [salarySubmitting, setSalarySubmitting] = useState(false);

  // Challan Form State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [destination, setDestination] = useState("");
  const [challanSubmitting, setChallanSubmitting] = useState(false);

  const fetchSetupData = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const supRes = await api.get<{ data: Supplier[] }>("/parties", { params: { type: "supplier" } });
      setSuppliers(supRes.data ?? []);

      const prodRes = await api.get<{ data: Product[] }>("/products");
      setProducts(prodRes.data ?? []);

      const whRes = await api.get<{ data: Warehouse[] }>("/warehouses");
      const whList = whRes.data ?? [];
      setWarehouses(whList);
      if (whList.length > 0) {
        setSelectedWarehouseId(whList[0].id);
        setTransferSourceWhId(whList[0].id);
        if (whList.length > 1) {
          setTransferDestWhId(whList[1].id);
        }
      }

      // /staff is owner/manager-only — a staff-role account gets a 403 here.
      // That's expected and shouldn't take down the rest of this screen's
      // data (invoices/parties below), which every role needs for the
      // Sales/Receivables/Payables reports.
      try {
        const staffRes = await api.get<{ data: StaffMember[] }>("/staff");
        const staffList = staffRes.data ?? [];
        setStaff(staffList);

        const initialMap: any = {};
        staffList.forEach((s) => {
          initialMap[s.id] = "present";
        });
        setAttendanceMap(initialMap);

        setRoles(STAFF_ROLES);
        if (!newStaffRole) setNewStaffRole(STAFF_ROLES[0].id);
      } catch (e) {
        console.error("Failed to load staff (expected for non-manager roles):", e);
      }

      const invRes = await api.get<{ data: Invoice[] }>("/invoices");
      setInvoices(invRes.data ?? []);

      const partiesRes = await api.get<{ data: Party[] }>("/parties");
      setPartiesList(partiesRes.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: StockMovement[] }>("/stock-movements");
      setMovements(res.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalariesHistory = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: SalaryRecord[] }>("/salaries");
      setSalariesList(res.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchChallansList = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: Challan[] }>("/challans");
      setChallans(res.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSetupData();
  }, [user]);

  const handleRecordPurchase = async () => {
    if (!selectedSupplierId || !selectedProductId || !selectedWarehouseId || !purchaseQuantity || !purchasePrice) {
      Alert.alert("Required Fields", "All fields with * are required.");
      return;
    }
    if (!user?.company_id) return;

    setSubmitLoading(true);
    try {
      const enteredQty = parseFloat(purchaseQuantity);
      const enteredPrice = parseFloat(purchasePrice);
      const selectedProduct = products.find((p) => p.id === selectedProductId);
      const packSize = selectedProduct?.pack_size ? parseFloat(selectedProduct.pack_size) : null;

      // Stock is always stored in base units, so a "by pack" entry (e.g. "2
      // boxes" at a per-box cost) gets converted here — the base-unit cost
      // per piece, times the total pieces — before it ever reaches the
      // atomic stock-increment logic server-side, which has no concept of
      // packs and shouldn't need one.
      const usingPack = purchaseQtyMode === "pack" && packSize;
      const qtyNum = usingPack ? enteredQty * packSize! : enteredQty;
      const priceNum = usingPack ? enteredPrice / packSize! : enteredPrice;

      // Purchase + items + stock increment + supplier ledger entry now
      // happen atomically server-side — see shopkeeper-api/src/routes/purchases.ts.
      await api.post("/purchases", {
        supplier_id: selectedSupplierId,
        warehouse_id: selectedWarehouseId,
        items: [{ product_id: selectedProductId, quantity: qtyNum, cost: priceNum }],
      });

      Alert.alert("Success", "Purchase recorded successfully.");
      setIsPurchaseModal(false);
      const cameFromDeepLink = params.openPurchase === "1";
      resetPurchaseForm();
      setBillPhotoUri(null);
      fetchSetupData();
      returnIfDeepLinked(cameFromDeepLink);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to record purchase bill.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetPurchaseForm = () => {
    setPurchaseQuantity("");
    setPurchasePrice("");
    setPurchaseRef("");
    setSelectedProductId("");
    setSelectedSupplierId("");
    setPurchaseQtyMode("unit");
  };

  const closePurchaseModal = async () => {
    const hasChanges =
      selectedSupplierId !== "" ||
      selectedProductId !== "" ||
      purchaseQuantity.trim() !== "" ||
      purchasePrice.trim() !== "" ||
      purchaseRef.trim() !== "";
    if (hasChanges && !(await confirmDiscard())) return;
    setIsPurchaseModal(false);
    resetPurchaseForm();
    setBillPhotoUri(null);
    returnIfDeepLinked(params.openPurchase === "1");
  };

  const handleCreateWarehouse = async () => {
    if (!newWhName) {
      Alert.alert("Required Fields", "Warehouse Name is required.");
      return;
    }
    if (!user?.company_id) return;

    setWhLoading(true);
    try {
      await api.post("/warehouses", { name: newWhName, location: newWhLoc || undefined });
      Alert.alert("Success", "Warehouse created successfully.");
      resetWarehouseModalForm();
      setIsWarehouseModal(false);
      fetchSetupData();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create warehouse.");
    } finally {
      setWhLoading(false);
    }
  };

  const resetWarehouseModalForm = () => {
    setNewWhName("");
    setNewWhLoc("");
  };

  const closeWarehouseModal = async () => {
    const hasChanges = newWhName.trim() !== "" || newWhLoc.trim() !== "";
    if (hasChanges && !(await confirmDiscard())) return;
    setIsWarehouseModal(false);
    resetWarehouseModalForm();
  };

  const resetTransferForm = () => {
    setTransferProductId("");
    setTransferQuantity("");
    setTransferRef("");
  };

  const closeTransferModal = async () => {
    const hasChanges =
      transferProductId !== "" || transferQuantity.trim() !== "" || transferRef.trim() !== "";
    if (hasChanges && !(await confirmDiscard())) return;
    setIsTransferModal(false);
    resetTransferForm();
    setTransferPhotoUri(null);
    returnIfDeepLinked(params.openTransfer === "1");
  };

  const handleStockTransfer = async () => {
    if (!transferProductId || !transferSourceWhId || !transferDestWhId || !transferQuantity) {
      Alert.alert("Required Fields", "All fields with * are required.");
      return;
    }
    if (transferSourceWhId === transferDestWhId) {
      Alert.alert("Invalid Route", "Source and destination warehouses cannot be the same.");
      return;
    }

    setTransferLoading(true);
    try {
      const qty = parseFloat(transferQuantity);

      await api.post("/warehouses/transfer", {
        product_id: transferProductId,
        from_warehouse_id: transferSourceWhId,
        to_warehouse_id: transferDestWhId,
        quantity: qty,
        note: transferRef.trim() || undefined,
      });

      Alert.alert("Success", "Stock transferred successfully.");
      setIsTransferModal(false);
      const cameFromDeepLink = params.openTransfer === "1";
      resetTransferForm();
      setTransferPhotoUri(null);
      fetchSetupData();
      returnIfDeepLinked(cameFromDeepLink);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to transfer stock.");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!user?.company_id) return;
    setAttLoading(true);
    try {
      await api.post("/attendance/bulk", {
        date: new Date(attendanceDate).toISOString(),
        records: Object.keys(attendanceMap).map((staffId) => ({
          user_id: staffId,
          status: attendanceMap[staffId],
          notes: "Recorded via Admin Panel",
        })),
      });
      Alert.alert("Success", "Attendance saved successfully.");
      setIsAttendanceModal(false);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to save attendance.");
    } finally {
      setAttLoading(false);
    }
  };

  const resetAttendanceForm = () => {
    setAttendanceMap((prev) => {
      const reset: { [userId: string]: "present" | "absent" } = {};
      Object.keys(prev).forEach((staffId) => {
        reset[staffId] = "present";
      });
      return reset;
    });
  };

  const closeAttendanceModal = async () => {
    const hasChanges = Object.values(attendanceMap).some((status) => status === "absent");
    if (hasChanges && !(await confirmDiscard())) return;
    setIsAttendanceModal(false);
    resetAttendanceForm();
  };

  const resetSalaryForm = () => {
    setSalaryAmount("");
    setSalaryRef("");
    setSelectedStaffId("");
  };

  const closeSalaryModal = async () => {
    const hasChanges = selectedStaffId !== "" || salaryAmount.trim() !== "" || salaryRef.trim() !== "";
    if (hasChanges && !(await confirmDiscard())) return;
    setIsSalaryModal(false);
    resetSalaryForm();
  };

  const handleRecordSalary = async () => {
    if (!selectedStaffId || !salaryAmount) {
      Alert.alert("Required Fields", "Employee selection and Amount are required.");
      return;
    }
    if (!user?.company_id) return;

    setSalarySubmitting(true);
    try {
      await api.post("/salaries", {
        user_id: selectedStaffId,
        date: new Date().toISOString(),
        amount: parseFloat(salaryAmount),
        status: salaryStatus,
        reference: salaryRef || "Salary Settlement",
      });
      Alert.alert("Success", "Salary slip created successfully.");
      resetSalaryForm();
      setIsSalaryModal(false);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to submit salary details.");
    } finally {
      setSalarySubmitting(false);
    }
  };

  const resetChallanForm = () => {
    setVehicleNumber("");
    setDriverName("");
    setDriverPhone("");
    setDestination("");
    setSelectedInvoiceId("");
  };

  const closeCreateChallanModal = async () => {
    const hasChanges =
      selectedInvoiceId !== "" ||
      vehicleNumber.trim() !== "" ||
      driverName.trim() !== "" ||
      driverPhone.trim() !== "" ||
      destination.trim() !== "";
    if (hasChanges && !(await confirmDiscard())) return;
    setIsCreateChallanModal(false);
    resetChallanForm();
  };

  const handleCreateChallan = async () => {
    if (!vehicleNumber || !driverName || !driverPhone || !destination) {
      Alert.alert("Required Fields", "All fields with * are required.");
      return;
    }
    if (!user?.company_id) return;

    setChallanSubmitting(true);
    try {
      // Challan number generation + item-copying from the linked invoice now
      // happen atomically server-side — see shopkeeper-api/src/routes/challans.ts.
      const res = await api.post<{ data: Challan }>("/challans", {
        vehicle_number: vehicleNumber,
        driver_name: driverName,
        driver_phone: driverPhone,
        destination: destination,
        invoice_id: selectedInvoiceId || undefined,
      });

      Alert.alert("Success", `Challan ${res.data.challan_number} generated successfully.`);
      setIsCreateChallanModal(false);
      resetChallanForm();
      fetchChallansList();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create challan.");
    } finally {
      setChallanSubmitting(false);
    }
  };

  const handleToggleChallanStatus = async (challan: Challan) => {
    let nextStatus: "pending" | "in_transit" | "delivered" = "pending";
    if (challan.status === "pending") nextStatus = "in_transit";
    else if (challan.status === "in_transit") nextStatus = "delivered";
    else nextStatus = "pending";

    try {
      await api.patch(`/challans/${challan.id}/status`, { status: nextStatus });
      Alert.alert("Status Updated", `Challan status set to ${nextStatus.replace("_", " ")}.`);
      fetchChallansList();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to update challan status.");
    }
  };

  const updateAttendanceStatus = (staffId: string, status: "present" | "absent") => {
    setAttendanceMap((prev) => ({ ...prev, [staffId]: status }));
  };

  const resetAddStaffForm = () => {
    setNewStaffFirstName("");
    setNewStaffLastName("");
    setNewStaffEmail("");
    setNewStaffPhone("");
    setNewStaffPassword("");
    setNewStaffRole(STAFF_ROLES[0].id);
  };

  const closeAddStaffModal = async () => {
    const hasChanges =
      newStaffFirstName.trim() !== "" ||
      newStaffLastName.trim() !== "" ||
      newStaffEmail.trim() !== "" ||
      newStaffPassword.trim() !== "";
    if (hasChanges && !(await confirmDiscard())) return;
    setIsAddingStaff(false);
    resetAddStaffForm();
  };

  const handleAddStaff = async () => {
    if (!newStaffFirstName || !newStaffEmail || !newStaffPassword || !newStaffRole) {
      Alert.alert("Required Fields", "First Name, Email, Password, and Role are required.");
      return;
    }
    if (!user?.company_id) return;

    setAddStaffLoading(true);
    try {
      await api.post("/staff", {
        first_name: newStaffFirstName,
        last_name: newStaffLastName || undefined,
        email: newStaffEmail,
        phone: newStaffPhone.trim() || undefined,
        password: newStaffPassword,
        role: newStaffRole,
      });
      setIsAddingStaff(false);
      const createdPhone = newStaffPhone.trim();
      const createdName = newStaffFirstName;
      const createdEmail = newStaffEmail;
      const createdPassword = newStaffPassword;
      const createdRole = newStaffRole;
      resetAddStaffForm();
      fetchSetupData();

      // Employees can only ever be created this way — there's no
      // self-service signup for staff/field agents — so getting the login
      // to them (WhatsApp, if a phone number was given) is the natural next
      // step right after creation, not a separate screen to hunt for later.
      if (createdPhone) {
        const ok = await confirm({
          title: "Employee Created",
          message: `Send ${createdName}'s login (email + password) to them over WhatsApp now?`,
          confirmLabel: "Send via WhatsApp",
        });
        if (ok) {
          const isFieldRole = createdRole === "staff" || createdRole === "field_agent";
          const appName = isFieldRole ? "Employee App" : "Shopkeeper App";
          const downloadUrl = isFieldRole ? AGENT_APP_DOWNLOAD_URL : APP_DOWNLOAD_URL;
          const message = `Hi ${createdName}! You've been added to ${activeCompany?.name ?? "our team"} on the ${appName}.\n\n1. Download the app: ${downloadUrl}\n2. Log in with:\nEmail: ${createdEmail}\nPassword: ${createdPassword}\n\nPlease change your password after logging in.`;
          const url = `whatsapp://send?text=${encodeURIComponent(message)}&phone=+91${createdPhone.replace(/\D/g, "")}`;
          const supported = await Linking.canOpenURL(url);
          if (supported) await Linking.openURL(url);
          else Alert.alert("WhatsApp Not Installed", "Could not open WhatsApp on this device.");
        }
      } else {
        Alert.alert("Success", "Employee created successfully. They can now log in.");
      }
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to create staff member. Make sure the email is unique.");
    } finally {
      setAddStaffLoading(false);
    }
  };

  const resetDispatchTaskForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskAssignedTo("");
  };

  const closeDispatchTaskModal = async () => {
    const hasChanges = taskTitle.trim() !== "" || taskDescription.trim() !== "" || taskAssignedTo !== "";
    if (hasChanges && !(await confirmDiscard())) return;
    setIsDispatchTaskModal(false);
    resetDispatchTaskForm();
  };

  const handleDispatchTask = async () => {
    if (!taskTitle || !taskAssignedTo) {
      Alert.alert("Required Fields", "Task Title and Assignee are required.");
      return;
    }
    if (!user?.company_id) return;

    setDispatchLoading(true);
    try {
      await api.post("/agent-tasks", {
        agent_id: taskAssignedTo,
        title: taskTitle,
        description: taskDescription || undefined,
      });
      Alert.alert("Success", "Task dispatched to the agent successfully.");
      setIsDispatchTaskModal(false);
      resetDispatchTaskForm();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Failed to dispatch task.");
    } finally {
      setDispatchLoading(false);
    }
  };

  // Aggregated Reporting Helpers
  const totalSalesReport = invoices.reduce((acc, curr) => acc + parseFloat(curr.grand_total || "0"), 0);
  const averageSalesInvoice = invoices.length > 0 ? totalSalesReport / invoices.length : 0;
  
  const totalReceivables = partiesList
    .filter((p) => p.type === "customer")
    .reduce((acc, curr) => acc + parseFloat(curr.current_balance || "0"), 0);

  const totalPayables = partiesList
    .filter((p) => p.type === "supplier")
    .reduce((acc, curr) => acc + parseFloat(curr.current_balance || "0"), 0);

  const closePinSetupModal = async () => {
    const hasChanges = newPin.trim() !== "" || confirmPin.trim() !== "";
    if (hasChanges && !(await confirmDiscard())) return;
    setIsPinSetupModal(false);
    setNewPin("");
    setConfirmPin("");
  };

  const handleSetupPin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      Alert.alert("Invalid PIN", "PIN must be exactly 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert("PIN Mismatch", "The two PINs you entered don't match.");
      return;
    }
    setPinSubmitting(true);
    try {
      await setupQuickPin(newPin);
      Alert.alert("PIN Set", "Your Quick PIN is ready. You can now use it on the login screen instead of your email and password.");
      setIsPinSetupModal(false);
      setNewPin("");
      setConfirmPin("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to set up PIN.");
    } finally {
      setPinSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
      {/* Title */}
      <View className="mb-8">
        <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
          Operations
        </Text>
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark font-medium mt-0.5">
          Day-to-day workflows and merchant configuration
        </Text>
      </View>

      {/* ══════════════════════ OPERATIONS ══════════════════════
          Day-to-day workflows a shopkeeper reaches for often: history,
          staff, reports, inventory movement. */}
      <Text className="text-sm font-black text-primary dark:text-primary-dark uppercase tracking-widest mb-3">
        Operations
      </Text>

      {/* Data & Activity */}
      <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
        <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Data & Activity
        </Text>
        <Pressable
          onPress={() => router.push("/bank-accounts" as any)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Bank Accounts
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Track which account payments in/out are credited or debited from.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={() => router.push("/scanned-documents" as any)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Scanned Documents
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Every purchase bill, product, or expense receipt photographed via Scan & Record.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={() => router.push("/invoice-history" as any)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Invoice History
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Reprint, reshare, or return items on any past invoice.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={() => router.push("/purchase-history" as any)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Purchase History
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              View past purchase bills or return items to a supplier.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={() => router.push("/expenses" as any)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Expenses
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Day/week/month/year totals and every recorded claim with its receipt.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={() => router.push("/gst-reports?tab=daybook" as any)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Day Book
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Every sale, purchase, and payment for a single day, at a glance.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={() => router.push("/activity-log" as any)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Activity Log
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              See who created, edited, or deleted records and when.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={() => router.push("/recycle-bin" as any)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Recycle Bin
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Restore products, parties, or invoices that were deleted by mistake.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>
      </View>

      {/* Staff & Employees */}
      <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
        <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Staff & Employees
        </Text>
        <Pressable
          onPress={() => {
            fetchSetupData();
            setIsAddingStaff(true);
          }}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Add New Employee
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Create a login for a Field Agent or Manager in your company.
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <MaterialCommunityIcons name="plus" size={16} color="#0F7A5F" />
            <Text className="text-primary font-bold text-base">Add</Text>
          </View>
        </Pressable>
        
        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={() => {
            fetchSetupData();
            setIsDispatchTaskModal(true);
          }}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Dispatch Agent Task
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Assign a new task or delivery to a field agent.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>
      </View>

      {/* Business Reports & Analytics */}
      <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
        <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Business Reports & Analytics
        </Text>

        <Pressable
          onPress={() => {
            fetchSetupData();
            setIsSalesReportModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl mb-4 flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Sales Performance Report
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Total revenues, invoice volume counts, and bill averages.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <Pressable
          onPress={() => {
            fetchSetupData();
            setIsStockReportModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl mb-4 flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Inventory Stock Levels
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              List of products with live aggregated quantity tracking.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <Pressable
          onPress={() => {
            fetchSetupData();
            setIsLedgerReportModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Ledger Outstanding Summary
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Payables vs receivables outstanding aggregates.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-4" />

        <Pressable
          onPress={() => router.push("/gst-reports" as any)}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              GST & Compliance Reports
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              HSN summary, GSTR-ready sales/purchase registers, and day book — export as CSV.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>
      </View>

      {/* Inventory & Logistics Operations */}
      <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
        <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Inventory & Logistics
        </Text>

        <Pressable
          onPress={() => {
            fetchSetupData();
            setIsPurchaseModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl mb-4 flex-row justify-between items-center active:bg-gray-50 dark:active:bg-zinc-800"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Record Purchase Bill
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Add product stock intake and credit supplier balance.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <Pressable
          onPress={() => {
            fetchSetupData();
            setIsTransferModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl mb-4 flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Stock Transfer
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Move inventory stock between company warehouses.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <Pressable
          onPress={() => {
            fetchSetupData();
            fetchChallansList();
            setIsChallanModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl mb-4 flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Logistics & Delivery Challans
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Generate challans and track dispatch transit delivery runs.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <Pressable
          onPress={() => {
            fetchSetupData();
            setIsWarehouseModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl mb-4 flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Warehouse Management
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Review and register storage warehouses.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <Pressable
          onPress={() => {
            fetchMovements();
            setIsMovementsModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Stock Movements Log
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Chronological listing of stock additions and subtractions.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>
      </View>

      {/* Staff Operations */}
      <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
        <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Staff Management
        </Text>

        <Pressable
          onPress={() => {
            fetchSetupData();
            setIsAttendanceModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl mb-4 flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Staff Attendance Checklist
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Log daily staff attendance status (Present/Absent/Late).
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <Pressable
          onPress={() => {
            fetchSetupData();
            fetchSalariesHistory();
            setIsSalaryModal(true);
          }}
          className="border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl flex-row justify-between items-center active:bg-gray-50"
        >
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Employee Salaries
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Record salary payouts and verify payment slip history.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>
      </View>

      {/* ══════════════════════ SETTINGS ══════════════════════
          Configuration you set up once and rarely touch again. */}
      <Text className="text-sm font-black text-primary dark:text-primary-dark uppercase tracking-widest mb-3 mt-2">
        Settings
      </Text>

      {/* Terminology Settings */}
      <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
        <Text className="text-base font-bold text-text-primary dark:text-text-primary-dark mb-4">
          App Language & Terminology
        </Text>
        <View className="mb-2">
          <Text className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
            Terminology Mode
          </Text>
          <View className="flex-row bg-gray-50 p-1 rounded-xl" style={{ gap: 4 }}>
            <Pressable
              onPress={() => setMode("modern")}
              className={`flex-1 py-2.5 rounded-lg items-center ${mode === "modern" ? "bg-white shadow-sm" : ""}`}
            >
              <Text className="text-xs font-bold text-text-primary">Modern</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("traditional")}
              className={`flex-1 py-2.5 rounded-lg items-center ${mode === "traditional" ? "bg-primary shadow-sm" : ""}`}
            >
              <Text className={`text-xs font-bold ${mode === "traditional" ? "text-white" : "text-text-primary"}`}>Traditional</Text>
            </Pressable>
          </View>
        </View>

        {mode === "traditional" && (
          <View className="mt-2 pt-4 border-t border-gray-100">
            <Text className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
              Language (Traditional)
            </Text>
            <View className="flex-row bg-gray-50 p-1 rounded-xl" style={{ gap: 4 }}>
              <Pressable
                onPress={() => setLang("en")}
                className={`flex-1 py-2.5 rounded-lg items-center ${lang === "en" ? "bg-white shadow-sm" : ""}`}
              >
                <Text className="text-xs font-bold text-text-primary">English</Text>
              </Pressable>
              <Pressable
                onPress={() => setLang("hi")}
                className={`flex-1 py-2.5 rounded-lg items-center ${lang === "hi" ? "bg-primary shadow-sm" : ""}`}
              >
                <Text className={`text-xs font-bold ${lang === "hi" ? "text-white" : "text-text-primary"}`}>Hindi (हिंदी)</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Business Profile */}
      <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
        <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Business Profile
        </Text>
        <Pressable
          onPress={openBusinessProfileModal}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Edit Business Details
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              GSTIN, address, phone, and bank details shown on your Tally-style GST invoices.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={() => router.push("/printer-settings" as any)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              Printer Settings
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Pair a thermal receipt printer over Bluetooth, USB, or Wi-Fi.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#0F7A5F" />
        </Pressable>
      </View>

      {/* Security */}
      <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-10">
        <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Security
        </Text>
        <Pressable
          onPress={() => setIsPinSetupModal(true)}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
              {pinLoginAvailable ? "Change Quick PIN" : "Set Up Quick PIN"}
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              A 4-digit PIN to unlock the app quickly instead of typing your email and password every time.
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Text className="text-primary font-bold text-base">
              {pinLoginAvailable ? "Change" : "Set Up"}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#0F7A5F" />
          </View>
        </Pressable>

        <View className="h-[1px] bg-gray-100 dark:bg-zinc-800 my-2" />

        <Pressable
          onPress={async () => {
            const ok = await confirm({
              title: "Sign out?",
              message: "You'll need your email and password (or Quick PIN) to sign back in.",
              confirmLabel: "Sign Out",
              destructive: true,
            });
            if (ok) logout();
          }}
          className="flex-row justify-between items-center py-3"
        >
          <View className="flex-1 mr-2">
            <Text className="text-lg font-bold text-error">
              Sign Out
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Sign out of this device.
            </Text>
          </View>
          <MaterialCommunityIcons name="logout" size={20} color="#D64545" />
        </Pressable>
      </View>

      {/* Record Purchase Modal */}
      <Modal visible={isPurchaseModal} animationType="slide" onRequestClose={closePurchaseModal}>
        {loading ? (
          <View className="flex-1 justify-center items-center bg-background dark:bg-background-dark">
            <ActivityIndicator size="large" color="#0F7A5F" />
          </View>
        ) : (
          <ScrollView className="flex-1 bg-background dark:bg-background-dark px-6 pb-10" style={{ paddingTop: topInset }}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Record Purchase Bill
              </Text>
              <Pressable
                onPress={closePurchaseModal}
                className="w-11 h-11 items-center justify-center"
              >
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            {billPhotoUri && (
              <View className="mb-6">
                <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  Photographed Bill (for reference while entering items)
                </Text>
                <Image
                  source={{ uri: billPhotoUri }}
                  style={{ width: "100%", height: 200, borderRadius: 16 }}
                  resizeMode="contain"
                />
              </View>
            )}

            <View className="space-y-4">
              <View>
                <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  Select Supplier *
                </Text>
                <View className="bg-surface dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-2 py-1">
                  <TextInput
                    placeholder="Search suppliers by name..."
                    placeholderTextColor="#A0A0A0"
                    value={supplierSearch}
                    onChangeText={setSupplierSearch}
                    className="text-sm font-medium px-2 py-3 text-text-primary"
                  />
                  <ScrollView horizontal className="flex-row px-2 pb-2">
                    {filteredSuppliers.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => setSelectedSupplierId(s.id)}
                        className={`mr-2 px-4 py-3 rounded-lg border ${
                          selectedSupplierId === s.id
                            ? "bg-primary border-primary dark:bg-primary-dark"
                            : "bg-background border-gray-200 dark:border-zinc-800"
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            selectedSupplierId === s.id ? "text-white" : "text-text-secondary"
                          }`}
                        >
                          {s.name}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => {
                        setQuickSupplierName(supplierSearch);
                        setIsQuickAddSupplier(true);
                      }}
                      className="mr-2 px-4 py-3 rounded-lg border border-dashed border-primary"
                    >
                      <Text className="text-sm font-bold text-primary">+ New Supplier</Text>
                    </Pressable>
                  </ScrollView>
                </View>
                {isQuickAddSupplier && (
                  <View className="mt-2 p-3 bg-surface dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl">
                    <TextInput
                      placeholder="Supplier name"
                      placeholderTextColor="#A0A0A0"
                      value={quickSupplierName}
                      onChangeText={setQuickSupplierName}
                      className="text-sm font-medium px-2 py-3 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-lg mb-2"
                    />
                    <TextInput
                      placeholder="Phone (optional)"
                      placeholderTextColor="#A0A0A0"
                      value={quickSupplierPhone}
                      onChangeText={setQuickSupplierPhone}
                      keyboardType="phone-pad"
                      className="text-sm font-medium px-2 py-3 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-lg mb-2"
                    />
                    <View className="flex-row" style={{ gap: 8 }}>
                      <Pressable onPress={() => { setIsQuickAddSupplier(false); resetQuickSupplierForm(); }} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 items-center">
                        <Text className="text-sm font-bold text-text-secondary">Cancel</Text>
                      </Pressable>
                      <Pressable onPress={handleQuickAddSupplier} disabled={quickAddSupplierLoading} className="flex-1 py-2.5 rounded-lg bg-primary items-center">
                        {quickAddSupplierLoading ? <ActivityIndicator color="white" size="small" /> : <Text className="text-sm font-bold text-white">Save</Text>}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

              <View className="mt-4">
                <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  Select Product *
                </Text>
                <View className="bg-surface dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-2 py-1">
                  <TextInput
                    placeholder="Search products by name..."
                    placeholderTextColor="#A0A0A0"
                    value={productPickerSearch}
                    onChangeText={setProductPickerSearch}
                    className="text-sm font-medium px-2 py-3 text-text-primary"
                  />
                  <ScrollView horizontal className="flex-row px-2 pb-2">
                    {filteredProductsForPurchase.map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => setSelectedProductId(p.id)}
                        className={`mr-2 px-4 py-3 rounded-lg border ${
                          selectedProductId === p.id
                            ? "bg-primary border-primary dark:bg-primary-dark"
                            : "bg-background border-gray-200 dark:border-zinc-800"
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            selectedProductId === p.id ? "text-white" : "text-text-secondary"
                          }`}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => {
                        setQuickProductName(productPickerSearch);
                        setIsQuickAddProduct(true);
                      }}
                      className="mr-2 px-4 py-3 rounded-lg border border-dashed border-primary"
                    >
                      <Text className="text-sm font-bold text-primary">+ New Product</Text>
                    </Pressable>
                  </ScrollView>
                </View>
                {isQuickAddProduct && (
                  <View className="mt-2 p-3 bg-surface dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl">
                    <TextInput
                      placeholder="Product name"
                      placeholderTextColor="#A0A0A0"
                      value={quickProductName}
                      onChangeText={setQuickProductName}
                      className="text-sm font-medium px-2 py-3 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-lg mb-2"
                    />
                    <TextInput
                      placeholder="Selling price"
                      placeholderTextColor="#A0A0A0"
                      value={quickProductPrice}
                      onChangeText={setQuickProductPrice}
                      keyboardType="numeric"
                      className="text-sm font-medium px-2 py-3 text-text-primary border border-gray-200 dark:border-zinc-800 rounded-lg mb-2"
                    />
                    <View className="flex-row" style={{ gap: 8 }}>
                      <Pressable onPress={() => { setIsQuickAddProduct(false); resetQuickProductForm(); }} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 items-center">
                        <Text className="text-sm font-bold text-text-secondary">Cancel</Text>
                      </Pressable>
                      <Pressable onPress={handleQuickAddProduct} disabled={quickAddProductLoading} className="flex-1 py-2.5 rounded-lg bg-primary items-center">
                        {quickAddProductLoading ? <ActivityIndicator color="white" size="small" /> : <Text className="text-sm font-bold text-white">Save</Text>}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

              {warehouses.length > 0 && (
                <View className="mt-4">
                  <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                    Intake Warehouse
                  </Text>
                  <ScrollView horizontal className="flex-row">
                    {warehouses.map((w) => (
                      <Pressable
                        key={w.id}
                        onPress={() => setSelectedWarehouseId(w.id)}
                        className={`mr-2 px-4 py-2.5 rounded-xl border ${
                          selectedWarehouseId === w.id
                            ? "bg-primary border-primary dark:bg-primary-dark"
                            : "bg-surface border-gray-200 dark:border-zinc-800"
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${
                            selectedWarehouseId === w.id ? "text-white" : "text-text-primary dark:text-text-primary-dark"
                          }`}
                        >
                          {w.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View className="mt-4">
                <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  Quantity *
                </Text>
                {(() => {
                  const selectedProduct = products.find((p) => p.id === selectedProductId);
                  const packUnit = selectedProduct?.pack_unit;
                  const packSize = selectedProduct?.pack_size ? parseFloat(selectedProduct.pack_size) : null;
                  const baseUnit = selectedProduct?.unit || "pcs";
                  return (
                    <>
                      {packUnit && packSize && (
                        <View className="flex-row mb-2" style={{ gap: 8 }}>
                          <Pressable
                            onPress={() => setPurchaseQtyMode("unit")}
                            className={`flex-1 py-2 rounded-lg items-center border ${
                              purchaseQtyMode === "unit" ? "bg-primary border-primary dark:bg-primary-dark" : "border-gray-200 dark:border-zinc-800"
                            }`}
                          >
                            <Text className={`text-sm font-bold ${purchaseQtyMode === "unit" ? "text-white" : "text-text-secondary"}`}>
                              By {baseUnit}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setPurchaseQtyMode("pack")}
                            className={`flex-1 py-2 rounded-lg items-center border ${
                              purchaseQtyMode === "pack" ? "bg-primary border-primary dark:bg-primary-dark" : "border-gray-200 dark:border-zinc-800"
                            }`}
                          >
                            <Text className={`text-sm font-bold ${purchaseQtyMode === "pack" ? "text-white" : "text-text-secondary"}`}>
                              By {packUnit}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                      <TextInput
                        value={purchaseQuantity}
                        onChangeText={setPurchaseQuantity}
                        placeholder="0"
                        keyboardType="numeric"
                        className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-bold"
                      />
                      {packUnit && packSize && purchaseQtyMode === "pack" && purchaseQuantity && (
                        <Text className="text-sm text-text-secondary mt-1.5">
                          = {(parseFloat(purchaseQuantity) * packSize).toFixed(2)} {baseUnit} total
                        </Text>
                      )}
                    </>
                  );
                })()}
              </View>

              <View className="mt-4">
                <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  {(() => {
                    const p = products.find((prod) => prod.id === selectedProductId);
                    return purchaseQtyMode === "pack" && p?.pack_unit ? `Cost per ${p.pack_unit} (INR) *` : "Unit Cost (INR) *";
                  })()}
                </Text>
                <TextInput
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  placeholder="0.00"
                  keyboardType="numeric"
                  className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-bold"
                />
              </View>

              <View className="mt-4">
                <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                  Bill Reference / Invoice ID
                </Text>
                <TextInput
                  value={purchaseRef}
                  onChangeText={setPurchaseRef}
                  placeholder="e.g. BILL-92881-A"
                  className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
                />
              </View>
            </View>

            <View className="flex-row justify-between mt-10" style={{ marginBottom: bottomInset }}>
              <Pressable
                onPress={closePurchaseModal}
                className="border border-gray-200 dark:border-zinc-800 py-4 px-6 rounded-xl w-[48%] items-center"
              >
                <Text className="text-text-secondary dark:text-text-secondary-dark font-bold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRecordPurchase}
                disabled={submitLoading}
                className="bg-primary dark:bg-primary-dark py-4 px-6 rounded-xl w-[48%] items-center"
              >
                {submitLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold">Submit Bill</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        )}
      </Modal>

      {/* Record Expense Modal */}
      <Modal visible={isExpenseModal} animationType="slide" onRequestClose={closeExpenseModal}>
        <ScrollView className="flex-1 bg-background dark:bg-background-dark px-6 pb-10" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Record Expense
            </Text>
            <Pressable
              onPress={closeExpenseModal}
              className="w-11 h-11 items-center justify-center"
            >
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {billPhotoUri ? (
            <View className="mb-6">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Receipt Photo
              </Text>
              <Image
                source={{ uri: billPhotoUri }}
                style={{ width: "100%", height: 200, borderRadius: 16 }}
                resizeMode="contain"
              />
              <Pressable onPress={() => setBillPhotoUri(null)} className="mt-2 self-start">
                <Text className="text-error font-semibold text-sm">Remove Photo</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push("/bill-scanner?category=expense" as any)}
              className="mb-6 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl p-5 items-center bg-surface dark:bg-zinc-900 active:opacity-80"
            >
              <MaterialCommunityIcons name="camera-plus-outline" size={28} color="#0F7A5F" />
              <Text className="text-primary dark:text-primary-dark font-bold text-sm mt-2">Attach Bill Photo</Text>
              <Text className="text-text-secondary text-xs mt-0.5">Optional — helps during approval</Text>
            </Pressable>
          )}

          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Category
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {(["travel", "fuel", "food", "other"] as const).map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setExpenseCategory(cat)}
                    className={`px-4 py-3 rounded-xl border ${
                      expenseCategory === cat
                        ? "bg-primary border-primary dark:bg-primary-dark"
                        : "bg-surface dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
                    }`}
                  >
                    <Text className={`text-sm font-bold capitalize ${expenseCategory === cat ? "text-white" : "text-text-secondary"}`}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Amount (INR) *
              </Text>
              <TextInput
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                placeholder="0.00"
                keyboardType="numeric"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-bold text-lg"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Notes
              </Text>
              <TextInput
                value={expenseNotes}
                onChangeText={setExpenseNotes}
                placeholder="e.g. electricity bill, courier charges"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-base font-medium"
              />
            </View>
          </View>

          <Pressable
            onPress={handleRecordExpense}
            disabled={expenseSubmitting}
            className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center mt-8"
          >
            {expenseSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Save Expense</Text>}
          </Pressable>
        </ScrollView>
      </Modal>

      {/* Warehouse Management Modal */}
      <Modal visible={isWarehouseModal} animationType="slide" onRequestClose={closeWarehouseModal}>
        <View className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Warehouses
            </Text>
            <Pressable onPress={closeWarehouseModal} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 mb-4">
            {warehouses.map((w) => (
              <View
                key={w.id}
                className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm"
              >
                <Text className="font-bold text-base text-text-primary dark:text-text-primary-dark">
                  {w.name}
                </Text>
                <Text className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                  Location: {w.location || "Not specified"}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-155 dark:border-zinc-800 mb-10 shadow-lg">
            <Text className="font-bold text-base text-text-primary dark:text-text-primary-dark mb-4">
              Add New Warehouse
            </Text>
            <TextInput
              placeholder="Warehouse Name *"
              placeholderTextColor="#A0A0A0"
              value={newWhName}
              onChangeText={setNewWhName}
              className="bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 mb-3 text-sm"
            />
            <TextInput
              placeholder="Location Address"
              placeholderTextColor="#A0A0A0"
              value={newWhLoc}
              onChangeText={setNewWhLoc}
              className="bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 mb-4 text-sm"
            />
            <Pressable
              onPress={handleCreateWarehouse}
              disabled={whLoading}
              className="bg-primary dark:bg-primary-dark py-3.5 rounded-xl items-center active:opacity-90"
            >
              {whLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-sm">Create Warehouse</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Stock Transfer Modal */}
      <Modal visible={isTransferModal} animationType="slide" onRequestClose={closeTransferModal}>
        <View className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Stock Transfer
            </Text>
            <Pressable onPress={closeTransferModal} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView className="flex-grow space-y-4 pb-10">
            <View>
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Select Product *
              </Text>
              <View className="bg-surface dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-2 py-1">
                <TextInput
                  placeholder="Search products by name..."
                  placeholderTextColor="#A0A0A0"
                  value={transferProductSearch}
                  onChangeText={setTransferProductSearch}
                  className="text-sm font-medium px-2 py-3 text-text-primary"
                />
                <ScrollView horizontal className="flex-row px-2 pb-2">
                  {filteredProductsForTransfer.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setTransferProductId(p.id)}
                      className={`mr-2 px-4 py-3 rounded-lg border ${
                        transferProductId === p.id
                          ? "bg-primary border-primary dark:bg-primary-dark"
                          : "bg-background border-gray-200 dark:border-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          transferProductId === p.id ? "text-white" : "text-text-secondary"
                        }`}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Source Warehouse (From) *
              </Text>
              <ScrollView horizontal className="flex-row">
                {warehouses.map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => setTransferSourceWhId(w.id)}
                    className={`mr-2 px-4 py-2.5 rounded-xl border ${
                      transferSourceWhId === w.id
                        ? "bg-primary border-primary dark:bg-primary-dark"
                        : "bg-surface border-gray-200 dark:border-zinc-800"
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${
                        transferSourceWhId === w.id ? "text-white" : "text-text-primary dark:text-text-primary-dark"
                      }`}
                    >
                      {w.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Destination Warehouse (To) *
              </Text>
              <ScrollView horizontal className="flex-row">
                {warehouses.map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => setTransferDestWhId(w.id)}
                    className={`mr-2 px-4 py-2.5 rounded-xl border ${
                      transferDestWhId === w.id
                        ? "bg-primary border-primary dark:bg-primary-dark"
                        : "bg-surface border-gray-200 dark:border-zinc-800"
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${
                        transferDestWhId === w.id ? "text-white" : "text-text-primary dark:text-text-primary-dark"
                      }`}
                    >
                      {w.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Quantity *
              </Text>
              <TextInput
                value={transferQuantity}
                onChangeText={setTransferQuantity}
                placeholder="0"
                keyboardType="numeric"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-bold"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Transfer Reference Note
              </Text>
              <TextInput
                value={transferRef}
                onChangeText={setTransferRef}
                placeholder="e.g. Stock re-balancing"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Receipt Photo (optional)
              </Text>
              {transferPhotoUri ? (
                <View>
                  <Image source={{ uri: transferPhotoUri }} style={{ width: "100%", height: 160, borderRadius: 16 }} resizeMode="contain" />
                  <Pressable onPress={() => setTransferPhotoUri(null)} className="mt-2 self-start">
                    <Text className="text-error font-bold text-sm">Remove Photo</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => router.push("/bill-scanner?category=transfer" as any)}
                  className="border border-dashed border-gray-300 dark:border-zinc-700 rounded-xl py-5 items-center justify-center flex-row"
                  style={{ gap: 8 }}
                >
                  <MaterialCommunityIcons name="camera-outline" size={18} color="#0F7A5F" />
                  <Text className="text-primary dark:text-primary-dark font-bold text-sm">Attach Receipt Photo</Text>
                </Pressable>
              )}
            </View>

            <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
              <Pressable
                onPress={closeTransferModal}
                className="border border-gray-200 dark:border-zinc-800 py-4 px-6 rounded-xl w-[48%] items-center"
              >
                <Text className="text-text-secondary dark:text-text-secondary-dark font-bold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleStockTransfer}
                disabled={transferLoading}
                className="bg-primary dark:bg-primary-dark py-4 px-6 rounded-xl w-[48%] items-center"
              >
                {transferLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold">Transfer Stock</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Staff Attendance Checklist Modal */}
      <Modal visible={isAttendanceModal} animationType="slide" onRequestClose={closeAttendanceModal}>
        <View className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Daily Attendance Checklist
              </Text>
              <Text className="text-sm text-text-secondary mt-0.5">
                Date: {attendanceDate}
              </Text>
            </View>
            <Pressable onPress={closeAttendanceModal} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {staff.length === 0 ? (
            <View className="flex-1 justify-center items-center py-20">
              <Text className="text-text-secondary font-bold text-center">No employee profiles found</Text>
            </View>
          ) : (
            <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
              {staff.map((s) => {
                const currentStatus = attendanceMap[s.id] || "present";
                return (
                  <View
                    key={s.id}
                    className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-4 shadow-sm"
                  >
                    <Text className="font-bold text-sm text-text-primary dark:text-text-primary-dark">
                      {s.first_name} {s.last_name || ""}
                    </Text>
                    <Text className="text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5 font-semibold">
                      Email: {s.email}
                    </Text>
                    
                    <View className="flex-row mt-3 justify-between">
                      {["present", "absent"].map((statusOption) => (
                        <Pressable
                          key={statusOption}
                          onPress={() => updateAttendanceStatus(s.id, statusOption as any)}
                          className={`px-2 py-1.5 rounded-lg border flex-1 mr-1 items-center ${
                            currentStatus === statusOption
                              ? "bg-primary border-primary dark:bg-primary-dark"
                              : "bg-background border-gray-200 dark:border-zinc-800"
                          }`}
                        >
                          <Text
                            className={`text-sm font-bold uppercase ${
                              currentStatus === statusOption ? "text-white" : "text-text-secondary"
                            }`}
                          >
                            {statusOption.replace("_", " ")}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            onPress={handleSaveAttendance}
            disabled={attLoading}
            className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center shadow-md"
            style={{ marginBottom: bottomInset }}
          >
            {attLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-sm">Save Attendance Checklist</Text>
            )}
          </Pressable>
        </View>
      </Modal>

      {/* Salary Management Modal */}
      <Modal visible={isSalaryModal} animationType="slide" onRequestClose={closeSalaryModal}>
        <View className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Employee Salaries
            </Text>
            <Pressable onPress={closeSalaryModal} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <FlatList
            data={salariesList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
            ListHeaderComponent={
              <View className="bg-surface dark:bg-surface-dark p-5 rounded-3xl border border-gray-155 dark:border-zinc-800 mb-6 shadow-sm">
                <Text className="font-bold text-base text-text-primary dark:text-text-primary-dark mb-4">
                  Log Salary Payout
                </Text>
                
                <View className="bg-background dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-2 py-1.5 mb-3">
                  <TextInput
                    placeholder="Enter Employee ID / Select Employee"
                    placeholderTextColor="#A0A0A0"
                    value={selectedStaffId}
                    onChangeText={setSelectedStaffId}
                    className="text-sm font-medium px-2 py-2 text-text-primary dark:text-text-primary-dark"
                  />
                  <ScrollView horizontal className="flex-row px-2 pb-1">
                    {staff.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => setSelectedStaffId(s.id)}
                        className={`mr-2 px-2.5 py-1 rounded-md border ${
                          selectedStaffId === s.id
                            ? "bg-primary border-primary dark:bg-primary-dark"
                            : "bg-surface border-gray-200 dark:border-zinc-800"
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            selectedStaffId === s.id ? "text-white" : "text-text-secondary"
                          }`}
                        >
                          {s.first_name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <TextInput
                  placeholder="Amount Paid (INR) *"
                  placeholderTextColor="#A0A0A0"
                  value={salaryAmount}
                  onChangeText={setSalaryAmount}
                  keyboardType="numeric"
                  className="bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 mb-3 text-sm font-bold"
                />

                <TextInput
                  placeholder="Reference Note (e.g. June Attendance)"
                  placeholderTextColor="#A0A0A0"
                  value={salaryRef}
                  onChangeText={setSalaryRef}
                  className="bg-background dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 mb-4 text-sm font-medium"
                />

                <Pressable
                  onPress={handleRecordSalary}
                  disabled={salarySubmitting}
                  className="bg-primary dark:bg-primary-dark py-3.5 rounded-xl items-center"
                >
                  {salarySubmitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-sm">Record Salary Payout</Text>
                  )}
                </Pressable>
              </View>
            }
            renderItem={({ item }) => (
              <View className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm">
                <View className="flex-row justify-between items-start">
                  <View>
                    <Text className="font-bold text-sm text-text-primary dark:text-text-primary-dark">
                      {item.user ? `${item.user.first_name} ${item.user.last_name || ""}` : "Employee"}
                    </Text>
                    <Text className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                      Note: {item.reference || "Salary Payment"}
                    </Text>
                    <Text className="text-sm text-text-secondary mt-0.5">
                      Date: {item.date}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-black text-green-600">
                      ₹{parseFloat(item.amount).toFixed(2)}
                    </Text>
                    <Text className="text-sm font-bold text-text-secondary dark:text-text-secondary-dark mt-1 uppercase tracking-wider">
                      {item.status}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* Logistics & Delivery Challans Modal */}
      <Modal visible={isChallanModal} animationType="slide" onRequestClose={() => setIsChallanModal(false)}>
        <View className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Delivery Challans
              </Text>
              <Text className="text-sm text-text-secondary mt-0.5">
                Logistics driver runs and transit dispatch logs
              </Text>
            </View>
            <Pressable onPress={() => setIsChallanModal(false)} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <Pressable
            onPress={() => setIsCreateChallanModal(true)}
            className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center mb-6 shadow-sm"
          >
            <Text className="text-white font-bold text-sm">+ Generate Delivery Challan</Text>
          </Pressable>

          {loading ? (
            <View className="flex-grow justify-center items-center py-20">
              <ActivityIndicator size="large" color="#0F7A5F" />
            </View>
          ) : challans.length === 0 ? (
            <View className="flex-grow justify-center items-center py-20">
              <Text className="text-text-secondary font-bold text-center">No challans generated</Text>
            </View>
          ) : (
            <FlatList
              data={challans}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
              renderItem={({ item }) => {
                let badgeColor = "bg-gray-100 text-gray-700";
                if (item.status === "in_transit") badgeColor = "bg-orange-50 text-orange-600 dark:bg-orange-950/20";
                else if (item.status === "delivered") badgeColor = "bg-green-50 text-green-600 dark:bg-green-950/20";

                return (
                  <View className="bg-surface dark:bg-surface-dark p-4.5 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-4 shadow-sm">
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-2">
                        <Text className="font-bold text-base text-text-primary dark:text-text-primary-dark">
                          {item.challan_number}
                        </Text>
                        <Text className="text-sm text-text-secondary mt-1 font-semibold">
                          Driver: {item.driver_name} ({item.driver_phone})
                        </Text>
                        <Text className="text-sm text-text-secondary mt-0.5">
                          Vehicle: {item.vehicle_number} | Route: {item.destination}
                        </Text>
                      </View>
                      <View className="flex-row items-center space-x-2">
                        <Pressable
                          onPress={() => shareChallan(item)}
                          className="bg-primary/10 p-2 rounded-xl active:opacity-80"
                        >
                          <Text className="text-sm text-primary font-bold">Share</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleToggleChallanStatus(item)}
                          className={`px-3 py-1.5 rounded-xl active:opacity-80 ${badgeColor}`}
                        >
                          <Text className="text-sm font-black uppercase tracking-wider">
                            {item.status.replace("_", " ")}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* Create Challan Modal */}
      <Modal visible={isCreateChallanModal} animationType="slide" onRequestClose={closeCreateChallanModal}>
        <ScrollView className="flex-1 bg-background dark:bg-background-dark px-6 pb-10" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Generate Challan
            </Text>
            <Pressable onPress={closeCreateChallanModal} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Link Existing Invoice (Optional)
              </Text>
              <View className="bg-surface dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-2 py-1.5">
                <TextInput
                  placeholder="Select Invoice"
                  placeholderTextColor="#A0A0A0"
                  value={selectedInvoiceId}
                  onChangeText={setSelectedInvoiceId}
                  className="text-sm font-medium px-2 py-2 text-text-primary"
                />
                <ScrollView horizontal className="flex-row px-2 pb-1">
                  {invoices.map((inv) => (
                    <Pressable
                      key={inv.id}
                      onPress={() => setSelectedInvoiceId(inv.id)}
                      className={`mr-2 px-2.5 py-1 rounded-md border ${
                        selectedInvoiceId === inv.id
                          ? "bg-primary border-primary dark:bg-primary-dark"
                          : "bg-background border-gray-200 dark:border-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          selectedInvoiceId === inv.id ? "text-white" : "text-text-secondary"
                        }`}
                      >
                        {inv.invoice_number}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Vehicle Number *
              </Text>
              <TextInput
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                placeholder="e.g. MH-12-PQ-9988"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-bold"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Driver Name *
              </Text>
              <TextInput
                value={driverName}
                onChangeText={setDriverName}
                placeholder="Driver Name"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Driver Phone *
              </Text>
              <TextInput
                value={driverPhone}
                onChangeText={setDriverPhone}
                placeholder="Driver Contact Number"
                keyboardType="phone-pad"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Destination Address *
              </Text>
              <TextInput
                value={destination}
                onChangeText={setDestination}
                placeholder="Delivery Destination Address"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 font-medium"
              />
            </View>
          </View>

          <View className="flex-row justify-between mt-10" style={{ marginBottom: bottomInset }}>
            <Pressable
              onPress={closeCreateChallanModal}
              className="border border-gray-200 dark:border-zinc-800 py-4 px-6 rounded-xl w-[48%] items-center"
            >
              <Text className="text-text-secondary dark:text-text-secondary-dark font-bold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleCreateChallan}
              disabled={challanSubmitting}
              className="bg-primary dark:bg-primary-dark py-4 px-6 rounded-xl w-[48%] items-center"
            >
              {challanSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold">Generate</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      {/* Sales Report Modal */}
      <Modal visible={isSalesReportModal} animationType="slide" onRequestClose={() => setIsSalesReportModal(false)}>
        <View className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Sales Summary
              </Text>
              <Text className="text-sm text-text-secondary mt-0.5 font-medium">
                Overall company revenue metrics
              </Text>
            </View>
            <Pressable onPress={() => setIsSalesReportModal(false)} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <View className="space-y-4">
            <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 mb-4 shadow-sm">
              <Text className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                Total Revenue
              </Text>
              <Text className="text-3xl font-black text-primary mt-1.5">
                ₹{totalSalesReport.toFixed(2)}
              </Text>
            </View>

            <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 mb-4 shadow-sm">
              <Text className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                Completed Invoices
              </Text>
              <Text className="text-3xl font-black text-text-primary dark:text-text-primary-dark mt-1.5">
                {invoices.length} orders
              </Text>
            </View>

            <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 mb-6 shadow-sm">
              <Text className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                Average Bill Size
              </Text>
              <Text className="text-3xl font-black text-text-primary dark:text-text-primary-dark mt-1.5">
                ₹{averageSalesInvoice.toFixed(2)}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setIsSalesReportModal(false)}
            className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center shadow-md"
            style={{ marginBottom: bottomInset }}
          >
            <Text className="text-white font-bold text-sm">Close Report</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Stock Levels Report Modal */}
      <Modal visible={isStockReportModal} animationType="slide" onRequestClose={() => setIsStockReportModal(false)}>
        <View className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Inventory Stock Levels
              </Text>
              <Text className="text-sm text-text-secondary mt-0.5">
                Live calculated stock aggregates from movements
              </Text>
            </View>
            <Pressable onPress={() => setIsStockReportModal(false)} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {products.length === 0 ? (
            <View className="flex-1 justify-center items-center">
              <Text className="text-text-secondary font-bold text-center">No products registered</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
              renderItem={({ item }) => {
                const stock = parseFloat(item.stock_quantity ?? "0");
                const badgeColor = stock > 10 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50";

                return (
                  <View className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm">
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="font-bold text-sm text-text-primary dark:text-text-primary-dark">
                          {item.name}
                        </Text>
                        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5">
                          SKU: {item.sku || "N/A"}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className={`text-sm font-black px-2.5 py-1 rounded-xl ${badgeColor}`}>
                          {stock} units
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <Pressable
            onPress={() => setIsStockReportModal(false)}
            className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center shadow-md mt-4"
            style={{ marginBottom: bottomInset }}
          >
            <Text className="text-white font-bold text-sm">Close Report</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Ledger Outstanding Modal */}
      <Modal visible={isLedgerReportModal} animationType="slide" onRequestClose={() => setIsLedgerReportModal(false)}>
        <View className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                Outstanding Summary
              </Text>
              <Text className="text-sm text-text-secondary mt-0.5">
                Total outstanding balances per account classification
              </Text>
            </View>
            <Pressable onPress={() => setIsLedgerReportModal(false)} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView className="flex-grow space-y-4 pb-10" showsVerticalScrollIndicator={false}>
            <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
              <Text className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                Total Receivables (From Customers)
              </Text>
              <Text className="text-2xl font-black text-green-600 mt-1">
                ₹{totalReceivables.toFixed(2)}
              </Text>
            </View>

            <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
              <Text className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                Total Payables (To Suppliers)
              </Text>
              <Text className="text-2xl font-black text-red-600 mt-1">
                ₹{totalPayables.toFixed(2)}
              </Text>
            </View>

            <Text className="font-bold text-sm text-text-primary dark:text-text-primary-dark mb-2">
              Top Customer Outstanding Receivables
            </Text>
            {partiesList
              .filter((p) => p.type === "customer")
              .slice(0, 5)
              .map((p) => (
                <View
                  key={p.id}
                  className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 flex-row justify-between items-center"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">{p.name}</Text>
                    <Text className="text-sm text-text-secondary mt-0.5">Phone: {p.phone || "N/A"}</Text>
                  </View>
                  <View className="flex-row items-center space-x-2">
                    <Pressable
                      onPress={() => shareLedgerReminder(p.name, p.phone || "", parseFloat(p.current_balance || "0"), false)}
                      className="bg-primary/10 px-2.5 py-1.5 rounded-lg"
                    >
                      <Text className="text-sm text-primary font-bold">Remind</Text>
                    </Pressable>
                    <Text className="text-sm font-black text-green-600">₹{parseFloat(p.current_balance || "0").toFixed(2)}</Text>
                  </View>
                </View>
              ))}

            <Text className="font-bold text-sm text-text-primary dark:text-text-primary-dark mt-6 mb-2">
              Top Supplier Outstanding Payables
            </Text>
            {partiesList
              .filter((p) => p.type === "supplier")
              .slice(0, 5)
              .map((p) => (
                <View
                  key={p.id}
                  className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 flex-row justify-between items-center"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-sm font-bold text-text-primary dark:text-text-primary-dark">{p.name}</Text>
                    <Text className="text-sm text-text-secondary mt-0.5">Phone: {p.phone || "N/A"}</Text>
                  </View>
                  <View className="flex-row items-center space-x-2">
                    <Pressable
                      onPress={() => shareLedgerReminder(p.name, p.phone || "", parseFloat(p.current_balance || "0"), true)}
                      className="bg-primary/10 px-2.5 py-1.5 rounded-lg"
                    >
                      <Text className="text-sm text-primary font-bold">Verify</Text>
                    </Pressable>
                    <Text className="text-sm font-black text-red-600">₹{parseFloat(p.current_balance || "0").toFixed(2)}</Text>
                  </View>
                </View>
              ))}
          </ScrollView>

          <Pressable
            onPress={() => setIsLedgerReportModal(false)}
            className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center shadow-md"
            style={{ marginBottom: bottomInset }}
          >
            <Text className="text-white font-bold text-sm">Close Report</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Stock Movements Log Modal */}
      <Modal visible={isMovementsModal} animationType="slide" onRequestClose={() => setIsMovementsModal(false)}>
        <View className="flex-1 bg-background dark:bg-background-dark px-6" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Stock Movements Log
            </Text>
            <Pressable onPress={() => setIsMovementsModal(false)} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0F7A5F" />
            </View>
          ) : movements.length === 0 ? (
            <View className="flex-1 justify-center items-center py-20">
              <Text className="text-text-secondary font-bold text-center">No movements recorded</Text>
            </View>
          ) : (
            <FlatList
              data={movements}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
              renderItem={({ item }) => {
                const isPurchase = item.type === "purchase";
                const isSale = item.type === "sale";
                const isTransfer = item.type === "transfer";
                const isQtyPositive = parseFloat(item.quantity) > 0;
                
                let indicatorColor = "text-blue-600 bg-blue-50 dark:bg-blue-950/20";
                if (isPurchase || (isTransfer && isQtyPositive)) {
                  indicatorColor = "text-green-600 bg-green-50 dark:bg-green-950/20";
                } else if (isSale || (isTransfer && !isQtyPositive)) {
                  indicatorColor = "text-red-600 bg-red-50 dark:bg-red-950/20";
                }
                
                return (
                  <View className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 mb-3.5 shadow-sm">
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-2">
                        <Text className="font-bold text-sm text-text-primary dark:text-text-primary-dark">
                          {item.product?.name ?? "Unknown Product"}
                        </Text>
                        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1 font-semibold">
                          Reference: {item.reference || "None"}
                        </Text>
                        <Text className="text-sm text-text-secondary mt-0.5">
                          Date: {new Date(item.created_at).toLocaleString()}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className={`text-base font-black px-2.5 py-1 rounded-xl ${indicatorColor}`}>
                          {parseFloat(item.quantity) > 0 ? "+" : ""} {parseFloat(item.quantity).toFixed(0)} units
                        </Text>
                        <Text className="text-sm font-bold text-text-secondary dark:text-text-secondary-dark mt-1 uppercase tracking-wider">
                          {item.type}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* Business Profile Modal */}
      <Modal visible={isBusinessProfileModal} animationType="slide" onRequestClose={closeBusinessProfileModal}>
        <ScrollView className="flex-1 bg-background dark:bg-background-dark px-6 pb-10" style={{ paddingTop: topInset }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              Business Profile
            </Text>
            <Pressable onPress={closeBusinessProfileModal} className="w-11 h-11 items-center justify-center">
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <View className="space-y-4">
            {[
              { label: "Business Name *", value: bizName, setter: setBizName, placeholder: "Your Shop / Company Name" },
              { label: "GSTIN", value: bizGstin, setter: setBizGstin, placeholder: "15-character GSTIN", autoCapitalize: "characters" as const },
              { label: "State", value: bizState, setter: setBizState, placeholder: "e.g. Maharashtra" },
              { label: "Address", value: bizAddress, setter: setBizAddress, placeholder: "Shop address for invoices" },
              { label: "Phone", value: bizPhone, setter: setBizPhone, placeholder: "10-digit mobile number", keyboardType: "phone-pad" as const },
              { label: "Bank Name", value: bizBankName, setter: setBizBankName, placeholder: "e.g. HDFC Bank" },
              { label: "Bank Account Number", value: bizBankAccountNumber, setter: setBizBankAccountNumber, placeholder: "Account number", keyboardType: "numeric" as const },
              { label: "Bank IFSC", value: bizBankIfsc, setter: setBizBankIfsc, placeholder: "IFSC code", autoCapitalize: "characters" as const },
              { label: "UPI ID (for invoice QR)", value: bizUpiId, setter: setBizUpiId, placeholder: "e.g. shopname@okhdfcbank" },
            ].map((field) => (
              <View className="mt-4" key={field.label}>
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  {field.label}
                </Text>
                <TextInput
                  value={field.value}
                  onChangeText={field.setter}
                  placeholder={field.placeholder}
                  keyboardType={field.keyboardType}
                  autoCapitalize={field.autoCapitalize}
                  className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium"
                />
              </View>
            ))}
          </View>

          <View className="flex-row justify-between mt-10" style={{ marginBottom: bottomInset }}>
            <Pressable
              onPress={closeBusinessProfileModal}
              className="border border-gray-200 dark:border-zinc-800 py-4 px-6 rounded-xl w-[48%] items-center"
            >
              <Text className="text-text-secondary dark:text-text-secondary-dark font-bold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSaveBusinessProfile}
              disabled={bizSubmitting}
              className="bg-primary dark:bg-primary-dark py-4 px-6 rounded-xl w-[48%] items-center"
            >
              {bizSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Save</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      {/* Quick PIN Setup Modal */}
      <Modal visible={isPinSetupModal} animationType="slide" transparent onRequestClose={closePinSetupModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/40"
        >
          <View className="bg-background dark:bg-background-dark rounded-t-3xl px-6 pt-6" style={{ paddingBottom: bottomInset + 24 }}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                {pinLoginAvailable ? "Change Quick PIN" : "Set Up Quick PIN"}
              </Text>
              <Pressable
                onPress={closePinSetupModal}
                className="w-11 h-11 items-center justify-center"
              >
                <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
              New 4-Digit PIN
            </Text>
            <TextInput
              value={newPin}
              onChangeText={setNewPin}
              placeholder="••••"
              placeholderTextColor="#A0A0A0"
              secureTextEntry
              maxLength={4}
              keyboardType="number-pad"
              className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 font-bold text-3xl text-center tracking-widest mb-4"
            />

            <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Confirm PIN
            </Text>
            <TextInput
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="••••"
              placeholderTextColor="#A0A0A0"
              secureTextEntry
              maxLength={4}
              keyboardType="number-pad"
              className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 font-bold text-3xl text-center tracking-widest mb-6"
            />

            <Pressable
              onPress={handleSetupPin}
              disabled={pinSubmitting}
              className="bg-primary dark:bg-primary-dark py-4 rounded-xl items-center active:opacity-90"
            >
              {pinSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Save PIN</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Staff Modal */}
      <Modal visible={isAddingStaff} animationType="slide" onRequestClose={closeAddStaffModal}>
        <ScrollView className="flex-1 bg-background dark:bg-background-dark px-6 pb-10" style={{ paddingTop: topInset }}>
          <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-6">
            Add New Employee
          </Text>

          {/* Form fields */}
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                First Name *
              </Text>
              <TextInput
                value={newStaffFirstName}
                onChangeText={setNewStaffFirstName}
                placeholder="e.g. John"
                placeholderTextColor="#A0A0A0"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Last Name
              </Text>
              <TextInput
                value={newStaffLastName}
                onChangeText={setNewStaffLastName}
                placeholder="e.g. Doe"
                placeholderTextColor="#A0A0A0"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Email Address *
              </Text>
              <TextInput
                value={newStaffEmail}
                onChangeText={setNewStaffEmail}
                placeholder="john@example.com"
                placeholderTextColor="#A0A0A0"
                autoCapitalize="none"
                keyboardType="email-address"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Phone (optional — for sending login via WhatsApp)
              </Text>
              <TextInput
                value={newStaffPhone}
                onChangeText={setNewStaffPhone}
                placeholder="10-digit mobile number"
                placeholderTextColor="#A0A0A0"
                keyboardType="phone-pad"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider">
                  Temporary Password *
                </Text>
                <Pressable onPress={() => setNewStaffPassword(randomTempPassword())}>
                  <Text className="text-sm font-bold text-primary dark:text-primary-dark">Auto-Generate</Text>
                </Pressable>
              </View>
              <TextInput
                value={newStaffPassword}
                onChangeText={setNewStaffPassword}
                placeholder="Enter a password, or tap Auto-Generate"
                placeholderTextColor="#A0A0A0"
                secureTextEntry
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium"
              />
              <Text className="text-xs text-text-secondary mt-1.5">They can change this after their first login.</Text>
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Employee Role *
              </Text>
              <View className="flex-row flex-wrap mt-2">
                {roles.length === 0 ? (
                  <Text className="text-text-secondary italic">Loading roles... (Requires Admin permissions)</Text>
                ) : (
                  roles.map(r => (
                    <Pressable
                      key={r.id}
                      onPress={() => setNewStaffRole(r.id)}
                      className={`mr-3 mb-3 px-4 py-3 rounded-xl border ${
                        newStaffRole === r.id
                          ? "bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark"
                          : "bg-surface dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
                      }`}
                    >
                      <Text
                        className={`font-bold ${
                          newStaffRole === r.id ? "text-white" : "text-text-primary dark:text-text-primary-dark"
                        }`}
                      >
                        {r.name}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          </View>

          {/* Form Actions */}
          <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
            <Pressable
              onPress={closeAddStaffModal}
              className="border border-gray-200 dark:border-zinc-800 py-4 px-6 rounded-xl w-[48%] items-center"
            >
              <Text className="text-text-secondary dark:text-text-secondary-dark font-bold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddStaff}
              disabled={addStaffLoading || !newStaffRole}
              className={`py-4 px-6 rounded-xl w-[48%] items-center ${
                !newStaffRole ? "bg-gray-400" : "bg-primary dark:bg-primary-dark"
              }`}
            >
              {addStaffLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Create Employee</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      {/* Dispatch Task Modal */}
      <Modal visible={isDispatchTaskModal} animationType="slide" onRequestClose={closeDispatchTaskModal}>
        <ScrollView className="flex-1 bg-background dark:bg-background-dark px-6 pb-10" style={{ paddingTop: topInset }}>
          <Text className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-6">
            Dispatch Task to Agent
          </Text>

          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Task Title *
              </Text>
              <TextInput
                value={taskTitle}
                onChangeText={setTaskTitle}
                placeholder="e.g. Collect payment from ABC Traders"
                placeholderTextColor="#A0A0A0"
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium"
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Detailed Description
              </Text>
              <TextInput
                value={taskDescription}
                onChangeText={setTaskDescription}
                placeholder="Any special instructions for the agent..."
                placeholderTextColor="#A0A0A0"
                multiline
                numberOfLines={3}
                className="bg-surface dark:bg-zinc-900 text-text-primary dark:text-text-primary-dark border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-base font-medium"
                style={{ textAlignVertical: "top" }}
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                Assign To *
              </Text>
              {staff.length === 0 ? (
                <Text className="text-text-secondary italic">No staff found. Create an employee first.</Text>
              ) : (
                <View className="flex-row flex-wrap mt-2">
                  {staff.map(s => (
                    <Pressable
                      key={s.id}
                      onPress={() => setTaskAssignedTo(s.id)}
                      className={`mr-3 mb-3 px-4 py-3 rounded-xl border ${
                        taskAssignedTo === s.id
                          ? "bg-primary dark:bg-primary-dark border-primary dark:border-primary-dark"
                          : "bg-surface dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
                      }`}
                    >
                      <Text
                        className={`font-bold ${
                          taskAssignedTo === s.id ? "text-white" : "text-text-primary dark:text-text-primary-dark"
                        }`}
                      >
                        {s.first_name} {s.last_name || ""}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View className="flex-row justify-between mt-8" style={{ marginBottom: bottomInset }}>
            <Pressable
              onPress={closeDispatchTaskModal}
              className="border border-gray-200 dark:border-zinc-800 py-4 px-6 rounded-xl w-[48%] items-center"
            >
              <Text className="text-text-secondary dark:text-text-secondary-dark font-bold text-base">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleDispatchTask}
              disabled={dispatchLoading || !taskAssignedTo}
              className={`py-4 px-6 rounded-xl w-[48%] items-center ${
                !taskAssignedTo ? "bg-gray-400" : "bg-primary dark:bg-primary-dark"
              }`}
            >
              {dispatchLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Dispatch</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

