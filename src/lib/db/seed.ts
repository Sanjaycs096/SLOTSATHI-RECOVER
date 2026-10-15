import { Provider, Service, Appointment, WaitlistEntry, RecoveryOffer } from '@/types';

export const SEED_PROVIDER: Provider = {
  id: 'prov-001',
  name: 'Dr. Aditi Sharma',
  title: 'Senior STEM & Mathematics Tutor',
  bio: 'IIT Bombay alumna with 8+ years experience coaching students for CBSE Board, IB Higher Level, and JEE Advanced. Passionate about conceptual clarity and active problem solving.',
  email: 'aditi.sharma.tutor@slotsathi.demo',
  phone: '+91 98765 43210',
  whatsapp_number: '919876543210',
  avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
  slug: 'aditi-sharma',
  location: 'Bengaluru / Live Interactive Online',
  timezone: 'Asia/Kolkata',
  hourly_rate_inr: 1200,
};

export const SEED_SERVICES: Service[] = [
  {
    id: 'srv-001',
    provider_id: 'prov-001',
    title: 'Advanced Calculus & Analytical Geometry',
    subject: 'Mathematics',
    duration_minutes: 60,
    price_inr: 1200,
    color: '#4F46E5', // Indigo
    description: 'Master differential & integral calculus, curve sketching, and coordinate geometry with step-by-step proofs and exam practice.',
  },
  {
    id: 'srv-002',
    provider_id: 'prov-001',
    title: 'JEE Advanced Mechanics Deep-Dive',
    subject: 'Physics',
    duration_minutes: 90,
    price_inr: 1800,
    color: '#0EA5E9', // Sky Blue
    description: 'Rotational dynamics, Newton’s laws, work-energy theorem, and multi-concept challenge problems with visual animations.',
  },
  {
    id: 'srv-003',
    provider_id: 'prov-001',
    title: 'Organic Chemistry Reaction Mechanisms',
    subject: 'Chemistry',
    duration_minutes: 60,
    price_inr: 1200,
    color: '#10B981', // Emerald
    description: 'Electrophilic addition, nucleophilic substitution, stereochemistry, and retrosynthetic analysis made crystal clear.',
  },
  {
    id: 'srv-004',
    provider_id: 'prov-001',
    title: 'Python for Problem Solving & Algorithms',
    subject: 'Computer Science',
    duration_minutes: 60,
    price_inr: 1400,
    color: '#F59E0B', // Amber
    description: 'Data structures, recursion, dynamic programming intuition, and live coding exercises for Olympiads and school curriculum.',
  },
];

