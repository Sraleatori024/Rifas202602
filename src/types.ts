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
  prizes?: Prize[];
  packages?: RafflePackage[];
  winners?: Winner[];
  promotion?: PromotionConfig;
  roulette?: RouletteConfig;
}

export interface RaffleNumber {
  id: number;
  raffle_id: number;
  number: number;
  status: 'available' | 'pago';
  buyer_name?: string;
  buyer_whatsapp?: string;
  buyer_instagram?: string;
}
