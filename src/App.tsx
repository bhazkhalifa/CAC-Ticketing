import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Ticket,
  Tags,
  Calendar,
  Settings2,
  Plus,
  ListFilter,
  FileSpreadsheet,
  Printer,
  Minus,
  X,
  Search,
  Lock,
  Unlock,
  Armchair,
  Sparkles,
  Trash2,
  Edit2,
  Check,
  Palette,
  Sun,
  Moon,
  FileImage,
  LogOut,
  ShieldCheck,
  Users,
  KeyRound,
  UserCheck,
  Focus,
  Paintbrush,
  MousePointerClick,
  CheckSquare,
  UploadCloud,
  FileText,
  DollarSign,
  Gift,
  Eye,
  Download,
  Loader2,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
  Clock,
  ArrowRight,
  RefreshCw,
  Filter
} from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, testConnection } from './firebase';

export interface Show {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  description?: string;
}

export interface SeatCategory {
  id: string;
  name: string;
  color: string; // Hex color e.g. '#f59e0b'
  price: number; // Price in PHP
}

export interface GateUser {
  username: string; // Secret key typed in gatewall (e.g. 'bas')
  name: string; // Display name, e.g. 'Bas'
  isSuperAdmin?: boolean;
  createdAt: string;
}

export interface Booking {
  seatId: string;
  patronName: string;
  patronId: string;
  paymentMethod: string;
  categoryId: string;
  bookedByUsername: string; // Secretly recorded!
  bookedByName: string; // Secretly recorded!
  notes?: string;
  proofOfPaymentData?: string; // Compressed Base64 Data URL (<300KB)
  proofOfPaymentName?: string; // Original uploaded file name
  bookedAt: string;
}

export interface ActivityLog {
  id: string;
  type: 'BOOKING' | 'CANCELLATION' | 'SHOW_UPDATE' | 'CATEGORY_UPDATE' | 'RECEIPT_UPLOAD';
  description: string;
  showId: string;
  showName: string;
  seatIds?: string[];
  patronName?: string;
  paymentMethod?: string;
  performedByUsername: string;
  performedByName: string;
  timestamp: string;
  details?: string;
}

// Compress uploaded receipt image to lightweight WebP/JPEG data URL (<300KB)
export const compressReceiptImage = (file: File): Promise<{ dataUrl: string; compressedSizeKb: number }> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve({ dataUrl, compressedSizeKb: Math.round(file.size / 1024) });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDimension = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: e.target?.result as string, compressedSizeKb: Math.round(file.size / 1024) });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Attempt webp at 0.75 quality, fallback to jpeg
        let dataUrl = canvas.toDataURL('image/webp', 0.75);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        }

        const head = dataUrl.indexOf(',');
        const b64Length = dataUrl.length - (head + 1);
        const approxSizeKb = Math.round((b64Length * 3) / 4 / 1024);

        resolve({ dataUrl, compressedSizeKb: approxSizeKb });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface TierRowConfig {
  row: string;
  left: [number, number] | null;
  center: [number, number] | null;
  right: [number, number] | null;
}

// SUCAC TRIANGLE EMBLEM (Matching uploaded image.png)
export function SucacLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SUCAC Silliman Logo"
    >
      {/* Top Red Section */}
      <path
        d="M50 7 L72.5 46 H27.5 Z"
        fill="#E51C24"
      />
      {/* Top Section Right Notch Cutout */}
      <polygon
        points="72.5,30 49,30 49,34 70,34"
        fill="white"
      />

      {/* Center Negative Space Inverted White Triangle */}
      <polygon
        points="27.5,46 72.5,46 50,91"
        fill="white"
      />

      {/* Bottom Left Red Section */}
      <path
        d="M27.5 46 L50 91 H5 Z"
        fill="#E51C24"
      />
      {/* Bottom Left Section Angled Slit Cutout */}
      <polygon
        points="26.5,91 19,73 22.5,71.5 30,91"
        fill="white"
      />

      {/* Bottom Right Red Section */}
      <path
        d="M72.5 46 L95 91 H50 Z"
        fill="#E51C24"
      />
      {/* Bottom Right Section Right Notch Cutout */}
      <polygon
        points="94,73 72,73 72,77 92.5,77"
        fill="white"
      />
    </svg>
  );
}

// EXACT USER AUDITORIUM SPECIFICATION
const UPPER_TIER_CONFIG: TierRowConfig[] = [
  { row: 'W', left: [1, 11], center: null, right: [12, 21] },
  { row: 'V', left: [1, 11], center: null, right: [12, 22] },
  { row: 'U', left: [1, 11], center: null, right: [12, 22] },
  { row: 'T', left: [1, 11], center: [12, 28], right: [29, 39] },
  { row: 'S', left: [1, 11], center: [12, 27], right: [28, 38] },
  { row: 'R', left: [1, 11], center: [12, 27], right: [28, 38] },
  { row: 'Q', left: [1, 11], center: [12, 27], right: [28, 38] },
  { row: 'P', left: [1, 11], center: [12, 27], right: [28, 38] },
  { row: 'O', left: [1, 11], center: [12, 27], right: [28, 38] },
  { row: 'N', left: [1, 11], center: [12, 27], right: [28, 38] },
  { row: 'M', left: [1, 11], center: [12, 27], right: [28, 38] },
  { row: 'L', left: [1, 11], center: [12, 27], right: [28, 38] },
];

const LOWER_TIER_CONFIG: TierRowConfig[] = [
  { row: 'K', left: [1, 10], center: [11, 25], right: [26, 35] },
  { row: 'J', left: [1, 10], center: [11, 25], right: [26, 35] },
  { row: 'I', left: [1, 10], center: [11, 25], right: [26, 35] },
  { row: 'H', left: [1, 10], center: [11, 25], right: [26, 35] },
  { row: 'G', left: [1, 9],  center: [10, 23], right: [24, 32] },
  { row: 'F', left: [1, 9],  center: [10, 22], right: [23, 31] },
  { row: 'E', left: [1, 9],  center: [10, 22], right: [23, 31] },
  { row: 'D', left: [1, 9],  center: [10, 22], right: [23, 31] },
  { row: 'C', left: [1, 9],  center: [10, 21], right: [22, 30] },
  { row: 'B', left: [1, 9],  center: [10, 20], right: [21, 29] },
  { row: 'A', left: [1, 9],  center: [10, 20], right: [21, 29] },
];

export const SHOW_TYPES = [
  'Gala Season Pass',
  'Gala Show',
  'Matinee Season Pass',
  'Matinee Show',
  'Regular Show',
] as const;

export type ShowType = typeof SHOW_TYPES[number];

const DEFAULT_SHOWS: Show[] = [
  { id: 'show-bonikid-gala', title: 'BONIKID Gala Premiere', description: 'A Silliman University Cultural Affairs Committee Musical Stage Presentation', date: '2026-10-16', time: '7:00 PM', type: 'Gala Show' },
  { id: 'show-bonikid-matinee', title: 'BONIKID Saturday Matinee', description: 'Afternoon Student Matinee Performance', date: '2026-10-17', time: '2:00 PM', type: 'Matinee Show' },
  { id: 'show-bonikid-closing', title: 'BONIKID Closing Gala', description: 'Grand Finale & Closing Production', date: '2026-10-18', time: '7:00 PM', type: 'Gala Show' },
];

const DEFAULT_CATEGORIES: SeatCategory[] = [
  { id: 'cat-gold', name: 'Gold Front', color: '#f59e0b', price: 800 },
  { id: 'cat-cyan', name: 'Cyan Mid', color: '#06b6d4', price: 580 },
  { id: 'cat-green', name: 'Green Balcony', color: '#10b981', price: 300 },
  { id: 'cat-vip', name: 'VIP Sponsor', color: '#a855f7', price: 1000 },
];

// DEFAULT USER: Super Admin 'bas'
const DEFAULT_USERS: GateUser[] = [
  { username: 'bas', name: 'Bas', isSuperAdmin: true, createdAt: '2026-10-11T00:00:00.000Z' },
];

const PRESET_PALETTE = [
  '#f59e0b', // Amber/Gold
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#8b5cf6', // Indigo
  '#64748b', // Slate
];

// Calculate list of all seat IDs once
const ALL_SEATS_LIST: string[] = [];
[...UPPER_TIER_CONFIG, ...LOWER_TIER_CONFIG].forEach(cfg => {
  if (cfg.left) {
    for (let i = cfg.left[0]; i <= cfg.left[1]; i++) ALL_SEATS_LIST.push(`${cfg.row}-${i}`);
  }
  if (cfg.center) {
    for (let i = cfg.center[0]; i <= cfg.center[1]; i++) ALL_SEATS_LIST.push(`${cfg.row}-${i}`);
  }
  if (cfg.right) {
    for (let i = cfg.right[0]; i <= cfg.right[1]; i++) ALL_SEATS_LIST.push(`${cfg.row}-${i}`);
  }
});

function getDefaultCategoryId(seatId: string): string {
  const row = seatId.split('-')[0];
  if (['A', 'B', 'C', 'D'].includes(row)) return 'cat-gold';
  if (['E', 'F', 'G', 'H', 'I', 'J', 'K'].includes(row)) return 'cat-cyan';
  return 'cat-green';
}

