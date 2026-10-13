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
  Focus
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
  bookedAt: string;
}

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
  const [view, setView] = useState<'SEATING' | 'MANIFEST'>('SEATING');

  // 1. DEFAULT ZOOM CHANGED FROM 60% TO 50%
  const [zoom, setZoom] = useState<number>(0.5);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());

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
  const [patronId, setPatronId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Charge to Tuition');
  const [bookingNotes, setBookingNotes] = useState('');

  // Modals State
  const [inspectSeatId, setInspectSeatId] = useState<string | null>(null);
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
  // Manifest Filters
  const [manifestSearch, setManifestSearch] = useState('');
  const [manifestCategoryFilter, setManifestCategoryFilter] = useState('ALL');
  const [manifestStaffFilter, setManifestStaffFilter] = useState('ALL');

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

  // Seat Click Handler
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
    if (!patronName.trim() || !patronId.trim()) {
      showToast('Patron name and ID number are required.', 'error');
      return;
    }

    const timestamp = new Date().toISOString();
    const newBookingsMap = { ...bookings };
    const batch = writeBatch(db);

    selectedSeats.forEach(seatId => {
      const bookingData: Booking = {
        seatId,
        patronName: patronName.trim(),
        patronId: patronId.trim(),
        paymentMethod,
        categoryId: seatCategoryMap[seatId] || getDefaultCategoryId(seatId),
        // Secretly record current logged-in user:
        bookedByUsername: currentUser?.username || 'bas',
        bookedByName: currentUser?.name || 'Bas',
        notes: bookingNotes.trim() || '',
        bookedAt: timestamp,
      };
      newBookingsMap[seatId] = bookingData;
      batch.set(doc(db, 'shows', currentShowId, 'bookings', seatId), bookingData);
    });

    setBookings(newBookingsMap);

    try {
      await batch.commit();
      showToast(`Successfully booked and synced ${selectedSeats.size} seat(s) for ${patronName}!`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shows/${currentShowId}/bookings`);
    }

    setSelectedSeats(new Set());
    setPatronName('');
    setPatronId('');
    setBookingNotes('');
  };

  // Release Seat
  const handleReleaseSeat = async (seatId: string) => {
    setBookings(prev => {
      const next = { ...prev };
      delete next[seatId];
      return next;
    });
    setInspectSeatId(null);

    try {
      await deleteDoc(doc(db, 'shows', currentShowId, 'bookings', seatId));
      showToast(`Released seat ${seatId} back to inventory and synced.`, 'info');
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
      ? ['Show ID', 'Seat Number', 'Patron Name', 'ID Number', 'Category / Section', 'Ticket Price', 'Payment Channel', 'Booked By Staff', 'Notes', 'Booked At']
      : ['Show ID', 'Seat Number', 'Patron Name', 'ID Number', 'Category / Section', 'Ticket Price', 'Payment Channel', 'Notes', 'Booked At'];

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

  // Filtered Manifest Bookings (Bas can filter by Staff)
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
    return list.sort((a, b) => a.seatId.localeCompare(b.seatId, undefined, { numeric: true }));
  }, [bookings, manifestCategoryFilter, manifestStaffFilter, manifestSearch, currentUser]);

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
        onClick={() => handleSeatClick(seatId)}
        style={customInlineStyle}
        title={isBooked ? `Booked: ${bookings[seatId].patronName} (${cat.name} • ₱${(cat.price || 0).toLocaleString()}) - Click to inspect/release` : `Seat ${seatId} • ${cat.name} (₱${(cat.price || 0).toLocaleString()})`}
        className={`seat-btn font-mono-num transition flex items-center justify-center cursor-pointer border ${colorStyle}`}
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

            {/* Manifest / Map View Toggle */}
            <button
              onClick={() => setView(v => v === 'SEATING' ? 'MANIFEST' : 'SEATING')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-medium transition cursor-pointer"
            >
              <ListFilter className="w-3.5 h-3.5 text-amber-400" />
              <span>{view === 'SEATING' ? 'Gate Manifest' : 'Seat Map'}</span>
            </button>

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
                    <X className="w-3 h-3" /> Deselect
                  </button>
                </div>
              </div>

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
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Patron / Student Name <span className="text-rose-400">*</span>
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

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Student / Staff ID Number <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={patronId}
                        onChange={e => setPatronId(e.target.value)}
                        placeholder="e.g. 2024-00192"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Billing Channel <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      >
                        <option value="Charge to Tuition">Charge to Tuition</option>
                        <option value="Student Account Billing">Student Account Billing</option>
                        <option value="Payroll Deduction">Payroll Deduction</option>
                        <option value="Complimentary / VIP Pass">Complimentary / VIP Pass</option>
                        <option value="Cash / Front Gate">Cash / Front Gate</option>
                      </select>
                    </div>

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
        ) : (
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
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-950/40">
                      <th className="py-3 px-3">Seat</th>
                      <th className="py-3 px-3">Patron Name</th>
                      <th className="py-3 px-3">ID Number</th>
                      <th className="py-3 px-3">Category & Price</th>
                      <th className="py-3 px-3">Billing Channel</th>
                      {/* SUPER ADMIN (BAS) ONLY COLUMN: Who booked it! */}
                      {currentUser?.isSuperAdmin && (
                        <th className="py-3 px-3 text-amber-400">Booked By (Staff)</th>
                      )}
                      <th className="py-3 px-3">Notes</th>
                      <th className="py-3 px-3">Timestamp</th>
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
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {new Date(item.bookedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => setInspectSeatId(item.seatId)}
                              className="text-rose-400 hover:text-rose-300 font-semibold text-[11px] px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer"
                            >
                              Release
                            </button>
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

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[110] transition-all duration-300 max-w-sm bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-2">
          <span className="font-medium">{toast.msg}</span>
        </div>
      )}

    </div>
  );
}
