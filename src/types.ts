import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isPago(status: string | undefined): boolean {
  if (!status) return false;
  return ["paid", "pago"].includes(status.toLowerCase());
}

export interface User {
  email: string;
  role: 'admin' | 'client';
}

export interface Prize {
  position: number;
  value: string; // Changed to string to allow "iPhone 15" or "R$ 5.000"
  description?: string;
}

export interface RafflePackage {
  id: string;
  quantity: number;
  price: number;
  highlight: boolean;
  active: boolean;
}

export interface Winner {
  prize: Prize;
  number: number;
  buyer_name: string;
  buyer_whatsapp: string;
  buyer_instagram?: string;
  drawn_at: string;
}

export interface RoulettePrize {
  id: string;
  type: 'numeros' | 'pix';
  value: number;
  chance: number; // 0-100
}

export interface RouletteConfig {
  active: boolean;
  min_purchase_value: number;
  prizes: RoulettePrize[];
}

export interface PromotionConfig {
  active: boolean;
  type: 'discount' | 'bonus';
  value: number; // percentage for discount, quantity for bonus
  min_purchase_quantity: number;
}

export interface RaffleReservation {
  id: string;
  numbers: number[];
  expires_at: number;
  buyer_name?: string;
}

export interface Raffle {
  id: string;
  name: string;
  description: string;
  price: number;
  total_numbers: number;
  type: 'manual' | 'automatic';
  start_date: string;
  end_date?: string;
  indeterminate_date: boolean;
  image_url: string;
  profit_percent: number;
  active: number; // 1: active, 0: ended, 2: drawn
  status: 'active' | 'ended' | 'drawn';
  created_at: string;
  progress_percent?: number;
  min_purchase_quantity?: number;
  min_revenue_goal?: number;
  min_sales_percent?: number;
  draw_manually_released?: boolean;
  sold_count?: number;
  revenue?: number;
  paid_numbers?: number[];
  reserved_numbers?: RaffleReservation[];
  occupied_numbers?: number[];
  prizes?: Prize[];
  packages?: RafflePackage[];
  winners?: Winner[];
  promotion?: PromotionConfig;
  roulette?: RouletteConfig;
}

export interface RaffleNumber {
  id: number | string;
  raffle_id?: number | string;
  number: number;
  status: 'available' | 'reserved' | 'paid' | 'pago' | 'pending_payment' | 'expired' | 'cancelled';
  buyer_name?: string;
  buyer_whatsapp?: string;
  buyer_instagram?: string;
  expires_at?: any;
}

export type PixGroupType = 'whatsapp' | 'telegram';
export type PixGroupStatus = 'draft' | 'active' | 'paused' | 'closed' | 'drawn';
export type PixParticipationStatus = 'pending' | 'valid' | 'invalid' | 'cancelled';

export interface PixGroup {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  type: PixGroupType;
  access_link: string;
  participation_price: number;
  prize: string;
  prize_description?: string;
  closing_date?: string;
  draw_date?: string;
  max_participations?: number;
  allow_multiple_participations?: boolean;
  status: PixGroupStatus;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  total_participations_count?: number;
  valid_participations_count?: number;
  total_revenue?: number;
}

export interface PixParticipation {
  id: string;
  group_id: string;
  group_name?: string;
  user_id?: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_cpf?: string;
  payment_id: string;
  amount: number;
  status: PixParticipationStatus;
  participation_code: string; // Ex: GP01-A8B9C2
  created_at: string;
  confirmed_at?: string;
  cancelled_at?: string;
}

export interface PixDraw {
  id: string;
  group_id: string;
  group_name: string;
  prize: string;
  winner_participation_id: string;
  winner_code: string;
  winner_name: string;
  winner_phone_masked: string;
  valid_participations_count: number;
  created_at: string;
  drawn_by: string;
  status: 'completed' | 'cancelled';
  audit_hash?: string;
}

export interface PixGlobalCompliance {
  enabled: boolean;
  terms_notice?: string;
}