export default function App() {
  // USER / GATEWALL STATE
  const [users, setUsers] = useState<GateUser[]>(() => {
    const saved = localStorage.getItem('sucac_gate_users');
    if (saved) {
      try {
        const parsed: GateUser[] = JSON.parse(saved);
        if (!parsed.some(u => u.username.toLowerCase() === 'bas')) {
          parsed.unshift({ username: 'bas', name: 'Bas', isSuperAdmin: true, createdAt: new Date().toISOString() });
        }
        return parsed;
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<GateUser | null>(() => {
    const saved = localStorage.getItem('sucac_active_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return null; // Locked gatewall initially
  });

  const [gateInput, setGateInput] = useState('');
  const [gateError, setGateError] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [editingUser, setEditingUser] = useState<GateUser | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');

  // Shows State
  const [shows, setShows] = useState<Show[]>(() => {
    const saved = localStorage.getItem('auditorium_shows');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return DEFAULT_SHOWS;
  });

  const [currentShowId, setCurrentShowId] = useState<string>('show-bonikid-gala');

  // Categories State (Includes Price)
  const [categories, setCategories] = useState<SeatCategory[]>(() => {
    const saved = localStorage.getItem('auditorium_categories');
    if (saved) {
      try {
        const parsed: SeatCategory[] = JSON.parse(saved);
        return parsed.map(c => ({
          ...c,
          price: typeof c.price === 'number' ? c.price : (c.id === 'cat-gold' ? 800 : c.id === 'cat-cyan' ? 580 : c.id === 'cat-vip' ? 1000 : 300)
        }));
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_CATEGORIES;
  });

  // Seat to Category Assignment State
  const [seatCategoryMap, setSeatCategoryMap] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(`auditorium_seat_categories_${currentShowId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    const initial: Record<string, string> = {};
    ALL_SEATS_LIST.forEach(id => {
      initial[id] = getDefaultCategoryId(id);
    });
    return initial;
  });

  // Bookings State (With Staff Attribution)
  const [bookings, setBookings] = useState<Record<string, Booking>>(() => {
    const saved = localStorage.getItem(`auditorium_bookings_${currentShowId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      'T-29': {
        seatId: 'T-29',
        patronName: 'Carlos Rivera',
        patronId: '2024-9102',
        paymentMethod: 'Charge to Tuition',
        categoryId: 'cat-green',
        bookedByUsername: 'bas',
        bookedByName: 'Bas',
        notes: 'Upper Row T right aisle',
        bookedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      'U-12': {
        seatId: 'U-12',
        patronName: 'Elena Ramos',
        patronId: '2024-5541',
        paymentMethod: 'Charge to Tuition',
        categoryId: 'cat-green',
        bookedByUsername: 'bas',
        bookedByName: 'Bas',
        notes: 'Upper Row U right aisle directly above T29',
        bookedAt: new Date(Date.now() - 1800000).toISOString(),
      },
      'A-15': {
        seatId: 'A-15',
        patronName: 'Dean Arthur Lee',
        patronId: 'FACULTY-VIP',
        paymentMethod: 'Charge to Tuition',
        categoryId: 'cat-gold',
        bookedByUsername: 'bas',
        bookedByName: 'Bas',
        notes: 'VIP Front Row Center',
        bookedAt: new Date(Date.now() - 7200000).toISOString(),
      }
    };
  });

  // Mode and View State
  const [mode, setMode] = useState<'BOOKING' | 'CATEGORY'>('BOOKING');
  const [view, setView] = useState<'SEATING' | 'MANIFEST' | 'ACTIVITIES'>('SEATING');

  // 1. DEFAULT ZOOM CHANGED FROM 60% TO 50%
  const [zoom, setZoom] = useState<number>(0.5);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());

  // Multi-Selection (Sweep / Drag) State for Category Assignment Mode
  const [sweepSelectActive, setSweepSelectActive] = useState<boolean>(false);
  const isMouseDownRef = useRef<boolean>(false);
  const dragActionRef = useRef<'add' | 'remove'>('add');

  // Track global mouse up to stop drag selection anywhere on the window
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isMouseDownRef.current = false;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // SEAT THEME: Dark Theme vs Light Theme (Default: Light Mode)
  const [seatTheme, setSeatTheme] = useState<'dark' | 'light'>('light');

  // Export PNG state
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  const seatingMapRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Formatted timestamp for exported image banner
  const [exportTimestamp, setExportTimestamp] = useState(() => {
    const now = new Date();
    return `as of ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  });

  // Booking Form State
  const [patronName, setPatronName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Charge to Tuition' | 'Payroll' | 'Cash' | 'Online Payment' | 'Complimentary'>('Charge to Tuition');
  const [studentId, setStudentId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [onlineGCash, setOnlineGCash] = useState(false);
  const [onlineOtherBanks, setOnlineOtherBanks] = useState(false);
  const [proofOfPaymentFile, setProofOfPaymentFile] = useState<{
    name: string;
    size: string;
    originalSize?: string;
    type: string;
    dataUrl?: string;
  } | null>(null);
  const [isCompressingReceipt, setIsCompressingReceipt] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const originalKb = (file.size / 1024).toFixed(1);

    setIsCompressingReceipt(true);
    try {
      const { dataUrl, compressedSizeKb } = await compressReceiptImage(file);
      setProofOfPaymentFile({
        name: file.name,
        size: `${compressedSizeKb} KB`,
        originalSize: `${originalKb} KB`,
        type: file.type || 'image/jpeg',
        dataUrl,
      });
      showToast(`Proof of payment attached & compressed to ${compressedSizeKb} KB!`, 'success');
    } catch (err) {
      console.error('Failed to compress receipt image', err);
      showToast('Could not process this file. Please choose an image receipt.', 'error');
    } finally {
      setIsCompressingReceipt(false);
    }
  };

  // Modals State
  const [inspectSeatId, setInspectSeatId] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Booking | null>(null);
  const [uploadingReceiptSeatId, setUploadingReceiptSeatId] = useState<string | null>(null);
  const [uploadModalBooking, setUploadModalBooking] = useState<Booking | null>(null);
  const [modalReceiptPreview, setModalReceiptPreview] = useState<{
    dataUrl: string;
    fileName: string;
    fileSizeKb: number;
    originalKb: string;
  } | null>(null);
  const [isModalCompressing, setIsModalCompressing] = useState(false);
  const [isModalDragging, setIsModalDragging] = useState(false);
  const [isEditShowsModalOpen, setIsEditShowsModalOpen] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<'SHOWS' | 'CATEGORIES'>('SHOWS');

  // Edit/Add Show Form in Modal
  const [editingShowId, setEditingShowId] = useState<string | null>(null);
  const [showFormTitle, setShowFormTitle] = useState('');
  const [showFormDescription, setShowFormDescription] = useState('');
  const [showFormDate, setShowFormDate] = useState('');
  const [showFormTime, setShowFormTime] = useState('');
  const [showFormType, setShowFormType] = useState<string>('Gala Season Pass');

  // Edit/Add Category Form in Modal
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormColor, setCategoryFormColor] = useState('#f59e0b');
  const [categoryFormPrice, setCategoryFormPrice] = useState('500');

  // Center View in seating blueprint (also resets zoom to 50%)
  const handleCenterView = () => {
    setZoom(0.5);
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const el = scrollContainerRef.current;
        const targetLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
        el.scrollTo({
          left: targetLeft,
          top: 0,
          behavior: 'smooth',
        });
      }
    }, 50);
    showToast('Centered view & reset zoom to 50%', 'info');
  };

  // Center view on initial load and show switch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        const el = scrollContainerRef.current;
        el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [currentShowId, zoom]);
  // Manifest Filters & Sorting
  const [manifestSearch, setManifestSearch] = useState('');
  const [manifestCategoryFilter, setManifestCategoryFilter] = useState('ALL');
  const [manifestStaffFilter, setManifestStaffFilter] = useState('ALL');
  const [manifestSortField, setManifestSortField] = useState<'seatId' | 'patronName' | 'patronId' | 'category' | 'paymentMethod' | 'bookedByName' | 'bookedAt'>('bookedAt');
  const [manifestSortDirection, setManifestSortDirection] = useState<'asc' | 'desc'>('desc');

  // Super Admin (Bas) Activities State
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityShowFilter, setActivityShowFilter] = useState('ALL');
  const [activityStaffFilter, setActivityStaffFilter] = useState('ALL');
  const [activityTypeFilter, setActivityTypeFilter] = useState('ALL');

  // Toast State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Test Firestore connection on boot
  useEffect(() => {
    testConnection();
  }, []);

  // Real-time synchronization for Shows
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shows'), (snapshot) => {
      if (snapshot.empty) {
        // Seed default shows to Firestore
        DEFAULT_SHOWS.forEach(s => {
          setDoc(doc(db, 'shows', s.id), s).catch(err =>
            handleFirestoreError(err, OperationType.WRITE, `shows/${s.id}`)
          );
        });
        setShows(DEFAULT_SHOWS);
      } else {
        const loaded: Show[] = [];
        snapshot.forEach(d => loaded.push(d.data() as Show));
        setShows(loaded);
        if (!loaded.some(s => s.id === currentShowId) && loaded.length > 0) {
          setCurrentShowId(loaded[0].id);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shows');
    });
    return () => unsub();
  }, []);

  // Real-time synchronization for Seat Categories and Pricing
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
      if (snapshot.empty) {
        DEFAULT_CATEGORIES.forEach(c => {
          setDoc(doc(db, 'categories', c.id), c).catch(err =>
            handleFirestoreError(err, OperationType.WRITE, `categories/${c.id}`)
          );
        });
        setCategories(DEFAULT_CATEGORIES);
      } else {
        const loaded: SeatCategory[] = [];
        snapshot.forEach(d => loaded.push(d.data() as SeatCategory));
        setCategories(loaded);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });
    return () => unsub();
  }, []);

  // Real-time synchronization for Gate Admin Users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      if (snapshot.empty) {
        DEFAULT_USERS.forEach(u => {
          setDoc(doc(db, 'users', u.username.toLowerCase()), u).catch(err =>
            handleFirestoreError(err, OperationType.WRITE, `users/${u.username}`)
          );
        });
        setUsers(DEFAULT_USERS);
      } else {
        const loaded: GateUser[] = [];
        snapshot.forEach(d => loaded.push(d.data() as GateUser));
        if (!loaded.some(u => u.username.toLowerCase() === 'bas')) {
          const bas = { username: 'bas', name: 'Bas', isSuperAdmin: true, createdAt: new Date().toISOString() };
          setDoc(doc(db, 'users', 'bas'), bas).catch(err =>
            handleFirestoreError(err, OperationType.WRITE, 'users/bas')
          );
          loaded.unshift(bas);
        }
        setUsers(loaded);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsub();
  }, []);

  // Real-time synchronization for Bookings of currentShowId
  useEffect(() => {
    if (!currentShowId) return;
    const unsub = onSnapshot(collection(db, 'shows', currentShowId, 'bookings'), (snapshot) => {
      const loaded: Record<string, Booking> = {};
      snapshot.forEach(d => {
        const b = d.data() as Booking;
        loaded[b.seatId] = b;
      });
      setBookings(loaded);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `shows/${currentShowId}/bookings`);
    });
    return () => unsub();
  }, [currentShowId]);

  // Real-time synchronization for Seat Category assignments of currentShowId
  useEffect(() => {
    if (!currentShowId) return;
    const unsub = onSnapshot(collection(db, 'shows', currentShowId, 'seatCategories'), (snapshot) => {
      const initial: Record<string, string> = {};
      ALL_SEATS_LIST.forEach(id => {
        initial[id] = getDefaultCategoryId(id);
      });
      snapshot.forEach(d => {
        const data = d.data() as { seatId: string; categoryId: string };
        if (data.seatId && data.categoryId) {
          initial[data.seatId] = data.categoryId;
        }
      });
      setSeatCategoryMap(initial);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `shows/${currentShowId}/seatCategories`);
    });
    return () => unsub();
  }, [currentShowId]);

  // Real-time synchronization for Activities (Audit log for Bas)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'activities'), (snapshot) => {
      const list: ActivityLog[] = [];
      snapshot.forEach(d => {
        list.push(d.data() as ActivityLog);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(list);
    }, (error) => {
      console.warn('Activities listener note:', error);
    });
    return () => unsub();
  }, []);

  // Helper to log system activity
  const logActivity = async (
    type: 'BOOKING' | 'CANCELLATION' | 'SHOW_UPDATE' | 'CATEGORY_UPDATE' | 'RECEIPT_UPLOAD',
    description: string,
    meta?: {
      showId?: string;
      showName?: string;
      seatIds?: string[];
      patronName?: string;
      paymentMethod?: string;
      details?: string;
    }
  ) => {
    try {
      const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const showObj = shows.find(s => s.id === (meta?.showId || currentShowId));
      const activityData: ActivityLog = {
        id: actId,
        type,
        description,
        showId: meta?.showId || currentShowId,
        showName: meta?.showName || showObj?.title || 'Current Show',
        seatIds: meta?.seatIds || [],
        patronName: meta?.patronName,
        paymentMethod: meta?.paymentMethod,
        performedByUsername: currentUser?.username || 'bas',
        performedByName: currentUser?.name || 'Bas',
        timestamp: new Date().toISOString(),
        details: meta?.details,
      };
      await setDoc(doc(db, 'activities', actId), activityData);
    } catch (err) {
      console.error('Failed to log activity in Firestore:', err);
    }
  };

  // Sync state to local storage as client-side offline cache
  useEffect(() => {
    localStorage.setItem('sucac_gate_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('auditorium_shows', JSON.stringify(shows));
  }, [shows]);

  useEffect(() => {
    localStorage.setItem('auditorium_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(`auditorium_bookings_${currentShowId}`, JSON.stringify(bookings));
  }, [bookings, currentShowId]);

  useEffect(() => {
    localStorage.setItem(`auditorium_seat_categories_${currentShowId}`, JSON.stringify(seatCategoryMap));
  }, [seatCategoryMap, currentShowId]);

  // GATEWALL LOGIN HANDLER
  const handleGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = gateInput.trim();
    if (!trimmed) return;

    const matched = users.find(u => u.username.toLowerCase() === trimmed.toLowerCase());
    if (matched) {
      setCurrentUser(matched);
      localStorage.setItem('sucac_active_user', JSON.stringify(matched));
      setGateInput('');
      setGateError('');
      showToast(`Welcome, ${matched.name}!`, 'success');
    } else {
      setGateError('Incorrect access key. Please try again.');
      setGateInput('');
    }
  };

  // LOGOUT HANDLER
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sucac_active_user');
    setGateInput('');
    setGateError('');
    showToast('Logged out. Gatewall locked.', 'info');
  };

  // SUPER ADMIN USER MANAGEMENT HANDLERS (Bas only)
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newUserName.trim()) {
      showToast('Username and Name are required.', 'error');
      return;
    }
    const cleanUsername = newUsername.trim().toLowerCase();
    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      showToast(`Username "${cleanUsername}" is already taken.`, 'error');
      return;
    }

    const newUser: GateUser = {
      username: cleanUsername,
      name: newUserName.trim(),
      isSuperAdmin: false,
      createdAt: new Date().toISOString(),
    };

    setUsers(prev => [...prev, newUser]);
    setNewUsername('');
    setNewUserName('');
    try {
      await setDoc(doc(db, 'users', cleanUsername), newUser);
      showToast(`User "${newUser.name}" (@${newUser.username}) added & synced across all admins!`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${cleanUsername}`);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username.toLowerCase() === 'bas') {
      showToast('Cannot delete Super Admin account "bas".', 'error');
      return;
    }
    setUsers(prev => prev.filter(u => u.username.toLowerCase() !== username.toLowerCase()));
    try {
      await deleteDoc(doc(db, 'users', username.toLowerCase()));
      showToast('User account removed from database.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${username}`);
    }
  };

  const handleStartEditUser = (user: GateUser) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserUsername(user.username);
  };

  const handleCancelEditUser = () => {
    setEditingUser(null);
    setEditUserName('');
    setEditUserUsername('');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const trimmedName = editUserName.trim();
    const cleanNewUsername = editUserUsername.trim().toLowerCase();

    if (!trimmedName || !cleanNewUsername) {
      showToast('Full Name and Username are required.', 'error');
      return;
    }

    const oldUsername = editingUser.username.toLowerCase();

    // Check if new username conflicts with an existing different user
    if (
      cleanNewUsername !== oldUsername &&
      users.some(u => u.username.toLowerCase() === cleanNewUsername)
    ) {
      showToast(`Username "${cleanNewUsername}" is already taken by another user.`, 'error');
      return;
    }

    const updatedUser: GateUser = {
      ...editingUser,
      username: cleanNewUsername,
      name: trimmedName,
    };

    // Update local state immediately
    setUsers(prev =>
      prev.map(u => (u.username.toLowerCase() === oldUsername ? updatedUser : u))
    );

    // If currently logged-in user is being modified, update active user session
    if (currentUser && currentUser.username.toLowerCase() === oldUsername) {
      setCurrentUser(updatedUser);
      localStorage.setItem('sucac_active_user', JSON.stringify(updatedUser));
    }

    try {
      if (cleanNewUsername !== oldUsername) {
        // Username changed: write to new document ID and delete old document ID in Firestore
        await setDoc(doc(db, 'users', cleanNewUsername), updatedUser);
        await deleteDoc(doc(db, 'users', oldUsername));
      } else {
        // Only display name changed: update existing document
        await setDoc(doc(db, 'users', cleanNewUsername), updatedUser);
      }
      showToast(`User "${updatedUser.name}" (@${updatedUser.username}) updated & synced!`, 'success');
      handleCancelEditUser();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${cleanNewUsername}`);
    }
  };

  // Metrics
  const totalSeatsCount = ALL_SEATS_LIST.length;
  const bookedSeatsCount = Object.keys(bookings).length;
  const availableSeatsCount = Math.max(0, totalSeatsCount - bookedSeatsCount);

  // Total price of selected seats
  const selectedTotalPrice = useMemo(() => {
    let total = 0;
    selectedSeats.forEach(seatId => {
      const catId = seatCategoryMap[seatId] || getDefaultCategoryId(seatId);
      const cat = categories.find(c => c.id === catId);
      total += cat?.price || 0;
    });
    return total;
  }, [selectedSeats, seatCategoryMap, categories]);

  // Seat Click Handler (for booking mode)
  const handleSeatClick = (seatId: string) => {
    if (mode === 'BOOKING') {
      if (bookings[seatId]) {
        setInspectSeatId(seatId);
        return;
      }
      setSelectedSeats(prev => {
        const next = new Set(prev);
        if (next.has(seatId)) next.delete(seatId);
        else next.add(seatId);
        return next;
      });
    } else {
      setSelectedSeats(prev => {
        const next = new Set(prev);
        if (next.has(seatId)) next.delete(seatId);
        else next.add(seatId);
        return next;
      });
    }
  };

  // Seat Mouse Down Handler (Handles initial click and initiates drag selection in Category mode)
  const handleSeatMouseDown = (seatId: string) => {
    isMouseDownRef.current = true;
    if (mode === 'CATEGORY') {
      setSelectedSeats(prev => {
        const next = new Set(prev);
        if (next.has(seatId)) {
          dragActionRef.current = 'remove';
          next.delete(seatId);
        } else {
          dragActionRef.current = 'add';
          next.add(seatId);
        }
        return next;
      });
    }
  };

  // Seat Mouse Enter Handler (for drag selection or sweep/brush selection in Category mode)
  const handleSeatMouseEnter = (seatId: string) => {
    if (mode === 'CATEGORY') {
      // 1. If Sweep/Brush select mode is ON, simply entering the seat selects it!
      if (sweepSelectActive) {
        setSelectedSeats(prev => {
          if (prev.has(seatId)) return prev;
          const next = new Set(prev);
          next.add(seatId);
          return next;
        });
        return;
      }

      // 2. If mouse is pressed down and dragging:
      if (isMouseDownRef.current) {
        setSelectedSeats(prev => {
          if (dragActionRef.current === 'add') {
            if (prev.has(seatId)) return prev;
            const next = new Set(prev);
            next.add(seatId);
            return next;
          } else {
            if (!prev.has(seatId)) return prev;
            const next = new Set(prev);
            next.delete(seatId);
            return next;
          }
        });
      }
    }
  };

  // Quick Batch Selection Helpers for Category Assignment Mode
  const selectAllSeats = () => {
    setSelectedSeats(new Set(ALL_SEATS_LIST));
    showToast(`Selected all ${ALL_SEATS_LIST.length} seats.`, 'info');
  };

  const selectUpperTier = () => {
    const upperSeats = ALL_SEATS_LIST.filter(id => 'LMNOPQRSTUVW'.includes(id.charAt(0)));
    setSelectedSeats(prev => {
      const next = new Set(prev);
      upperSeats.forEach(id => next.add(id));
      return next;
    });
    showToast(`Selected Upper Balcony seats (${upperSeats.length}).`, 'info');
  };

  const selectLowerTier = () => {
    const lowerSeats = ALL_SEATS_LIST.filter(id => 'ABCDEFGHIJK'.includes(id.charAt(0)));
    setSelectedSeats(prev => {
      const next = new Set(prev);
      lowerSeats.forEach(id => next.add(id));
      return next;
    });
    showToast(`Selected Lower Orchestra seats (${lowerSeats.length}).`, 'info');
  };

  const invertSelection = () => {
    setSelectedSeats(prev => {
      const next = new Set<string>();
      ALL_SEATS_LIST.forEach(id => {
        if (!prev.has(id)) next.add(id);
      });
      return next;
    });
    showToast('Inverted seat selection.', 'info');
  };

  // Toggle Entire Row Selection
  const toggleRow = (rowLetter: string) => {
    const seatsInRow = ALL_SEATS_LIST.filter(id => id.startsWith(`${rowLetter}-`));
    if (mode === 'BOOKING') {
      const availableInRow = seatsInRow.filter(id => !bookings[id]);
      const allSelected = availableInRow.length > 0 && availableInRow.every(id => selectedSeats.has(id));
      setSelectedSeats(prev => {
        const next = new Set(prev);
        if (allSelected) {
          availableInRow.forEach(id => next.delete(id));
        } else {
          availableInRow.forEach(id => next.add(id));
        }
        return next;
      });
    } else {
      const allSelected = seatsInRow.every(id => selectedSeats.has(id));
      setSelectedSeats(prev => {
        const next = new Set(prev);
        if (allSelected) {
          seatsInRow.forEach(id => next.delete(id));
        } else {
          seatsInRow.forEach(id => next.add(id));
        }
        return next;
      });
    }
  };

  // Assign category to selected seats
  const assignCategoryToSelected = async (catId: string) => {
    if (selectedSeats.size === 0) {
      showToast('Select seats or row letters first to apply a category.', 'info');
      return;
    }
    const targetCat = categories.find(c => c.id === catId);
    setSeatCategoryMap(prev => {
      const next = { ...prev };
      selectedSeats.forEach(s => {
        next[s] = catId;
      });
      return next;
    });

    try {
      const batch = writeBatch(db);
      selectedSeats.forEach(s => {
        batch.set(doc(db, 'shows', currentShowId, 'seatCategories', s), { seatId: s, categoryId: catId });
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shows/${currentShowId}/seatCategories`);
    }

    showToast(`Assigned ${targetCat?.name || 'Category'} (₱${(targetCat?.price || 0).toLocaleString()}) to ${selectedSeats.size} seat(s)!`, 'success');
    setSelectedSeats(new Set());
  };

  // Booking Submission (Secretly records who booked & syncs real-time to Firestore!)
  const handleBookSelected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeats.size === 0) {
      showToast('Please select at least one seat to book.', 'error');
      return;
    }
    if (!patronName.trim()) {
      showToast('Patron name is required.', 'error');
      return;
    }

    let computedPatronId = '';
    if (paymentMethod === 'Charge to Tuition') {
      if (!studentId.trim()) {
        showToast('Student ID Number is required for Charge to Tuition.', 'error');
        return;
      }
      computedPatronId = studentId.trim();
    } else if (paymentMethod === 'Payroll') {
      if (!staffId.trim()) {
        showToast('Staff ID Number is required for Payroll deduction.', 'error');
        return;
      }
      computedPatronId = staffId.trim();
    } else if (paymentMethod === 'Cash') {
      computedPatronId = 'Cash / Walk-in';
    } else if (paymentMethod === 'Complimentary') {
      computedPatronId = 'Complimentary / VIP';
    } else if (paymentMethod === 'Online Payment') {
      const channels: string[] = [];
      if (onlineGCash) channels.push('GCash');
      if (onlineOtherBanks) channels.push('Other Banks');
      computedPatronId = channels.length > 0 ? channels.join(', ') : 'Online Payment';
    }

    const noteDetails: string[] = [];
    if (paymentMethod === 'Online Payment') {
      const channels: string[] = [];
      if (onlineGCash) channels.push('GCash');
      if (onlineOtherBanks) channels.push('Other Banks');
      if (channels.length > 0) noteDetails.push(`Channel: ${channels.join(', ')}`);
      if (proofOfPaymentFile) noteDetails.push(`Proof: ${proofOfPaymentFile.name} (${proofOfPaymentFile.size})`);
    }
    if (bookingNotes.trim()) {
      noteDetails.push(bookingNotes.trim());
    }
    const computedNotes = noteDetails.join(' • ');

    const timestamp = new Date().toISOString();
    const newBookingsMap = { ...bookings };
    const batch = writeBatch(db);

    selectedSeats.forEach(seatId => {
      const bookingData: Booking = {
        seatId,
        patronName: patronName.trim(),
        patronId: computedPatronId,
        paymentMethod,
        categoryId: seatCategoryMap[seatId] || getDefaultCategoryId(seatId),
        // Secretly record current logged-in user:
        bookedByUsername: currentUser?.username || 'bas',
        bookedByName: currentUser?.name || 'Bas',
        notes: computedNotes || '',
        bookedAt: timestamp,
      };

      if (paymentMethod === 'Online Payment' && proofOfPaymentFile?.dataUrl) {
        bookingData.proofOfPaymentData = proofOfPaymentFile.dataUrl;
        bookingData.proofOfPaymentName = proofOfPaymentFile.name;
      }

      newBookingsMap[seatId] = bookingData;
      batch.set(doc(db, 'shows', currentShowId, 'bookings', seatId), bookingData);
    });

    setBookings(newBookingsMap);

    try {
      await batch.commit();
      showToast(`Successfully booked and synced ${selectedSeats.size} seat(s) for ${patronName}!`, 'success');
      const bookedSeatsArray = Array.from(selectedSeats);
      const activeShow = shows.find(s => s.id === currentShowId);
      logActivity(
        'BOOKING',
        `Seat ${bookedSeatsArray.join(', ')} booked in "${activeShow?.title || 'Show'}" for ${patronName.trim()} by ${currentUser?.name || 'Bas'} (${paymentMethod})`,
        {
          showId: currentShowId,
          showName: activeShow?.title || 'Current Show',
          seatIds: bookedSeatsArray,
          patronName: patronName.trim(),
          paymentMethod: paymentMethod,
          details: computedNotes || undefined,
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shows/${currentShowId}/bookings`);
    }

    setSelectedSeats(new Set());
    setPatronName('');
    setStudentId('');
    setStaffId('');
    setOnlineGCash(false);
    setOnlineOtherBanks(false);
    setProofOfPaymentFile(null);
    setBookingNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Release Seat
  const handleReleaseSeat = async (seatId: string) => {
    const bookedItem = bookings[seatId];
    setBookings(prev => {
      const next = { ...prev };
      delete next[seatId];
      return next;
    });
    setInspectSeatId(null);

    try {
      await deleteDoc(doc(db, 'shows', currentShowId, 'bookings', seatId));
      showToast(`Released seat ${seatId} back to inventory and synced.`, 'info');
      const activeShow = shows.find(s => s.id === currentShowId);
      logActivity(
        'CANCELLATION',
        `Seat ${seatId} booking ${bookedItem ? `for ${bookedItem.patronName}` : ''} in "${activeShow?.title || 'Show'}" was released/cancelled by ${currentUser?.name || 'Bas'}`,
        {
          showId: currentShowId,
          showName: activeShow?.title || 'Current Show',
          seatIds: [seatId],
          patronName: bookedItem?.patronName,
          paymentMethod: bookedItem?.paymentMethod,
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shows/${currentShowId}/bookings/${seatId}`);
    }
  };

  // SHOW MANAGEMENT FUNCTIONS
  const handleSaveShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFormTitle.trim() || !showFormDate || !showFormTime.trim()) {
      showToast('Please fill out all show details.', 'error');
      return;
    }

    let targetShow: Show;
    if (editingShowId) {
      targetShow = {
        id: editingShowId,
        title: showFormTitle.trim(),
        description: showFormDescription.trim() || '',
        date: showFormDate,
        time: showFormTime.trim(),
        type: showFormType,
      };
      setShows(prev => prev.map(s => s.id === editingShowId ? targetShow : s));
      showToast('Show schedule updated & synced!', 'success');
    } else {
      const newId = `show-${Date.now()}`;
      targetShow = {
        id: newId,
        title: showFormTitle.trim(),
        description: showFormDescription.trim() || '',
        date: showFormDate,
        time: showFormTime.trim(),
        type: showFormType,
      };
      setShows(prev => [...prev, targetShow]);
      setCurrentShowId(newId);
      showToast(`Added new show "${targetShow.title}" & synced!`, 'success');
    }

    try {
      await setDoc(doc(db, 'shows', targetShow.id), targetShow);
      logActivity(
        'SHOW_UPDATE',
        `Show "${targetShow.title}" (${targetShow.time}) was ${editingShowId ? 'updated' : 'created'} by ${currentUser?.name || 'Bas'}`,
        {
          showId: targetShow.id,
          showName: targetShow.title,
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shows/${targetShow.id}`);
    }

    setEditingShowId(null);
    setShowFormTitle('');
    setShowFormDescription('');
    setShowFormDate('');
    setShowFormTime('');
    setShowFormType('Gala Season Pass');
  };

  const handleStartEditShow = (show: Show) => {
    setEditingShowId(show.id);
    setShowFormTitle(show.title);
    setShowFormDescription(show.description || '');
    setShowFormDate(show.date);
    setShowFormTime(show.time);
    setShowFormType(show.type);
  };

  const handleDeleteShow = async (id: string) => {
    if (shows.length <= 1) {
      showToast('Cannot delete the only remaining show.', 'error');
      return;
    }
    const target = shows.find(s => s.id === id);
    if (!confirm(`Delete show "${target?.title}"? All bookings for this show will be removed.`)) return;

    setShows(prev => prev.filter(s => s.id !== id));
    if (currentShowId === id) {
      const next = shows.find(s => s.id !== id);
      if (next) setCurrentShowId(next.id);
    }

    try {
      await deleteDoc(doc(db, 'shows', id));
      showToast('Show deleted from Firestore.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shows/${id}`);
    }
  };

  // CATEGORY MANAGEMENT FUNCTIONS
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormName.trim()) {
      showToast('Category name is required.', 'error');
      return;
    }
    const priceNum = Math.max(0, parseInt(categoryFormPrice) || 0);

    let targetCat: SeatCategory;
    if (editingCategoryId) {
      targetCat = {
        id: editingCategoryId,
        name: categoryFormName.trim(),
        color: categoryFormColor,
        price: priceNum,
      };
      setCategories(prev => prev.map(c => c.id === editingCategoryId ? targetCat : c));
      showToast('Category updated & synced!', 'success');
    } else {
      const newId = `cat-${Date.now()}`;
      targetCat = {
        id: newId,
        name: categoryFormName.trim(),
        color: categoryFormColor,
        price: priceNum,
      };
      setCategories(prev => [...prev, targetCat]);
      showToast(`Added new category "${targetCat.name}" (₱${priceNum.toLocaleString()}) & synced!`, 'success');
    }

    try {
      await setDoc(doc(db, 'categories', targetCat.id), targetCat);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `categories/${targetCat.id}`);
    }

    setEditingCategoryId(null);
    setCategoryFormName('');
    setCategoryFormColor('#f59e0b');
    setCategoryFormPrice('500');
  };

  const handleStartEditCategory = (cat: SeatCategory) => {
    setEditingCategoryId(cat.id);
    setCategoryFormName(cat.name);
    setCategoryFormColor(cat.color);
    setCategoryFormPrice(cat.price ? String(cat.price) : '0');
  };

  const handleDeleteCategory = async (catId: string) => {
    if (categories.length <= 1) {
      showToast('Cannot delete the only remaining category.', 'error');
      return;
    }
    const cat = categories.find(c => c.id === catId);
    if (!confirm(`Delete category "${cat?.name}"?`)) return;

    const fallbackCatId = categories.find(c => c.id !== catId)!.id;
    setCategories(prev => prev.filter(c => c.id !== catId));
    setSeatCategoryMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(seatId => {
        if (next[seatId] === catId) next[seatId] = fallbackCatId;
      });
      return next;
    });

    try {
      await deleteDoc(doc(db, 'categories', catId));
      showToast(`Category "${cat?.name}" removed from Firestore.`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${catId}`);
    }
  };

  // CSV Export
  const exportCSV = () => {
    const list = Object.values(bookings);
    if (list.length === 0) {
      showToast('No bookings recorded for this show yet.', 'info');
      return;
    }
    list.sort((a, b) => a.seatId.localeCompare(b.seatId, undefined, { numeric: true }));
    
    // Only Bas gets the staff attribution column in CSV!
    const headers = currentUser?.isSuperAdmin
      ? ['Show ID', 'Seat Number', 'Patron Name', 'ID Number', 'Category / Section', 'Ticket Price', 'Payment Channel', 'Proof Receipt Attached', 'Booked By Staff', 'Notes', 'Booked At']
      : ['Show ID', 'Seat Number', 'Patron Name', 'ID Number', 'Category / Section', 'Ticket Price', 'Payment Channel', 'Proof Receipt Attached', 'Notes', 'Booked At'];

    const rows = [headers.join(',')];
    list.forEach(item => {
      const cat = categories.find(c => c.id === item.categoryId);
      const rowData = [
        `"${currentShowId}"`,
        `"${item.seatId}"`,
        `"${item.patronName.replace(/"/g, '""')}"`,
        `"${item.patronId.replace(/"/g, '""')}"`,
        `"${cat?.name || 'Standard'}"`,
        `"₱${(cat?.price || 0).toLocaleString()}"`,
        `"${item.paymentMethod.replace(/"/g, '""')}"`,
        `"${item.proofOfPaymentData ? (item.proofOfPaymentName ? `Yes (${item.proofOfPaymentName})` : 'Yes (Receipt Attached)') : 'No'}"`,
      ];
      if (currentUser?.isSuperAdmin) {
        rowData.push(`"${item.bookedByName || 'Bas'} (@${item.bookedByUsername || 'bas'})"`);
      }
      rowData.push(`"${(item.notes || '').replace(/"/g, '""')}"`);
      rowData.push(`"${item.bookedAt}"`);
      rows.push(rowData.join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SUCAC_Manifest_${currentShowId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${list.length} booked seats to CSV!`, 'success');
  };

  const activeShowObj = shows.find(s => s.id === currentShowId) || shows[0];

  // EXPORT SEAT LAYOUT ONLY AS PNG
  const exportSeatLayoutPNG = async () => {
    if (!seatingMapRef.current) return;
    try {
      setIsExportingPNG(true);
      showToast('Rendering PNG of seat layout...', 'info');

      // Update timestamp right before snapshot (no seconds)
      const now = new Date();
      const formattedTimestamp = `as of ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
      setExportTimestamp(formattedTimestamp);

      // Allow DOM to repaint updated timestamp before capture
      await new Promise(resolve => setTimeout(resolve, 80));

      const cleanTitle = (activeShowObj.title || 'Show').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const filename = `${cleanTitle}_${dateStr}_${timeStr}.png`;

      const dataUrl = await toPng(seatingMapRef.current, {
        pixelRatio: 2,
        backgroundColor: seatTheme === 'light' ? '#ffffff' : '#020617',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top center',
        },
      });

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      showToast(`Exported seat layout PNG: ${filename}`, 'success');
    } catch (err) {
      console.error('Failed to export seat layout as PNG:', err);
      showToast('Failed to export seat layout PNG. Please try again.', 'error');
    } finally {
      setIsExportingPNG(false);
    }
  };

  // Column Header Sort Toggle for Gate Manifest
  const handleManifestSort = (field: 'seatId' | 'patronName' | 'patronId' | 'category' | 'paymentMethod' | 'bookedByName' | 'bookedAt') => {
    if (manifestSortField === field) {
      setManifestSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setManifestSortField(field);
      // For timestamps, default to descending (latest first); for others default to ascending
      if (field === 'bookedAt' || field === 'category') {
        setManifestSortDirection('desc');
      } else {
        setManifestSortDirection('asc');
      }
    }
  };

  // Filtered & Sorted Manifest Bookings (with sequence sorting by bookedAt, seat, name, etc.)
  const manifestList = useMemo(() => {
    let list = Object.values(bookings);
    if (manifestCategoryFilter !== 'ALL') {
      list = list.filter(b => b.categoryId === manifestCategoryFilter);
    }
    if (currentUser?.isSuperAdmin && manifestStaffFilter !== 'ALL') {
      list = list.filter(b => (b.bookedByUsername || 'bas') === manifestStaffFilter);
    }
    if (manifestSearch.trim()) {
      const q = manifestSearch.toLowerCase().trim();
      list = list.filter(b =>
        b.patronName.toLowerCase().includes(q) ||
        b.patronId.toLowerCase().includes(q) ||
        b.seatId.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q)) ||
        (currentUser?.isSuperAdmin && b.bookedByName && b.bookedByName.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      let comparison = 0;
      if (manifestSortField === 'seatId') {
        comparison = a.seatId.localeCompare(b.seatId, undefined, { numeric: true });
      } else if (manifestSortField === 'patronName') {
        comparison = (a.patronName || '').localeCompare(b.patronName || '');
      } else if (manifestSortField === 'patronId') {
        comparison = (a.patronId || '').localeCompare(b.patronId || '', undefined, { numeric: true });
      } else if (manifestSortField === 'category') {
        const catA = categories.find(c => c.id === a.categoryId)?.price || 0;
        const catB = categories.find(c => c.id === b.categoryId)?.price || 0;
        comparison = catA - catB;
      } else if (manifestSortField === 'paymentMethod') {
        comparison = (a.paymentMethod || '').localeCompare(b.paymentMethod || '');
      } else if (manifestSortField === 'bookedByName') {
        comparison = (a.bookedByName || '').localeCompare(b.bookedByName || '');
      } else if (manifestSortField === 'bookedAt') {
        const timeA = a.bookedAt ? new Date(a.bookedAt).getTime() : 0;
        const timeB = b.bookedAt ? new Date(b.bookedAt).getTime() : 0;
        comparison = timeA - timeB;
      }

      return manifestSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [bookings, manifestCategoryFilter, manifestStaffFilter, manifestSearch, currentUser, manifestSortField, manifestSortDirection, categories]);

  // Combined Activities for Super Admin Bas
  const allActivities = useMemo(() => {
    const list: ActivityLog[] = [...activities];

    // Synthesize entries from current show bookings so Bas immediately has full history even before new activities are logged
    Object.values(bookings).forEach(b => {
      const exists = list.some(a => 
        a.type === 'BOOKING' && 
        a.seatIds?.includes(b.seatId) && 
        Math.abs(new Date(a.timestamp).getTime() - new Date(b.bookedAt).getTime()) < 5000
      );
      if (!exists && b.bookedAt) {
        list.push({
          id: `synth_${b.seatId}_${b.bookedAt}`,
          type: 'BOOKING',
          description: `Seat ${b.seatId} booked in "${activeShowObj.title}" for ${b.patronName} (${b.paymentMethod}) by ${b.bookedByName || 'Bas'}`,
          showId: currentShowId,
          showName: activeShowObj.title,
          seatIds: [b.seatId],
          patronName: b.patronName,
          paymentMethod: b.paymentMethod,
          performedByUsername: b.bookedByUsername || 'bas',
          performedByName: b.bookedByName || 'Bas',
          timestamp: b.bookedAt,
          details: b.notes || undefined,
        });
      }
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, bookings, currentShowId, activeShowObj]);

  // Filtered Activities for Super Admin Bas
  const filteredActivities = useMemo(() => {
    let list = [...allActivities];
    if (activityShowFilter !== 'ALL') {
      list = list.filter(a => a.showId === activityShowFilter);
    }
    if (activityStaffFilter !== 'ALL') {
      list = list.filter(a => (a.performedByUsername || 'bas') === activityStaffFilter);
    }
    if (activityTypeFilter !== 'ALL') {
      list = list.filter(a => a.type === activityTypeFilter);
    }
    if (activitySearch.trim()) {
      const q = activitySearch.toLowerCase().trim();
      list = list.filter(a =>
        a.description.toLowerCase().includes(q) ||
        (a.showName && a.showName.toLowerCase().includes(q)) ||
        (a.performedByName && a.performedByName.toLowerCase().includes(q)) ||
        (a.patronName && a.patronName.toLowerCase().includes(q)) ||
        (a.seatIds && a.seatIds.some(s => s.toLowerCase().includes(q))) ||
        (a.paymentMethod && a.paymentMethod.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allActivities, activityShowFilter, activityStaffFilter, activityTypeFilter, activitySearch]);

  // Export Activities to CSV
  const exportActivitiesCSV = () => {
    if (filteredActivities.length === 0) {
      showToast('No activities found to export.', 'info');
      return;
    }
    const headers = ['Activity ID', 'Timestamp', 'Type', 'Show Name', 'Seats', 'Patron Name', 'Payment Method', 'Booked / Performed By (Name)', 'Username', 'Description', 'Notes / Details'];
    const rows = [headers.join(',')];
    filteredActivities.forEach(act => {
      rows.push([
        `"${act.id}"`,
        `"${act.timestamp}"`,
        `"${act.type}"`,
        `"${(act.showName || '').replace(/"/g, '""')}"`,
        `"${(act.seatIds?.join('; ') || '').replace(/"/g, '""')}"`,
        `"${(act.patronName || '').replace(/"/g, '""')}"`,
        `"${(act.paymentMethod || '').replace(/"/g, '""')}"`,
        `"${(act.performedByName || '').replace(/"/g, '""')}"`,
        `"${(act.performedByUsername || '').replace(/"/g, '""')}"`,
        `"${(act.description || '').replace(/"/g, '""')}"`,
        `"${(act.details || '').replace(/"/g, '""')}"`,
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SUCAC_Activity_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredActivities.length} activity records to CSV!`, 'success');
  };

  // Helper to format human-readable relative time
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const time = new Date(isoString).getTime();
      const diffSec = Math.floor((Date.now() - time) / 1000);
      if (diffSec < 45) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return isoString;
    }
  };

  // Handle direct file upload for a booked seat in the Gate Manifest
  const handleUploadReceiptForManifestSeat = async (seatId: string, file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP).', 'error');
      return;
    }

    setUploadingReceiptSeatId(seatId);
    try {
      const originalKb = (file.size / 1024).toFixed(1);
      const { dataUrl, compressedSizeKb } = await compressReceiptImage(file);
      const existingBooking = bookings[seatId];
      if (!existingBooking) {
        showToast('Booking not found for this seat.', 'error');
        return;
      }

      const updatedBooking: Booking = {
        ...existingBooking,
        proofOfPaymentData: dataUrl,
        proofOfPaymentName: file.name,
      };

      await setDoc(doc(db, 'shows', currentShowId, 'bookings', seatId), updatedBooking, { merge: true });

      // If viewing in receipt modal, sync it
      setViewingReceipt(prev => (prev?.seatId === seatId ? updatedBooking : prev));

      showToast(`Proof of payment for Seat ${seatId} compressed to ${compressedSizeKb} KB (<300 KB) and attached!`, 'success');

      logActivity(
        'RECEIPT_UPLOAD',
        `Proof of payment uploaded for Seat ${seatId} (${existingBooking.patronName}) by ${currentUser?.name || 'Bas'}`,
        {
          showId: currentShowId,
          showName: activeShowObj.title,
          seatIds: [seatId],
          patronName: existingBooking.patronName,
          paymentMethod: existingBooking.paymentMethod,
          details: `Receipt: ${file.name} (compressed from ${originalKb} KB to ${compressedSizeKb} KB)`
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shows/${currentShowId}/bookings/${seatId}`);
      showToast('Failed to upload proof of payment. Please try again.', 'error');
    } finally {
      setUploadingReceiptSeatId(null);
    }
  };

  // Handle removing a receipt from a booking in the Gate Manifest
  const handleRemoveReceiptForManifestSeat = async (seatId: string) => {
    const existingBooking = bookings[seatId];
    if (!existingBooking) return;

    try {
      const updatedBooking: Booking = {
        ...existingBooking,
      };
      delete updatedBooking.proofOfPaymentData;
      delete updatedBooking.proofOfPaymentName;

      await setDoc(doc(db, 'shows', currentShowId, 'bookings', seatId), updatedBooking);

      setViewingReceipt(prev => (prev?.seatId === seatId ? null : prev));
      showToast(`Proof of payment removed for Seat ${seatId}.`, 'info');

      logActivity(
        'RECEIPT_UPLOAD',
        `Proof of payment removed for Seat ${seatId} (${existingBooking.patronName}) by ${currentUser?.name || 'Bas'}`,
        {
          showId: currentShowId,
          showName: activeShowObj.title,
          seatIds: [seatId],
          patronName: existingBooking.patronName,
          details: 'Receipt detached in Gate Manifest'
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shows/${currentShowId}/bookings/${seatId}`);
    }
  };

  // Modal drag-and-drop file processing
  const handleProcessModalReceiptFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (PNG, JPG, WebP).', 'error');
      return;
    }
    const originalKb = (file.size / 1024).toFixed(1);
    setIsModalCompressing(true);
    try {
      const { dataUrl, compressedSizeKb } = await compressReceiptImage(file);
      setModalReceiptPreview({
        dataUrl,
        fileName: file.name,
        fileSizeKb: compressedSizeKb,
        originalKb,
      });
      showToast(`Image compressed to ${compressedSizeKb} KB (<300 KB)! Ready to save.`, 'success');
    } catch (err) {
      console.error('Error compressing modal receipt', err);
      showToast('Could not process this file. Please choose an image receipt.', 'error');
    } finally {
      setIsModalCompressing(false);
    }
  };

  const handleSaveModalReceipt = async () => {
    if (!uploadModalBooking || !modalReceiptPreview) return;
    const seatId = uploadModalBooking.seatId;
    setUploadingReceiptSeatId(seatId);
    try {
      const existingBooking = bookings[seatId] || uploadModalBooking;
      const updatedBooking: Booking = {
        ...existingBooking,
        proofOfPaymentData: modalReceiptPreview.dataUrl,
        proofOfPaymentName: modalReceiptPreview.fileName,
      };
      await setDoc(doc(db, 'shows', currentShowId, 'bookings', seatId), updatedBooking, { merge: true });

      setViewingReceipt(prev => (prev?.seatId === seatId ? updatedBooking : prev));
      showToast(`Proof of payment saved for Seat ${seatId} (${modalReceiptPreview.fileSizeKb} KB)!`, 'success');

      logActivity(
        'RECEIPT_UPLOAD',
        `Proof of payment uploaded for Seat ${seatId} (${existingBooking.patronName}) by ${currentUser?.name || 'Bas'}`,
        {
          showId: currentShowId,
          showName: activeShowObj.title,
          seatIds: [seatId],
          patronName: existingBooking.patronName,
          paymentMethod: existingBooking.paymentMethod,
          details: `Receipt: ${modalReceiptPreview.fileName} (${modalReceiptPreview.fileSizeKb} KB)`
        }
      );

      // Close modal
      setUploadModalBooking(null);
      setModalReceiptPreview(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shows/${currentShowId}/bookings/${seatId}`);
      showToast('Failed to save proof of payment. Please try again.', 'error');
    } finally {
      setUploadingReceiptSeatId(null);
    }
  };

  // Helper to render an individual seat button
  const renderSeat = (seatId: string, seatNum: number) => {
    const isBooked = !!bookings[seatId];
    const isSelected = selectedSeats.has(seatId);
    const catId = seatCategoryMap[seatId] || getDefaultCategoryId(seatId);
    const cat = categories.find(c => c.id === catId) || categories[0];
    const catColor = cat ? cat.color : '#f59e0b';

    let colorStyle = '';
    let customInlineStyle: React.CSSProperties = {};

    if (isBooked) {
      colorStyle = 'bg-rose-600 text-white border-rose-500 shadow-md cursor-pointer font-bold';
    } else if (isSelected) {
      colorStyle = 'bg-amber-400 text-slate-950 font-black border-slate-950 ring-2 ring-amber-400 scale-110 shadow-lg z-20';
    } else {
      if (seatTheme === 'light') {
        customInlineStyle = {
          backgroundColor: `${catColor}30`,
          borderColor: catColor,
          color: '#0f172a',
          fontWeight: 800,
        };
        colorStyle = 'hover:brightness-95 hover:scale-105';
      } else {
        customInlineStyle = {
          backgroundColor: `${catColor}20`,
          borderColor: `${catColor}90`,
          color: catColor,
          fontWeight: 700,
        };
        colorStyle = 'hover:brightness-125';
      }
    }

    return (
      <button
        key={seatId}
        id={`seat-${seatId}`}
        onMouseDown={(e) => {
          if (mode === 'CATEGORY') {
            e.preventDefault();
            handleSeatMouseDown(seatId);
          }
        }}
        onMouseEnter={() => handleSeatMouseEnter(seatId)}
        onClick={() => {
          if (mode === 'BOOKING') {
            handleSeatClick(seatId);
          }
        }}
        style={customInlineStyle}
        title={isBooked ? `Booked: ${bookings[seatId].patronName} (${cat.name} • ₱${(cat.price || 0).toLocaleString()}) - Click to inspect/release` : `Seat ${seatId} • ${cat.name} (₱${(cat.price || 0).toLocaleString()})`}
        className={`seat-btn font-mono-num transition flex items-center justify-center cursor-pointer border select-none ${
          mode === 'CATEGORY' && sweepSelectActive ? 'hover:scale-110 hover:z-20 hover:ring-2 hover:ring-cyan-400' : ''
        } ${colorStyle}`}
      >
        {seatNum}
      </button>
    );
  };

  // Helper to render Upper Tier Row with EXACT 1-TO-1 ALIGNMENT
  const renderUpperRow = (cfg: TierRowConfig) => {
    const rowHoverBg = seatTheme === 'light' ? 'hover:bg-slate-200/60' : 'hover:bg-slate-800/30';
    const rowLabelText = seatTheme === 'light' ? 'text-slate-700 font-black hover:text-amber-600 hover:bg-slate-200' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800';
    const aisleCorridor = seatTheme === 'light' ? 'text-slate-300' : 'text-slate-700';

    return (
      <div
        key={`upper-${cfg.row}`}
        className={`flex items-center justify-between w-full px-4 py-1 rounded transition ${rowHoverBg}`}
      >
        <button
          onClick={() => toggleRow(cfg.row)}
          title={`Select/Deselect full Row ${cfg.row}`}
          className={`w-8 h-8 flex-shrink-0 text-[11px] font-black rounded text-center cursor-pointer transition flex items-center justify-center ${rowLabelText}`}
        >
          {cfg.row}
        </button>

        <div className="flex items-center justify-center gap-4 flex-1">
          {/* 1. Upper Left: L to W, 1-11 */}
          <div className="w-[368px] flex-shrink-0 flex gap-1.5 justify-end">
            {cfg.left && (
              Array.from({ length: cfg.left[1] - cfg.left[0] + 1 }, (_, i) => {
                const num = cfg.left![0] + i;
                return renderSeat(`${cfg.row}-${num}`, num);
              })
            )}
          </div>

          {/* Left Aisle */}
          <div className="w-6 flex-shrink-0 flex items-center justify-center">
            <span className={`text-[8px] select-none ${aisleCorridor}`}>|</span>
          </div>

          {/* 2. Upper Middle: EXACTLY 572px width */}
          <div className="w-[572px] flex-shrink-0 flex items-center justify-center">
            {cfg.center ? (
              <div className="flex gap-1.5 justify-center flex-1">
                {Array.from({ length: cfg.center[1] - cfg.center[0] + 1 }, (_, i) => {
                  const num = cfg.center![0] + i;
                  return renderSeat(`${cfg.row}-${num}`, num);
                })}
              </div>
            ) : (
              <div className="w-full h-7 flex items-center justify-center select-none" />
            )}
          </div>

          {/* Right Aisle */}
          <div className="w-6 flex-shrink-0 flex items-center justify-center">
            <span className={`text-[8px] select-none ${aisleCorridor}`}>|</span>
          </div>

          {/* 3. Upper Right: Left-aligned at the right aisle */}
          <div className="w-[368px] flex-shrink-0 flex gap-1.5 justify-start">
            {cfg.right && (
              Array.from({ length: cfg.right[1] - cfg.right[0] + 1 }, (_, i) => {
                const num = cfg.right![0] + i;
                return renderSeat(`${cfg.row}-${num}`, num);
              })
            )}
          </div>
        </div>

        <button
          onClick={() => toggleRow(cfg.row)}
          title={`Select/Deselect full Row ${cfg.row}`}
          className={`w-8 h-8 flex-shrink-0 text-[11px] font-black rounded text-center cursor-pointer transition flex items-center justify-center ${rowLabelText}`}
        >
          {cfg.row}
        </button>
      </div>
    );
  };

  // Helper to render Lower Tier Row
  const renderLowerRow = (cfg: TierRowConfig) => {
    const rowHoverBg = seatTheme === 'light' ? 'hover:bg-slate-200/60' : 'hover:bg-slate-800/30';
    const rowLabelText = seatTheme === 'light' ? 'text-slate-700 font-black hover:text-amber-600 hover:bg-slate-200' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800';
    const aisleCorridor = seatTheme === 'light' ? 'text-slate-300' : 'text-slate-700';

    return (
      <div
        key={`lower-${cfg.row}`}
        className={`flex items-center justify-between w-full px-4 py-1 rounded transition ${rowHoverBg}`}
      >
        <button
          onClick={() => toggleRow(cfg.row)}
          title={`Select/Deselect full Row ${cfg.row}`}
          className={`w-8 h-8 flex-shrink-0 text-[11px] font-black rounded text-center cursor-pointer transition flex items-center justify-center ${rowLabelText}`}
        >
          {cfg.row}
        </button>

        <div className="flex items-center justify-center gap-4 flex-1">
          <div className="w-[334px] flex-shrink-0 flex gap-1.5 justify-end">
            {cfg.left && (
              Array.from({ length: cfg.left[1] - cfg.left[0] + 1 }, (_, i) => {
                const num = cfg.left![0] + i;
                return renderSeat(`${cfg.row}-${num}`, num);
              })
            )}
          </div>

          <div className="w-6 flex-shrink-0 flex items-center justify-center">
            <span className={`text-[8px] select-none ${aisleCorridor}`}>|</span>
          </div>

          <div className="w-[538px] flex-shrink-0 flex gap-1.5 justify-center">
            {cfg.center && (
              Array.from({ length: cfg.center[1] - cfg.center[0] + 1 }, (_, i) => {
                const num = cfg.center![0] + i;
                return renderSeat(`${cfg.row}-${num}`, num);
              })
            )}
          </div>

          <div className="w-6 flex-shrink-0 flex items-center justify-center">
            <span className={`text-[8px] select-none ${aisleCorridor}`}>|</span>
          </div>

          <div className="w-[334px] flex-shrink-0 flex gap-1.5 justify-start">
            {cfg.right && (
              Array.from({ length: cfg.right[1] - cfg.right[0] + 1 }, (_, i) => {
                const num = cfg.right![0] + i;
                return renderSeat(`${cfg.row}-${num}`, num);
              })
            )}
          </div>
        </div>

        <button
          onClick={() => toggleRow(cfg.row)}
          title={`Select/Deselect full Row ${cfg.row}`}
          className={`w-8 h-8 flex-shrink-0 text-[11px] font-black rounded text-center cursor-pointer transition flex items-center justify-center ${rowLabelText}`}
        >
          {cfg.row}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 relative">

      {/* GATEWALL OVERLAY: BLOCKS ENTIRE PAGE WHEN NOT LOGGED IN */}
      {!currentUser && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
            {/* Ambient Red glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* SUCAC Logo */}
            <div className="mx-auto h-16 w-16 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xl shadow-red-500/30 border border-red-500/40 mb-4">
              <SucacLogo className="w-12 h-12" />
            </div>

            <h2 className="text-xl font-extrabold text-white tracking-tight">
              SUCAC Shows Ticket Database
            </h2>
            <p className="text-xs text-slate-400 mt-1 mb-6">
              Silliman University Culture and Arts Council - Claire Isabel McGill Luce Auditorium
            </p>

            {/* Single textbox with asterisks */}
            <form onSubmit={handleGateSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Staff Access Passcode
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoFocus
                    required
                    value={gateInput}
                    onChange={e => {
                      setGateInput(e.target.value);
                      setGateError('');
                    }}
                    placeholder="••••••"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-3 text-center text-lg text-white tracking-[0.35em] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition font-mono"
                  />
                  <KeyRound className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
                {gateError && (
                  <p className="text-xs text-rose-400 font-medium mt-2">
                    {gateError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/25 cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify & Unlock Database</span>
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800 text-[11px] text-slate-500">
              Authorized Personnel & Ticketing Staff Only
            </div>
          </div>
        </div>
      )}

      {/* HEADER BAR */}
      <header className="no-print bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-8 py-3 shadow-xl backdrop-blur-md bg-opacity-95">
        <div className="max-w-[1650px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {/* SUCAC TRIANGLE LOGO */}
            <div className="h-10 w-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-lg shadow-red-500/25 border border-red-500/30 flex-shrink-0 group hover:scale-105 transition">
              <SucacLogo className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base tracking-wide text-white">
                  SUCAC Shows Ticket Database
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE SYNC
                </span>
              </div>
              {/* SUBTITLE (CSS selector 1 focused) */}
              <p className="text-xs text-slate-400 font-medium">
                Silliman University Culture and Arts Council - Claire Isabel McGill Luce Auditorium
              </p>
            </div>
          </div>

          {/* Action items, Show picker, User badge, and Logout */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Show Selector */}
            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-1 shadow-inner">
              <span className="text-xs font-medium text-slate-400 px-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Show:
              </span>
              <select
                value={currentShowId}
                onChange={e => setCurrentShowId(e.target.value)}
                className="bg-slate-900 text-slate-100 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {shows.map(show => (
                  <option key={show.id} value={show.id}>
                    {show.title} ({show.time})
                  </option>
                ))}
              </select>
            </div>

            {/* EDIT SHOWS MODAL TRIGGER */}
            <button
              onClick={() => {
                setModalActiveTab('SHOWS');
                setIsEditShowsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" /> Edit Shows
            </button>

            {/* SUPER ADMIN (BAS) USER MANAGEMENT BUTTON */}
            {currentUser?.isSuperAdmin && (
              <button
                onClick={() => setIsUserModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Super Admin User Account Controls"
              >
                <Users className="w-3.5 h-3.5" /> Manage Users
              </button>
            )}

            {/* SUPER ADMIN (BAS) RECENT ACTIVITY DRAWER TRIGGER */}
            {currentUser?.isSuperAdmin && (
              <button
                onClick={() => setIsActivityDrawerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Open live recent activity stream (Super Admin Bas)"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Recent Activity</span>
              </button>
            )}

            {/* VIEW NAVIGATION: SEAT MAP | GATE MANIFEST | ACTIVITY LOG (BAS ONLY) */}
            <div className="flex items-center bg-slate-900 border border-slate-700 p-0.5 rounded-xl">
              <button
                onClick={() => setView('SEATING')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  view === 'SEATING'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800 font-medium'
                }`}
              >
                <Armchair className="w-3.5 h-3.5" />
                <span>Seat Map</span>
              </button>

              <button
                onClick={() => setView('MANIFEST')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  view === 'MANIFEST'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800 font-medium'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Gate Manifest</span>
              </button>

              {currentUser?.isSuperAdmin && (
                <button
                  onClick={() => setView('ACTIVITIES')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                    view === 'ACTIVITIES'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 font-bold'
                  }`}
                  title="Super Admin Activity & Audit Stream (Bas only)"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>Activity Log</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                    view === 'ACTIVITIES'
                      ? 'bg-slate-950 text-amber-300 border-slate-800'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    BAS
                  </span>
                </button>
              )}
            </div>

            {/* Export Seat Layout PNG in Header */}
            <button
              onClick={exportSeatLayoutPNG}
              disabled={isExportingPNG}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50"
              title="Export seat layout blueprint only as PNG"
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>{isExportingPNG ? 'Exporting...' : 'Seat PNG'}</span>
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>

            {/* USER BADGE & LOGOUT BUTTON */}
            {currentUser && (
              <div className="flex items-center gap-2 bg-slate-800/90 pl-3 pr-1.5 py-1 rounded-xl border border-slate-700">
                <div className="text-xs flex items-center gap-1">
                  <span className="text-slate-400">Welcome,</span>
                  <span className="font-extrabold text-amber-300">{currentUser.name}</span>
                  {currentUser.isSuperAdmin && (
                    <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500 text-slate-950">
                      ADMIN
                    </span>
                  )}
                </div>

                {/* Small Logout Button */}
                <button
                  onClick={handleLogout}
                  title="Log out and return to gatewall"
                  className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ml-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* METRICS & CATEGORIES BAR */}
      <div className="no-print bg-slate-900/60 border-b border-slate-800 px-4 lg:px-8 py-2.5">
        <div className="max-w-[1650px] mx-auto flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px] font-semibold px-2 uppercase tracking-wider">Mode:</span>
              <button
                onClick={() => {
                  setMode('BOOKING');
                  setSweepSelectActive(false);
                  setSelectedSeats(new Set());
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  mode === 'BOOKING'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" /> Seat Booking
              </button>
              <button
                onClick={() => {
                  setMode('CATEGORY');
                  setSelectedSeats(new Set());
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  mode === 'CATEGORY'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tags className="w-3.5 h-3.5" /> Seat Categories
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 bg-slate-800/70 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-slate-400">Total Seats:</span>
                <span className="font-bold text-white font-mono-num">{totalSeatsCount}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/70 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-slate-400">Booked (Tuition Charged):</span>
                <span className="font-bold text-rose-400 font-mono-num">{bookedSeatsCount}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/70 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-slate-400">Available:</span>
                <span className="font-bold text-emerald-400 font-mono-num">{availableSeatsCount}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Seat Categories with custom colors & PRICE */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (mode === 'CATEGORY') {
                      assignCategoryToSelected(cat.id);
                    }
                  }}
                  title={mode === 'CATEGORY' ? `Click to apply "${cat.name}" (₱${(cat.price || 0).toLocaleString()}) to selected seats` : `${cat.name} • ₱${(cat.price || 0).toLocaleString()}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                    mode === 'CATEGORY'
                      ? 'hover:scale-105 hover:shadow-md'
                      : ''
                  }`}
                  style={{
                    backgroundColor: `${cat.color}20`,
                    borderColor: cat.color,
                    color: cat.color,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.name}</span>
                  <span className="font-mono-num font-bold text-[11px] opacity-90 px-1 py-0.2 rounded bg-slate-900/50 border border-current/20">
                    ₱{(cat.price || 0).toLocaleString()}
                  </span>
                </button>
              ))}

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-400 bg-rose-600/20 text-rose-300 text-xs font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Booked</span>
              </span>
            </div>

            <button
              onClick={() => {
                setModalActiveTab('CATEGORIES');
                setIsEditShowsModalOpen(true);
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Manage Categories
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-[1650px] w-full mx-auto p-3 sm:p-4 lg:p-6 flex flex-col gap-6">

        {view === 'SEATING' ? (
          <div className="flex flex-col xl:flex-row gap-6 items-start">

            {/* SEATING CANVAS */}
            <div className={`flex-1 w-full rounded-2xl p-4 lg:p-6 shadow-2xl relative flex flex-col overflow-hidden border transition-colors ${
              seatTheme === 'light'
                ? 'bg-slate-200 border-slate-300 text-slate-900'
                : 'bg-slate-900 border-slate-800 text-slate-100'
            }`}>

              {/* Controls Bar */}
              <div className={`flex flex-wrap items-center justify-between pb-3 mb-3 border-b gap-2 ${
                seatTheme === 'light' ? 'border-slate-300' : 'border-slate-800'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs uppercase font-extrabold tracking-wider ${
                    seatTheme === 'light' ? 'text-slate-800' : 'text-slate-300'
                  }`}>
                    Auditorium Floor Blueprint
                  </span>
                  {mode === 'BOOKING' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/30">
                      BOOKING MODE ACTIVE
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/30">
                      CATEGORY ASSIGNMENT MODE ACTIVE
                    </span>
                  )}
                </div>

                {/* Controls: Theme, Export PNG, Zoom & Deselect */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSeatTheme(t => t === 'dark' ? 'light' : 'dark')}
                    className={`px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1.5 transition cursor-pointer font-bold ${
                      seatTheme === 'light'
                        ? 'bg-white border-slate-300 text-slate-800 shadow-sm hover:bg-slate-50'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
                    }`}
                    title={seatTheme === 'dark' ? 'Switch Seat Map to Light Theme' : 'Switch Seat Map to Dark Theme'}
                  >
                    {seatTheme === 'light' ? (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Light Map</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 text-amber-400" />
                        <span>Dark Map</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={exportSeatLayoutPNG}
                    disabled={isExportingPNG}
                    className={`px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1.5 transition cursor-pointer font-semibold ${
                      seatTheme === 'light'
                        ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-sm'
                        : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600/30'
                    } disabled:opacity-50`}
                    title="Export seat layout only as high-resolution PNG"
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    <span>{isExportingPNG ? 'Exporting...' : 'Export Seat PNG'}</span>
                  </button>

                  {/* 1. ZOOM CONTROLS: DEFAULT 50% */}
                  <div className={`flex items-center rounded-lg p-0.5 border text-xs ${
                    seatTheme === 'light' ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-800 border-slate-700'
                  }`}>
                    <button
                      onClick={() => setZoom(z => Math.max(0.3, Number((z - 0.1).toFixed(1))))}
                      className={`px-2 py-1 cursor-pointer ${
                        seatTheme === 'light' ? 'text-slate-700 hover:text-black' : 'text-slate-300 hover:text-white'
                      }`}
                      title="Zoom Out"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className={`px-1.5 text-[11px] font-mono ${
                      seatTheme === 'light' ? 'text-slate-700 font-bold' : 'text-slate-400'
                    }`}>
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      onClick={() => setZoom(z => Math.min(1.4, Number((z + 0.1).toFixed(1))))}
                      className={`px-2 py-1 cursor-pointer ${
                        seatTheme === 'light' ? 'text-slate-700 hover:text-black' : 'text-slate-300 hover:text-white'
                      }`}
                      title="Zoom In"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    {/* Reset button defaults to 50% */}
                    <button
                      onClick={() => setZoom(0.5)}
                      className={`px-2 py-1 border-l text-[10px] cursor-pointer font-medium ${
                        seatTheme === 'light'
                          ? 'border-slate-300 text-slate-700 hover:text-black'
                          : 'border-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title="Reset to Default 50%"
                    >
                      50%
                    </button>
                  </div>

                  {/* SWEEP MULTI-SELECT TOGGLE IN CATEGORY ASSIGNMENT MODE */}
                  {mode === 'CATEGORY' && (
                    <button
                      onClick={() => {
                        const next = !sweepSelectActive;
                        setSweepSelectActive(next);
                        showToast(next ? 'Sweep Select Active: Hover over seats to select' : 'Sweep Select OFF', 'info');
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1.5 transition cursor-pointer font-bold ${
                        sweepSelectActive
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30'
                          : seatTheme === 'light'
                            ? 'bg-white border-slate-300 text-slate-800 shadow-sm hover:bg-slate-50'
                            : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
                      }`}
                      title={sweepSelectActive ? 'Sweep Multi-Select Active: Hover over seats to select them' : 'Turn on Sweep Multi-Select (Glide/hover over seats)'}
                    >
                      <Paintbrush className={`w-3.5 h-3.5 ${sweepSelectActive ? 'text-slate-950' : 'text-cyan-400'}`} />
                      <span>{sweepSelectActive ? 'Sweep Select: ON' : 'Sweep Select'}</span>
                    </button>
                  )}

                  {/* CENTER VIEW BUTTON (NEAR ZOOM CONTROLS) */}
                  <button
                    onClick={handleCenterView}
                    className={`px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1.5 transition cursor-pointer font-bold ${
                      seatTheme === 'light'
                        ? 'bg-white border-slate-300 text-slate-800 shadow-sm hover:bg-slate-50'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700'
                    }`}
                    title="Center the seat layout view immediately"
                  >
                    <Focus className="w-3.5 h-3.5 text-amber-500" />
                    <span>Center View</span>
                  </button>

                  <button
                    onClick={() => setSelectedSeats(new Set())}
                    className={`text-xs px-2.5 py-1 rounded border transition cursor-pointer flex items-center gap-1 ${
                      seatTheme === 'light'
                        ? 'bg-white border-slate-300 text-slate-700 hover:text-black shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <X className="w-3 h-3" /> Deselect ({selectedSeats.size})
                  </button>
                </div>
              </div>

              {/* CATEGORY MODE MULTI-SELECT ACTIVE BANNER & DRAG TIP */}
              {mode === 'CATEGORY' && (
                sweepSelectActive ? (
                  <div className="w-full mb-3 px-4 py-2.5 bg-gradient-to-r from-cyan-950 via-cyan-900/80 to-cyan-950 border border-cyan-500/50 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-lg shadow-cyan-500/10">
                    <div className="flex items-center gap-2 text-cyan-200">
                      <span className="p-1 rounded bg-cyan-500 text-slate-950 font-bold flex items-center justify-center">
                        <Paintbrush className="w-3.5 h-3.5" />
                      </span>
                      <span>
                        <strong className="text-white">Sweep Multi-Select Active:</strong> Glide your mouse over seats to select them with zero clicking!
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-300 font-mono font-bold bg-slate-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                        {selectedSeats.size} Marked
                      </span>
                      <button
                        onClick={() => setSelectedSeats(new Set())}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setSweepSelectActive(false)}
                        className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-black cursor-pointer shadow"
                      >
                        Done Sweeping
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full mb-2.5 px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <MousePointerClick className="w-3.5 h-3.5 text-cyan-400" />
                      <span><strong>Multi-Select Tip:</strong> Click & drag your mouse across seats to select multiple seats, or click <strong>Sweep Select</strong> above to hover-select without holding the mouse.</span>
                    </span>
                    <button
                      onClick={() => setSweepSelectActive(true)}
                      className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer ml-2 flex-shrink-0"
                    >
                      Enable Sweep Mode
                    </button>
                  </div>
                )
              )}

              {/* Seating Map Scrollable Shell */}
              <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-auto max-h-[860px] pb-8 pt-2 w-full">
                <div className="w-max mx-auto flex flex-col items-center px-4">
                  <div
                    ref={seatingMapRef}
                    id="seatingMapWrapper"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                    className={`min-w-[1920px] w-max flex flex-col items-center gap-5 select-none transition-transform p-8 sm:p-12 rounded-3xl border ${
                      seatTheme === 'light'
                        ? 'bg-white border-slate-300 shadow-md'
                        : 'bg-slate-950/70 border-slate-800 shadow-2xl'
                    }`}
                  >

                    {/* TOPMOST SHOW BANNER IN SEATING LAYOUT & EXPORTED PNG */}
                    <div className={`w-full min-w-[1850px] flex items-center justify-between px-10 py-5 rounded-2xl border transition-colors ${
                      seatTheme === 'light'
                        ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-sm'
                        : 'bg-slate-900/95 border-slate-800 text-white shadow-xl'
                    }`}>
                      <div className="flex items-center gap-5">
                        <div className="h-16 w-16 rounded-2xl bg-white p-2 flex items-center justify-center shadow-md border border-red-500/30 flex-shrink-0">
                          <SucacLogo className="w-12 h-12" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3.5">
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                              {activeShowObj.title} ({activeShowObj.time})
                            </h2>
                            <span className="text-xs sm:text-sm font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                              {activeShowObj.date}
                            </span>
                          </div>
                          {activeShowObj.description && (
                            <p className={`text-base sm:text-lg font-semibold italic ${
                              seatTheme === 'light' ? 'text-amber-800' : 'text-amber-300/95'
                            }`}>
                              {activeShowObj.description}
                            </p>
                          )}
                          <p className={`text-xs sm:text-sm font-medium ${seatTheme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                            {exportTimestamp}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${seatTheme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
                          Claire Isabel McGill Luce Auditorium
                        </div>
                        <div className={`text-[11px] sm:text-xs font-medium ${seatTheme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                          Silliman University • Dumaguete City
                        </div>
                      </div>
                    </div>

                    {/* TICKET TYPES & PRICING BAR (RENDERED IN EXPORTED PNG & LAYOUT) */}
                    <div className={`w-full min-w-[1850px] flex items-center justify-between px-10 py-3.5 rounded-2xl border transition-colors ${
                      seatTheme === 'light'
                        ? 'bg-slate-100/90 border-slate-300 text-slate-900 shadow-sm'
                        : 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-inner'
                    }`}>
                      <div className="flex items-center gap-3.5">
                        <span className={`text-xs font-extrabold uppercase tracking-wider ${
                          seatTheme === 'light' ? 'text-slate-700' : 'text-slate-300'
                        }`}>
                          Ticket Tiers & Pricing:
                        </span>
                        <div className="flex flex-wrap items-center gap-2.5">
                          {categories.map(cat => (
                            <span
                              key={cat.id}
                              className="inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-extrabold shadow-sm"
                              style={{
                                backgroundColor: seatTheme === 'light' ? `${cat.color}25` : `${cat.color}20`,
                                borderColor: cat.color,
                                color: seatTheme === 'light' ? '#0f172a' : cat.color,
                              }}
                            >
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span>{cat.name}</span>
                              <span
                                className={`font-mono-num font-black px-1.5 py-0.5 rounded text-[11px] border ${
                                  seatTheme === 'light'
                                    ? 'bg-white border-slate-300 text-slate-900'
                                    : 'bg-slate-950/70 border-current/30 text-white'
                                }`}
                              >
                                ₱{(cat.price || 0).toLocaleString()}
                              </span>
                            </span>
                          ))}
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold ${
                            seatTheme === 'light'
                              ? 'border-rose-400 bg-rose-50 text-rose-800'
                              : 'border-rose-500 bg-rose-600/20 text-rose-300'
                          }`}>
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            <span>Booked / Reserved</span>
                          </span>
                        </div>
                      </div>

                      <div className={`text-xs font-semibold ${
                        seatTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Official Luce Auditorium Seating Blueprint
                      </div>
                    </div>

                    {/* UPPER TIER CONTAINER (Rows W down to L) */}
                    <div className={`w-full min-w-[1850px] flex flex-col items-center gap-2 p-8 sm:p-10 rounded-2xl border transition-colors ${
                      seatTheme === 'light'
                        ? 'bg-slate-50 border-slate-200 shadow-inner'
                        : 'bg-slate-950/80 border-slate-800/90'
                    }`}>
                      <div className="w-full flex items-center justify-between text-[11px] font-bold uppercase px-8 mb-3">
                        <span className={`flex items-center gap-1.5 ${
                          seatTheme === 'light' ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          ← Upper Left Wing (L to W: 1–11)
                        </span>
                        <span className={`tracking-wider flex items-center gap-2 ${
                          seatTheme === 'light' ? 'text-amber-800 font-extrabold' : 'text-amber-400/90'
                        }`}>
                          <span>UPPER BALCONY TIER (ROWS W TO L)</span>
                        </span>
                        <span className={`flex items-center gap-1.5 ${
                          seatTheme === 'light' ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          Upper Right Wing (T: 29–39 | U-V: 12–22 | W: 12–21) →
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 w-full items-center">
                        {UPPER_TIER_CONFIG.map(cfg => renderUpperRow(cfg))}
                      </div>
                    </div>

                    {/* CROSS AISLE / WALKWAY / EXIT DOORS */}
                    <div className={`w-full min-w-[1850px] my-3 flex items-center justify-between px-10 py-4 border-y border-dashed text-[10px] font-bold rounded-xl transition-colors ${
                      seatTheme === 'light'
                        ? 'bg-slate-100 border-slate-300 text-slate-700 shadow-sm'
                        : 'bg-slate-900 border-slate-700 text-slate-400 shadow-inner'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded border ${
                          seatTheme === 'light' ? 'bg-white border-slate-300 text-slate-800 shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-200'
                        }`}>DOOR 5 (D5)</span>
                        <span className={`px-2.5 py-0.5 rounded border ${
                          seatTheme === 'light' ? 'bg-white border-slate-300 text-slate-800 shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-200'
                        }`}>DOOR 6 (D6)</span>
                      </div>
                      <div className={`tracking-[0.25em] uppercase font-mono text-xs flex items-center gap-2 ${
                        seatTheme === 'light' ? 'text-amber-800 font-bold' : 'text-amber-400/90'
                      }`}>
                        <span>←</span> CROSS AISLE / PATRON WALKWAY <span>→</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded border ${
                          seatTheme === 'light' ? 'bg-white border-slate-300 text-slate-800 shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-200'
                        }`}>DOOR 2 (D2)</span>
                        <span className={`px-2.5 py-0.5 rounded border ${
                          seatTheme === 'light' ? 'bg-white border-slate-300 text-slate-800 shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-200'
                        }`}>DOOR 1 (D1)</span>
                      </div>
                    </div>

                    {/* LOWER TIER CONTAINER (Rows K down to A) */}
                    <div className={`w-full min-w-[1850px] flex flex-col items-center gap-2 p-8 sm:p-10 rounded-2xl border transition-colors ${
                      seatTheme === 'light'
                        ? 'bg-slate-50 border-slate-200 shadow-inner'
                        : 'bg-slate-950/80 border-slate-800/90'
                    }`}>
                      <div className="w-full flex items-center justify-between text-[11px] font-bold uppercase px-8 mb-3">
                        <span className={`flex items-center gap-1.5 ${
                          seatTheme === 'light' ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          ← Lower Left Wing (A-G: 1–9, H-K: 1–10)
                        </span>
                        <span className={`tracking-wider ${
                          seatTheme === 'light' ? 'text-amber-800 font-extrabold' : 'text-amber-400/90'
                        }`}>
                          LOWER ORCHESTRA TIER (ROWS K TO A)
                        </span>
                        <span className={`flex items-center gap-1.5 ${
                          seatTheme === 'light' ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          Lower Right Wing (A-B: 21–29, C: 22–30, D-F: 23–31, G: 24–32, H-K: 26–35) →
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 w-full items-center">
                        {LOWER_TIER_CONFIG.map(cfg => renderLowerRow(cfg))}
                      </div>
                    </div>

                    {/* 2. BOTTOM: STAGE (Changed to "STAGE" as requested) */}
                    <div className="w-full text-center mt-4">
                      <div className={`mx-auto w-3/4 max-w-4xl h-16 rounded-b-[120px] border-b-2 flex items-center justify-center transition-colors ${
                        seatTheme === 'light'
                          ? 'bg-gradient-to-t from-amber-500/20 via-amber-500/5 to-transparent border-amber-500 shadow-[0_10px_30px_rgba(245,158,11,0.15)]'
                          : 'bg-gradient-to-t from-amber-500/25 via-amber-500/10 to-transparent border-amber-400 shadow-[0_10px_30px_rgba(245,158,11,0.25)]'
                      }`}>
                        <span className={`text-sm tracking-[0.45em] font-black uppercase flex items-center gap-2 ${
                          seatTheme === 'light' ? 'text-amber-900' : 'text-amber-300'
                        }`}>
                          <Sparkles className="w-4 h-4 text-amber-500" /> STAGE
                        </span>
                      </div>
                      <div className={`text-[10px] mt-1 uppercase tracking-widest font-semibold ${
                        seatTheme === 'light' ? 'text-slate-600' : 'text-slate-500'
                      }`}>
                        Main Performance Platform • Claire Isabel McGill Luce Auditorium
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Bottom Helpful Legend */}
              <div className={`text-center text-[11px] mt-3 flex items-center justify-center gap-4 border-t pt-2 ${
                seatTheme === 'light' ? 'border-slate-300 text-slate-600' : 'border-slate-800/70 text-slate-400'
              }`}>
                <span>• Click individual seats to multi-select</span>
                <span>•</span>
                <span>• Click row letters (A-W) to select/deselect the entire row</span>
              </div>
            </div>

            {/* SIDEBAR PANEL */}
            <aside className="w-full xl:w-[400px] bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">

              {mode === 'BOOKING' ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h2 className="font-bold text-base text-white flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-amber-400" />
                      <span>Multi-Seat Booking</span>
                    </h2>
                    <span className="bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full text-xs border border-amber-500/30">
                      {selectedSeats.size} Selected
                    </span>
                  </div>

                  {/* Seat Tuition Charge Summary */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-slate-400">Total Seats Selected:</span>
                      <span className="text-xl font-extrabold text-amber-400 font-mono-num">
                        {selectedSeats.size} Seats
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/80">
                      <span className="text-slate-400">Total Tuition Charge:</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono-num">
                        ₱{selectedTotalPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Billed to Student / Patron Account at Silliman University.
                    </div>
                  </div>

                  {/* Selected Seats Chips */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 min-h-[64px] max-h-36 overflow-y-auto">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                      Seats Picked:
                    </span>
                    {selectedSeats.size === 0 ? (
                      <span className="text-xs text-slate-500 italic">No seats picked yet. Click seats on the map.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(selectedSeats)
                          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                          .map(seat => {
                            const catId = seatCategoryMap[seat] || getDefaultCategoryId(seat);
                            const cat = categories.find(c => c.id === catId);
                            return (
                              <span
                                key={seat}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border"
                                style={{
                                  backgroundColor: `${cat?.color || '#f59e0b'}20`,
                                  borderColor: `${cat?.color || '#f59e0b'}80`,
                                  color: cat?.color || '#f59e0b',
                                }}
                              >
                                <span className="font-mono-num">{seat}</span>
                                <span className="text-[9px] opacity-90">({cat?.name || 'Standard'} • ₱{(cat?.price || 0).toLocaleString()})</span>
                                <X
                                  className="w-3 h-3 cursor-pointer hover:text-white ml-0.5"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedSeats(prev => {
                                      const next = new Set(prev);
                                      next.delete(seat);
                                      return next;
                                    });
                                  }}
                                />
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Booking Form */}
                  <form onSubmit={handleBookSelected} className="space-y-3">
                    {/* 1. Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={patronName}
                        onChange={e => setPatronName(e.target.value)}
                        placeholder="e.g. Maria Santos"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {/* 2. Payment Method */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Payment Method <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer font-medium"
                      >
                        <option value="Charge to Tuition">Charge to Tuition</option>
                        <option value="Payroll">Payroll</option>
                        <option value="Cash">Cash</option>
                        <option value="Online Payment">Online Payment</option>
                        <option value="Complimentary">Complimentary</option>
                      </select>
                    </div>

                    {/* 3. Conditional Fields based on Payment Method */}
                    {paymentMethod === 'Charge to Tuition' && (
                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
                        <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                          <span>Student ID Number <span className="text-rose-400">*</span></span>
                          <span className="text-[10px] text-amber-400 font-mono">Tuition Billing</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={studentId}
                          onChange={e => setStudentId(e.target.value)}
                          placeholder="e.g. 2024-00192"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono-num"
                        />
                        <span className="text-[10px] text-slate-400 block">Silliman University student identification number</span>
                      </div>
                    )}

                    {paymentMethod === 'Payroll' && (
                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
                        <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                          <span>Staff ID Number <span className="text-rose-400">*</span></span>
                          <span className="text-[10px] text-amber-400 font-mono">Payroll Deduction</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={staffId}
                          onChange={e => setStaffId(e.target.value)}
                          placeholder="e.g. EMP-2023-441"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono-num"
                        />
                        <span className="text-[10px] text-slate-400 block">Faculty or Staff employee ID number</span>
                      </div>
                    )}

                    {paymentMethod === 'Cash' && (
                      <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
                        <DollarSign className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Cash payment will be collected on-site at the gate / cashier booth.</span>
                      </div>
                    )}

                    {paymentMethod === 'Complimentary' && (
                      <div className="bg-purple-950/30 p-3 rounded-xl border border-purple-500/30 flex items-center gap-2.5 text-xs text-purple-300">
                        <Gift className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span>Complimentary / VIP access pass authorized for selected seats.</span>
                      </div>
                    )}

                    {paymentMethod === 'Online Payment' && (
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-cyan-500/30 space-y-3">
                        {/* Checkboxes: GCash & Other Banks */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Online Payment Option:
                          </label>
                          <div className="flex flex-wrap gap-2.5">
                            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition">
                              <input
                                type="checkbox"
                                checked={onlineGCash}
                                onChange={e => setOnlineGCash(e.target.checked)}
                                className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer w-3.5 h-3.5"
                              />
                              <span className="font-semibold text-blue-400">GCash</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition">
                              <input
                                type="checkbox"
                                checked={onlineOtherBanks}
                                onChange={e => setOnlineOtherBanks(e.target.checked)}
                                className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer w-3.5 h-3.5"
                              />
                              <span className="font-semibold text-emerald-400">Other Banks</span>
                            </label>
                          </div>
                        </div>

                        {/* Upload Proof of Payment (Drag & drop, not required) */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                            <span>Upload Proof of Payment</span>
                            <span className="text-[10px] text-slate-400 font-normal lowercase">(not required)</span>
                          </label>

                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={e => handleFileUpload(e.target.files)}
                            accept="image/*,.pdf"
                            className="hidden"
                          />

                          {isCompressingReceipt ? (
                            <div className="p-4 rounded-xl border border-cyan-500/40 bg-cyan-950/40 flex items-center justify-center gap-2.5 text-xs text-cyan-300">
                              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                              <span>Compressing receipt image to &lt;300 KB...</span>
                            </div>
                          ) : proofOfPaymentFile ? (
                            <div className="p-2.5 rounded-xl border border-cyan-500/40 bg-cyan-950/30 flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                {proofOfPaymentFile.dataUrl ? (
                                  <img
                                    src={proofOfPaymentFile.dataUrl}
                                    alt="Receipt preview"
                                    className="w-10 h-10 rounded-lg object-cover border border-cyan-500/30 flex-shrink-0 bg-slate-900"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                )}
                                <div className="truncate text-xs">
                                  <div className="font-medium text-white truncate max-w-[200px]">{proofOfPaymentFile.name}</div>
                                  <div className="text-[10px] text-cyan-300 flex items-center gap-1 font-mono">
                                    <span>{proofOfPaymentFile.size}</span>
                                    {proofOfPaymentFile.originalSize && (
                                      <span className="text-slate-400 text-[9px]">(from {proofOfPaymentFile.originalSize})</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {proofOfPaymentFile.dataUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingReceipt({
                                        seatId: Array.from(selectedSeats).join(', '),
                                        patronName: patronName || 'Preview',
                                        patronId: studentId || staffId || 'Online Payment',
                                        paymentMethod: 'Online Payment',
                                        categoryId: 'preview',
                                        bookedByUsername: currentUser?.username || 'bas',
                                        bookedByName: currentUser?.name || 'Bas',
                                        proofOfPaymentData: proofOfPaymentFile.dataUrl,
                                        proofOfPaymentName: proofOfPaymentFile.name,
                                        bookedAt: new Date().toISOString(),
                                      });
                                    }}
                                    className="p-1.5 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/60 transition cursor-pointer"
                                    title="Preview receipt full-size"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProofOfPaymentFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition cursor-pointer"
                                  title="Remove proof file"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onDragOver={e => {
                                e.preventDefault();
                                setIsDraggingFile(true);
                              }}
                              onDragLeave={e => {
                                e.preventDefault();
                                setIsDraggingFile(false);
                              }}
                              onDrop={e => {
                                e.preventDefault();
                                setIsDraggingFile(false);
                                handleFileUpload(e.dataTransfer.files);
                              }}
                              onClick={() => fileInputRef.current?.click()}
                              className={`p-3.5 rounded-xl border-2 border-dashed transition flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                                isDraggingFile
                                  ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 scale-[1.01]'
                                  : 'border-slate-700 hover:border-cyan-500/60 bg-slate-900/50 hover:bg-slate-900 text-slate-400'
                              }`}
                            >
                              <UploadCloud className="w-5 h-5 text-cyan-400" />
                              <div className="text-[11px] font-medium text-slate-200">
                                Drag & drop receipt here, or <span className="text-cyan-400 font-semibold underline">browse</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Automatically compressed &lt;300 KB • PNG, JPG, WebP
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 4. Notes / Department / Section */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                        <span>Notes / Department / Section</span>
                        <span className="text-[10px] text-slate-400 font-normal lowercase">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={bookingNotes}
                        onChange={e => setBookingNotes(e.target.value)}
                        placeholder="e.g. Dept of Arts / Semester Pass"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={selectedSeats.size === 0}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Confirm & Charge {selectedSeats.size} Selected Seat(s)</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h2 className="font-bold text-base text-white flex items-center gap-2">
                      <Tags className="w-4 h-4 text-cyan-400" />
                      <span>Assign Seat Categories</span>
                    </h2>
                    <span className="bg-cyan-500/20 text-cyan-300 font-bold px-2.5 py-0.5 rounded-full text-xs border border-cyan-500/30">
                      {selectedSeats.size} Marked
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Select seats or entire rows (A-W), then click any category below to apply the category, color, and price.
                  </p>

                  {/* MULTI-SELECT TOOLS & SHORTCUTS */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <MousePointerClick className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Multi-Select Tools</span>
                      </span>
                      <button
                        onClick={() => {
                          const next = !sweepSelectActive;
                          setSweepSelectActive(next);
                          showToast(next ? 'Sweep Select Active: Hover over seats to select' : 'Sweep Select OFF', 'info');
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                          sweepSelectActive
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                        }`}
                        title="Toggle glide-to-select mode"
                      >
                        <Paintbrush className="w-3 h-3" />
                        <span>{sweepSelectActive ? 'Sweep: ON' : 'Sweep: OFF'}</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      Hold & drag across seats to multi-select, or use <strong>Sweep</strong> to select by gliding your cursor.
                    </div>

                    {/* Quick Batch Selection Buttons */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={selectUpperTier}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition cursor-pointer text-left truncate"
                        title="Select Upper Balcony (Rows L–W, 339 seats)"
                      >
                        + Upper Balcony (L–W)
                      </button>
                      <button
                        onClick={selectLowerTier}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition cursor-pointer text-left truncate"
                        title="Select Lower Orchestra (Rows A–K, 422 seats)"
                      >
                        + Lower Orchestra (A–K)
                      </button>
                      <button
                        onClick={selectAllSeats}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition cursor-pointer text-left truncate"
                        title="Select All 761 Seats"
                      >
                        + Select All (761)
                      </button>
                      <button
                        onClick={invertSelection}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition cursor-pointer text-left truncate"
                        title="Invert current seat selection"
                      >
                        ⇄ Invert Selection
                      </button>
                    </div>

                    {selectedSeats.size > 0 && (
                      <button
                        onClick={() => setSelectedSeats(new Set())}
                        className="w-full py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-300 text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <X className="w-3 h-3" /> Clear Marked ({selectedSeats.size})
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Click Category to Apply:
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => assignCategoryToSelected(cat.id)}
                          className="p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold transition hover:scale-102 cursor-pointer text-left"
                          style={{
                            backgroundColor: `${cat.color}20`,
                            borderColor: cat.color,
                            color: cat.color,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate">{cat.name}</span>
                          </div>
                          <span className="font-mono-num px-1.5 py-0.5 rounded bg-slate-900/60 border border-current/20 text-[11px]">
                            ₱{(cat.price || 0).toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3">
                    <button
                      onClick={() => {
                        setModalActiveTab('CATEGORIES');
                        setIsEditShowsModalOpen(true);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Add / Manage Custom Categories</span>
                    </button>
                  </div>
                </div>
              )}

            </aside>
          </div>
        ) : view === 'MANIFEST' ? (
          /* MANIFEST VIEW */
          <div className="flex flex-col gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <ListFilter className="w-4 h-4 text-amber-400" />
                    <span>SUCAC Gate Manifest & Student Roster</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    {activeShowObj.title} ({activeShowObj.time}) • {Object.keys(bookings).length} Total Charged Seats
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={manifestSearch}
                      onChange={e => setManifestSearch(e.target.value)}
                      placeholder="Search patron, ID, seat..."
                      className="bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 w-56"
                    />
                  </div>

                  <select
                    value={manifestCategoryFilter}
                    onChange={e => setManifestCategoryFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (₱{(c.price || 0).toLocaleString()})</option>
                    ))}
                  </select>

                  {/* SUPER ADMIN (BAS) STAFF ATTRIBUTION FILTER */}
                  {currentUser?.isSuperAdmin && (
                    <select
                      value={manifestStaffFilter}
                      onChange={e => setManifestStaffFilter(e.target.value)}
                      className="bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      title="Admin filter by staff booking attribution"
                    >
                      <option value="ALL">All Staff Bookers</option>
                      {users.map(u => (
                        <option key={u.username} value={u.username}>Staff: {u.name}</option>
                      ))}
                    </select>
                  )}

                  {/* QUICK SORT SELECTOR */}
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
                    <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3 text-amber-400" /> Sort:
                    </span>
                    <select
                      value={`${manifestSortField}_${manifestSortDirection}`}
                      onChange={(e) => {
                        const [f, d] = e.target.value.split('_');
                        setManifestSortField(f as any);
                        setManifestSortDirection(d as any);
                      }}
                      className="bg-transparent text-amber-300 font-semibold text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="bookedAt_desc" className="bg-slate-900 text-white">Latest Booked First (Default)</option>
                      <option value="bookedAt_asc" className="bg-slate-900 text-white">Oldest Booked First</option>
                      <option value="seatId_asc" className="bg-slate-900 text-white">Seat ID (A → Z)</option>
                      <option value="seatId_desc" className="bg-slate-900 text-white">Seat ID (Z → A)</option>
                      <option value="patronName_asc" className="bg-slate-900 text-white">Patron Name (A → Z)</option>
                      <option value="patronName_desc" className="bg-slate-900 text-white">Patron Name (Z → A)</option>
                      <option value="category_desc" className="bg-slate-900 text-white">Tier Price (High → Low)</option>
                      <option value="category_asc" className="bg-slate-900 text-white">Tier Price (Low → High)</option>
                      <option value="paymentMethod_asc" className="bg-slate-900 text-white">Billing Channel (A → Z)</option>
                      {currentUser?.isSuperAdmin && (
                        <option value="bookedByName_asc" className="bg-slate-900 text-white">Staff Booker (A → Z)</option>
                      )}
                    </select>
                  </div>

                  <button
                    onClick={exportCSV}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-950/40 select-none">
                      <th
                        onClick={() => handleManifestSort('seatId')}
                        className={`py-3 px-3 cursor-pointer hover:text-amber-300 transition group ${
                          manifestSortField === 'seatId' ? 'text-amber-400 font-bold bg-amber-500/5' : ''
                        }`}
                        title="Click to sort by seat number"
                      >
                        <div className="flex items-center gap-1">
                          <span>Seat</span>
                          {manifestSortField === 'seatId' ? (
                            manifestSortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition" />
                          )}
                        </div>
                      </th>

                      <th
                        onClick={() => handleManifestSort('patronName')}
                        className={`py-3 px-3 cursor-pointer hover:text-amber-300 transition group ${
                          manifestSortField === 'patronName' ? 'text-amber-400 font-bold bg-amber-500/5' : ''
                        }`}
                        title="Click to sort by patron name"
                      >
                        <div className="flex items-center gap-1">
                          <span>Patron Name</span>
                          {manifestSortField === 'patronName' ? (
                            manifestSortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition" />
                          )}
                        </div>
                      </th>

                      <th
                        onClick={() => handleManifestSort('patronId')}
                        className={`py-3 px-3 cursor-pointer hover:text-amber-300 transition group ${
                          manifestSortField === 'patronId' ? 'text-amber-400 font-bold bg-amber-500/5' : ''
                        }`}
                        title="Click to sort by ID number"
                      >
                        <div className="flex items-center gap-1">
                          <span>ID Number</span>
                          {manifestSortField === 'patronId' ? (
                            manifestSortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition" />
                          )}
                        </div>
                      </th>

                      <th
                        onClick={() => handleManifestSort('category')}
                        className={`py-3 px-3 cursor-pointer hover:text-amber-300 transition group ${
                          manifestSortField === 'category' ? 'text-amber-400 font-bold bg-amber-500/5' : ''
                        }`}
                        title="Click to sort by ticket tier price"
                      >
                        <div className="flex items-center gap-1">
                          <span>Category & Price</span>
                          {manifestSortField === 'category' ? (
                            manifestSortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition" />
                          )}
                        </div>
                      </th>

                      <th
                        onClick={() => handleManifestSort('paymentMethod')}
                        className={`py-3 px-3 cursor-pointer hover:text-amber-300 transition group ${
                          manifestSortField === 'paymentMethod' ? 'text-amber-400 font-bold bg-amber-500/5' : ''
                        }`}
                        title="Click to sort by billing channel"
                      >
                        <div className="flex items-center gap-1">
                          <span>Billing Channel</span>
                          {manifestSortField === 'paymentMethod' ? (
                            manifestSortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition" />
                          )}
                        </div>
                      </th>

                      <th className="py-3 px-3 text-cyan-400">Proof / Receipt</th>

                      {/* SUPER ADMIN (BAS) ONLY COLUMN: Who booked it! */}
                      {currentUser?.isSuperAdmin && (
                        <th
                          onClick={() => handleManifestSort('bookedByName')}
                          className={`py-3 px-3 cursor-pointer hover:text-amber-300 transition group ${
                            manifestSortField === 'bookedByName' ? 'text-amber-400 font-bold bg-amber-500/5' : ''
                          }`}
                          title="Click to sort by staff member"
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-amber-400">Booked By (Staff)</span>
                            {manifestSortField === 'bookedByName' ? (
                              manifestSortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition" />
                            )}
                          </div>
                        </th>
                      )}

                      <th className="py-3 px-3">Notes</th>

                      {/* SEQUENCE / TIMESTAMP COLUMN */}
                      <th
                        onClick={() => handleManifestSort('bookedAt')}
                        className={`py-3 px-3 cursor-pointer hover:text-amber-300 transition group ${
                          manifestSortField === 'bookedAt' ? 'text-amber-400 font-bold bg-amber-500/10' : ''
                        }`}
                        title="Click to sort by time booked (sequence)"
                      >
                        <div className="flex items-center gap-1">
                          <span>Timestamp (Sequence)</span>
                          {manifestSortField === 'bookedAt' ? (
                            manifestSortDirection === 'desc' ? (
                              <span className="inline-flex items-center gap-0.5 text-amber-400 text-[9px] bg-amber-500/20 px-1 py-0.2 rounded border border-amber-500/30">
                                <ArrowDown className="w-2.5 h-2.5" /> Latest
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-amber-400 text-[9px] bg-amber-500/20 px-1 py-0.2 rounded border border-amber-500/30">
                                <ArrowUp className="w-2.5 h-2.5" /> Oldest
                              </span>
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition" />
                          )}
                        </div>
                      </th>

                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-slate-800 text-slate-200">
                    {manifestList.map(item => {
                      const cat = categories.find(c => c.id === item.categoryId);
                      return (
                        <tr key={item.seatId} className="hover:bg-slate-800/50 transition">
                          <td className="py-2.5 px-3 font-bold text-amber-400 font-mono-num">{item.seatId}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{item.patronName}</td>

                          <td className="py-2.5 px-3 text-slate-300 font-mono-num text-[11px]">{item.patronId}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border"
                              style={{
                                backgroundColor: `${cat?.color || '#f59e0b'}20`,
                                borderColor: cat?.color || '#f59e0b',
                                color: cat?.color || '#f59e0b',
                              }}
                            >
                              <span>{cat?.name || 'Standard'}</span>
                              <span className="font-mono-num opacity-90">₱{(cat?.price || 0).toLocaleString()}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-200 border border-slate-700">
                              {item.paymentMethod}
                            </span>
                          </td>

                          {/* Proof / Receipt Column with interactive Upload on "No upload" and Thumbnail view */}
                          <td className="py-2.5 px-3">
                            {uploadingReceiptSeatId === item.seatId ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-[11px] font-semibold text-cyan-300">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                                <span>Compressing...</span>
                              </div>
                            ) : item.proofOfPaymentData ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setViewingReceipt(item)}
                                  className="group/btn flex items-center gap-2 p-1 rounded-lg border border-slate-700 hover:border-cyan-400 bg-slate-900/90 hover:bg-slate-800 transition cursor-pointer text-left"
                                  title="Click to view full receipt image"
                                >
                                  <img
                                    src={item.proofOfPaymentData}
                                    alt="Receipt thumbnail"
                                    className="w-8 h-8 rounded object-cover border border-slate-800 group-hover/btn:scale-105 transition flex-shrink-0 bg-slate-950"
                                  />
                                  <div className="flex flex-col overflow-hidden max-w-[90px]">
                                    <span className="text-[10px] font-bold text-cyan-400 group-hover/btn:underline flex items-center gap-0.5">
                                      <Eye className="w-2.5 h-2.5" /> View
                                    </span>
                                    <span className="text-[9px] text-slate-400 truncate font-mono">
                                      {item.proofOfPaymentName || 'Receipt'}
                                    </span>
                                  </div>
                                </button>
                                {/* Replace receipt button */}
                                <label
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-cyan-950/60 border border-transparent hover:border-cyan-500/30 transition cursor-pointer"
                                  title="Replace / Update proof of payment"
                                >
                                  <UploadCloud className="w-3.5 h-3.5 text-cyan-400/80 hover:text-cyan-300" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingReceiptSeatId === item.seatId}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadReceiptForManifestSeat(item.seatId, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                            ) : (
                              <label
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-900/40 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 text-[11px] font-medium transition cursor-pointer group/btn shadow-sm"
                                title={`Click to upload proof of payment for seat ${item.seatId} (${item.patronName})`}
                              >
                                <UploadCloud className="w-3.5 h-3.5 text-cyan-400 group-hover/btn:scale-110 transition flex-shrink-0" />
                                <span className="text-slate-400 group-hover/btn:text-slate-200">No upload</span>
                                <span className="text-[10px] font-bold text-cyan-400 group-hover/btn:underline flex items-center gap-0.5">
                                  + Upload
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingReceiptSeatId === item.seatId}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadReceiptForManifestSeat(item.seatId, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                          </td>

                          {/* SUPER ADMIN (BAS) ONLY CELL: View staff who performed booking */}
                          {currentUser?.isSuperAdmin && (
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                <UserCheck className="w-3 h-3 text-amber-400" />
                                <span>{item.bookedByName || 'Bas'}</span>
                              </span>
                            </td>
                          )}

                          <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate">{item.notes || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-300 text-[11px] font-mono whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">
                                {new Date(item.bookedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(item.bookedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!item.proofOfPaymentData ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadModalBooking(item);
                                    setModalReceiptPreview(null);
                                  }}
                                  className="text-cyan-400 hover:text-cyan-200 font-semibold text-[11px] px-2 py-1 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 transition cursor-pointer flex items-center gap-1"
                                  title={`Upload proof of payment for ${item.seatId}`}
                                >
                                  <UploadCloud className="w-3 h-3" />
                                  <span>Upload Proof</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setViewingReceipt(item)}
                                  className="text-cyan-400 hover:text-cyan-200 font-semibold text-[11px] px-2 py-1 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 transition cursor-pointer flex items-center gap-1"
                                  title="View proof receipt"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Receipt</span>
                                </button>
                              )}

                              <button
                                onClick={() => setInspectSeatId(item.seatId)}
                                className="text-rose-400 hover:text-rose-300 font-semibold text-[11px] px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer"
                              >
                                Release
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {manifestList.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No bookings found matching current filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : currentUser?.isSuperAdmin ? (
          /* ACTIVITIES AUDIT VIEW (SUPER ADMIN BAS ONLY) */
          <div className="flex flex-col gap-5">
            {/* Top Overview & Controls Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/10">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">System Activities & Audit Stream</h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-slate-950 uppercase tracking-wider">
                        Super Admin Bas
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Live real-time feed of ticket bookings, cancellations, and system events with staff attribution.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Firestore Sync</span>
                  </span>

                  <button
                    onClick={exportActivitiesCSV}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export Audit CSV
                  </button>
                </div>
              </div>

              {/* 4 Summary Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Total In Feed</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-black text-amber-400 font-mono-num">{allActivities.length}</span>
                    <span className="text-[10px] text-slate-500">recorded events</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Seat Bookings</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-black text-emerald-400 font-mono-num">
                      {allActivities.filter(a => a.type === 'BOOKING').length}
                    </span>
                    <span className="text-[10px] text-slate-500">tickets reserved</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Cancellations</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-black text-rose-400 font-mono-num">
                      {allActivities.filter(a => a.type === 'CANCELLATION').length}
                    </span>
                    <span className="text-[10px] text-slate-500">seats released</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Active Production</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm font-bold text-white truncate max-w-[140px]" title={activeShowObj.title}>
                      {activeShowObj.title}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono-num">{Object.keys(bookings).length} booked</span>
                  </div>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-800/80">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={activitySearch}
                      onChange={e => setActivitySearch(e.target.value)}
                      placeholder="Search seat, patron, staff, show..."
                      className="bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 w-64"
                    />
                  </div>

                  {/* Filter by Show */}
                  <select
                    value={activityShowFilter}
                    onChange={e => setActivityShowFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ALL">All Shows ({shows.length})</option>
                    {shows.map(s => (
                      <option key={s.id} value={s.id}>{s.title} ({s.time})</option>
                    ))}
                  </select>

                  {/* Filter by Staff Booker */}
                  <select
                    value={activityStaffFilter}
                    onChange={e => setActivityStaffFilter(e.target.value)}
                    className="bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ALL">All Staff Members</option>
                    {users.map(u => (
                      <option key={u.username} value={u.username}>Staff: {u.name} (@{u.username})</option>
                    ))}
                  </select>

                  {/* Filter by Type */}
                  <select
                    value={activityTypeFilter}
                    onChange={e => setActivityTypeFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ALL">All Action Types</option>
                    <option value="BOOKING">Bookings Only</option>
                    <option value="CANCELLATION">Cancellations / Releases</option>
                    <option value="SHOW_UPDATE">Show Updates</option>
                  </select>

                  {(activitySearch || activityShowFilter !== 'ALL' || activityStaffFilter !== 'ALL' || activityTypeFilter !== 'ALL') && (
                    <button
                      onClick={() => {
                        setActivitySearch('');
                        setActivityShowFilter('ALL');
                        setActivityStaffFilter('ALL');
                        setActivityTypeFilter('ALL');
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  Showing <span className="font-bold text-amber-300">{filteredActivities.length}</span> of {allActivities.length} activities
                </div>
              </div>
            </div>

            {/* Activities Timeline List */}
            <div className="space-y-3">
              {filteredActivities.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                  <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-300">No activities match your current filters</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Try clearing the search query or changing the show or staff member filter.
                  </p>
                </div>
              ) : (
                filteredActivities.map(act => {
                  const isBooking = act.type === 'BOOKING';
                  const isCancellation = act.type === 'CANCELLATION';
                  const isReceiptUpload = act.type === 'RECEIPT_UPLOAD';

                  return (
                    <div
                      key={act.id}
                      className={`bg-slate-900/90 hover:bg-slate-900 border rounded-2xl p-4 transition shadow-lg relative overflow-hidden group ${
                        isBooking
                          ? 'border-emerald-500/30 hover:border-emerald-500/60'
                          : isCancellation
                          ? 'border-rose-500/30 hover:border-rose-500/60'
                          : isReceiptUpload
                          ? 'border-cyan-500/30 hover:border-cyan-500/60'
                          : 'border-amber-500/30 hover:border-amber-500/60'
                      }`}
                    >
                      {/* Left ambient color stripe */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          isBooking ? 'bg-emerald-500' : isCancellation ? 'bg-rose-500' : isReceiptUpload ? 'bg-cyan-400' : 'bg-amber-500'
                        }`}
                      />

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-2">
                        {/* Event Content */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                              isBooking
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : isCancellation
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : isReceiptUpload
                                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {isBooking ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : isCancellation ? (
                              <Trash2 className="w-4 h-4" />
                            ) : isReceiptUpload ? (
                              <UploadCloud className="w-4 h-4" />
                            ) : (
                              <Settings2 className="w-4 h-4" />
                            )}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                  isBooking
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : isCancellation
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : isReceiptUpload
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {isBooking ? 'Seat Booked' : isCancellation ? 'Seat Released' : isReceiptUpload ? 'Proof Attached' : 'Show Schedule'}
                              </span>

                              {act.seatIds && act.seatIds.length > 0 && (
                                <span className="font-mono-num font-bold text-amber-400 text-xs px-2 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                                  {act.seatIds.join(', ')}
                                </span>
                              )}

                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-300 font-medium">{act.showName}</span>
                            </div>

                            <p className="text-sm font-semibold text-white mt-1.5">
                              {act.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                              {/* Staff badge */}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                                <UserCheck className="w-3 h-3 text-amber-400" />
                                <span>Booked by {act.performedByName || 'Bas'}</span>
                                <span className="opacity-70 font-mono text-[10px]">(@{act.performedByUsername || 'bas'})</span>
                              </span>

                              {/* Patron name badge */}
                              {act.patronName && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[11px]">
                                  <span>Patron:</span>
                                  <strong className="text-white">{act.patronName}</strong>
                                </span>
                              )}

                              {/* Payment badge */}
                              {act.paymentMethod && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                                  <span>{act.paymentMethod}</span>
                                </span>
                              )}

                              {/* Notes */}
                              {act.details && (
                                <span className="text-[11px] text-slate-400 italic bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800 truncate max-w-xs">
                                  {act.details}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Timestamp & Show jump action */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1.5 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                          <div className="text-right">
                            <span className="text-xs font-bold text-amber-300">
                              {formatRelativeTime(act.timestamp)}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {new Date(act.timestamp).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setCurrentShowId(act.showId);
                                setView('SEATING');
                                showToast(`Jumped to show: ${act.showName}`, 'info');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-500/50 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                              title="Switch to this show's seat map"
                            >
                              <span>Seat Map</span>
                              <ArrowRight className="w-3 h-3 text-amber-400" />
                            </button>

                            <button
                              onClick={() => {
                                setCurrentShowId(act.showId);
                                setView('MANIFEST');
                                showToast(`Opened manifest for: ${act.showName}`, 'info');
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition cursor-pointer"
                              title="Open manifest for this show"
                            >
                              Manifest
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
            <ShieldCheck className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">Super Admin Access Only</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              This system activity and audit log is exclusively available to Super Admin Bas.
            </p>
            <button
              onClick={() => setView('SEATING')}
              className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Return to Seat Map
            </button>
          </div>
        )}

      </main>

      {/* PRINT-ONLY GATE MANIFEST */}
      <div className="print-only p-8 text-black bg-white">
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">SUCAC Shows Ticket Database</h1>
              <p className="text-sm font-semibold">{activeShowObj.title} ({activeShowObj.date} • {activeShowObj.time})</p>
              <p className="text-xs text-gray-700">Silliman University Culture and Arts Council - Claire Isabel McGill Luce Auditorium</p>
            </div>
            <div className="text-right text-xs">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p className="font-bold">ADMIN & USHER GATE DESK COPY</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between text-xs font-semibold mb-4 bg-gray-100 p-2 border border-gray-300">
          <div>Total Booked / Charged Seats: <span className="font-bold">{bookedSeatsCount}</span></div>
          <div>Venue: Claire Isabel McGill Luce Auditorium, Silliman University</div>
        </div>

        <table className="w-full text-left text-xs border border-collapse border-black">
          <thead>
            <tr className="bg-gray-200 border-b border-black">
              <th className="border border-black p-1.5 font-bold">Seat</th>
              <th className="border border-black p-1.5 font-bold">Patron Name</th>
              <th className="border border-black p-1.5 font-bold">ID Number</th>
              <th className="border border-black p-1.5 font-bold">Category</th>
              <th className="border border-black p-1.5 font-bold">Price</th>
              <th className="border border-black p-1.5 font-bold">Billing Channel</th>
              <th className="border border-black p-1.5 font-bold">Notes</th>
              <th className="border border-black p-1.5 font-bold text-center">Admit (✓)</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(bookings)
              .sort((a, b) => a.seatId.localeCompare(b.seatId, undefined, { numeric: true }))
              .map(b => {
                const cat = categories.find(c => c.id === b.categoryId);
                return (
                  <tr key={b.seatId} className="border-b border-black">
                    <td className="border border-black p-1.5 font-bold font-mono">{b.seatId}</td>
                    <td className="border border-black p-1.5 font-semibold">{b.patronName}</td>
                    <td className="border border-black p-1.5 font-mono">{b.patronId}</td>
                    <td className="border border-black p-1.5 font-bold">{cat?.name || 'Standard'}</td>
                    <td className="border border-black p-1.5 font-mono">₱{(cat?.price || 0).toLocaleString()}</td>
                    <td className="border border-black p-1.5">{b.paymentMethod}</td>
                    <td className="border border-black p-1.5 italic text-[11px]">{b.notes || ''}</td>
                    <td className="border border-black p-1.5 text-center font-bold">[ &nbsp; &nbsp; ]</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* SUPER ADMIN (BAS) USER MANAGEMENT MODAL */}
      {isUserModalOpen && currentUser?.isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl p-6 shadow-2xl relative text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">SUCAC User & Staff Accounts</h3>
                  <p className="text-xs text-slate-400">Super Admin Panel (Bas) • Manage gatewall access keys</p>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Add User or Edit User Form */}
              {editingUser ? (
                <form onSubmit={handleSaveEditUser} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Edit User Account (@{editingUser.username})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelEditUser}
                      className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Username / Passcode <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editUserUsername}
                        onChange={e => setEditUserUsername(e.target.value)}
                        placeholder="e.g. maria, usher1"
                        className="w-full bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Passcode typed at gatewall</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Full Name of User <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editUserName}
                        onChange={e => setEditUserName(e.target.value)}
                        placeholder="e.g. Maria Santos"
                        className="w-full bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Display name for staff greeting</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditUser}
                      className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAddUser} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Authorize New Staff User</span>
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Username / Passcode <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        placeholder="e.g. maria, usher1"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Typed at the gatewall</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Full Name of User <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                        placeholder="e.g. Maria Santos"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Used for &quot;Welcome, Name&quot;</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create User Key</span>
                  </button>
                </form>
              )}

              {/* Existing Users List */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Authorized Accounts ({users.length}):
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {users.map(u => {
                    const userBookingsCount = Object.values(bookings).filter(b => (b.bookedByUsername || 'bas').toLowerCase() === u.username.toLowerCase()).length;
                    const isBeingEdited = editingUser?.username.toLowerCase() === u.username.toLowerCase();
                    return (
                      <div
                        key={u.username}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                          isBeingEdited
                            ? 'border-amber-500/60 bg-amber-500/10'
                            : 'border-slate-800 bg-slate-950'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                            u.isSuperAdmin ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-200'
                          }`}>
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white">{u.name}</span>
                              {u.isSuperAdmin ? (
                                <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                                  SUPER ADMIN
                                </span>
                              ) : (
                                <span className="text-[9px] bg-slate-800 text-slate-300 font-semibold px-1.5 py-0.2 rounded border border-slate-700">
                                  STAFF
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                              <span>Passcode: <span className="text-amber-300 font-bold">{u.username}</span></span>
                              <span>•</span>
                              <span>Bookings: <span className="text-emerald-400 font-bold">{userBookingsCount}</span></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditUser(u)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition cursor-pointer"
                            title={`Edit ${u.name} (@${u.username})`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {!u.isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.username)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition cursor-pointer"
                              title="Remove user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  handleCancelEditUser();
                  setIsUserModalOpen(false);
                }}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SHOWS & CATEGORIES MODAL */}
      {isEditShowsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative text-left max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white p-1 border border-red-500/30 flex items-center justify-center">
                  <SucacLogo className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">SUCAC Show & Category Management</h3>
                  <p className="text-xs text-slate-400">Configure show schedules, seat categories, and ticket prices</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditShowsModalOpen(false);
                  setEditingShowId(null);
                  setShowFormDescription('');
                  setEditingCategoryId(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-800 mt-3">
              <button
                onClick={() => setModalActiveTab('SHOWS')}
                className={`py-2 px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  modalActiveTab === 'SHOWS'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Shows & Schedules ({shows.length})
              </button>
              <button
                onClick={() => setModalActiveTab('CATEGORIES')}
                className={`py-2 px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  modalActiveTab === 'CATEGORIES'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" /> Seat Types & Prices ({categories.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {modalActiveTab === 'SHOWS' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Active Shows:
                    </span>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {shows.map(show => (
                        <div
                          key={show.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                            show.id === currentShowId
                              ? 'bg-amber-500/10 border-amber-500/40 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">{show.title}</span>
                              {show.id === currentShowId && (
                                <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{show.date}</span>
                              <span>•</span>
                              <span>{show.time}</span>
                              <span>•</span>
                              <span className="text-amber-400">{show.type}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {show.id !== currentShowId && (
                              <button
                                onClick={() => {
                                  setCurrentShowId(show.id);
                                  showToast(`Switched to "${show.title}"`, 'info');
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
                              >
                                Select
                              </button>
                            )}
                            <button
                              onClick={() => handleStartEditShow(show)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 cursor-pointer"
                              title="Edit show"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteShow(show.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                              title="Delete show"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSaveShow} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 text-amber-400" />
                        {editingShowId ? 'Edit Show Schedule' : 'Add New Show'}
                      </span>
                      {editingShowId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShowId(null);
                            setShowFormTitle('');
                            setShowFormDescription('');
                            setShowFormDate('');
                            setShowFormTime('');
                          }}
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          Cancel editing
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Show Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={showFormTitle}
                        onChange={e => setShowFormTitle(e.target.value)}
                        placeholder="e.g. BONIKID Gala Premiere"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Show Subtitle / Description <span className="text-[10px] text-slate-500 font-normal">(Printed on exported PNG blueprint only)</span>
                      </label>
                      <input
                        type="text"
                        value={showFormDescription}
                        onChange={e => setShowFormDescription(e.target.value)}
                        placeholder="e.g. A Silliman University Musical Stage Presentation"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Hidden from the main screen dropdown. Appears directly below the show title on the exported PNG.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Date <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={showFormDate}
                          onChange={e => setShowFormDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Time <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={showFormTime}
                          onChange={e => setShowFormTime(e.target.value)}
                          placeholder="e.g. 7:00 PM"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Show Type</label>
                      <select
                        value={showFormType}
                        onChange={e => setShowFormType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      >
                        {SHOW_TYPES.map(type => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer"
                      >
                        {editingShowId ? 'Update Show Details' : 'Create Show Schedule'}
                      </button>
                      {editingShowId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShowId(null);
                            setShowFormTitle('');
                            setShowFormDescription('');
                            setShowFormDate('');
                            setShowFormTime('');
                            setShowFormType('Gala Season Pass');
                          }}
                          className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Configured Categories & Prices:
                    </span>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {categories.map(cat => (
                        <div
                          key={cat.id}
                          className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-4 h-4 rounded-full border border-white/20 shadow-sm flex-shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white">{cat.name}</span>
                                <span className="text-[11px] font-mono-num font-bold text-emerald-400">
                                  ₱{(cat.price || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">{cat.color}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleStartEditCategory(cat)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 rounded hover:bg-slate-800 cursor-pointer"
                              title="Edit category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                              title="Delete category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSaveCategory} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-cyan-400" />
                        {editingCategoryId ? 'Edit Category & Price' : 'Add New Seat Category & Price'}
                      </span>
                      {editingCategoryId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(null);
                            setCategoryFormName('');
                            setCategoryFormColor('#f59e0b');
                            setCategoryFormPrice('500');
                          }}
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          Cancel editing
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Category / Section Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={categoryFormName}
                          onChange={e => setCategoryFormName(e.target.value)}
                          placeholder="e.g. VIP Faculty, Student Balcony"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Ticket Price (₱) <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          required
                          value={categoryFormPrice}
                          onChange={e => setCategoryFormPrice(e.target.value)}
                          placeholder="e.g. 500"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono-num focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                        Choose Color:
                      </label>
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="color"
                          value={categoryFormColor}
                          onChange={e => setCategoryFormColor(e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-700 cursor-pointer bg-slate-900"
                        />
                        <span className="text-xs font-mono text-slate-300">{categoryFormColor}</span>
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-bold border"
                          style={{
                            backgroundColor: `${categoryFormColor}20`,
                            borderColor: categoryFormColor,
                            color: categoryFormColor,
                          }}
                        >
                          Preview: {categoryFormName || 'Section'} • ₱{parseInt(categoryFormPrice || '0').toLocaleString()}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_PALETTE.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCategoryFormColor(c)}
                            className={`w-6 h-6 rounded-md border transition cursor-pointer flex items-center justify-center ${
                              categoryFormColor.toLowerCase() === c.toLowerCase()
                                ? 'scale-110 border-white ring-2 ring-white/50'
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c }}
                          >
                            {categoryFormColor.toLowerCase() === c.toLowerCase() && (
                              <Check className="w-3 h-3 text-white drop-shadow" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      {editingCategoryId ? 'Update Category' : 'Save New Category'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsEditShowsModalOpen(false);
                  setEditingShowId(null);
                  setShowFormDescription('');
                  setEditingCategoryId(null);
                }}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SEAT DETAIL / RELEASE MODAL */}
      {inspectSeatId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Armchair className="w-4 h-4 text-rose-400" />
                <span>Seat: <span className="text-amber-400 font-mono">{inspectSeatId}</span></span>
              </h3>
              <button
                onClick={() => setInspectSeatId(null)}
                className="text-slate-400 hover:text-white text-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bookings[inspectSeatId] ? (
              <div className="py-4 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Patron Name:</span>
                  <span className="font-bold text-white">{bookings[inspectSeatId].patronName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Student / Staff ID:</span>
                  <span className="font-mono text-amber-300">{bookings[inspectSeatId].patronId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Category & Price:</span>
                  {(() => {
                    const cat = categories.find(c => c.id === bookings[inspectSeatId].categoryId);
                    return (
                      <span
                        className="font-bold px-2 py-0.5 rounded text-[11px] border"
                        style={{
                          backgroundColor: `${cat?.color || '#f59e0b'}20`,
                          borderColor: cat?.color || '#f59e0b',
                          color: cat?.color || '#f59e0b',
                        }}
                      >
                        {cat?.name || 'Standard'} • ₱{(cat?.price || 0).toLocaleString()}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Billing Channel:</span>
                  <span className="font-semibold text-emerald-400">{bookings[inspectSeatId].paymentMethod}</span>
                </div>

                {/* SUPER ADMIN (BAS) ONLY: Who booked it! */}
                {currentUser?.isSuperAdmin && bookings[inspectSeatId]?.bookedByName && (
                  <div className="flex justify-between border-b border-slate-800 pb-1.5 bg-amber-500/5 px-2 py-1 rounded">
                    <span className="text-slate-400 font-semibold">Booked By (Staff):</span>
                    <span className="font-bold text-amber-300 font-mono">
                      {bookings[inspectSeatId].bookedByName} (@{bookings[inspectSeatId].bookedByUsername})
                    </span>
                  </div>
                )}

                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Booked Timestamp:</span>
                  <span className="text-slate-300">
                    {new Date(bookings[inspectSeatId].bookedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pb-1.5">
                  <span className="text-slate-400">Notes / Department:</span>
                  <span className="text-slate-300 italic">{bookings[inspectSeatId].notes || 'None'}</span>
                </div>

                {bookings[inspectSeatId]?.proofOfPaymentData && (
                  <div className="flex items-center justify-between border-t border-slate-800 pt-2 pb-1">
                    <span className="text-slate-400">Payment Receipt:</span>
                    <button
                      type="button"
                      onClick={() => setViewingReceipt(bookings[inspectSeatId])}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold cursor-pointer transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>View Receipt Image</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Seat {inspectSeatId} is currently available.
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex gap-3">
              {bookings[inspectSeatId] && (
                <button
                  onClick={() => handleReleaseSeat(inspectSeatId)}
                  className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" /> Release / Cancel Seat
                </button>
              )}
              <button
                onClick={() => setInspectSeatId(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT LIGHTBOX MODAL */}
      {viewingReceipt && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setViewingReceipt(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[90vh] rounded-2xl p-5 shadow-2xl flex flex-col text-left relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>Proof of Payment Receipt</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      Seat {viewingReceipt.seatId}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Patron: <span className="font-medium text-slate-200">{viewingReceipt.patronName}</span>
                    {viewingReceipt.patronId && (
                      <span className="ml-2 font-mono text-slate-400">({viewingReceipt.patronId})</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Replace receipt action */}
                <label
                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs"
                  title="Replace with new receipt file"
                >
                  <UploadCloud className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px] font-medium text-cyan-400 hidden sm:inline">Replace</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && viewingReceipt) handleUploadReceiptForManifestSeat(viewingReceipt.seatId, file);
                      e.target.value = '';
                    }}
                  />
                </label>

                {/* Remove receipt action */}
                <button
                  type="button"
                  onClick={() => {
                    if (viewingReceipt) {
                      handleRemoveReceiptForManifestSeat(viewingReceipt.seatId);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs"
                  title="Remove receipt image"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span className="text-[11px] font-medium text-rose-400 hidden sm:inline">Remove</span>
                </button>

                {viewingReceipt.proofOfPaymentData && (
                  <a
                    href={viewingReceipt.proofOfPaymentData}
                    download={viewingReceipt.proofOfPaymentName || `receipt_${viewingReceipt.seatId}.webp`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer"
                    title="Download receipt image"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setViewingReceipt(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="Close receipt preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Receipt Image Display */}
            <div className="flex-1 overflow-auto my-3 flex items-center justify-center bg-slate-950/80 rounded-xl p-2 border border-slate-800/80 min-h-[300px]">
              {viewingReceipt.proofOfPaymentData ? (
                <img
                  src={viewingReceipt.proofOfPaymentData}
                  alt="Proof of payment receipt"
                  className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-md"
                />
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No image data available for this receipt.
                </div>
              )}
            </div>

            {/* Footer with Metadata */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
              <div className="flex items-center gap-3">
                <span>Method: <strong className="text-slate-200">{viewingReceipt.paymentMethod}</strong></span>
                {viewingReceipt.proofOfPaymentName && (
                  <span className="font-mono text-slate-400 truncate max-w-[200px]">File: {viewingReceipt.proofOfPaymentName}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>Booked: {new Date(viewingReceipt.bookedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                <button
                  type="button"
                  onClick={() => setViewingReceipt(null)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANIFEST PROOF OF PAYMENT UPLOAD MODAL */}
      {uploadModalBooking && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            setUploadModalBooking(null);
            setModalReceiptPreview(null);
          }}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-5 shadow-2xl flex flex-col text-left relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>Upload Proof of Payment</span>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      Seat {uploadModalBooking.seatId}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Patron: <strong className="text-white">{uploadModalBooking.patronName}</strong>
                    {uploadModalBooking.patronId && <span className="ml-1 text-slate-500 font-mono">({uploadModalBooking.patronId})</span>}
                    <span className="mx-1.5">•</span>
                    <span>{activeShowObj.title}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadModalBooking(null);
                  setModalReceiptPreview(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div className="my-4">
              <input
                id="manifest-modal-receipt-input"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isModalCompressing}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleProcessModalReceiptFile(file);
                  e.target.value = '';
                }}
              />

              {isModalCompressing ? (
                <div className="p-8 rounded-2xl border border-cyan-500/40 bg-cyan-950/40 flex flex-col items-center justify-center gap-3 text-cyan-300">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <div className="text-center">
                    <span className="text-xs font-bold block">Optimizing &amp; Compressing...</span>
                    <span className="text-[11px] text-cyan-400/80">Scaling image to &lt;300 KB for lightning fast storage</span>
                  </div>
                </div>
              ) : modalReceiptPreview ? (
                <div className="p-4 rounded-2xl border border-cyan-500/50 bg-cyan-950/30 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={modalReceiptPreview.dataUrl}
                      alt="Receipt preview"
                      className="w-16 h-16 rounded-xl object-cover border border-cyan-500/40 bg-slate-950 flex-shrink-0 shadow-md"
                    />
                    <div className="flex-1 overflow-hidden">
                      <div className="text-xs font-bold text-white truncate">{modalReceiptPreview.fileName}</div>
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <span className="text-slate-400">Original: {modalReceiptPreview.originalKb} KB</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-cyan-300 font-bold bg-cyan-500/20 px-1.5 py-0.2 rounded border border-cyan-500/30">
                          {modalReceiptPreview.fileSizeKb} KB (&lt;300 KB)
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" /> Ready to link to Seat {uploadModalBooking.seatId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                    <label
                      htmlFor="manifest-modal-receipt-input"
                      className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer font-medium"
                    >
                      Choose Different Image
                    </label>
                    <button
                      type="button"
                      onClick={() => setModalReceiptPreview(null)}
                      className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition cursor-pointer font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={e => {
                    e.preventDefault();
                    setIsModalDragging(true);
                  }}
                  onDragLeave={() => setIsModalDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsModalDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleProcessModalReceiptFile(file);
                  }}
                  onClick={() => document.getElementById('manifest-modal-receipt-input')?.click()}
                  className={`p-8 rounded-2xl border-2 border-dashed transition flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${
                    isModalDragging
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 scale-[1.01]'
                      : 'border-slate-700 hover:border-cyan-500/60 bg-slate-950/60 hover:bg-slate-900 text-slate-400'
                  }`}
                >
                  <UploadCloud className="w-8 h-8 text-cyan-400" />
                  <div className="text-xs font-semibold text-slate-200">
                    Drag &amp; drop receipt here, or <span className="text-cyan-400 underline">browse device</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Automatically compressed to &lt;300 KB • Supports PNG, JPG, WebP
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Payment Channel: <strong className="text-slate-200">{uploadModalBooking.paymentMethod}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUploadModalBooking(null);
                    setModalReceiptPreview(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer font-medium"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!modalReceiptPreview || isModalCompressing || uploadingReceiptSeatId === uploadModalBooking.seatId}
                  onClick={handleSaveModalReceipt}
                  className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                >
                  {uploadingReceiptSeatId === uploadModalBooking.seatId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Save Proof of Payment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPER ADMIN (BAS) LIVE RECENT ACTIVITY SLIDE-OVER DRAWER */}
      {isActivityDrawerOpen && currentUser?.isSuperAdmin && (
        <div className="fixed inset-0 z-[105] overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={() => setIsActivityDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
          />

          {/* Slide-over panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <Activity className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-white text-sm">Recent Activities</h3>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500 text-slate-950">
                        BAS
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Live feed of ticket reservations & staff actions</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsActivityDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="Close activity drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Search */}
              <div className="p-3 border-b border-slate-800 bg-slate-900/90">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={activitySearch}
                    onChange={e => setActivitySearch(e.target.value)}
                    placeholder="Search recent activity..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Drawer Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-800/50">
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No recent activities recorded.
                  </div>
                ) : (
                  filteredActivities.slice(0, 40).map(act => (
                    <div key={act.id} className="pt-3 first:pt-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              act.type === 'BOOKING'
                                ? 'bg-emerald-400'
                                : act.type === 'CANCELLATION'
                                ? 'bg-rose-400'
                                : 'bg-amber-400'
                            }`}
                          />
                          <span className="text-xs font-bold text-white">
                            {act.seatIds && act.seatIds.length > 0 ? `Seat ${act.seatIds.join(', ')}` : act.type}
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-300 font-semibold font-mono">
                          {formatRelativeTime(act.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 mt-1 font-medium">
                        {act.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
                          <UserCheck className="w-2.5 h-2.5" />
                          <span>{act.performedByName}</span>
                          <span className="opacity-70 font-mono">(@{act.performedByUsername})</span>
                        </span>

                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {act.showName}
                        </span>

                        {act.paymentMethod && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                            {act.paymentMethod}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/40">
                        <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <button
                          onClick={() => {
                            setCurrentShowId(act.showId);
                            setView('SEATING');
                            setIsActivityDrawerOpen(false);
                            showToast(`Switched to show: ${act.showName}`, 'info');
                          }}
                          className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>View on Seat Map</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {filteredActivities.length} total events
                </span>

                <button
                  onClick={() => {
                    setView('ACTIVITIES');
                    setIsActivityDrawerOpen(false);
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1 shadow-md shadow-amber-500/20"
                >
                  <span>Open Full Activity Log</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[110] transition-all duration-300 max-w-sm bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-2">
          <span className="font-medium">{toast.msg}</span>
        </div>
      )}

    </div>
  );
}