// Helper to make future dates relative to current local time
export function getFutureDate(daysFromNow: number, hour: number, minute: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function getPastDate(hoursAgo: number): string {
  const d = new Date();
  d.setTime(d.getTime() - hoursAgo * 60 * 60 * 1000);
  return d.toISOString();
}

export function createInitialSeedData(): {
  provider: Provider;
  services: Service[];
  appointments: Appointment[];
  waitlist: WaitlistEntry[];
  offers: RecoveryOffer[];
} {
  const appointments: Appointment[] = [
    // 1. Confirmed upcoming session tomorrow at 10:00 AM
    {
      id: 'appt-101',
      provider_id: 'prov-001',
      service_id: 'srv-001',
      customer_name: 'Aarav Patel',
      customer_email: 'aarav.patel@example.com',
      customer_phone: '+91 98200 11223',
      start_time: getFutureDate(1, 10, 0),
      end_time: getFutureDate(1, 11, 0),
      price_inr: 1200,
      status: 'confirmed',
      cancellation_token: 'cancel-token-aarav-101',
      cancelled_at: null,
      cancellation_reason: null,
      is_replacement: false,
      recovered_from_appointment_id: null,
      recovered_at: null,
      is_demo_seed: true,
      created_at: getPastDate(72),
    },

    // 2. Confirmed upcoming session tomorrow at 4:00 PM (Great for testing direct cancellation!)
    {
      id: 'appt-102',
      provider_id: 'prov-001',
      service_id: 'srv-001',
      customer_name: 'Ananya Deshmukh',
      customer_email: 'ananya.deshmukh@example.com',
      customer_phone: '+91 97690 33445',
      start_time: getFutureDate(1, 16, 0),
      end_time: getFutureDate(1, 17, 0),
      price_inr: 1200,
      status: 'confirmed',
      cancellation_token: 'cancel-token-ananya-102',
      cancelled_at: null,
      cancellation_reason: null,
      is_replacement: false,
      recovered_from_appointment_id: null,
      recovered_at: null,
      is_demo_seed: true,
      created_at: getPastDate(48),
    },

    // 3. CANCELLED session ready for recovery demo! (Tomorrow 2:00 PM, Calculus)
    {
      id: 'appt-103',
      provider_id: 'prov-001',
      service_id: 'srv-001',
      customer_name: 'Rohan Mehra',
      customer_email: 'rohan.mehra@example.com',
      customer_phone: '+91 98110 55667',
      start_time: getFutureDate(1, 14, 0),
      end_time: getFutureDate(1, 15, 0),
      price_inr: 1200,
      status: 'cancelled',
      cancellation_token: 'cancel-token-rohan-103',
      cancelled_at: getPastDate(3),
      cancellation_reason: 'Sudden school football tournament practice',
      is_replacement: false,
      recovered_from_appointment_id: null,
      recovered_at: null,
      is_demo_seed: true,
      created_at: getPastDate(96),
    },

    // 4. Confirmed upcoming session day after tomorrow 11:30 AM (Physics)
    {
      id: 'appt-104',
      provider_id: 'prov-001',
      service_id: 'srv-002',
      customer_name: 'Ishaan Verma',
      customer_email: 'ishaan.v@example.com',
      customer_phone: '+91 99200 77889',
      start_time: getFutureDate(2, 11, 30),
      end_time: getFutureDate(2, 13, 0),
      price_inr: 1800,
      status: 'confirmed',
      cancellation_token: 'cancel-token-ishaan-104',
      cancelled_at: null,
      cancellation_reason: null,
      is_replacement: false,
      recovered_from_appointment_id: null,
      recovered_at: null,
      is_demo_seed: true,
      created_at: getPastDate(36),
    },

    // 5. PAST RECOVERED PAIR: Original cancelled appointment
    {
      id: 'appt-105-orig',
      provider_id: 'prov-001',
      service_id: 'srv-003',
      customer_name: 'Siddharth Rao',
      customer_email: 'siddharth.rao@example.com',
      customer_phone: '+91 98210 99001',
      start_time: getFutureDate(3, 15, 0),
      end_time: getFutureDate(3, 16, 0),
      price_inr: 1200,
      status: 'cancelled',
      cancellation_token: 'cancel-token-siddharth-105',
      cancelled_at: getPastDate(26),
      cancellation_reason: 'Doctor appointment clash',
      is_replacement: false,
      recovered_from_appointment_id: null,
      recovered_at: null,
      is_demo_seed: true,
      created_at: getPastDate(120),
    },

    // 6. PAST RECOVERED PAIR: Replacement appointment (successfully refilled!)
    {
      id: 'appt-105-repl',
      provider_id: 'prov-001',
      service_id: 'srv-003',
      customer_name: 'Pooja Nair',
      customer_email: 'pooja.nair@example.com',
      customer_phone: '+91 98450 12345',
      start_time: getFutureDate(3, 15, 0),
      end_time: getFutureDate(3, 16, 0),
      price_inr: 1200,
      status: 'confirmed',
      cancellation_token: 'cancel-token-pooja-105',
      cancelled_at: null,
      cancellation_reason: null,
      is_replacement: true,
      recovered_from_appointment_id: 'appt-105-orig',
      recovered_at: getPastDate(25), // refilled within 1 hour!
      is_demo_seed: true,
      created_at: getPastDate(25),
    },
  ];

  const waitlist: WaitlistEntry[] = [
    {
      id: 'wt-001',
      provider_id: 'prov-001',
      service_id: 'srv-001', // Calculus
      customer_name: 'Tanvi Iyer',
      customer_email: 'tanvi.iyer@example.com',
      customer_phone: '+91 98330 44556',
      preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      preferred_time_windows: ['afternoon', 'evening'],
      duration_minutes: 60,
      urgency: 'high',
      status: 'waiting',
      notes: 'Upcoming mid-term calculus exam on Friday. Eager for any slot!',
      is_demo_seed: true,
      created_at: getPastDate(50),
    },
    {
      id: 'wt-002',
      provider_id: 'prov-001',
      service_id: 'srv-001', // Calculus
      customer_name: 'Kabir Sengupta',
      customer_email: 'kabir.s@example.com',
      customer_phone: '+91 98710 66778',
      preferred_days: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
      preferred_time_windows: ['afternoon'],
      duration_minutes: 60,
      urgency: 'normal',
      status: 'waiting',
      notes: 'Needs help with integration techniques and definite integrals.',
      is_demo_seed: true,
      created_at: getPastDate(28),
    },
    {
      id: 'wt-003',
      provider_id: 'prov-001',
      service_id: 'srv-002', // Mechanics
      customer_name: 'Devika Menon',
      customer_email: 'devika.m@example.com',
      customer_phone: '+91 99300 88990',
      preferred_days: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'],
      preferred_time_windows: ['morning', 'afternoon'],
      duration_minutes: 90,
      urgency: 'high',
      status: 'waiting',
      notes: 'Preparing for JEE Advanced mock tests. Wants rotational mechanics doubts solved.',
      is_demo_seed: true,
      created_at: getPastDate(65),
    },
    {
      id: 'wt-004',
      provider_id: 'prov-001',
      service_id: 'srv-004', // Python
      customer_name: 'Arjun Nambiar',
      customer_email: 'arjun.n@example.com',
      customer_phone: '+91 98400 33221',
      preferred_days: ['Friday', 'Saturday', 'Sunday'],
      preferred_time_windows: ['evening'],
      duration_minutes: 60,
      urgency: 'normal',
      status: 'waiting',
      notes: 'School CS practical exam in 2 weeks. Wants recursion & binary search trees.',
      is_demo_seed: true,
      created_at: getPastDate(15),
    },
  ];

  const offers: RecoveryOffer[] = [
    // One previously completed offer for the recovered pair
    {
      id: 'off-101',
      appointment_id: 'appt-105-orig',
      waitlist_entry_id: 'wt-past-pooja',
      token: 'offer-token-claimed-pooja',
      status: 'accepted',
      expires_at: getPastDate(24),
      sent_at: getPastDate(26),
      channel: 'whatsapp',
      match_score: 95,
      match_reasons: ['Exact subject match', 'Requested 60m fits 60m', 'Afternoon preference satisfied'],
      whatsapp_url: 'https://wa.me/919845012345',
      accepted_at: getPastDate(25),
      created_at: getPastDate(26),
      customer_name: 'Pooja Nair',
      customer_phone: '+91 98450 12345',
      service_title: 'Organic Chemistry Reaction Mechanisms',
      slot_start_time: getFutureDate(3, 15, 0),
      slot_end_time: getFutureDate(3, 16, 0),
      price_inr: 1200,
    },
  ];

  return {
    provider: SEED_PROVIDER,
    services: SEED_SERVICES,
    appointments,
    waitlist,
    offers,
  };
}
